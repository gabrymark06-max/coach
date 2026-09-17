import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "fitcoach — una scheda che dice perché";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG: il logotipo SENZA nota (design §8), Archivo self-hosted. Colori: i token di tokens.css (carta/inchiostro/evidenziatore).
export default async function Image() {
  const archivo = await readFile(path.join(process.cwd(), "src/fonts/Archivo-Bold-static.ttf"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F4F4F1", color: "#17181A", padding: 72, fontFamily: "Archivo" }}>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>fitcoach</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>Una scheda che dice perché.</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: "#5C5F63" }}>Primo blocco di 4 settimane gratis e completo. Poi un piano Pro, IVA inclusa.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: "#5C5F63" }}>
          <div style={{ display: "flex", width: 40, height: 40, borderRadius: 999, background: "#FFDD57", border: "3px solid #17181A", alignItems: "center", justifyContent: "center", color: "#17181A", fontWeight: 700 }}>1</div>
          Ogni numero ha una nota a piè di pagina.
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Archivo", data: archivo, weight: 700, style: "normal" }] },
  );
}
