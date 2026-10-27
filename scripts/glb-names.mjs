// Prints node names + material names from a GLB's JSON chunk (no glTF library needed).
import fs from "node:fs";
const buf = fs.readFileSync(process.argv[2]);
const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
console.log("ext:", json.extensionsUsed);
console.log("nodes:", (json.nodes ?? []).map((n) => n.name).join(", "));
console.log("materials:", (json.materials ?? []).map((m) => m.name).join(", "));
