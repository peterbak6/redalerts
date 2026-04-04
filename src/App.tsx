import { useEffect, useRef, useState, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { ColumnLayer } from "@deck.gl/layers";
import { Map } from "@vis.gl/react-maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import DateRangeBar from "./DateRangeBar";
import { buildTooltip, type CityDot } from "./TooltipPanel";
import { BASE, MAP_STYLE, INITIAL_VIEW_STATE, ALERT_COLORS } from "./constants";
import { radiusFromPopulation, buildZoneAliases } from "./utils";

maplibregl.setRTLTextPlugin(
  `${window.location.origin}${import.meta.env.BASE_URL}mapbox-gl-rtl-text.js`,
  false,
);

// ─── Types ───────────────────────────────────────────────────────────────────
type Alert = { serialNumber: number; cities: string[]; timestampIso: string };
type DayData = { day: string; count: number; alerts: Alert[] };
type CityInfo = {
  id: number;
  lat: number;
  lng: number;
  he?: string;
  en?: string;
  pop?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
  cacheMode?: RequestCache,
): Promise<T> {
  const res = await fetch(url, {
    signal,
    ...(cacheMode ? { cache: cacheMode } : {}),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function elevationFromCount(count: number, maxCount: number): number {
  if (!count || !maxCount) return 0;
  // Normalize: tallest city = 5000m — visually strong but not overwhelming at 45° pitch
  return (count / maxCount) * 5000;
}

function colorByAvg(
  avg: number,
  minAvg: number,
  maxAvg: number,
): [number, number, number, number] {
  if (maxAvg <= minAvg)
    return [...ALERT_COLORS[0], 210] as [number, number, number, number];
  const t = (avg - minAvg) / (maxAvg - minAvg);
  const idx = Math.min(
    Math.floor(t * ALERT_COLORS.length),
    ALERT_COLORS.length - 1,
  );
  return [...ALERT_COLORS[idx], 210] as [number, number, number, number];
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [dates, setDates] = useState<string[]>([]);
  const [rangeA, setRangeA] = useState(0);
  const [rangeB, setRangeB] = useState(0);
  const [rangeDays, setRangeDays] = useState<DayData[]>([]);
  const [citiesRaw, setCitiesRaw] = useState<Record<string, CityInfo>>({});
  const [booting, setBooting] = useState(true);

  const dayCache = useRef(new globalThis.Map<string, DayData>());
  const latestRangeKey = useRef<string>("");
  const rangeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeAbort = useRef<AbortController | null>(null);

  // Load dates first — unblocks the UI immediately; load cities in parallel
  useEffect(() => {
    fetchJson<string[]>(`${BASE}red-alert/dates.json`)
      .then((dts) => {
        setDates(dts);
        const defaultStart = dts.findIndex((d) => d >= "2026-02-28");
        setRangeA(defaultStart === -1 ? 0 : defaultStart);
        setRangeB(dts.length - 1);
        setBooting(false); // map is now interactive
      })
      .catch(console.error);

    fetchJson<{ cities: Record<string, CityInfo> }>(
      `${BASE}real-data/citiesData.json`,
    )
      .then(({ cities }) => setCitiesRaw(cities))
      .catch(console.error);
  }, []);

  // Fetch all days in the selected range, cache individually, then aggregate.
  // Debounced 300 ms so fast slider scrubbing doesn't fan out many requests.
  useEffect(() => {
    if (!dates.length) return;
    const from = Math.min(rangeA, rangeB);
    const to = Math.max(rangeA, rangeB);
    const rangeKey = `${from}-${to}`;

    if (rangeDebounce.current) clearTimeout(rangeDebounce.current);
    rangeDebounce.current = setTimeout(async () => {
      rangeAbort.current?.abort();
      const controller = new AbortController();
      rangeAbort.current = controller;
      latestRangeKey.current = rangeKey;

      const datesInRange = dates.slice(from, to + 1);
      try {
        const results = await Promise.all(
          datesInRange.map(async (date, i) => {
            const isLatest = from + i >= dates.length - 2;
            if (!isLatest && dayCache.current.has(date))
              return dayCache.current.get(date)!;
            const data = await fetchJson<DayData>(
              `${BASE}red-alert/${date}.json`,
              controller.signal,
              isLatest ? "no-cache" : undefined,
            );
            if (!isLatest) dayCache.current.set(date, data);
            return data;
          }),
        );
        if (latestRangeKey.current === rangeKey) setRangeDays(results);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError")
          console.error(err);
      }
    }, 300);
  }, [rangeA, rangeB, dates]);

  // ── Zone alias map (computed once: maps sub-zone names → representative zone) ──
  const zoneAliases = useMemo(() => buildZoneAliases(citiesRaw), [citiesRaw]);

  // ── Aggregate totals + averages across the selected range ──
  const cityColumns = useMemo((): CityDot[] => {
    if (!rangeDays.length || !Object.keys(citiesRaw).length) return [];
    const numDays = rangeDays.length;

    // Sum distinct alert serials per representative city across all days
    const totalAlertsPerCity: Record<string, number> = {};
    for (const day of rangeDays) {
      const rawSerials: Record<string, Set<number>> = {};
      for (const alert of day.alerts) {
        for (const city of alert.cities) {
          if (!rawSerials[city]) rawSerials[city] = new Set();
          rawSerials[city].add(alert.serialNumber);
        }
      }
      const serialsByRep: Record<string, Set<number>> = {};
      for (const [name, serials] of Object.entries(rawSerials)) {
        const rep = zoneAliases[name] ?? name;
        if (!serialsByRep[rep]) serialsByRep[rep] = new Set();
        for (const s of serials) serialsByRep[rep].add(s);
      }
      for (const [rep, serials] of Object.entries(serialsByRep)) {
        totalAlertsPerCity[rep] = (totalAlertsPerCity[rep] ?? 0) + serials.size;
      }
    }

    return Object.entries(citiesRaw)
      .filter(([name]) => !zoneAliases[name])
      .map(([name, info]) => ({
        name,
        englishName: info.en ? info.en.split(" - ")[0] : name.split(" - ")[0],
        position: [info.lng, info.lat] as [number, number],
        totalAlerts: totalAlertsPerCity[name] ?? 0,
        avgAlertsPerDay: (totalAlertsPerCity[name] ?? 0) / numDays,
        population: info.pop ?? 0,
      }))
      .filter((d) => d.totalAlerts > 0);
  }, [citiesRaw, zoneAliases, rangeDays]);

  const { minAvg, maxAvg, maxTotalAlerts } = useMemo(() => {
    if (!cityColumns.length) return { minAvg: 0, maxAvg: 1, maxTotalAlerts: 1 };
    const avgs = cityColumns.map((c) => c.avgAlertsPerDay);
    return {
      minAvg: Math.min(...avgs),
      maxAvg: Math.max(...avgs),
      maxTotalAlerts: Math.max(...cityColumns.map((c) => c.totalAlerts)),
    };
  }, [cityColumns]);

  // ── DeckGL layers ──
  const layers = useMemo(
    () => [
      new ColumnLayer<CityDot>({
        id: "cities",
        data: cityColumns,
        getPosition: (d) => d.position,
        getElevation: (d) => elevationFromCount(d.totalAlerts, maxTotalAlerts),
        // getRadius is a valid ColumnLayer accessor in deck.gl 9.x; TS types are incomplete
        ...{ getRadius: (d: CityDot) => radiusFromPopulation(d.population) },
        getFillColor: (d) => colorByAvg(d.avgAlertsPerDay, minAvg, maxAvg),
        radiusUnits: "pixels",
        diskResolution: 32,
        extruded: true,
        material: false, // flat fill — no lighting shading on column sides
        pickable: true,
        transitions: {
          getElevation: { duration: 400, enter: () => [0] },
          getFillColor: { duration: 400, enter: () => [0, 0, 0, 0] },
        },
      }),
    ],
    [cityColumns, minAvg, maxAvg, maxTotalAlerts],
  );

  if (booting) {
    return <div className="boot-screen">Loading data…</div>;
  }

  return (
    <div className="app">
      <DateRangeBar
        dates={dates}
        rangeA={rangeA}
        rangeB={rangeB}
        onChange={(a, b) => {
          setRangeA(a);
          setRangeB(b);
        }}
      />

      {/* ── Map ── */}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        pickingRadius={12}
        getTooltip={({ object, x, y }) => buildTooltip(object, "en", x, y)}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={{ compact: true }} />
      </DeckGL>
    </div>
  );
}

export default App;
