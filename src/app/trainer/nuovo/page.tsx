import { permanentRedirect } from "next/navigation";

/**
 * `/trainer/nuovo` — alias di `/trainer/questionario`.
 *
 * La rotta canonica e' quella del design system (§6.1). Questo alias esiste perche' il
 * nome «nuovo» e' quello che si digita d'istinto, ed e' anche quello con cui la
 * funzione e' stata chiesta: un indirizzo che qualcuno si aspetta e che risponde 404
 * e' un difetto, non una preferenza di nomenclatura.
 */
export default function TrainerNuovoPage(): never {
  permanentRedirect("/trainer/questionario");
}
