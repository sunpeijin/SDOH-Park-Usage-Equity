import {
  PARK_USE_COLORS,
  type ParkUseFeatureCollection,
  type ParkUseLegend,
  type ParkUseMapPark,
  type ParkUseYear,
} from "./park-use-data";

type FacilityMapModel = {
  data: ParkUseFeatureCollection;
  legend: ParkUseLegend;
};

export type FacilityAvailability = "None" | "Low" | "Medium" | "High";

const AVAILABILITY_LEVELS = ["Low", "Medium", "High"] as const;
const AVAILABILITY_COLORS: Record<(typeof AVAILABILITY_LEVELS)[number], string> = {
  Low: PARK_USE_COLORS[1],
  Medium: PARK_USE_COLORS[2],
  High: PARK_USE_COLORS[4],
};

function facilityBands(values: FacilityAvailability[]): {
  colors: readonly string[];
  ranges: string[];
  bandFor: (value: FacilityAvailability) => number;
} {
  const activeLevels = AVAILABILITY_LEVELS.filter((level) => values.includes(level));

  return {
    colors: activeLevels.map((level) => AVAILABILITY_COLORS[level]),
    ranges: [...activeLevels],
    bandFor: (value) => activeLevels.indexOf(value as (typeof AVAILABILITY_LEVELS)[number]),
  };
}

export function buildFacilityMapGeoJson<TPark extends ParkUseMapPark>(
  parks: TPark[],
  facilityLabel: string,
  year: ParkUseYear,
  facilityAvailability: (park: TPark) => FacilityAvailability,
): FacilityMapModel {
  const availabilityValues = parks.map((park) => facilityAvailability(park));
  const bands = facilityBands(availabilityValues);
  const label = `${facilityLabel} availability`;

  return {
    data: {
      type: "FeatureCollection",
      features: parks.map((park) => {
        const availability = facilityAvailability(park);
        return {
          type: "Feature",
          id: park.id,
          geometry: { type: "Point", coordinates: [park.longitude, park.latitude] },
          properties: {
            id: park.id,
            name: park.name,
            parkType: park.type,
            year,
            metric: "facilities",
            metricLabel: label,
            metricValue: availability === "None" ? null : bands.bandFor(availability) + 1,
            metricDisplay: availability,
            colorBand: availability === "None" ? -1 : bands.bandFor(availability),
          },
        };
      }),
    },
    legend: {
      label,
      colors: bands.colors,
      ranges: bands.ranges,
      hasMissingValues: false,
      specialLabel: "None",
    },
  };
}
