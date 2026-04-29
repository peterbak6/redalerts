# Red Alerts — Israel Rocket Alert Visualizer

An interactive map visualizing rocket alert (צבע אדום) data across Israel, from 2021 to the present.

**Live:**
[redalerts.pages.dev](https://redalerts.pages.dev)

**Github:**
[peterbak6.github.io/redalerts](https://peterbak6.github.io/redalerts)

**Website:**
[https://visualanalytics.co.il/redalerts](https://visualanalytics.co.il/redalerts)

## Features

- Browse every alert day since 2021 with a date slider and playback mode
- City circles scaled by population, colored by alert count
- Tooltip showing alert count, population, and exact alert times per city
- Hebrew / English toggle
- Alert data updated automatically every 3 hours during Israeli daytime

## Tech Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vitejs.dev)
- [deck.gl](https://deck.gl) for map layers
- [MapLibre GL](https://maplibre.org) for the base map
- GitHub Actions for scheduled data fetching and deployment
- Cloudflare Pages for hosting (unlimited bandwidth)

## Development

```bash
npm install
npm run dev
```

## Data

Alert data is sourced from [tzevaadom.co.il](https://www.tzevaadom.co.il) and split into per-day JSON files under `public/red-alert/`. City metadata and population data are under `public/real-data/`.

## Architecture

### System Architecture

```mermaid
graph TB
    subgraph External["External Sources"]
        TZ["tzevaadom.co.il\nHistorical alerts API"]
    end

    subgraph DataPipeline["Data Pipeline (GitHub Actions · every 3h)"]
        Script["download-and-split-red-alerts.ts"]
        SplitFiles["public/red-alert/\nYYYY-MM-DD.json"]
        DatesFile["public/red-alert/\ndates.json"]
        CitiesScript["compute-savings.py"]
        CitiesData["public/real-data/\ncitiesData.json"]
    end

    subgraph Hosting["Hosting"]
        CF["Cloudflare Pages\n(primary · root /)"]
        GH["GitHub Pages\n(fallback · /redalerts/)"]
    end

    subgraph Frontend["Frontend App (React + Vite)"]
        subgraph Core["Core Components"]
            App["App.tsx\nState · Fetching · Aggregation"]
            DRB["DateRangeBar.tsx\nDate range slider UI"]
            MV["MapView.tsx\n3D map + ColumnLayers"]
            TP["TooltipPanel.tsx\nHover tooltip"]
            RS["RangeSlider.tsx\nCustom dual-range slider"]
        end

        subgraph Libs["Runtime Libraries"]
            DeckGL["deck.gl 9\nColumnLayer GPU rendering"]
            MLG["MapLibre GL 5\nMap base renderer"]
            RTL["Mapbox RTL Plugin\nHebrew / Arabic text"]
        end

        subgraph Support["Support Modules"]
            Constants["constants.ts\nColors · Map config"]
            Utils["utils.ts\nColor · Radius · Zone alias"]
            I18N["i18n.ts\nEN / HE strings"]
        end
    end

    TZ -->|"raw all.json"| Script
    Script -->|"split per-day"| SplitFiles
    Script -->|"sorted date list"| DatesFile
    CitiesScript -->|"merged metadata"| CitiesData

    SplitFiles -->|"fetch on demand\n(cached, debounced 300ms)"| App
    DatesFile -->|"fetch on startup"| App
    CitiesData -->|"fetch on startup"| App

    App --> DRB
    App --> MV
    MV --> TP
    DRB --> RS
    MV --> DeckGL
    DeckGL --> MLG
    MLG --> RTL
    App --> Constants
    App --> Utils
    App --> I18N
    MV --> Constants
    MV --> Utils

    Frontend -->|"deploy"| CF
    Frontend -->|"deploy (npm run deploy)"| GH
```

### Data Flow & User Interactions

```mermaid
sequenceDiagram
    participant User
    participant App as App.tsx
    participant Cache as Day Cache (useRef Map)
    participant Static as Static Files (CDN)

    User->>App: Page load
    App->>Static: GET dates.json
    Static-->>App: ["2021-05-20", ..., "2026-04-28"]
    App->>Static: GET citiesData.json (parallel)
    Static-->>App: {cities: {he_name: {lat, lng, pop, ...}}}
    App->>App: Build zone aliases (multi-zone city dedup)
    App->>App: Set default range (last ~60 days)
    App->>User: Render UI (DateRangeBar + MapView)

    User->>App: Move date range slider
    App->>App: Debounce 300ms
    loop For each day in range
        alt Day in cache
            App->>Cache: Read cached day
        else Day not cached
            App->>Static: GET red-alert/YYYY-MM-DD.json
            Note over App,Static: no-cache for today/yesterday
            Static-->>App: {alerts: [{serialNumber, cities, ...}]}
            App->>Cache: Store day data
        end
    end
    App->>App: Aggregate alerts per city\n(distinct serial numbers → totalAlerts, avgPerDay)
    App->>App: Build CityDot[] with color + height + radius
    App-->>User: Re-render ColumnLayers (GPU)

    User->>App: Hover over city column
    App-->>User: TooltipPanel (name, pop, alerts, avg/day)

    User->>App: Toggle language button
    App->>App: Flip lang (en ↔ he), update dir
    App-->>User: Re-render with RTL/LTR layout
```

### Technology Stack

```mermaid
graph LR
    subgraph Language["Language & Build"]
        TS["TypeScript ~5.9\nStrict mode"]
        Vite["Vite 8\nDev server · Bundler"]
        ES["Target: ES2023\nESNext modules"]
    end

    subgraph UI["UI Framework"]
        React["React 19\nFunctional components\nuseState · useEffect · useRef"]
        CSS["Modern CSS\nFlex · CSS vars\nGlassmorphism · Dark theme"]
    end

    subgraph Map["Map & Visualization"]
        Deck["deck.gl 9\nGPU-accelerated\nColumnLayer (3D bars)"]
        MapLibre["MapLibre GL 5\nOpen-source map renderer\nCartoDB Dark Matter style"]
        ReactMapLibre["@vis.gl/react-maplibre 8\nReact bindings"]
        RTL["Mapbox RTL Text Plugin\nHebrew · Arabic labels"]
    end

    subgraph DataIngest["Data Ingestion"]
        TSX["tsx 4\nNode.js TS runner"]
        FetchAPI["Fetch API\nHTTPS · no-cache policy\nfor recent days"]
    end

    subgraph Quality["Code Quality"]
        ESLint["ESLint 9\n+ typescript-eslint"]
    end

    subgraph Deploy["Deployment & CI"]
        GHActions["GitHub Actions\nScheduled: every 3h (daytime IL)"]
        CFPages["Cloudflare Pages\nPrimary host · unlimited BW"]
        GHPages["GitHub Pages\nghpages 6 · fallback"]
        Python["Python 3\nData prep script"]
    end

    TS --> Vite
    Vite --> ES
    React --> CSS
    Deck --> MapLibre
    MapLibre --> RTL
    ReactMapLibre --> Deck
    TSX --> FetchAPI
    GHActions --> TSX
    GHActions --> CFPages
    GHPages -.->|"fallback"| CFPages
    Python --> GHActions
```

## License

[MIT](LICENSE)
