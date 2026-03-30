# Refill Risk Demo — Cloudflare Worker

Adherence Risk Intelligence demo for the Pharmacy2U Data & AI Hackathon 2026.

Single Cloudflare Worker serving both the frontend UI and the prediction API.

## Quick Start (local)

```bash
cd demo
npm install
npm run dev
```

Opens at `http://localhost:8787`.

## Deploy to Cloudflare

```bash
cd demo
npm install
npx wrangler login   # one-time auth
npm run deploy
```

Wrangler will output your public URL (e.g. `https://refill-risk-demo.<your-subdomain>.workers.dev`).

## Architecture

```
demo/
├── wrangler.toml        # Cloudflare Worker config
├── package.json
└── src/
    ├── index.js          # Worker: API routes + serves frontend
    └── frontend.html     # Single-page app (Pharmacy2U themed)
```

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serves the frontend |
| POST | `/api/predict` | SSE stream: progress updates + risk predictions |
| GET | `/api/template` | Download CSV template (3 demo patients) |

**POST /api/predict** body:
```json
{
  "patients": [
    {
      "patient_id": "P-10001",
      "drug_name": "Metformin 500mg",
      "last_fill_date": "2026-03-01",
      "days_supply": "30",
      "patient_pay_amt": "12.50",
      "total_drug_cost": "45.00",
      "refill_count": "8",
      "age": "72",
      "chronic_conditions": "Diabetes,Hypertension"
    }
  ]
}
```

## Disclaimer

Model trained on CMS DE-SynPUF synthetic data. Not clinical advice. For demonstration purposes only.
