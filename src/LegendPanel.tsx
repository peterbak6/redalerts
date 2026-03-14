import { memo, useState } from "react";
import { ALERT_COLORS } from "./constants";
import { T, type Lang } from "./i18n";

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
  lang: Lang;
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSliderChange: (index: number) => void;
  onLangChange: (lang: Lang) => void;
  onPlayPause: () => void;
}

const LegendPanel = memo(function LegendPanel({
  dates,
  dateIndex,
  totalAlerts,
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
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);

  return (
    <div
      className={`slider-panel${collapsed ? " slider-panel--collapsed" : ""}`}
      dir={s.dir}
    >
      {/* ── Header: title + language toggle ── */}
      <div className="panel-header">
        <h1 className="panel-title">{s.title}</h1>
        <button
          className="lang-toggle"
          onClick={() => onLangChange(nextLang)}
          title={lang === "he" ? "Switch to English" : "עבור לעברית"}
        >
          {s.langToggleLabel}
        </button>
      </div>

      {/* ── Date slider (always visible) ── */}
      <p className="legend-desc">{s.sliderDesc}</p>
      <div className="slider-top">
        <button className="nav-btn" onClick={onPrev} disabled={dateIndex === 0}>
          {s.prevArrow}
        </button>
        <div className="date-info">
          <span className="date-label">{selectedDate}</span>
          <span className="alert-count">
            {totalAlerts.toLocaleString()} {s.alerts}
          </span>
        </div>
        <button
          className="nav-btn"
          onClick={onNext}
          disabled={dateIndex === dates.length - 1}
        >
          {s.nextArrow}
        </button>
      </div>
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
        <>
          {/* ── Color legend ── */}
          <div className="panel-divider" />
          <p className="legend-section-title">{s.alertFreqTitle}</p>
          <p className="legend-desc">{s.alertFreqDesc}</p>
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
          <p className="legend-section-title">{s.popSizeTitle}</p>
          <p className="legend-desc">{s.popSizeDesc}</p>
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
          <p className="legend-desc">{s.closingDesc}</p>

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
          <p className="data-source-link" style={{ opacity: 0.25 }}>
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
        </>
      )}
    </div>
  );
});

export default LegendPanel;
