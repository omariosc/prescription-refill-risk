const TRUST_ITEMS = [
  { icon: "groups", text: "56M+ Beneficiaries Covered" },
  { icon: "verified", text: "Validated Model (PR-AUC)" },
  { icon: "psychology", text: "Explainable AI (SHAP)" },
  { icon: "bolt", text: "Real-time Risk Scoring" },
];

export default function TrustBar() {
  return (
    <section className="trust">
      <div className="container">
        <div className="trust-items">
          {TRUST_ITEMS.map((item) => (
            <div className="trust-item" key={item.icon}>
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
