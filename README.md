<p align="center">
  <img src="resources/brand-assets/p2u_logo.svg" alt="Pharmacy2U" height="48" />
  <h1 align="center">Prescription Refill Risk</h1>
  <p align="center">Predicting late prescription refills using machine learning</p>
</p>

<p align="center">
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.14-blue?logo=python&logoColor=white" alt="Python 3.14"></a>
  <a href="https://github.com/omariosc/prescription-refill-risk/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen?logo=github" alt="Build Passing"></a>
  <a href="https://github.com/omariosc/prescription-refill-risk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License MIT"></a>
  <a href="https://lightgbm.readthedocs.io/"><img src="https://img.shields.io/badge/model-LightGBM-orange?logo=microsoft&logoColor=white" alt="LightGBM"></a>
  <a href="https://shap.readthedocs.io/"><img src="https://img.shields.io/badge/explainability-SHAP-purple" alt="SHAP"></a>
  <a href="https://scikit-learn.org/"><img src="https://img.shields.io/badge/sklearn-1.8-F7931E?logo=scikit-learn&logoColor=white" alt="scikit-learn"></a>
  <a href="https://pandas.pydata.org/"><img src="https://img.shields.io/badge/pandas-2.0+-150458?logo=pandas&logoColor=white" alt="Pandas"></a>
  <a href="https://matplotlib.org/"><img src="https://img.shields.io/badge/matplotlib-3.7+-11557C" alt="Matplotlib"></a>
</p>

<p align="center">
  <strong>Challenge A</strong> &mdash; Data & AI Hackathon, University of Leeds, 30&ndash;31 March 2026<br>
  Sponsored by <a href="https://www.pharmacy2u.co.uk/">Pharmacy2U</a>
</p>

---

## Local Setup

### What you need first

- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 20+](https://nodejs.org/)
- [Git](https://git-scm.com/)

---

### 1. Clone the repo

```bash
git clone https://github.com/omariosc/prescription-refill-risk.git
cd prescription-refill-risk
```

---

### 2. ML Pipeline (Python)

**Install dependencies**

```bash
python -m venv .venv
source .venv/bin/activate        # Mac/Linux
# .venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

**Add the data**

Download the [CMS DE-SynPUF](https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files/cms-2008-2010-data-entrepreneurs-synthetic-public-use-file-de-synpuf) sample files and place them in the `data/` folder:

```
data/
  DE1_0_2008_Beneficiary_Summary_File_Sample1.csv
  DE1_0_2008_to_2010_Prescription_Drug_Events_Sample1.csv
  ... (other sample files)
```

**Run the pipeline**

```bash
python scripts/run_pipeline.py
```

This trains the model and saves outputs (SHAP plots, metrics) to `outputs/`.

---

### 3. Demo (local web app)

The demo runs entirely in your browser — no data or Python needed.

```bash
cd demo
npm install
npm run dev
```

Open [http://localhost:8787](http://localhost:8787).

**Want to run the React frontend separately?**

```bash
cd demo/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — make sure the worker is also running (step above) so the API calls work.

---

## Team

| Name | GitHub |
|------|--------|
| Xin Ci Wong | [@X-ksana](https://github.com/X-ksana) |
| Arpita Saggar | [@arpita2512](https://github.com/arpita2512) |
| Omar Choudhry | [@omariosc](https://github.com/omariosc) |
