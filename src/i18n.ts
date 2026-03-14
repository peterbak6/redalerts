export type Lang = "he" | "en";

export interface Strings {
  dir: "rtl" | "ltr";
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
}

export const T: Record<Lang, Strings> = {
  he: {
    dir: "rtl",
    langToggleLabel: "EN",
    sliderDesc:
      "הזיזו את הסרגל לבחירת תאריך. הדיסקיות מציגות ערים שקיבלו התראת צבע אדום.",
    alerts: "התראות",
    alertFreqTitle: "תדירות התראות",
    alertFreqDesc:
      "הצבע מראה את מספר ההתראות היומי לעיר – כמה פעמים האוכלוסייה נאלצה לרוץ למרחב המוגן.",
    popSizeTitle: "גודל אוכלוסייה",
    popSizeDesc:
      "גודל הדיסקית מייצג את האוכלוסייה. ערים הכוללות מספר אזורי התרעה מוצגות כנקודה אחת על-פי האזור המאוכלס.",
    closingDesc:
      "הוויזואליזציה מאפשרת לחוש את הכאב כשמיליוני אנשים מותקפים בהתראות חוזרות ונשנות.",
    tooltipAlerts: (n) => `${n} התראות`,
    tooltipPopulation: (n) => `אוכלוסייה: ${n.toLocaleString("he-IL")}`,
    tooltipTimesTitle: "שעות:",
  },
  en: {
    dir: "ltr",
    langToggleLabel: "עב",
    sliderDesc:
      "Move the slider to select a date. Circles show cities that received a red alert.",
    alerts: "alerts",
    alertFreqTitle: "Alert frequency",
    alertFreqDesc:
      "Color shows daily alert count per city — how many times the population had to run to a shelter.",
    popSizeTitle: "Population size",
    popSizeDesc:
      "Circle size represents population. Multi-zone cities are merged into one dot using the most populated zone.",
    closingDesc:
      "This visualization lets you feel the pain when millions of people are hit by alerts again and again.",
    tooltipAlerts: (n) => `${n} alert${n !== 1 ? "s" : ""}`,
    tooltipPopulation: (n) => `Population: ${n.toLocaleString("en-US")}`,
    tooltipTimesTitle: "Times:",
  },
};
