# AMPLIFY Geo Pages

A Vercel-ready workflow app that researches and drafts local authority practice pages, creates each result as a Google Doc, shares it with `aron@amplifylaw.ai`, and tracks the review/publishing checklist.

## Setup

1. Copy `.env.example` to `.env.local` and add an OpenAI API key.
2. In Google Cloud, enable the Google Drive API and create a Web OAuth client.
3. Add `http://localhost:3000/api/google/callback` and your production `/api/google/callback` URL as authorized redirect URIs.
4. Add the Google client credentials and a random `GOOGLE_TOKEN_SECRET` to the environment.
5. Run `npm run dev`, open the app, and connect Google once.

The master prompt is stored in `src/lib/master-prompt.ts`. Tracker records are cached in the browser and synced to the connected account's private Google Drive app-data folder. Generated drafts live in the connected Google Drive.
