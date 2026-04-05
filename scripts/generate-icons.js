// Generate simple PNG icons using raw pixel data
// Creates a minimal valid PNG with a colored circle and "集" character approximation

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function createPNG(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist <= r) {
        // Dark blue gradient background
        const t = dist / r;
        pixels[i] = Math.round(15 + t * 10);     // R
        pixels[i + 1] = Math.round(34 + t * 10);  // G
        pixels[i + 2] = Math.round(96 - t * 20);  // B
        pixels[i + 3] = 255;                       // A

        // Draw a target/crosshair symbol
        const nx = (x - cx) / r;
        const ny = (y - cy) / r;
        const innerDist = dist / r;

        // Outer ring
        if (Math.abs(innerDist - 0.75) < 0.08) {
          pixels[i] = 100;
          pixels[i + 1] = 255;
          pixels[i + 2] = 218;
          pixels[i + 3] = 255;
        }

        // Inner ring
        if (Math.abs(innerDist - 0.4) < 0.08) {
          pixels[i] = 100;
          pixels[i + 1] = 255;
          pixels[i + 2] = 218;
          pixels[i + 3] = 255;
        }

        // Center dot
        if (innerDist < 0.15) {
          pixels[i] = 231;
          pixels[i + 1] = 76;
          pixels[i + 2] = 60;
          pixels[i + 3] = 255;
        }

        // Crosshair lines
        if ((Math.abs(nx) < 0.06 || Math.abs(ny) < 0.06) && innerDist > 0.15 && innerDist < 0.75) {
          pixels[i] = 100;
          pixels[i + 1] = 255;
          pixels[i + 2] = 218;
          pixels[i + 3] = Math.round(180);
        }
      } else {
        pixels[i + 3] = 0; // Transparent
      }
    }
  }

  return encodePNG(pixels, size, size);
}

function encodePNG(pixels, width, height) {
  // Build raw image data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // No filter
    pixels.copy(
      rawData,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdr);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return crc ^ 0xffffffff;
}

const iconsDir = path.join(__dirname, "..", "extension", "icons");

[16, 48, 128].forEach((size) => {
  const png = createPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png`);
});
