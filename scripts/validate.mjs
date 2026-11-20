// Checks data/projects.json before you publish. Run: node scripts/validate.mjs
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../data/projects.json", import.meta.url), "utf8"));
const OWNERS = ["university", "private"];
const STATUSES = ["proposed", "approved", "construction", "opened"];
const errors = [];
const ids = new Set();

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.last_updated || "")) errors.push("last_updated must be YYYY-MM-DD");

for (const p of data.projects) {
  const at = `[${p.id || p.name || "?"}]`;
  if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errors.push(`${at} id must be lowercase letters, numbers, hyphens`);
  if (ids.has(p.id)) errors.push(`${at} duplicate id`);
  ids.add(p.id);
  if (!p.name) errors.push(`${at} missing name`);
  if (!p.address) errors.push(`${at} missing address`);
  if (!OWNERS.includes(p.owner)) errors.push(`${at} owner must be one of ${OWNERS.join(", ")}`);
  if (!STATUSES.includes(p.status)) errors.push(`${at} status must be one of ${STATUSES.join(", ")}`);
  // Rough box around Berkeley / Albany, to catch swapped or mistyped coordinates.
  if (!(p.lat > 37.84 && p.lat < 37.9)) errors.push(`${at} lat ${p.lat} is outside the Berkeley area`);
  if (!(p.lng > -122.33 && p.lng < -122.23)) errors.push(`${at} lng ${p.lng} is outside the Berkeley area`);
  for (const k of ["beds", "units", "stories"]) {
    if (p[k] != null && !(Number.isInteger(p[k]) && p[k] > 0)) errors.push(`${at} ${k} must be a positive whole number or null`);
  }
  if (!Array.isArray(p.sources) || p.sources.length === 0) errors.push(`${at} needs at least one source`);
  for (const s of p.sources || []) {
    if (!s.label || !/^https?:\/\//.test(s.url || "")) errors.push(`${at} each source needs a label and an http(s) url`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${data.projects.length} projects`);
