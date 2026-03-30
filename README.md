# Prescription Refill Risk

**Challenge A — Late Refill Risk Prediction**
Data & AI Hackathon, University of Leeds, 30–31 March 2026
Sponsored by [Pharmacy2U](https://www.pharmacy2u.co.uk/)

## Overview

Predict which patient-drug pairs are likely to refill late next time and produce a usable risk score, using only prescription order event data (CMS DE-SynPUF Part D).

A "late refill" is defined as the next fill occurring after the expected run-out date plus a grace window (e.g., +7 or +14 days), where run-out = `SRVC_DT + DAYS_SUPLY_NUM`.

## Dataset

CMS DE-SynPUF Prescription Drug Events (PDE), Sample 1, 2008–2010.
Fully synthetic Part D-style data — **not real patient data**.

> Data files are excluded from this repo. See [Data Setup](#data-setup) below.

## Project Structure

```
.
├── data/               # Raw and processed data (gitignored)
├── notebooks/          # Exploratory and modelling notebooks
├── src/                # Reusable Python modules
├── outputs/            # Figures, metrics, results
├── resources/          # PDFs, codebooks (gitignored)
└── README.md
```

## Data Setup

1. Download the PDE zip from CMS:
   ```
   curl -L -O https://downloads.cms.gov/files/DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.zip
   ```
2. Unzip into `data/raw/`:
   ```
   unzip DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.zip -d data/raw/
   ```
3. Optionally download the 2010 Beneficiary Summary for demographic features.

## Key Columns

| Column | Meaning |
|--------|---------|
| `DESYNPUF_ID` | Pseudonymised patient identifier |
| `SRVC_DT` | Prescription fill/service date |
| `PROD_SRVC_ID` | NDC-11 drug product code |
| `DAYS_SUPLY_NUM` | Days of supply (expected duration) |
| `QTY_DSPNSD_NUM` | Quantity dispensed |
| `PTNT_PAY_AMT` | Patient pay amount |
| `TOT_RX_CST_AMT` | Total drug cost |

## Approach

1. **Label construction** — binary late/on-time per (patient, drug, fill) using time-based labelling
2. **Feature engineering** — refill gap stats, cadence stability, stockpiling signals, cost patterns, polypharmacy proxies
3. **Modelling** — train/val split on time axis (no leakage); handle censoring on last fill
4. **Evaluation** — PR-AUC + calibration check
5. **Demo** — patient timeline for 1–2 drugs + risk score + top feature drivers

## Dependencies

```
pip install -r requirements.txt
```

## Running the Pipeline

```
jupyter notebook notebooks/01_eda.ipynb
```

## Caveats

- Data is fully synthetic and does not represent real patients.
- Outputs are for modelling/product-thinking purposes only.
- **Not clinical advice.**

## Team

- Omar Al-Obaidi
- [Teammate 2]
- [Teammate 3]
