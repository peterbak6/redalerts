import { useEffect, useState, useMemo, useCallback } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

// ─── Types ───────────────────────────────────────────────────────────────────
type Alert = { cities: string[] };
type DayData = { day: string; count: number; alerts: Alert[] };
type CityInfo = { lat: number; lng: number; area?: number };
type CityDot = {
  name: string;
  position: [number, number];
  alertCount: number;
  population: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL;
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const INITIAL_VIEW_STATE = {
  longitude: 34.8516,
  latitude: 31.4,
  zoom: 7.2,
  pitch: 0,
  bearing: 0,
};
const ALERT_COLORS: [number, number, number][] = [
  [255, 255, 204], // 1
  [255, 237, 160], // 2
  [254, 217, 118], // 3
  [254, 178, 76], // 4
  [253, 141, 60], // 5
  [252, 78, 42], // 6
  [227, 26, 28], // 7
  [189, 0, 38], // 8
  [128, 0, 38], // 9+
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function alertColor(count: number): [number, number, number, number] {
  if (count <= 0) return [0, 0, 0, 0];
  return [
    ...ALERT_COLORS[Math.min(count - 1, ALERT_COLORS.length - 1)],
    210,
  ] as [number, number, number, number];
}

function radiusFromPopulation(pop: number): number {
  if (!pop || pop <= 0) return 1;
  return Math.min(30, Math.max(1, Math.sqrt(pop / 2000) + 1));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [dates, setDates] = useState<string[]>([]);
  const [dateIndex, setDateIndex] = useState(0);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [citiesRaw, setCitiesRaw] = useState<Record<string, CityInfo>>({});
  const [polygonsRaw, setPolygonsRaw] = useState<
    Record<string, [number, number][]>
  >({});
  const [populationRaw, setPopulationRaw] = useState<
    Record<string, number | null>
  >({});
  const [booting, setBooting] = useState(true);

  // Load static assets once
  useEffect(() => {
    Promise.all([
      fetchJson<string[]>(`${BASE}red-alert/dates.json`),
      fetchJson<{ cities: Record<string, CityInfo> }>(
        `${BASE}real-data/citiesList.json`,
      ),
      fetchJson<Record<string, [number, number][]>>(
        `${BASE}real-data/polygonsList.json`,
      ),
      fetchJson<Record<string, number | null>>(
        `${BASE}real-data/citiesPopulation.json`,
      ),
    ])
      .then(([dts, cities, polygons, pop]) => {
        setDates(dts);
        setCitiesRaw(cities.cities);
        setPolygonsRaw(polygons);
        setPopulationRaw(pop);
        setDateIndex(dts.length - 1); // start at the latest date
        setBooting(false);
      })
      .catch(console.error);
  }, []);

  // Load per-day alert data whenever the selected date changes
  useEffect(() => {
    if (!dates.length) return;
    fetchJson<DayData>(`${BASE}red-alert/${dates[dateIndex]}.json`)
      .then(setDayData)
      .catch(console.error);
  }, [dateIndex, dates]);

  // ── Layer data ──
  const polygonData = useMemo(
    () =>
      Object.values(polygonsRaw).map((coords) => ({
        // polygonsList stores [lat, lng]; DeckGL needs [lng, lat]
        polygon: coords.map(([lat, lng]) => [lng, lat]) as [number, number][],
      })),
    [polygonsRaw],
  );

  const cityDots = useMemo((): CityDot[] => {
    if (!dayData) return [];
    const counts: Record<string, number> = {};
    for (const alert of dayData.alerts)
      for (const city of alert.cities) counts[city] = (counts[city] ?? 0) + 1;

    return Object.entries(citiesRaw)
      .map(([name, info]) => ({
        name,
        position: [info.lng, info.lat] as [number, number],
        alertCount: counts[name] ?? 0,
        population:
          info.area != null ? (populationRaw[String(info.area)] ?? 0) : 0,
      }))
      .filter((d) => d.alertCount > 0); // only render cities with alerts
  }, [citiesRaw, populationRaw, dayData]);

  // ── DeckGL layers ──
  const layers = useMemo(
    () => [
      new PolygonLayer({
        id: "polygons",
        data: polygonData,
        getPolygon: (d) => d.polygon,
        getFillColor: [0, 20, 90, 80],
        getLineColor: [30, 80, 200, 180],
        lineWidthMinPixels: 1,
        pickable: false,
      }),
      new ScatterplotLayer<CityDot>({
        id: "cities",
        data: cityDots,
        getPosition: (d) => d.position,
        getRadius: (d) => radiusFromPopulation(d.population),
        getFillColor: (d) => alertColor(d.alertCount),
        radiusUnits: "pixels",
        radiusMinPixels: 3,
        pickable: true,
      }),
    ],
    [polygonData, cityDots],
  );

  const prev = useCallback(() => setDateIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setDateIndex((i) => Math.min(dates.length - 1, i + 1)),
    [dates.length],
  );

  if (booting) {
    return <div className="boot-screen">Loading data…</div>;
  }

  const selectedDate = dates[dateIndex];
  const totalAlerts = dayData?.count ?? 0;

  return (
    <div className="app">
      {/* ── Date slider overlay ── */}
      <div className="slider-panel">
        <div className="slider-top">
          <button className="nav-btn" onClick={prev} disabled={dateIndex === 0}>
            ←
          </button>
          <div className="date-info">
            <span className="date-label">{selectedDate}</span>
            <span className="alert-count">
              {totalAlerts.toLocaleString()} alerts
            </span>
          </div>
          <button
            className="nav-btn"
            onClick={next}
            disabled={dateIndex === dates.length - 1}
          >
            →
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={dateIndex}
          onChange={(e) => setDateIndex(Number(e.target.value))}
          className="date-range"
        />
        {/* Color legend */}
        <div className="legend">
          {ALERT_COLORS.map((rgb, i) => (
            <span
              key={i}
              className="legend-cell"
              style={{
                background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
              }}
              title={i < 8 ? String(i + 1) : "9+"}
            />
          ))}
          <span className="legend-label">1</span>
          <span className="legend-label" style={{ marginLeft: "auto" }}>
            9+
          </span>
        </div>
      </div>

      {/* ── Map ── */}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        getTooltip={({ object }) => {
          const d = object as CityDot | null;
          if (!d?.name || d.alertCount <= 0) return null;
          return {
            html: `<b>${d.name}</b><br/>${d.alertCount} alert${
              d.alertCount !== 1 ? "s" : ""
            }`,
          };
        }}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
    </div>
  );
}

export default App;
