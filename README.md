# Purchase Order Scanner

A lightweight web app that ingests purchase order PDFs, extracts structured data with Mistral Document AI, stores the result in MongoDB, and presents a searchable list of scanned orders.

## Features

- PDF upload from the browser using a simple HTML + vanilla JS front end.
- Express-based TypeScript backend that streams PDFs to Mistral's Document AI OCR endpoint and persists the normalized output.
- Zod validation to guarantee consistent JSON structure before persistence.
- MongoDB storage with the most recent 200 purchase orders retrievable through the API.
- Resilient JSON parsing that automatically repairs slightly malformed responses from the LLM.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

> Deno users can run with `--compat` and the Node compatibility layer; the project keeps dependencies in `package.json` for Node but formats TypeScript via `deno fmt`.

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required values:

- `MONGODB_URI` / `MONGODB_DB`: MongoDB connection string and database name.
- `MISTRAL_API_KEY`: Mistral API key with access to Document AI.
- Optional overrides: `PORT`, `MISTRAL_API_URL`, `MISTRAL_OCR_MODEL`, `MISTRAL_RESPONSES_MODEL`.

### 3. Start MongoDB

Ensure MongoDB is running locally (default `mongodb://localhost:27017`). You can use Docker:

```bash
docker run --name mongodb -p 27017:27017 -d mongo:7.0
```

### 4. Run the server

#### Node.js (v22+)

```bash
npm run dev
```

This uses the `--experimental-strip-types` flag to execute TypeScript directly. The server will be available at [http://localhost:4000](http://localhost:4000).

#### Deno

```bash
deno run --allow-net --allow-read --allow-env --allow-write --compat src/server.ts
```

The compatibility flag lets Deno resolve npm packages declared in `package.json`.

### 5. Upload a PDF

Open the root URL in your browser, upload a purchase order PDF, and wait a few seconds. The parsed order appears in the grid along with vendor, purchaser, and line items.

## Testing

```bash
npm test
```

Runs a small Vitest suite that validates the purchase order schema coercions.

## Formatting

This project relies on Deno's formatter. Run it whenever you touch TypeScript or JSON:

```bash
deno fmt
```

## Project Structure

```
├── frontend/              # Static HTML + JS client
├── src/
│   ├── app.ts             # Express app factory
│   ├── server.ts          # Entry point with Mongo bootstrap
│   ├── config.ts          # Environment configuration
│   ├── db/mongo.ts        # MongoDB connection helpers
│   ├── routes/            # Express routers
│   ├── services/          # Mistral Document AI integration helpers
│   ├── types/             # Shared TypeScript types
│   └── utils/schema.ts    # Zod schema for PO validation
├── tests/                 # Vitest test suite
├── package.json
├── deno.json              # Formatting + lint preferences
└── .env.example
```

## API Overview

- `GET /api/health` – Simple status check.
- `GET /api/purchase-orders` – Returns the 200 most recent purchase orders.
- `POST /api/purchase-orders/upload` – Accepts a `multipart/form-data` body with a `file` field containing a PDF.

## Mistral Document AI Notes

The backend uploads PDFs as base64 data URIs to `POST /v1/ocr` with a JSON Schema that describes the target purchase order structure. Mistral returns page-level markdown, which serves two roles:

- When the OCR service provides structured annotations, we validate them directly.
- If annotations are absent or incomplete, we fallback to the `responses` API (`MISTRAL_RESPONSES_MODEL`) with the OCR markdown to synthesize a JSON payload that still satisfies the schema.

All responses go through `jsonrepair` before validation to handle minor formatting glitches.

## Next Steps

- Enhance the UI with search & filters.
- Persist raw Mistral responses for auditing.
- Add background retries if the LLM call fails transiently.
