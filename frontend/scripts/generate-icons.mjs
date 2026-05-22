import sharp from "sharp";
import fs from "fs";

const input = "public/logo.png";

if (!fs.existsSync(input)) {
  console.error("Missing public/logo.png");
  process.exit(1);
}

await sharp(input)
  .resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/apple-touch-icon.png");

await sharp(input)
  .resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/icon-192.png");

await sharp(input)
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/icon-512.png");

await sharp(input)
  .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/favicon.png");

console.log("Icons generated.");
