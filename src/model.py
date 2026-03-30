"""Train, evaluate, and calibrate the late refill risk model."""

import json

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    average_precision_score,
    precision_recall_curve,
    roc_auc_score,
)

from src.utils import OUTPUTS


def train_model(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    feature_cols: list[str],
    params: dict | None = None,
) -> lgb.Booster:
    """Train a LightGBM model on the training set.

    Args:
        train_df: Training data with features and 'late' column
        val_df: Validation data for early stopping
        feature_cols: List of feature column names
        params: LightGBM parameters (defaults provided)

    Returns:
        Trained LightGBM Booster
    """
    print("Training LightGBM model...")

    if params is None:
        params = {
            "objective": "binary",
            "metric": "average_precision",
            "is_unbalance": True,
            "learning_rate": 0.05,
            "num_leaves": 63,
            "max_depth": 7,
            "min_child_samples": 100,
            "feature_fraction": 0.8,
            "bagging_fraction": 0.8,
            "bagging_freq": 5,
            "verbose": -1,
        }

    train_data = lgb.Dataset(
        train_df[feature_cols], train_df["late"],
        free_raw_data=False,
    )
    val_data = lgb.Dataset(
        val_df[feature_cols], val_df["late"],
        reference=train_data,
        free_raw_data=False,
    )

    model = lgb.train(
        params,
        train_data,
        num_boost_round=1000,
        valid_sets=[val_data],
        callbacks=[
            lgb.early_stopping(stopping_rounds=50),
            lgb.log_evaluation(period=100),
        ],
    )

    print(f"  Best iteration: {model.best_iteration}")
    return model


def evaluate_model(
    model: lgb.Booster,
    df: pd.DataFrame,
    feature_cols: list[str],
    split_name: str = "test",
) -> dict:
    """Evaluate model on a dataset and return metrics.

    Returns dict with: pr_auc, roc_auc, precision_at_thresholds, recall_at_thresholds
    """
    print(f"Evaluating on {split_name}...")
    y_true = df["late"].values
    y_prob = model.predict(df[feature_cols])

    pr_auc = average_precision_score(y_true, y_prob)
    roc_auc = roc_auc_score(y_true, y_prob)

    # Precision-recall at various thresholds
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)

    # Find threshold for specific recall targets
    recall_targets = [0.5, 0.7, 0.8, 0.9]
    threshold_results = {}
    for target in recall_targets:
        idx = np.argmin(np.abs(recall - target))
        threshold_results[f"precision_at_recall_{target}"] = float(precision[idx])
        threshold_results[f"threshold_at_recall_{target}"] = float(thresholds[min(idx, len(thresholds)-1)])

    metrics = {
        "split": split_name,
        "n_samples": len(df),
        "pct_late": float(y_true.mean() * 100),
        "pr_auc": float(pr_auc),
        "roc_auc": float(roc_auc),
        **threshold_results,
    }

    print(f"  PR-AUC: {pr_auc:.4f}")
    print(f"  ROC-AUC: {roc_auc:.4f}")
    print(f"  Baseline (% late): {y_true.mean()*100:.1f}%")

    return metrics


def save_metrics(metrics: dict | list[dict], path: str | None = None) -> None:
    """Save metrics to JSON file."""
    if path is None:
        path = OUTPUTS / "metrics.json"
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"  Metrics saved to {path}")


def get_feature_importance(model: lgb.Booster, feature_cols: list[str]) -> pd.DataFrame:
    """Get feature importance (gain-based) as a sorted DataFrame."""
    importance = model.feature_importance(importance_type="gain")
    fi = pd.DataFrame({
        "feature": feature_cols,
        "importance": importance,
    }).sort_values("importance", ascending=False)
    fi["importance_pct"] = fi["importance"] / fi["importance"].sum() * 100
    return fi
