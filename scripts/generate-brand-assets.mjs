import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Source mark also drives Next's SVG tab icon. These raster fallbacks are
// generated once and committed, so browsers need no rendering dependency.
const mark = await readFile(new URL("../src/app/icon.svg", import.meta.url));
await mkdir(new URL("../public/brand/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/brand/closeout-mark.svg", import.meta.url), mark);
await sharp(mark).resize(180, 180).png().toFile("src/app/apple-icon.png");
await sharp(mark).resize(512, 512).png().toFile("public/brand/closeout-icon.png");
const buffers = await Promise.all(
  [16, 32, 48].map((size) => sharp(mark).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + buffers.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(buffers.length, 4);
let offset = header.length;
for (let i = 0; i < buffers.length; i++) {
  const at = 6 + i * 16,
    size = [16, 32, 48][i];
  header[at] = size;
  header[at + 1] = size;
  header.writeUInt16LE(1, at + 4);
  header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(buffers[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += buffers[i].length;
}
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...buffers]));
const artwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#fbfaf9"/><path d="M56 92H1144M56 545H1144" stroke="#dfdce4"/>
<g transform="translate(56 28)"><rect width="44" height="44" rx="12" fill="#6f4cff"/><g transform="translate(3 3) scale(.59)" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M36 14H23a9 9 0 0 0-9 9v18a9 9 0 0 0 9 9h13"/><path d="M31 32h21m-9-9 9 9-9 9"/></g></g>
<text x="114" y="62" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="600" fill="#0a0a0a" letter-spacing="-1.5">closeout.</text>
<text x="56" y="167" font-family="monospace" font-size="13" fill="#6f4cff" letter-spacing="2">FOR PREDICTION MARKET TRADERS</text>
<text x="52" y="268" font-family="Georgia,serif" font-size="75" fill="#0a0a0a" letter-spacing="-3">Know your exit.</text>
<text x="52" y="356" font-family="Georgia,serif" font-size="75" font-style="italic" fill="#6f4cff" letter-spacing="-3">Before you sign.</text>
<text x="56" y="430" font-family="Arial,Helvetica,sans-serif" font-size="22" fill="#68646f">The liquidity. The fees. The shares that stay yours.</text>
<rect x="836" y="158" width="308" height="324" rx="14" fill="white" stroke="#dfdce4"/>
<text x="862" y="198" font-family="monospace" font-size="11" fill="#68646f" letter-spacing="1">YOUR PRICE FLOOR</text>
<text x="862" y="248" font-family="Arial,Helvetica,sans-serif" font-size="38" fill="#0a0a0a">0.60</text><text x="959" y="246" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#68646f">pUSD / share</text>
<rect x="862" y="280" width="146" height="20" rx="3" fill="#6f4cff"/><rect x="862" y="319" width="207" height="20" rx="3" fill="#6f4cff"/>
<path d="M862 360H1118" stroke="#6f4cff" stroke-dasharray="5 5"/>
<rect x="862" y="381" width="238" height="20" rx="3" fill="#dfdce4"/>
<text x="862" y="451" font-family="Arial,Helvetica,sans-serif" font-size="12" fill="#68646f">Illustration · not a live quote</text>
<text x="56" y="587" font-family="monospace" font-size="12" fill="#68646f" letter-spacing="1">PREDICTION MARKET EXITS, ON YOUR TERMS.</text>
<text x="970" y="587" font-family="Arial,Helvetica,sans-serif" font-size="14" fill="#0a0a0a">Explore Closeout ↗</text></svg>`;
await writeFile("public/brand/closeout-social.svg", artwork);
await sharp(Buffer.from(artwork)).png().toFile("public/og-closeout.png");
console.log("Generated SVG source copy, favicon ICO, Apple icon, 512px icon and social image.");
