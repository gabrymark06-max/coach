import { SettingsShell, SettingsTwoPane } from "@/components/settings/settings-two-pane";

/**
 * Le impostazioni: **indice + pannello** (§4.28).
 *
 * Il `<main id="contenuto">` sta in `SettingsShell` e il titolo della sezione ci sta
 * dentro — chiude QA MINORE 6, dove l'intestazione viveva fuori dal landmark e axe
 * segnalava `region` su tutte e tre le rotte.
 */
export default function ImpostazioniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsShell>
      <SettingsTwoPane>{children}</SettingsTwoPane>
    </SettingsShell>
  );
}
