/**
 * Renders the extension icons — a large and a small "A" — straight to PNG.
 *
 * The icon is drawn from the stroke geometry below rather than checked in as
 * binary art, so it stays reviewable in a diff. Uses only node:zlib, which keeps
 * the project at zero runtime and zero image dependencies.
 *
 * Run with: npm run icons
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "icons");
// Android renders the Extensions row icon at high density, so 48 and 96 cover it.
// The 16 and 32 sizes existed for the desktop toolbar, which this extension does
// not target.
const SIZES = [48, 96];
const COLOR = [0x8b, 0x5c, 0xf6]; // violet-500: legible on both light and dark menus
const SUPERSAMPLE = 4;

/** Strokes of one capital "A", in a 100x100 design box. */
function glyphA(centerX, baselineY, height, strokeWidth) {
  const apex = [centerX, baselineY - height];
  const halfSpread = height * 0.36;
  const left = [centerX - halfSpread, baselineY];
  const right = [centerX + halfSpread, baselineY];

  // Crossbar sits 30% of the way up from the baseline, between the two legs.
  const t = 0.7;
  const lerp = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  return [
    { from: apex, to: left, width: strokeWidth },
    { from: apex, to: right, width: strokeWidth },
    { from: lerp(apex, left), to: lerp(apex, right), width: strokeWidth * 0.8 },
  ];
}

const STROKES = [
  ...glyphA(34, 82, 62, 9),
  ...glyphA(76, 82, 38, 6.5),
];

/** Distance from point p to segment [a, b]. */
function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function covers(x, y) {
  for (const { from, to, width } of STROKES) {
    if (distanceToSegment(x, y, from, to) <= width / 2) return true;
  }
  return false;
}

/** Renders the glyph at `size` px as a non-premultiplied RGBA buffer. */
function renderRGBA(size) {
  const scale = 100 / size;
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) * scale;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) * scale;
          if (covers(x, y)) hits++;
        }
      }
      const offset = (py * size + px) * 4;
      rgba[offset] = COLOR[0];
      rgba[offset + 1] = COLOR[1];
      rgba[offset + 2] = COLOR[2];
      rgba[offset + 3] = Math.round((hits / samples) * 255);
    }
  }
  return rgba;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // bytes 10-12 stay 0: deflate, adaptive filtering, no interlace

  // One filter byte (0 = None) in front of every scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, encodePNG(size, renderRGBA(size)));
  console.log(`wrote ${file}`);
}
