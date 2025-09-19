import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { z } from "zod";
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
  BarChart,
  Bar,
  Legend,
  Tooltip as RechartTooltip, // <-- alias para o recharts
} from "recharts";

// alias para o Tooltip do UI (shadcn)
import {
  Tooltip as UiTooltip,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
  TooltipContent as UiTooltipContent,
} from "@/components/ui/tooltip";

/* ==================== Utils & formatters ==================== */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const fmtMoney = (n: number) => nf0.format(Number(n) || 0);
const fmtPct = (x: number, digits = 1) =>
  `${(Number.isFinite(x) ? x : 0).toFixed(digits)}%`;
const fmtX = (x: number, digits = 2) =>
  `${(Number.isFinite(x) ? x : 0).toFixed(digits)}x`;
const signed = (s: string) =>
  s.startsWith("-") || s.startsWith("+") ? s : `+${s}`;
const fmtSignedMoney = (n: number) => (n >= 0 ? `+${fmtMoney(n)}` : fmtMoney(n));
const fmtSignedPct = (p: number, digits = 1) =>
  p >= 0 ? `+${fmtPct(p, digits)}` : fmtPct(p, digits);

const LS_KEY = "bsts_v050_params";
const MAX_FILE_MB = 10;

/* ---- estilos ---- */
const PANEL =
  "rounded-2xl border border-white/5 bg-white/3 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.35)]";
const FIELD_BASE =
  "h-10 w-full rounded-xl border border-white/5 bg-white/3 backdrop-blur-sm px-3 text-sm placeholder-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:border-sky-300/30";
const FIELD_NUMBER = `${FIELD_BASE} [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const FIELD = FIELD_BASE;
const SELECT_FIELD = `${FIELD_BASE} pr-9 appearance-none cursor-pointer`;
const CHECKBOX =
  "h-4 w-4 rounded border border-white/20 bg-white/10 accent-white/90 focus:outline-none focus:ring-2 focus:ring-white/20";

/* ==================== Tipagem ==================== */
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
] as const;
const OPTIONAL_COLS = ["deposit_beta", "stability", "convexity"] as const;
type RequiredCol = (typeof REQUIRED_COLS)[number];
type OptionalCol = (typeof OPTIONAL_COLS)[number];

/* ==================== Mapeamento & Validação (zod) ==================== */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s\-\/]+/g, "_")
    .replace(/[()]/g, "")
    .replace(/__+/g, "_")
    .trim();

const SYNONYMS: Record<RequiredCol | OptionalCol, string[]> = {
  type: ["type", "instrument_type", "product_type", "kind"],
  name: ["name", "description", "title"],
  amount: ["amount", "principal", "balance", "notional", "par"],
  rate: ["rate", "int_rate", "coupon", "interest_rate", "yld", "yield"], // <- corrigido
  duration: ["duration", "tenor", "term", "months", "maturity_months"],
  category: ["category", "side", "asset_liability", "asset_or_liability"],
  fixed_float: ["fixed_float", "rate_type", "fixed_or_float", "fix_float"],
  float_share: ["float_share", "floating_share", "share_float", "pct_float"],
  repricing_bucket: ["repricing_bucket", "bucket", "repricing", "gap_bucket"],
  deposit_beta: ["deposit_beta", "beta", "beta_deposit"],
  stability: ["stability", "deposit_stability", "stickiness"],
  convexity: ["convexity"],
};

const requiredSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1),
  amount: z.number(),
  rate: z.number(),
  duration: z.number(),
  category: z.string().min(1),
  fixed_float: z.string().min(1),
  float_share: z.number(),
  repricing_bucket: z.string().min(1),
});

const optionalSchema = z.object({
  deposit_beta: z.number().optional(),
  stability: z.number().optional(),
  convexity: z.number().optional(),
});

type ValidRow = z.infer<typeof requiredSchema> & z.infer<typeof optionalSchema>;

function buildHeaderMap(headers: string[]) {
  const map: Record<string, string> = {};
  const normHeaders = headers.map((h) => [h, normalize(h)] as const);

  const tryFind = (expected: string, alts: string[]) => {
    const candidates = [expected, ...alts].map(normalize);
    const found = normHeaders.find(([, n]) => candidates.includes(n));
    return found?.[0];
  };

  [...REQUIRED_COLS, ...OPTIONAL_COLS].forEach((col) => {
    const orig = tryFind(col, SYNONYMS[col]);
    if (orig) map[orig] = col;
  });
  return map;
}

function remapRow(row: Row, headerMap: Record<string, string>) {
  const out: Row = {};
  Object.entries(row).forEach(([k, v]) => {
    const mapped = headerMap[k] ?? k;
    out[mapped] = v;
  });
  return out;
}

function validateRows(rows: Row[], headers: string[]) {
  const headerMap = buildHeaderMap(headers);
  const remapped = rows.map((r) => remapRow(r, headerMap)) as Row[];

  const mappedHeaders = Array.from(
    new Set(remapped.flatMap((r) => Object.keys(r)))
  );
  const missing = REQUIRED_COLS.filter((c) => !mappedHeaders.includes(c));

  const errors: string[] = [];
  const valid: ValidRow[] = [];

  if (missing.length)
    errors.push(
      `Row 0: schema: Missing required columns: ${missing.join(", ")}`
    );

  const coerceNum = (x: any) => {
    if (x == null) return undefined;
    if (typeof x === "number") return x;
    if (typeof x === "string") {
      const trimmed = x.trim();
      if (trimmed === "") return undefined;
      const num = Number(trimmed);
      return Number.isNaN(num) ? undefined : num;
    }
    return undefined;
  };

  for (let i = 0; i < remapped.length; i++) {
    const r = remapped[i];
    const candidate: Partial<ValidRow> = {
      type: String(r.type ?? ""),
      name: String(r.name ?? ""),
      amount: coerceNum(r.amount),
      rate: coerceNum(r.rate),
      duration: coerceNum(r.duration),
      category: String(r.category ?? ""),
      fixed_float: String(r.fixed_float ?? ""),
      float_share: coerceNum(r.float_share),
      repricing_bucket: String(r.repricing_bucket ?? ""),
      deposit_beta: coerceNum(r.deposit_beta),
      stability: coerceNum(r.stability),
      convexity: coerceNum(r.convexity),
    };

    const parsed = requiredSchema.merge(optionalSchema).safeParse(candidate);
    if (parsed.success) valid.push(parsed.data);
    else {
      errors.push(
        `Row ${i + 1}: ${parsed.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; ")}`
      );
    }
  }

  return { validRows: valid, errors, headerMap, mappedHeaders };
}

/* ==================== Delimiter detection & decimal comma ==================== */
function detectDelimiter(sample: string): string {
  const DELIMS = [",", ";", "\t", "|"];
  const lines = sample.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  if (!lines.length) return ",";

  let best = ",";
  let bestScore = -Infinity;

  for (const d of DELIMS) {
    const counts = lines.map((l) => l.split(d).length);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
    const score = mean - variance;
    if (score > bestScore || (score === bestScore && d === ",")) {
      bestScore = score;
      best = d;
    }
  }
  return best || ",";
}

// Heurística para pt-PT
function parsePTNumberLike(s: string) {
  if (typeof s !== "string") return s;
  const trimmed = s.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (
    /^-?\d{1,3}(\.\d{3})*,\d+$/.test(trimmed) ||
    /^-?\d+,\d+$/.test(trimmed)
  ) {
    const noThousands = trimmed.replace(/\./g, "");
    return noThousands.replace(",", ".");
  }
  if (/^-?\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    return trimmed.replace(/\./g, "");
  }
  return s;
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

/* ==================== Helpers de erros ==================== */
function groupErrors(errs: string[]) {
  const groups = new Map<string, string[]>();
  for (const e of errs) {
    const m = e.match(/Row \d+:\s*([^:]+):/);
    const key = m ? m[1] : "general";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  return Array.from(groups.entries()).map(([field, items]) => ({
    field,
    count: items.length,
    samples: items.slice(0, 10),
  }));
}

function groupErrorsByRow(errs: string[]) {
  const byRow = new Map<number, string[]>();
  for (const e of errs) {
    const m = e.match(/^Row (\d+):\s*(.*)$/);
    if (!m) continue;
    const row = Number(m[1]);
    const msg = m[2];
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row)!.push(msg);
  }
  return Array.from(byRow.entries())
    .map(([row, items]) => ({
      row,
      count: items.length,
      items: items.slice(0, 10),
    }))
    .sort((a, b) => a.row - b.row);
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==================== App ==================== */
type TableColKey =
  | "shock_bps"
  | "eve_change"
  | "eve_pct_equity"
  | "nii_delta"
  | "lcr_hqla"
  | "lcr_outflows"
  | "lcr_coverage";

export default function App() {
  // CSV preview state
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [headerMapState, setHeaderMapState] = useState<Record<string, string>>(
    {}
  );
  const [mappedHeaders, setMappedHeaders] = useState<string[]>([]);

  // Toast
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(
    null
  );
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2500);
  };

  // Modal preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // Parser options
  const [delimiter, setDelimiter] = useState<string>("auto");
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

  // Raw CSV
  const [rawCsv, setRawCsv] = useState<string>("");

  // API results
  const [equity, setEquity] = useState<number>(0);
  const [results, setResults] = useState<ScenarioOut[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  // ---- Tabela: ordenação
  const [sortCol, setSortCol] = useState<TableColKey>("shock_bps");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [showSchema, setShowSchema] = useState(true);

  // Persistência
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved) {
        setAfsHaircut(saved.afsHaircut ?? 0.1);
        setDepositRunoff(saved.depositRunoff ?? 0.15);
        setBetaCore(saved.betaCore ?? 0.3);
        setBetaNoncore(saved.betaNoncore ?? 0.6);
        setShocks(
          Array.isArray(saved.shocks) ? saved.shocks : [-200, -100, 0, 100, 200]
        );
        setDelimiter(saved.delimiter ?? "auto");
        setHeaderRow(saved.headerRow ?? true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const data = {
      afsHaircut,
      depositRunoff,
      betaCore,
      betaNoncore,
      shocks,
      delimiter,
      headerRow,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {}
  }, [afsHaircut, depositRunoff, betaCore, betaNoncore, shocks, delimiter, headerRow]);

  const requiredMissing = useMemo(
    () =>
      REQUIRED_COLS.filter(
        (c) => headers.length && !headers.includes(c) && !mappedHeaders.includes(c)
      ),
    [headers, mappedHeaders]
  );
  const optionalMissing = useMemo(
    () =>
      OPTIONAL_COLS.filter(
        (c) => headers.length && !headers.includes(c) && !mappedHeaders.includes(c)
      ),
    [headers, mappedHeaders]
  );

  /* ---- CSV upload/parse ---- */
  function parseFile(f: File) {
    setError("");
    setValidationErrors([]);
    setHeaderMapState({});
    setMappedHeaders([]);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const chosenDelimiter =
        delimiter === "auto" ? detectDelimiter(text.slice(0, 50_000)) : delimiter;

      if (headerRow) {
        const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
        const roughHdrs = firstLine
          .split(chosenDelimiter)
          .map((h) => h.replace(/^"|"$/g, "").trim());
        const tmpMap = buildHeaderMap(roughHdrs);
        setHeaderMapState(tmpMap);
      }

      Papa.parse<Row>(f, {
        header: headerRow,
        delimiter: chosenDelimiter,
        skipEmptyLines: true,
        dynamicTyping: true,
        transform: (val: string) => parsePTNumberLike(val),
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
          const hdrs = res.meta.fields ?? Object.keys(data[0] || {});

          const toNum = (v: any) => {
            if (typeof v === "number") return v;
            if (typeof v === "string") {
              const num = Number(v);
              if (!Number.isNaN(num) && v.trim() !== "") return num;
            }
            return v;
          };
          const normalizedRows = data.map((r) => {
            const o: Row = {};
            for (const k of Object.keys(r)) o[k] = toNum((r as any)[k]);
            return o;
          });

          const { errors, headerMap, mappedHeaders } = validateRows(
            normalizedRows,
            hdrs
          );
          setValidationErrors(errors);
          setHeaderMapState(headerMap);
          setMappedHeaders(mappedHeaders);

          setRows(normalizedRows);
          setHeaders(mappedHeaders.length ? mappedHeaders : hdrs);

          const reader2 = new FileReader();
          reader2.onload = () => setRawCsv(String(reader2.result || ""));
          reader2.onerror = () => setRawCsv("");
          reader2.readAsText(f);

          showToast("ok", "CSV carregado com sucesso.");
        },
        error: (err) => {
          setError(err.message || "Unknown error while parsing CSV.");
          showToast("err", "Erro ao ler o CSV.");
        },
      });
    };
    reader.onerror = () => {
      showToast("err", "Não foi possível ler o ficheiro.");
    };
    reader.readAsText(f);
  }

  function validateAndParse(f?: File) {
    if (!f) return;
    const sizeMb = f.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_MB) {
      showToast(
        "err",
        `Ficheiro muito grande (${sizeMb.toFixed(1)}MB). Máx ${MAX_FILE_MB}MB.`
      );
      return;
    }
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

  useEffect(() => {
    const prevent = (ev: DragEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  /* ==================== Preview com paginação & pesquisa (debounce) ==================== */
  const [previewQuery, setPreviewQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [compactRows, setCompactRows] = useState(false);
  const [pageSize, setPageSize] = useState(200);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedQuery(previewQuery.trim().toLowerCase()),
      300
    );
    return () => window.clearTimeout(t);
  }, [previewQuery]);

  const previewRowsFiltered = useMemo(() => {
    if (!debouncedQuery) return rows;
    return rows.filter((r) =>
      (headers.length ? headers : Object.keys(r)).some((h) =>
        String((r as any)[h] ?? "").toLowerCase().includes(debouncedQuery)
      )
    );
  }, [rows, headers, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(previewRowsFiltered.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, rows, pageSize]);

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return previewRowsFiltered.slice(start, start + pageSize);
  }, [previewRowsFiltered, page, pageSize]);

  /* ---- Run API ---- */
  async function runStressTest() {
    setApiError("");
    setResults([]);
    if (!rawCsv) {
      setApiError("Please upload a CSV first.");
      showToast("err", "Carrega um CSV primeiro.");
      return;
    }
    if (validationErrors.length) {
      setApiError(
        "Há erros de validação nos dados. Corrige antes de correr o stress test."
      );
      showToast("err", "Corrige os erros de validação.");
      return;
    }
    setShowSchema(false);
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

  /* ---- Exports ---- */
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

  function exportResultsJson() {
    if (!results.length) return;
    const payload = {
      exported_at: new Date().toISOString(),
      equity,
      params: {
        shocks_bps: shocks,
        afs_haircut: afsHaircut,
        deposit_runoff: depositRunoff,
        deposit_beta_core: betaCore,
        deposit_beta_noncore: betaNoncore,
      },
      results,
    };
    downloadJson("stress_results.json", payload);
    showToast("ok", "JSON exportado.");
  }

  /* ---- Derived data ---- */
  const sortedResultsForCharts = useMemo(
    () => [...results].sort((a, b) => a.shock_bps - b.shock_bps),
    [results]
  );

  const tableSortedResults = useMemo(() => {
    const out = [...results];
    out.sort((a: any, b: any) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      const cmp = (Number(va) || 0) - (Number(vb) || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [results, sortCol, sortDir]);

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
    const csv = rowsToCsv(
      headers.length ? headers : Object.keys(rows[0] || {}),
      pageSlice as Row[]
    );
    navigator.clipboard.writeText(csv).then(
      () => showToast("ok", "Preview copiado para o clipboard."),
      () => showToast("err", "Não foi possível copiar.")
    );
  }

  function downloadPreviewCsv() {
    const csv = rowsToCsv(
      headers.length ? headers : Object.keys(rows[0] || {}),
      previewRowsFiltered as Row[]
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preview.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadErrorsTxt() {
    if (!validationErrors.length) return;
    const byCol = groupErrors(validationErrors);
    const byRow = groupErrorsByRow(validationErrors);
    const lines: string[] = [];
    lines.push(`# Validation report\n`);

    lines.push(`## By column`);
    byCol.forEach((g) => {
      lines.push(`- ${g.field}: ${g.count}`);
      g.samples.forEach((s) => lines.push(`  • ${s}`));
    });

    lines.push(`\n## By row`);
    byRow.forEach((g) => {
      lines.push(`- Row ${g.row}: ${g.count}`);
      g.items.forEach((s) => lines.push(`  • ${s}`));
    });

    downloadText("validation_errors.txt", lines.join("\n"));
  }

  /* --- Sample CSV & schema modal --- */
  const [schemaOpen, setSchemaOpen] = useState(false);
  function downloadSampleCsv() {
    const head = [...REQUIRED_COLS, ...OPTIONAL_COLS].join(",");
    const row1 = [
      "loan",
      "SME Term",
      "2500000",
      "0.055",
      "48",
      "asset",
      "fixed",
      "0",
      "6-12m",
      "",
      "",
      "",
    ].join(",");
    const row2 = [
      "deposit",
      "Core Checking",
      "-4000000",
      "0.01",
      "0",
      "liability",
      "float",
      "1",
      "<1m",
      "0.3",
      "0.95",
      "",
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
  const groupedIssues = groupErrors(validationErrors);
  const groupedByRow = useMemo(
    () => groupErrorsByRow(validationErrors),
    [validationErrors]
  );

  // helpers UI
  const SortHeader = ({
    col,
    label,
  }: {
    col: TableColKey;
    label: string;
  }) => {
    const active = sortCol === col;
    const dir = active ? sortDir : undefined;
    const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
    return (
      <th className="text-left px-3 py-2 border-b border-white/10">
        <button
          className={`inline-flex items-center gap-1 text-sm hover:opacity-90 ${
            active ? "text-white" : "text-white/85"
          }`}
          aria-sort={ariaSort as any}
          onClick={() => {
            if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else {
              setSortCol(col);
              setSortDir(col === "shock_bps" ? "asc" : "desc");
            }
          }}
          title="Ordenar"
        >
          <span>{label}</span>
          <span className="opacity-70 text-[11px]">
            {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  const kpiHintIcon = (text: string) => (
    <UiTooltip>
      <UiTooltipTrigger asChild>
        <button
          type="button"
          aria-label="Hint"
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          ?
        </button>
      </UiTooltipTrigger>
      <UiTooltipContent
        side="top"
        align="start"
        sideOffset={6}
        className="z-[9999] max-w-[240px] text-xs leading-4"
      >
        {text}
      </UiTooltipContent>
    </UiTooltip>
  );

  const kpiBox = (label: string, value: string, hint?: string, sub?: string) => (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
      <div className="text-xs text-white/70 flex items-center">
        {label}
        {hint ? kpiHintIcon(hint) : null}
      </div>
      <div className="mt-1 text-[32px] leading-[36px] font-semibold">{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-white/60">{sub}</div> : null}
    </div>
  );

  return (
    <UiTooltipProvider delayDuration={120}>
      <div className="min-h-screen">
        <BackgroundGlow />

        {/* Toast */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed right-4 top-4 z-[100] rounded-xl border px-3 py-2 text-sm backdrop-blur ${
              toast.type === "ok"
                ? "bg-emerald-500/15 text-emerald-200 border-emerald-600/40"
                : "bg-rose-500/15 text-rose-200 border-rose-600/40"
            }`}
          >
            {toast.msg}
          </div>
        )}

        <div className="container max-w-6xl py-8 space-y-6">
          {/* Header */}
          <header className="flex items-center justify-between">
            <h1 className="text-[32px] leading-[36px] font-semibold tracking-tight">
              Bank Stress Test Simulator
            </h1>
            <Badge variant="secondary" className="text-xs" aria-label="App version">
              v0.5.0
            </Badge>
          </header>

          {/* Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-6 space-y-6">
                <Card className={PANEL} aria-labelledby="data-params-title">
                  <CardHeader>
                    <CardTitle id="data-params-title" className="text-[20px] leading-[24px]">
                      Data & Parameters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Upload */}
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
                      className={`rounded-xl border p-3 transition ${
                        dragActive ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm">
                          <div className="font-medium">CSV file</div>
                          <div className="text-xs text-white/60">
                            Arrasta aqui ou escolhe um ficheiro (máx {MAX_FILE_MB}MB)
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
                        <label className="block text-xs mb-1 opacity-80">Delimiter</label>
                        <div className="relative">
                          <select
                            value={delimiter}
                            onChange={(e) => setDelimiter(e.target.value)}
                            className={SELECT_FIELD}
                            aria-label="CSV delimiter"
                          >
                            <option value="auto">Auto (detect)</option>
                            <option value=",">Comma (,)</option>
                            <option value=";">Semicolon (;)</option>
                            <option value="\t">Tab (\t)</option>
                            <option value="|">Pipe (|)</option>
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
                          aria-label="First row contains headers"
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
                        aria-label="AFS haircut"
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
                        aria-label="Deposit runoff"
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
                          aria-label="Beta core"
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
                          aria-label="Beta noncore"
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
                        aria-label="Shock list"
                      />
                    </label>

                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          ref={previewBtnRef}
                          variant="secondary"
                          className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={() => setPreviewOpen(true)}
                          disabled={headers.length === 0 && rows.length === 0}
                          title={
                            headers.length === 0 && rows.length === 0
                              ? "Upload a CSV first"
                              : "Preview parsed CSV"
                          }
                          aria-haspopup="dialog"
                          aria-controls="preview-dialog"
                        >
                          Preview CSV
                        </Button>
                        <Button
                          ref={schemaBtnRef}
                          variant="secondary"
                          className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={() => setSchemaOpen(true)}
                          aria-haspopup="dialog"
                        >
                          View schema
                        </Button>
                      </div>

                      <Button onClick={runStressTest} disabled={loading} className="w-full">
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

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="secondary"
                          className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={exportResultsCsv}
                          disabled={results.length === 0}
                          title={
                            results.length === 0 ? "Run a stress test first" : "Export results as CSV"
                          }
                        >
                          Export CSV
                        </Button>
                        <Button
                          variant="secondary"
                          className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={exportResultsJson}
                          disabled={results.length === 0}
                          title={
                            results.length === 0 ? "Run a stress test first" : "Export results as JSON"
                          }
                        >
                          Export JSON
                        </Button>
                      </div>
                    </div>

                    {!headers.length && !error && rows.length === 0 && (
                      <p className="text-xs text-white/60">
                        Dica: podes descarregar um{" "}
                        <button className="underline" onClick={downloadSampleCsv}>
                          sample CSV
                        </button>{" "}
                        e editar.
                      </p>
                    )}

                    {(apiError || error) && (
                      <div
                        className="rounded-lg border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-200"
                        role="alert"
                      >
                        {apiError || error}
                      </div>
                    )}

                    {validationErrors.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 p-3 text-xs text-amber-100 space-y-2 max-h-48 overflow-auto">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Validation issues: {validationErrors.length}</div>
                          <Button
                            variant="secondary"
                            className="h-7 px-2 bg-white/10 hover:bg-white/15 border border-white/10"
                            onClick={downloadErrorsTxt}
                          >
                            Download .txt
                          </Button>
                        </div>
                        {groupedIssues.map((g) => (
                          <div key={g.field}>
                            <div className="opacity-90">
                              {g.field} — {g.count}
                            </div>
                            {g.samples.map((s, i) => (
                              <div key={i}>• {s}</div>
                            ))}
                          </div>
                        ))}
                        {groupedByRow.length > 0 && (
                          <div className="mt-2">
                            <div className="opacity-90">Top rows with issues</div>
                            {groupedByRow.slice(0, 5).map((g) => (
                              <div key={g.row}>• Row {g.row}: {g.count}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </aside>

            {/* Main */}
            <main className="lg:col-span-8 space-y-6">
              {/* Estado vazio */}
              {rows.length === 0 && results.length === 0 && !error && (
                <Card className={PANEL} aria-label="Empty state">
                  <CardContent className="py-10 text-center space-y-3">
                    <h2 className="text-[24px] leading-[28px] font-semibold">
                      Começa por carregar um CSV
                    </h2>
                    <p className="text-white/70 text-sm">
                      Arrasta o ficheiro para a caixa ao lado, confirma o delimitador, revê a
                      validação e corre o stress test.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Button onClick={downloadSampleCsv}>Download sample</Button>
                      <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                        Choose file
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Schema card */}
                {showSchema && (headers.length > 0 || mappedHeaders.length > 0) && (
                <Card className={PANEL}>
                  <CardHeader>
                    <CardTitle className="text-[20px] leading-[24px]">Schema</CardTitle>
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

                    {Object.keys(headerMapState).length > 0 && (
                      <div className="text-xs text-white/70">
                        <div className="font-medium mb-1">Automatic column mapping</div>
                        <ul className="list-disc ml-5 space-y-0.5">
                          {Object.entries(headerMapState).map(([orig, exp]) => (
                            <li key={orig}>
                              <span className="text-white/90">{orig}</span> →{" "}
                              <span className="text-emerald-300">{exp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {results.length > 0 && (
                <Card className={PANEL}>
                  <CardHeader>
                    <CardTitle className="text-[24px] leading-[28px]">Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* KPIs com hints */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      {kpiBox(
                        "Equity",
                        fmtMoney(equity),
                        "Equity de partida (baseline) reportado pela API.",
                        "Base para % em ΔEVE/Equity"
                      )}
                      {kpiBox(
                        "Best ΔEVE (% equity)",
                        (() => {
                          const best = Math.max(
                            ...results.map((r) => r.eve_pct_equity * 100)
                          );
                          return fmtSignedPct(best, 1);
                        })(),
                        "Δ Economic Value of Equity dividido por Equity baseline.",
                        "Melhor cenário entre os choques"
                      )}
                      {kpiBox(
                        "Worst ΔEVE (% equity)",
                        (() => {
                          const worst = Math.min(
                            ...results.map((r) => r.eve_pct_equity * 100)
                          );
                          return fmtSignedPct(worst, 1);
                        })(),
                        "Δ Economic Value of Equity dividido por Equity baseline.",
                        "Pior cenário entre os choques"
                      )}
                    </div>

                    {/* ΔEVE / Equity */}
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
                          <AreaChart data={sortedResultsForCharts}>
                            <CartesianGrid stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} tickMargin={8} />
                            <YAxis
                              tickFormatter={(v) => fmtPct((Number(v) || 0) * 100)}
                              tick={{ fontSize: 12 }}
                              tickMargin={8}
                            />
                            <RechartTooltip
                              formatter={(val: any, name: any) => {
                                if (name === "ΔEVE/Equity") {
                                  const pct = (val as number) * 100;
                                  return fmtSignedPct(pct, 1);
                                }
                                return val;
                              }}
                              labelFormatter={(l) => `Shock: ${l} bps`}
                              cursor={{ stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 }}
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
                              fill="rgba(147,197,253,0.20)"
                              stroke="rgba(147,197,253,0.85)"
                              strokeWidth={2}
                              activeDot
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* ΔNII (12m) */}
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
                          <LineChart data={sortedResultsForCharts}>
                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="shock_bps" tick={{ fontSize: 12 }} tickMargin={8} />
                            <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 12 }} tickMargin={8} />
                            <RechartTooltip
                              formatter={(val: any, name: any) =>
                                name === "ΔNII (12m)" ? fmtSignedMoney(Number(val)) : val
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
                              stroke="rgba(110,231,183,0.9)"
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              activeDot
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* LCR */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm text-white/80">
                          Liquidity: HQLA, Outflows & Coverage vs shock
                        </div>
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
                          <BarChart
                            data={sortedResultsForCharts}
                            barCategoryGap={24}
                            margin={{ top: 8, right: 28, left: 28, bottom: 8 }}
                          >
                            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                            <XAxis
                              dataKey="shock_bps"
                              tick={{ fontSize: 12, fill: "#D1D5DB" }}
                              stroke="#4B5563"
                              tickMargin={8}
                            />
                            <YAxis
                              yAxisId="left"
                              width={88}
                              tickFormatter={fmtMoney}
                              tick={{ fontSize: 12, fill: "#D1D5DB" }}
                              stroke="#4B5563"
                              tickMargin={8}
                            />
                            <YAxis
                              yAxisId="right"
                              width={56}
                              orientation="right"
                              tickFormatter={(v) => fmtX(Number(v))}
                              tick={{ fontSize: 12, fill: "#D1D5DB" }}
                              stroke="#4B5563"
                              tickMargin={8}
                              domain={[0, (dataMax: number) => Math.max(1.2, dataMax * 1.1)]}
                            />
                            <RechartTooltip
                              cursor={false}
                              contentStyle={{
                                background: "rgba(10,10,10,0.75)",
                                backdropFilter: "blur(6px)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                color: "#E5E7EB",
                              }}
                              formatter={(val: any, _name: any, props: any) => {
                                const key = (props?.dataKey as string) || "";
                                if (key === "lcr_hqla" || key === "lcr_outflows") {
                                  return fmtSignedMoney(Number(val));
                                }
                                if (key === "lcr_coverage") return signed(fmtX(Number(val)));
                                return val;
                              }}
                              labelFormatter={(l) => `Shock: ${l} bps`}
                            />
                            <Legend wrapperStyle={{ color: "#E5E7EB" }} />

                            <Bar
                              yAxisId="left"
                              dataKey="lcr_hqla"
                              name="HQLA"
                              fill="rgba(110,231,183,0.45)"
                              stroke="rgba(16,185,129,0.9)"
                              barSize={18}
                              radius={[6, 6, 0, 0]}
                            />
                            <Bar
                              yAxisId="left"
                              dataKey="lcr_outflows"
                              name="Outflows"
                              fill="rgba(252,165,165,0.45)"
                              stroke="rgba(239,68,68,0.9)"
                              barSize={18}
                              radius={[6, 6, 0, 0]}
                            />

                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="lcr_coverage"
                              name="Coverage (×)"
                              stroke="rgba(147,197,253,0.9)"
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              activeDot
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Tabela */}
                    <div className="overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 bg-white/5 backdrop-blur z-10">
                          <tr>
                            <SortHeader col="shock_bps" label="shock_bps" />
                            <SortHeader col="eve_change" label="ΔEVE" />
                            <SortHeader col="eve_pct_equity" label="ΔEVE / Equity" />
                            <SortHeader col="nii_delta" label="ΔNII (12m)" />
                            <SortHeader col="lcr_hqla" label="HQLA" />
                            <SortHeader col="lcr_outflows" label="Outflows" />
                            <SortHeader col="lcr_coverage" label="Coverage" />
                          </tr>
                        </thead>
                        <tbody>
                          {tableSortedResults.map((r) => (
                            <tr key={r.shock_bps} className="even:bg-white/[0.03]">
                              <td className="px-3 py-2 border-b border-white/10">{r.shock_bps}</td>
                              <td
                                className={`px-3 py-2 border-b border-white/10 ${
                                  r.eve_change >= 0 ? "text-emerald-300" : "text-rose-300"
                                }`}
                              >
                                {fmtSignedMoney(r.eve_change)}
                              </td>
                              <td
                                className={`px-3 py-2 border-b border-white/10 ${
                                  r.eve_pct_equity >= 0 ? "text-emerald-300" : "text-rose-300"
                                }`}
                              >
                                {fmtSignedPct(r.eve_pct_equity * 100)}
                              </td>
                              <td
                                className={`px-3 py-2 border-b border-white/10 ${
                                  r.nii_delta >= 0 ? "text-emerald-300" : "text-rose-300"
                                }`}
                              >
                                {fmtSignedMoney(r.nii_delta)}
                              </td>
                              <td className="px-3 py-2 border-b border-white/10">
                                {fmtSignedMoney(r.lcr_hqla)}
                              </td>
                              <td className="px-3 py-2 border-b border-white/10">
                                {fmtSignedMoney(r.lcr_outflows)}
                              </td>
                              <td
                                className={`px-3 py-2 border-b border-white/10 ${
                                  r.lcr_coverage >= 1 ? "text-emerald-300" : "text-rose-300"
                                }`}
                              >
                                {signed(fmtX(r.lcr_coverage))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Export buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={exportResultsCsv}
                        disabled={results.length === 0}
                      >
                        Export CSV
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-white/10 hover:bg-white/15 border border-white/10"
                        onClick={exportResultsJson}
                        disabled={results.length === 0}
                      >
                        Export JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </main>
          </div>
        </div>

        {/* Schema modal */}
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
                <h3 id="schema-title" className="text-[20px] leading-[24px] font-medium">
                  Expected schema
                </h3>
                <button
                  onClick={() => {
                    setSchemaOpen(false);
                    schemaBtnRef.current?.focus();
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
                  aria-label="Close dialog"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-white/70 mb-1">Required</div>
                  <div className="flex flex-wrap gap-2">
                    {REQUIRED_COLS.map((c) => (
                      <span
                        key={c}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          headers.includes(c) || mappedHeaders.includes(c)
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-700"
                            : "bg-red-500/20 text-red-200 border-red-700"
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-white/70 mb-1">Optional</div>
                  <div className="flex flex-wrap gap-2">
                    {OPTIONAL_COLS.map((c) => (
                      <span
                        key={c}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          headers.includes(c) || mappedHeaders.includes(c)
                            ? "bg-white/10 text-white/90 border-white/20"
                            : "bg-black/20 text-white/50 border-white/10"
                        }`}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-white/60">
                  Tip: usa o botão <span className="text-white">Sample CSV</span> para um ficheiro de
                  exemplo.
                </div>
              </div>
            </SchemaModalContent>
          </div>
        )}

        {/* Preview CSV modal */}
        {previewOpen && (
          <div
            id="preview-dialog"
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
              <div className="mb-3 gap-2 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h3 id="preview-title" className="text-[20px] leading-[24px] font-medium">
                  CSV Preview ({previewRowsFiltered.length}/{rows.length})
                </h3>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="preview-search"
                    type="text"
                    placeholder="Search..."
                    value={previewQuery}
                    onChange={(e) => setPreviewQuery(e.target.value)}
                    className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm placeholder-white/50 focus:outline-none focus:border-white/20"
                    aria-label="Search in CSV preview"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={compactRows}
                      onChange={(e) => setCompactRows(e.target.checked)}
                      className={CHECKBOX}
                      aria-label="Compact rows"
                    />
                    Compact
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    Page size
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm focus:outline-none"
                      aria-label="Page size"
                    >
                      {[100, 200, 500, 1000].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    onClick={copyPreviewCsv}
                    className="h-9 bg-white/10 hover:bg-white/15 border border-white/10"
                  >
                    Copy (page)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={downloadPreviewCsv}
                    className="h-9 bg-white/10 hover:bg-white/15 border border-white/10"
                  >
                    Download (filtered)
                  </Button>
                  <Button
                    onClick={() => {
                      setPreviewOpen(false);
                      previewBtnRef.current?.focus();
                    }}
                    aria-label="Close dialog"
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between mb-2 text-xs text-white/70 gap-2">
                <div>
                  Page {page} / {totalPages} — showing {pageSlice.length} of {previewRowsFiltered.length} filtered rows
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                  <label className="flex items-center gap-1">
                    Go to
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      className="h-8 w-20 rounded-md border border-white/10 bg-white/5 px-2 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = Number((e.target as HTMLInputElement).value);
                          if (!Number.isNaN(v))
                            setPage(Math.min(Math.max(1, v), totalPages));
                        }
                      }}
                      aria-label="Go to page"
                    />
                  </label>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white/5 backdrop-blur">
                    <tr>
                      {(headers.length ? headers : Object.keys(pageSlice[0] || {})).map(
                        (h) => (
                          <th key={h} className="text-left px-3 py-2 border-b border-white/10">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pageSlice.map((r, i) => (
                      <tr key={i} className={`even:bg-white/[0.03] ${compactRows ? "" : ""}`}>
                        {(headers.length ? headers : Object.keys(r)).map((h) => (
                          <td
                            key={h}
                            className={`px-3 ${compactRows ? "py-1.5" : "py-2"} border-b border-white/10`}
                          >
                            {String((r as any)[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination bottom */}
              <div className="flex items-center justify-end mt-2 gap-2">
                <Button
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  First
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <div className="text-xs text-white/70">
                  Page {page} / {totalPages}
                </div>
                <Button
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="secondary"
                  className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  Last
                </Button>
              </div>
            </SchemaModalContent>
          </div>
        )}
      </div>
      </UiTooltipProvider>
    );
  }

  /* ==================== Background ==================== */
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

  /* ---------- Modal content helper ---------- */
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
        className={`relative z-10 w-[min(960px,92vw)] ${panelClass} p-4 outline-none`}
        tabIndex={-1}
        role="document"
      >
        {children}
      </div>
  );
}