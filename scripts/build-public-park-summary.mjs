import { readFile, writeFile } from "node:fs/promises";

const defaultInputUrl = new URL("../../private-data/austin-park-equity/park_summary.csv", import.meta.url);
const inputUrl = process.argv[2] ? new URL(process.argv[2], `file:///${process.cwd().replaceAll("\\", "/")}/`) : defaultInputUrl;
const outputUrl = new URL("../public/data/park_summary_public.csv", import.meta.url);

const facilityRules = {
  golf: (count) => count <= 36 ? "Low" : count >= 50 ? "High" : null,
  soccer: () => "Low",
  memorial: (count) => count <= 2 ? "Low" : count <= 5 ? "Medium" : "High",
  gym: () => "Low",
  shade_area: (count) => count <= 2 ? "Low" : count <= 7 ? "Medium" : "High",
  volleyball: (count) => count <= 2 ? "Low" : "High",
  swimming_pool: () => "Low",
  tennis: (count) => count <= 2 ? "Low" : "High",
  playground: (count) => count <= 2 ? "Low" : count <= 4 ? "Medium" : "High",
  baseball: () => "Low",
  recreation_center: () => "Low",
  basketball: () => "Low",
  garden_center: () => "Low",
  parking_lot: (count) => count <= 2 ? "Low" : count <= 5 ? "Medium" : "High",
};

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
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
  return {
    headers,
    records: records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))),
  };
}

function availabilityFor(facility, rawCount, parkId) {
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid ${facility} count for ${parkId}.`);
  }
  if (count === 0) return "None";
  const availability = facilityRules[facility](count);
  if (!availability) {
    throw new Error(`The approved ${facility} thresholds do not classify count ${count} for ${parkId}.`);
  }
  return availability;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const { headers, records } = parseCsv(await readFile(inputUrl, "utf8"));
if (records.length !== 237) throw new Error(`Expected 237 park records, received ${records.length}.`);

const publicHeaders = headers.map((header) => header in facilityRules ? `${header}_availability` : header);
const publicRows = records.map((record) => Object.fromEntries(headers.map((header) => [
  header in facilityRules ? `${header}_availability` : header,
  header in facilityRules ? availabilityFor(header, record[header], record.park_id) : record[header],
])));

const output = [
  publicHeaders.join(","),
  ...publicRows.map((record) => publicHeaders.map((header) => csvCell(record[header])).join(",")),
].join("\n");

await writeFile(outputUrl, `${output}\n`, "utf8");
console.log(`Wrote ${publicRows.length} privacy-protected park records to ${outputUrl.pathname}.`);
