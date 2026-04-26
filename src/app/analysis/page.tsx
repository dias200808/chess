import { Suspense } from "react";
import { AnalysisClient } from "@/components/analysis-client";

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="rounded-3xl border bg-card p-8">Loading analysis...</div>}>
      <AnalysisClient />
    </Suspense>
  );
}
