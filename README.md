<p align="center">
  <img src="resources/brand-assets/p2u_logo.svg" alt="Pharmacy2U" height="48" />
  <h1 align="center">Prescription Refill Risk</h1>
  <p align="center">Predicting late prescription refills using machine learning</p>
</p>

<p align="center">
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.10+-blue?logo=python&logoColor=white" alt="Python 3.10+"></a>
  <a href="https://github.com/omariosc/prescription-refill-risk/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen?logo=github" alt="Build Passing"></a>
  <a href="https://github.com/omariosc/prescription-refill-risk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License MIT"></a>
  <a href="https://lightgbm.readthedocs.io/"><img src="https://img.shields.io/badge/model-LightGBM-orange?logo=microsoft&logoColor=white" alt="LightGBM"></a>
  <a href="https://shap.readthedocs.io/"><img src="https://img.shields.io/badge/explainability-SHAP-purple" alt="SHAP"></a>
  <a href="https://scikit-learn.org/"><img src="https://img.shields.io/badge/sklearn-1.3+-F7931E?logo=scikit-learn&logoColor=white" alt="scikit-learn"></a>
  <a href="https://pandas.pydata.org/"><img src="https://img.shields.io/badge/pandas-2.0+-150458?logo=pandas&logoColor=white" alt="Pandas"></a>
  <a href="https://matplotlib.org/"><img src="https://img.shields.io/badge/matplotlib-3.7+-11557C" alt="Matplotlib"></a>
</p>

<p align="center">
  <strong>Challenge A</strong> &mdash; Data & AI Hackathon, University of Leeds, 30&ndash;31 March 2026<br>
  Sponsored by <a href="https://www.pharmacy2u.co.uk/">Pharmacy2U</a>
</p>

---

## What this project does

Uses Medicare claims data (CMS DE-SynPUF, 2008–2010) to predict which prescription refills will arrive late. A LightGBM model is trained on 60+ features from fill history, patient demographics, and healthcare utilisation. Risk scores are classified into LOW / MEDIUM / HIGH tiers with SHAP explanations and MAPIE conformal prediction intervals.

---

## Quick start

> You only need Python to run the ML pipeline. The demo web app runs independently with Node.js.

---

## Part 1 — ML Pipeline

### Prerequisites

- [Python 3.10 or newer](https://www.python.org/downloads/)
- [Git](https://git-scm.com/)

### Step 1 — Clone the repo

```bash
git clone https://github.com/omariosc/prescription-refill-risk.git
cd prescription-refill-risk
```

### Step 2 — Create a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate      # Mac / Linux
.venv\Scripts\activate         # Windows
```

### Step 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Download the data

The pipeline uses [CMS DE-SynPUF Sample 1](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files/cms-2008-2010-data-entrepreneurs-synthetic-public-use-file-de-synpuf) — a fully synthetic Medicare dataset (no real patient data).

Download the following 8 files and place them in `data/raw/`:

| File | What it contains |
|------|-----------------|
| `DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv` | All prescription fills (the main dataset) |
| `DE1_0_2008_Beneficiary_Summary_File_Sample_1.csv` | Patient demographics — 2008 |
| `DE1_0_2009_Beneficiary_Summary_File_Sample_1.csv` | Patient demographics — 2009 |
| `DE1_0_2010_Beneficiary_Summary_File_Sample_1.csv` | Patient demographics — 2010 |
| `DE1_0_2008_to_2010_Inpatient_Claims_Sample_1.csv` | Hospital admissions |
| `DE1_0_2008_to_2010_Outpatient_Claims_Sample_1.csv` | Clinic visits |
| `DE1_0_2008_to_2010_Carrier_Claims_Sample_1A.csv` | Physician claims (part A) |
| `DE1_0_2008_to_2010_Carrier_Claims_Sample_1B.csv` | Physician claims (part B) |

Your `data/raw/` folder should look like this:

```
data/
└── raw/
    ├── DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv
    ├── DE1_0_2008_Beneficiary_Summary_File_Sample_1.csv
    ├── DE1_0_2009_Beneficiary_Summary_File_Sample_1.csv
    ├── DE1_0_2010_Beneficiary_Summary_File_Sample_1.csv
    ├── DE1_0_2008_to_2010_Inpatient_Claims_Sample_1.csv
    ├── DE1_0_2008_to_2010_Outpatient_Claims_Sample_1.csv
    ├── DE1_0_2008_to_2010_Carrier_Claims_Sample_1A.csv
    └── DE1_0_2008_to_2010_Carrier_Claims_Sample_1B.csv
```

### Step 5 — Run the pipeline

```bash
python scripts/run_pipeline.py
```

This takes around 10–20 minutes on a standard laptop. You will see progress printed for each phase.

When it finishes, results are saved to `outputs/`:

| File | What it is |
|------|-----------|
| `metrics.json` | Model performance (PR-AUC, ROC-AUC) on validation and test sets |
| `risk_tiers.json` | Risk tier definitions and actual late-refill rates per tier |
| `ndc_lookup.csv` | Drug name enrichment table (NDC codes → drug names) |
| `shap_importance.png` | Top features by SHAP gain |
| `shap_summary.png` | SHAP beeswarm plot |
| `calibration.png` | Predicted vs actual late rates |
| `risk_distribution.png` | Risk score histogram by tier |
| `uncertainty_analysis.png` | Prediction interval widths |
| `patient_timeline_*.png` | Example patient refill history |

### Optional — Run population analytics

This scores all 1.47M fills and produces JSON files for the analytics dashboard. Takes around 20–30 minutes.

```bash
python scripts/run_population.py
```

Outputs are saved to `outputs/population/`:

| File | What it is |
|------|-----------|
| `dashboard_data.json` | Aggregated stats by time, drug, age, race, state — used by the frontend |
| `population_stats.json` | Full detail version of the same stats |

---

## Part 2 — Demo Web App

The demo is a Cloudflare Worker + React frontend. It runs entirely locally with no Python or data files required.

### Prerequisites

- [Node.js 20+](https://nodejs.org/)

### Running the Cloudflare Worker (backend + UI)

```bash
cd demo
npm install
npm run dev
```

Open [http://localhost:8787](http://localhost:8787).

This serves both the API and the built frontend. Use this for a quick local demo.

### Running the React frontend in dev mode

If you want hot-reload while editing the frontend:

**Terminal 1 — start the worker (API)**

```bash
cd demo
npm install
npm run dev
```

**Terminal 2 — start the React dev server**

```bash
cd demo/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The React app proxies API calls to the worker on port 8787 automatically.

### Setting up the database (optional, for auth features)

The demo uses a Cloudflare D1 SQLite database for login. For local development:

```bash
cd demo
npm run db:migrate    # creates tables
npm run db:seed       # adds a demo admin user (edit seed.sql first — see security note below)
```

> **Security note:** `seed.sql` is intentionally excluded from this repo because it contains credentials. Create your own `demo/seed.sql` with a fresh TOTP secret before running `db:seed`. See `demo/schema.sql` for the expected table structure.

---

## Configuration

All pipeline parameters live in one place — `src/utils.py`:

| Constant | Default | What it controls |
|----------|---------|-----------------|
| `GRACE_DAYS` | `7` | Days after run-out before a refill is "late" |
| `TRAIN_END` | `2009-06-30` | End of training period |
| `VAL_END` | `2009-12-31` | End of validation period (test = everything after) |
| `TIER_LOW` | `0.30` | Threshold below which risk is LOW |
| `TIER_HIGH` | `0.55` | Threshold at or above which risk is HIGH |

---

## Meet the Team

<table>
  <tr>
    <td align="center" width="200">
      <img src="https://dhri.crc.gov.my/images/Team/Profile/wong.jpg" width="80" height="80" style="border-radius:50%;object-fit:cover" alt="Xin Ci Wong" /><br>
      <strong>Dr Xin Ci Wong</strong><br>
      <a href="https://github.com/X-ksana">
        <img src="https://img.shields.io/badge/-GitHub-181717?logo=github&logoColor=white&style=flat-square" />
      </a>
      <a href="https://uk.linkedin.com/in/xin-ci-wong-a74833159">
        <img src="https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white&style=flat-square" />
      </a>
      <a href="mailto:scxcw@leeds.ac.uk">
        <img src="https://img.shields.io/badge/-Email-EA4335?logo=gmail&logoColor=white&style=flat-square" />
      </a>
    </td>
    <td align="center" width="200">
      <img src="https://media.licdn.com/dms/image/v2/D4E03AQFbUd8YSSjSjQ/profile-displayphoto-shrink_200_200/B4EZOi37HzGQAg-/0/1733604389876?e=2147483647&v=beta&t=epKr5ZG5GYbb-9jTafc_DReI3KPgJSoZMR821bzx-j8" width="80" height="80" style="border-radius:50%;object-fit:cover" alt="Arpita Saggar" /><br>
      <strong>Arpita Saggar</strong><br>
      <a href="https://github.com/arpita2512">
        <img src="https://img.shields.io/badge/-GitHub-181717?logo=github&logoColor=white&style=flat-square" />
      </a>
      <a href="https://www.linkedin.com/in/arpitasaggar/">
        <img src="https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white&style=flat-square" />
      </a>
      <a href="mailto:scasag@leeds.ac.uk">
        <img src="https://img.shields.io/badge/-Email-EA4335?logo=gmail&logoColor=white&style=flat-square" />
      </a>
    </td>
    <td align="center" width="200">
      <img src="https://media.licdn.com/dms/image/v2/D4E03AQFGHW0j5uOYlg/profile-displayphoto-scale_200_200/B4EZgf4RDOGUAY-/0/1752881501982?e=2147483647&v=beta&t=fmWyEFp6uJogKDKiAZ8asTmShJIUlefUPgv-W2DG76Y" width="80" height="80" style="border-radius:50%;object-fit:cover" alt="Omar Choudhry" /><br>
      <strong>Omar Choudhry</strong><br>
      <a href="https://github.com/omariosc">
        <img src="https://img.shields.io/badge/-GitHub-181717?logo=github&logoColor=white&style=flat-square" />
      </a>
      <a href="https://uk.linkedin.com/in/omarchoudhry01">
        <img src="https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white&style=flat-square" />
      </a>
      <a href="mailto:O.Choudhry@leeds.ac.uk">
        <img src="https://img.shields.io/badge/-Email-EA4335?logo=gmail&logoColor=white&style=flat-square" />
      </a>
    </td>
  </tr>
</table>
