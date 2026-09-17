import type { ReactNode } from "react";
import { PublicChrome } from "@/components/nav/PublicChrome";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicChrome>{children}</PublicChrome>;
}
