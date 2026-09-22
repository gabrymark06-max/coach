import type { Metadata } from "next";
import { BackupView } from "./backup-view";

export const metadata: Metadata = {
  title: "Backup e ripristino",
  description: "Esporta lo storico e le misure in JSON o CSV, ripristina da un backup.",
};

export default function BackupPage() {
  return <BackupView />;
}
