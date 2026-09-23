import type { Metadata } from "next";
import { TrainerView } from "./trainer-view";

export const metadata: Metadata = {
  title: "Trainer",
  description: "Il programma generato e progressivo. In arrivo.",
};

export default function TrainerPage() {
  return <TrainerView />;
}
