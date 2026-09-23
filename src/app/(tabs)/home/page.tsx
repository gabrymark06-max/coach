import type { Metadata } from "next";
import { HomeView } from "./home-view";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Gli ultimi allenamenti registrati, con durata, volume e record, e l'avvio in cima.",
};

export default function HomePage() {
  return <HomeView />;
}
