import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
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
type CityInfo = {
  id: number;
  lat: number;
  lng: number;
  he?: string;
  en?: string;
  pop?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [dates, setDates] = useState<string[]>([]);
  const [dateIndex, setDateIndex] = useState(0);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [citiesRaw, setCitiesRaw] = useState<Record<string, CityInfo>>({});
  const [booting, setBooting] = useState(true);
  const [lang, setLang] = useState<Lang>("he");
  const [playing, setPlaying] = useState(false);

  const dayCache = useRef(new globalThis.Map<string, DayData>());
  const latestRequestedDate = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbort = useRef<AbortController | null>(null);

  const playInterval = 789; // ms per day while playing

  // Load dates first — unblocks the UI immediately; load cities in parallel
  useEffect(() => {
    fetchJson<string[]>(`${BASE}red-alert/dates.json`)
      .then((dts) => {
        setDates(dts);
        setDateIndex(dts.length - 1); // start at the latest date
        setBooting(false); // map is now interactive
      })
      .catch(console.error);

    fetchJson<{ cities: Record<string, CityInfo> }>(
      `${BASE}real-data/citiesData.json`,
    )
      .then(({ cities }) => setCitiesRaw(cities))
      .catch(console.error);
  }, []);

  // Load per-day alert data with in-memory cache; prefetch next 2 days.
  // Debounced (80 ms) + stale-check so fast scrubbing skips intermediate days.
  useEffect(() => {
    if (!dates.length) return;
    const date = dates[dateIndex];

    // Serve from cache immediately — no debounce needed
    if (dayCache.current.has(date)) {
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
      fetchJson<DayData>(`${BASE}red-alert/${date}.json`, controller.signal)
        .then((data) => {
          dayCache.current.set(date, data);
          // Ignore if the user has already moved to a different date
          if (latestRequestedDate.current === date) setDayData(data);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") console.error(err);
        });

      // Prefetch next 2 days silently into the cache
      for (let i = 1; i <= 2; i++) {
        const nextDate = dates[dateIndex + i];
        if (nextDate && !dayCache.current.has(nextDate)) {
          fetchJson<DayData>(`${BASE}red-alert/${nextDate}.json`)
            .then((data) => dayCache.current.set(nextDate, data))
            .catch(() => {});
        }
      }
    }, 80);
  }, [dateIndex, dates]);

  // ── Zone alias map (computed once: maps sub-zone names → representative zone) ──
  const zoneAliases = useMemo(() => buildZoneAliases(citiesRaw), [citiesRaw]);

  // ── All-time totals (denominator for % circles) ──
  const allCitiesCount = useMemo(
    () => Object.keys(citiesRaw).filter((name) => !zoneAliases[name]).length,
    [citiesRaw, zoneAliases],
  );
  const allPopulation = useMemo(
    () =>
      Object.entries(citiesRaw)
        .filter(([name]) => !zoneAliases[name])
        .reduce((sum, [, info]) => sum + (info.pop ?? 0), 0),
    [citiesRaw, zoneAliases],
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
          // getRadius: { duration: playInterval, enter: () => [0] },
          getFillColor: {
            duration: playInterval / 2,
            enter: () => [0, 0, 0, 0],
          },
        },
      }),
    ],
    [cityDots],
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
        currentDate={dayData?.day ?? null}
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
        onPlayPause={() => {
          setPlaying((p) => {
            if (!p && dateIndex >= dates.length - 1) {
              setDateIndex(Math.max(0, dates.length - 8));
            }
            return !p;
          });
        }}
      />

      {/* ── Map ── */}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller
        layers={layers}
        style={{ width: "100%", height: "100%" }}
        pickingRadius={12}
        getTooltip={({ object, x, y }) => buildTooltip(object, lang, x, y)}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={{ compact: true }} />
      </DeckGL>
    </div>
  );
}

export default App;
