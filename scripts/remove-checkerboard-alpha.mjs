import sharp from "sharp";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/remove-checkerboard-alpha.mjs <input> <output>");
}

const { data, info } = await sharp(inputPath)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const pixelCount = width * height;
const background = new Uint8Array(pixelCount);
const queue = new Int32Array(pixelCount);
let head = 0;
let tail = 0;

const looksLikeCheckerboard = (index) => {
  const offset = index * channels;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const minimum = Math.min(r, g, b);
  const maximum = Math.max(r, g, b);

  // The generated checkerboard is nearly neutral white/light gray. Keep the
  // threshold deliberately narrow so pale shirt and collar pixels remain
  // opaque even when they touch the outside edge of the portrait.
  return minimum >= 225 && maximum - minimum <= 6;
};

const enqueue = (index) => {
  if (background[index] || !looksLikeCheckerboard(index)) return;
  background[index] = 1;
  queue[tail++] = index;
};

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}

for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (head < tail) {
  const index = queue[head++];
  const x = index % width;
  const y = Math.floor(index / width);

  if (x > 0) enqueue(index - 1);
  if (x + 1 < width) enqueue(index + 1);
  if (y > 0) enqueue(index - width);
  if (y + 1 < height) enqueue(index + width);
}

const rgba = Buffer.alloc(pixelCount * 4);

for (let index = 0; index < pixelCount; index += 1) {
  const sourceOffset = index * channels;
  const targetOffset = index * 4;
  rgba[targetOffset] = data[sourceOffset];
  rgba[targetOffset + 1] = data[sourceOffset + 1];
  rgba[targetOffset + 2] = data[sourceOffset + 2];
  rgba[targetOffset + 3] = background[index] ? 0 : 255;
}

await sharp(rgba, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(outputPath);

console.log(JSON.stringify({ width, height, removedPixels: tail, outputPath }));
