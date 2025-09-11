import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/* ---------- format helpers ---------- */
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (x: number, digits = 1) => `${x.toFixed(digits)}%`;
const fmtX = (x: number, digits = 2) => `${x.toFixed(digits)}x`;

/* ---------- types ---------- */
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

/* ===================================================== */
export default function App() {
  // CSV preview state
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  // Preview modal
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

  // Raw CSV (to send to API)
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

  /* ---------- CSV upload/parse ---------- */
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setFileName(f.name);
    setError("");

    // keep raw CSV for backend
    const reader = new FileReader();
    reader.onload = () => setRawCsv(String(reader.result || ""));
    reader.onerror = () => setRawCsv("");
    reader.readAsText(f);

    // parse for preview/validation
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

  /* ---------- API call ---------- */
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

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen">
      <div className="container max-w-6xl py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bank Stress Test Simulator
          </h1>
          <Badge variant="secondary" className="text-xs">
            v0.4.0
          </Badge>
        </header>

        {/* Layout: sidebar + main */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
              <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="text-sm block">
                    AFS haircut (0–0.5)
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={0.5}
                      value={afsHaircut}
                      onChange={(e) => setAfsHaircut(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
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
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
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
                      className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
                      placeholder="-200,-100,0,100,200"
                    />
                  </label>

                  {/* Preview + Run + Export (agora todos juntos) */}
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setPreviewOpen(true)}
                    disabled={headers.length === 0}
                    title={headers.length === 0 ? "Upload a CSV first" : "Preview parsed CSV"}
                  >
                    Preview CSV
                  </Button>

                  <Button onClick={runStressTest} disabled={loading} className="w-full">
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 animate-pulse rounded-full bg-neutral-300" />
                        <span className="h-3 w-3 animate-pulse rounded-full bg-neutral-300 [animation-delay:150ms]" />
                        <span className="h-3 w-3 animate-pulse rounded-full bg-neutral-300 [animation-delay:300ms]" />
                        Running...
                      </span>
                    ) : (
                      "Run stress test"
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={exportResultsCsv}
                    disabled={results.length === 0}
                    title={results.length === 0 ? "Run a stress test first" : "Export results as CSV"}
                  >
                    Export CSV
                  </Button>

                  {apiError && (
                    <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-xs text-red-200">
                      {apiError}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Main */}
          <main className="lg:col-span-9 space-y-6">
            {/* Upload + validation */}
            <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" /> Upload CSV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1">CSV file</label>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={onFileChange}
                      className="w-full text-sm rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-100"
                    />
                    {fileName && (
                      <p className="text-xs text-neutral-400 mt-1">
                        Selected: {fileName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Delimiter</label>
                    <select
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
                    >
                      <option value=",">Comma (,)</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="\t">Tab (\t)</option>
                    </select>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={headerRow}
                        onChange={(e) => setHeaderRow(e.target.checked)}
                        className="h-4 w-4 accent-white"
                      />
                      First row contains headers
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {/* Schema (compact) */}
                {headers.length > 0 && (
                  <div className="rounded-xl border border-neutral-800/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">Schema</div>

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
                          className="px-2 py-1 rounded-full border bg-neutral-800 text-neutral-300 border-neutral-700"
                          title="Optional columns status"
                        >
                          Optional {OPTIONAL_COLS.length - optionalMissing.length}/
                          {OPTIONAL_COLS.length}
                        </span>

                        <details className="ml-2">
                          <summary className="cursor-pointer select-none text-neutral-400 hover:text-neutral-200">
                            Details
                          </summary>

                          <div className="mt-3">
                            <div className="text-xs mb-1 text-neutral-400">Required</div>
                            <div className="flex flex-wrap gap-2">
                              {REQUIRED_COLS.map((c) => (
                                <span
                                  key={c}
                                  className={`rounded-full border px-2 py-1 text-[11px] ${
                                    headers.includes(c)
                                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-700"
                                      : "bg-red-500/20 text-red-200 border-red-700"
                                  }`}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>

                            <div className="text-xs mt-3 mb-1 text-neutral-400">Optional</div>
                            <div className="flex flex-wrap gap-2">
                              {OPTIONAL_COLS.map((c) => (
                                <span
                                  key={c}
                                  className={`rounded-full border px-2 py-1 text-[11px] ${
                                    headers.includes(c)
                                      ? "bg-neutral-800 text-neutral-200 border-neutral-700"
                                      : "bg-neutral-900 text-neutral-500 border-neutral-800"
                                  }`}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>

                    {requiredMissing.length > 0 && (
                      <p className="mt-2 text-xs text-red-300">
                        Missing required: {requiredMissing.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            {results.length > 0 && (
              <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* HQLA vs Outflows */}
                  <div className="rounded-2xl border border-neutral-800 p-4">
                    <div className="mb-2 text-sm text-neutral-300">
                      HQLA vs Outflows by shock
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={sortedResults} barCategoryGap={24}>
                        <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="shock_bps"
                          tick={{ fontSize: 12, fill: "#9CA3AF" }}
                          stroke="#374151"
                        />
                        <YAxis
                          tickFormatter={fmtMoney}
                          tick={{ fontSize: 12, fill: "#9CA3AF" }}
                          stroke="#374151"
                        />
                        <Tooltip
                          cursor={false}
                          contentStyle={{
                            background: "#0A0A0A",
                            border: "1px solid #262626",
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
                        <Legend wrapperStyle={{ color: "#D1D5DB" }} />
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
                    <div className="rounded-xl border border-neutral-800 p-4">
                      <div className="text-sm text-neutral-400">Equity</div>
                      <div className="text-2xl font-semibold">{fmtMoney(equity)}</div>
                    </div>
                    <div className="rounded-xl border border-neutral-800 p-4">
                      <div className="text-sm text-neutral-400">Best ΔEVE (% equity)</div>
                      <div className="text-2xl font-semibold">
                        {fmtPct(Math.max(...results.map((r) => r.eve_pct_equity * 100)))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-neutral-800 p-4">
                      <div className="text-sm text-neutral-400">Worst ΔEVE (% equity)</div>
                      <div className="text-2xl font-semibold">
                        {fmtPct(Math.min(...results.map((r) => r.eve_pct_equity * 100)))}
                      </div>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* ΔEVE / Equity */}
                    <div className="rounded-xl border border-neutral-800 p-4">
                      <div className="mb-2 text-sm text-neutral-300">
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
                            cursor={{ stroke: "#374151", strokeWidth: 1 }}
                            contentStyle={{
                              background: "#0A0A0A",
                              border: "1px solid #262626",
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
                    <div className="rounded-xl border border-neutral-800 p-4">
                      <div className="mb-2 text-sm text-neutral-300">
                        ΔNII (12m) vs shock
                      </div>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={sortedResults}>
                          <CartesianGrid strokeOpacity={0.1} />
                          <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} />
                          <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(val: any, name: any) =>
                              name === "ΔNII (12m)" ? fmtMoney(val as number) : val
                            }
                            labelFormatter={(l) => `Shock: ${l} bps`}
                            contentStyle={{
                              background: "#0A0A0A",
                              border: "1px solid #262626",
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

                  {/* Results table */}
                  <div className="overflow-auto rounded-xl border border-neutral-800">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-neutral-900/90">
                        <tr>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">shock_bps</th>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">ΔEVE</th>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">ΔEVE / Equity</th>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">ΔNII (12m)</th>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">HQLA</th>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">Outflows</th>
                          <th className="text-left px-3 py-2 border-b border-neutral-800">Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr key={r.shock_bps} className="even:bg-neutral-900/40">
                            <td className="px-3 py-2 border-b border-neutral-900/50">{r.shock_bps}</td>
                            <td className="px-3 py-2 border-b border-neutral-900/50">{fmtMoney(r.eve_change)}</td>
                            <td
                              className={`px-3 py-2 border-b border-neutral-900/50 ${
                                r.eve_pct_equity >= 0 ? "text-emerald-300" : "text-red-300"
                              }`}
                            >
                              {fmtPct(r.eve_pct_equity * 100)}
                            </td>
                            <td
                              className={`px-3 py-2 border-b border-neutral-900/50 ${
                                r.nii_delta >= 0 ? "text-emerald-300" : "text-red-300"
                              }`}
                            >
                              {fmtMoney(r.nii_delta)}
                            </td>
                            <td className="px-3 py-2 border-b border-neutral-900/50">{fmtMoney(r.lcr_hqla)}</td>
                            <td className="px-3 py-2 border-b border-neutral-900/50">{fmtMoney(r.lcr_outflows)}</td>
                            <td
                              className={`px-3 py-2 border-b border-neutral-900/50 ${
                                r.lcr_coverage >= 1 ? "text-emerald-300" : "text-red-300"
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

      {/* ---------- Preview Modal ---------- */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          {/* overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewOpen(false)} />
          {/* content */}
          <div className="relative z-10 w-[min(1100px,92vw)] rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">CSV Preview</h3>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-neutral-800 px-2 py-1 text-sm hover:bg-neutral-800"
                aria-label="Close preview"
              >
                Close
              </button>
            </div>

            {headers.length === 0 ? (
              <p className="text-sm text-neutral-400">Upload a CSV to see a preview.</p>
            ) : (
              <div className="overflow-auto rounded-xl border border-neutral-800 max-h-[70vh]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-900/90 backdrop-blur">
                    <tr>
                      {headers.map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold border-b border-neutral-800">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx} className="even:bg-neutral-900/40">
                        {headers.map((h) => (
                          <td key={h} className="px-3 py-2 border-b border-neutral-900/50">
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
              <p className="text-xs text-neutral-500 mt-2">
                Showing first {previewCount} rows of {rows.length}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}