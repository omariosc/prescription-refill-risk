"""NDC-to-drug-name enrichment via RxNorm API.

Maps NDC codes to human-readable drug names and therapeutic classes
for interpretability in demos and explanations.

Uses:
- RxNorm REST API (NDC → RxCUI → drug name)
- RxClass REST API (RxCUI → therapeutic class)

Results are cached to data/processed/ndc_cache.json to avoid repeated API calls.
"""

import json
import time
from pathlib import Path

import pandas as pd
import requests

from src.utils import DATA_PROCESSED

CACHE_PATH = DATA_PROCESSED / "ndc_cache.json"
RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"

# Rate limit: max 20 requests per second (RxNorm is generous but be polite)
_RATE_LIMIT_DELAY = 0.05


def _load_cache() -> dict:
    """Load the NDC lookup cache from disk."""
    if CACHE_PATH.exists():
        with open(CACHE_PATH) as f:
            return json.load(f)
    return {"ndc11": {}, "ndc5": {}, "rxcui_names": {}, "rxcui_classes": {}}


def _save_cache(cache: dict) -> None:
    """Save the NDC lookup cache to disk."""
    with open(CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _ndc_to_rxcui(ndc11: str) -> str | None:
    """Look up RxCUI for an NDC-11 code. Returns None if not found."""
    try:
        resp = requests.get(
            f"{RXNORM_BASE}/rxcui.json",
            params={"idtype": "NDC", "id": ndc11},
            timeout=10,
        )
        data = resp.json()
        ids = data.get("idGroup", {}).get("rxnormId", [])
        return ids[0] if ids else None
    except Exception:
        return None


def _rxcui_to_name(rxcui: str) -> str | None:
    """Look up drug name from RxCUI."""
    try:
        resp = requests.get(
            f"{RXNORM_BASE}/rxcui/{rxcui}/properties.json",
            timeout=10,
        )
        data = resp.json()
        return data.get("properties", {}).get("name")
    except Exception:
        return None


def _rxcui_to_class(rxcui: str) -> str | None:
    """Look up primary therapeutic class from RxCUI."""
    try:
        resp = requests.get(
            f"{RXNORM_BASE}/rxclass/class/byRxcui.json",
            params={"rxcui": rxcui},
            timeout=10,
        )
        data = resp.json()
        drug_infos = (
            data.get("rxclassDrugInfoList", {}).get("rxclassDrugInfo", [])
        )
        # Prefer ATC or VA class types
        for info in drug_infos:
            concept = info.get("rxclassMinConceptItem", {})
            if concept.get("classType") in ("ATC1-4", "VA"):
                return concept.get("className")
        # Fall back to first available class
        if drug_infos:
            return drug_infos[0].get("rxclassMinConceptItem", {}).get("className")
        return None
    except Exception:
        return None


def lookup_ndc11(ndc11: str, cache: dict | None = None) -> dict:
    """Look up a single NDC-11 code. Returns dict with name, class, rxcui."""
    if cache is None:
        cache = _load_cache()

    # Check cache
    if ndc11 in cache["ndc11"]:
        return cache["ndc11"][ndc11]

    result = {"ndc11": ndc11, "rxcui": None, "name": None, "drug_class": None}

    # NDC → RxCUI
    rxcui = _ndc_to_rxcui(ndc11)
    time.sleep(_RATE_LIMIT_DELAY)

    if rxcui:
        result["rxcui"] = rxcui

        # RxCUI → Name
        if rxcui in cache["rxcui_names"]:
            result["name"] = cache["rxcui_names"][rxcui]
        else:
            name = _rxcui_to_name(rxcui)
            time.sleep(_RATE_LIMIT_DELAY)
            result["name"] = name
            cache["rxcui_names"][rxcui] = name

        # RxCUI → Class
        if rxcui in cache["rxcui_classes"]:
            result["drug_class"] = cache["rxcui_classes"][rxcui]
        else:
            drug_class = _rxcui_to_class(rxcui)
            time.sleep(_RATE_LIMIT_DELAY)
            result["drug_class"] = drug_class
            cache["rxcui_classes"][rxcui] = drug_class

    cache["ndc11"][ndc11] = result
    return result


def lookup_ndc5_group(
    ndc5: str,
    pde_df: pd.DataFrame,
    cache: dict | None = None,
    max_tries: int = 20,
) -> dict:
    """Look up a drug name for an NDC-5 group by trying NDC-11 samples.

    Tries up to max_tries different NDC-11 codes from this group until
    one maps successfully in RxNorm.

    Returns dict with ndc5, name, drug_class (or None if all fail).
    """
    if cache is None:
        cache = _load_cache()

    # Check cache
    if ndc5 in cache["ndc5"]:
        return cache["ndc5"][ndc5]

    # Get sample NDC-11 codes from this group (most frequent first)
    group_ndcs = (
        pde_df[pde_df["PROD_SRVC_ID"].str[:5] == ndc5]["PROD_SRVC_ID"]
        .value_counts()
        .head(max_tries)
        .index.tolist()
    )

    result = {"ndc5": ndc5, "name": None, "drug_class": None, "matched_ndc11": None}

    for ndc11 in group_ndcs:
        info = lookup_ndc11(ndc11, cache)
        if info["name"]:
            result["name"] = info["name"]
            result["drug_class"] = info["drug_class"]
            result["matched_ndc11"] = ndc11
            break

    cache["ndc5"][ndc5] = result
    _save_cache(cache)
    return result


def build_ndc5_lookup_table(
    pde_df: pd.DataFrame,
    top_n: int = 100,
    max_tries_per_group: int = 10,
) -> pd.DataFrame:
    """Build a lookup table for the top N NDC-5 groups by fill count.

    Queries RxNorm for each group and returns a DataFrame with:
    ndc5, n_fills, name, drug_class

    Progress is printed and results are cached.
    """
    print(f"Building NDC-5 lookup table (top {top_n} groups)...")
    cache = _load_cache()

    # Get top NDC5 groups
    ndc5_counts = pde_df["PROD_SRVC_ID"].str[:5].value_counts().head(top_n)

    rows = []
    resolved = 0
    for i, (ndc5, count) in enumerate(ndc5_counts.items()):
        result = lookup_ndc5_group(ndc5, pde_df, cache, max_tries=max_tries_per_group)
        rows.append({
            "ndc5": ndc5,
            "n_fills": count,
            "name": result["name"],
            "drug_class": result["drug_class"],
        })
        if result["name"]:
            resolved += 1
        if (i + 1) % 10 == 0:
            print(f"  {i+1}/{top_n} groups queried, {resolved} resolved...")
            _save_cache(cache)

    _save_cache(cache)
    df = pd.DataFrame(rows)
    pct = resolved / len(rows) * 100
    print(f"  Done: {resolved}/{len(rows)} groups resolved ({pct:.0f}%)")
    return df


def get_drug_name(ndc5: str, cache: dict | None = None) -> str:
    """Get a human-readable drug name for an NDC-5 group.

    Returns the cached name or 'NDC5-XXXXX' if not resolved.
    """
    if cache is None:
        cache = _load_cache()
    info = cache.get("ndc5", {}).get(ndc5, {})
    name = info.get("name")
    if name:
        # Shorten verbose RxNorm names (e.g., strip dosage details)
        # Try to extract the brand name in brackets [BrandName]
        if "[" in name and "]" in name:
            brand = name[name.index("[") + 1:name.index("]")]
            return brand
        # Otherwise return first ~50 chars
        return name[:50]
    return f"NDC5-{ndc5}"
