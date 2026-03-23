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
type Alert = { serialNumber: number; cities: string[]; timestampIso: string };
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
  const [playing, setPlaying] = useState(false);

  const playInterval = 789; // ms per day while playing

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

  // ── All-time totals (denominator for % circles) ──
  const allCitiesCount = useMemo(
    () => Object.keys(citiesRaw).filter((name) => !zoneAliases[name]).length,
    [citiesRaw, zoneAliases],
  );
  const allPopulation = useMemo(
    () =>
      Object.entries(citiesRaw)
        .filter(([name]) => !zoneAliases[name])
        .reduce(
          (sum, [, info]) => sum + (populationRaw[String(info.id)] ?? 0),
          0,
        ),
    [citiesRaw, zoneAliases, populationRaw],
  );

  const cityDots = useMemo((): CityDot[] => {
    if (!dayData) return [];

    const timeFmt = new Intl.DateTimeFormat([], {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Map each serialNumber to its formatted time (first occurrence wins)
    const serialTime: Record<number, string> = {};
    // Map each sub-zone to the set of serialNumbers that hit it
    const rawSerials: Record<string, Set<number>> = {};
    for (const alert of dayData.alerts) {
      const t = timeFmt.format(new Date(alert.timestampIso));
      if (!(alert.serialNumber in serialTime))
        serialTime[alert.serialNumber] = t;
      for (const city of alert.cities) {
        if (!rawSerials[city]) rawSerials[city] = new Set();
        rawSerials[city].add(alert.serialNumber);
      }
    }

    // Aggregate into representatives: union serial sets across sub-zones
    const serialsByRep: Record<string, Set<number>> = {};
    for (const [name, serials] of Object.entries(rawSerials)) {
      const rep = zoneAliases[name] ?? name;
      if (!serialsByRep[rep]) serialsByRep[rep] = new Set();
      for (const s of serials) serialsByRep[rep].add(s);
    }

    // count = distinct serial numbers; times = one entry per serial (sorted)
    const counts: Record<string, number> = {};
    const times: Record<string, string[]> = {};
    for (const [rep, serials] of Object.entries(serialsByRep)) {
      counts[rep] = serials.size;
      times[rep] = [...new Set([...serials].map((s) => serialTime[s]))].sort();
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
        getLineColor: [0, 20, 90, 180],
        lineWidthMinPixels: 1,
        pickable: false,
      }),
      new ScatterplotLayer<CityDot>({
        id: "cities",
        data: cityDots.sort((a, b) => a.alertCount - b.alertCount),
        getPosition: (d) => [d.position[0], d.position[1], 1 / d.alertCount],
        getRadius: (d) => radiusFromPopulation(d.population),
        getFillColor: (d) => alertColor(d.alertCount),
        getLineColor: [255, 255, 255],
        getLineWidth: 1,
        radiusUnits: "pixels",
        stroked: true,
        pickable: true,
        transitions: {
          // getRadius: { duration: playInterval, enter: () => [0] },
          getFillColor: {
            duration: playInterval / 2,
            enter: () => [0, 0, 0, 0],
          },
        },
      }),
    ],
    [polygonData, cityDots],
  );

  // Advance one day every 200 ms while playing; stop at the last date
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setDateIndex((i) => (i >= dates.length - 1 ? i : i + 1));
    }, playInterval);
    return () => clearInterval(id);
  }, [playing, dates.length]);

  // Auto-stop when the last date is reached
  useEffect(() => {
    if (playing && dateIndex >= dates.length - 1) setPlaying(false);
  }, [playing, dateIndex, dates.length]);

  const prev = useCallback(() => setDateIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setDateIndex((i) => Math.min(dates.length - 1, i + 1)),
    [dates.length],
  );

  if (booting) {
    return <div className="boot-screen">Loading data…</div>;
  }

  const totalAlerts = dayData?.count ?? 0;
  const totalCities = cityDots.length;
  const totalPopulation = cityDots.reduce((sum, d) => sum + d.population, 0);
  const maxAlertCount = cityDots.reduce(
    (max, d) => Math.max(max, d.alertCount),
    0,
  );

  return (
    <div className="app">
      <LegendPanel
        dates={dates}
        dateIndex={dateIndex}
        totalAlerts={totalAlerts}
        totalCities={totalCities}
        totalPopulation={totalPopulation}
        maxAlertCount={maxAlertCount}
        allCitiesCount={allCitiesCount}
        allPopulation={allPopulation}
        lang={lang}
        playing={playing}
        onPrev={prev}
        onNext={next}
        onSliderChange={setDateIndex}
        onLangChange={setLang}
        onPlayPause={() => setPlaying((p) => !p)}
      />

      {/* ── Map ── */}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        getTooltip={({ object, x, y }) => buildTooltip(object, lang, x, y)}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={{ compact: true }} />
      </DeckGL>
    </div>
  );
}

export default App;
