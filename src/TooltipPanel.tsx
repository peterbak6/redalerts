import { T, type Lang } from "./i18n";

export type CityDot = {
  name: string;
  englishName: string;
  position: [number, number];
  alertCount: number;
  population: number;
  times: string[];
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

const MAX_TIMES = 15;

export function buildTooltip(
  object: unknown,
  lang: Lang,
): { html: string; style: Record<string, string> } | null {
  const d = object as CityDot | null;
  if (!d?.name || d.alertCount <= 0) return null;

  const s = T[lang];
  const cityName = lang === "en" ? d.englishName : d.name.split(" - ")[0];
  const shownTimes = d.times.slice(0, MAX_TIMES);
  const overflow = d.times.length - shownTimes.length;

  const timesHtml = d.times.length
    ? `<div class="tt-divider"></div>
       <p class="tt-row" style="opacity:0.45;margin-bottom:4px">${s.tooltipTimesTitle}</p>
       <div class="tt-times-list">
         ${shownTimes.map((t) => `<span class="tt-time">${t}</span>`).join("")}
         ${overflow > 0 ? `<span class="tt-time">+${overflow}</span>` : ""}
       </div>`
    : "";

  return {
    html: `<div class="tt" dir="${s.dir}">
      <div class="tt-name">${cityName}</div>
      ${d.population > 0 ? `<div class="tt-row">${s.tooltipPopulation(d.population)}</div>` : ""}
      <div class="tt-row">${s.tooltipAlerts(d.alertCount)}</div>
      ${timesHtml}
    </div>`,
    style: TOOLTIP_STYLE,
  };
}
