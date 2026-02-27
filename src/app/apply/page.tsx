"use client";

import React, { Suspense } from "react";
import ApplyPageContent from "./ApplyPageContent";

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading form...</div>}>
      <ApplyPageContent />
    </Suspense>
  );
}
