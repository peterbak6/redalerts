export const ALERT_COLORS: [number, number, number][] = [
  [255, 255, 204], // 1
  [255, 237, 160], // 2
  [254, 217, 118], // 3
  [254, 178, 76], // 4
  [253, 141, 60], // 5
  [252, 78, 42], // 6
  [227, 26, 28], // 7
  [189, 0, 38], // 8
  [128, 0, 38], // 9+
];

export const BASE = import.meta.env.BASE_URL;

export const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const INITIAL_VIEW_STATE = {
  longitude: 34.8516,
  latitude: 31.4,
  zoom: 7.2,
  pitch: 0,
  bearing: 0,
};
