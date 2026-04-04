import { useEffect, useRef, useState, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { Map } from "@vis.gl/react-maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import DateRangeBar from "./DateRangeBar";
import { buildTooltip, type CityDot } from "./TooltipPanel";
import { BASE, MAP_STYLE, INITIAL_VIEW_STATE } from "./constants";
import { alertColor, radiusFromPopulation, buildZoneAliases } from "./utils";

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

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [dates, setDates] = useState<string[]>([]);
  const [rangeA, setRangeA] = useState(0);
  const [rangeB, setRangeB] = useState(0);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [citiesRaw, setCitiesRaw] = useState<Record<string, CityInfo>>({});
  const [booting, setBooting] = useState(true);

  const dayCache = useRef(new globalThis.Map<string, DayData>());
  const latestRequestedDate = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbort = useRef<AbortController | null>(null);

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

  // Fetch data for the "to" end of the selected range (visual mapping changes in next step).
  // Debounced (80 ms) + stale-check so fast scrubbing skips intermediate days.
  useEffect(() => {
    if (!dates.length) return;
    const toIndex = Math.max(rangeA, rangeB);
    const date = dates[toIndex];
    // Cover the last 2 dates: Israel is UTC+2/+3 and the cron runs every 3h,
    // so yesterday's file can still receive new alerts after local midnight.
    const isLatest = toIndex >= dates.length - 2;

    // Serve from cache immediately — no debounce needed.
    // Skip for the latest date: its file is updated by cron and must stay fresh.
    if (!isLatest && dayCache.current.has(date)) {
      latestRequestedDate.current = date;
      setDayData(dayCache.current.get(date)!);
      return;
    }

    // Debounce the fetch so rapid slider movement skips intermediate requests
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      // Abort any previous in-flight request before starting a new one
      fetchAbort.current?.abort();
      const controller = new AbortController();
      fetchAbort.current = controller;

      latestRequestedDate.current = date;
      // For the latest date, bypass both browser and CDN cache so we always
      // get the most recent data (the file is rewritten by the cron job).
      fetchJson<DayData>(
        `${BASE}red-alert/${date}.json`,
        controller.signal,
        isLatest ? "no-cache" : undefined,
      )
        .then((data) => {
          // Don't cache the latest date in memory — it changes throughout the day
          if (!isLatest) dayCache.current.set(date, data);
          // Ignore if the user has already moved to a different date
          if (latestRequestedDate.current === date) setDayData(data);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") console.error(err);
        });
    }, 80);
  }, [rangeA, rangeB, dates]);

  // ── Zone alias map (computed once: maps sub-zone names → representative zone) ──
  const zoneAliases = useMemo(() => buildZoneAliases(citiesRaw), [citiesRaw]);

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
        population: info.pop ?? 0,
        times: times[name] ?? [],
      }))
      .filter((d) => d.alertCount > 0);
  }, [citiesRaw, zoneAliases, dayData]);

  // ── DeckGL layers ──
  const layers = useMemo(
    () => [
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
          getFillColor: {
            duration: 400,
            enter: () => [0, 0, 0, 0],
          },
        },
      }),
    ],
    [cityDots],
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
