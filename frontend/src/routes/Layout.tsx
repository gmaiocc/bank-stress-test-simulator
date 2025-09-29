import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../routes/Navbar";

export default function Layout() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <Outlet />
    </main>
  );
}