import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { preloadModels } from "./models.ts";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const Drive = lazy(() => import("./pages/Drive.tsx"));
const Analyze = lazy(() => import("./pages/Analyze.tsx"));

preloadModels();

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050510]" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/drive" element={<Drive />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </Suspense>
  );
}
