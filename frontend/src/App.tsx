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
  Tooltip as RechartTooltip,
} from "recharts";

import {
  Tooltip as UiTooltip,
  TooltipProvider as UiTooltipProvider,
  TooltipTrigger as UiTooltipTrigger,
  TooltipContent as UiTooltipContent,
} from "@/components/ui/tooltip";

import {
  Upload,
  Eye,
  FileSpreadsheet,
  Play,
  Loader2,
  Download,
  FileJson,
  AlertTriangle,
  Search,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Languages,
  FileDown,
  ImageDown,
} from "lucide-react";

import { AnimatedPageWrapper } from "./routes/AnimatedPageWrapper";
import { Link } from "react-router-dom";

type Lang = "pt" | "en";
const LANG_LS_KEY = "bsts_lang_v1.0.0";

const DIC: Record<Lang, Record<string, string>> = {
  en: {
    appTitle: "Bank Stress Test Simulator",
    version: "v1.0.0",
    dataParams: "Data & Parameters",
    csvFile: "CSV file",
    dropHere: "Choose a file (max {{mb}}MB)",
    chooseFile: "Choose File",
    delimiter: "Delimiter",
    headerRow: "First row contains headers",
    autoDetect: "Auto (detect)",
    comma: "Comma (,)",
    semicolon: "Semicolon (;)",
    tab: "Tab (\\t)",
    pipe: "Pipe (|)",
    afsHaircut: "AFS haircut (0–0.5)",
    depositRunoff: "Deposit runoff (0–1)",
    betaCore: "Beta (core)",
    betaNoncore: "Beta (noncore)",
    shocks: "Shocks (bps)",
    previewCsv: "Preview CSV",
    viewSchema: "View schema",
    run: "Run stress test",
    running: "Running...",
    exportCsv: "Export CSV",
    exportJson: "Export JSON",
    parseErr: "Error reading CSV.",
    csvLoaded: "CSV loaded successfully.",
    copyOk: "Preview copied to clipboard.",
    copyErr: "Could not copy.",
    jsonExported: "JSON exported.",
    csvExported: "CSV exported.",
    needCsv: "Please upload a CSV first.",
    fixValidation: "There are validation errors. Please fix them.",
    apiRunErr: "Error running stress test.",
    emptyTitle: "Start by uploading a CSV",
    emptySub:
      "Drag the file to the box on the left, confirm the delimiter, review validation and run the stress test.",
    chooseFileCta: "Choose file",
    schema: "Schema",
    required: "Required",
    optional: "Optional",
    requiredStatus: "Required {{ok}}/{{total}}",
    optionalStatus: "Optional {{ok}}/{{total}}",
    missingRequired: "Missing required: {{cols}}",
    autoMap: "Automatic column mapping",
    expectedSchema: "Expected schema",
    close: "Close",
    results: "Results",
    equity: "Equity",
    equityHint: "Baseline equity reported by the API.",
    equitySub: "Base for % in ΔEVE/Equity",
    bestEve: "Best ΔEVE (% equity)",
    worstEve: "Worst ΔEVE (% equity)",
    eveHint: "Δ Economic Value of Equity divided by baseline equity.",
    bestAmong: "Best among shocks",
    worstAmong: "Worst among shocks",
    eveVsShock: "ΔEVE / Equity vs shock",
    exportPng: "Export PNG",
    niiVsShock: "ΔNII (12m) vs shock",
    lcrTitle: "Liquidity: HQLA, Outflows & Coverage vs shock",
    tableShock: "shock_bps",
    tableEve: "ΔEVE",
    tableEveEq: "ΔEVE / Equity",
    tableNii: "ΔNII (12m)",
    tableHqla: "HQLA",
    tableOut: "Outflows",
    tableCov: "Coverage",
    validationIssues: "Validation issues: {{n}}",
    downloadTxt: "Download .txt",
    topRows: "Top rows with issues",
    emptyStateCard: "Empty state",
    previewDialog: "CSV Preview ({{f}}/{{t}})",
    search: "Search...",
    compact: "Compact",
    pageSize: "Page size",
    copyPage: "Copy (page)",
    downloadFiltered: "Download (filtered)",
    pageOf: "Page {{p}} / {{tp}} — showing {{n}} of {{nf}} filtered",
    first: "First",
    prev: "Prev",
    next: "Next",
    last: "Last",
    goto: "Go to",
    gotoPage: "Go to page",
    noResults:
      "No results for \"{{q}}\". Check the term or clear the filter.",
    lang: "Language",
    sampleCsv: "You can download a sample CSV on the Try it page.",
    ok: "OK",
  },
  pt: {
    appTitle: "Bank Stress Test Simulator",
    version: "v1.0.0",
    dataParams: "Dados & Parâmetros",
    csvFile: "Ficheiro CSV",
    dropHere: "Escolhe um ficheiro (máx {{mb}}MB)",
    chooseFile: "Escolher ficheiro",
    delimiter: "Delimitador",
    headerRow: "Primeira linha tem cabeçalhos",
    autoDetect: "Auto (detectar)",
    comma: "Vírgula (,)",
    semicolon: "Ponto e vírgula (;)",
    tab: "Tab (\\t)",
    pipe: "Pipe (|)",
    afsHaircut: "Corte AFS (0–0.5)",
    depositRunoff: "Runoff depósitos (0–1)",
    betaCore: "Beta (core)",
    betaNoncore: "Beta (noncore)",
    shocks: "Choques (bps)",
    previewCsv: "Pré-visualizar CSV",
    viewSchema: "Ver schema",
    run: "Correr stress test",
    running: "A correr...",
    exportCsv: "Exportar CSV",
    exportJson: "Exportar JSON",
    parseErr: "Erro ao ler o CSV.",
    csvLoaded: "CSV carregado com sucesso.",
    copyOk: "Preview copiada para o clipboard.",
    copyErr: "Não foi possível copiar.",
    jsonExported: "JSON exportado.",
    csvExported: "CSV exportado.",
    needCsv: "Carrega um CSV primeiro.",
    fixValidation: "Há erros de validação. Corrige antes de correr.",
    apiRunErr: "Erro ao correr o stress test.",
    emptyTitle: "Começa por carregar um CSV",
    emptySub:
      "Arrasta o ficheiro para a caixa ao lado, confirma o delimitador, revê a validação e corre o stress test.",
    chooseFileCta: "Escolher ficheiro",
    schema: "Schema",
    required: "Obrigatórias",
    optional: "Opcionais",
    requiredStatus: "Obrigatórias {{ok}}/{{total}}",
    optionalStatus: "Opcionais {{ok}}/{{total}}",
    missingRequired: "Em falta: {{cols}}",
    autoMap: "Mapeamento automático de colunas",
    expectedSchema: "Schema esperado",
    close: "Fechar",
    results: "Resultados",
    equity: "Equity",
    equityHint: "Equity de partida (baseline) reportado pela API.",
    equitySub: "Base para % em ΔEVE/Equity",
    bestEve: "Melhor ΔEVE (% equity)",
    worstEve: "Pior ΔEVE (% equity)",
    eveHint:
      "Δ Economic Value of Equity dividido por Equity baseline.",
    bestAmong: "Melhor cenário entre os choques",
    worstAmong: "Pior cenário entre os choques",
    eveVsShock: "ΔEVE / Equity vs choque",
    exportPng: "Exportar PNG",
    niiVsShock: "ΔNII (12m) vs choque",
    lcrTitle: "Liquidez: HQLA, Outflows & Coverage vs choque",
    tableShock: "shock_bps",
    tableEve: "ΔEVE",
    tableEveEq: "ΔEVE / Equity",
    tableNii: "ΔNII (12m)",
    tableHqla: "HQLA",
    tableOut: "Outflows",
    tableCov: "Coverage",
    validationIssues: "Problemas de validação: {{n}}",
    downloadTxt: "Descarregar .txt",
    topRows: "Top linhas com issues",
    emptyStateCard: "Estado vazio",
    previewDialog: "Preview CSV ({{f}}/{{t}})",
    search: "Pesquisar...",
    compact: "Compacto",
    pageSize: "Tamanho de página",
    copyPage: "Copiar (página)",
    downloadFiltered: "Download (filtradas)",
    pageOf:
      "Página {{p}} / {{tp}} — a mostrar {{n}} de {{nf}} filtradas",
    first: "Primeira",
    prev: "Anterior",
    next: "Seguinte",
    last: "Última",
    goto: "Ir para",
    gotoPage: "Ir para página",
    noResults:
      "Sem resultados para \"{{q}}\". Verifica o termo ou limpa o filtro.",
    lang: "Idioma",
    sampleCsv: "Podes descarregar um CSV de exemplo na página Try it.",
    ok: "OK",
  },
};

function useI18n() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem(LANG_LS_KEY) as Lang | null;
    if (saved === "pt" || saved === "en") setLang(saved);
    else {
      const n = navigator.language || navigator.languages?.[0] || "en";
      const guess: Lang = n.toLowerCase().startsWith("pt") ? "pt" : "en";
      setLang(guess);
      localStorage.setItem(LANG_LS_KEY, guess);
    }
  }, []);
  const t = (key: string, vars?: Record<string, string | number>) => {
    const raw = DIC[lang][key] ?? key;
    if (!vars) return raw;
    return Object.entries(vars).reduce(
      (s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)),
      raw
    );
  };
  const set = (l: Lang) => {
    setLang(l);
    localStorage.setItem(LANG_LS_KEY, l);
  };
  return { lang, setLang: set, t };
}

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const fmtMoney = (n: number) => nf0.format(Number(n) || 0);
const fmtMoneyCompact = (n: number) => {
  const abs = Math.abs(n);
  const units = [
    { v: 1e12, s: "T" },
    { v: 1e9, s: "B" },
    { v: 1e6, s: "M" },
    { v: 1e3, s: "K" },
  ] as const;

  for (const u of units) {
    if (abs >= u.v) {
      const num = n / u.v;
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }) + u.s;
    }
  }

  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
};

const fmtPct = (x: number, digits = 1) =>
  `${(Number.isFinite(x) ? x : 0).toFixed(digits)}%`;
const fmtX = (x: number, digits = 2) =>
  `${(Number.isFinite(x) ? x : 0).toFixed(digits)}x`;
const signed = (s: string) =>
  s.startsWith("-") || s.startsWith("+") ? s : `+${s}`;
const fmtSignedMoney = (n: number) =>
  n >= 0 ? `+${fmtMoney(n)}` : fmtMoney(n);
const fmtSignedPct = (p: number, digits = 1) =>
  p >= 0 ? `+${fmtPct(p, digits)}` : fmtPct(p, digits);

const LS_KEY = "bsts_v060_params";
const MAX_FILE_MB = 10;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

const PANEL =
  "rounded-2xl border border-white/5 bg-white/3 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.35)]";
const FIELD_BASE =
  "h-10 w-full rounded-xl border border-white/5 bg-white/3 backdrop-blur-sm px-3 text-sm placeholder-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:border-sky-300/30";
const FIELD_NUMBER = `${FIELD_BASE} [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const FIELD = FIELD_BASE;
const SELECT_FIELD = `${FIELD_BASE} pr-9 appearance-none cursor-pointer`;
const CHECKBOX =
  "h-4 w-4 rounded border border-white/20 bg-white/10 accent-white/90 focus:outline-none focus:ring-2 focus:ring-white/20";

type Row = Record<string, string | number | null>;
type ScenarioOut = {
  shock_bps: number;
  eve_change: number;
  eve_pct_equity: number;
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
  rate: ["rate", "int_rate", "coupon", "interest_rate", "yld", "yield"],
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
      bestScore = score; best = d;
    }
  }
  return best || ",";
}

function parsePTNumberLike(s: string) {
  if (typeof s !== "string") return s;
  const trimmed = s.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(trimmed) || /^-?\d+,\d+$/.test(trimmed)) {
    const noThousands = trimmed.replace(/\./g, "");
    return noThousands.replace(",", ".");
  }
  if (/^-?\d{1,3}(\.\d{3})+$/.test(trimmed)) return trimmed.replace(/\./g, "");
  return s;
}

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
    .map(([row, items]) => ({ row, count: items.length, items: items.slice(0, 10) }))
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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const pat = new RegExp(escapeRegExp(query), "ig");
  const parts = String(text ?? "").split(pat);
  const matches = String(text ?? "").match(pat) || [];
  if (matches.length === 0) return text;
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    out.push(p);
    if (i < matches.length) {
      out.push(
        <mark key={`m-${i}`} className="bg-yellow-300/30 text-yellow-200 px-0.5 rounded-sm">
          {matches[i]}
        </mark>
      );
    }
  });
  return <>{out}</>;
}

type TableColKey =
  | "shock_bps"
  | "eve_change"
  | "eve_pct_equity"
  | "nii_delta"
  | "lcr_hqla"
  | "lcr_outflows"
  | "lcr_coverage";

export default function App() {
  const { lang, setLang, t } = useI18n();
  const reducedMotion = useReducedMotion();

  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [headerMapState, setHeaderMapState] = useState<Record<string, string>>(
    {}
  );
  const [mappedHeaders, setMappedHeaders] = useState<string[]>([]);

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(
    null
  );
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2500);
  };

  const [previewOpen, setPreviewOpen] = useState(false);

  const [delimiter, setDelimiter] = useState<string>("auto");
  const [headerRow, setHeaderRow] = useState(true);

  const [afsHaircut, setAfsHaircut] = useState<number>(0.1);
  const [depositRunoff, setDepositRunoff] = useState<number>(0.15);
  const [betaCore, setBetaCore] = useState<number>(0.3);
  const [betaNoncore, setBetaNoncore] = useState<number>(0.6);
  const [shocks, setShocks] = useState<number[]>([-200, -100, 0, 100, 200]);

  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const schemaBtnRef = useRef<HTMLButtonElement | null>(null);
  const previewBtnRef = useRef<HTMLButtonElement | null>(null);

  const [rawCsv, setRawCsv] = useState<string>("");

  const [equity, setEquity] = useState<number>(0);
  const [results, setResults] = useState<ScenarioOut[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string>("");

  const [sortCol, setSortCol] = useState<TableColKey>("shock_bps");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [showSchema, setShowSchema] = useState(true);

  const [parsing, setParsing] = useState(false);
  const parseStartRef = useRef<number | null>(null);
  const [parseMs, setParseMs] = useState<number | null>(null);
  const firstRenderStartRef = useRef<number | null>(null);
  const [firstRenderMs, setFirstRenderMs] = useState<number | null>(null);



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
    } catch { }
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
    } catch { }
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

  function parseFile(f: File) {
    setError("");
    setValidationErrors([]);
    setHeaderMapState({});
    setMappedHeaders([]);
    setParsing(true);
    parseStartRef.current = performance.now();

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
          const end = performance.now();
          setParseMs(end - (parseStartRef.current || end));
          if (import.meta?.env?.DEV) {
            console.log("[perf] parse ms:", end - (parseStartRef.current || end));
          }

          if (res.errors && res.errors.length) {
            const msg = `Parse error on row ${res.errors[0].row}: ${res.errors[0].message}`;
            setError(msg);
            showToast("err", t("parseErr"));
            setRows([]);
            setHeaders([]);
            setParsing(false);
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

          showToast("ok", t("csvLoaded"));
          setParsing(false);
          firstRenderStartRef.current = performance.now();
        },
        error: (err) => {
          setError(err.message || "Unknown error while parsing CSV.");
          showToast("err", t("parseErr"));
          setParsing(false);
        },
      });
    };
    reader.onerror = () => {
      showToast("err", t("parseErr"));
      setParsing(false);
    };
    reader.readAsText(f);
  }

  function validateAndParse(f?: File) {
    if (!f) return;
    const sizeMb = f.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_MB) {
      showToast("err", t("dropHere", { mb: MAX_FILE_MB }));
      return;
    }
    if (!/\.csv$/i.test(f.name)) {
      showToast("err", "Invalid file (expected .csv)");
      return;
    }
    parseFile(f);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    validateAndParse(e.target.files?.[0]);
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(true);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const f = e.dataTransfer.files?.[0]; validateAndParse(f);
  }

  useEffect(() => {
    const prevent = (ev: DragEvent) => { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const [previewQuery, setPreviewQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [compactRows, setCompactRows] = useState(false);
  const [pageSize, setPageSize] = useState(200);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const tmr = window.setTimeout(
      () => setDebouncedQuery(previewQuery.trim().toLowerCase()),
      300
    );
    return () => window.clearTimeout(tmr);
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
  useEffect(() => { setPage(1); }, [debouncedQuery, rows, pageSize]);

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return previewRowsFiltered.slice(start, start + pageSize);
  }, [previewRowsFiltered, page, pageSize]);

  useEffect(() => {
    if (firstRenderStartRef.current != null && rows.length) {
      const ms = performance.now() - firstRenderStartRef.current;
      setFirstRenderMs(ms);
      if (import.meta?.env?.DEV) console.log("[perf] initial preview render ms:", ms);
      firstRenderStartRef.current = null;
    }
  }, [rows, debouncedQuery, pageSize]);

  async function runStressTest() {
    setApiError("");
    setResults([]);
    if (!rawCsv) {
      setApiError(t("needCsv"));
      showToast("err", t("needCsv"));
      return;
    }
    if (validationErrors.length) {
      setApiError(t("fixValidation"));
      showToast("err", t("fixValidation"));
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
      showToast("ok", t("ok"));
    } catch (e: any) {
      setApiError(e?.message || "Request failed.");
      showToast("err", t("apiRunErr"));
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
    showToast("ok", t("csvExported"));
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
    showToast("ok", t("jsonExported"));
  }

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
      () => showToast("ok", t("copyOk")),
      () => showToast("err", t("copyErr"))
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

  const [schemaOpen, setSchemaOpen] = useState(false);

  const groupedIssues = groupErrors(validationErrors);
  const groupedByRow = useMemo(
    () => groupErrorsByRow(validationErrors),
    [validationErrors]
  );

  const SortHeader = ({
    col,
    label,
  }: {
    col: TableColKey; label: string;
  }) => {
    const active = sortCol === col;
    const dir = active ? sortDir : undefined;
    const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
    return (
      <th className="text-left px-3 py-2 border-b border-white/10">
        <button
          className={`inline-flex items-center gap-1 text-sm hover:opacity-90 ${active ? "text-white" : "text-white/85"}`}
          aria-sort={ariaSort as any}
          onClick={() => {
            if (active) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else { setSortCol(col); setSortDir(col === "shock_bps" ? "asc" : "desc"); }
          }}
          title="Sort"
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
    <div className="rounded-xl border border-white/15 bg-white/[0.06] backdrop-blur p-4">
      <div className="text-xs text-white/80 flex items-center">
        {label}
        {hint ? kpiHintIcon(hint) : null}
      </div>
      <div
        className="mt-1 font-semibold leading-[1.1] text-[clamp(20px,3.6vw,32px)] whitespace-nowrap overflow-hidden text-ellipsis"
        title={value}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-[12px] text-white/70">{sub}</div> : null}
    </div>
  );

  const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`${!reducedMotion ? "animate-pulse" : ""} rounded-lg bg-white/10 ${className}`} />
  );

  return (
    <AnimatedPageWrapper>
      <UiTooltipProvider delayDuration={120}>
        <div className="min-h-screen">
          <div className="container max-w-6xl py-8 space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between gap-3">
              <Link to="/" className="text-[32px] leading-[36px] font-semibold tracking-tight hover:opacity-90">
                {t("appTitle")}
              </Link>

              <div className="flex items-center gap-2">
                <div
                  role="group"
                  aria-label={t("lang")}
                  className="inline-flex rounded-xl border border-white/10 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setLang("pt")}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1 ${lang === "pt" ? "bg-white/20" : "bg-white/5"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60`}
                    aria-pressed={lang === "pt"}
                    title={t("lang")}
                  >
                    <Languages className="h-3.5 w-3.5" /> PT
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1 ${lang === "en" ? "bg-white/20" : "bg-white/5"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60`}
                    aria-pressed={lang === "en"}
                    title={t("lang")}
                  >
                    <Languages className="h-3.5 w-3.5" /> EN
                  </button>
                </div>

                <Badge variant="secondary" className="text-xs" aria-label="App version">
                  {t("version")}
                </Badge>
              </div>
            </header>

            {/* Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Sidebar */}
              <aside className="lg:col-span-4">
                <div className="lg:sticky lg:top-6 space-y-6">
                  <Card className={PANEL} aria-labelledby="data-params-title">
                    <CardHeader>
                      <CardTitle id="data-params-title" className="text-[20px] leading-[24px]">
                        {t("dataParams")}
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
                        aria-label={t("dropHere", { mb: MAX_FILE_MB })}
                        className={`rounded-xl border p-3 transition ${dragActive ? "border-sky-400 bg-sky-400/10" : "border-white/10 bg-white/5"}`}
                        data-testid="upload-zone"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <div className="font-medium">{t("csvFile")}</div>
                            <div className="text-xs text-white/70">
                              {t("dropHere", { mb: MAX_FILE_MB })}
                            </div>
                            {parseMs != null && (
                              <div className="text-xs text-white/60 mt-1">
                                Parse: {Math.round(parseMs)} ms
                                {firstRenderMs != null ? ` · 1st render: ${Math.round(firstRenderMs)} ms` : ""}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 w-full">
                            <Button
                              variant="secondary"
                              className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                              onClick={() => inputRef.current?.click()}
                              aria-label={t("chooseFile")}
                              data-testid="choose-file-btn"
                            >
                              <Upload className="h-4 w-4 mr-1.5" />
                              {t("chooseFile")}
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
                          aria-label={t("chooseFile")}
                          data-testid="file-input"
                        />
                      </div>

                      {/* Delimiter + checkbox */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-xs mb-1 opacity-80">{t("delimiter")}</label>
                          <div className="relative">
                            <select
                              value={delimiter}
                              onChange={(e) => setDelimiter(e.target.value)}
                              className={SELECT_FIELD}
                              aria-label={t("delimiter")}
                              data-testid="delimiter-select"
                            >
                              <option value="auto">{t("autoDetect")}</option>
                              <option value=",">{t("comma")}</option>
                              <option value=";">{t("semicolon")}</option>
                              <option value="\t">{t("tab")}</option>
                              <option value="|">{t("pipe")}</option>
                            </select>
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70">
                              <path fill="currentColor" d="M5.5 7.5L10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        <label className="mt-6 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={headerRow}
                            onChange={(e) => setHeaderRow(e.target.checked)}
                            className={CHECKBOX}
                            aria-label={t("headerRow")}
                            data-testid="headers-checkbox"
                          />
                          {t("headerRow")}
                        </label>
                      </div>

                      {/* Parameters */}
                      <label className="text-sm block">
                        {t("afsHaircut")}
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={0.5}
                          value={afsHaircut}
                          onChange={(e) => setAfsHaircut(Number(e.target.value))}
                          className={FIELD_NUMBER}
                          aria-label={t("afsHaircut")}
                        />
                      </label>

                      <label className="text-sm block">
                        {t("depositRunoff")}
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={1}
                          value={depositRunoff}
                          onChange={(e) => setDepositRunoff(Number(e.target.value))}
                          className={FIELD_NUMBER}
                          aria-label={t("depositRunoff")}
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-sm block">
                          {t("betaCore")}
                          <input
                            type="number"
                            step="0.05"
                            min={0}
                            max={1}
                            value={betaCore}
                            onChange={(e) => setBetaCore(Number(e.target.value))}
                            className={FIELD_NUMBER}
                            aria-label={t("betaCore")}
                          />
                        </label>
                        <label className="text-sm block">
                          {t("betaNoncore")}
                          <input
                            type="number"
                            step="0.05"
                            min={0}
                            max={1}
                            value={betaNoncore}
                            onChange={(e) => setBetaNoncore(Number(e.target.value))}
                            className={FIELD_NUMBER}
                            aria-label={t("betaNoncore")}
                          />
                        </label>
                      </div>

                      <label className="text-sm block">
                        {t("shocks")}
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
                          aria-label={t("shocks")}
                        />
                      </label>

                      <div className="grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            ref={previewBtnRef}
                            variant="secondary"
                            className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                            onClick={() => setPreviewOpen(true)}
                            disabled={(headers.length === 0 && rows.length === 0) || parsing}
                            title={headers.length === 0 && rows.length === 0 ? t("needCsv") : t("previewCsv")}
                            aria-haspopup="dialog"
                            aria-controls="preview-dialog"
                            data-testid="preview-btn"
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            {t("previewCsv")}
                          </Button>
                          <Button
                            ref={schemaBtnRef}
                            variant="secondary"
                            className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                            onClick={() => setSchemaOpen(true)}
                            aria-haspopup="dialog"
                            data-testid="schema-btn"
                          >
                            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                            {t("viewSchema")}
                          </Button>
                        </div>

                        <Button onClick={runStressTest} disabled={loading} className="w-full" data-testid="run-btn">
                          {loading ? (
                            <span className="inline-flex items-center gap-2" aria-busy="true">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t("running")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <Play className="h-4 w-4" />
                              {t("run")}
                            </span>
                          )}
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="secondary"
                            className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                            onClick={exportResultsCsv}
                            disabled={results.length === 0}
                            title={results.length === 0 ? t("run") : t("exportCsv")}
                            data-testid="export-csv-btn"
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            {t("exportCsv")}
                          </Button>
                          <Button
                            variant="secondary"
                            className="w-full bg-white/10 hover:bg-white/15 border border-white/10"
                            onClick={exportResultsJson}
                            disabled={results.length === 0}
                            title={results.length === 0 ? t("run") : t("exportJson")}
                            data-testid="export-json-btn"
                          >
                            <FileJson className="h-4 w-4 mr-1.5" />
                            {t("exportJson")}
                          </Button>
                        </div>
                      </div>

                      {parsing && (
                        <div className="space-y-2" aria-busy="true">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-1/3" />
                          <Skeleton className="h-10 w-full" />
                        </div>
                      )}

                      {(apiError || error) && (
                        <div
                          className="rounded-lg border border-red-500/40 bg-red-500/20 p-3 text-xs text-red-100 flex items-start gap-2"
                          role="alert"
                          data-testid="error-box"
                        >
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{apiError || error}</span>
                        </div>
                      )}

                      {validationErrors.length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/15 p-3 text-xs text-amber-100 space-y-2 max-h-48 overflow-auto" data-testid="validation-box">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {t("validationIssues", { n: validationErrors.length })}
                            </div>
                            <Button
                              variant="secondary"
                              className="h-7 px-2 bg-white/10 hover:bg-white/15 border border-white/10"
                              onClick={downloadErrorsTxt}
                              data-testid="download-errors-btn"
                            >
                              <FileDown className="h-4 w-4 mr-1" />
                              {t("downloadTxt")}
                            </Button>
                          </div>
                          {groupedIssues.map((g) => (
                            <div key={g.field}>
                              <div className="opacity-90">{g.field} — {g.count}</div>
                              {g.samples.map((s, i) => (<div key={i}>• {s}</div>))}
                            </div>
                          ))}
                          {groupedByRow.length > 0 && (
                            <div className="mt-2">
                              <div className="opacity-90">{t("topRows")}</div>
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
                {rows.length === 0 && results.length === 0 && !error && !parsing && (
                  <Card className={PANEL} aria-label={t("emptyStateCard")}>
                    <CardContent className="py-10 text-center space-y-3">
                      <h2 className="text-[24px] leading-[28px] font-semibold">{t("emptyTitle")}</h2>
                      <p className="text-white/80 text-sm">{t("emptySub")}</p>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="secondary" onClick={() => inputRef.current?.click()} data-testid="choose-file-cta">
                          <Upload className="h-4 w-4 mr-1.5" />
                          {t("chooseFileCta")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {parsing && (
                  <Card className={PANEL} aria-label="Parsing skeleton">
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-40 w-full" />
                      <div className="grid grid-cols-3 gap-3">
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-20" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Schema card */}
                {showSchema && (headers.length > 0 || mappedHeaders.length > 0) && !parsing && (
                  <Card className={PANEL}>
                    <CardHeader>
                      <CardTitle className="text-[20px] leading-[24px]">{t("schema")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-1 rounded-full border group relative cursor-default ${requiredMissing.length === 0
                            ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60"
                            : "bg-red-500/20 text-red-200 border-red-500/60"}`}
                          title="Required columns status"
                        >
                          {t("requiredStatus", {
                            ok: REQUIRED_COLS.length - requiredMissing.length,
                            total: REQUIRED_COLS.length,
                          })}
                        </span>

                        <span
                          className="px-2 py-1 rounded-full border bg-white/10 text-white/90 border-white/20"
                          title="Optional columns status"
                        >
                          {t("optionalStatus", {
                            ok: OPTIONAL_COLS.length - optionalMissing.length,
                            total: OPTIONAL_COLS.length,
                          })}
                        </span>
                      </div>

                      {requiredMissing.length > 0 && (
                        <p className="text-xs text-red-300">
                          {t("missingRequired", { cols: requiredMissing.join(", ") })}
                        </p>
                      )}

                      {Object.keys(headerMapState).length > 0 && (
                        <div className="text-xs text-white/80">
                          <div className="font-medium mb-1">{t("autoMap")}</div>
                          <ul className="list-disc ml-5 space-y-0.5">
                            {Object.entries(headerMapState).map(([orig, exp]) => (
                              <li key={orig}>
                                <span className="text-white">{orig}</span> →{" "}
                                <span className="text-emerald-300">{exp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Results */}
                {(results.length > 0 || loading) && (
                  <Card className={PANEL}>
                    <CardHeader>
                      <CardTitle className="text-[24px] leading-[28px]">{t("results")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {loading ? (
                        <>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Skeleton className="h-24" />
                            <Skeleton className="h-24" />
                            <Skeleton className="h-24" />
                          </div>
                          <Skeleton className="h-72 w-full" />
                          <Skeleton className="h-72 w-full" />
                          <Skeleton className="h-80 w-full" />
                        </>
                      ) : (
                        <>
                          {/* KPIs */}
                          <div className="grid gap-4 sm:grid-cols-3">
                            {kpiBox(t("equity"), fmtMoneyCompact(equity), t("equityHint"), t("equitySub"))}
                            {kpiBox(
                              t("bestEve"),
                              (() => {
                                const best = Math.max(...results.map((r) => r.eve_pct_equity * 100));
                                return fmtSignedPct(best, 1);
                              })(),
                              t("eveHint"),
                              t("bestAmong")
                            )}
                            {kpiBox(
                              t("worstEve"),
                              (() => {
                                const worst = Math.min(...results.map((r) => r.eve_pct_equity * 100));
                                return fmtSignedPct(worst, 1);
                              })(),
                              t("eveHint"),
                              t("worstAmong")
                            )}
                          </div>

                          {/* ΔEVE / Equity */}
                          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-sm text-white/80">{t("eveVsShock")}</div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-white/10 hover:bg-white/15 border border-white/10"
                                onClick={() => exportChartPng("chart-eve", "eve_vs_shock.png")}
                                data-testid="export-eve-png"
                              >
                                <ImageDown className="h-4 w-4 mr-1" />
                                {t("exportPng")}
                              </Button>
                            </div>
                            <div id="chart-eve">
                              <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={sortedResultsForCharts}>
                                  <CartesianGrid stroke="rgba(255,255,255,0.18)" />
                                  <XAxis dataKey="shock_bps" tick={{ fontSize: 12, fill: "#E5E7EB" }} stroke="#6B7280" tickMargin={8} />
                                  <YAxis
                                    tickFormatter={(v) => fmtPct((Number(v) || 0) * 100)}
                                    tick={{ fontSize: 12, fill: "#E5E7EB" }}
                                    stroke="#6B7280"
                                    tickMargin={8}
                                  />
                                  <RechartTooltip
                                    formatter={(val: any, name: any) => {
                                      if (name === "ΔEVE/Equity") return fmtSignedPct((val as number) * 100, 1);
                                      return val;
                                    }}
                                    labelFormatter={(l) => `Shock: ${l} bps`}
                                    cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 1 }}
                                    contentStyle={{
                                      background: "rgba(10,10,10,0.9)",
                                      border: "1px solid rgba(255,255,255,0.25)",
                                      borderRadius: 12,
                                      color: "#F3F4F6",
                                    }}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="eve_pct_equity"
                                    name="ΔEVE/Equity"
                                    fill="rgba(96,165,250,0.35)"
                                    stroke="#93C5FD"
                                    strokeWidth={2.4}
                                    isAnimationActive={!reducedMotion}
                                    activeDot
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* ΔNII (12m) */}
                          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-sm text-white/80">{t("niiVsShock")}</div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-white/10 hover:bg-white/15 border border-white/10"
                                onClick={() => exportChartPng("chart-nii", "nii_vs_shock.png")}
                                data-testid="export-nii-png"
                              >
                                <ImageDown className="h-4 w-4 mr-1" />
                                {t("exportPng")}
                              </Button>
                            </div>
                            <div id="chart-nii">
                              <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={sortedResultsForCharts}>
                                  <CartesianGrid stroke="rgba(255,255,255,0.16)" />
                                  <XAxis dataKey="shock_bps" tick={{ fontSize: 12, fill: "#E5E7EB" }} stroke="#6B7280" tickMargin={8} />
                                  <YAxis
                                    width={88}                           // ← mais espaço para os ticks
                                    tickFormatter={(v) => fmtMoneyCompact(Number(v))}
                                    tick={{ fontSize: 12, fill: "#E5E7EB" }}
                                    stroke="#6B7280"
                                    tickMargin={8}
                                  />
                                  <RechartTooltip
                                    formatter={(val: any, name: any) =>
                                      name === "ΔNII (12m)" ? fmtSignedMoney(Number(val)) : val
                                    }
                                    labelFormatter={(l) => `Shock: ${l} bps`}
                                    contentStyle={{
                                      background: "rgba(10,10,10,0.9)",
                                      border: "1px solid rgba(255,255,255,0.25)",
                                      borderRadius: 12,
                                      color: "#F3F4F6",
                                    }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="nii_delta"
                                    name="ΔNII (12m)"
                                    stroke="#34D399"
                                    strokeWidth={2.4}
                                    dot={{ r: 2 }}
                                    isAnimationActive={!reducedMotion}
                                    activeDot
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* LCR */}
                          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-sm text-white/80">{t("lcrTitle")}</div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-white/10 hover:bg-white/15 border border-white/10"
                                onClick={() => exportChartPng("chart-lcr", "lcr_vs_shock.png")}
                                data-testid="export-lcr-png"
                              >
                                <ImageDown className="h-4 w-4 mr-1" />
                                {t("exportPng")}
                              </Button>
                            </div>
                            <div id="chart-lcr">
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={sortedResultsForCharts} barCategoryGap={24} margin={{ top: 8, right: 28, left: 28, bottom: 8 }}>
                                  <CartesianGrid stroke="rgba(255,255,255,0.16)" />
                                  <XAxis dataKey="shock_bps" tick={{ fontSize: 12, fill: "#E5E7EB" }} stroke="#6B7280" tickMargin={8} />
                                  <YAxis yAxisId="left" width={88} tickFormatter={fmtMoney} tick={{ fontSize: 12, fill: "#E5E7EB" }} stroke="#6B7280" tickMargin={8} />
                                  <YAxis
                                    yAxisId="right"
                                    width={56}
                                    orientation="right"
                                    tickFormatter={(v) => fmtX(Number(v))}
                                    tick={{ fontSize: 12, fill: "#E5E7EB" }}
                                    stroke="#6B7280"
                                    tickMargin={8}
                                    domain={[0, (dataMax: number) => Math.max(1.2, dataMax * 1.1)]}
                                  />
                                  <RechartTooltip
                                    cursor={false}
                                    contentStyle={{
                                      background: "rgba(10,10,10,0.9)",
                                      border: "1px solid rgba(255,255,255,0.25)",
                                      borderRadius: 12,
                                      color: "#F3F4F6",
                                    }}
                                    formatter={(val: any, _name: any, props: any) => {
                                      const key = (props?.dataKey as string) || "";
                                      if (key === "lcr_hqla" || key === "lcr_outflows") return fmtSignedMoney(Number(val));
                                      if (key === "lcr_coverage") return signed(fmtX(Number(val)));
                                      return val;
                                    }}
                                    labelFormatter={(l) => `Shock: ${l} bps`}
                                  />
                                  <Legend wrapperStyle={{ color: "#E5E7EB" }} />

                                  <Bar yAxisId="left" dataKey="lcr_hqla" name="HQLA" fill="rgba(52,211,153,0.55)" stroke="#10B981" barSize={18} radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                                  <Bar yAxisId="left" dataKey="lcr_outflows" name="Outflows" fill="rgba(248,113,113,0.55)" stroke="#EF4444" barSize={18} radius={[6, 6, 0, 0]} isAnimationActive={!reducedMotion} />
                                  <Line yAxisId="right" type="monotone" dataKey="lcr_coverage" name="Coverage (×)" stroke="#93C5FD" strokeWidth={2.4} dot={{ r: 2 }} isAnimationActive={!reducedMotion} activeDot />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* Table */}
                          <div className="overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur">
                            <table className="min-w-full text-sm">
                              <thead className="sticky top-0 bg-white/5 backdrop-blur z-10">
                                <tr>
                                  <SortHeader col="shock_bps" label={t("tableShock")} />
                                  <SortHeader col="eve_change" label={t("tableEve")} />
                                  <SortHeader col="eve_pct_equity" label={t("tableEveEq")} />
                                  <SortHeader col="nii_delta" label={t("tableNii")} />
                                  <SortHeader col="lcr_hqla" label={t("tableHqla")} />
                                  <SortHeader col="lcr_outflows" label={t("tableOut")} />
                                  <SortHeader col="lcr_coverage" label={t("tableCov")} />
                                </tr>
                              </thead>
                              <tbody>
                                {tableSortedResults.map((r) => (
                                  <tr key={r.shock_bps} className="even:bg-white/[0.03]">
                                    <td className="px-3 py-2 border-b border-white/10">{r.shock_bps}</td>
                                    <td className={`px-3 py-2 border-b border-white/10 ${r.eve_change >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {fmtSignedMoney(r.eve_change)}
                                    </td>
                                    <td className={`px-3 py-2 border-b border-white/10 ${r.eve_pct_equity >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {fmtSignedPct(r.eve_pct_equity * 100)}
                                    </td>
                                    <td className={`px-3 py-2 border-b border-white/10 ${r.nii_delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {fmtSignedMoney(r.nii_delta)}
                                    </td>
                                    <td className="px-3 py-2 border-b border-white/10">{fmtSignedMoney(r.lcr_hqla)}</td>
                                    <td className="px-3 py-2 border-b border-white/10">{fmtSignedMoney(r.lcr_outflows)}</td>
                                    <td className={`px-3 py-2 border-b border-white/10 ${r.lcr_coverage >= 1 ? "text-emerald-300" : "text-rose-300"}`}>
                                      {signed(fmtX(r.lcr_coverage))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Exportar buttons */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              variant="secondary"
                              className="bg-white/10 hover:bg-white/15 border border-white/10"
                              onClick={exportResultsCsv}
                              disabled={results.length === 0}
                              data-testid="export-csv-btn-bottom"
                            >
                              <Download className="h-4 w-4 mr-1.5" />
                              {t("exportCsv")}
                            </Button>
                            <Button
                              variant="secondary"
                              className="bg-white/10 hover:bg-white/15 border border-white/10"
                              onClick={exportResultsJson}
                              disabled={results.length === 0}
                              data-testid="export-json-btn-bottom"
                            >
                              <FileJson className="h-4 w-4 mr-1.5" />
                              {t("exportJson")}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </main>
            </div>
          </div>

          {/* Schema modal */}
          {schemaOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="schema-title">
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
                    {t("expectedSchema")}
                  </h3>
                  <Button
                    onClick={() => {
                      setSchemaOpen(false);
                      schemaBtnRef.current?.focus();
                    }}
                    variant="secondary"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
                    aria-label={t("close")}
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    {t("close")}
                  </Button>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-white/80 mb-1">{t("required")}</div>
                    <div className="flex flex-wrap gap-2">
                      {REQUIRED_COLS.map((c) => (
                        <span
                          key={c}
                          className={`rounded-full border px-2 py-1 text-[11px] ${headers.includes(c) || mappedHeaders.includes(c)
                            ? "bg-emerald-500/25 text-emerald-200 border-emerald-600"
                            : "bg-red-500/25 text-red-200 border-red-600"}`}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/80 mb-1">{t("optional")}</div>
                    <div className="flex flex-wrap gap-2">
                      {OPTIONAL_COLS.map((c) => (
                        <span
                          key={c}
                          className={`rounded-full border px-2 py-1 text-[11px] ${headers.includes(c) || mappedHeaders.includes(c)
                            ? "bg-white/10 text-white/90 border-white/20"
                            : "bg-black/20 text-white/60 border-white/10"}`}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-white/70">Tip: {t("sampleCsv")}</div>
                </div>
              </SchemaModalContent>
            </div>
          )}

          {/* Preview csv modal */}
          {previewOpen && (
            <div id="preview-dialog" className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="preview-title">
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
                    {t("previewDialog", { f: previewRowsFiltered.length, t: rows.length })}
                  </h3>

                  {/* barra */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70" />
                      <input
                        id="preview-search"
                        type="text"
                        placeholder={t("search")}
                        value={previewQuery}
                        onChange={(e) => setPreviewQuery(e.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-sm placeholder-white/50 focus:outline-none focus:border-white/20"
                        aria-label={t("search")}
                        data-testid="preview-search"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={compactRows}
                        onChange={(e) => setCompactRows(e.target.checked)}
                        className={CHECKBOX}
                        aria-label={t("compact")}
                        data-testid="compact-checkbox"
                      />
                      {t("compact")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      {t("pageSize")}
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm focus:outline-none"
                        aria-label={t("pageSize")}
                        data-testid="page-size-select"
                      >
                        {[100, 200, 500, 1000].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant="secondary"
                      onClick={copyPreviewCsv}
                      className="h-9 bg-white/10 hover:bg-white/15 border border-white/10"
                      data-testid="copy-page-btn"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      {t("copyPage")}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={downloadPreviewCsv}
                      className="h-9 bg-white/10 hover:bg-white/15 border border-white/10"
                      data-testid="download-filtered-btn"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      {t("downloadFiltered")}
                    </Button>
                    <Button
                      onClick={() => {
                        setPreviewOpen(false);
                        previewBtnRef.current?.focus();
                      }}
                      aria-label={t("close")}
                      data-testid="close-preview-btn"
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      {t("close")}
                    </Button>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex flex-wrap items-center justify-between mb-2 text-xs text-white/80 gap-2">
                  <div>
                    {t("pageOf", {
                      p: page,
                      tp: totalPages,
                      n: pageSlice.length,
                      nf: previewRowsFiltered.length,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      title={t("first")}
                      data-testid="first-page-btn"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      title={t("prev")}
                      data-testid="prev-page-btn"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-xs text-white/80" data-testid="page-indicator" aria-live="polite">
                      {page} / {totalPages}
                    </div>
                    <Button
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      title={t("next")}
                      data-testid="next-page-btn"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1 h-8"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      title={t("last")}
                      data-testid="last-page-btn"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                    <label className="flex items-center gap-1">
                      {t("goto")}
                      <input
                        id="goto-input"
                        type="number"
                        min={1}
                        max={totalPages}
                        className="h-8 w-20 rounded-md border border-white/10 bg-white/5 px-2 text-xs"
                        aria-label={t("gotoPage")}
                        data-testid="goto-input"
                      />
                    </label>
                    <Button
                      variant="secondary"
                      className="h-8 bg-white/10 hover:bg-white/15 border border-white/10"
                      onClick={() => {
                        const el = document.getElementById("goto-input") as HTMLInputElement | null;
                        const v = Number(el?.value || "");
                        if (!Number.isNaN(v)) setPage(Math.min(Math.max(1, v), totalPages));
                      }}
                      data-testid="goto-btn"
                    >
                      {t("goto")}
                    </Button>
                  </div>
                </div>

                {/* Virtualized table */}
                <VirtualizedPreviewTable
                  headers={headers.length ? headers : Object.keys(pageSlice[0] || {})}
                  rows={pageSlice}
                  query={debouncedQuery}
                  compact={compactRows}
                  parsing={parsing}
                />

                {/* No results */}
                {debouncedQuery && previewRowsFiltered.length === 0 && !parsing && (
                  <div className="mt-3 text-center text-sm text-white/80" data-testid="no-results">
                    {t("noResults", { q: previewQuery })}
                  </div>
                )}
              </SchemaModalContent>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`fixed bottom-4 right-4 z-[70] rounded-xl px-3 py-2 text-sm shadow-lg backdrop-blur border
                ${toast.type === "ok" ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-100" : "bg-red-500/20 border-red-400/40 text-red-100"}`}
            >
              {toast.msg}
            </div>
          )}
        </div>
      </UiTooltipProvider>
    </AnimatedPageWrapper>
  );
}

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
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Tab") {
        const list = Array.from(getFocusables()).filter((el) => !el.hasAttribute("disabled"));
        if (!list.length) return;
        const first = list[0]; const last = list[list.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) { e.preventDefault(); last.focus(); }
        } else {
          if (active === last || !root.contains(active)) { e.preventDefault(); first.focus(); }
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

function VirtualizedPreviewTable({
  headers,
  rows,
  query,
  compact,
  parsing,
}: {
  headers: string[];
  rows: Row[];
  query: string;
  compact: boolean;
  parsing: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  const ROW_H = compact ? 28 : 36;
  const OVERSCAN = 10;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewportH(el.clientHeight);
    onResize();
    el.addEventListener("scroll", onScroll);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const total = rows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const visibleCount = Math.ceil((viewportH || 1) / ROW_H) + OVERSCAN * 2;
  const endIndex = Math.min(total, startIndex + visibleCount);
  const slice = rows.slice(startIndex, endIndex);
  const topPad = startIndex * ROW_H;
  const bottomPad = (total - endIndex) * ROW_H;

  return (
    <div
      className="max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur"
      ref={containerRef}
      data-testid="virtual-table"
    >
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white/5 backdrop-blur z-10">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 border-b border-white/10">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      </table>

      {parsing && (
        <div className="p-3 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-white/10" />
          ))}
        </div>
      )}

      {!parsing && <div style={{ height: topPad }} aria-hidden />}
      {!parsing && (
        <table className="min-w-full text-sm">
          <tbody>
            {slice.map((r, i) => (
              <tr key={startIndex + i} className="even:bg-white/[0.03]">
                {headers.map((h) => (
                  <td
                    key={h}
                    className={`px-3 ${compact ? "py-1.5" : "py-2"} border-b border-white/10`}
                    style={{ height: ROW_H }}
                  >
                    {query ? highlightMatch(String((r as any)[h] ?? ""), query) : String((r as any)[h] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!parsing && <div style={{ height: bottomPad }} aria-hidden />}
    </div>
  );
}