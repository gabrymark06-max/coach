import { permanentRedirect } from "next/navigation";

/**
 * `/impostazioni/backup` si e' rinominata in `/impostazioni/dati` (§6.1), e **mantiene
 * un redirect permanente**: la microcopy di §5.1 e le pagine di informazioni puntano
 * ancora li', e un link interno che finisce su un 404 e' un difetto, non una rinomina.
 */
export default function BackupRedirect() {
  permanentRedirect("/impostazioni/dati");
}
