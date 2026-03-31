<p align="center">
  <img src="resources/brand-assets/p2u_logo.svg" alt="Pharmacy2U" height="48" />
  <h1 align="center">Prescription Refill Risk</h1>
  <p align="center">Predicting late prescription refills using machine learning</p>
</p>

<p align="center">
  <a href="https://refill-risk-demo.omariosc101.workers.dev"><img src="https://img.shields.io/badge/demo-live-00e0bc?logo=cloudflare&logoColor=white" alt="Live Demo"></a>
  <a href="https://github.com/omariosc/prescription-refill-risk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License MIT"></a>
  <a href="https://lightgbm.readthedocs.io/"><img src="https://img.shields.io/badge/model-LightGBM-orange?logo=microsoft&logoColor=white" alt="LightGBM"></a>
  <a href="https://shap.readthedocs.io/"><img src="https://img.shields.io/badge/explainability-SHAP-purple" alt="SHAP"></a>
</p>

<p align="center">
  <strong>Challenge A</strong> &mdash; Data &amp; AI Hackathon, University of Leeds, 30&ndash;31 March 2026<br>
  Sponsored by <a href="https://www.pharmacy2u.co.uk/">Pharmacy2U</a>
</p>

---

## What this project does

Patients who pick up repeat prescriptions late risk gaps in their medication — particularly serious for conditions like diabetes or hypertension. This project builds a machine learning model that predicts, for each patient and drug, how likely their **next** refill is to arrive late.

Using three years of anonymised prescription records (2008–2010), the model assigns each upcoming refill a risk score. A pharmacist can then proactively contact high-risk patients before a lapse occurs.

> **Data note:** All analysis uses the [CMS DE-SynPUF](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files/cms-2008-2010-data-entrepreneurs-synthetic-public-use-file-de-synpuf) dataset — a fully **synthetic** (artificially generated) recreation of US Medicare records. It contains no real patient information and is freely available for research and education.

---

## The quickest way to explore

**No setup required:**

| Option | Link |
|--------|------|
| 🌐 Live demo (web tool) | [refill-risk-demo.omariosc101.workers.dev](https://refill-risk-demo.omariosc101.workers.dev) |
| 📓 Notebook 1 — Data Cleaning | [View on nbviewer](https://nbviewer.org/github/omariosc/prescription-refill-risk/blob/main/notebooks/data_cleaning_clean.ipynb) |
| 📓 Notebook 2 — Exploratory Analysis | [View on nbviewer](https://nbviewer.org/github/omariosc/prescription-refill-risk/blob/main/notebooks/eda_with_late_refillers.ipynb) |
| 📓 Notebook 3 — Predictive Model | [View on nbviewer](https://nbviewer.org/github/omariosc/prescription-refill-risk/blob/main/notebooks/challenge_a_model.ipynb) |

For the live demo, log in with:
- **Email:** `test@pharmacy2u.co.uk`
- **Authenticator code:** `123456`

---

## Part 1 — Running the analysis notebooks

The analysis is split across three notebooks that run in **Google Colab** — a free, browser-based Python environment provided by Google. You do not need to install anything on your computer.

| # | Notebook | What it does |
|---|----------|-------------|
| 1 | `data_cleaning_clean.ipynb` | Loads the raw data, removes bad records, engineers features, and saves a clean dataset |
| 2 | `eda_with_late_refillers.ipynb` | Explores the data — who refills late, which drugs, which demographics |
| 3 | `challenge_a_model.ipynb` | Trains the prediction model and generates risk scores and explanations |

**Run them in order** — each notebook builds on the output of the one before it.

---

### What you need before starting

1. **A Google account** — needed for Google Colab and Google Drive (both free).
2. **The CMS DE-SynPUF data files** — free synthetic Medicare data. Download instructions below.

---

### Step 1 — Download the data files

1. Go to the [CMS DE-SynPUF download page](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files/cms-2008-2010-data-entrepreneurs-synthetic-public-use-file-de-synpuf).
2. Download **Sample 1** of each of these four files:

| File name | What it contains |
|-----------|-----------------|
| `DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv` | All prescription fill records (the main dataset — ~5.5 million rows) |
| `DE1_0_2008_Beneficiary_Summary_File_Sample_1.csv` | Patient age, sex, and health conditions for 2008 |
| `DE1_0_2009_Beneficiary_Summary_File_Sample_1.csv` | Patient age, sex, and health conditions for 2009 |
| `DE1_0_2010_Beneficiary_Summary_File_Sample_1.csv` | Patient age, sex, and health conditions for 2010 |

---

### Step 2 — Upload the files to Google Drive

The notebooks read files directly from your Google Drive, so you need to upload the four files there first.

1. Go to [drive.google.com](https://drive.google.com) and sign in.
2. Create this exact folder structure (the notebooks look for files here by default):

```
My Drive/
└── pharma2u/
    └── datasets/
        ├── DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv
        ├── DE1_0_2008_Beneficiary_Summary_File_Sample_1.csv
        ├── DE1_0_2009_Beneficiary_Summary_File_Sample_1.csv
        └── DE1_0_2010_Beneficiary_Summary_File_Sample_1.csv
```

> **Using a different folder?** That is fine — just update the file path variable in the **Setup** cell at the top of each notebook before running. The variable names and their defaults are shown in the table below.
>
> | Notebook | Variable to update | Default path |
> |----------|--------------------|--------------|
> | Notebook 1 | `PDE_PATH` and `BENE_PATH` | `/content/drive/MyDrive/pharma2u/datasets/` |
> | Notebook 2 | `link` | `/content/drive/MyDrive/pharma2u/datasets/full_df_with_msr.parquet` |
> | Notebook 3 | `link` | `/content/drive/MyDrive/pharma2u/datasets/full_df_with_msr.parquet` |

---

### Step 3 — Run Notebook 1 (Data Cleaning)

1. Click this link to open Notebook 1 directly in Google Colab:
   👉 [Open Notebook 1 in Colab](https://colab.research.google.com/github/omariosc/prescription-refill-risk/blob/main/notebooks/data_cleaning_clean.ipynb)

2. In Colab, click **Runtime → Run all** (or press `Ctrl+F9` / `Cmd+F9`).

3. When prompted, click **Connect to Google Drive** and allow access. This lets the notebook read your uploaded files and save the output.

4. Wait for all cells to finish — this takes **around 10–15 minutes** (the dataset is large). You can monitor progress by watching the cells run top to bottom.

5. When complete, the notebook saves a processed file called `full_df_with_msr.parquet` directly to your Google Drive at `pharma2u/datasets/`. You do not need to download or move anything — Notebooks 2 and 3 will read it from there automatically.

---

### Step 4 — Run Notebook 2 (Exploratory Analysis)

1. Click to open in Colab:
   👉 [Open Notebook 2 in Colab](https://colab.research.google.com/github/omariosc/prescription-refill-risk/blob/main/notebooks/eda_with_late_refillers.ipynb)

2. Click **Runtime → Run all**.

3. Allow Google Drive access when prompted.

4. This notebook produces charts and statistics exploring who refills late, which drugs are involved, and which patient characteristics are associated with late refills. It takes around **3–5 minutes** to run.

---

### Step 5 — Run Notebook 3 (Predictive Model)

1. Click to open in Colab:
   👉 [Open Notebook 3 in Colab](https://colab.research.google.com/github/omariosc/prescription-refill-risk/blob/main/notebooks/challenge_a_model.ipynb)

2. Click **Runtime → Run all**.

3. Allow Google Drive access when prompted.

4. This notebook trains the LightGBM model, evaluates its accuracy, and produces explanations (SHAP charts) showing which factors drive each risk score. It takes around **3–5 minutes** to run.

5. Results are saved to an `outputs/` folder inside your Google Drive.

---

## Part 2 — Running the demo web app locally

The demo is already live at [refill-risk-demo.omariosc101.workers.dev](https://refill-risk-demo.omariosc101.workers.dev) — you do not need to run it locally unless you want to make changes.

If you do want to run it locally, you need **Node.js** (a JavaScript runtime that powers the web server). If you don't have it, [download it from nodejs.org](https://nodejs.org/) — use the LTS version.

### Run with live reload (recommended for development)

Open a terminal, navigate to the repo, then run:

```bash
cd demo
npm install
cd frontend && npm install && cd ..
npm run dev:local
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

- Edits to the frontend (components, styles) appear instantly without restarting.
- Edits to the backend (API logic) restart automatically.

### Run the pre-built app (simpler, no live reload)

```bash
cd demo
npm install
npm run dev
```

Then open [http://localhost:8787](http://localhost:8787).

### Test login credentials

Use these to sign in on the demo:

- **Email:** `test@pharmacy2u.co.uk`
- **Authenticator code:** `123456`

### Setting up the database (only needed if auth stops working)

The demo uses a small local database for user accounts. If you need to reset it:

```bash
cd demo
npm run db:migrate    # creates the tables
npm run db:seed       # adds the test user
```

> **Note:** `seed.sql` is not included in the repo because it contains credentials. You can create your own — see `demo/schema.sql` for the expected format.

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
