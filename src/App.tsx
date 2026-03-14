import { useEffect, useState, useMemo, useCallback } from "react";
import DeckGL from "@deck.gl/react";
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "@vis.gl/react-maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import LegendPanel from "./LegendPanel";
import { buildTooltip, type CityDot } from "./TooltipPanel";
import { BASE, MAP_STYLE, INITIAL_VIEW_STATE } from "./constants";
import { alertColor, radiusFromPopulation, buildZoneAliases } from "./utils";
import { type Lang } from "./i18n";

maplibregl.setRTLTextPlugin(
  `${window.location.origin}${import.meta.env.BASE_URL}mapbox-gl-rtl-text.js`,
  false,
);

// ─── Types ───────────────────────────────────────────────────────────────────
type Alert = { cities: string[]; timestampIso: string };
type DayData = { day: string; count: number; alerts: Alert[] };
type CityInfo = { id: number; lat: number; lng: number; en?: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  const [lang, setLang] = useState<Lang>("he");

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

  // ── Zone alias map (computed once: maps sub-zone names → representative zone) ──
  const zoneAliases = useMemo(
    () => buildZoneAliases(citiesRaw, populationRaw),
    [citiesRaw, populationRaw],
  );

  const cityDots = useMemo((): CityDot[] => {
    if (!dayData) return [];

    const timeFmt = new Intl.DateTimeFormat([], {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Raw per-zone alert counts and times
    const rawCounts: Record<string, number> = {};
    const rawTimes: Record<string, string[]> = {};
    for (const alert of dayData.alerts) {
      const t = timeFmt.format(new Date(alert.timestampIso));
      for (const city of alert.cities) {
        rawCounts[city] = (rawCounts[city] ?? 0) + 1;
        if (!rawTimes[city]) rawTimes[city] = [];
        rawTimes[city].push(t);
      }
    }

    // Aggregate into representatives using MAX count; merge all times
    const counts: Record<string, number> = {};
    const times: Record<string, string[]> = {};
    for (const [name, count] of Object.entries(rawCounts)) {
      const rep = zoneAliases[name] ?? name;
      counts[rep] = Math.max(counts[rep] ?? 0, count);
      if (!times[rep]) times[rep] = [];
      times[rep].push(...(rawTimes[name] ?? []));
    }
    // Sort and deduplicate times per city
    for (const rep of Object.keys(times)) {
      times[rep] = [...new Set(times[rep])].sort();
    }

    return Object.entries(citiesRaw)
      .filter(([name]) => !zoneAliases[name]) // skip non-representative zones
      .map(([name, info]) => ({
        name,
        englishName: info.en ? info.en.split(" - ")[0] : name.split(" - ")[0],
        position: [info.lng, info.lat] as [number, number],
        alertCount: counts[name] ?? 0,
        population: populationRaw[String(info.id)] ?? 0,
        times: times[name] ?? [],
      }))
      .filter((d) => d.alertCount > 0);
  }, [citiesRaw, populationRaw, zoneAliases, dayData]);

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
        pickable: true,
        // transitions: {
        //   getRadius: { duration: 200, enter: () => [0] },
        //   getFillColor: { duration: 200, enter: () => [0, 0, 0, 0] },
        // },
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

  const totalAlerts = dayData?.count ?? 0;

  return (
    <div className="app">
      <LegendPanel
        dates={dates}
        dateIndex={dateIndex}
        totalAlerts={totalAlerts}
        lang={lang}
        onPrev={prev}
        onNext={next}
        onSliderChange={setDateIndex}
        onLangChange={setLang}
      />

      {/* ── Map ── */}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        getTooltip={({ object }) => buildTooltip(object, lang)}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
    </div>
  );
}

export default App;
