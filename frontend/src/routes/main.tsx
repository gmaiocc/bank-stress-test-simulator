import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Layout from "./Layout";
import Landing from "./Landing";
import About from "./About";
import TryIt from "./TryIt";
import AppDemo from "../App";
import FAQ from "./FAQ";
import NotFound from "./NotFound";
import ErrorBoundary from "./ErrorBoundary";
import "../index.css";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="about" element={<About />} />
          <Route path="try" element={<TryIt />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="app" element={<AppDemo />} />
          <Route path="*" element={<NotFound />} /> 
        </Route>
      </Routes>
    </AnimatePresence>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary> 
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);