"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

/**
 * `/trainer` — la tab esiste, il Trainer no.
 *
 * Questa e' una **decisione dichiarata**, non un lavoro a meta': il Trainer e' il
 * secondo intervento, e una tab che rimanda a una funzione non ancora costruita ha due
 * modi di comportarsi. Il primo e' fingere — una schermata piena di promesse, un
 * pulsante che non fa niente, un «presto disponibile» che non dice quando. Il secondo
 * e' dire come stanno le cose e indicare che cosa si puo' fare **adesso**.
 *
 * Qui si fa il secondo. Niente conto alla rovescia, niente lista d'attesa, niente
 * pubblicita' di una cosa che non c'e': una frase onesta e due strade che portano da
 * qualche parte davvero.
 */
export function TrainerView() {
  return (
    <>
      <PageHeader title="Trainer" />

      <div className="app-container">
        <EmptyState
          icon={ClipboardList}
          title="Il Trainer non c'è ancora"
          line="Genererà un programma di più settimane a partire dai tuoi allenamenti, e lo farà progredire da solo. Non è ancora costruito: quando ci sarà, lo troverai qui."
          action={
            <Button block asChild>
              <Link href="/allenamento">Scegli una routine</Link>
            </Button>
          }
          secondary={
            <Button variant="ghost" block asChild>
              <Link href="/home">Torna alla home</Link>
            </Button>
          }
        />
      </div>
    </>
  );
}
