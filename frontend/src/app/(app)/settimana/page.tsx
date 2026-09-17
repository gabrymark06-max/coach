"use client";

import { Suspense } from "react";
import { WeekScreen } from "@/components/week/WeekScreen";

export default function SettimanaPage() {
  return (
    <Suspense>
      <WeekScreen />
    </Suspense>
  );
}
