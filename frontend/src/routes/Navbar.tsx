import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="container max-w-6xl mx-auto py-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-sm text-white/80 hover:text-white">
          Bank Stress Test Simulator
        </Link>
      </div>

      <nav className="flex items-center gap-4 text-sm">
        <Link className="text-white/80 hover:text-white" to="/about">About</Link>
        <Link className="text-white/80 hover:text-white" to="/faq">FAQ</Link>
        <Link className="text-white/80 hover:text-white" to="/try">Try it</Link>
        <Link
          className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15"
          to="/app"
        >
          Open Demo
        </Link>
      </nav>
    </header>
  );
}