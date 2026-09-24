# AMPLIFY Geo Pages

A Vercel-ready multi-client workflow that researches and drafts local authority pages, creates each result as a Google Doc, routes it to Aron for native Google approval, builds a branded WordPress review draft, and requires a separate owner approval before publication.

The Beinhaker probate app remains a separate project and deployment. This project only reuses the proven workflow ideas.

## Setup

1. Copy `.env.example` to `.env.local` and add an OpenAI API key.
2. In Google Cloud, enable the Google Drive API and create a Web OAuth client.
3. Add `http://localhost:3000/api/google/callback` and your production `/api/google/callback` URL as authorized redirect URIs.
4. Add the Google client credentials and a random `GOOGLE_TOKEN_SECRET` to the environment.
5. Run `npm run dev`, open the app, and connect Google once.

## Client Connections

After connecting the approved AMPLIFY Google account, open `/clients`. The Client Connections screen stores client profiles and WordPress Application Passwords as an encrypted file in Google Drive's private app-data folder. `GOOGLE_TOKEN_SECRET` is the encryption key and must remain stable across deployments.

For every client:

1. Add verified firm identity, practice areas, jurisdictions, phone, brand colors, logo, and lawyer assets.
2. Add the WordPress site, dedicated AMPLIFY username, and Application Password.
3. Install [AMPLIFY Content Bridge 1.8](/public/amplify-geo-bridge.zip).
4. Save the client and run **Test WordPress**.
5. Choose the verified WordPress author and blog category returned by the site.
6. Save again, then create one private test post and inspect its CTA, featured image, ALT text, metadata, schema, author, category, and internal links.

The connection test checks authenticated page, post, and media access; the actual bridge endpoint and version; Yoast; the publishing user; and configured blog defaults. Client credentials are never returned by the client APIs after saving.

## Environment profile fallback

`AMPLIFY_CLIENTS_JSON` remains supported as a migration and emergency fallback. Profiles saved through Client Connections override matching environment profiles. WordPress secrets stay server-side and the client API returns only safe status fields.

```json
[
  {
    "id": "client-slug",
    "name": "Client Law Firm",
    "website": "https://www.clientlaw.com",
    "reviewerEmail": "aron@amplifylaw.ai",
    "phoneDisplay": "(555) 555-1212",
    "phoneHref": "+15555551212",
    "locale": "en",
    "jurisdictions": ["New York", "Brooklyn"],
    "contactUrl": "https://www.clientlaw.com/contact/",
    "practiceAreas": ["Personal Injury", "Car Accidents"],
    "practiceAreaUrls": {
      "Personal Injury": "https://www.clientlaw.com/personal-injury/"
    },
    "lawyers": [
      {
        "name": "Principal Lawyer",
        "imageUrl": "https://www.clientlaw.com/uploads/principal-lawyer.png"
      }
    ],
    "brand": {
      "primary": "#17312d",
      "secondary": "#244e45",
      "accent": "#d5f443",
      "surface": "#f2f6f3",
      "logoUrl": "https://www.clientlaw.com/uploads/logo.png"
    },
    "blogDefaults": {
      "authorId": 4,
      "categoryId": 12,
      "defaultJurisdiction": "New York"
    },
    "cta": {
      "consultationText": "Tell us what happened and learn what options may be available.",
      "linkLabel": "Learn about personal injury cases"
    },
    "wordpress": {
      "siteUrl": "https://www.clientlaw.com",
      "username": "amplify-publisher",
      "applicationPassword": "xxxx xxxx xxxx xxxx xxxx xxxx",
      "pageTemplate": "optional-template.php"
    }
  }
]
```

Install [AMPLIFY Content Bridge](/public/amplify-geo-bridge.zip) on every connected WordPress site. The bridge stores SEO titles, meta descriptions, and JSON-LD schema for pages and blog posts. The app also uploads branded CTA banners, makes the tracking phone clickable, assigns generated featured images with alt text, and converts a city-service item into a link only when WordPress confirms the destination is already published.

## Approval sequence

1. The AI creates the Google Doc and shares it with Aron as editor.
2. Aron uses Google Drive’s native **Approve** control after editing.
3. The app verifies that approval and creates a WordPress **draft**. It does not publish.
4. The dashboard provides an **Approve & publish live** button for the owner’s final review.
5. The server verifies that the draft came from the same approved Google Doc before changing its WordPress status to `publish`.

The master prompt is stored in `src/lib/master-prompt.ts`. Tracker records are cached in the browser and synced to the connected account's private Google Drive app-data folder. Generated drafts live in the connected Google Drive.

## Aron approval draft delivery

Aron's approval queues a durable WordPress draft upload of the approved Google Doc. Approval intake preserves the reviewed copy and saves it as `draft`; it does not require publication-ready FAQs, imagery, layout or schema. The draft is marked `amplify-approval-intake:v1`, and the review queue displays outstanding preparation and FAQ warnings. Refresh WordPress prepares the formatted draft; the existing go-live checks still require the full FAQ standard and verified publication assets.

Opening the creator's dashboard backfills exact-Doc upload connections after checking Google access and recovers approved items missing WordPress IDs. An authorized publisher can also POST `/api/aron/recover-uploads` to run the same recovery immediately. Recovery skips active jobs and retains approvals. The upload worker reconciles the source-Doc marker in WordPress before creating a page, preventing duplicate drafts on retry.

Confirmed WordPress uploads automatically leave Aron’s approved queue and appear in the searchable Archive tab. The archive retains Google Doc links, WordPress edit links, and preparation notes; failed uploads remain in the approved queue. Manual archives are retained there too. Tracker synchronization preserves archive status for the same approved document.

Aron’s Waiting, Approved, and Archive tabs support row checkboxes and bulk deletion. Select All is limited to the current tab and search results. Deletion removes entries from AMPLIFY only, preserves Google Docs and WordPress pages, and stores a separate deletion marker so stale tracker snapshots or in-flight upload saves cannot restore the entry. Approved metadata is retained internally for duplicate suppression.
