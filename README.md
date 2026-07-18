# Stockrobber Agent

Private manual-first web app for monitoring Stockrobber TikTok videos, saving transcripts, and generating structured investment research notes.

The app is intentionally **not automated yet**. There is no Vercel Cron schedule in this repo. You can test manual transcript entry and manual scrape/backfill first, then add automation later when the flow is verified.

## What is built

- Next.js App Router + TypeScript dashboard
- Supabase/Postgres schema for creators, posts, mentions, signals, run logs, and locks
- Manual transcript form for pasting text and testing analysis immediately
- OpenAI structured JSON analysis with Zod validation and retries
- Optional OpenAI transcription from a saved media URL
- Apify TikTok source behind a `SocialMediaSource` interface
- Manual scrape/backfill form where you choose how many videos to check
- Detail page per video
- History page per stock/ticker
- Basic Vitest tests for AI schema validation and Apify normalization

## Manual-first behavior

Nothing starts scraping by itself.

- No cron route is active.
- No Vercel Cron schedule is configured.
- Historical data is not fetched automatically.
- Scraping only happens when you press the manual scrape button and choose a limit.
- Manual transcript testing works without Apify.

## Required services

### Supabase

Supabase stores dashboard data:

- video URLs and metadata
- transcripts
- AI analysis
- mentioned companies/tickers
- signals and risk levels
- run logs and locks

Create a Supabase project, then run the SQL file:

`supabase/migrations/20260718143000_initial_schema.sql`

You can paste it into Supabase Dashboard -> SQL Editor -> Run.

### OpenAI API

OpenAI is used for:

- analyzing pasted transcripts
- optional transcription when a media URL is saved

Use a low monthly API budget/limit if you want cost control.

### Apify

Apify is only needed for manual TikTok scraping/backfill. Manual transcript testing does not need Apify.

Different TikTok Apify actors use slightly different input/output fields. This app supports common actor fields and lets you override the input JSON with `APIFY_ACTOR_INPUT_JSON`.

## Vercel environment variables

Add these in Vercel Project -> Settings -> Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
TIKTOK_USERNAME=stockrobber
ALPHA_VANTAGE_API_KEY=
```

Only add these when you want scraper testing:

```env
APIFY_API_TOKEN=...
APIFY_ACTOR_ID=...
APIFY_ACTOR_INPUT_JSON=
```

Reserved for later automation/security:

```env
APP_PASSWORD=
CRON_SECRET=
```

Important: never create `NEXT_PUBLIC_OPENAI_API_KEY`. Anything with `NEXT_PUBLIC_` can be exposed to the browser.

## Local development

Install Node.js 20+ first if it is not installed.

```powershell
cd "C:\Users\mask\OneDrive - Normal AS\Max S\Code\gormig"
npm install
copy .env.example .env.local
npm run dev
```

Fill `.env.local` with the same values as Vercel when testing locally.

## Follow-up accuracy tracking

The dashboard has an “Uppföljning” tab. It compares each saved signal against actual daily close prices once the signal time horizon has passed.

Current market-data adapter: Alpha Vantage `TIME_SERIES_DAILY`.

- Add `ALPHA_VANTAGE_API_KEY` in Vercel to enable it.
- The app only runs follow-up when you press the button.
- `INSUFFICIENT_DATA` signals are ignored.
- Future target dates are saved as pending.
- Results are research QA only, not trading advice.

## Manual test flow

1. Deploy/import the repo on Vercel.
2. Add Supabase and OpenAI env vars in Vercel.
3. Run the Supabase SQL migration.
4. Open the dashboard.
5. Paste a transcript in “Lägg till transkriberad video manuellt”.
6. Check “Analysera direkt med OpenAI”.
7. Confirm the detail page shows transcript, company mentions, signals, risk, and confidence.
8. Only after that, add Apify env vars and test manual scrape with a small limit, e.g. 3 videos.

## Activating automation later

When manual testing is done, add a protected cron route and a Vercel Cron entry. Do not add it before the manual flow is verified.

Recommended later cron protection:

- `CRON_SECRET` env var
- Authorization header check
- lock via `app_locks`
- report with found/new/processed/failed counts

## Scripts

```powershell
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Notes

This app generates research support, not trading instructions. Signals must include reasoning and risk information, and are stored as analysis material only.
