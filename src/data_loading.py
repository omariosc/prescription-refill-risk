"""Load and clean all raw CSV data sources."""

from typing import Optional

import pandas as pd

from src.utils import (
    CHRONIC_COLS,
    CHRONIC_NAMES,
    DATA_RAW,
    parse_cms_date,
)


# ---------------------------------------------------------------------------
# PDE (Prescription Drug Events)
# ---------------------------------------------------------------------------

def load_pde() -> pd.DataFrame:
    """Load and clean the prescription drug events file.

    Cleaning steps:
    - Parse SRVC_DT to datetime
    - Create NDC5 column (first 5 digits of PROD_SRVC_ID)
    - Drop rows with PROD_SRVC_ID == "OTHER" (23 rows)
    - Drop rows with DAYS_SUPLY_NUM == 0 (117K rows, breaks label logic)
    - Drop triple-zero rows (days=0, qty=0, cost=0)
    """
    print("Loading PDE...")
    df = pd.read_csv(
        DATA_RAW / "DE1_0_2008_to_2010_Prescription_Drug_Events_Sample_1.csv",
        dtype={"DESYNPUF_ID": str, "PROD_SRVC_ID": str},
    )
    n_raw = len(df)

    # Parse dates
    df["SRVC_DT"] = parse_cms_date(df["SRVC_DT"])

    # NDC-5 grouping (first 5 digits)
    df["NDC5"] = df["PROD_SRVC_ID"].str[:5]

    # --- Cleaning ---
    # Drop "OTHER" product codes
    mask_other = df["PROD_SRVC_ID"] == "OTHER"

    # Drop zero days supply
    mask_zero_days = df["DAYS_SUPLY_NUM"] == 0

    # Drop triple-zero rows
    mask_triple_zero = (
        (df["DAYS_SUPLY_NUM"] == 0)
        & (df["QTY_DSPNSD_NUM"] == 0)
        & (df["TOT_RX_CST_AMT"] == 0)
    )

    # Combined mask: drop if ANY of these conditions
    drop_mask = mask_other | mask_zero_days
    df = df[~drop_mask].copy()

    n_clean = len(df)
    print(f"  PDE: {n_raw:,} → {n_clean:,} rows ({n_raw - n_clean:,} dropped)")
    print(f"    Date range: {df['SRVC_DT'].min().date()} to {df['SRVC_DT'].max().date()}")
    print(f"    Unique patients: {df['DESYNPUF_ID'].nunique():,}")
    print(f"    Unique NDC5 groups: {df['NDC5'].nunique():,}")

    return df


# ---------------------------------------------------------------------------
# Beneficiary Summary
# ---------------------------------------------------------------------------

def _load_single_bene(year: int) -> pd.DataFrame:
    """Load a single year's beneficiary summary file."""
    path = DATA_RAW / f"DE1_0_{year}_Beneficiary_Summary_File_Sample_1.csv"
    df = pd.read_csv(path, dtype={"DESYNPUF_ID": str, "BENE_ESRD_IND": str})

    # Parse dates
    df["BENE_BIRTH_DT"] = parse_cms_date(df["BENE_BIRTH_DT"])
    df["BENE_DEATH_DT"] = parse_cms_date(df["BENE_DEATH_DT"])

    # Remap chronic conditions: 1=Yes, 2=No → 1, 0
    for col in CHRONIC_COLS:
        df[col] = (df[col] == 1).astype(int)

    # Remap ESRD: "Y" → 1, "0" → 0
    df["BENE_ESRD_IND"] = (df["BENE_ESRD_IND"] == "Y").astype(int)

    # Rename chronic cols to friendly names
    df = df.rename(columns=CHRONIC_NAMES)

    # Add year column
    df["bene_year"] = year

    return df


def load_beneficiary() -> pd.DataFrame:
    """Load and clean all 3 beneficiary summary files, stacked with year column.

    Also creates 'ever had' chronic condition flags across all years.
    """
    print("Loading beneficiary summaries...")
    frames = [_load_single_bene(y) for y in [2008, 2009, 2010]]
    df = pd.concat(frames, ignore_index=True)

    # Compute age (as of Jan 1 of bene_year)
    df["age"] = df["bene_year"] - df["BENE_BIRTH_DT"].dt.year

    print(f"  Beneficiary: {len(df):,} rows across 3 years")
    print(f"  Unique patients: {df['DESYNPUF_ID'].nunique():,}")
    print(f"  Deaths recorded: {df['BENE_DEATH_DT'].notna().sum():,}")

    return df


def build_ever_had_chronic(bene_df: pd.DataFrame) -> pd.DataFrame:
    """Build 'ever had' chronic condition flags (max across all years per patient).

    Returns a DataFrame indexed by DESYNPUF_ID with chronic flags + demographics.
    """
    chronic_friendly = list(CHRONIC_NAMES.values())
    ever_had = (
        bene_df.groupby("DESYNPUF_ID")[chronic_friendly]
        .max()
        .reset_index()
    )
    # Add n_chronic_conditions
    ever_had["n_chronic_conditions"] = ever_had[chronic_friendly].sum(axis=1)
    return ever_had


def get_death_dates(bene_df: pd.DataFrame) -> pd.DataFrame:
    """Extract earliest death date per patient (should be unique, but be safe)."""
    deaths = (
        bene_df[bene_df["BENE_DEATH_DT"].notna()]
        .groupby("DESYNPUF_ID")["BENE_DEATH_DT"]
        .min()
        .reset_index()
    )
    return deaths


# ---------------------------------------------------------------------------
# Inpatient Claims
# ---------------------------------------------------------------------------

def load_inpatient() -> pd.DataFrame:
    """Load and clean inpatient claims. Keep columns relevant to adherence features."""
    print("Loading inpatient claims...")
    cols_keep = [
        "DESYNPUF_ID", "CLM_ID", "CLM_FROM_DT", "CLM_THRU_DT",
        "CLM_ADMSN_DT", "NCH_BENE_DSCHRG_DT", "CLM_UTLZTN_DAY_CNT",
        "CLM_PMT_AMT", "ADMTNG_ICD9_DGNS_CD",
        "ICD9_DGNS_CD_1", "ICD9_DGNS_CD_2", "ICD9_DGNS_CD_3", "ICD9_DGNS_CD_4",
    ]
    df = pd.read_csv(
        DATA_RAW / "DE1_0_2008_to_2010_Inpatient_Claims_Sample_1.csv",
        usecols=cols_keep,
        dtype={"DESYNPUF_ID": str},
    )
    for col in ["CLM_FROM_DT", "CLM_THRU_DT", "CLM_ADMSN_DT", "NCH_BENE_DSCHRG_DT"]:
        df[col] = parse_cms_date(df[col])

    # Compute length of stay
    df["length_of_stay"] = (df["NCH_BENE_DSCHRG_DT"] - df["CLM_ADMSN_DT"]).dt.days

    print(f"  Inpatient: {len(df):,} claims, {df['DESYNPUF_ID'].nunique():,} patients")
    return df


# ---------------------------------------------------------------------------
# Outpatient Claims
# ---------------------------------------------------------------------------

def load_outpatient() -> pd.DataFrame:
    """Load and clean outpatient claims. Keep columns relevant to adherence features."""
    print("Loading outpatient claims...")
    cols_keep = [
        "DESYNPUF_ID", "CLM_ID", "CLM_FROM_DT", "CLM_THRU_DT",
        "CLM_PMT_AMT", "ICD9_DGNS_CD_1", "ICD9_DGNS_CD_2",
        "NCH_BENE_PTB_COINSRNC_AMT",
    ]
    df = pd.read_csv(
        DATA_RAW / "DE1_0_2008_to_2010_Outpatient_Claims_Sample_1.csv",
        usecols=cols_keep,
        dtype={"DESYNPUF_ID": str},
    )
    for col in ["CLM_FROM_DT", "CLM_THRU_DT"]:
        df[col] = parse_cms_date(df[col])

    # Flag V58 codes (long-term drug use)
    df["has_v58"] = (
        df["ICD9_DGNS_CD_1"].astype(str).str.startswith("V58")
        | df["ICD9_DGNS_CD_2"].astype(str).str.startswith("V58")
    ).astype(int)

    print(f"  Outpatient: {len(df):,} claims, {df['DESYNPUF_ID'].nunique():,} patients")
    return df


# ---------------------------------------------------------------------------
# Carrier Claims (chunked)
# ---------------------------------------------------------------------------

def load_carrier_aggregated(chunksize: int = 200_000) -> pd.DataFrame:
    """Load carrier claims in chunks and aggregate to patient-month level.

    Returns a DataFrame with columns:
    - DESYNPUF_ID, year_month
    - n_claims, n_unique_diag, n_unique_hcpcs, total_payment
    - has_office_visit (HCPCS 99211-99215)
    """
    print("Loading carrier claims (chunked)...")
    files = [
        DATA_RAW / "DE1_0_2008_to_2010_Carrier_Claims_Sample_1A.csv",
        DATA_RAW / "DE1_0_2008_to_2010_Carrier_Claims_Sample_1B.csv",
    ]
    cols_keep = [
        "DESYNPUF_ID", "CLM_FROM_DT", "ICD9_DGNS_CD_1",
        "HCPCS_CD_1", "LINE_NCH_PMT_AMT_1",
    ]
    office_visit_codes = {"99211", "99212", "99213", "99214", "99215"}

    monthly_aggs = []
    total_rows = 0

    for fpath in files:
        reader = pd.read_csv(
            fpath, usecols=cols_keep, dtype={"DESYNPUF_ID": str},
            chunksize=chunksize,
        )
        for chunk in reader:
            total_rows += len(chunk)
            chunk["CLM_FROM_DT"] = parse_cms_date(chunk["CLM_FROM_DT"])
            chunk["year_month"] = chunk["CLM_FROM_DT"].dt.to_period("M")
            chunk["is_office_visit"] = (
                chunk["HCPCS_CD_1"].astype(str).isin(office_visit_codes)
            ).astype(int)

            agg = (
                chunk.groupby(["DESYNPUF_ID", "year_month"])
                .agg(
                    n_claims=("CLM_FROM_DT", "count"),
                    n_unique_diag=("ICD9_DGNS_CD_1", "nunique"),
                    n_unique_hcpcs=("HCPCS_CD_1", "nunique"),
                    total_payment=("LINE_NCH_PMT_AMT_1", "sum"),
                    has_office_visit=("is_office_visit", "max"),
                )
                .reset_index()
            )
            monthly_aggs.append(agg)

    # Combine all chunk aggregations and re-aggregate (chunks may split same patient-month)
    df = pd.concat(monthly_aggs, ignore_index=True)
    df = (
        df.groupby(["DESYNPUF_ID", "year_month"])
        .agg(
            n_claims=("n_claims", "sum"),
            n_unique_diag=("n_unique_diag", "max"),  # approximation for across-chunk
            n_unique_hcpcs=("n_unique_hcpcs", "max"),
            total_payment=("total_payment", "sum"),
            has_office_visit=("has_office_visit", "max"),
        )
        .reset_index()
    )

    print(f"  Carrier: {total_rows:,} raw rows → {len(df):,} patient-month records")
    print(f"  Unique patients: {df['DESYNPUF_ID'].nunique():,}")
    return df
