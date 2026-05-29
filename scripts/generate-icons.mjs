/**
 * Script para generar íconos PWA (PNG) desde el SVG base.
 *
 * Uso:
 *   npm install sharp --save-dev   (una sola vez)
 *   node scripts/generate-icons.mjs
 *
 * Genera: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("❌ 'sharp' no está instalado.");
    console.error("   Ejecuta: npm install sharp --save-dev");
    console.error("");
    console.error("   Alternativa: abre public/icons/icon.svg en el navegador,");
    console.error("   haz screenshot y recorta a 512x512 y 192x192.");
    process.exit(1);
  }

  const svgPath = join(ROOT, "public", "icons", "icon.svg");
  const svgBuffer = readFileSync(svgPath);

  const sizes = [
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    const outPath = join(ROOT, "public", "icons", name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 95 })
      .toFile(outPath);
    console.log(`✅ ${name} (${size}x${size})`);
  }

  // Maskable: mismo ícono con padding extra (safe area)
  const maskableSize = 512;
  const padding = Math.round(maskableSize * 0.1); // 10% padding
  const innerSize = maskableSize - padding * 2;
  const maskablePath = join(ROOT, "public", "icons", "icon-maskable-512.png");

  await sharp(svgBuffer)
    .resize(innerSize, innerSize)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 130, g: 90, b: 242, alpha: 1 }, // #825AF2
    })
    .png({ quality: 95 })
    .toFile(maskablePath);
  console.log(`✅ icon-maskable-512.png (${maskableSize}x${maskableSize} maskable)`);

  // Apple touch icon (180x180)
  const applePath = join(ROOT, "public", "icons", "apple-touch-icon.png");
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 95 })
    .toFile(applePath);
  console.log(`✅ apple-touch-icon.png (180x180)`);

  console.log("\n🎉 Íconos generados en public/icons/");
}

main().catch(console.error);
