import { cn } from "@/lib/utils";

/**
 * Skeleton — §4.14: sotto 1s nessun indicatore, sopra 1s uno scheletro con la stessa
 * altezza del contenuto, cosi' non c'e' salto di layout quando arriva il dato.
 * Con `prefers-reduced-motion` il luccichio sparisce e resta un blocco fermo.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-[var(--radius-md)] bg-[var(--popover)]",
        "animate-pulse motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
