import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import { AnimatedPageWrapper } from "./AnimatedPageWrapper";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, FileSpreadsheet, BarChart3, ShieldAlert, ArrowRight, Upload, Play, CheckCircle2 } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-100">
      <Navbar />
      <AnimatedPageWrapper>
        <main className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-sm uppercase tracking-widest text-zinc-400">
            Bank Stress Test Simulator
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
            About
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-400">
            Estimate the sensitivity of a bank’s balance sheet to interest-rate shocks from a CSV of
            assets & liabilities. Get ΔEVE, ΔNII (12m) and a simple liquidity block (HQLA, outflows, coverage).
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <BadgeCard icon={<FileSpreadsheet className="h-4 w-4" />} label="CSV in, results out" />
            <BadgeCard icon={<BarChart3 className="h-4 w-4" />} label="KPIs, charts & table" />
            <BadgeCard icon={<CheckCircle2 className="h-4 w-4" />} label="Validation & report" />
          </div>

          <Card className="mt-10 border-zinc-800 bg-zinc-950/60">
            <CardHeader>
              <CardTitle className="text-xl">How it works (high level)</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-zinc-300">
                <Step icon={<Upload className="h-5 w-5" />} text="CSV parsing with delimiter detection and auto mapping." />
                <Step icon={<CheckCircle2 className="h-5 w-5" />} text="Validation (zod) + exportable error report." />
                <Step icon={<Activity className="h-5 w-5" />} text={<>Send CSV + params to <code>/stress</code> API.</>} />
                <Step icon={<BarChart3 className="h-5 w-5" />} text="KPIs, charts, sortable table; export CSV/JSON/PNG." />
              </ol>
            </CardContent>
          </Card>

          <Card className="mt-6 border-amber-500/30 bg-amber-500/10">
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-300 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-amber-100">Limitations & Disclaimer</h3>
                  <ul className="mt-1 list-disc ml-5 text-sm text-amber-100/90 space-y-1">
                    <li>Simplified model — not a substitute for ALM/regulatory reporting.</li>
                    <li>Results depend on CSV quality and assumptions.</li>
                    <li>For demonstration/educational purposes only.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app">
              <Button size="lg" variant="default" className="rounded-2xl">
                Open Demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/try">
              <Button size="lg" variant="secondary" className="rounded-2xl">
                Try it <Play className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </main>
      </AnimatedPageWrapper>
    </div>
  );
}

function BadgeCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/10">{icon}</span>
      <span className="text-sm text-zinc-300">{label}</span>
    </div>
  );
}
function Step({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 border border-white/10">
        {icon}
      </span>
      <p className="text-sm leading-6 text-zinc-300">{text}</p>
    </li>
  );
}