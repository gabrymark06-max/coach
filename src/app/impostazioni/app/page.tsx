import type { Metadata } from "next";
import { AppSettingsView } from "./app-settings-view";

export const metadata: Metadata = {
  title: "Aspetto e suoni · Impostazioni",
  description: "Tema, lingua, suono e vibrazione di fine recupero.",
};

export default function AppSettingsPage() {
  return <AppSettingsView />;
}
