# Font

- `*.woff2`: Archivo e Newsreader variabili, usati da `next/font/local`. Sono istanze parziali (fontTools `varLib.instancer`) ristrette agli assi che i token usano davvero, poi sottoinsieme latin (fontTools `subset`, tutte le feature OpenType conservate, `tnum` compreso):
  - Archivo: `wght` 500–900, `wdth` 100–125 (token `--wdth-ui` 100, `--wdth-numero-riga` 110, `--wdth-numero` 125) → 62 kB (era 156 kB).
  - `Archivo-riga.woff2` (`--font-archivo-riga`, i numeri in riga: `.t-numero-riga`, `.set-input`, `.pill-rir`): istanza statica `wght` 800 · `wdth` 110, stesso sottoinsieme latin → 15 kB, senza preload. Serve a parte perché a 800/110 la faccia è l'11 % più larga della default del file variabile (xAvgCharWidth 665 vs 575): con un solo file il `size-adjust` del fallback era quello sbagliato e allo swap la riga del prezzo sulla landing si riavvolgeva (QA N3). Generata con `varLib.instancer` (`wght=800`, `wdth=110`) + `subset` con gli stessi unicode di `Archivo-var.woff2`.
  - `Newsreader-var.woff2` e `Newsreader-Italic-var.woff2` (`--font-newsreader` / `--font-newsreader-italic`, la voce): `wght` fisso a 400 (l'unico peso usato), `opsz` 16–24 (voce a 18/19 con `font-optical-sizing: auto`) → 47 + 52 kB (erano 191 + 214 kB). Il corsivo è una famiglia a parte, senza preload: `.t-voce em` lo chiama per nome.
  - I nomi non hanno parentesi: con `Archivo[wdth,wght].woff2` il `<link rel=preload>` (URL percent-encoded) e l'`url()` del `@font-face` (grezzo) erano due URL diversi per Chrome e il file si scaricava due volte.
  - `Newsreader-nota*.woff2` (`--font-newsreader-nota`, la nota): istanza statica a `opsz` 10 e `wght` 400 → 24 + 26 kB. Serve un file a parte perché a opsz 10 la faccia è il 13 % più larga: così `next/font` calcola il `size-adjust` del fallback sulle metriche giuste e il swap non sposta il layout (QA M1).
  - Se un giorno servisse un peso o una larghezza fuori da questi intervalli, rigenerare dai `.ttf` originali.
- `*.ttf`: i file originali di Google Fonts (OFL). `Archivo-*-static.ttf` sono istanze statiche per le immagini generate con satori (OG, icone), che non legge i font variabili.
- Licenze: `OFL-Archivo.txt`, `OFL-Newsreader.txt`.
