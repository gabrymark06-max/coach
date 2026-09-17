import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/nav/AppShell";

// Le rotte app non si indicizzano (§11.16).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
