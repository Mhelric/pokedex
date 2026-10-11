# 🔴 Pokédex Web Application

A modern, responsive, client-first Pokédex application built with vanilla JavaScript (ES modules), CSS3, and PokéAPI. The application features paginated directory loading, live search, dual-type and generation filtering, an interactive team builder with defensive synergy calculation, a PC Storage Box management drawer, camera/image-based Pokémon recognition via Google Lens, a "Who's That Pokémon?" mini-game, and Progressive Web App (PWA) installation support.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Installation & Getting Started](#-installation--getting-started)
- [Progressive Web App (PWA) Support](#-progressive-web-app-pwa-support)
- [Environment Variables](#-environment-variables)
- [Core Modules Breakdown](#-core-modules-breakdown)
- [Storage & Persistence Architecture](#-storage--persistence-architecture)
- [Camera Scanner & Serverless API](#-camera-scanner--serverless-api)
- [Performance & Optimization Strategies](#-performance--optimization-strategies)
- [License](#-license)

---

## 🚀 Key Features

- **Progressive Web App (PWA) Installable:** Can be installed on desktop and mobile home screens as a standalone app while fetching live data online.
- **Infinite Scrolling & Batch Loading:** Loads Pokémon records in modular batches with client-side caching to reduce network overhead.
- **Dynamic Multi-Vector Filtering:** Filter seamlessly by primary type, secondary type, and Generation (Gen 1 through Gen 9).
- **Debounced Live Search:** Fast client-side lookups by Pokémon name, National Dex ID, alternate form tags, and base species.
- **Multiple Sprite Display Modes:** User-selectable sprite rendering modes (Official Artwork, 3D / Animated Sprites, and Retro Pixel Sprites).
- **Interactive Detail Modal:**
  - Dynamic base stats with Lv. 100 Min/Max boundary recalculations.
  - Interactive Shiny sprite toggle with custom particle animations.
  - Audio cries paired with browser Web Speech Synthesis (`SpeechSynthesisUtterance`).
  - Version-specific flavor texts and generation-filtered movepools (Level-up, TM/HM, Egg, Tutor).
  - Interactive multi-branch evolution trees supporting regional variants and Mega/Battle forms.
- **Defensive Type Matchups & Squad Synergy:** Real-time defensive vulnerability and resistance calculator across single cards and full 6-member teams.
- **Caught Pokémon (PC Box System):** Full desktop/mobile PC box interface with slide-out inspection drawer, Gen filters, sort toggles, and bulk release flows.
- **Camera Pokédex Scanner:** Live webcam or image upload scanner identifying Pokémon via a serverless Google Lens/SerpApi bridge.
- **"Who's That Pokémon?" Mini-Game:** Interactive silhouette guessing game featuring streak tracking, high scores, and audio feedback.

---

## 🛠 Architecture & Tech Stack

- **Frontend Core:** HTML5, Modern CSS3 (CSS Grid, Flexbox, Custom Properties, Glassmorphism), Vanilla JavaScript (ES6+ Modules).
- **PWA & Offline Shell:** Web App Manifest (`manifest.json`), Service Worker (`sw.js`).
- **Icons & Typography:** Font Awesome 6.5.1, Google Fonts (*Plus Jakarta Sans*).
- **Data Source:** [PokéAPI v2](https://pokeapi.co/) REST API.
- **Backend / Serverless Integration:** Node.js Serverless Function (`api/scan.js`) interacting with SerpApi (Google Lens engine).
- **State Management:** Local browser persistence via `window.localStorage` combined with an in-memory `Map` cache.

---

## 📂 Project Directory Structure

```text
mhelric-pokedex/
├── README.md                 # Project documentation
├── index.html                # Single-page application markup & modal templates
├── manifest.json             # Web App Manifest for PWA installation
├── sw.js                     # Service Worker for app shell caching & network requests
├── icons/                    # App icons (192x192, 512x512, favicons)
│   ├── icon-192.png
│   └── icon-512.png
├── api/
│   └── scan.js               # Serverless endpoint for reverse image search (Lens/SerpApi)
├── js/
│   ├── api.js                # PokéAPI client wrappers, data transforms & calculations
│   ├── app.js                # App entry point, DOM event delegation & state orchestration
│   ├── minigame.js           # Trivia mini-game loop, streak handler & scoring logic
│   ├── scanner.js            # MediaDevices camera feed capture & image serialization
│   ├── team.js               # Team builder roster state & storage sync
│   └── ui.js                 # HTML string template builders & DOM render functions
└── styles/
    ├── animations.css        # Keyframe animations (sparkles, Pokeball loader, scan laser)
    ├── main.css              # Core typography, reset, grid layouts & design tokens
    └── retro-ui.css          # Theme overrides, modal layouts & PC box styling

```

---

## 📦 Installation & Getting Started

### Prerequisites

* Modern Web Browser (Chrome, Safari, Firefox, or Edge supporting WebRTC, Service Workers, and ES Modules).
* [Node.js](https://nodejs.org/) (v18.x or later recommended if testing the `api/scan.js` serverless function locally).

### Local Setup

1. **Clone the repository:**
```bash
git clone [https://github.com/your-username/mhelric-pokedex.git](https://github.com/your-username/mhelric-pokedex.git)
cd mhelric-pokedex

```


2. **Serve the client application:**
Because the project relies on native ES Modules and Service Workers, it must be served over an HTTP server rather than the `file://` protocol.
Using Node's built-in `npx serve`:
```bash
npx serve .

```


Or using Python 3:
```bash
python3 -m http.server 8000

```


Open `http://localhost:8000` (or the URL printed in terminal) in your browser.

---

## 📲 Progressive Web App (PWA) Support

This application meets all Chromium criteria for an installable Progressive Web App:

* **Standalone Display:** Runs in a distraction-free window without URL chrome when installed.
* **In-App Install Prompt:** Captures `beforeinstallprompt` to surface a clean install button inside the Settings modal.
* **Network-First Service Worker:** Employs a network-first caching strategy in `sw.js` to ensure the live app shell loads reliably while always fetching up-to-date PokéAPI records from the web.

---

## 🔐 Environment Variables

The visual scanner feature (`api/scan.js`) utilizes SerpApi to access the Google Lens reverse search engine. If deploying to **Vercel**, **Netlify**, or another serverless host, set the following environment variable:

| Variable | Description | Required |
| --- | --- | --- |
| `SERPAPI_KEY` | Your private SerpApi authentication key | Yes (for camera scanner only) |

*Note: All core Pokédex browsing, searching, minigame, and team builder features function completely client-side without this key.*

---

## 🧩 Core Modules Breakdown

### `js/app.js` (Orchestrator)

Initializes UI controls, manages active filter states (`activeType`, `activeGen`, `spriteDisplayMode`), listens for modal closures, registers the PWA install flow, and controls the infinite scroll lifecycle via `loadScrollBatch()`. Uses native `AbortController` to cancel pending background requests during rapid filter changes.

### `sw.js` (Service Worker)

Manages the application lifecycle, pre-caches core layout assets (HTML, stylesheets, scripts) on install, and routes runtime network requests dynamically.

### `js/ui.js` (Component Rendering)

Encapsulates rendering logic for Pokémon grid cards, modal contents, stat bars, movepool tables, evolution trees, and defensive synergy tables. Calculates and normalizes min/max Pokémon stats based on Lv. 100 EV/IV spreads.

### `js/team.js` (Roster Store)

Enforces a hard limit of 6 squad members with duplicate detection. Synchronizes roster operations (`addToTeam`, `removeFromTeam`, `clearTeam`) with `localStorage`.

### `js/scanner.js` & `api/scan.js` (Image Recognition)

Accesses camera hardware via `navigator.mediaDevices.getUserMedia`, extracts frames onto a hidden canvas, and converts them to base64 JPEG buffers. The backend parses Google Lens candidates against PokéAPI endpoints to return identified species names.

### `js/minigame.js` (Game Loop)

Fetches 4 random Pokémon records concurrently, generates silhouette CSS filters, evaluates user picks, plays Pokémon audio cries, and maintains win-streak data.

---

## 💾 Storage & Persistence Architecture

The application persists user settings and rosters across browser sessions using `localStorage`:

| Key Pattern | Type | Purpose |
| --- | --- | --- |
| `pokedex_team` | `Array<Object>` | Serialized array of Pokémon in the active 6-member squad. |
| `caught_<id>` | `Boolean` | Tracking state indicating whether Pokémon ID is caught. |
| `fav_<id>` | `Boolean` | Favorited status of Pokémon ID. |
| `sprite_display_mode` | `String` | Active sprite view preference (`artwork`, `animated`, or `pixel`). |
| `minigame_highscore` | `Number` | Persistent high score record for the silhouette game. |

---

## ⚡ Performance & Optimization Strategies

* **In-Memory Caching:** Uses an internal `fetchedCache` Map to prevent duplicate network calls for already fetched Pokémon objects.
* **Debounced Input:** User search queries are throttled with a 350ms debounce function to prevent API rate-limiting.
* **Abortable Signals:** Uses `AbortController` instances to cancel in-flight batch requests if the user switches filters mid-fetch.
* **Lazy Asset Loading:** All card and evolution thumbnails specify `loading="lazy"` to defer image decoding until elements enter the viewport.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.