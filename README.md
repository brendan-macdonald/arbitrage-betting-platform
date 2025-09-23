# Arbitrage Betting Platform

A modern web app for discovering and analyzing sports betting arbitrage opportunities in real time.

---

## Overview

- **Finds and displays arbitrage opportunities** across major sports and sportsbooks
- **Scheduled and on-demand ingestion** of odds from The Odds API
- **Admin dashboard** for analytics and health
- **Demo mode** for safe, offline testing

## Tech Stack

- **Next.js 15** (App Router, React Server Components)
- **Prisma ORM** (type-safe DB access)
- **PostgreSQL** (relational database)
- **The Odds API** (odds data provider)

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd arbitrage-betting-platform/web
npm install
```

### 2. Configure Environment

Create a `.env` file in `/web`:

```env
# .env example
DATABASE_URL="postgresql://dev:dev@localhost:5432/arb?schema=public"
ODDS_API_KEY="your-odds-api-key"
ODDS_API_SPORT="basketball_nba"
ODDS_API_REGION="us"
ODDS_API_MARKET="h2h"
NEXT_PUBLIC_DEMO="0"  # Set to 1 for demo mode
```

### 3. Run Postgres

- **With Docker:**
  ```bash
  docker run --name arb-postgres -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=arb -p 5432:5432 -d postgres:15
  ```
- **Or use your system Postgres** (ensure credentials match `.env`)

### 4. Migrate & Seed

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 5. Start the App

```bash
npm run dev
```

---

## Demo Mode

- Set `NEXT_PUBLIC_DEMO=1` in `.env` to enable mock data and safe testing.
- The UI and API will serve static mock opportunities.

---

## Key API Routes

- `POST /api/ingest-all` — Batch ingest odds for all sports/markets
- `POST /api/ingest-odds` — Ingest odds for a specific sport/market
- `GET  /api/opportunities` — List current arbitrage opportunities (supports filters)
- `GET  /api/health` — Health check endpoint

---

## Demo Script

```bash
# 1. Start Postgres (if not running)
docker start arb-postgres || docker run --name arb-postgres -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=arb -p 5432:5432 -d postgres:15
# 2. Run migrations and seed
cd web
npx prisma migrate deploy
npx prisma db seed
# 3. Start the app
npm run dev
# 4. Visit the app at http://localhost:3000
# 5. Try: /api/opportunities, /admin/analytics, /api/health
```

---

## Screenshots

![Dashboard](/public/screenshot-dashboard.png)
![Opportunities Table](/public/screenshot-opportunities.png)

---

For more, see the code and comments throughout the repo. PRs and issues welcome!
