#!/usr/bin/env tsx

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type RawAlertTuple = [unknown, unknown, unknown, unknown];

type NormalizedAlert = {
  serialNumber?: number;
  code?: number;
  cities: string[];
  timestampSec: number;
  timestampMs: number;
  timestampIso: string;
};

const DEFAULT_URL = "https://www.tzevaadom.co.il/static/historical/all.json";

function getArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function toNumberOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }

  return undefined;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizeTuple(
  raw: unknown,
): { day: string; alert: NormalizedAlert } | null {
  if (!Array.isArray(raw) || raw.length < 4) return null;

  const tuple = raw as RawAlertTuple;

  const serialNumber = toNumberOrUndefined(tuple[0]);
  const code = toNumberOrUndefined(tuple[1]);
  const cities = toStringArray(tuple[2]);
  const timestampSec = toNumberOrUndefined(tuple[3]);

  if (timestampSec == null) return null;

  const timestampMs = timestampSec * 1000;
  const d = new Date(timestampMs);

  if (Number.isNaN(d.getTime())) return null;

  const timestampIso = d.toISOString();
  const day = timestampIso.slice(0, 10);

  return {
    day,
    alert: {
      serialNumber,
      code,
      cities,
      timestampSec,
      timestampMs,
      timestampIso,
    },
  };
}

async function main() {
  const url = getArg("--url", DEFAULT_URL)!;
  const outDir = path.resolve(getArg("--out", "./public/red-alert")!);

  console.info(`Downloading: ${url}`);

  const res = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "mapsinscale-red-alert-downloader/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected top-level array, got: ${typeof parsed}`);
  }

  console.info("Total records:", parsed.length);

  const normalized: Array<{ day: string; alert: NormalizedAlert }> = [];
  const skipped: unknown[] = [];

  for (const item of parsed) {
    const n = normalizeTuple(item);
    if (n) normalized.push(n);
    else skipped.push(item);
  }

  normalized.sort((a, b) => a.alert.timestampMs - b.alert.timestampMs);

  const byDay = new Map<string, NormalizedAlert[]>();

  for (const entry of normalized) {
    let bucket = byDay.get(entry.day);
    if (!bucket) {
      bucket = [];
      byDay.set(entry.day, bucket);
    }
    bucket.push(entry.alert);
  }

  await mkdir(outDir, { recursive: true });

  for (const [day, alerts] of byDay.entries()) {
    const payload = {
      day,
      count: alerts.length,
      from: alerts[0]?.timestampIso ?? null,
      to: alerts[alerts.length - 1]?.timestampIso ?? null,
      alerts,
    };

    await writeFile(
      path.join(outDir, `${day}.json`),
      JSON.stringify(payload),
      "utf8",
    );
  }

  const index = {
    sourceUrl: url,
    generatedAt: new Date().toISOString(),
    totalRawRecords: parsed.length,
    totalNormalizedRecords: normalized.length,
    totalSkippedRecords: skipped.length,
    days: Array.from(byDay.entries()).map(([day, alerts]) => ({
      day,
      count: alerts.length,
      file: `${day}.json`,
    })),
  };

  await writeFile(
    path.join(outDir, "index.json"),
    JSON.stringify(index),
    "utf8",
  );

  // Generate dates.json for easy frontend consumption
  const dates = Array.from(byDay.keys()).sort();
  await writeFile(
    path.join(outDir, "dates.json"),
    JSON.stringify(dates),
    "utf8",
  );

  console.info("Days written:", byDay.size);
  console.info("Normalized:", normalized.length);
  console.info("Skipped:", skipped.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
