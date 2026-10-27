// Fails the build if any GLB in public/models ships without geometry compression, or if the folder
// exceeds the size budget. Runs on predev/prebuild. (Ported from GravityGrid's check-models-compressed.mjs.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "models");
const BUDGET = 1.5 * 1024 * 1024;
const COMPRESSION = ["EXT_meshopt_compression", "KHR_draco_mesh_compression"];

function readGlbJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a binary glTF");
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error("first chunk is not JSON");
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
}

if (!fs.existsSync(DIR)) process.exit(0);
const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".glb"));
let total = 0; const bad = [];
for (const f of files) {
  const p = path.join(DIR, f); total += fs.statSync(p).size;
  try {
    const used = readGlbJson(p).extensionsUsed ?? [];
    if (!COMPRESSION.some((e) => used.includes(e))) bad.push(`${f} (uncompressed)`);
  } catch (e) { bad.push(`${f} (${e.message})`); }
}
if (bad.length) {
  console.error(`\n[check-models] Fix these models (run scripts/optimize-models.sh):\n  ${bad.join("\n  ")}\n`);
  process.exit(1);
}
if (total > BUDGET) {
  console.error(`\n[check-models] public/models is ${(total / 1048576).toFixed(2)} MB, over the 1.5 MB budget.\n`);
  process.exit(1);
}
console.log(`[check-models] ${files.length} model(s) OK, ${(total / 1024).toFixed(0)} KB total`);
