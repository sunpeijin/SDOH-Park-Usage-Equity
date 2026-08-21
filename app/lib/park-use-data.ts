export const PARK_USE_YEARS = ["2019", "2020", "2021"] as const;

export type ParkUseYear = (typeof PARK_USE_YEARS)[number];
export type ParkUseMetric = "visits" | "area" | "facilities";

export const PARK_USE_METRICS: ReadonlyArray<{
  value: ParkUseMetric;
  label: string;
  shortLabel: string;
}> = [
  { value: "visits", label: "Estimated Park Visits", shortLabel: "Estimated visits" },
  { value: "area", label: "Park Area", shortLabel: "Park area" },
  { value: "facilities", label: "Facility Count", shortLabel: "Facility count" },
];

export type ParkUseMapPark = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  acres: number | null;
  facilityTotal: number | null;
  visits: Record<ParkUseYear, number | null>;
};

export type ParkUseMapProperties = {
  id: string;
  name: string;
  parkType: string;
  year: ParkUseYear;
  metric: ParkUseMetric;
  metricLabel: string;
  metricValue: number | null;
  metricDisplay: string;
  colorBand: number;
};

export type ParkUsePointFeature = {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: ParkUseMapProperties;
};

export type ParkUseFeatureCollection = {
  type: "FeatureCollection";
  features: ParkUsePointFeature[];
};

export type ParkUseLegend = {
  label: string;
  colors: readonly string[];
  ranges: string[];
  hasMissingValues: boolean;
  specialLabel?: string;
};

export const PARK_USE_COLORS = ["#d6ece9", "#9fd2cd", "#59b2ab", "#178a86", "#064f50"] as const;
export const PARK_USE_MISSING_COLOR = "#aeb6b8";

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function parkUseMetricLabel(metric: ParkUseMetric): string {
  return PARK_USE_METRICS.find((item) => item.value === metric)?.label ?? "Metric";
}

export function parkUseMetricValue(
  park: ParkUseMapPark,
  metric: ParkUseMetric,
  year: ParkUseYear,
): number | null {
  if (metric === "visits") return park.visits[year];
  if (metric === "area") return park.acres;
  return park.facilityTotal;
}

function quantile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function valueBand(value: number | null, thresholds: number[]): number {
  if (value === null || !Number.isFinite(value)) return -1;
  for (let index = 0; index < thresholds.length; index += 1) {
    if (value <= thresholds[index]) return index;
  }
  return thresholds.length;
}

function formatMetric(value: number | null, metric: ParkUseMetric): string {
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (metric === "area") return `${decimalFormat.format(value)} acres`;
  return integerFormat.format(value);
}

function formatThreshold(value: number, metric: ParkUseMetric): string {
  return metric === "area" ? decimalFormat.format(value) : integerFormat.format(value);
}

export function buildParkUseGeoJson(
  parks: ParkUseMapPark[],
  metric: ParkUseMetric,
  year: ParkUseYear,
): { data: ParkUseFeatureCollection; legend: ParkUseLegend } {
  const values = parks
    .map((park) => parkUseMetricValue(park, metric, year))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((left, right) => left - right);
  const thresholds = [0.2, 0.4, 0.6, 0.8].map((percentile) => quantile(values, percentile));
  const minimum = values[0] ?? 0;
  const maximum = values.at(-1) ?? 0;
  const ranges = [
    `${formatThreshold(minimum, metric)}–${formatThreshold(thresholds[0] ?? minimum, metric)}`,
    `${formatThreshold(thresholds[0] ?? minimum, metric)}–${formatThreshold(thresholds[1] ?? minimum, metric)}`,
    `${formatThreshold(thresholds[1] ?? minimum, metric)}–${formatThreshold(thresholds[2] ?? maximum, metric)}`,
    `${formatThreshold(thresholds[2] ?? maximum, metric)}–${formatThreshold(thresholds[3] ?? maximum, metric)}`,
    `${formatThreshold(thresholds[3] ?? maximum, metric)}–${formatThreshold(maximum, metric)}`,
  ];
  const label = parkUseMetricLabel(metric);

  return {
    data: {
      type: "FeatureCollection",
      features: parks.map((park) => {
        const value = parkUseMetricValue(park, metric, year);
        return {
          type: "Feature",
          id: park.id,
          geometry: { type: "Point", coordinates: [park.longitude, park.latitude] },
          properties: {
            id: park.id,
            name: park.name,
            parkType: park.type,
            year,
            metric,
            metricLabel: label,
            metricValue: value,
            metricDisplay: formatMetric(value, metric),
            colorBand: valueBand(value, thresholds),
          },
        };
      }),
    },
    legend: {
      label,
      colors: PARK_USE_COLORS,
      ranges,
      hasMissingValues: values.length !== parks.length,
    },
  };
}
