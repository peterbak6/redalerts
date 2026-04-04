import { type Lang, T } from "./i18n";

export type CityDot = {
  name: string;
  englishName: string;
  hebrewName: string;
  position: [number, number];
  totalAlerts: number;
  avgAlertsPerDay: number;
  population: number;
};

const TOOLTIP_STYLE: Record<string, string> = {
  background: "rgba(8, 10, 22, 0.92)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  padding: "12px 16px",
  color: "#fff",
  fontFamily: "'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif",
  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
};

export function buildTooltip(
  object: unknown,
  lang: Lang,
  x = 0,
  y = 0,
): { html: string; style: Record<string, string> } | null {
  const d = object as CityDot | null;
  if (!d?.name || d.totalAlerts <= 0) return null;

  const s = T[lang];
  const displayName = lang === "he" ? d.hebrewName : d.englishName;
  const onRight = x > window.innerWidth / 2;
  return {
    html: `<div class="tt">
      <div class="tt-name">${displayName}</div>
      ${d.population > 0 ? `<div class="tt-row">${s.tooltipPopulation(d.population)}</div>` : ""}
      <div class="tt-row">${s.tooltipTotalAlerts(d.totalAlerts)}</div>
      <div class="tt-row">${s.tooltipAvgPerDay(d.avgAlertsPerDay.toFixed(2))}</div>
    </div>`,
    style: {
      ...TOOLTIP_STYLE,
      transform: `translate(${x}px, ${y}px)${onRight ? " translate(-105%, -105%)" : " translate(5%, -105%)"}`,
    },
  };
}
