import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = Record<string, string | number | null>;

type ScenarioOut = {
  shock_bps: number;
  eve_change: number;
  eve_pct_equity: number; // decimal (e.g., -0.53 = -53%)
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

export default function App() {
  // CSV preview state
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  // Parser options
  const [delimiter, setDelimiter] = useState(",");
  const [headerRow, setHeaderRow] = useState(true);

  // Parameters
  const [afsHaircut, setAfsHaircut] = useState<number>(0.1);
  const [depositRunoff, setDepositRunoff] = useState<number>(0.15);
  const [betaCore, setBetaCore] = useState<number>(0.3);
  const [betaNoncore, setBetaNoncore] = useState<number>(0.6);
  const [shocks, setShocks] = useState<number[]>([-200, -100, 0, 100, 200]);

  // Raw CSV (to send to the API)
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

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setFileName(f.name);
    setError("");

    // Keep a copy of the raw CSV (for the backend)
    const reader = new FileReader();
    reader.onload = () => setRawCsv(String(reader.result || ""));
    reader.onerror = () => setRawCsv("");
    reader.readAsText(f);

    // Parse for preview/validation
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
      error: (err) => {
        setError(err.message || "Unknown error while parsing CSV.");
      },
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
        // try to extract text/json for better error
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

  return (
    <div className="min-h-screen">
      <div className="container max-w-6xl py-8 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bank Stress Test Simulator
          </h1>
          <Badge variant="secondary" className="text-xs">
            v0.3.0
          </Badge>
        </header>

        {/* Upload + Validation (combined) */}
        <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Upload CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload controls */}
            <div className="grid gap-4 md:grid-cols-3">
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

            {/* Divider */}
            <div className="h-px w-full bg-neutral-800" />

            {/* Schema validation */}
            <div className="space-y-3">
              <h3 className="text-base font-medium">Schema validation</h3>
              <div className="flex flex-wrap gap-2">
                {REQUIRED_COLS.map((c) => (
                  <Badge
                    key={c}
                    className={`rounded-full border ${
                      headers.includes(c)
                        ? "bg-emerald-500/20 text-emerald-200 border-emerald-700"
                        : "bg-red-500/20 text-red-200 border-red-700"
                    }`}
                  >
                    {c}
                  </Badge>
                ))}
              </div>

              {headers.length > 0 && (
                <>
                  <p className="text-sm text-neutral-400">
                    Optional: {OPTIONAL_COLS.join(", ")}
                  </p>
                  {optionalMissing.length > 0 && (
                    <p className="text-xs text-neutral-500">
                      Not present: {optionalMissing.join(", ")}
                    </p>
                  )}
                  {requiredMissing.length > 0 && (
                    <p className="text-sm text-red-400">
                      Missing required: {requiredMissing.join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-neutral-800" />

            {/* Parameters */}
            <div className="space-y-3">
              <h3 className="text-base font-medium">Parameters</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm">
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
                <label className="text-sm">
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
                <label className="text-sm">
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
                <label className="text-sm">
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

              <div className="flex items-center gap-3">
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
                  className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
                  placeholder="-200,-100,0,100,200"
                  aria-label="Shocks (bps)"
                />
                <Button onClick={runStressTest} disabled={loading}>
                  {loading ? "Running..." : "Run stress test"}
                </Button>
              </div>

              {apiError && (
                <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3 text-sm text-red-200">
                  {apiError}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-neutral-800 p-4">
                  <div className="text-sm text-neutral-400">Equity</div>
                  <div className="text-xl font-semibold">
                    {equity.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 p-4">
                  <div className="text-sm text-neutral-400">
                    Best ΔEVE (% equity)
                  </div>
                  <div className="text-xl font-semibold">
                    {Math.max(
                      ...results.map((r) => r.eve_pct_equity * 100)
                    ).toFixed(1)}
                    %
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 p-4">
                  <div className="text-sm text-neutral-400">
                    Worst ΔEVE (% equity)
                  </div>
                  <div className="text-xl font-semibold">
                    {Math.min(
                      ...results.map((r) => r.eve_pct_equity * 100)
                    ).toFixed(1)}
                    %
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-neutral-800">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-900/90">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        shock_bps
                      </th>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        ΔEVE
                      </th>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        ΔEVE / Equity
                      </th>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        ΔNII (12m)
                      </th>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        HQLA
                      </th>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        Outflows
                      </th>
                      <th className="text-left px-3 py-2 border-b border-neutral-800">
                        Coverage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.shock_bps} className="even:bg-neutral-900/40">
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {r.shock_bps}
                        </td>
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {r.eve_change.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {(r.eve_pct_equity * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {r.nii_delta.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {r.lcr_hqla.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {r.lcr_outflows.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 border-b border-neutral-900/50">
                          {r.lcr_coverage.toFixed(2)}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <Button variant="secondary" onClick={exportResultsCsv}>
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {headers.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Upload a CSV to see a preview.
              </p>
            ) : (
              <div className="overflow-auto rounded-xl border border-neutral-800 max-h-[60vh]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-neutral-900/90 backdrop-blur">
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="text-left px-3 py-2 font-semibold border-b border-neutral-800"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx} className="even:bg-neutral-900/40">
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-2 border-b border-neutral-900/50"
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
              <p className="text-xs text-neutral-500 mt-2">
                Showing first {previewCount} rows of {rows.length}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}