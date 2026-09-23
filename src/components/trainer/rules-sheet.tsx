"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PROGRESSION_RULES, PROGRESSION_RULE_ORDER } from "@/lib/trainer/rules";

/**
 * «Come funziona la progressione» — le nove regole, con nome, condizione ed effetto.
 *
 * Legge la **stessa tabella** che decide i carichi (`PROGRESSION_RULES`): non c'e' un
 * testo di spiegazione scritto a parte che puo' invecchiare mentre il motore cambia.
 * Se un giorno una regola cambia effetto, questa schermata lo dice da sola.
 */
export function RulesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Come funziona la progressione"
        description="Nove regole, sempre le stesse. Ogni carico che ti propongo viene da una di queste, e te lo dico ogni volta."
      >
        <ul className="flex flex-col gap-5">
          {PROGRESSION_RULE_ORDER.map((rule) => (
            <li key={rule}>
              <h3 className="text-h3 text-[var(--text-primary)]">
                {PROGRESSION_RULES[rule].name}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {PROGRESSION_RULES[rule].when}
              </p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">
                {PROGRESSION_RULES[rule].effect}
              </p>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
