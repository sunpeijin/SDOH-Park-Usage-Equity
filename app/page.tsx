"use client";

import { useEffect, useMemo, useState } from "react";
import AustinParkMap from "./components/AustinParkMap";
import {
  buildFacilityMapGeoJson,
  type FacilityAvailability,
} from "./lib/facility-map-data";
import {
  PARK_USE_METRICS,
  buildParkUseGeoJson,
  type ParkUseMetric,
} from "./lib/park-use-data";

export const dynamic = "force-static";

const PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function publicAssetPath(path: string): string {
  return `${PUBLIC_BASE_PATH}/${path}`;
}

const YEARS = ["2019", "2020", "2021"] as const;
type Year = (typeof YEARS)[number];

const STUDY_PERIOD_PHASES: Record<Year, string> = {
  "2019": "Pre-outbreak",
  "2020": "High-intensity phase",
  "2021": "Adaptation phase",
};

const GROUPS = [
  "Women",
  "Children",
  "Older Adults",
  "Hispanic Residents",
] as const;
type PopulationGroup = (typeof GROUPS)[number];

const FACILITIES = [
  ["Baseball", "baseball"],
  ["Basketball", "basketball"],
  ["Garden Center", "garden_center"],
  ["Golf", "golf"],
  ["Gym", "gym"],
  ["Memorial", "memorial"],
  ["Parking Lot", "parking_lot"],
  ["Playground", "playground"],
  ["Recreation Center", "recreation_center"],
  ["Shade Area", "shade_area"],
  ["Soccer", "soccer"],
  ["Swimming Pool", "swimming_pool"],
  ["Tennis", "tennis"],
  ["Volleyball", "volleyball"],
] as const;

type FacilityName = (typeof FACILITIES)[number][0];
type FacilityKey = (typeof FACILITIES)[number][1];
type Direction = "Positive" | "Negative" | "No clear evidence";

type Park = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  priority: string;
  acres: number;
  facilities: Record<FacilityKey, FacilityAvailability>;
  facilityTotal: number;
  visits: Record<Year, number>;
  originBreadth: Record<Year, number>;
  visitsPerAcre: Record<Year, number>;
};

type Evidence = {
  year: Year;
  group: PopulationGroup;
  facility: FacilityName;
  coefficient: number;
  tStatistic: number;
  stars: string;
  significant: boolean;
  direction: Direction;
  label: string;
  interpretation: string;
  model: string;
};

type CsvRow = Record<string, string>;

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...values] = rows;
  return values.map((valuesRow) =>
    Object.fromEntries(headers.map((header, index) => [header, valuesRow[index] ?? ""])),
  );
}

function numeric(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function facilityAvailability(value: string | undefined): FacilityAvailability {
  if (value === "None" || value === "Low" || value === "Medium" || value === "High") return value;
  throw new Error(`Invalid public facility availability value: ${value ?? "missing"}.`);
}

function parseParks(rows: CsvRow[]): Park[] {
  return rows.map((row) => {
    const facilities = Object.fromEntries(
      FACILITIES.map(([, key]) => [key, facilityAvailability(row[`${key}_availability`])]),
    ) as Record<FacilityKey, FacilityAvailability>;
    return {
      id: row.park_id,
      name: row.park_name,
      latitude: numeric(row.latitude),
      longitude: numeric(row.longitude),
      type: row.park_type,
      priority: row.management_priority,
      acres: numeric(row.acres),
      facilities,
      facilityTotal: numeric(row.facility_total),
      visits: {
        "2019": numeric(row.visits_2019),
        "2020": numeric(row.visits_2020),
        "2021": numeric(row.visits_2021),
      },
      originBreadth: {
        "2019": numeric(row.origin_breadth_2019),
        "2020": numeric(row.origin_breadth_2020),
        "2021": numeric(row.origin_breadth_2021),
      },
      visitsPerAcre: {
        "2019": numeric(row.visits_per_acre_2019),
        "2020": numeric(row.visits_per_acre_2020),
        "2021": numeric(row.visits_per_acre_2021),
      },
    };
  });
}

function parseEvidence(rows: CsvRow[]): Evidence[] {
  return rows.map((row) => ({
    year: row.year as Year,
    group: row.population_group as PopulationGroup,
    facility: row.facility as FacilityName,
    coefficient: numeric(row.coefficient),
    tStatistic: numeric(row.t_statistic),
    stars: row.significance_stars,
    significant: row.is_significant.toLowerCase() === "true",
    direction: row.direction as Direction,
    label: row.evidence_label,
    interpretation: row.interpretation,
    model: row.model,
  }));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatValue(value: number | null, kind: "number" | "decimal" = "number") {
  if (value === null || !Number.isFinite(value)) return "Not available";
  return kind === "decimal" ? decimalFormat.format(value) : numberFormat.format(value);
}

function facilityKey(name: FacilityName): FacilityKey {
  return FACILITIES.find(([label]) => label === name)?.[1] ?? "playground";
}

function directionClass(direction: Direction): string {
  if (direction === "Positive") return "positive";
  if (direction === "Negative") return "negative";
  return "unclear";
}

function directionSymbol(direction: Direction): string {
  if (direction === "Positive") return "+";
  if (direction === "Negative") return "−";
  return "·";
}

function MultiFilter({
  label,
  options,
  selected,
  onChange,
  helper,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  helper?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) =>
    option.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <details className="multi-filter control-box">
      <summary>
        <span>{label}</span>
        <strong>{selected.length === 0 ? "All" : `${selected.length} selected`}</strong>
      </summary>
      <div className="filter-popover">
        <label className="search-label">
          <span className="sr-only">Search {label}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
          />
        </label>
        {helper ? <p className="filter-helper">{helper}</p> : null}
        <div className="check-list">
          {filtered.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option]
                      : selected.filter((value) => value !== option),
                  )
                }
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <div className="filter-actions">
          {selected.length > 0 ? (
            <button className="text-button" type="button" onClick={() => onChange([])}>
              Clear selection
            </button>
          ) : <span />}
          <button
            className="filter-done"
            type="button"
            onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
          >
            Done
          </button>
        </div>
      </div>
    </details>
  );
}

function YearControl({
  value,
  onChange,
  label = "Year",
  showStudyPhases = false,
}: {
  value: Year;
  onChange: (year: Year) => void;
  label?: string;
  showStudyPhases?: boolean;
}) {
  if (showStudyPhases) {
    return (
      <div className="segmented-field study-period-field" role="group" aria-label={label}>
        <span className="study-period-label">{label}</span>
        <div className="segmented-control study-period-control">
          {YEARS.map((year) => (
            <button
              key={year}
              type="button"
              className={year === value ? "selected" : ""}
              aria-pressed={year === value}
              onClick={() => onChange(year)}
            >
              <span className="study-period-year">{year}</span>
              <span className="study-period-phase">{STUDY_PERIOD_PHASES[year]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <fieldset className="segmented-field">
      <legend>{label}</legend>
      <div className="segmented-control">
        {YEARS.map((year) => (
          <button
            key={year}
            type="button"
            className={year === value ? "selected" : ""}
            aria-pressed={year === value}
            onClick={() => onChange(year)}
          >
            {year}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function YearSelect({ value, onChange }: { value: Year; onChange: (year: Year) => void }) {
  return (
    <label className="control-box select-control equity-year-select">
      <span>Year</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Year)}>
        {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
      </select>
    </label>
  );
}

function MetricSelect({ value, onChange }: { value: ParkUseMetric; onChange: (value: ParkUseMetric) => void }) {
  return (
    <label className="control-box select-control">
      <span>Color by</span>
      <select value={value} onChange={(event) => onChange(event.target.value as ParkUseMetric)}>
        {PARK_USE_METRICS.map((metric) => (
          <option key={metric.value} value={metric.value}>
            {metric.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LineChart({
  values,
  selectedYear,
  label,
  compact = false,
}: {
  values: Record<Year, number>;
  selectedYear?: Year;
  label: string;
  compact?: boolean;
}) {
  const entries = YEARS.map((year) => ({ year, value: values[year] }));
  const maximum = Math.max(...entries.map((entry) => entry.value), 1);
  const minimum = Math.min(...entries.map((entry) => entry.value), 0);
  const range = Math.max(maximum - minimum, 1);
  const points = entries.map((entry, index) => ({
    ...entry,
    x: 36 + index * 132,
    y: 130 - ((entry.value - minimum) / range) * 92,
  }));
  return (
    <div className={compact ? "chart compact-chart" : "chart"}>
      <svg viewBox="0 0 336 166" role="img" aria-label={label}>
        {[38, 84, 130].map((y) => (
          <line key={y} x1="32" x2="306" y1={y} y2={y} stroke="#e8ebea" />
        ))}
        <polyline
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#159693"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <g key={point.year}>
            <circle
              cx={point.x}
              cy={point.y}
              r={selectedYear === point.year ? 7 : 5}
              fill="#159693"
              stroke={selectedYear === point.year ? "#06243a" : "#ffffff"}
              strokeWidth={selectedYear === point.year ? 3 : 2}
            />
            <text x={point.x} y="156" textAnchor="middle" className="chart-axis-label">
              {point.year}
            </text>
            <title>{`${point.year}: ${formatValue(point.value, "decimal")}`}</title>
          </g>
        ))}
      </svg>
      <div className="chart-values" aria-label={`${label} values`}>
        {points.map((point) => (
          <span key={point.year}>
            <b>{point.year}</b> {formatValue(point.value, "decimal")}
          </span>
        ))}
      </div>
    </div>
  );
}

function ParkTypeBars({ rows }: { rows: { label: string; value: number; count: number }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="bar-chart" role="img" aria-label="Median estimated visits by park type">
      {rows.slice(0, 7).map((row) => (
        <div className="bar-row" key={row.label} title={`${row.label}: ${formatValue(row.value)} median visits across ${row.count} parks`}>
          <span className="bar-label">{row.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }} />
          </span>
          <span className="bar-value">{formatValue(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CoefficientPlot({ rows, selectedYear }: { rows: Evidence[]; selectedYear: Year }) {
  const max = Math.max(...rows.map((row) => Math.abs(row.coefficient)), 0.01);
  return (
    <div className="coefficient-plot" role="img" aria-label="Facility association coefficients across years">
      <div className="coefficient-zero" />
      {YEARS.map((year) => {
        const row = rows.find((item) => item.year === year);
        if (!row) return null;
        const left = 50 + (row.coefficient / (max * 2)) * 84;
        return (
          <div className="coefficient-row" key={year}>
            <span>{year}</span>
            <div className="coefficient-track">
              <i
                className={`${directionClass(row.direction)} ${row.significant ? "filled" : "hollow"} ${selectedYear === year ? "current" : ""}`}
                style={{ left: `${left}%` }}
                title={`${year}: ${row.coefficient.toFixed(3)}, ${row.direction}, ${row.significant ? "statistically significant" : "no clear statistical evidence"}`}
              />
            </div>
            <strong>{row.coefficient > 0 ? "+" : ""}{row.coefficient.toFixed(3)}</strong>
          </div>
        );
      })}
      <div className="coefficient-axis"><span>Negative</span><span>0</span><span>Positive</span></div>
    </div>
  );
}

function EvidenceMatrix({
  rows,
  selectedFacility,
  selectedYear,
  onSelect,
}: {
  rows: Evidence[];
  selectedFacility: FacilityName;
  selectedYear: Year;
  onSelect: (facility: FacilityName, year: Year) => void;
}) {
  return (
    <div className="matrix-scroll">
      <table className="evidence-matrix">
        <caption className="sr-only">Facility evidence by year</caption>
        <thead>
          <tr><th scope="col">Facility</th>{YEARS.map((year) => <th scope="col" key={year}>{year}</th>)}</tr>
        </thead>
        <tbody>
          {FACILITIES.map(([facility]) => (
            <tr key={facility}>
              <th scope="row">{facility}</th>
              {YEARS.map((year) => {
                const evidence = rows.find((row) => row.facility === facility && row.year === year);
                const direction = evidence?.direction ?? "No clear evidence";
                const selected = facility === selectedFacility && year === selectedYear;
                const description = evidence
                  ? `${facility}, ${year}: coefficient ${evidence.coefficient.toFixed(3)}, ${evidence.direction}, ${evidence.significant ? "statistically significant" : "no clear statistical evidence"}`
                  : `${facility}, ${year}: not available`;
                return (
                  <td key={year}>
                    <button
                      type="button"
                      className={`${directionClass(direction)} ${selected ? "selected" : ""}`}
                      onClick={() => onSelect(facility, year)}
                      aria-label={description}
                      title={description}
                    >
                      <span aria-hidden="true">{directionSymbol(direction)}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-card" role="status">
      <span className="loading-pulse" />
      <div><strong>Preparing the evidence</strong><p>Loading the approved public summaries.</p></div>
    </div>
  );
}

export default function Home() {
  const [parks, setParks] = useState<Park[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [parkYear, setParkYear] = useState<Year>("2020");
  const [metric, setMetric] = useState<ParkUseMetric>("visits");
  const [types, setTypes] = useState<string[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [parkMapResetKey, setParkMapResetKey] = useState(0);

  const [group, setGroup] = useState<PopulationGroup>("Children");
  const [facility, setFacility] = useState<FacilityName>("Playground");
  const [equityYear, setEquityYear] = useState<Year>("2020");
  const [facilityParkId, setFacilityParkId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(publicAssetPath("data/park_summary_public.csv")).then((response) => {
        if (!response.ok) throw new Error("Park summary could not be loaded.");
        return response.text();
      }),
      fetch(publicAssetPath("data/facility_equity_evidence.csv")).then((response) => {
        if (!response.ok) throw new Error("Facility evidence could not be loaded.");
        return response.text();
      }),
    ])
      .then(([parkText, evidenceText]) => {
        if (!active) return;
        const parsedParks = parseParks(parseCsv(parkText));
        const parsedEvidence = parseEvidence(parseCsv(evidenceText));
        if (parsedParks.length !== 237 || parsedEvidence.length !== 168) {
          throw new Error("The approved public evidence is incomplete.");
        }
        setParks(parsedParks);
        setEvidence(parsedEvidence);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "The data could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  const parkTypes = useMemo(() => [...new Set(parks.map((park) => park.type))].sort(), [parks]);
  const managementPriorities = useMemo(() => [...new Set(parks.map((park) => park.priority))].sort(), [parks]);

  const filteredParks = useMemo(() => {
    const selectedKeys = selectedFacilities.map((name) => facilityKey(name as FacilityName));
    return parks.filter((park) =>
      (types.length === 0 || types.includes(park.type)) &&
      (priorities.length === 0 || priorities.includes(park.priority)) &&
      (selectedKeys.length === 0 || selectedKeys.some((key) => park.facilities[key] !== "None")),
    );
  }, [parks, types, priorities, selectedFacilities]);

  const selectedPark = filteredParks.find((park) => park.id === selectedParkId) ?? null;
  const facilitySelectedPark = parks.find((park) => park.id === facilityParkId) ?? null;

  const parkMapBounds = useMemo<[[number, number], [number, number]]>(() => {
    if (parks.length === 0) return [[-97.92, 30.13], [-97.60, 30.50]];
    return [
      [Math.min(...parks.map((park) => park.longitude)), Math.min(...parks.map((park) => park.latitude))],
      [Math.max(...parks.map((park) => park.longitude)), Math.max(...parks.map((park) => park.latitude))],
    ];
  }, [parks]);

  const parkMapModel = useMemo(
    () => buildParkUseGeoJson(filteredParks, metric, parkYear),
    [filteredParks, metric, parkYear],
  );

  const parkTypeRows = useMemo(() => {
    const grouped = new Map<string, Park[]>();
    filteredParks.forEach((park) => grouped.set(park.type, [...(grouped.get(park.type) ?? []), park]));
    return [...grouped.entries()].map(([label, members]) => ({
      label,
      count: members.length,
      value: median(members.map((park) => park.visits[parkYear])) ?? 0,
    })).sort((a, b) => b.value - a.value);
  }, [filteredParks, parkYear]);

  const groupEvidence = useMemo(() => evidence.filter((row) => row.group === group), [evidence, group]);
  const facilityEvidence = useMemo(
    () => groupEvidence.filter((row) => row.facility === facility).sort((a, b) => a.year.localeCompare(b.year)),
    [groupEvidence, facility],
  );
  const currentEvidence = facilityEvidence.find((row) => row.year === equityYear) ?? null;
  const selectedFacilityKey = facilityKey(facility);
  const facilityParks = useMemo(
    () => parks.filter((park) => park.facilities[selectedFacilityKey] !== "None"),
    [parks, selectedFacilityKey],
  );
  const facilityMapModel = useMemo(
    () => buildFacilityMapGeoJson(
      parks,
      facility,
      equityYear,
      (park) => park.facilities[selectedFacilityKey],
    ),
    [equityYear, facility, parks, selectedFacilityKey],
  );

  const resetParkFilters = () => {
    setParkYear("2020");
    setMetric("visits");
    setTypes([]);
    setSelectedFacilities([]);
    setPriorities([]);
    setSelectedParkId(null);
    setParkMapResetKey((value) => value + 1);
  };

  const resetEquity = () => {
    setGroup("Children");
    setFacility("Playground");
    setEquityYear("2020");
    setFacilityParkId(null);
  };

  return (
    <>
      <header className="site-nav">
        <a className="wordmark" href="#top" aria-label="Social Equity in Park Facilities Under Public Health Disruption home">
          <span className="wordmark-dot" />
          <span>Social Equity in Park Usage</span>
        </a>
        <nav aria-label="Section navigation">
          <a href="#overview">Overview</a>
          <a href="#park-use">Park Use</a>
          <a href="#facility-equity">Facility Equity</a>
          <a href="#findings">Findings</a>
          <a href="#methods">Methods</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero page-section">
          <div className="hero-copy">
            <p className="eyebrow">Austin, Texas · Public-health disruption</p>
            <h1>Social Equity in Park Facilities</h1>
            <p className="hero-subtitle">An Interactive Explorer of Park Use in Austin</p>
            <p className="hero-description">Explore how park use and facility-related equity patterns changed before and during the COVID-19 pandemic.</p>
            <div className="hero-actions">
              <a className="button primary" href="#park-use">Explore Park Use</a>
              <a className="button secondary" href="#facility-equity">Explore Facility Equity</a>
            </div>
          </div>
        </section>

        <section id="overview" className="page-section overview-section">
          <div className="section-heading">
            <p className="eyebrow">OVERVIEW</p>
            <h2>Parks as everyday social infrastructure</h2>
          </div>
          <div className="overview-intro-grid">
            <div className="overview-copy">
              <p>Urban parks provide places for physical activity, social connection, recreation, and contact with nature. Yet opportunities to use and benefit from these spaces are not experienced equally across communities.</p>
              <p>Using Austin and the COVID-19 pandemic as a case study, this interactive project connects estimated park visits with facilities and neighborhood demographics. Across 237 parks and 14 facility categories, it looks beyond where amenities are located to examine how facility-related use patterns differed among population groups during a major public-health disruption.</p>
            </div>
            <aside className="target-users-panel">
              <h3>Target users</h3>
              <ul>
                <li>Urban planners and parks departments</li>
                <li>Public-health practitioners</li>
                <li>Community organizations and advocates</li>
                <li>Researchers and students</li>
                <li>Austin residents</li>
              </ul>
            </aside>
          </div>
          <div className="overview-cards">
            <article><h3>Project Background</h3><p>Public-health disruptions can change how people reach and use everyday public spaces while revealing inequalities that already exist. Austin’s park system provides a citywide case for examining how park-use patterns shifted before and during COVID-19.</p></article>
            <article><h3>Equity Focus</h3><p>The project examines facility-related use patterns for women, children, older adults, and Hispanic communities. It considers both spatial provision—where park facilities are located—and observed use—who visits parks with those facilities.</p></article>
            <article><h3>App Motivation</h3><p>Park-equity research can be difficult to interpret outside academic settings. This explorer translates aggregated and anonymized mobility estimates, public park records, neighborhood demographics, and fixed-effects results into accessible maps, comparisons, and evidence summaries.</p></article>
          </div>
        </section>

        <section id="park-use" className="page-section explorer-section">
          <div className="explorer-heading">
            <p className="part-label">Part 1</p>
            <h2>Park Usage Patterns During a Public Health Disruption</h2>
            <p>Explore how park visits across Austin changed before the outbreak, during the high-intensity pandemic phase, and through the subsequent adaptation phase.</p>
          </div>
          {error ? <div className="error-card" role="alert"><strong>Evidence unavailable</strong><p>{error}</p></div> : null}
          {!error && parks.length === 0 ? <LoadingState /> : null}
          {parks.length > 0 ? (
            <>
              <div className="control-row park-controls">
                <YearControl value={parkYear} onChange={setParkYear} label="Study period" showStudyPhases />
                <MetricSelect value={metric} onChange={setMetric} />
                <MultiFilter label="Park type" options={parkTypes} selected={types} onChange={(value) => { setTypes(value); setSelectedParkId(null); }} />
                <MultiFilter label="Facilities" options={FACILITIES.map(([name]) => name)} selected={selectedFacilities} onChange={(value) => { setSelectedFacilities(value); setSelectedParkId(null); }} helper="match any selected facility" />
                <MultiFilter label="Management" options={managementPriorities} selected={priorities} onChange={(value) => { setPriorities(value); setSelectedParkId(null); }} />
                <button className="reset-button" type="button" onClick={resetParkFilters}>Reset</button>
              </div>
              <div className="explorer-workspace park-workspace">
                  <AustinParkMap
                    data={parkMapModel.data}
                    legend={parkMapModel.legend}
                    selectedId={selectedParkId}
                    onSelect={setSelectedParkId}
                    initialBounds={parkMapBounds}
                    resetKey={parkMapResetKey}
                  />
                  <aside className="evidence-panel park-panel" aria-label="Park use evidence panel">
                    {selectedPark ? (
                      <div className="park-profile">
                        <button className="back-button" type="button" onClick={() => setSelectedParkId(null)}>← Back to summary</button>
                        <p className="panel-kicker">Selected park</p>
                        <h3>{selectedPark.name}</h3>
                        <p className="profile-type">{selectedPark.type}</p>
                        <dl className="profile-facts"><div><dt>Area</dt><dd>{formatValue(selectedPark.acres, "decimal")} acres</dd></div><div><dt>Management</dt><dd>{selectedPark.priority || "Not available"}</dd></div><div><dt>Facilities</dt><dd>{formatValue(selectedPark.facilityTotal)}</dd></div></dl>
                        <div className="panel-divider" />
                        <h4>Facility availability</h4>
                        <div className="facility-chips">
                          {FACILITIES.map(([name, key]) => <span key={key} className={selectedPark.facilities[key] !== "None" ? "present" : "absent"}>{name}<b>{selectedPark.facilities[key]}</b></span>)}
                        </div>
                        <div className="panel-divider" />
                        <h4>Estimated park visits</h4>
                        <LineChart values={selectedPark.visits} selectedYear={parkYear} label={`Estimated visits for ${selectedPark.name}`} compact />
                        <h4>Visitor-origin breadth</h4>
                        <LineChart values={selectedPark.originBreadth} selectedYear={parkYear} label={`Visitor-origin breadth for ${selectedPark.name}`} compact />
                      </div>
                    ) : (
                      <div className="summary-panel">
                        <div className="panel-title-row park-profile-prompt"><div><p className="panel-kicker">Park profile</p><h3>Select a park to view its profile</h3></div></div>
                        <div className="kpi-group">
                          <div><span>Parks displayed</span><strong>{filteredParks.length}</strong></div>
                          <div><span>Median estimated visits</span><strong>{formatValue(median(filteredParks.map((park) => park.visits[parkYear])))}</strong></div>
                          <div><span>Median origin breadth</span><strong>{formatValue(median(filteredParks.map((park) => park.originBreadth[parkYear])))}</strong></div>
                        </div>
                        {filteredParks.length === 0 ? (
                          <div className="park-summary-empty">
                            <strong>No parks match these filters</strong>
                            <p>Adjust a selection or restore the default view.</p>
                            <button className="button primary" type="button" onClick={resetParkFilters}>Reset filters</button>
                          </div>
                        ) : (
                          <>
                            <div className="panel-divider" />
                            <div className="panel-title-row"><div><p className="panel-kicker">Comparison</p><h3>Median visits by park type</h3></div><span>{parkYear}</span></div>
                            <ParkTypeBars rows={parkTypeRows} />
                            <p className="panel-prompt">Select a park point to view its facility profile and three-year record.</p>
                          </>
                        )}
                      </div>
                    )}
                  </aside>
                </div>
            </>
          ) : null}
        </section>

        <section className="bridge-section page-section">
          <div><p className="eyebrow">Analytical bridge</p><h2>From park use to facility equity</h2><p>Overall park-use patterns show where activity occurred, but they do not show how facility associations differed across population groups. The second explorer uses fully adjusted fixed-effects models to examine those facility-related equity patterns.</p></div>
          <div className="bridge-compare">
            <article><span>Park Use Explorer</span><strong>Descriptive park-level summaries</strong><p>Shows where parks and facilities are located and supports park-specific profiles.</p></article>
            <span className="bridge-arrow">→</span>
            <article><span>Facility Equity Explorer</span><strong>Sample-level model associations</strong><p>Compares facility coefficients by population group without assigning them to individual parks.</p></article>
          </div>
        </section>

        <section id="facility-equity" className="page-section explorer-section equity-section">
          <div className="explorer-heading">
            <p className="part-label">Part 2</p>
            <h2>Exploring facility equity across population groups</h2>
            <p>Compare how 14 park facilities were associated with visits from women, children, older adults, and Hispanic residents across the three study years.</p>
          </div>
          {evidence.length > 0 ? (
            <>
              <div className="control-row equity-controls">
                <div className="group-field" role="group" aria-labelledby="population-group-label"><span className="group-label" id="population-group-label">Population group</span><div className="group-buttons">{GROUPS.map((item) => <button key={item} type="button" className={item === group ? "selected" : ""} aria-pressed={item === group} onClick={() => setGroup(item)}>{item}</button>)}</div></div>
                <label className="control-box select-control facility-select"><span>Facility</span><select value={facility} onChange={(event) => { setFacility(event.target.value as FacilityName); setFacilityParkId(null); }}>{FACILITIES.map(([name]) => <option key={name}>{name}</option>)}</select></label>
                <YearSelect value={equityYear} onChange={setEquityYear} />
                <button className="reset-button" type="button" onClick={resetEquity}>Reset</button>
              </div>
              <div className="explorer-workspace equity-workspace">
                <div>
                  <AustinParkMap
                    data={facilityMapModel.data}
                    legend={facilityMapModel.legend}
                    selectedId={facilityParkId}
                    onSelect={setFacilityParkId}
                    initialBounds={parkMapBounds}
                    resetKey={0}
                  />
                  <div className="distribution-summary">
                    <div><span>Parks with {facility}</span><strong>{facilityParks.length}</strong></div>
                    <div><span>Share of study parks</span><strong>{parks.length ? `${Math.round((facilityParks.length / parks.length) * 100)}%` : "—"}</strong></div>
                    <div><span>Medium/high availability</span><strong>{parks.filter((park) => ["Medium", "High"].includes(park.facilities[selectedFacilityKey])).length}</strong></div>
                  </div>
                  {facilitySelectedPark ? <div className="selected-map-note"><button type="button" onClick={() => setFacilityParkId(null)} aria-label="Close selected park details">×</button><strong>{facilitySelectedPark.name}</strong><span>{facilitySelectedPark.type} · {facility} availability: {facilitySelectedPark.facilities[selectedFacilityKey]} · {formatValue(facilitySelectedPark.visits[equityYear])} estimated visits · {formatValue(facilitySelectedPark.acres, "decimal")} acres</span></div> : null}
                </div>
                <aside className="evidence-panel equity-panel" aria-label="Facility equity evidence panel">
                  {currentEvidence ? (
                    <>
                      <div className="panel-title-row"><div><p className="panel-kicker">Association across years</p><h3>Coefficient plot</h3></div><span>Filled = significant</span></div>
                      <CoefficientPlot rows={facilityEvidence} selectedYear={equityYear} />
                      <div className={`interpretation-callout ${directionClass(currentEvidence.direction)}`}><span className="info-icon">i</span><div><h3>What this means</h3><p>{currentEvidence.interpretation}</p></div></div>
                      <div className="matrix-heading"><div><p className="panel-kicker">All 42 combinations</p><h3>Facility evidence matrix</h3></div><div className="matrix-legend"><span className="positive">+ Positive</span><span className="negative">− Negative</span><span className="unclear">· No clear evidence</span></div></div>
                      <EvidenceMatrix rows={groupEvidence} selectedFacility={facility} selectedYear={equityYear} onSelect={(nextFacility, nextYear) => { setFacility(nextFacility); setEquityYear(nextYear); setFacilityParkId(null); }} />
                    </>
                  ) : <div className="error-card"><strong>Evidence unavailable</strong><p>This combination could not be found in the approved table.</p></div>}
                </aside>
              </div>
              <p className="evidence-footnote">All 168 population-group × facility × year combinations are loaded from the approved fully adjusted fixed-effects model table. Direction and significance follow the source evidence exactly.</p>
            </>
          ) : null}
        </section>

        <section id="findings" className="page-section findings-section">
          <div className="section-heading narrow"><p className="eyebrow">Findings</p><h2>What the evidence shows</h2><p>These conclusions separate descriptive park-use patterns from model-based facility associations.</p></div>
          <div className="findings-grid">
            <article><span>01</span><h3>Park use shifted during disruption</h3><p>Median estimated visits changed across the study period, underscoring the need to compare annual patterns rather than rely on a single snapshot.</p><small>Descriptive park-level evidence</small></article>
            <article><span>02</span><h3>Facility patterns differed by group</h3><p>The direction and strength of facility associations varied across women, children, older adults, and Hispanic residents.</p><small>Fully adjusted model evidence</small></article>
            <article><span>03</span><h3>Facility associations were not uniform</h3><p>Playgrounds showed consistent positive associations for children and older adults, while other facilities displayed contrasting patterns across groups.</p><small>Association, not causal proof</small></article>
          </div>
          <div className="findings-figure-grid">
            <figure className="finding-figure">
              <div className="finding-figure-media"><img src={publicAssetPath("figures/figure%2001.png")} alt="Park-use volume and diversity patterns by park type across the study period" /></div>
              <figcaption>Park-use patterns across the study period.</figcaption>
            </figure>
            <figure className="finding-figure">
              <div className="finding-figure-media"><img src={publicAssetPath("figures/figure%2002.jpg")} alt="Facility association patterns for four population groups across the study period" /></div>
              <figcaption>Facility patterns across population groups.</figcaption>
            </figure>
            <figure className="finding-figure">
              <div className="finding-figure-media"><img src={publicAssetPath("figures/figure%2003.jpg")} alt="Adjusted facility and population-group associations across the study period" /></div>
              <figcaption>Adjusted facility–group associations.</figcaption>
            </figure>
          </div>
          <div className="planning-strip"><div><p className="eyebrow">Planning implications</p><h3>Use the evidence as a decision prompt</h3></div><ul><li>Consider population needs when investing in facilities.</li><li>Maintain a balanced mix of active, social, educational, and lower-barrier spaces.</li><li>Evaluate whether facilities remain usable and welcoming during public-health disruption.</li></ul></div>
        </section>

        <section id="methods" className="page-section methods-section">
          <div className="methods-content">
            <header className="methods-heading">
              <p className="eyebrow">Methods</p>
              <h2>Materials and Methods</h2>
              <p>This study combined anonymized mobility estimates, verified park records, and neighborhood demographic data to examine how park use and facility-related equity patterns changed before and during COVID-19.</p>
            </header>

            <section className="methods-subsection" aria-labelledby="methods-data-sources">
              <h3 id="methods-data-sources">Data Sources and Collection</h3>
              <div className="methods-row methods-row-data">
                <article className="methods-card">
                  <p className="methods-module-number">01 · What data?</p>
                  <h4>Data Sources</h4>
                  <div className="methods-prose">
                    <p>Aggregated and anonymized smartphone mobility data came from SafeGraph and Advan. Core Places identified park locations, while Patterns described estimated visits, visit duration, and visitors’ home Census Block Groups.</p>
                    <p>Trips were limited to journeys of no more than 20 miles from residential areas to Austin parks. Researchers verified 241 potential park locations against Austin Parks and Recreation records and other public sources; this application includes 237 parks with complete records.</p>
                    <p>Park records were linked with 14 facility categories, park size, trail length, tree-canopy coverage, surrounding land use, travel distance, and neighborhood demographic and socioeconomic characteristics.</p>
                  </div>
                </article>

                <article className="methods-card">
                  <p className="methods-module-number">02 · How was visitation measured?</p>
                  <h4>Park Visit Measurement from Mobile Location Data</h4>
                  <div className="methods-prose">
                    <p>SafeGraph and Advan suppressed home Block Groups with fewer than five observed devices and added privacy protection to sensitive variables. Records reported as exactly four visitors were excluded. Weekly visits from each Block Group to each park POI were then adjusted for changes in the local device sampling rate.</p>
                    <p className="methods-equation" aria-label="Estimated visitors equals observed smartphone visitors multiplied by block group population, divided by sampled devices">Visitors_BG_P<sub>i,k,t</sub> = (Visitors_SG_BG_P<sub>i,k,t</sub> × POP<sub>i</sub>) / SGD<sub>i,t</sub></p>
                    <p className="methods-equation-note"><strong>Eq. 1.</strong> Observed devices traveling from Block Group <em>i</em> to park <em>k</em> in week <em>t</em> were scaled by the Block Group population and the number of sampled devices. Weekly park visitation was the sum of these adjusted Block Group-to-park estimates.</p>
                    <p>Mobility observations were linked to Census Block Group demographics using shared GEOID identifiers, allowing park-use estimates to be examined alongside age, income, and other neighborhood characteristics.</p>
                  </div>
                </article>
              </div>
            </section>

            <section className="methods-subsection" aria-labelledby="methods-statistical-analysis">
              <h3 id="methods-statistical-analysis">Statistical Analysis</h3>
              <div className="methods-row methods-row-statistics">
                <article className="methods-card methods-table-card" aria-labelledby="methods-table-title">
                  <p className="methods-module-number">03 · What variables?</p>
                  <h4 id="methods-table-title">Variables Influencing Park Visitation</h4>
                  <div className="methods-table-scroll" role="region" aria-label="Table of variables influencing park visitation">
                    <table className="methods-table">
                      <colgroup><col className="methods-variable-column" /><col /></colgroup>
                      <thead><tr><th scope="col">Variable Category / Variable Name</th><th scope="col">Definition</th></tr></thead>
                      <tbody>
                        <tr className="methods-category-row"><th colSpan={2} scope="rowgroup">Dependent Variable</th></tr>
                        <tr><th scope="row">Park Visitation Frequency</th><td>The number of visits to a park within a specified period.</td></tr>
                        <tr className="methods-category-row"><th colSpan={2} scope="rowgroup">Independent Variable</th></tr>
                        <tr><th scope="row">Park Facilities Count</th><td>The count of different types of facilities within the park, including golf, soccer, memorial, gym, shade area facility, volleyball, swimming pool, tennis, playground, baseball, recreation center, basketball, garden center, and parking lot.</td></tr>
                        <tr className="methods-category-row"><th colSpan={2} scope="rowgroup">Target Demographic Variables</th></tr>
                        <tr><th scope="row">Women</th><td>Female visitors of any age.</td></tr>
                        <tr><th scope="row">Children</th><td>Visitors under the age of 18.</td></tr>
                        <tr><th scope="row">Older adults</th><td>Visitors aged 65 and older.</td></tr>
                        <tr><th scope="row">Ethnic Minorities</th><td>Visitors who identified as Hispanic.</td></tr>
                        <tr className="methods-category-row"><th colSpan={2} scope="rowgroup">Covariates</th></tr>
                        <tr><th scope="row">Trail Length</th><td>Total length of walking, biking, and leisure trails within the park.</td></tr>
                        <tr><th scope="row">Canopy Coverage</th><td>Average coverage of tree canopy in the park.</td></tr>
                        <tr><th scope="row">Park Acres</th><td>Total area of the park in acres.</td></tr>
                        <tr><th scope="row">Mixed Land Use</th><td>Areas within or adjacent to the park that serve both residential and commercial purposes.</td></tr>
                        <tr><th scope="row">Commercial Development</th><td>Commercially developed areas within or adjacent to the park.</td></tr>
                        <tr><th scope="row">Office Presence</th><td>Presence of office buildings within or adjacent to the park.</td></tr>
                        <tr><th scope="row">Undeveloped Land</th><td>Areas within or surrounding the park that are not developed.</td></tr>
                        <tr><th scope="row">Industrial Area</th><td>Industrial areas within or adjacent to the park.</td></tr>
                        <tr><th scope="row">Civic Facilities</th><td>Civic buildings and facilities within or near the park.</td></tr>
                        <tr><th scope="row">Residential Area</th><td>Residential areas within or adjacent to the park.</td></tr>
                        <tr className="methods-category-row"><th colSpan={2} scope="rowgroup">Control Variables</th></tr>
                        <tr><th scope="row">Travel Distance</th><td>Distance traveled by visitors to reach the park, usually measured from their home or origin.</td></tr>
                        <tr><th scope="row">Poverty Rate</th><td>Percentage of the population living below the poverty line in the area surrounding the park.</td></tr>
                        <tr><th scope="row">Median Household Income</th><td>Median income of households in the area surrounding the park.</td></tr>
                        <tr><th scope="row">Education Level</th><td>Percentage of the population with a bachelor’s degree or higher in the area surrounding the park.</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="methods-table-note">These variables distinguish facility-related patterns from differences in park size, surrounding environments, travel distance, and neighborhood socioeconomic conditions.</p>
                </article>

                <article className="methods-card">
                  <p className="methods-module-number">04 · How were they analyzed?</p>
                  <h4>Statistical Analysis</h4>
                  <div className="methods-prose">
                    <p>The analysis compared three study periods: 2019 as the pre-pandemic period, 2020 as the high-intensity pandemic period, and 2021 as the adaptation period.</p>
                    <p>The data were cleaned and standardized so that parks, facilities, and years could be compared consistently. Descriptive analysis documented changes in park visits and visitor diversity across years and park types.</p>
                    <p>Pearson or Spearman correlation tests were selected according to the distribution of the data to examine associations between facility types, park visits, and visitor diversity.</p>
                    <p>Fixed-effects models examined facility-related park-use patterns while accounting for differences between parks and changes over time. The models tested relationships for women, children under 18, adults aged 65 and older, and Hispanic populations.</p>
                    <p>The models also accounted for park size, trails, tree canopy, surrounding land use, travel distance, poverty rate, median household income, and education level.</p>
                  </div>
                </article>
              </div>
            </section>

            <p className="methods-bottom-note">The results describe statistical associations between park facilities and park-use patterns. They should not be interpreted as proof that a facility directly caused an increase or decrease in visits.</p>
            <aside className="methods-citation" aria-label="Citation">
              <p className="panel-kicker">Citation</p>
              <h3>Original Research Article</h3>
              <p>Peijin Sun and Pai Liu. “Social equity in park facilities: Assessing park usage patterns during the COVID-19 pandemic.” <em>Urban Forestry & Urban Greening</em>, Volume 117, March 2026, Article 129249.</p>
              <a href="https://doi.org/10.1016/j.ufug.2025.129249" target="_blank" rel="noreferrer">View the publication via DOI ↗</a>
            </aside>
          </div>
        </section>
      </main>

      <footer><span>Social Equity in Park Facilities Under Public Health Disruption</span><span>Aggregated evidence · No individual mobility records</span><a href="#top">Back to top ↑</a></footer>
    </>
  );
}
