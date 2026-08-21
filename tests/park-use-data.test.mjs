import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactFacilityFields = [
  "baseball", "basketball", "garden_center", "golf", "gym", "memorial", "parking_lot",
  "playground", "recreation_center", "shade_area", "soccer", "swimming_pool", "tennis", "volleyball",
];
const availabilityFields = exactFacilityFields.map((field) => `${field}_availability`);
const allowedAvailability = new Set(["None", "Low", "Medium", "High"]);

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

test("public park source preserves the approved 237-park grain", async () => {
  const csvText = await readFile(new URL("../public/data/park_summary_public.csv", import.meta.url), "utf8");
  const rows = parseCsv(csvText);
  assert.equal(rows.length, 237);
  assert.equal(new Set(rows.map((row) => row.park_id)).size, 237);
});

test("public park rows retain coordinates, years, facility total, and categorical availability", async () => {
  const text = await readFile(new URL("../public/data/park_summary_public.csv", import.meta.url), "utf8");
  const [headerLine] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  const rows = parseCsv(text);
  assert.ok(exactFacilityFields.every((field) => !headers.includes(field)));
  assert.ok(availabilityFields.every((field) => headers.includes(field)));
  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    assert.ok(latitude >= 30.13 && latitude <= 30.50, `${row.park_id} latitude`);
    assert.ok(longitude >= -97.92 && longitude <= -97.60, `${row.park_id} longitude`);
    for (const year of ["2019", "2020", "2021"]) {
      assert.ok(Number.isFinite(Number(row[`visits_${year}`])), `${row.park_id} visits_${year}`);
      assert.ok(Number.isFinite(Number(row[`origin_breadth_${year}`])), `${row.park_id} origin_breadth_${year}`);
    }
    assert.ok(Number.isFinite(Number(row.facility_total)), `${row.park_id} facility_total`);
    availabilityFields.forEach((field) => assert.ok(allowedAvailability.has(row[field]), `${row.park_id} ${field}`));
  }
});

test("facility selection uses OR semantics", async () => {
  const rows = parseCsv(await readFile(new URL("../public/data/park_summary_public.csv", import.meta.url), "utf8"));
  const selected = ["baseball_availability", "swimming_pool_availability"];
  const filtered = rows.filter((row) => selected.some((field) => row[field] !== "None"));
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((row) => row.baseball_availability !== "None" || row.swimming_pool_availability !== "None"));
  assert.ok(filtered.some((row) => row.baseball_availability !== "None" && row.swimming_pool_availability === "None"));
  assert.ok(filtered.some((row) => row.swimming_pool_availability !== "None" && row.baseball_availability === "None"));
});
