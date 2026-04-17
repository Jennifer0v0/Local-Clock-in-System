# Cloudflare Worker for Clockin Sync

This Worker provides a simple REST API for your page:
- `GET /api/clockin-sync?datasetId=default`
- `PUT /api/clockin-sync?datasetId=default`

It stores one JSON snapshot per `datasetId` in Cloudflare KV.

## 1) Prerequisites

- Cloudflare account
- Node.js LTS

## 2) Login and create KV namespace

Run in this folder:

```bash
npx wrangler login
npx wrangler kv namespace create SYNC_KV
npx wrangler kv namespace create SYNC_KV --preview
```

Copy the returned IDs into `wrangler.toml`:
- `id` = production KV id
- `preview_id` = preview KV id

## 3) Optional auth token

If you want Bearer auth, set a secret:

```bash
npx wrangler secret put AUTH_TOKEN
```

If `AUTH_TOKEN` is not set, the API is public.

## 4) Deploy

```bash
npx wrangler deploy
```

After deploy, you will get a URL like:

`https://clockin-sync.<your-subdomain>.workers.dev`

Your sync endpoint to paste in the page is:

`https://clockin-sync.<your-subdomain>.workers.dev/api/clockin-sync`

## 5) Fill your page fields

- Sync endpoint: your Worker endpoint above
- Dataset ID: `default` (or your custom dataset)
- Access token: same value as `AUTH_TOKEN` secret (leave empty if no auth)

## API contract

### GET

- Request: `GET /api/clockin-sync?datasetId=<id>`
- Response when empty: `{ "status": "empty", "datasetId": "<id>" }`
- Response when exists: `{ "updatedAt": "...", "clientId": "...", "data": { ... } }`

### PUT

- Request body:

```json
{
  "updatedAt": "2026-04-17T08:00:00.000Z",
  "clientId": "client_xxx",
  "data": { "checkinData": {} },
  "datasetId": "default"
}
```

- Response:
  - Stored snapshot, or
  - Existing snapshot if incoming data is older (`serverStatus: "ignored_older_snapshot"`).
