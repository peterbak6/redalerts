import { memo } from "react";
import { ALERT_COLORS } from "./constants";
import { T, type Lang } from "./i18n";

const SIZE_SAMPLES: { r: number; cx: number; label: string }[] = [
  { r: 1.5, cx: 22, label: "1K" },
  { r: 3.2, cx: 57, label: "10K" },
  { r: 6, cx: 97, label: "50K" },
  { r: 8.1, cx: 138, label: "100K" },
  { r: 16.8, cx: 195, label: "500K" },
  { r: 23.4, cx: 255, label: "1M" },
];

interface LegendPanelProps {
  dates: string[];
  dateIndex: number;
  totalAlerts: number;
  lang: Lang;
  onPrev: () => void;
  onNext: () => void;
  onSliderChange: (index: number) => void;
  onLangChange: (lang: Lang) => void;
}

const LegendPanel = memo(function LegendPanel({
  dates,
  dateIndex,
  totalAlerts,
  lang,
  onPrev,
  onNext,
  onSliderChange,
  onLangChange,
}: LegendPanelProps) {
  const selectedDate = dates[dateIndex];
  const s = T[lang];
  const nextLang: Lang = lang === "he" ? "en" : "he";

  return (
    <div className="slider-panel" dir={s.dir}>
      {/* ── Language toggle ── */}
      <div className="panel-header">
        <button
          className="lang-toggle"
          onClick={() => onLangChange(nextLang)}
          title={lang === "he" ? "Switch to English" : "עבור לעברית"}
        >
          {s.langToggleLabel}
        </button>
      </div>

      {/* ── Date slider ── */}
      <p className="legend-desc">{s.sliderDesc}</p>
      <div className="slider-top">
        <button className="nav-btn" onClick={onPrev} disabled={dateIndex === 0}>
          ←
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
          →
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={dates.length - 1}
        value={dateIndex}
        onChange={(e) => onSliderChange(Number(e.target.value))}
        className="date-range"
      />

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
        style={{ maxWidth: 280, display: "block" }}
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
    </div>
  );
});

export default LegendPanel;
