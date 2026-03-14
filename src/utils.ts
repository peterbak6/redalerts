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
  return Math.min(30, Math.max(1, Math.sqrt(pop / 2000)));
};
