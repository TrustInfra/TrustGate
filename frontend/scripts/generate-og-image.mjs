import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING = 100;

const logo = await sharp("public/logo.png")
  .resize({
    width: WIDTH - PADDING * 2,
    height: HEIGHT - PADDING * 2,
    fit: "inside",
  })
  .toBuffer();

const { width, height } = await sharp(logo).metadata();

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: { r: 10, g: 10, b: 10, alpha: 1 },
  },
})
  .composite([
    {
      input: logo,
      left: Math.round((WIDTH - width) / 2),
      top: Math.round((HEIGHT - height) / 2),
    },
  ])
  .png()
  .toFile("public/og-image.png");

console.log(
  `og-image.png: ${WIDTH}x${HEIGHT} with logo ${width}x${height} centered`,
);