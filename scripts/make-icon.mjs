import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

// Generate a 512x512 PNG for the Paper OS brand mark: deep charcoal background
// with a glowing amber "Q" inside a dashed ring (no external deps).
const SIZE = 512;
const W = SIZE, H = SIZE;

// Build raw RGBA pixels with antialiased shapes via supersampling.
const buf = Buffer.alloc(W * H * 4);
const cx = W / 2, cy = H / 2;

function setPx(x, y, r, g, b, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
}
// whole pixel blend
function blend(x, y, R, G, B, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  const da = buf[i + 3] / 255;
  const sa = a / 255;
  const out = sa + da * (1 - sa);
  if (out <= 0) return;
  buf[i]     = Math.round((R * sa + buf[i]     * da * (1 - sa)) / out);
  buf[i + 1] = Math.round((G * sa + buf[i + 1] * da * (1 - sa)) / out);
  buf[i + 2] = Math.round((B * sa + buf[i + 2] * da * (1 - sa)) / out);
  buf[i + 3] = Math.round(out * 255);
}

// background gradient (deep charcoal → very dark slate)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = y / H;
    const r = Math.round(8 + t * 4);
    const g = Math.round(10 + t * 4);
    const b = Math.round(15 + t * 5);
    setPx(x, y, r, g, b, 255);
  }
}

// amber glow halo
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 220) continue;
    const t = Math.max(0, 1 - d / 220);
    blend(x, y, 232, 181, 100, Math.round(t * t * 90));
  }
}

// dashed ring (outer)
function ring(x, y, r, R, G, B, a) {
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  const w = 4; // thickness
  const diff = Math.abs(d - r);
  if (diff > w) return;
  const theta = Math.atan2(dy, dx);
  const dash = (theta + Math.PI) / (2 * Math.PI);
  const seg = Math.abs(dash * 24 - Math.round(dash * 24)) < 0.5;
  if (!seg) return;
  const t = 1 - diff / w;
  blend(x, y, R, G, B, Math.round(a * t));
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ring(x, y, 180, 232, 181, 100, 230);

// solid amber ring (inner) with dashed segments
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    const w = 6;
    const diff = Math.abs(d - 120);
    if (diff > w) continue;
    const theta = Math.atan2(dy, dx);
    const seg = (Math.round((theta + Math.PI) * 6 / Math.PI) % 2) === 0;
    if (!seg) continue;
    const t = 1 - diff / w;
    blend(x, y, 232, 181, 100, Math.round(255 * t * 0.85));
  }
}

// inner glow disk
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > 80) continue;
    const t = 1 - d / 80;
    blend(x, y, 212, 163, 65, Math.round(t * t * 220));
  }
}

// serif "Q" glyph (custom-drawn, italic vibe)
function plotGlyph(x, y) {
  const dx = x - cx, dy = y - cy;
  if (Math.abs(dx) > 55 || Math.abs(dy) > 80) return false;
  // outer ellipse ring
  const rr = Math.hypot(dx, dy);
  const rOuter = 60, rInner = 38;
  if (rr > rOuter || rr < rInner) return false;
  if (rr > rOuter - 6 || rr < rInner + 6) return true;
  // tail
  if (dx > -20 && dx < 60 && dy > 18 && dy < 70 && dx > dy - 30) return true;
  return false;
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (plotGlyph(x, y)) setPx(x, y, 6, 9, 12, 255);
  }
}

// glow on top of glyph
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy;
    if (Math.abs(dx) > 80 || Math.abs(dy) > 100) continue;
    const d = Math.hypot(dx, dy);
    if (d < 60) {
      const t = 1 - d / 60;
      blend(x, y, 232, 181, 100, Math.round(t * t * 50));
    }
  }
}

// Encode to PNG (RGBA, 8-bit, no filter, zlib deflate)
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  // compute CRC32 over type+data
  let c = 0xffffffff;
  for (let i = 0; i < t.length; i++) { c ^= t[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  for (let i = 0; i < data.length; i++) { c ^= data[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
// filter byte 0 (None) prepended to each scanline
const stride = W * 4;
const raw = Buffer.alloc(H * (stride + 1));
for (let y = 0; y < H; y++) {
  raw[y * (stride + 1)] = 0;
  buf.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
}
const idat = deflateSync(raw, { level: 6 });
const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);

mkdirSync("apps/desktop/src-tauri/icons", { recursive: true });
writeFileSync("apps/desktop/src-tauri/icons/icon.png", png);
writeFileSync("apps/desktop/src-tauri/icons/32x32.png", png);
writeFileSync("apps/desktop/src-tauri/icons/128x128.png", png);
writeFileSync("apps/desktop/src-tauri/icons/128x128@2x.png", png);
writeFileSync("apps/desktop/src-tauri/icons/icon.ico", png); // placeholder; tauri icon cmd replaces it
console.log("wrote icons/icon.png + .ico placeholder (" + png.length + " bytes)");
