import { Link } from "react-router-dom";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, HelpCircle, Download, ArrowRight } from "lucide-react";
import Navbar from "./Navbar";
import { AnimatedPageWrapper } from "./AnimatedPageWrapper";

export default function FAQ() {
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
                        FAQ & Quick Start Guide
                    </h1>
                    <p className="mt-4 max-w-3xl text-zinc-400">
                        Short answers to common questions plus a step-by-step guide to run your
                        first stress test. If you’re new, start with “How do I start?”
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link to="/app">
                            <Button size="lg" variant="default" className="rounded-2xl">
                                Open Demo <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </Link>
                        <Link to="/try">
                            <Button size="lg" variant="secondary" className="rounded-2xl">
                                View datasets
                            </Button>
                        </Link>
                        <a
                            href="https://github.com/gmaiocc/bank-stress-test-simulator"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex"
                            aria-label="Open GitHub repository"
                        >
                            <Button size="lg" variant="ghost" className="rounded-2xl">
                                GitHub <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                        </a>
                    </div>
                </section>

                <Card className="mb-10 border-zinc-800 bg-zinc-950/60">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-zinc-400" />
                            Quick Start (60 seconds)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-zinc-300">
                        <ol className="list-decimal space-y-2 pl-5">
                            <li>
                                Go to <Link to="/try" className="underline">Try it</Link> and{" "}
                                <span className="font-medium">download</span> a sample dataset
                                (Small, Medium, or Large).
                            </li>
                            <li>
                                Open the <Link to="/demo" className="underline">Demo</Link> and{" "}
                                <span className="font-medium">upload</span> the CSV (delimiter is auto-detected).
                            </li>
                            <li>
                                Review/adjust parameters (AFS haircut, deposit runoff, betas, rate shocks).
                            </li>
                            <li>
                                Click <span className="font-medium">Run stress test</span> → see ΔEVE, ΔNII (12m) and a simple liquidity block.
                            </li>
                            <li>
                                Export results as <span className="font-medium">CSV/JSON/PNG</span>.
                            </li>
                        </ol>
                    </CardContent>
                </Card>

                <Accordion type="multiple" className="space-y-3">
                    <AccordionItem value="what-is">
                        <AccordionTrigger className="text-left">
                            What is the Bank Stress Test Simulator?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            A lightweight tool to estimate a bank book’s sensitivity to interest-rate
                            shocks and provide a simple liquidity snapshot. Upload a CSV with assets
                            and liabilities, choose assumptions, and get ΔEVE, ΔNII (12m) and basic
                            HQLA/outflows/coverage metrics in seconds.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="start">
                        <AccordionTrigger className="text-left">How do I start?</AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            Download a sample CSV from <Link to="/try" className="underline">Try it</Link>,
                            upload it in the <Link to="/demo" className="underline">Demo</Link>, confirm the
                            delimiter and column mapping if prompted, set parameters, and run.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="csv-format">
                        <AccordionTrigger className="text-left">
                            What CSV format do you expect?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Header row on the first line (e.g., <code>type,name,amount,rate,...</code>).</li>
                                <li>Delimiter may be comma or semicolon (auto-detected).</li>
                                <li>Numbers should use <code>.</code> as decimal by default (comma tolerated in auto-detect).</li>
                                <li>Use the example files as the source of truth for column names.</li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="required-columns">
                        <AccordionTrigger className="text-left">
                            Which columns are required?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            Requirements depend on dataset size/purpose:
                            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                <Card className="border-zinc-800 bg-zinc-950/60">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Small (~200 rows)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-zinc-400 mb-2">Columns (9)</p>
                                        <ul className="text-sm space-y-1">
                                            <li>type, name, amount, rate</li>
                                            <li>duration, category</li>
                                            <li>fixed_float, float_share</li>
                                            <li>repricing_bucket</li>
                                        </ul>
                                        <Link to="/data/small.csv" className="mt-3 inline-flex items-center text-sm underline">
                                            <Download className="mr-2 h-4 w-4" /> Download CSV
                                        </Link>
                                    </CardContent>
                                </Card>
                                <Card className="border-zinc-800 bg-zinc-950/60">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Medium (~5k rows)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-zinc-400 mb-2">Columns (11)</p>
                                        <ul className="text-sm space-y-1">
                                            <li>All Small columns +</li>
                                            <li>deposit_beta, stability</li>
                                        </ul>
                                        <Link to="/data/medium.csv" className="mt-3 inline-flex items-center text-sm underline">
                                            <Download className="mr-2 h-4 w-4" /> Download CSV
                                        </Link>
                                    </CardContent>
                                </Card>
                                <Card className="border-zinc-800 bg-zinc-950/60">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Large (~100k rows)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-zinc-400 mb-2">Columns (12)</p>
                                        <ul className="text-sm space-y-1">
                                            <li>All Medium columns +</li>
                                            <li>convexity</li>
                                        </ul>
                                        <Link to="/data/large.csv" className="mt-3 inline-flex items-center text-sm underline">
                                            <Download className="mr-2 h-4 w-4" /> Download CSV
                                        </Link>
                                    </CardContent>
                                </Card>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="parameters">
                        <AccordionTrigger className="text-left">
                            What do the main parameters mean?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <span className="font-medium">AFS haircut</span>: percentage discount applied to available-for-sale bonds.
                                </li>
                                <li>
                                    <span className="font-medium">Deposit runoff</span>: share of deposits assumed to leave under stress (0–1).
                                </li>
                                <li>
                                    <span className="font-medium">Beta (core / non-core)</span>: sensitivity of deposit rates to market rate changes.
                                </li>
                                <li>
                                    <span className="font-medium">Shocks (bps)</span>: list of parallel rate shocks in basis points (e.g., <code>-200,-100,0,100,200</code>).
                                </li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="results">
                        <AccordionTrigger className="text-left">
                            What outputs will I get?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            <ul className="list-disc pl-5 space-y-1">
                                <li><span className="font-medium">ΔEVE</span> — Economic Value of Equity change by shock.</li>
                                <li><span className="font-medium">ΔNII (12m)</span> — projected Net Interest Income change in 12 months.</li>
                                <li><span className="font-medium">Liquidity block</span> — simple HQLA, outflows and coverage.</li>
                                <li>Charts exportable to PNG; tables exportable to CSV/JSON.</li>
                            </ul>
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="validation">
                        <AccordionTrigger className="text-left">
                            How are errors handled?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            The app validates headers, datatypes, and missing values. If something is off,
                            you’ll see a clear error list and can export the report. Fix the CSV and try again.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="reg">
                        <AccordionTrigger className="text-left">
                            Is this suitable for regulatory reporting?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            No. This is a simplified educational tool and not a replacement for ALM systems
                            or official regulatory processes. Use for demonstration/learning only.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="perf">
                        <AccordionTrigger className="text-left">
                            How big can my CSV be?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            The demo ships with a ~100k rows “Large” synthetic file to test parsing and UI responsiveness.
                            Real-world limits depend on your browser/device memory. Start with Medium and scale up.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="export">
                        <AccordionTrigger className="text-left">
                            Can I export charts and tables?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            Yes. Use the export buttons in the results panel to download PNG (charts) and CSV/JSON (tables).
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="lang">
                        <AccordionTrigger className="text-left">
                            Is there multilingual support?
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-300">
                            Yes. Toggle PT/EN on the top-right of the Demo. More languages can be added later.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <p className="mt-12 text-xs text-zinc-500">
                    Disclaimer: This simulator is for demonstration and educational purposes only. The quality of results
                    depends on the assumptions and the CSV you provide. It is not financial advice and is not intended
                    for regulatory reporting.
                </p>
            </main>
            </AnimatedPageWrapper>
        </div>
    );
}