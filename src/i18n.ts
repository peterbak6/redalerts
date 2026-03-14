export type Lang = "he" | "en";

export interface Strings {
  dir: "rtl" | "ltr";
  title: string;
  langToggleLabel: string;
  sliderDesc: string;
  alerts: string;
  alertFreqTitle: string;
  alertFreqDesc: string;
  popSizeTitle: string;
  popSizeDesc: string;
  closingDesc: string;
  tooltipAlerts: (n: number) => string;
  tooltipPopulation: (n: number) => string;
  tooltipTimesTitle: string;
  dataSource: string;
  playArrow: string;
  prevArrow: string;
  nextArrow: string;
}

export const T: Record<Lang, Strings> = {
  he: {
    dir: "rtl",
    langToggleLabel: "EN",
    title: "התראות צבע אדום",
    sliderDesc:
      "הזיזו את הסליידר כדי לעיין בהתראות לפי תאריך. מוצגים רק תאריכים שעבורם קיים מידע. כל עיגול מייצג עיר שבה הופעלה התראה.",
    alerts: "התראות",
    alertFreqTitle: "תדירות התראות",
    alertFreqDesc:
      "הצבע מציין כמה התראות נרשמו בכל עיר באותו יום. גוון אדום כהה יותר מצביע על מספר התראות גבוה יותר.",
    popSizeTitle: "גודל אוכלוסייה",
    popSizeDesc:
      "גודל העיגול משקף את גודל האוכלוסייה בעיר. ערים גדולות מאגדות מספר אזורי התראה. עיגול גדול יותר מייצג אוכלוסייה גדולה יותר.",
    closingDesc:
      "ההדמיה מציגה כיצד ההתראות התפלגו בין ערים ואוכלוסיות לאורך זמן. היא מדגישה באיזו תדירות קהילות שונות הושפעו.",
    tooltipAlerts: (n) => `התראות: ${n}`,
    tooltipPopulation: (n) => `אוכלוסייה: ${n.toLocaleString("he-IL")}`,
    tooltipTimesTitle: "שעות",
    dataSource: "מקור: צבע אדום",
    playArrow: "◀", // triangle to the left
    prevArrow: "→",
    nextArrow: "←",
  },
  en: {
    dir: "ltr",
    title: "Red Alerts",
    langToggleLabel: "עב",
    sliderDesc:
      "Move the slider to explore alerts by date. Only dates with available data are shown. Each circle marks a city where an alert was triggered.",
    alerts: "alerts",
    alertFreqTitle: "Alert frequency",
    alertFreqDesc:
      "Color indicates how many alerts were recorded in each city on that day. Darker red color means more alerts, and more times the population had to run to shelter.",
    popSizeTitle: "Population size",
    popSizeDesc:
      "Circle size reflects the city's population. Major cities are aggregates across multiple districts. Larger circles represent larger populations.",
    closingDesc:
      "This visualization shows how alerts were distributed across cities and populations over time. It highlights how often different communities were affected.",
    tooltipAlerts: (n) => `Alerts: ${n}`,
    tooltipPopulation: (n) => `Population: ${n.toLocaleString("en-US")}`,
    tooltipTimesTitle: "Times",
    dataSource: "Data source: Tzeva Adom",
    playArrow: "▶",
    prevArrow: "←",
    nextArrow: "→",
  },
};
