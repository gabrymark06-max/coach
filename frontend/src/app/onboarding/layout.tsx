import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OnboardingGate } from "./OnboardingGate";

export const metadata: Metadata = { title: "La tua scheda", robots: { index: false, follow: false } };

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <OnboardingGate>{children}</OnboardingGate>;
}
