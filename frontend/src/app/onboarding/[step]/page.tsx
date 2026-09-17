import { notFound } from "next/navigation";
import { StepForm } from "./StepForm";

export function generateStaticParams() {
  return ["1", "2", "3", "4", "5"].map((step) => ({ step }));
}

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const n = Number(step);
  if (!Number.isInteger(n) || n < 1 || n > 5) notFound();
  return <StepForm step={n} />;
}
