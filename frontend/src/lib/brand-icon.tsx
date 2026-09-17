import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Favicon/icona (design §8): carta, "fc" in Archivo 900 larghezza 125, cerchio evidenziatore con "1" in alto a destra (solo ≥ 192). */
export async function brandIcon(side: number, opts?: { maskable?: boolean }) {
  const archivo = await readFile(path.join(process.cwd(), "src/fonts/Archivo-Black-Expanded-static.ttf"));
  const showMark = side >= 192;
  const pad = opts?.maskable ? side * 0.1 : 0;
  const circle = side * 0.22;
  return new ImageResponse(
    (
      <div style={{ width: side, height: side, display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F4F1", color: "#17181A", position: "relative", fontFamily: "Archivo" }}>
        <div style={{ display: "flex", fontSize: side * 0.5, fontWeight: 900, letterSpacing: -side * 0.01 }}>fc</div>
        {showMark ? (
          <div style={{ position: "absolute", top: pad + side * 0.06, right: pad + side * 0.06, width: circle, height: circle, borderRadius: 999, background: "#FFDD57", border: `${Math.max(2, side * 0.012)}px solid #17181A`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: circle * 0.55, fontWeight: 700 }}>
            1
          </div>
        ) : null}
      </div>
    ),
    { width: side, height: side, fonts: [{ name: "Archivo", data: archivo, weight: 900, style: "normal" }] },
  );
}
