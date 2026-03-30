"""Uncertainty quantification via MAPIE conformal prediction."""

import lightgbm as lgb
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin

from src.utils import OUTPUTS

# Risk tier boundaries (see docs/CALIBRATION.md)
TIER_LOW = 0.30
TIER_HIGH = 0.55


class LGBMRegressorWrapper(BaseEstimator, RegressorMixin):
    """Wrap a fitted LightGBM Booster as a sklearn-compatible regressor.

    MAPIE requires sklearn's fit/predict interface. Since our model
    is already trained, fit() is a no-op.
    """

    def __init__(self, booster: lgb.Booster, feature_cols: list[str]):
        self.booster = booster
        self.feature_cols = feature_cols

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "LGBMRegressorWrapper":
        # Already fitted — no-op
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.booster.predict(X[self.feature_cols])


def compute_prediction_intervals(
    model: lgb.Booster,
    feature_cols: list[str],
    cal_df: pd.DataFrame,
    test_df: pd.DataFrame,
    confidence_level: float = 0.90,
) -> tuple[np.ndarray, np.ndarray]:
    """Compute conformal prediction intervals using MAPIE.

    Uses the validation set as the calibration set for conformal prediction.

    Args:
        model: Fitted LightGBM Booster
        feature_cols: Feature column names
        cal_df: Calibration set (typically the validation split)
        test_df: Test set to predict intervals on
        confidence_level: Confidence level (default 90%)

    Returns:
        y_pred: Point predictions (n_samples,)
        y_pis: Prediction intervals (n_samples, 2) — [lower, upper]
    """
    from mapie.regression import CrossConformalRegressor

    print(f"Computing {confidence_level:.0%} prediction intervals (MAPIE)...")

    wrapper = LGBMRegressorWrapper(model, feature_cols)

    mapie = CrossConformalRegressor(
        wrapper,
        method="plus",
        cv=5,
        confidence_level=confidence_level,
        random_state=42,
    )

    # Fit + conformalize on the calibration set
    mapie.fit_conformalize(cal_df[feature_cols], cal_df["late"].values.astype(float))

    # Predict intervals on test set
    y_pred, y_pis = mapie.predict_interval(test_df[feature_cols])

    # Clip intervals to [0, 1] (probabilities can't exceed these bounds)
    y_pis = np.clip(y_pis, 0, 1)

    # Summary stats
    widths = y_pis[:, 1] - y_pis[:, 0]
    print(f"  Interval widths: mean={widths.mean():.3f}, median={np.median(widths):.3f}, "
          f"std={widths.std():.3f}")
    print(f"  Coverage: {((cal_df['late'].values >= y_pis[:len(cal_df), 0]) & (cal_df['late'].values <= y_pis[:len(cal_df), 1])).mean():.1%}" if len(y_pis) >= len(cal_df) else "  (coverage computed on test set)")

    return y_pred, y_pis


def classify_risk_tiers(
    y_pred: np.ndarray,
    y_pis: np.ndarray | None = None,
) -> pd.DataFrame:
    """Classify predictions into LOW/MEDIUM/HIGH risk tiers.

    If prediction intervals are provided, also flags uncertain predictions
    (where the interval spans multiple tiers).

    Args:
        y_pred: Point predictions
        y_pis: Optional prediction intervals (n_samples, 2)

    Returns:
        DataFrame with columns: score, tier, lower, upper, width, uncertain
    """
    result = pd.DataFrame({"score": y_pred})

    # Assign tiers
    result["tier"] = pd.cut(
        y_pred,
        bins=[-np.inf, TIER_LOW, TIER_HIGH, np.inf],
        labels=["LOW", "MEDIUM", "HIGH"],
    )

    if y_pis is not None:
        result["lower"] = y_pis[:, 0]
        result["upper"] = y_pis[:, 1]
        result["width"] = result["upper"] - result["lower"]

        # Flag uncertain: interval spans multiple tiers
        lower_tier = pd.cut(
            y_pis[:, 0], bins=[-np.inf, TIER_LOW, TIER_HIGH, np.inf],
            labels=["LOW", "MEDIUM", "HIGH"],
        )
        upper_tier = pd.cut(
            y_pis[:, 1], bins=[-np.inf, TIER_LOW, TIER_HIGH, np.inf],
            labels=["LOW", "MEDIUM", "HIGH"],
        )
        result["uncertain"] = lower_tier != upper_tier

    return result


def plot_risk_distribution(
    risk_df: pd.DataFrame,
    y_true: np.ndarray | None = None,
) -> None:
    """Plot risk score distribution with tier boundaries and actual outcomes."""
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # Left: score distribution by tier
    ax = axes[0]
    for tier, color in [("LOW", "#2ecc71"), ("MEDIUM", "#f39c12"), ("HIGH", "#e74c3c")]:
        mask = risk_df["tier"] == tier
        ax.hist(risk_df.loc[mask, "score"], bins=30, alpha=0.7, color=color,
                label=f"{tier} (n={mask.sum():,})")
    ax.axvline(x=TIER_LOW, color="gray", linestyle="--", alpha=0.7)
    ax.axvline(x=TIER_HIGH, color="gray", linestyle="--", alpha=0.7)
    ax.set_xlabel("Risk Score")
    ax.set_ylabel("Count")
    ax.set_title("Risk Score Distribution by Tier")
    ax.legend()

    # Right: actual late rate by decile with intervals
    ax = axes[1]
    if y_true is not None:
        df_temp = risk_df.copy()
        df_temp["actual"] = y_true
        df_temp["decile"] = pd.qcut(df_temp["score"], 10, labels=False, duplicates="drop")
        decile_stats = df_temp.groupby("decile").agg(
            mean_score=("score", "mean"),
            actual_rate=("actual", "mean"),
            n=("actual", "count"),
        )
        ax.bar(decile_stats["mean_score"], decile_stats["actual_rate"],
               width=0.06, alpha=0.7, color="steelblue")
        ax.plot([0, 1], [0, 1], "k--", alpha=0.3, label="Perfect calibration")
        ax.axvline(x=TIER_LOW, color="gray", linestyle="--", alpha=0.5)
        ax.axvline(x=TIER_HIGH, color="gray", linestyle="--", alpha=0.5)
        ax.set_xlabel("Mean Predicted Score (by decile)")
        ax.set_ylabel("Actual Late Rate")
        ax.set_title("Calibration by Decile")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)

    plt.tight_layout()
    path = OUTPUTS / "risk_distribution.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Risk distribution plot saved to {path}")


def plot_uncertainty_analysis(risk_df: pd.DataFrame) -> None:
    """Plot prediction interval widths and uncertainty analysis."""
    if "width" not in risk_df.columns:
        print("  No prediction intervals available — skipping uncertainty plot")
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # Left: interval width distribution
    ax = axes[0]
    for tier, color in [("LOW", "#2ecc71"), ("MEDIUM", "#f39c12"), ("HIGH", "#e74c3c")]:
        mask = risk_df["tier"] == tier
        ax.hist(risk_df.loc[mask, "width"], bins=30, alpha=0.7, color=color,
                label=f"{tier}")
    ax.set_xlabel("Prediction Interval Width")
    ax.set_ylabel("Count")
    ax.set_title("Uncertainty by Risk Tier")
    ax.legend()

    # Right: score vs width scatter (sampled)
    ax = axes[1]
    sample = risk_df.sample(min(5000, len(risk_df)), random_state=42)
    uncertain_mask = sample["uncertain"] if "uncertain" in sample.columns else pd.Series([False]*len(sample))
    ax.scatter(sample.loc[~uncertain_mask, "score"], sample.loc[~uncertain_mask, "width"],
               alpha=0.3, s=10, c="steelblue", label="Confident")
    ax.scatter(sample.loc[uncertain_mask, "score"], sample.loc[uncertain_mask, "width"],
               alpha=0.5, s=15, c="red", label="Uncertain (spans tiers)")
    ax.axvline(x=TIER_LOW, color="gray", linestyle="--", alpha=0.5)
    ax.axvline(x=TIER_HIGH, color="gray", linestyle="--", alpha=0.5)
    ax.set_xlabel("Risk Score")
    ax.set_ylabel("Interval Width")
    ax.set_title("Score vs Uncertainty")
    ax.legend()

    plt.tight_layout()
    path = OUTPUTS / "uncertainty_analysis.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Uncertainty analysis plot saved to {path}")
