import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-lg text-white/70 mb-8">
        Oops! This page doesn’t exist.
      </p>
      <Link
        to="/"
        className="px-4 py-2 rounded-xl bg-white text-neutral-900 font-medium hover:opacity-90"
      >
        Go back Home
      </Link>
    </main>
  );
}