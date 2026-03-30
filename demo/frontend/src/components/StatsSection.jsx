import { useState, useEffect } from "react";

/* ─── Data ──────────────────────────────────────────────────────── */

const MARKET_STATS = [
  {
    icon: "people",
    value: "56.1M",
    label: "Medicare Part D beneficiaries",
    iconColor: "#005c8f",
    iconBg: "#dbeafe",
  },
  {
    icon: "payments",
    value: "$141B",
    label: "Annual Part D drug spending",
    iconColor: "#003052",
    iconBg: "#e0e7ef",
    valueColor: "#003052",
  },
  {
    icon: "receipt_long",
    value: "1.6B+",
    label: "Prescription claims per year",
    iconColor: "#0d9488",
    iconBg: "#ccfbf1",
    valueColor: "#0d9488",
  },
  {
    icon: "trending_up",
    value: "$184.6B",
    label: "Predictive analytics market by 2032",
    iconColor: "#059669",
    iconBg: "#d1fae5",
    valueColor: "#059669",
  },
];

const P2U_STATS = [
  {
    icon: "medication",
    value: "1.6M+",
    label: "Items processed per month",
    iconColor: "#005c8f",
    iconBg: "#c5ffec",
  },
  {
    icon: "groups",
    value: "750K+",
    label: "Active patients across the UK",
    iconColor: "#005c8f",
    iconBg: "#c5ffec",
  },
  {
    icon: "show_chart",
    value: "$334M",
    label: "Revenue last year",
    badge: "↑ 68%",
    iconColor: "#059669",
    iconBg: "#d1fae5",
    valueColor: "#059669",
  },
  {
    icon: "person_add",
    value: "25K",
    label: "New patients every month",
    badge: "/mo",
    iconColor: "#005c8f",
    iconBg: "#c5ffec",
  },
];

const FLYWHEEL = [
  {
    icon: "psychology",
    label: "Better Model",
    desc: "Richer feature engineering and improved gradient boosting calibration raise baseline accuracy.",
  },
  {
    icon: "analytics",
    label: "More Accurate Predictions",
    desc: "Higher PR-AUC means fewer missed high-risk patients and fewer unnecessary interventions.",
  },
  {
    icon: "notifications_active",
    label: "Higher Intervention Success",
    desc: "Targeted reminders reach the right patients before they lapse, improving adherence rates.",
  },
  {
    icon: "business",
    label: "More Pharmacy Clients",
    desc: "Demonstrated ROI drives adoption across the pharmacy network and attracts new partners.",
  },
  {
    icon: "hub",
    label: "More Interventions",
    desc: "A larger client base generates richer, real-world intervention outcomes at scale.",
  },
  {
    icon: "database",
    label: "More Training Data",
    desc: "Outcome-labelled events flow back into the training pipeline, closing the feedback loop.",
  },
];

/* ─── Flywheel geometry ─────────────────────────────────────────── */

const CX = 155,
  CY = 155,
  R = 108,
  NR = 26,
  SZ = 310;
const GAP = 0.3; // radians gap inside each node

function nPos(i) {
  const a = -Math.PI / 2 + i * (Math.PI / 3);
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
}

function arcD(i) {
  const a0 = -Math.PI / 2 + i * (Math.PI / 3) + GAP;
  const a1 = -Math.PI / 2 + (i + 1) * (Math.PI / 3) - GAP;
  const p = (a, r) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const [sx, sy] = p(a0, R);
  const [ex, ey] = p(a1, R);
  return `M ${sx.toFixed(2)},${sy.toFixed(2)} A ${R},${R} 0 0,1 ${ex.toFixed(2)},${ey.toFixed(2)}`;
}

const NODES = FLYWHEEL.map((f, i) => ({ ...f, ...nPos(i) }));

/* ─── Flywheel component ────────────────────────────────────────── */

const TICK = 2600; // ms per step

function FlywheelViz() {
  const [step, setStep] = useState(0);
  const [prev, setPrev] = useState(FLYWHEEL.length - 1);
  const timerRef = useRef(null);

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setStep((s) => {
        setPrev(s);
        return (s + 1) % FLYWHEEL.length;
      });
    }, TICK);
  }

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function jumpTo(i) {
    setStep((s) => {
      if (s === i) return s;
      setPrev(s);
      return i;
    });
    resetTimer();
  }

  // arc i arrives at node (i+1)%6
  function arcSt(i) {
    const dst = (i + 1) % FLYWHEEL.length;
    if (dst === step) return "active";
    if (dst === prev) return "prev";
    return "idle";
  }

  function nodeSt(i) {
    if (i === step) return "active";
    if (i === prev) return "prev";
    return "idle";
  }

  return (
    <div className="fw-layout">
      {/* ── Circle diagram ── */}
      <div className="fw-viz">
        <svg
          width={SZ}
          height={SZ}
          viewBox={`0 0 ${SZ} ${SZ}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Arrow markers */}
            {["idle", "prev", "active"].map((s) => (
              <marker
                key={s}
                id={`fw-arr-${s}`}
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path
                  d="M0,1 L7,4 L0,7 Z"
                  fill={
                    s === "active"
                      ? "#00e0bc"
                      : s === "prev"
                        ? "#a7f3d0"
                        : "#d1d5db"
                  }
                />
              </marker>
            ))}
            {/* Glow filter */}
            <filter id="fw-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dashed track */}
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="#e9ecef"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />

          {/* Arc segments */}
          {FLYWHEEL.map((_, i) => {
            const st = arcSt(i);
            const active = st === "active";
            const vis = st === "prev";
            return (
              <path
                key={active ? `arc-${i}-${step}` : `arc-${i}-${st}`}
                d={arcD(i)}
                fill="none"
                stroke={active ? "#00e0bc" : vis ? "#a7f3d0" : "#d1d5db"}
                strokeWidth={active ? 3.5 : vis ? 2.5 : 2}
                strokeLinecap="round"
                markerEnd={`url(#fw-arr-${st})`}
                className={active ? "fw-arc-draw" : undefined}
              />
            );
          })}

          {/* Glow rings for active node */}
          {NODES.map((n, i) => {
            if (nodeSt(i) !== "active") return null;
            return (
              <circle
                key={`glow-${step}`}
                cx={n.x}
                cy={n.y}
                r={NR + 10}
                fill="rgba(0,224,188,0.14)"
                className="fw-glow-ring"
              />
            );
          })}

          {/* Node circle fills */}
          {NODES.map((n, i) => {
            const st = nodeSt(i);
            const active = st === "active";
            const vis = st === "prev";
            return (
              <circle
                key={active ? `nc-${i}-${step}` : `nc-${i}`}
                cx={n.x}
                cy={n.y}
                r={NR}
                fill={active ? "#00e0bc" : vis ? "#ecfdf5" : "#fff"}
                stroke={active ? "#00b89c" : vis ? "#a7f3d0" : "#e5e7eb"}
                strokeWidth={active ? 2.5 : 1.5}
                filter={active ? "url(#fw-glow)" : undefined}
                className={active ? "fw-node-pop" : undefined}
                onClick={() => jumpTo(i)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Center step counter */}
          <circle
            cx={CX}
            cy={CY}
            r={22}
            fill="#f8fafc"
            stroke="#e5e7eb"
            strokeWidth="1.5"
          />
          <text
            x={CX}
            y={CY - 5}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "Nunito, sans-serif",
              fontSize: 15,
              fontWeight: 800,
              fill: "#005c8f",
            }}
          >
            {step + 1}
          </text>
          <text
            x={CX}
            y={CY + 9}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 9,
              fontWeight: 600,
              fill: "#9ca3af",
              letterSpacing: 0.5,
            }}
          >
            OF 6
          </text>
        </svg>

        {/* HTML icon overlays — positioned over SVG nodes */}
        {NODES.map((n, i) => {
          const st = nodeSt(i);
          return (
            <div
              key={i}
              className={`fw-icon-node fw-icon-${st}`}
              style={{
                left: n.x - NR,
                top: n.y - NR,
                width: NR * 2,
                height: NR * 2,
                cursor: 'pointer',
              }}
              onClick={() => jumpTo(i)}
            >
              <span className="material-symbols-outlined">{n.icon}</span>
            </div>
          );
        })}
      </div>

      {/* ── Step cards ── */}
      <div className="fw-cards">
        {FLYWHEEL.map((item, i) => {
          const st = nodeSt(i);
          const active = st === "active";
          const vis = st === "prev";
          return (
            <div
              key={active ? `fc-${i}-${step}` : `fc-${i}`}
              className={`fw-card fw-card-${st}`}
              onClick={() => jumpTo(i)}
            >
              <div className="fw-card-icon">
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <div className="fw-card-body">
                <div className="fw-card-title">
                  <span className="fw-step-num">{i + 1}</span>
                  <span className="fw-step-label">{item.label}</span>
                  {vis && (
                    <span className="material-symbols-outlined fw-tick">
                      check_circle
                    </span>
                  )}
                </div>
                {active && <p className="fw-card-desc">{item.desc}</p>}
                {active && (
                  <div className="fw-prog-track">
                    <div
                      className="fw-prog-fill"
                      style={{ animationDuration: `${TICK}ms` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */

export default function StatsSection() {
  return (
    <div className="stats-section">
      {/* Challenge Banner */}
      <div className="stats-challenge">
        <div className="container">
          <div className="challenge-tag">
            <span className="material-symbols-outlined">warning</span>
            The Challenge
          </div>
          <div className="challenge-grid">
            <div className="challenge-stat">
              <span className="challenge-value">$290–528B</span>
              <span className="challenge-desc">
                Annual US cost of medication non-adherence
              </span>
            </div>
            <div className="challenge-divider" />
            <div className="challenge-stat">
              <span className="challenge-value">50%</span>
              <span className="challenge-desc">
                Of patients don't take medications as prescribed
              </span>
            </div>
          </div>
          <div className="challenge-note">
            <span className="material-symbols-outlined">info</span>
            Late &amp; missed refills are the most measurable and actionable
            proxy for non-adherence.
          </div>
        </div>
      </div>

      {/* Market Opportunity */}
      <div className="stats-market">
        <div className="container">
          <div className="stats-header">
            <span className="stats-tag navy">Market Opportunity</span>
            <h2 className="stats-title">Medicare Part D at Scale</h2>
          </div>
          <div className="stats-grid">
            {MARKET_STATS.map((s) => (
              <div className="stat-card" key={s.label}>
                <div
                  className="stat-icon"
                  style={{ background: s.iconBg, color: s.iconColor }}
                >
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <div
                  className="stat-value"
                  style={{ color: s.valueColor || "var(--heading)" }}
                >
                  {s.value}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pharmacy2U Today */}
      <div className="stats-p2u">
        <div className="container">
          <div className="stats-header">
            <span className="stats-tag teal">Pharmacy2U Today</span>
            <h2 className="stats-title">A Platform Built for Intervention</h2>
            <p className="stats-sub">
              Every late refill = lost dispensing revenue + increased inbound
              contact costs + worse patient outcomes.
            </p>
          </div>
          <div className="stats-grid">
            {P2U_STATS.map((s) => (
              <div className="stat-card stat-card-p2u" key={s.label}>
                <div
                  className="stat-icon"
                  style={{ background: s.iconBg, color: s.iconColor }}
                >
                  <span className="material-symbols-outlined">{s.icon}</span>
                </div>
                <div className="stat-value-row">
                  <span
                    className="stat-value"
                    style={{ color: s.valueColor || "var(--heading)" }}
                  >
                    {s.value}
                  </span>
                  {s.badge && (
                    <span
                      className="stat-badge"
                      style={
                        s.valueColor === "#059669"
                          ? { background: "#d1fae5", color: "#059669" }
                          : {}
                      }
                    >
                      {s.badge}
                    </span>
                  )}
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="p2u-insight">
            <span className="material-symbols-outlined">lightbulb</span>
            <p>
              If a proactive reminder triggered by your model prevents even{" "}
              <strong>5% of late refills</strong> across their patient base,
              that's{" "}
              <strong>
                tens of thousands of additional dispensed items per month
              </strong>{" "}
              — each generating dispensing fees and reducing costly reactive
              contact.
            </p>
          </div>
        </div>
      </div>

      {/* Growth Flywheel */}
      <div className="stats-flywheel">
        <div className="container">
          <div className="stats-header centered">
            <span className="stats-tag accent">The Growth Flywheel</span>
            <h2 className="stats-title">How Pharmacy2U Funds Your Growth</h2>
            <p className="stats-sub" style={{ margin: "0 auto" }}>
              A self-reinforcing loop — better predictions drive more clients,
              which generates more data, which improves the model further.
            </p>
          </div>
          <FlywheelViz />
        </div>
      </div>
    </div>
  );
}
