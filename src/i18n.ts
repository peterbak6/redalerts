export type Lang = "he" | "en";

export interface Strings {
  dir: "rtl" | "ltr";
  langToggleLabel: string;
  tooltipTotalAlerts: (n: number) => string;
  tooltipPopulation: (n: number) => string;
  tooltipAvgPerDay: (n: string) => string;
}

export const T: Record<Lang, Strings> = {
  he: {
    dir: "rtl",
    langToggleLabel: "EN",
    tooltipTotalAlerts: (n) => `סהכך התראות: ${n}`,
    tooltipPopulation: (n) => `אוכלוסייה: ${n.toLocaleString("he-IL")}`,
    tooltipAvgPerDay: (n) => `מוצע ליום: ${n}`,
  },
  en: {
    dir: "ltr",
    langToggleLabel: "עב",
    tooltipTotalAlerts: (n) => `Total alerts: ${n}`,
    tooltipPopulation: (n) => `Population: ${n.toLocaleString("en-US")}`,
    tooltipAvgPerDay: (n) => `Avg / day: ${n}`,
  },
};
