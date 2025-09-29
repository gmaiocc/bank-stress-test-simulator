import { Link } from "react-router-dom";
import Navbar from "./Navbar";

export default function Landing() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(1200px 800px at 50% 14%, rgba(59,130,246,0.12), transparent 70%),
            radial-gradient(1000px 700px at 22% 78%, rgba(96,165,250,0.10), transparent 75%),
            radial-gradient(900px 600px at 82% 70%, rgba(37,99,235,0.09), transparent 75%)
          `,
        }}
      />
      <div className="absolute -top-24 -right-24 h-80 w-80 bg-sky-500/10 blur-3xl rounded-full -z-10" />

      <Navbar />

      <section className="container max-w-6xl mx-auto pt-16 pb-12 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs text-white/70 border border-white/10 bg-white/5 rounded-full px-2 py-1">
            One file • Full stress view
          </span>

          <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">
            Assess rate & liquidity risk
            <span className="block text-white/70 mt-2">with a CSV and one click</span>
          </h1>

          <p className="mt-4 text-white/80 max-w-prose">
            Upload a simplified balance sheet and simulate parallel shocks.
            Get <strong>ΔEVE</strong>, <strong>ΔNII (12m)</strong> and a lightweight
            liquidity view (<strong>HQLA, outflows, coverage</strong>) with export to
            CSV/JSON/PNG.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
              PT / EN
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
              Accessible UI
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
              Exportable charts
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="px-4 py-2 rounded-xl bg-white text-neutral-900 font-medium hover:opacity-90"
              to="/app"
              aria-label="Open the interactive demo"
            >
              Open Demo
            </Link>
            <Link
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15"
              to="/try"
              aria-label="View sample datasets"
            >
              View datasets
            </Link>
            <Link
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
              to="/about"
              aria-label="Learn how it works"
            >
              How it works
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-sky-500/20 to-indigo-500/20">
            <img
              src="/gifs/gifbankstresstest.gif"
              alt="Demo preview of the Bank Stress Test Simulator"
              className="w-full h-full object-cover"
            />
          </div>
          <p className="text-xs text-white/60 mt-3">
            Tip: try the prebuilt datasets (Small / Medium / Large) to see performance and results quickly.
          </p>
        </div>
      </section>

      {/* Feature grid */}
      <section className="container max-w-6xl mx-auto pb-8">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-medium">CSV → Results</h3>
            <p className="mt-2 text-sm text-white/75">
              Auto-detect delimiter, validate schema, and send to the API. See KPIs and charts in seconds.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-medium">Clear charts</h3>
            <p className="mt-2 text-sm text-white/75">
              ΔEVE/Equity vs shock, ΔNII vs shock, and HQLA / outflows / coverage with PNG export.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-medium">Lightweight model</h3>
            <p className="mt-2 text-sm text-white/75">
              Simple duration-based EVE and float-share/beta-based NII, plus a minimal liquidity proxy.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}