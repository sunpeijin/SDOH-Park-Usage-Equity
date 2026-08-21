"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  Popup as MapLibrePopup,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  PARK_USE_COLORS,
  PARK_USE_MISSING_COLOR,
  type ParkUseFeatureCollection,
  type ParkUseLegend,
  type ParkUseMapProperties,
} from "../lib/park-use-data";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const SOURCE_ID = "austin-park-use-points";
const POINT_LAYER_ID = "austin-park-use-points-layer";
const HOVER_LAYER_ID = "austin-park-use-hover-layer";
const SELECTED_LAYER_ID = "austin-park-use-selected-layer";
const EMPTY_FILTER: FilterSpecification = ["==", ["get", "id"], "__no_park_selected__"];

type AustinParkMapProps = {
  data: ParkUseFeatureCollection;
  legend: ParkUseLegend;
  selectedId: string | null;
  onSelect: (parkId: string) => void;
  initialBounds: [[number, number], [number, number]];
  resetKey: number;
};

function pointColorExpression(colors: readonly string[]): ExpressionSpecification {
  return [
    "match",
    ["get", "colorBand"],
    -1,
    PARK_USE_MISSING_COLOR,
    0,
    colors[0] ?? PARK_USE_COLORS[0],
    1,
    colors[1] ?? PARK_USE_MISSING_COLOR,
    2,
    colors[2] ?? PARK_USE_MISSING_COLOR,
    3,
    colors[3] ?? PARK_USE_MISSING_COLOR,
    4,
    colors[4] ?? PARK_USE_MISSING_COLOR,
    PARK_USE_MISSING_COLOR,
  ];
}

function parkFilter(parkId: string | null): FilterSpecification {
  return parkId ? ["==", ["get", "id"], parkId] : EMPTY_FILTER;
}

function tooltipContent(properties: ParkUseMapProperties): HTMLElement {
  const container = document.createElement("div");
  container.className = "austin-map-tooltip";
  const name = document.createElement("strong");
  name.textContent = properties.name;
  const type = document.createElement("span");
  type.textContent = properties.parkType;
  const metric = document.createElement("span");
  metric.textContent = `${properties.year} · ${properties.metricLabel}: ${properties.metricDisplay}`;
  container.append(name, type, metric);
  return container;
}

export default function AustinParkMap({
  data,
  legend,
  selectedId,
  onSelect,
  initialBounds,
  resetKey,
}: AustinParkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const onSelectRef = useRef(onSelect);
  const boundsRef = useRef(initialBounds);
  const resetKeyRef = useRef(resetKey);
  const selectedIdRef = useRef(selectedId);
  const dataRef = useRef(data);
  const legendRef = useRef(legend);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    boundsRef.current = initialBounds;
  }, [initialBounds]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    legendRef.current = legend;
  }, [legend]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let observedSize = { width: 0, height: 0 };

    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !containerRef.current) return;
      const container = containerRef.current;
      const map = new maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [-97.7431, 30.2672],
        zoom: 9.5,
        attributionControl: { compact: true },
      });
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      mapRef.current = map;
      popupRef.current = popup;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      resizeObserver = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width === observedSize.width && height === observedSize.height) return;
        observedSize = { width, height };
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          if (!disposed) map.resize();
        });
      });
      resizeObserver.observe(container);

      map.on("load", () => {
        if (disposed) return;
        map.resize();
        map.addSource(SOURCE_ID, { type: "geojson", data: dataRef.current });
        map.addLayer({
          id: POINT_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 12, 7, 15, 9],
            "circle-color": pointColorExpression(legendRef.current.colors),
            "circle-opacity": 0.92,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.25,
          },
        });
        map.addLayer({
          id: HOVER_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: EMPTY_FILTER,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 12, 10, 15, 12],
            "circle-color": pointColorExpression(legendRef.current.colors),
            "circle-stroke-color": "#06243a",
            "circle-stroke-width": 2.5,
          },
        });
        map.addLayer({
          id: SELECTED_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          filter: parkFilter(selectedIdRef.current),
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 10, 12, 12, 15, 14],
            "circle-color": pointColorExpression(legendRef.current.colors),
            "circle-stroke-color": "#06243a",
            "circle-stroke-width": 3.5,
          },
        });

        map.on("mouseenter", POINT_LAYER_ID, (event) => {
          const feature = event.features?.[0];
          const properties = feature?.properties as ParkUseMapProperties | undefined;
          if (!properties || feature?.geometry.type !== "Point") return;
          map.getCanvas().style.cursor = "pointer";
          map.setFilter(HOVER_LAYER_ID, parkFilter(properties.id));
          const coordinates = feature.geometry.coordinates as [number, number];
          popup.setLngLat(coordinates).setDOMContent(tooltipContent(properties)).addTo(map);
        });
        map.on("mouseleave", POINT_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          map.setFilter(HOVER_LAYER_ID, EMPTY_FILTER);
          popup.remove();
        });
        map.on("click", POINT_LAYER_ID, (event) => {
          const properties = event.features?.[0]?.properties as ParkUseMapProperties | undefined;
          if (properties?.id) onSelectRef.current(properties.id);
        });
        map.fitBounds(boundsRef.current as LngLatBoundsLike, { padding: 42, duration: 0, maxZoom: 12 });
        setMapReady(true);
      });
      map.on("error", (event) => {
        if (!map.loaded()) setMapError(event.error?.message ?? "The basemap could not be loaded.");
      });
    }).catch((reason: unknown) => {
      if (!disposed) setMapError(reason instanceof Error ? reason.message : "The map could not be initialized.");
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      popupRef.current?.remove();
      mapRef.current?.remove();
      popupRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(data);
  }, [data, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const expression = pointColorExpression(legend.colors);
    [POINT_LAYER_ID, HOVER_LAYER_ID, SELECTED_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) map.setPaintProperty(layerId, "circle-color", expression);
    });
  }, [legend.colors, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.getLayer(SELECTED_LAYER_ID)) return;
    map.setFilter(SELECTED_LAYER_ID, parkFilter(selectedId));
  }, [mapReady, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    map.fitBounds(initialBounds as LngLatBoundsLike, { padding: 42, duration: 450, maxZoom: 12 });
  }, [initialBounds, mapReady, resetKey]);

  const legendTitle = legend.label === "Estimated Park Visits" ? "Park Visits" : legend.label;

  return (
    <div className="map-shell austin-map-shell">
      <div
        ref={containerRef}
        className="austin-map-canvas"
        role="application"
        aria-label={`Interactive Austin park map showing ${data.features.length} parks colored by ${legend.label}`}
      />
      {!mapReady && !mapError ? <div className="austin-map-loading" role="status">Loading Austin basemap…</div> : null}
      {mapError ? <div className="austin-map-error" role="alert"><strong>Basemap unavailable</strong><span>{mapError}</span></div> : null}
      {data.features.length === 0 ? <div className="austin-map-empty"><strong>No parks match these filters</strong><span>Adjust a filter or reset the explorer.</span></div> : null}
      <label className="austin-map-selector">
        <span>Keyboard park selector</span>
        <select
          value={selectedId ?? ""}
          onChange={(event) => {
            if (event.target.value) onSelect(event.target.value);
          }}
        >
          <option value="">Select a displayed park</option>
          {data.features.map((feature) => <option key={feature.properties.id} value={feature.properties.id}>{feature.properties.name}</option>)}
        </select>
      </label>
      <div className="austin-map-legend" aria-label={`${legendTitle} legend`}>
        <strong>{legendTitle}</strong>
        <div className="austin-legend-items">
          {legend.colors.map((color, index) => (
            <span key={`${color}-${index}`}><i style={{ background: color }} />{legend.ranges[index]}</span>
          ))}
          {legend.specialLabel || legend.hasMissingValues ? <span><i style={{ background: PARK_USE_MISSING_COLOR }} />{legend.specialLabel ?? "Not available"}</span> : null}
        </div>
      </div>
    </div>
  );
}
