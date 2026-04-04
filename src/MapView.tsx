import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { ColumnLayer } from "@deck.gl/layers";
import { Map } from "@vis.gl/react-maplibre";
import { buildTooltip, type CityDot } from "./TooltipPanel";
import { MAP_STYLE, INITIAL_VIEW_STATE } from "./constants";
import { colorByAvg } from "./utils";
import { type Lang } from "./i18n";

const NUM_BINS = 9;
const RADII_PX = [1, 2, 3, 4, 5, 7, 9, 11, 14]; // px, one per bin

interface Props {
  cityColumns: CityDot[];
  minAvg: number;
  maxAvg: number;
  lang: Lang;
}

export default function MapView({ cityColumns, minAvg, maxAvg, lang }: Props) {
  const layers = useMemo(() => {
    if (!cityColumns.length) return [];

    const maxSqrtPop = cityColumns.reduce(
      (m, d) => Math.max(m, Math.sqrt(d.population || 1)),
      1,
    );

    return Array.from({ length: NUM_BINS }, (_, bin) => {
      const lo = (bin / NUM_BINS) * maxSqrtPop;
      const hi = ((bin + 1) / NUM_BINS) * maxSqrtPop;
      const binData = cityColumns.filter((d) => {
        const s = Math.sqrt(d.population || 1);
        return bin === NUM_BINS - 1 ? s >= lo : s >= lo && s < hi;
      });
      return new ColumnLayer<CityDot>({
        id: `cities-bin-${bin}`,
        data: binData,
        elevationScale: 150,
        radius: RADII_PX[bin],
        radiusUnits: "pixels",
        diskResolution: 32,
        getFillColor: (d) => colorByAvg(d.avgAlertsPerDay, minAvg, maxAvg),
        getPosition: (d) => d.position,
        getElevation: (d) => d.totalAlerts,
        extruded: true,
        material: false,
        pickable: true,
      });
    });
  }, [cityColumns, minAvg, maxAvg]);

  return (
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
  );
}
