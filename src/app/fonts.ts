import { Archivo, Public_Sans } from "next/font/google";

/** Display + numerali: cifre tabulari native, `1` con la barra (§3.1). */
export const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700"],
  display: "swap",
});

/** Testo di lavoro: nata per interfacce dense a corpo piccolo (§3.1). */
export const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});
