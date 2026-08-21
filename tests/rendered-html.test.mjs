import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function parseCsv(text) {
  let quoted = false;
  let field = "";
  let row = [];
  const rows = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += '"';
      index += 1;
    }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

test("server-renders the finished explorer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Social Equity in Park Facilities Under Public Health Disruption<\/title>/i);
  assert.match(html, /An Interactive Explorer of Park Use in Austin/);
  assert.match(html, /Park Usage Patterns During a Public Health Disruption/);
  assert.match(html, /Exploring facility equity across population groups/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships only the complete approved public result tables", async () => {
  const [parks, evidence] = await Promise.all([
    readFile(new URL("../public/data/park_summary_public.csv", import.meta.url), "utf8"),
    readFile(new URL("../public/data/facility_equity_evidence.csv", import.meta.url), "utf8"),
  ]);
  const parkRows = parseCsv(parks);
  const evidenceRows = parseCsv(evidence);
  const years = ["2019", "2020", "2021"];
  const groups = ["Women", "Children", "Older Adults", "Hispanic Residents"];
  const facilities = ["Baseball", "Basketball", "Garden Center", "Golf", "Gym", "Memorial", "Parking Lot", "Playground", "Recreation Center", "Shade Area", "Soccer", "Swimming Pool", "Tennis", "Volleyball"];
  const facilityFields = facilities.map((facility) => `${facility.toLowerCase().replaceAll(" ", "_")}_availability`);
  const exactFacilityFields = facilities.map((facility) => facility.toLowerCase().replaceAll(" ", "_") );
  const availabilityLevels = new Set(["None", "Low", "Medium", "High"]);

  assert.equal(parkRows.length, 237);
  assert.equal(new Set(parkRows.map((row) => row.park_id)).size, 237);
  for (const park of parkRows) {
    assert.ok(exactFacilityFields.every((field) => !(field in park)));
    assert.ok(facilityFields.every((field) => availabilityLevels.has(park[field])));
    assert.ok(Number.isFinite(Number(park.facility_total)));
    assert.ok(Number(park.latitude) > 29 && Number(park.latitude) < 32);
    assert.ok(Number(park.longitude) > -99 && Number(park.longitude) < -96);
  }

  assert.equal(evidenceRows.length, 168);
  assert.deepEqual([...new Set(evidenceRows.map((row) => row.year))].sort(), years);
  assert.deepEqual([...new Set(evidenceRows.map((row) => row.population_group))].sort(), [...groups].sort());
  assert.deepEqual([...new Set(evidenceRows.map((row) => row.facility))].sort(), [...facilities].sort());
  const combinations = new Set(evidenceRows.map((row) => `${row.year}|${row.population_group}|${row.facility}`));
  assert.equal(combinations.size, years.length * groups.length * facilities.length);
  for (const row of evidenceRows) {
    assert.ok(["Positive", "Negative", "No clear evidence"].includes(row.direction));
    assert.ok(row.interpretation.length > 20);
    assert.equal(row.model, "Fully adjusted fixed-effects model");
  }
});
