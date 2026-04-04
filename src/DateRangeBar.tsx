import { DualRangeSlider } from "./components/RangeSlider";

interface Props {
  dates: string[];
  rangeA: number;
  rangeB: number;
  onChange: (a: number, b: number) => void;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function DateRangeBar({
  dates,
  rangeA,
  rangeB,
  onChange,
}: Props) {
  if (!dates.length) return null;
  const from = Math.min(rangeA, rangeB);
  const to = Math.max(rangeA, rangeB);

  return (
    <div className="date-range-bar">
      <div className="date-range-bar__labels">
        <span>{formatDate(dates[from])}</span>
        <span>{formatDate(dates[to])}</span>
      </div>
      <DualRangeSlider
        min={0}
        max={dates.length - 1}
        step={1}
        valueA={rangeA}
        valueB={rangeB}
        onChange={({ valueA, valueB }) => onChange(valueA, valueB)}
      />
    </div>
  );
}
