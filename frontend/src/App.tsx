import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (x: number, digits = 1) => `${x.toFixed(digits)}%`;
const fmtX = (x: number, digits = 2) => `${x.toFixed(digits)}x`;

/* ---- Glassmorphism presets (mais leve) ---- */
const PANEL =
  "rounded-2xl border border-white/5 bg-white/3 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.35)]";

/* Base field consistente */
const FIELD_BASE =
  "h-10 w-full rounded-xl border border-white/5 bg-white/3 backdrop-blur-sm px-3 text-sm placeholder-white/50 focus:outline-none focus:border-white/15";

/* Numéricos (sem spinners) */
const FIELD_NUMBER =
  `${FIELD_BASE} [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

/* Texto */
const FIELD = FIELD_BASE;

/* Select com chevron */
const SELECT_FIELD = `${FIELD_BASE} pr-9 appearance-none cursor-pointer`;

/* Checkbox consistente */
const CHECKBOX =
  "h-4 w-4 rounded border border-white/20 bg-white/10 accent-white/90 focus:outline-none focus:ring-2 focus:ring-white/20";

type Row = Record<string, string | number | null>;
type ScenarioOut = {
  shock_bps: number;
  eve_change: number;
  eve_pct_equity: number; // decimal
  nii_delta: number;
  lcr_hqla: number;
  lcr_outflows: number;
  lcr_coverage: number;
};

const REQUIRED_COLS = [
  "type",
  "name",
  "amount",
  "rate",
  "duration",
  "category",
  "fixed_float",
  "float_share",
  "repricing_bucket",
];
const OPTIONAL_COLS = ["deposit_beta", "stability", "convexity"];

function BackgroundGlow() {
  return (
    <>
      <div className="fixed inset-0 -z-50 bg-neutral-950" />
      <div
        className="pointer-events-none fixed inset-0 -z-40"
        style={{
          background: `
            radial-gradient(1200px 800px at 50% 15%, rgba(59,130,246,0.12), transparent 70%),
            radial-gradient(1000px 700px at 25% 75%, rgba(96,165,250,0.10), transparent 75%),
            radial-gradient(900px 600px at 75% 70%, rgba(37,99,235,0.09), transparent 75%),
            radial-gradient(800px 500px at 15% 40%, rgba(147,197,253,0.08), transparent 70%),
            radial-gradient(700px 500px at 85% 30%, rgba(29,78,216,0.07), transparent 70%)
          `,
        }}
      />
    </>
  );
}

export default function App() {
  // CSV preview state
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Modal preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // Parser options
  const [delimiter, setDelimiter] = useState(",");
  const [headerRow, setHeaderRow] = useState(true);

  // Parameters
  const [afsHaircut, setAfsHaircut] = useState<number>(0.1);
  const [depositRunoff, setDepositRunoff] = useState<number>(0.15);
  const [betaCore, setBetaCore] = useState<number>(0.3);
  const [betaNoncore, setBetaNoncore] = useState<number>(0.6);
  const [shocks, setShocks] = useState<number[]>([-200, -100, 0, 100, 200]);

  // Raw CSV (to send)
  const [rawCsv, setRawCsv] = useState<string>("");

  // API results
  const [equity, setEquity] = useState<number>(0);
  const [results, setResults] = useState<ScenarioOut[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  const requiredMissing = useMemo(
    () => REQUIRED_COLS.filter((c) => headers.length && !headers.includes(c)),
    [headers]
  );
  const optionalMissing = useMemo(
    () => OPTIONAL_COLS.filter((c) => headers.length && !headers.includes(c)),
    [headers]
  );

  /* ---- CSV upload/parse ---- */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setError("");

    // raw CSV para backend
    const reader = new FileReader();
    reader.onload = () => setRawCsv(String(reader.result || ""));
    reader.onerror = () => setRawCsv("");
    reader.readAsText(f);

    // parse preview
    Papa.parse<Row>(f, {
      header: headerRow,
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (res) => {
        if (res.errors && res.errors.length) {
          setError(
            `Parse error on row ${res.errors[0].row}: ${res.errors[0].message}`
          );
          setRows([]);
          setHeaders([]);
          return;
        }
        const data = (res.data as Row[]).filter((r) => Object.keys(r).length);
        setRows(data);
        const hdrs = res.meta.fields ?? Object.keys(data[0] || {});
        setHeaders(hdrs);
      },
      error: (err) => setError(err.message || "Unknown error while parsing CSV."),
    });
  }

  function normalizeCell(key: string, value: any) {
    if (value === undefined || value === null) return "";
    if (
      ["amount", "rate", "duration", "float_share", "deposit_beta", "convexity"].includes(
        key
      )
    ) {
      if (typeof value === "string" && value.trim() === "") return "";
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      return num;
    }
    return typeof value === "string" ? value : String(value);
  }

  const previewCount = 100;
  const previewRows = useMemo(() => rows.slice(0, previewCount), [rows]);

  /* ---- Run API ---- */
  async function runStressTest() {
    setApiError("");
    setResults([]);
    if (!rawCsv) {
      setApiError("Please upload a CSV first.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("http://localhost:8000/stress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv_text: rawCsv,
          params: {
            shocks_bps: shocks,
            afs_haircut: afsHaircut,
            deposit_runoff: depositRunoff,
            deposit_beta_core: betaCore,
            deposit_beta_noncore: betaNoncore,
            lag_months: 1,
          },
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "API returned an error");
      }
      const data = await resp.json();
      setEquity(data.equity ?? 0);
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (e: any) {
      setApiError(e?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function exportResultsCsv() {
    if (!results.length) return;
    const header =
      "shock_bps,eve_change,eve_pct_equity,nii_delta,lcr_hqla,lcr_outflows,lcr_coverage";
    const lines = results.map((r) =>
      [
        r.shock_bps,
        r.eve_change,
        r.eve_pct_equity,
        r.nii_delta,
        r.lcr_hqla,
        r.lcr_outflows,
        r.lcr_coverage,
      ].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stress_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => a.shock_bps - b.shock_bps),
    [results]
  );

  // --- Preview: melhorias ---
  const [previewQuery, setPreviewQuery] = useState("");
  const [compactRows, setCompactRows] = useState(false);

  const filteredPreviewRows = useMemo(() => {
    if (!previewQuery.trim()) return previewRows;
    const q = previewQuery.toLowerCase();
    return previewRows.filter((r) =>
      headers.some((h) =>
        String((r as any)[h] ?? "").toLowerCase().includes(q)
      )
    );
  }, [previewRows, headers, previewQuery]);

  function rowsToCsv(hdrs: string[], rowsArr: Row[]) {
    const esc = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = hdrs.map(esc).join(",");
    const body = rowsArr
      .map((r) => hdrs.map((h) => esc((r as any)[h])).join(","))
      .join("\n");
    return `${head}\n${body}`;
  }

  function copyPreviewCsv() {
    const csv = rowsToCsv(headers, filteredPreviewRows as Row[]);
    navigator.clipboard.writeText(csv).catch(() => {});
  }

  function downloadPreviewCsv() {
    const csv = rowsToCsv(headers, filteredPreviewRows as Row[]);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // atalhos: Esc fecha | Cmd/Ctrl+F foca a pesquisa
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!previewOpen) return;
      if (e.key === "Escape") setPreviewOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const el = document.getElementById("preview-search") as
          | HTMLInputElement
          | null;
        el?.focus();
        el?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen">
      <BackgroundGlow />

      <div className="container max-w-6xl py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bank Stress Test Simulator
          </h1>
          <Badge variant="secondary" className="text-xs">
            v0.3.2
          </Badge>
        </header>

        {/* Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sidebar (agora inclui Upload) */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
              <Card className={PANEL}>
                <CardHeader>
                  <CardTitle className="text-base">Data & Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* === Upload: botão largura total === */}
                  <div className="space-y-2">
                    <label className="block text-sm">CSV file</label>

                    <Button
                      asChild
                      variant="secondary"
                      className="w-full justify-center bg-white/10 hover:bg-white/15 border border-white/10"
                    >
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer w-full text-center"
                      >
                        Choose File
                      </label>
                    </Button>

                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={onFileChange}
                      className="hidden"
                    />

                    {/* Delimiter + checkbox */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs mb-1 opacity-80">
                          Delimiter
                        </label>
                        <div className="relative">
                          <select
                            value={delimiter}
                            onChange={(e) => setDelimiter(e.target.value)}
                            className={SELECT_FIELD}
                          >
                            <option value=",">Comma (,)</option>
                            <option value=";">Semicolon (;)</option>
                            <option value="\t">Tab (\t)</option>
                          </select>
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70"
                          >
                            <path
                              fill="currentColor"
                              d="M5.5 7.5L10 12l4.5-4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>

                      <label className="mt-6 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={headerRow}
                          onChange={(e) => setHeaderRow(e.target.checked)}
                          className={CHECKBOX}
                        />
                        First row contains headers
                      </label>
                    </div>
                  </div>

                  {/* === Parameters === */}
                  <label className="text-sm block">
                    AFS haircut (0–0.5)
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={0.5}
                      value={afsHaircut}
                      onChange={(e) => setAfsHaircut(Number(e.target.value))}
                      className={FIELD_NUMBER}
                    />
                  </label>

                  <label className="text-sm block">
                    Deposit runoff (0–1)
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      value={depositRunoff}
                      onChange={(e) => setDepositRunoff(Number(e.target.value))}
                      className={FIELD_NUMBER}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm block">
                      Beta (core)
                      <input
                        type="number"
                        step="0.05"
                        min={0}
                        max={1}
                        value={betaCore}
                        onChange={(e) => setBetaCore(Number(e.target.value))}
                        className={FIELD_NUMBER}
                      />
                    </label>
                    <label className="text-sm block">
                      Beta (noncore)
                      <input
                        type="number"
                        step="0.05"
                        min={0}
                        max={1}
                        value={betaNoncore}
                        onChange={(e) => setBetaNoncore(Number(e.target.value))}
                        className={FIELD_NUMBER}
                      />
                    </label>
                  </div>

                  <label className="text-sm block">
                    Shocks (bps)
                    <input
                      type="text"
                      value={shocks.join(",")}
                      onChange={(e) => {
                        const xs = e.target.value
                          .split(",")
                          .map((s) => Number(s.trim()))
                          .filter((n) => !Number.isNaN(n));
                        setShocks(xs);
                      }}
                      className={FIELD}
                      placeholder="-200,-100,0,100,200"
                    />
                  </label>

                  <div className="grid gap-2">
                    <Button
                      variant="secondary"
                      className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                      onClick={() => setPreviewOpen(true)}
                      disabled={headers.length === 0}
                      title={
                        headers.length === 0
                          ? "Upload a CSV first"
                          : "Preview parsed CSV"
                      }
                    >
                      Preview CSV
                    </Button>

                    <Button
                      onClick={runStressTest}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 animate-pulse rounded-full bg-white/80" />
                          <span className="h-3 w-3 animate-pulse rounded-full bg-white/80 [animation-delay:150ms]" />
                          <span className="h-3 w-3 animate-pulse rounded-full bg-white/80 [animation-delay:300ms]" />
                          Running...
                        </span>
                      ) : (
                        "Run stress test"
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                      onClick={exportResultsCsv}
                      disabled={results.length === 0}
                      title={
                        results.length === 0
                          ? "Run a stress test first"
                          : "Export results as CSV"
                      }
                    >
                      Export CSV
                    </Button>
                  </div>

                  {apiError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-200">
                      {apiError}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Main */}
          <main className="lg:col-span-9 space-y-6">
            {headers.length > 0 && (
              <Card className={PANEL}>
                <CardHeader>
                  <CardTitle>Schema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded-full border ${
                        requiredMissing.length === 0
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-600"
                          : "bg-red-500/15 text-red-300 border-red-600"
                      }`}
                      title="Required columns status"
                    >
                      Required {REQUIRED_COLS.length - requiredMissing.length}/
                      {REQUIRED_COLS.length}
                    </span>

                    <span
                      className="px-2 py-1 rounded-full border bg-white/5 text-white/80 border-white/15"
                      title="Optional columns status"
                    >
                      Optional {OPTIONAL_COLS.length - optionalMissing.length}/
                      {OPTIONAL_COLS.length}
                    </span>
                  </div>

                  {requiredMissing.length > 0 && (
                    <p className="text-xs text-red-300">
                      Missing required: {requiredMissing.join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {results.length > 0 && (
              <Card className={PANEL}>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* HQLA vs Outflows */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                    <div className="mb-2 text-sm text-white/80">
                      HQLA vs Outflows by shock
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={sortedResults} barCategoryGap={24}>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="shock_bps"
                          tick={{ fontSize: 12, fill: "#D1D5DB" }}
                          stroke="#4B5563"
                        />
                        <YAxis
                          tickFormatter={fmtMoney}
                          tick={{ fontSize: 12, fill: "#D1D5DB" }}
                          stroke="#4B5563"
                        />
                        <Tooltip
                          cursor={false}
                          contentStyle={{
                            background: "rgba(10,10,10,0.75)",
                            backdropFilter: "blur(6px)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            color: "#E5E7EB",
                          }}
                          formatter={(val: any, name: any) =>
                            name === "HQLA" || name === "Outflows"
                              ? fmtMoney(val as number)
                              : val
                          }
                          labelFormatter={(l) => `Shock: ${l} bps`}
                        />
                        <Legend wrapperStyle={{ color: "#E5E7EB" }} />
                        <Bar
                          dataKey="lcr_hqla"
                          name="HQLA"
                          fill="#34D399"
                          stroke="#10B981"
                          barSize={18}
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="lcr_outflows"
                          name="Outflows"
                          fill="#F87171"
                          stroke="#EF4444"
                          barSize={18}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* KPIs */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="text-sm text-white/70">Equity</div>
                      <div className="text-2xl font-semibold">{fmtMoney(equity)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="text-sm text-white/70">Best ΔEVE (% equity)</div>
                      <div className="text-2xl font-semibold">
                        {fmtPct(
                          Math.max(...results.map((r) => r.eve_pct_equity * 100))
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="text-sm text-white/70">Worst ΔEVE (% equity)</div>
                      <div className="text-2xl font-semibold">
                        {fmtPct(
                          Math.min(...results.map((r) => r.eve_pct_equity * 100))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* ΔEVE / Equity */}
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="mb-2 text-sm text-white/80">
                        ΔEVE / Equity vs shock
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={sortedResults}>
                          <CartesianGrid strokeOpacity={0.1} />
                          <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} />
                          <YAxis
                            tickFormatter={(v) => fmtPct(v * 100)}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) =>
                              name === "ΔEVE/Equity"
                                ? fmtPct((val as number) * 100)
                                : val
                            }
                            labelFormatter={(l) => `Shock: ${l} bps`}
                            cursor={{ stroke: "#4B5563", strokeWidth: 1 }}
                            contentStyle={{
                              background: "rgba(10,10,10,0.8)",
                              backdropFilter: "blur(10px)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 12,
                              color: "#E5E7EB",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="eve_pct_equity"
                            name="ΔEVE/Equity"
                            fillOpacity={0.2}
                            strokeWidth={2}
                            activeDot
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* ΔNII */}
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="mb-2 text-sm text-white/80">
                        ΔNII (12m) vs shock
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={sortedResults}>
                          <CartesianGrid strokeOpacity={0.1} />
                          <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(val: any, name: any) =>
                              name === "ΔNII (12m)"
                                ? fmtMoney(val as number)
                                : val
                            }
                            labelFormatter={(l) => `Shock: ${l} bps`}
                            contentStyle={{
                              background: "rgba(10,10,10,0.8)",
                              backdropFilter: "blur(10px)",
                              border: "1px solid rgba(255,255,255,0.12)",
                              borderRadius: 12,
                              color: "#E5E7EB",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="nii_delta"
                            name="ΔNII (12m)"
                            strokeWidth={2}
                            dot={false}
                            activeDot
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white/5 backdrop-blur">
                        <tr>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            shock_bps
                          </th>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            ΔEVE
                          </th>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            ΔEVE / Equity
                          </th>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            ΔNII (12m)
                          </th>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            HQLA
                          </th>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            Outflows
                          </th>
                          <th className="text-left px-3 py-2 border-b border-white/10">
                            Coverage
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr key={r.shock_bps} className="even:bg-white/[0.03]">
                            <td className="px-3 py-2 border-b border-white/10">
                              {r.shock_bps}
                            </td>
                            <td className="px-3 py-2 border-b border-white/10">
                              {fmtMoney(r.eve_change)}
                            </td>
                            <td
                              className={`px-3 py-2 border-b border-white/10 ${
                                r.eve_pct_equity >= 0
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {fmtPct(r.eve_pct_equity * 100)}
                            </td>
                            <td
                              className={`px-3 py-2 border-b border-white/10 ${
                                r.nii_delta >= 0
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {fmtMoney(r.nii_delta)}
                            </td>
                            <td className="px-3 py-2 border-b border-white/10">
                              {fmtMoney(r.lcr_hqla)}
                            </td>
                            <td className="px-3 py-2 border-b border-white/10">
                              {fmtMoney(r.lcr_outflows)}
                            </td>
                            <td
                              className={`px-3 py-2 border-b border-white/10 ${
                                r.lcr_coverage >= 1
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {fmtX(r.lcr_coverage)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
          />
          <div
            className={`relative z-10 w-[min(1100px,92vw)] max-h-[82vh] ${PANEL} p-0 overflow-hidden`}
          >
            {/* Header sticky */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-black/30 backdrop-blur px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-medium">CSV Preview</h3>
                  {headers.length > 0 && (
                    <span className="text-xs rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/80">
                      {filteredPreviewRows.length.toLocaleString()} rows ·{" "}
                      {headers.length} cols
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      id="preview-search"
                      value={previewQuery}
                      onChange={(e) => setPreviewQuery(e.target.value)}
                      placeholder="Search (Cmd/Ctrl+F)"
                      className="h-9 w-56 rounded-lg border border-white/10 bg-white/5 px-8 text-sm placeholder-white/50 focus:outline-none focus:border-white/20"
                    />
                    <svg
                      className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>

                  <button
                    onClick={() => setCompactRows((v) => !v)}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
                    title="Toggle density"
                  >
                    {compactRows ? "Comfortable" : "Compact"}
                  </button>

                  <button
                    onClick={copyPreviewCsv}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
                  >
                    Copy CSV
                  </button>
                  <button
                    onClick={downloadPreviewCsv}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
                  >
                    Download
                  </button>

                  <button
                    onClick={() => setPreviewOpen(false)}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"
                    aria-label="Close preview"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              {headers.length === 0 ? (
                <p className="text-sm text-white/70">
                  Upload a CSV to see a preview.
                </p>
              ) : (
                <div className="max-h-[66vh] overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                  <table
                    className={`min-w-full ${
                      compactRows ? "text-[13px]" : "text-sm"
                    }`}
                  >
                    <thead className="sticky top-0 bg-white/5 backdrop-blur">
                      <tr>
                        {headers.map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 font-semibold border-b border-white/10"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewRows.map((r, idx) => (
                        <tr key={idx} className="even:bg-white/[0.03]">
                          {headers.map((h) => (
                            <td
                              key={h}
                              className="px-3 border-b border-white/10 py-2"
                            >
                              {String(normalizeCell(h, (r as any)[h]))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rows.length > previewCount && (
                <p className="text-xs text-white/60 mt-2">
                  Showing first {previewCount} rows of {rows.length}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}