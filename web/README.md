# Arbitrage Betting Platform – Frontend

## Overview

This frontend is a modern, type-safe web application built with Next.js (App Router), React, and TypeScript. It provides a responsive, real-time UI for discovering and analyzing sports betting arbitrage opportunities, with a focus on performance, usability, and extensibility.

## Key Frontend Features

- **Modern UI/UX:** Responsive design with Tailwind CSS, dark mode, and mobile-friendly layouts
- **Real-time filtering:** Debounced, persistent filters for sports, markets, ROI, and bookmakers
- **Infinite scroll / pagination:** Efficiently loads and displays large result sets
- **Admin dashboard:** Analytics, health checks, and debug tools for operators
- **Demo mode:** Safe, offline testing with mock data
- **Type safety:** End-to-end TypeScript, shared types between frontend and backend
- **Optimized data fetching:** SWR for caching, revalidation, and low-latency updates

## Frontend Architecture

- **App Router:** Uses Next.js 15 App Router for server components, layouts, and API integration
- **Component Structure:**
  - `/app` – Main pages and layouts
  - `/components` – UI components (Filters, StakeSplit, RefreshButton, etc.)
  - `/lib` – Shared utilities and type definitions
- **State Management:** Local state (React hooks), URL params, and localStorage for filter persistence
- **Data Flow:**
  1.  User sets filters (sports, markets, ROI, bookmakers)
  2.  UI syncs state to URL and localStorage
  3.  SWR fetches opportunities from REST API with current filters
  4.  Results are displayed, paginated, and updated in real time

Frontend Architecture Diagram:

```
┌──────────────────────────────┐
│        User (Browser)        │
└──────────────┬───────────────┘
         │
         ▼
┌──────────────────────────────┐
│      React Components        │
│  (Filters, StakeSplit, etc.) │
└──────────────┬───────────────┘
         │
         ▼
┌──────────────────────────────┐
│   State Management & SWR     │
│ (URL, localStorage, caching) │
└──────────────┬───────────────┘
         │
         ▼
┌──────────────────────────────┐
│      REST API Requests       │
│   (/api/opportunities, etc.) │
└──────────────┬───────────────┘
         │
         ▼
┌──────────────────────────────┐
│      Rendered UI Output      │
└──────────────────────────────┘
```

## Installation & Local Development

```bash
# From project root, install dependencies
cd web
npm install

# Start the development server
npm run dev

# Visit http://localhost:3000
```

## Usage & Customization

- **Edit UI:** Modify components in `/components` or pages in `/app`
- **Add new filters:** Update `Filters.tsx` and sync with backend API params
- **Theming:** Tailwind CSS for rapid UI changes and dark mode
- **Type safety:** All API responses and UI state use shared TypeScript types

## Example: Filtered Arbitrage Opportunity

```json
{
  "id": "456-SPREAD",
  "sport": "basketball",
  "league": "NBA",
  "startsAt": "2025-09-27T01:00:00Z",
  "teamA": "Lakers",
  "teamB": "Celtics",
  "roiPct": 1.85,
  "market": "SPREAD",
  "line": -3.5,
  "legs": [
    { "book": "BookA", "outcome": "A", "dec": 1.95 },
    { "book": "BookB", "outcome": "B", "dec": 1.95 }
  ]
}
```

## Frontend Impact & Resume Value

- Built a real-time, type-safe React UI for financial/odds data
- Implemented persistent, debounced filters and infinite scroll
- Demonstrated advanced state management and API integration
- Designed for extensibility: new sports, markets, and UI features can be added rapidly

## Future Frontend Enhancements

- PWA/mobile support for on-the-go arbitrage monitoring
- Advanced data visualizations (charts, ROI history, etc.)
- User authentication and personalized alerting
- Integration with AI/ML-driven odds prediction APIs

---

> For backend and full-stack documentation, see the project root `README.md`.
