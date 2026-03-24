import { memo, useState } from "react";
import { ALERT_COLORS } from "./constants";
import { T, type Lang } from "./i18n";

// ─── Stat Circle ────────────────────────────────────────────────────────────
function StatCircle({
  value,
  label,
  fraction,
  colorRgb,
}: {
  value: string;
  label: string;
  fraction: number; // 0–1
  colorRgb: [number, number, number];
}) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, fraction)) * C;
  const color = `rgb(${colorRgb[0]},${colorRgb[1]},${colorRgb[2]})`;
  return (
    <div className="stat-circle-wrap">
      <svg viewBox="0 0 80 80" className="stat-circle-svg">
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="5"
        />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="37"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fontWeight="600"
          fill="white"
        >
          {value}
        </text>
        <text
          x="40"
          y="54"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fill="rgba(255,255,255,0.55)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

const SIZE_SAMPLES: { r: number; cx: number; label: string }[] = [
  { r: 23.4, cx: 25, label: "1M" },
  { r: 16.8, cx: 85, label: "500K" },
  { r: 8.1, cx: 142, label: "100K" },
  { r: 6, cx: 183, label: "50K" },
  { r: 3.2, cx: 223, label: "10K" },
  { r: 1.5, cx: 258, label: "1K" },
];

interface LegendPanelProps {
  dates: string[];
  dateIndex: number;
  totalAlerts: number;
  totalCities: number;
  totalPopulation: number;
  maxAlertCount: number;
  allCitiesCount: number;
  allPopulation: number;
  lang: Lang;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSliderChange: (index: number) => void;
  onLangChange: (lang: Lang) => void;
  onPlayPause: () => void;
}

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="info-btn"
        title={text}
        onClick={() => setOpen((o) => !o)}
        aria-label="info"
      >
        ⓘ
      </button>
      {open && <p className="legend-desc info-tip-text">{text}</p>}
    </>
  );
}

const humanReadableCount = (count: number): string => {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  } else if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  } else {
    return count.toString();
  }
};

const LegendPanel = memo(function LegendPanel({
  dates,
  dateIndex,
  totalAlerts,
  totalCities,
  totalPopulation,
  maxAlertCount,
  allCitiesCount,
  allPopulation,
  lang,
  playing,
  onPrev,
  onNext,
  onSliderChange,
  onLangChange,
  onPlayPause,
}: LegendPanelProps) {
  const selectedDate = dates[dateIndex];
  const s = T[lang];
  const nextLang: Lang = lang === "he" ? "en" : "he";
  const [sliderDescOpen, setSliderDescOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

  return (
    <div className="slider-panel" dir={s.dir}>
      {/* ── Header: title + language toggle ── */}
      <div className="panel-header">
        <h1 className="panel-title">
          {s.title}
          <button
            className="info-btn"
            title={s.sliderDesc}
            onClick={() => setSliderDescOpen((o) => !o)}
            aria-label="info"
          >
            ⓘ
          </button>
        </h1>
        <button
          className="lang-toggle"
          onClick={() => onLangChange(nextLang)}
          title={lang === "he" ? "Switch to English" : "עבור לעברית"}
        >
          {s.langToggleLabel}
        </button>
      </div>
      {sliderDescOpen && <p className="legend-desc">{s.sliderDesc}</p>}
      <div className="slider-top">
        <button className="nav-btn" onClick={onPrev} disabled={dateIndex === 0}>
          {s.prevArrow}
        </button>
        <div className="date-info">
          <span className="date-label">{selectedDate}</span>
        </div>
        <button
          className="nav-btn"
          onClick={onNext}
          disabled={dateIndex === dates.length - 1}
        >
          {s.nextArrow}
        </button>
      </div>

      {/* ── Collapse toggle ── */}
      <button
        className="collapse-btn"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Expand" : "Collapse"}
        aria-expanded={!collapsed}
      >
        {collapsed ? "▾" : "▴"}
      </button>

      {/* ── Collapsible body ── */}
      {!collapsed && (
        <div className="panel-scroll">
          {/* ── Date slider + play/pause button ── */}
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={dates.length - 1}
              value={dateIndex}
              onChange={(e) => onSliderChange(Number(e.target.value))}
              className="date-range"
            />
            <button
              className="play-btn"
              onClick={onPlayPause}
              title={playing ? "Pause" : "Play"}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "⏸" : s.playArrow}
            </button>
          </div>

          {/* ── Exposure info ── */}
          <div className="exposure-info">
            <div className="legend-section-row">
              <p className="legend-section-title">{s.exposureTitle}</p>
              <InfoTip text={s.exposureDesc} />
            </div>
            <div className="stat-circles">
              <StatCircle
                value={totalAlerts.toLocaleString()}
                label={s.alerts}
                fraction={1}
                colorRgb={
                  maxAlertCount > 0
                    ? ALERT_COLORS[
                        Math.min(maxAlertCount - 1, ALERT_COLORS.length - 1)
                      ]
                    : [100, 100, 100]
                }
              />
              <StatCircle
                value={totalCities.toLocaleString()}
                label={s.cities}
                fraction={allCitiesCount > 0 ? totalCities / allCitiesCount : 0}
                colorRgb={
                  ALERT_COLORS[
                    Math.floor(
                      (ALERT_COLORS.length * totalCities) / allCitiesCount,
                    )
                  ]
                }
              />
              <StatCircle
                value={humanReadableCount(totalPopulation)}
                label={s.people}
                fraction={
                  allPopulation > 0 ? totalPopulation / allPopulation : 0
                }
                colorRgb={
                  ALERT_COLORS[
                    Math.floor(
                      (ALERT_COLORS.length * totalPopulation) / allPopulation,
                    )
                  ]
                }
              />
            </div>
          </div>

          {/* ── Color legend ── */}
          {/* <div className="panel-divider" /> */}
          <div className="legend-section-row">
            <p className="legend-section-title">{s.alertFreqTitle}</p>
            <InfoTip text={s.alertFreqDesc} />
          </div>
          <div className="legend">
            <span className="legend-label">1</span>
            {ALERT_COLORS.map((rgb, i) => (
              <span
                key={i}
                className="legend-cell"
                style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
                title={i < 8 ? String(i + 1) : "9+"}
              />
            ))}
            <span className="legend-label" style={{ marginLeft: "auto" }}>
              9+
            </span>
          </div>

          {/* ── Size legend ── */}
          <div className="panel-divider" />
          <div className="legend-section-row">
            <p className="legend-section-title">{s.popSizeTitle}</p>
            <InfoTip text={`${s.popSizeDesc} ${s.closingDesc}`} />
          </div>
          <svg
            viewBox="0 0 280 80"
            width="100%"
            style={{ display: "block" }}
            className="size-legend-svg"
            aria-hidden="true"
          >
            {SIZE_SAMPLES.map(({ r, cx, label }) => (
              <g key={cx}>
                <circle
                  cx={cx}
                  cy={62 - r}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={1}
                />
                <text
                  x={cx}
                  y={76}
                  textAnchor="middle"
                  fontSize="8"
                  fill="rgba(255,255,255,0.4)"
                >
                  {label}
                </text>
              </g>
            ))}
          </svg>
          {/* ── Footer: data source ── */}
          <div className="panel-divider" />
          <a
            className="data-source-link"
            href="https://www.tzevaadom.co.il/static/historical/all.json"
            target="_blank"
            rel="noopener noreferrer"
          >
            {s.dataSource}
          </a>
          <p className="data-source-link" style={{ opacity: 0.65 }}>
            © 2026 Peter Bak ·{" "}
            <a
              href="https://visualanalytics.co.il"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "underline" }}
            >
              VisualAnalytics
            </a>
          </p>
        </div>
      )}
    </div>
  );
});

export default LegendPanel;
