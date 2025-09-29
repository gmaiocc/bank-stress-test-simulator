import Navbar from "./Navbar";
import { AnimatedPageWrapper } from "./AnimatedPageWrapper";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Download, Columns, Database } from "lucide-react";

type Ds = {
  key: string;
  title: string;
  rows: string;
  path: string;
  recommended_for: string;
  description: string;
  columns: string[];
};

const DATASETS: Ds[] = [
  {
    key: "small",
    title: "Small",
    rows: "~200",
    path: "/data/small.csv",
    recommended_for: "Quick sanity checks, demos",
    description:
      "Compact sample with a few loans, deposits and cash rows. Good for quick iteration and debugging.",
    columns: [
      "type", "name", "amount", "rate", "duration", "category", "fixed_float", "float_share", "repricing_bucket",
    ],
  },
  {
    key: "medium",
    title: "Medium",
    rows: "~5k",
    path: "/data/medium.csv",
    recommended_for: "Developer testing, more realistic",
    description:
      "Mid-size dataset representative of a small bank book. Use to validate performance and numeric results.",
    columns: [
      "type", "name", "amount", "rate", "duration", "category", "fixed_float", "float_share", "repricing_bucket", "deposit_beta", "stability",
    ],
  },
  {
    key: "large",
    title: "Large",
    rows: "~100k",
    path: "/data/large.csv",
    recommended_for: "Performance and stress testing",
    description:
      "Large synthetic book to test parsing, memory and UI responsiveness.",
    columns: [
      "type", "name", "amount", "rate", "duration", "category", "fixed_float", "float_share", "repricing_bucket", "deposit_beta", "stability", "convexity",
    ],
  },
];

export default function TryIt() {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-100">
      <Navbar />
      <AnimatedPageWrapper>
        <main className="mx-auto max-w-5xl px-6 py-16">
          <section className="mb-10">
            <p className="text-sm uppercase tracking-widest text-zinc-400">
              Bank Stress Test Simulator
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
              Try it
            </h1>
            <p className="mt-4 max-w-3xl text-zinc-400">
              Download one of the sample datasets and then open the demo. Files
              ship with the app under <code className="text-zinc-200">data/</code>.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DATASETS.map((d) => (
              <DatasetCard key={d.key} ds={d} />
            ))}
          </section>
        </main>
      </AnimatedPageWrapper>
    </div>
  );
}

function DatasetCard({ ds }: { ds: Ds }) {
  const [left, right] = splitColumns(ds.columns);

  return (
    <Card className="h-full border-zinc-800 bg-zinc-950/60 flex flex-col overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{ds.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col text-zinc-300">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-zinc-400">{ds.description}</p>
          <div className="shrink-0 text-right">
            <div className="text-xs text-zinc-500">Rows</div>
            <div className="font-medium">{ds.rows}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-1">
            <Database className="h-3.5 w-3.5" />
            Use: {ds.recommended_for}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-1">
            <Columns className="h-3.5 w-3.5" />
            Cols: {ds.columns.length}
          </span>
        </div>

        <div className="mt-4 text-sm">
          <strong className="text-zinc-200">Expected columns</strong>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {left.map((c) => (
              <span key={c} className="rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1">
                {c}
              </span>
            ))}
            {right.map((c) => (
              <span key={c} className="rounded border border-zinc-800 bg-zinc-900/70 px-2 py-1">
                {c}
              </span>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="mt-auto border-t border-zinc-800/80 bg-zinc-950/40 px-5 py-4">
        <a
          href={ds.path}
          download
          title={`Download ${ds.title}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium
                     bg-white text-neutral-900 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </CardFooter>
    </Card>
  );
}

function splitColumns(cols: string[]): [string[], string[]] {
  const left: string[] = [];
  const right: string[] = [];
  cols.forEach((c, i) => (i % 2 === 0 ? left : right).push(c));
  return [left, right];
}