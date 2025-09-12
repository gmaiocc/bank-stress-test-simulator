import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* ==================== Utils & formatters ==================== */
const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (x: number, digits = 1) => `${x.toFixed(digits)}%`;
const fmtX = (x: number, digits = 2) => `${x.toFixed(digits)}x`;

const LS_KEY = "bsts_v033_params";

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

/* ---------- Modal content helper (focus + Esc + focus trap) ---------- */
function SchemaModalContent({
  panelClass,
  onClose,
  children,
}: {
  panelClass: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = containerRef.current!;
    // foco inicial no primeiro focável
    const getFocusables = () =>
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    const focusables = getFocusables();
    (focusables[0] ?? root).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const list = Array.from(getFocusables()).filter(
          (el) => !el.hasAttribute("disabled")
        );
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !root.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className={`relative z-10 w-[min(720px,92vw)] ${panelClass} p-4 outline-none`}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}

/* ==================== Export helpers (SVG -> PNG) ==================== */
async function exportChartPng(containerId: string, filename: string) {
  const root = document.getElementById(containerId);
  const svg = root?.querySelector("svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);

  const svgBlob = new Blob(
    ['<?xml version="1.0" standalone="no"?>\r\n', source],
    { type: "image/svg+xml;charset=utf-8" }
  );
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  const bbox = (svg as SVGGraphicsElement).getBoundingClientRect();
  const width = Math.max(1, Math.floor(bbox.width));
  const height = Math.max(1, Math.floor(bbox.height));
  const scale = window.devicePixelRatio || 1;

  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  const pngUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = pngUrl;
  a.download = filename;
  a.click();
}

/* ==================== App ==================== */
export default function App() {
  // CSV preview state
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Toast (leve)
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2500);
  };

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

  // Drag & Drop
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Refs para devolver foco aos botões que abriram modals
  const schemaBtnRef = useRef<HTMLButtonElement | null>(null);
  const previewBtnRef = useRef<HTMLButtonElement | null>(null);

  // Raw CSV (to send)
  const [rawCsv, setRawCsv] = useState<string>("");

  // API results
  const [equity, setEquity] = useState<number>(0);
  const [results, setResults] = useState<ScenarioOut[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  // Persistir/Restaurar estado (localStorage)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved) {
        setAfsHaircut(saved.afsHaircut ?? 0.1);
        setDepositRunoff(saved.depositRunoff ?? 0.15);
        setBetaCore(saved.betaCore ?? 0.3);
        setBetaNoncore(saved.betaNoncore ?? 0.6);
        setShocks(Array.isArray(saved.shocks) ? saved.shocks : [-200, -100, 0, 100, 200]);
        setDelimiter(saved.delimiter ?? ",");
        setHeaderRow(saved.headerRow ?? true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const data = { afsHaircut, depositRunoff, betaCore, betaNoncore, shocks, delimiter, headerRow };
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  }, [afsHaircut, depositRunoff, betaCore, betaNoncore, shocks, delimiter, headerRow]);

  const requiredMissing = useMemo(
    () => REQUIRED_COLS.filter((c) => headers.length && !headers.includes(c)),
    [headers]
  );
  const optionalMissing = useMemo(
    () => OPTIONAL_COLS.filter((c) => headers.length && !headers.includes(c)),
    [headers]
  );

  /* ---- CSV upload/parse ---- */
  function parseFile(f: File) {
    setError("");
    Papa.parse<Row>(f, {
      header: headerRow,
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (res) => {
        if (res.errors && res.errors.length) {
          const msg = `Parse error on row ${res.errors[0].row}: ${res.errors[0].message}`;
          setError(msg);
          showToast("err", "Erro ao ler o CSV.");
          setRows([]);
          setHeaders([]);
          return;
        }
        const data = (res.data as Row[]).filter((r) => Object.keys(r).length);
        setRows(data);
        const hdrs = res.meta.fields ?? Object.keys(data[0] || {});
        setHeaders(hdrs);

        // raw CSV para backend
        const reader = new FileReader();
        reader.onload = () => setRawCsv(String(reader.result || ""));
        reader.onerror = () => setRawCsv("");
        reader.readAsText(f);

        showToast("ok", "CSV carregado com sucesso.");
      },
      error: (err) => {
        setError(err.message || "Unknown error while parsing CSV.");
        showToast("err", "Erro ao ler o CSV.");
      },
    });
  }

  function validateAndParse(f?: File) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) {
      showToast("err", "Ficheiro inválido (esperado .csv)");
      return;
    }
    parseFile(f);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndParse(e.target.files?.[0]);
  }

  // Drag & drop handlers
  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    validateAndParse(f);
  }

  // Evitar que largar ficheiros fora da dropzone navegue a página
  useEffect(() => {
    const prevent = (ev: DragEvent) => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const previewCount = 100;
  const previewRows = useMemo(() => rows.slice(0, previewCount), [rows]);

  /* ---- Run API ---- */
  async function runStressTest() {
    setApiError("");
    setResults([]);
    if (!rawCsv) {
      const msg = "Please upload a CSV first.";
      setApiError(msg);
      showToast("err", "Carrega um CSV primeiro.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        (import.meta as any).env?.VITE_API_BASE
          ? `${(import.meta as any).env.VITE_API_BASE}/stress`
          : "http://localhost:8000/stress",
        {
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
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || "API returned an error");
      }
      const data = await resp.json();
      setEquity(data.equity ?? 0);
      setResults(Array.isArray(data.results) ? data.results : []);
      showToast("ok", "Stress test concluído.");
    } catch (e: any) {
      setApiError(e?.message || "Request failed.");
      showToast("err", "Erro ao correr o stress test.");
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
    showToast("ok", "CSV exportado.");
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
    navigator.clipboard.writeText(csv).then(
      () => showToast("ok", "Preview copiado para o clipboard."),
      () => showToast("err", "Não foi possível copiar.")
    );
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

  // atalhos para o Preview modal: Esc fecha | Cmd/Ctrl+F foca a pesquisa
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!previewOpen) return;
      if (e.key === "Escape") setPreviewOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const el = document.getElementById("preview-search") as HTMLInputElement | null;
        el?.focus();
        el?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  /* --- Sample CSV & schema modal --- */
  const [schemaOpen, setSchemaOpen] = useState(false);
  function downloadSampleCsv() {
    const head = [...REQUIRED_COLS, ...OPTIONAL_COLS].join(",");
    const row1 = [
      "loan", "SME Term", "2500000", "0.055", "48", "asset", "fixed", "0", "6-12m", "", "", ""
    ].join(",");
    const row2 = [
      "deposit", "Core Checking", "-4000000", "0.01", "0", "liability", "float", "1", "<1m", "0.3", "0.95", ""
    ].join(",");
    const csv = head + "\n" + row1 + "\n" + row2 + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_bank_book.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen">
      <BackgroundGlow />

      {/* Toast leve */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-[100] rounded-xl border px-3 py-2 text-sm backdrop-blur
            ${toast.type === "ok"
              ? "bg-emerald-500/15 text-emerald-200 border-emerald-600/40"
              : "bg-rose-500/15 text-rose-200 border-rose-600/40"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="container max-w-6xl py-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            Bank Stress Test Simulator
          </h1>
          <Badge variant="secondary" className="text-xs">
            v0.3.3
          </Badge>
        </header>

        {/* Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sidebar (inclui Upload c/ Drag & Drop) */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-6 space-y-6">
              <Card className={PANEL}>
                <CardHeader>
                  <CardTitle className="text-base">Data & Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* === Upload: drag & drop + botões === */}
                  <div
                    onDragEnter={onDragEnter}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                    }}
                    aria-label="Drop CSV here or choose a file"
                    className={`rounded-xl border p-3 transition
                      ${dragActive ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="font-medium">CSV file</div>
                        <div className="text-xs text-white/60">
                          Arrasta aqui ou escolhe um ficheiro
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <Button
                          variant="secondary"
                          className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={() => inputRef.current?.click()}
                        >
                          Choose File
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={downloadSampleCsv}
                          title="Descarregar exemplo com as colunas certas"
                        >
                          Sample CSV
                        </Button>
                      </div>
                    </div>
                    <input
                      ref={inputRef}
                      id="file-upload"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={onFileChange}
                      className="hidden"
                    />
                  </div>

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
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        ref={previewBtnRef}
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
                        ref={schemaBtnRef}
                        variant="secondary"
                        className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={() => setSchemaOpen(true)}
                      >
                        View schema
                      </Button>
                    </div>

                    <Button
                      onClick={runStressTest}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2" aria-busy="true">
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

                  {/* Empty/error feedback */}
                  {!headers.length && !error && (
                    <p className="text-xs text-white/60">
                      Dica: podes descarregar um <button className="underline" onClick={downloadSampleCsv}>sample CSV</button> e editar.
                    </p>
                  )}
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
          <main className="lg:col-span-8 space-y-6">
            {/* Schema card */}
            {headers.length > 0 && (
              <Card className={PANEL}>
                <CardHeader>
                  <CardTitle>Schema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded-full border group relative cursor-default ${
                        requiredMissing.length === 0
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-600"
                          : "bg-red-500/15 text-red-300 border-red-600"
                      }`}
                      title="Required columns status"
                    >
                      Required {REQUIRED_COLS.length - requiredMissing.length}/
                      {REQUIRED_COLS.length}
                      <span className="pointer-events-none absolute left-0 top-[120%] z-50 hidden min-w-[240px] rounded-lg border border-white/10 bg-black/80 p-3 text-xs text-white/80 shadow-2xl backdrop-blur group-hover:block">
                        <div className="font-medium mb-1">Required columns</div>
                        <div className="flex flex-wrap gap-1">
                          {REQUIRED_COLS.map((c) => (
                            <span
                              key={c}
                              className={`rounded-full border px-2 py-0.5 ${
                                headers.includes(c)
                                  ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-200"
                                  : "border-rose-600/50 bg-rose-500/10 text-rose-200"
                              }`}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </span>
                    </span>

                    <span
                      className="px-2 py-1 rounded-full border bg-white/5 text-white/80 border-white/15 group relative cursor-default"
                      title="Optional columns status"
                    >
                      Optional {OPTIONAL_COLS.length - optionalMissing.length}/
                      {OPTIONAL_COLS.length}
                      <span className="pointer-events-none absolute left-0 top-[120%] z-50 hidden min-w-[240px] rounded-lg border border-white/10 bg-black/80 p-3 text-xs text-white/80 shadow-2xl backdrop-blur group-hover:block">
                        <div className="font-medium mb-1">Optional columns</div>
                        <div className="flex flex-wrap gap-1">
                          {OPTIONAL_COLS.map((c) => (
                            <span
                              key={c}
                              className={`rounded-full border px-2 py-0.5 ${
                                headers.includes(c)
                                  ? "border-white/20 bg-white/10 text-white/90"
                                  : "border-white/10 bg-black/30 text-white/60"
                              }`}
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </span>
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
                  {/* === KPIs === */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="text-sm text-white/70">Equity</div>
                      <div className="text-2xl font-semibold">{fmtMoney(equity)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="text-sm text-white/70">Best ΔEVE (% equity)</div>
                      <div className="text-2xl font-semibold">
                        {fmtPct(Math.max(...results.map((r) => r.eve_pct_equity * 100)))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="text-sm text-white/70">Worst ΔEVE (% equity)</div>
                      <div className="text-2xl font-semibold">
                        {fmtPct(Math.min(...results.map((r) => r.eve_pct_equity * 100)))}
                      </div>
                    </div>
                  </div>

                  {/* === ΔEVE / Equity === */}
                  <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm text-white/80">ΔEVE / Equity vs shock</div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={() => exportChartPng("chart-eve", "eve_vs_shock.png")}
                      >
                        Export PNG
                      </Button>
                    </div>
                    <div id="chart-eve">
                      <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={sortedResults}>
                          <CartesianGrid strokeOpacity={0.1} />
                          <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} tickMargin={8} />
                          <YAxis
                            tickFormatter={(v) => fmtPct(v * 100)}
                            tick={{ fontSize: 12 }}
                            tickMargin={8}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) =>
                              name === "ΔEVE/Equity" ? fmtPct((val as number) * 100) : val
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
                  </div>

                  {/* === ΔNII (12m) === */}
                  <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm text-white/80">ΔNII (12m) vs shock</div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={() => exportChartPng("chart-nii", "nii_vs_shock.png")}
                      >
                        Export PNG
                      </Button>
                    </div>
                    <div id="chart-nii">
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={sortedResults}>
                          <CartesianGrid strokeOpacity={0.1} />
                          <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} tickMargin={8} />
                          <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 12 }} tickMargin={8} />
                          <Tooltip
                            formatter={(val: any, name: any) =>
                              name === "ΔNII (12m)"
                                ? (Number(val) >= 0 ? `+${fmtMoney(val as number)}` : fmtMoney(val as number))
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
                            dot={{ r: 2 }}
                            activeDot
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* === LCR chart === */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm text-white/80">Liquidity: HQLA, Outflows & Coverage vs shock</div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={() => exportChartPng("chart-lcr", "lcr_vs_shock.png")}
                      >
                        Export PNG
                      </Button>
                    </div>
                    <div id="chart-lcr">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sortedResults} barCategoryGap={24}>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                          <XAxis
                            dataKey="shock_bps"
                            tick={{ fontSize: 12, fill: "#D1D5DB" }}
                            stroke="#4B5563"
                            tickMargin={8}
                          />
                          <YAxis
                            yAxisId="left"
                            tickFormatter={fmtMoney}
                            tick={{ fontSize: 12, fill: "#D1D5DB" }}
                            stroke="#4B5563"
                            tickMargin={8}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(v) => fmtX(Number(v))}
                            tick={{ fontSize: 12, fill: "#D1D5DB" }}
                            stroke="#4B5563"
                            tickMargin={8}
                            domain={[0, (dataMax: number) => Math.max(1.2, dataMax * 1.1)]}
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
                            formatter={(val: any, name: any, props: any) => {
                              const key = props?.dataKey as string;
                              if (key === "lcr_hqla" || key === "lcr_outflows") {
                                const v = Number(val);
                                return v >= 0 ? `+${fmtMoney(v)}` : fmtMoney(v);
                              }
                              if (key === "lcr_coverage") {
                                return fmtX(Number(val));
                              }
                              return val;
                            }}
                            labelFormatter={(l) => `Shock: ${l} bps`}
                          />
                          <Legend wrapperStyle={{ color: "#E5E7EB" }} />
                          <Bar
                            yAxisId="left"
                            dataKey="lcr_hqla"
                            name="HQLA"
                            fill="#34D399"
                            stroke="#10B981"
                            barSize={18}
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            yAxisId="left"
                            dataKey="lcr_outflows"
                            name="Outflows"
                            fill="#F87171"
                            stroke="#EF4444"
                            barSize={18}
                            radius={[6, 6, 0, 0]}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="lcr_coverage"
                            name="Coverage (×)"
                            stroke="#93C5FD"
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* === Table === */}
                  <div className="overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-white/5 backdrop-blur">
                        <tr>
                          <th className="text-left px-3 py-2 border-b border-white/10">shock_bps</th>
                          <th className="text-left px-3 py-2 border-b border-white/10">ΔEVE</th>
                          <th className="text-left px-3 py-2 border-b border-white/10">ΔEVE / Equity</th>
                          <th className="text-left px-3 py-2 border-b border-white/10">ΔNII (12m)</th>
                          <th className="text-left px-3 py-2 border-b border-white/10">HQLA</th>
                          <th className="text-left px-3 py-2 border-b border-white/10">Outflows</th>
                          <th className="text-left px-3 py-2 border-b border-white/10">Coverage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => (
                          <tr key={r.shock_bps} className="even:bg-white/[0.03]">
                            <td className="px-3 py-2 border-b border-white/10">{r.shock_bps}</td>
                            <td className="px-3 py-2 border-b border-white/10">{fmtMoney(r.eve_change)}</td>
                            <td className={`px-3 py-2 border-b border-white/10 ${r.eve_pct_equity >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                              {fmtPct(r.eve_pct_equity * 100)}
                            </td>
                            <td className={`px-3 py-2 border-b border-white/10 ${r.nii_delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                              {fmtMoney(r.nii_delta)}
                            </td>
                            <td className="px-3 py-2 border-b border-white/10">{fmtMoney(r.lcr_hqla)}</td>
                            <td className="px-3 py-2 border-b border-white/10">{fmtMoney(r.lcr_outflows)}</td>
                            <td className={`px-3 py-2 border-b border-white/10 ${r.lcr_coverage >= 1 ? "text-emerald-300" : "text-rose-300"}`}>
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

      {/* Schema “View schema” modal - com foco inicial, Esc e focus trap; devolve foco ao botão */}
      {schemaOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schema-title"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setSchemaOpen(false);
              schemaBtnRef.current?.focus();
            }}
          />
          <SchemaModalContent
            panelClass={PANEL}
            onClose={() => {
              setSchemaOpen(false);
              schemaBtnRef.current?.focus();
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 id="schema-title" className="text-lg font-medium">Expected schema</h3>
              <button
                onClick={() => {
                  setSchemaOpen(false);
                  schemaBtnRef.current?.focus();
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-white/70 mb-1">Required</div>
                <div className="flex flex-wrap gap-2">
                  {REQUIRED_COLS.map((c) => (
                    <span key={c} className={`rounded-full border px-2 py-1 text-[11px] ${
                      headers.includes(c) ? "bg-emerald-500/20 text-emerald-200 border-emerald-700"
                      : "bg-red-500/20 text-red-200 border-red-700"}`}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-white/70 mb-1">Optional</div>
                <div className="flex flex-wrap gap-2">
                  {OPTIONAL_COLS.map((c) => (
                    <span key={c} className={`rounded-full border px-2 py-1 text-[11px] ${
                      headers.includes(c) ? "bg-white/10 text-white/90 border-white/20"
                      : "bg-black/20 text-white/50 border-white/10"}`}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-xs text-white/60">
                Tip: usa o botão <span className="text-white">Sample CSV</span> para um ficheiro de exemplo.
              </div>
            </div>
          </SchemaModalContent>
        </div>
      )}

      {/* Preview CSV modal (funcional) */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setPreviewOpen(false);
              previewBtnRef.current?.focus();
            }}
          />
          <SchemaModalContent
            panelClass={PANEL}
            onClose={() => {
              setPreviewOpen(false);
              previewBtnRef.current?.focus();
            }}
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <h3 id="preview-title" className="text-lg font-medium">
                CSV Preview ({filteredPreviewRows.length}/{rows.length})
              </h3>
              <div className="flex items-center gap-2">
                <input
                  id="preview-search"
                  type="text"
                  placeholder="Search..."
                  value={previewQuery}
                  onChange={(e) => setPreviewQuery(e.target.value)}
                  className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm placeholder-white/50 focus:outline-none focus:border-white/20"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={compactRows}
                    onChange={(e) => setCompactRows(e.target.checked)}
                    className={CHECKBOX}
                  />
                  Compact
                </label>
                <Button
                  variant="secondary"
                  onClick={copyPreviewCsv}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  onClick={downloadPreviewCsv}
                  className="bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  Download
                </Button>
                <Button
                  onClick={() => {
                    setPreviewOpen(false);
                    previewBtnRef.current?.focus();
                  }}
                  className="ml-1"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white/5 backdrop-blur">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="text-left px-3 py-2 border-b border-white/10">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPreviewRows.map((r, i) => (
                    <tr key={i} className={`even:bg-white/[0.03] ${compactRows ? "" : ""}`}>
                      {headers.map((h) => (
                        <td key={h} className={`px-3 ${compactRows ? "py-1.5" : "py-2"} border-b border-white/10`}>
                          {String((r as any)[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SchemaModalContent>
        </div>
      )}
    </div>
  );
}