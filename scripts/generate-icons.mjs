// Generates PNG icons for PWA (192x192 and 512x512)
// Uses only Node.js built-ins — no extra deps needed.
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'frontend', 'public');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function buildPNG(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const cx = size / 2, cy = size / 2;
  const R = size * 0.44;          // outer green ring
  const R1 = size * 0.38;         // dark gap ring
  const R2 = size * 0.34;         // inner green felt
  const cornerR = size * 0.16;    // rounded-corner radius

  // Colours
  const BG   = [17,  24,  39];   // #111827
  const RING = [5, 150, 105];    // #059669
  const GAP  = [17,  24,  39];   // same as BG
  const FELT = [6,   78,  59];   // #064e3b

  // Draw chip dashes (8 white segments on the outer ring)
  const dashAngle = Math.PI / 8; // 22.5°
  const dashR = (R + R1) / 2;
  const dashLen = (R - R1) * 0.9;
  const dashW = size * 0.04;

  function inDash(px, py) {
    const dx = px - cx, dy = py - cy;
    const angle = Math.atan2(dy, dx); // -π .. π
    const dist = Math.sqrt(dx * dx + dy * dy);
    // only within the ring band
    if (dist < R1 + (R - R1) * 0.05 || dist > R - (R - R1) * 0.05) return false;
    // check if close to any of 8 dash centres
    for (let i = 0; i < 8; i++) {
      const ca = (i / 8) * 2 * Math.PI;
      let diff = ((angle - ca) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
      if (Math.abs(diff) < dashAngle / 2) return true;
    }
    return false;
  }

  function inCorner(px, py) {
    const checks = [
      [cornerR, cornerR],
      [size - cornerR, cornerR],
      [cornerR, size - cornerR],
      [size - cornerR, size - cornerR],
    ];
    for (const [ox, oy] of checks) {
      if (px < ox + (ox < size/2 ? 0 : -size + cornerR*2 + (size - cornerR*2)) &&
          py < oy + (oy < size/2 ? 0 : 0)) {
        // simpler: pixel must be outside the rounded corner arc
      }
    }
    // Check each corner quadrant
    if (px < cornerR && py < cornerR) {
      return Math.hypot(px - cornerR, py - cornerR) > cornerR;
    }
    if (px > size - cornerR && py < cornerR) {
      return Math.hypot(px - (size - cornerR), py - cornerR) > cornerR;
    }
    if (px < cornerR && py > size - cornerR) {
      return Math.hypot(px - cornerR, py - (size - cornerR)) > cornerR;
    }
    if (px > size - cornerR && py > size - cornerR) {
      return Math.hypot(px - (size - cornerR), py - (size - cornerR)) > cornerR;
    }
    return false;
  }

  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(0); // filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (inCorner(x, y)) {
        rows.push(...BG);
        continue;
      }

      if (d <= R2) {
        rows.push(...FELT);
      } else if (d <= R1) {
        rows.push(...GAP);
      } else if (d <= R) {
        rows.push(inDash(x, y) ? 255 : RING[0],
                  inDash(x, y) ? 255 : RING[1],
                  inDash(x, y) ? 255 : RING[2]);
      } else {
        rows.push(...BG);
      }
    }
  }

  const raw = Buffer.from(rows);
  const compressed = zlib.deflateSync(raw);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const buf = buildPNG(size);
  const out = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(out, buf);
  console.log(`✓ ${out}  (${buf.length} bytes)`);
}
