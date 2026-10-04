function generateIconScriptSrc() {
  return `"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function solidPng(size, hex) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#4f46e5";
  const r = parseInt(valid.slice(1, 3), 16);
  const g = parseInt(valid.slice(3, 5), 16);
  const b = parseInt(valid.slice(5, 7), 16);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

const outDir = process.argv[2] || "gecko-project";
const resDir = path.join(outDir, "app", "src", "main", "res");
const densities = ["mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"];

let theme = "#4f46e5";
try {
  const bc = JSON.parse(fs.readFileSync("build-config.json", "utf8"));
  theme = bc.themeColor || bc.accentColor || theme;
} catch (e) {}

let src = null;
let source = null;
for (const name of ["app-icon.png", "adaptive-foreground.png"]) {
  if (fs.existsSync(name)) {
    src = fs.readFileSync(name);
    source = name;
    break;
  }
}
if (!src) {
  src = solidPng(192, theme);
  source = "solid " + theme;
}

for (const d of densities) {
  fs.mkdirSync(path.join(resDir, d), { recursive: true });
  fs.writeFileSync(path.join(resDir, d, "ic_launcher.png"), src);
}
fs.mkdirSync(path.join(resDir, "values"), { recursive: true });
const colorsPath = path.join(resDir, "values", "ic_launcher_background.xml");
if (!fs.existsSync(colorsPath)) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(theme) ? theme : "#4f46e5";
  fs.writeFileSync(colorsPath, '<resources><color name="ic_launcher_background">' + valid + "</color></resources>\\n");
}
console.log("launcher icons -> " + densities.length + " densities | source: " + source);
`;
}

module.exports = { generateIconScriptSrc };
