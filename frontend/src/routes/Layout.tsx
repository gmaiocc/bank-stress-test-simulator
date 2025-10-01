import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <Outlet />
    </main>
  );
}