"""Questionnaire-based refill risk model.

Simulates patient questionnaire responses correlated with adherence outcomes,
trains a decision tree regressor, and provides a risk adjustment function.

Questionnaire is designed for patients 7 days into a new medication. Questions
assess whether the drug is working and whether the patient is likely to continue.

The model outputs a questionnaire_risk_score (0-1) which can be blended with
the main LightGBM refill risk score to produce an adjusted risk.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeRegressor, export_text

from src.utils import OUTPUTS

QUESTIONNAIRE_FIELDS = [
    {
        "id": "side_effects",
        "question": "Have you experienced any side effects from this medication?",
        "type": "scale",
        "labels": ["None at all", "Very mild", "Mild but manageable", "Moderate", "Severe"],
        "weight": 0.20,
    },
    {
        "id": "effectiveness",
        "question": "How well do you feel the medication is working for you?",
        "type": "scale",
        "labels": ["Very effective", "Somewhat effective", "Not sure yet", "Not very effective", "Not effective at all"],
        "weight": 0.20,
    },
    {
        "id": "ease_of_use",
        "question": "How easy is it to take this medication as prescribed?",
        "type": "scale",
        "labels": ["Very easy", "Easy", "Manageable", "Difficult", "Very difficult"],
        "weight": 0.15,
    },
    {
        "id": "daily_routine",
        "question": "How well does this medication fit into your daily routine?",
        "type": "scale",
        "labels": ["Fits perfectly", "Fits well", "Some adjustments needed", "Significant disruption", "Major disruption"],
        "weight": 0.10,
    },
    {
        "id": "missed_doses",
        "question": "In the past 7 days, how many doses have you missed?",
        "type": "scale",
        "labels": ["None (0)", "One (1)", "Two (2)", "Three to four (3-4)", "Five or more (5+)"],
        "weight": 0.15,
    },
    {
        "id": "likelihood_continue",
        "question": "How likely are you to continue taking this medication?",
        "type": "scale",
        "labels": ["Definitely will", "Very likely", "Probably", "Unlikely", "Definitely stopping"],
        "weight": 0.20,
    },
]

# All scale responses are 1-5 where 1 = best outcome, 5 = worst outcome


def simulate_questionnaire_data(
    n_samples: int = 10_000,
    seed: int = 42,
) -> pd.DataFrame:
    """Simulate correlated questionnaire responses for model training.

    Generates responses that are correlated with an underlying adherence
    tendency: patients who will refill on time tend to report better
    experiences (lower scores), while patients who will refill late tend
    to report worse experiences (higher scores).

    Returns DataFrame with questionnaire responses + binary 'late' label.
    """
    rng = np.random.RandomState(seed)

    # Underlying adherence tendency (0 = very adherent, 1 = non-adherent)
    tendency = rng.beta(2, 3, n_samples)  # skewed toward adherent

    rows = []
    for i in range(n_samples):
        t = tendency[i]

        # Generate correlated responses (1-5 scale)
        # Lower tendency → better scores (closer to 1)
        side_effects = np.clip(rng.normal(1 + t * 3.5, 0.8), 1, 5)
        effectiveness = np.clip(rng.normal(1 + t * 3.5, 0.7), 1, 5)
        ease_of_use = np.clip(rng.normal(1 + t * 3.0, 0.9), 1, 5)
        daily_routine = np.clip(rng.normal(1 + t * 3.0, 0.8), 1, 5)
        missed_doses = np.clip(rng.normal(1 + t * 3.5, 1.0), 1, 5)
        likelihood_continue = np.clip(rng.normal(1 + t * 3.5, 0.6), 1, 5)

        # Round to integer scale
        responses = {
            "side_effects": int(round(side_effects)),
            "effectiveness": int(round(effectiveness)),
            "ease_of_use": int(round(ease_of_use)),
            "daily_routine": int(round(daily_routine)),
            "missed_doses": int(round(missed_doses)),
            "likelihood_continue": int(round(likelihood_continue)),
        }

        # Binary late label (probability increases with tendency + noise)
        prob_late = np.clip(t + rng.normal(0, 0.15), 0, 1)
        late = int(rng.random() < prob_late)

        # Add some demographic features that might interact
        age = int(rng.normal(72, 12))
        n_drugs = int(rng.poisson(3) + 1)

        rows.append({**responses, "age": age, "n_drugs": n_drugs, "late": late})

    return pd.DataFrame(rows)


def train_questionnaire_model(
    df: pd.DataFrame | None = None,
) -> tuple[DecisionTreeRegressor, list[str]]:
    """Train a decision tree regressor on questionnaire data.

    Returns (model, feature_names).
    """
    if df is None:
        df = simulate_questionnaire_data()

    feature_cols = [
        "side_effects", "effectiveness", "ease_of_use",
        "daily_routine", "missed_doses", "likelihood_continue",
        "age", "n_drugs",
    ]
    X = df[feature_cols]
    y = df["late"].astype(float)

    model = DecisionTreeRegressor(
        max_depth=5,
        min_samples_leaf=50,
        min_samples_split=100,
        random_state=42,
    )
    model.fit(X, y)

    # Print tree for interpretability
    tree_text = export_text(model, feature_names=feature_cols, max_depth=3)
    print("Decision tree (first 3 levels):")
    print(tree_text)

    # Evaluate
    preds = model.predict(X)
    from sklearn.metrics import mean_absolute_error, r2_score
    print(f"R2: {r2_score(y, preds):.3f}")
    print(f"MAE: {mean_absolute_error(y, preds):.3f}")

    return model, feature_cols


def predict_questionnaire_risk(
    model: DecisionTreeRegressor,
    feature_cols: list[str],
    responses: dict,
) -> dict:
    """Predict refill risk from questionnaire responses.

    Args:
        model: Trained decision tree
        feature_cols: Feature column names
        responses: Dict with keys matching questionnaire field IDs + optional age, n_drugs

    Returns:
        Dict with questionnaire_risk_score, risk_category, interpretation
    """
    # Build feature vector
    features = {}
    for col in feature_cols:
        features[col] = responses.get(col, 3)  # default to middle if missing

    X = pd.DataFrame([features])
    risk_score = float(model.predict(X)[0])
    risk_score = max(0.0, min(1.0, risk_score))

    # Interpretation based on questionnaire responses
    avg_response = np.mean([
        responses.get("side_effects", 3),
        responses.get("effectiveness", 3),
        responses.get("ease_of_use", 3),
        responses.get("daily_routine", 3),
        responses.get("missed_doses", 3),
        responses.get("likelihood_continue", 3),
    ])

    if avg_response <= 1.5:
        interpretation = "Excellent medication experience. Patient reports minimal side effects, strong effectiveness, and high likelihood of continuing. Refill risk is very low."
        severity = "positive"
    elif avg_response <= 2.5:
        interpretation = "Good medication experience with minor concerns. Patient is managing well and likely to continue. Standard monitoring appropriate."
        severity = "positive"
    elif avg_response <= 3.5:
        interpretation = "Mixed medication experience. Some concerns about side effects or effectiveness. Worth monitoring and potentially discussing alternatives."
        severity = "neutral"
    elif avg_response <= 4.0:
        interpretation = "Concerning medication experience. Patient reports significant side effects or doubts about effectiveness. GP review recommended."
        severity = "negative"
    else:
        interpretation = "Poor medication experience. Patient reports severe side effects, low effectiveness, or intent to stop. Urgent GP consultation recommended."
        severity = "critical"

    return {
        "questionnaire_risk_score": round(risk_score, 3),
        "avg_response": round(avg_response, 2),
        "interpretation": interpretation,
        "severity": severity,
    }


def adjust_risk_score(
    original_score: float,
    questionnaire_result: dict,
    blend_weight: float = 0.3,
) -> dict:
    """Blend the original LightGBM risk score with the questionnaire risk score.

    The questionnaire can push the risk UP (bad responses) or DOWN (good responses).
    blend_weight controls how much influence the questionnaire has (0.3 = 30%).

    Returns dict with adjusted_score, adjustment_delta, adjusted_category.
    """
    q_score = questionnaire_result["questionnaire_risk_score"]
    adjusted = original_score * (1 - blend_weight) + q_score * blend_weight
    adjusted = max(0.0, min(1.0, adjusted))
    delta = adjusted - original_score

    from src.utils import TIER_LOW, TIER_HIGH
    category = "HIGH" if adjusted >= TIER_HIGH else "MODERATE" if adjusted >= TIER_LOW else "LOW"

    return {
        "original_score": round(original_score, 3),
        "questionnaire_score": round(q_score, 3),
        "adjusted_score": round(adjusted, 3),
        "adjustment_delta": round(delta, 3),
        "adjusted_category": category,
        "blend_weight": blend_weight,
        "questionnaire_severity": questionnaire_result["severity"],
        "questionnaire_interpretation": questionnaire_result["interpretation"],
    }


def build_and_save_model() -> None:
    """Train the questionnaire model and save artifacts."""
    print("=" * 60)
    print("QUESTIONNAIRE MODEL: Training")
    print("=" * 60)

    df = simulate_questionnaire_data()
    print(f"Simulated {len(df)} questionnaire responses")
    print(f"Late rate: {df['late'].mean():.1%}")

    model, feature_cols = train_questionnaire_model(df)

    # Save model artifacts
    import joblib
    model_path = OUTPUTS / "questionnaire_model.joblib"
    joblib.dump({"model": model, "feature_cols": feature_cols}, model_path)
    print(f"\nModel saved to {model_path}")

    # Save questionnaire schema
    schema_path = OUTPUTS / "questionnaire_schema.json"
    with open(schema_path, "w") as f:
        json.dump(QUESTIONNAIRE_FIELDS, f, indent=2)
    print(f"Schema saved to {schema_path}")

    # Demo: show risk for different response profiles
    print("\n--- Demo predictions ---")
    profiles = [
        ("Excellent (all 1s)", {"side_effects": 1, "effectiveness": 1, "ease_of_use": 1, "daily_routine": 1, "missed_doses": 1, "likelihood_continue": 1, "age": 70, "n_drugs": 3}),
        ("Good (all 2s)", {"side_effects": 2, "effectiveness": 2, "ease_of_use": 2, "daily_routine": 2, "missed_doses": 2, "likelihood_continue": 2, "age": 70, "n_drugs": 3}),
        ("Mixed (all 3s)", {"side_effects": 3, "effectiveness": 3, "ease_of_use": 3, "daily_routine": 3, "missed_doses": 3, "likelihood_continue": 3, "age": 70, "n_drugs": 3}),
        ("Poor (all 4s)", {"side_effects": 4, "effectiveness": 4, "ease_of_use": 4, "daily_routine": 4, "missed_doses": 4, "likelihood_continue": 4, "age": 70, "n_drugs": 3}),
        ("Terrible (all 5s)", {"side_effects": 5, "effectiveness": 5, "ease_of_use": 5, "daily_routine": 5, "missed_doses": 5, "likelihood_continue": 5, "age": 70, "n_drugs": 3}),
    ]
    for name, responses in profiles:
        result = predict_questionnaire_risk(model, feature_cols, responses)
        adj = adjust_risk_score(0.55, result)
        print(f"  {name}: q_risk={result['questionnaire_risk_score']:.3f}, "
              f"original=0.550 → adjusted={adj['adjusted_score']:.3f} ({adj['adjustment_delta']:+.3f}) "
              f"[{adj['adjusted_category']}] | {result['severity']}")


if __name__ == "__main__":
    build_and_save_model()
