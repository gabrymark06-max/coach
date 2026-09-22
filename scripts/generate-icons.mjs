// @ts-check
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Icone della PWA, generate da questo file.
 *
 * Perche' uno script e non un'immagine committata: le icone sono **derivate dai token**
 * del design system (§1.1, §1.3, §1.8). Se un colore cambia, si rigenera; un PNG
 * disegnato altrove diventerebbe l'unico posto del progetto dove un esadecimale vive
 * fuori dai token, e nessuno saprebbe piu' da dove viene.
 *
 * Nessuna dipendenza: il PNG e' scritto a mano (IHDR + IDAT sgonfiato con `zlib` + IEND,
 * truecolor a 8 bit, filtro 0). Bastano rettangoli, e i rettangoli si disegnano in un
 * ciclo.
 *
 *   node scripts/generate-icons.mjs
 *
 * Il segno: un **bilanciere visto di fronte**, geometrico. Barra `--plate-bar`, dischi
 * interni `--plate-20` (blu), collari esterni `--pr` (ambra) — le stesse due famiglie di
 * colore che l'app usa per "azione" e "record". Le icone `any` portano anche la corsia
 * verticale di §0 sul bordo sinistro; quelle `maskable` no, perche' il ritaglio di
 * Android la mangerebbe.
 */

const BACKGROUND = [0x0b, 0x0c, 0x0e]; // --background
const BAR = [0x66, 0x6d, 0x82]; // --plate-bar
const PLATE = [0x12, 0x68, 0xec]; // --plate-20 / --primary
const COLLAR = [0xff, 0xb0, 0x20]; // --pr
const RAIL = [0x00, 0x7a, 0xff]; // --blue-brand

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // profondita' 8 bit
  header[9] = 2; // truecolor RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filtro "None"
    pixels.copy(raw, rowStart + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas(size, color) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i += 1) {
    pixels[i * 3] = color[0];
    pixels[i * 3 + 1] = color[1];
    pixels[i * 3 + 2] = color[2];
  }
  return pixels;
}

function rect(pixels, size, x0, y0, width, height, color) {
  const left = Math.max(0, Math.round(x0));
  const top = Math.max(0, Math.round(y0));
  const right = Math.min(size, Math.round(x0 + width));
  const bottom = Math.min(size, Math.round(y0 + height));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * size + x) * 3;
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
    }
  }
}

/**
 * @param {number} size
 * @param {{ rail: boolean, scale: number }} options
 */
function drawIcon(size, options) {
  const pixels = canvas(size, BACKGROUND);
  const u = size / 100; // unita' relativa: il disegno e' identico a ogni dimensione
  const mid = size / 2;
  const half = (options.scale * 100) / 2; // mezza larghezza del segno, in unita'

  // barra: attraversa tutto il segno, cosi' dischi e collari stanno *sulla* barra
  rect(pixels, size, mid - half * u, mid - 3.5 * u, half * 2 * u, 7 * u, BAR);

  // dischi interni (blu), simmetrici
  const plateHeight = 46 * u;
  const plateWidth = 9 * u;
  rect(pixels, size, mid - (half - 14) * u - plateWidth, mid - plateHeight / 2, plateWidth, plateHeight, PLATE);
  rect(pixels, size, mid + (half - 14) * u, mid - plateHeight / 2, plateWidth, plateHeight, PLATE);

  // collari esterni (ambra), piu' bassi
  const collarHeight = 26 * u;
  const collarWidth = 5 * u;
  rect(pixels, size, mid - half * u, mid - collarHeight / 2, collarWidth, collarHeight, COLLAR);
  rect(pixels, size, mid + half * u - collarWidth, mid - collarHeight / 2, collarWidth, collarHeight, COLLAR);

  // la corsia di §0, solo sulle icone non ritagliate
  if (options.rail) rect(pixels, size, 0, 0, 4 * u, size, RAIL);

  return encodePng(size, pixels);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const files = [
  ["icon-192.png", 192, { rail: true, scale: 0.78 }],
  ["icon-512.png", 512, { rail: true, scale: 0.78 }],
  // maskable: il segno sta nel cerchio sicuro dell'80%, e la corsia sparisce
  ["icon-maskable-192.png", 192, { rail: false, scale: 0.56 }],
  ["icon-maskable-512.png", 512, { rail: false, scale: 0.56 }],
  ["apple-touch-icon.png", 180, { rail: false, scale: 0.68 }],
];

for (const [name, size, options] of files) {
  writeFileSync(join(outDir, name), drawIcon(size, options));
  console.log(`${name} ${size}×${size}`);
}
