const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create PNG buffer using pure Node.js (zlib + PNG chunks)
function createPNG(width, height, drawFn) {
  const bytesPerPixel = 4;
  const rawData = Buffer.alloc(height * (width * bytesPerPixel + 1));
  
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * bytesPerPixel + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([len, body, crcBuf]);
}

// CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

// Drawing function for extension icon (Sleek camera crop icon with gradient background)
function drawIcon(x, y, w, h) {
  const nx = x / (w - 1);
  const ny = y / (h - 1);
  const cx = 0.5, cy = 0.5;
  const dist = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);

  // Rounded rectangle background
  const rx = Math.abs(nx - 0.5);
  const ry = Math.abs(ny - 0.5);
  const cornerDist = Math.max(rx - 0.38, 0) ** 2 + Math.max(ry - 0.38, 0) ** 2;

  if (cornerDist > 0.01) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Gradient: Deep Purple (#1e1b4b) to Indigo (#4338ca) / Cyan (#06b6d4) accent
  let r = Math.round(30 + nx * 35);
  let g = Math.round(27 + ny * 60 + nx * 50);
  let b = Math.round(75 + ny * 130 + nx * 100);
  let a = 255;

  // Outer border glow
  if (rx > 0.44 || ry > 0.44) {
    return [99, 102, 241, 240]; // Vibrant indigo border
  }

  // Draw Block selection icon (Crop box with corner handles)
  const margin = 0.22;
  const inBox = nx >= margin && nx <= (1 - margin) && ny >= margin && ny <= (1 - margin);
  const borderThick = 0.045;

  const isBorder = inBox && (
    nx <= margin + borderThick || nx >= 1 - margin - borderThick ||
    ny <= margin + borderThick || ny >= 1 - margin - borderThick
  );

  // Center target/lens dot
  const centerDist = Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2);
  const isCenterDot = centerDist < 0.12;
  const isCenterRing = centerDist >= 0.12 && centerDist < 0.16;

  if (isCenterDot) {
    return [6, 182, 212, 255]; // Cyan dot
  }
  if (isCenterRing) {
    return [255, 255, 255, 220]; // White ring around center
  }

  if (isBorder) {
    return [255, 255, 255, 255]; // White crop box border
  }

  // Corner handle accents
  const handleSize = 0.08;
  const isCornerHandle = (
    (Math.abs(nx - margin) < handleSize || Math.abs(nx - (1 - margin)) < handleSize) &&
    (Math.abs(ny - margin) < handleSize || Math.abs(ny - (1 - margin)) < handleSize)
  );

  if (isCornerHandle) {
    return [59, 130, 246, 255]; // Bright blue corner handles
  }

  return [r, g, b, a];
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuf = createPNG(size, size, drawIcon);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated ${filePath} (${pngBuf.length} bytes)`);
});
