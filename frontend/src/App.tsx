import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = Record<string, string | number | null>;

const REQUIRED_COLS = [
  "type","name","amount","rate","duration",
  "category","fixed_float","float_share","repricing_bucket",
];
const OPTIONAL_COLS = ["deposit_beta","stability","convexity"];

export default function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [headerRow, setHeaderRow] = useState(true);

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

    Papa.parse<Row>(f, {
      header: headerRow,
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (res) => {
        if (res.errors && res.errors.length) {
          setError(`Parse error on row ${res.errors[0].row}: ${res.errors[0].message}`);
          setRows([]); setHeaders([]); return;
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
    if (["amount","rate","duration","float_share","deposit_beta","convexity"].includes(key)) {
      if (typeof value === "string" && value.trim() === "") return "";
      const num = Number(value);
      if (Number.isNaN(num)) return String(value);
      return num;
    }
    return typeof value === "string" ? value : String(value);
  }

  const previewCount = 100;
  const previewRows = useMemo(() => rows.slice(0, previewCount), [rows]);

  return (
    <div className="min-h-screen">
      <div className="container max-w-6xl py-8 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Bank Stress Test Simulator</h1>
          <Badge variant="secondary" className="text-xs">v0.1</Badge>
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
          <p className="text-xs text-neutral-400 mt-1">Selected: {fileName}</p>
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

    {/* Schema validation (now inside the same card) */}
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
  </CardContent>
</Card>

        {/* Preview */}
        <Card className="border-neutral-800 bg-neutral-900/60 backdrop-blur rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {headers.length === 0 ? (
              <p className="text-sm text-neutral-400">Upload a CSV to see a preview.</p>
            ) : (
              <div className="overflow-auto rounded-xl border border-neutral-800 max-h-[60vh]">
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
              <p className="text-xs text-neutral-500 mt-2">Showing first {previewCount} rows of {rows.length}.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}