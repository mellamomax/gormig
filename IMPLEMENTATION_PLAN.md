# Stockrobber Agent Implementation Plan

## Manual-first release

- Build a Next.js App Router dashboard deployable to Vercel.
- Store posts, transcripts, mentions, signals, run logs, and locks in Supabase/Postgres.
- Keep every secret server-side; no OpenAI, Supabase service role, Apify, or cron secret is exposed to browser code.
- Support manual transcript entry so the full analysis flow can be tested before scraping or cron is enabled.
- Support manual scraping/backfill with a user-chosen limit. No historical scrape runs automatically.
- Keep Vercel Cron disabled until manual validation is complete.

## Later activation

- Add a cron route only after manual scrape, manual transcript, and OpenAI analysis are verified.
- Add optional authentication before exposing the app beyond private testing.
- Add market-data enrichment after the core video analysis flow is stable.
