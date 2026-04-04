import { ALERT_COLORS } from "./constants";

export const alertColor = (count: number): [number, number, number, number] => {
  if (count <= 0) return [0, 0, 0, 0];
  return [
    ...ALERT_COLORS[Math.min(count - 1, ALERT_COLORS.length - 1)],
    210,
  ] as [number, number, number, number];
};

export const radiusFromPopulation = (pop: number): number => {
  if (!pop || pop <= 0) return 1;
  return Math.min(30, Math.max(1, Math.sqrt(pop / 1000)));
};

export function elevationFromCount(count: number, maxCount: number): number {
  if (!count || !maxCount) return 0;
  return (count / maxCount) * 8000;
}

export function colorByAvg(
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

/**
 * Detects multi-zone cities (names containing " - ") and returns a mapping
 * from every non-representative zone name → representative zone name.
 * The representative is the zone with the highest population.
 * Single-zone cities are not included in the map.
 */
export function buildZoneAliases(
  citiesRaw: Record<string, { pop?: number }>,
): Record<string, string> {
  // Group all city names by their base name (part before first " - ")
  const groups: Record<string, string[]> = {};
  for (const name of Object.keys(citiesRaw)) {
    const base = name.includes(" -") ? name.split(" -")[0] : name;
    if (!groups[base]) groups[base] = [];
    groups[base].push(name);
  }

  const aliases: Record<string, string> = {};
  for (const members of Object.values(groups)) {
    if (members.length <= 1) continue; // single-zone city, nothing to do

    // Pick the zone with the highest population as the representative
    const rep = members.reduce((best, name) => {
      const bestPop = citiesRaw[best].pop ?? 0;
      const thisPop = citiesRaw[name].pop ?? 0;
      return thisPop > bestPop ? name : best;
    });

    for (const name of members) {
      if (name !== rep) aliases[name] = rep;
    }
  }
  return aliases;
}
