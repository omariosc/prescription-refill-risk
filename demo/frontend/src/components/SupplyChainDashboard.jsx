import { useState, useMemo } from "react";

/* SSA State Code → Name/Abbr mapping (CMS DE-SynPUF codebook) */
const SSA = {1:{n:"Alabama",a:"AL"},2:{n:"Alaska",a:"AK"},3:{n:"Arizona",a:"AZ"},4:{n:"Arkansas",a:"AR"},5:{n:"California",a:"CA"},6:{n:"Colorado",a:"CO"},7:{n:"Connecticut",a:"CT"},8:{n:"Delaware",a:"DE"},9:{n:"District of Columbia",a:"DC"},10:{n:"Florida",a:"FL"},11:{n:"Georgia",a:"GA"},12:{n:"Hawaii",a:"HI"},13:{n:"Idaho",a:"ID"},14:{n:"Illinois",a:"IL"},15:{n:"Indiana",a:"IN"},16:{n:"Iowa",a:"IA"},17:{n:"Kansas",a:"KS"},18:{n:"Kentucky",a:"KY"},19:{n:"Louisiana",a:"LA"},20:{n:"Maine",a:"ME"},21:{n:"Maryland",a:"MD"},22:{n:"Massachusetts",a:"MA"},23:{n:"Michigan",a:"MI"},24:{n:"Minnesota",a:"MN"},25:{n:"Mississippi",a:"MS"},26:{n:"Missouri",a:"MO"},27:{n:"Montana",a:"MT"},28:{n:"Nebraska",a:"NE"},29:{n:"Nevada",a:"NV"},30:{n:"New Hampshire",a:"NH"},31:{n:"New Jersey",a:"NJ"},32:{n:"New Mexico",a:"NM"},33:{n:"New York",a:"NY"},34:{n:"North Carolina",a:"NC"},35:{n:"North Dakota",a:"ND"},36:{n:"Ohio",a:"OH"},37:{n:"Oklahoma",a:"OK"},38:{n:"Oregon",a:"OR"},39:{n:"Pennsylvania",a:"PA"},40:{n:"Puerto Rico",a:"PR"},41:{n:"Rhode Island",a:"RI"},42:{n:"South Carolina",a:"SC"},43:{n:"South Dakota",a:"SD"},44:{n:"Tennessee",a:"TN"},45:{n:"Texas",a:"TX"},46:{n:"Utah",a:"UT"},47:{n:"Vermont",a:"VT"},48:{n:"Virgin Islands",a:"VI"},49:{n:"Virginia",a:"VA"},50:{n:"Washington",a:"WA"},51:{n:"West Virginia",a:"WV"},52:{n:"Wisconsin",a:"WI"},53:{n:"Wyoming",a:"WY"},54:{n:"Other",a:"XX"}};

/* All state data from outputs/population/supply_chain.json — exact numbers */
const STATES = [
  {c:5,f:162129,p:7321,l:76.1,h:54.8},{c:10,f:104216,p:4760,l:76.4,h:55.1},{c:33,f:92334,p:4095,l:75.9,h:54.7},
  {c:45,f:90949,p:4072,l:76.2,h:55.0},{c:39,f:77543,p:3489,l:76.3,h:55.0},{c:14,f:56099,p:2535,l:76.1,h:54.8},
  {c:36,f:53564,p:2474,l:76.1,h:55.1},{c:34,f:49501,p:2162,l:76.2,h:54.9},{c:23,f:46427,p:2208,l:76.3,h:55.2},
  {c:31,f:40221,p:1781,l:76.0,h:54.4},{c:11,f:40110,p:1720,l:75.9,h:54.9},{c:44,f:38557,p:1624,l:76.3,h:54.9},
  {c:26,f:34210,p:1483,l:76.0,h:54.3},{c:49,f:33995,p:1515,l:76.1,h:54.8},{c:15,f:31942,p:1399,l:75.6,h:54.5},
  {c:22,f:30607,p:1463,l:76.7,h:55.6},{c:50,f:27634,p:1264,l:76.2,h:55.0},{c:1,f:26924,p:1224,l:76.5,h:55.3},
  {c:3,f:26729,p:1294,l:76.0,h:54.9},{c:24,f:25917,p:1249,l:76.9,h:55.2},{c:18,f:25880,p:1087,l:76.2,h:55.2},
  {c:52,f:24704,p:1158,l:76.1,h:55.1},{c:54,f:24139,p:1045,l:76.1,h:55.5},{c:19,f:23018,p:1025,l:76.2,h:55.5},
  {c:42,f:21734,p:980,l:76.3,h:54.7},{c:21,f:18830,p:877,l:76.8,h:55.8},{c:37,f:18396,p:837,l:76.2,h:55.2},
  {c:25,f:18246,p:746,l:75.9,h:55.0},{c:38,f:17770,p:873,l:76.0,h:54.2},{c:16,f:17593,p:808,l:76.5,h:54.8},
  {c:6,f:16637,p:730,l:76.4,h:55.0},{c:9,f:14832,p:599,l:75.9,h:54.2},{c:4,f:14399,p:697,l:76.2,h:54.8},
  {c:17,f:14069,p:653,l:76.2,h:55.4},{c:29,f:13445,p:572,l:76.2,h:55.0},{c:7,f:13252,p:580,l:76.4,h:55.2},
  {c:20,f:11684,p:504,l:75.8,h:54.0},{c:28,f:10720,p:515,l:76.3,h:55.5},{c:46,f:10350,p:442,l:76.4,h:54.5},
  {c:30,f:8474,p:372,l:76.2,h:54.2},{c:41,f:7932,p:338,l:76.3,h:55.0},{c:51,f:7917,p:357,l:76.7,h:56.4},
  {c:43,f:7093,p:308,l:76.2,h:55.2},{c:8,f:6895,p:304,l:76.5,h:55.1},{c:2,f:6820,p:320,l:75.3,h:53.5},
  {c:32,f:6605,p:315,l:76.2,h:54.6},{c:47,f:6113,p:260,l:76.3,h:55.4},{c:13,f:5822,p:269,l:75.6,h:54.1},
  {c:35,f:5626,p:261,l:75.7,h:54.4},{c:53,f:5358,p:234,l:76.3,h:55.2},{c:27,f:5253,p:237,l:76.1,h:55.1},
  {c:40,f:5060,p:236,l:76.0,h:54.6},{c:12,f:4697,p:211,l:75.3,h:53.7},{c:48,f:1173,p:54,l:75.9,h:55.8},
].map(s => ({ ...s, name: SSA[s.c]?.n || "Unknown", abbr: SSA[s.c]?.a || "??" }));

/* US state grid layout (cartogram approximation) */
const GRID = [
  [null,null,null,null,null,null,null,null,null,null,"ME"],
  [null,null,null,null,null,null,"WI",null,null,"VT","NH"],
  ["WA","MT","ND","MN","IL","MI",null,"NY","MA","RI","CT"],
  ["OR","ID","SD","IA","IN","OH","PA","NJ","DE",null,null],
  ["NV","WY","NE","MO","KY","WV","VA","MD","DC",null,null],
  ["CA","UT","CO","KS","TN","NC","SC",null,null,null,null],
  [null,"AZ","NM","OK","AR","MS","AL","GA",null,null,null],
  [null,null,null,"TX","LA",null,null,"FL",null,null,null],
  ["AK",null,null,null,null,null,"HI",null,"PR","VI",null],
];

function riskColor(pctHigh) {
  if (pctHigh >= 55.5) return "#ef4444";
  if (pctHigh >= 55.0) return "#f97316";
  if (pctHigh >= 54.5) return "#eab308";
  if (pctHigh >= 54.0) return "#84cc16";
  return "#22c55e";
}

function riskBg(pctHigh) {
  if (pctHigh >= 55.5) return "#fef2f2";
  if (pctHigh >= 55.0) return "#fff7ed";
  if (pctHigh >= 54.5) return "#fefce8";
  if (pctHigh >= 54.0) return "#f7fee7";
  return "#f0fdf4";
}

export default function SupplyChainDashboard({ onBack }) {
  const [sortKey, setSortKey] = useState("f");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const abbrMap = useMemo(() => {
    const m = {};
    STATES.forEach(s => { m[s.abbr] = s; });
    return m;
  }, []);

  const sorted = useMemo(() => {
    let list = STATES.filter(s =>
      !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.abbr.toLowerCase().includes(search.toLowerCase())
    );
    list.sort((a, b) => sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
    return list;
  }, [sortKey, sortAsc, search]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key) => sortKey === key ? (sortAsc ? "arrow_upward" : "arrow_downward") : "unfold_more";

  const maxFills = Math.max(...STATES.map(s => s.f));

  return (
    <div className="section">
      <div className="container">
        <button onClick={onBack} className="btn btn-s btn-sm" style={{ marginBottom: 24 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Back
        </button>

        <div style={{ marginBottom: 24 }}>
          <h2 className="sec-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--accent)" }}>local_shipping</span>
            Supply Chain Intelligence
          </h2>
          <p className="sec-sub" style={{ marginBottom: 0 }}>
            Geographic risk distribution across 52 states and territories — identify where intervention resources are needed most
          </p>
        </div>

        {/* Stat cards */}
        <div className="an-stats-grid">
          <div className="an-stat">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#005c8f", background: "#005c8f14", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>map</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: "var(--navy)", lineHeight: 1.1 }}>52</div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>States &amp; Territories</div>
            </div>
          </div>
          <div className="an-stat">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--accent)", background: "rgba(0,224,188,.1)", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>location_city</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: "var(--navy)", lineHeight: 1.1 }}>2,978</div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>Counties Covered</div>
            </div>
          </div>
          <div className="an-stat">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#8b5cf6", background: "#8b5cf614", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>groups</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: "var(--navy)", lineHeight: 1.1 }}>67,085</div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>Total Patients</div>
            </div>
          </div>
          <div className="an-stat">
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--coral)", background: "rgba(232,66,58,.1)", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>trending_down</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: "var(--navy)", lineHeight: 1.1 }}>54.2–55.8%</div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>High-Risk Range Across States</div>
            </div>
          </div>
        </div>

        {/* US Cartogram */}
        <div className="an-section">
          <div className="an-section-hdr">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--accent)" }}>map</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>US Risk Heatmap</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Click a state to see details. Colour indicates % of fills classified as HIGH risk.</div>
            </div>
          </div>
          <div className="an-section-body" style={{ overflowX: "auto" }}>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, fontSize: 12, color: "#6b7280" }}>
              <span style={{ fontWeight: 600 }}>% High-Risk:</span>
              {[["#22c55e","<54%"],["#84cc16","54–54.5%"],["#eab308","54.5–55%"],["#f97316","55–55.5%"],["#ef4444","≥55.5%"]].map(([c,l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: c, display: "inline-block" }} />
                  {l}
                </span>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 52px)", gap: 3, justifyContent: "center" }}>
              {GRID.flat().map((abbr, i) => {
                if (!abbr) return <div key={i} style={{ width: 52, height: 44 }} />;
                const st = abbrMap[abbr];
                if (!st) return <div key={i} style={{ width: 52, height: 44, background: "#f3f4f6", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9ca3af" }}>{abbr}</div>;
                const isSelected = selected === st.c;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(isSelected ? null : st.c)}
                    title={`${st.name}: ${st.h}% high-risk, ${st.p.toLocaleString()} patients`}
                    style={{
                      width: 52, height: 44, borderRadius: 6, border: isSelected ? "2px solid var(--navy)" : "1px solid #e5e7eb",
                      background: riskBg(st.h), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "transform 100ms, box-shadow 100ms", position: "relative",
                      boxShadow: isSelected ? "0 0 0 3px rgba(0,92,143,.2)" : "none", fontFamily: "inherit",
                    }}
                    onMouseOver={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.zIndex = "10"; }}
                    onMouseOut={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = "1"; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: riskColor(st.h) }}>{abbr}</div>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>{st.h}%</div>
                  </button>
                );
              })}
            </div>

            {/* Selected state detail */}
            {selected && (() => {
              const st = STATES.find(s => s.c === selected);
              if (!st) return null;
              return (
                <div style={{ marginTop: 16, padding: 20, background: riskBg(st.h), border: `1px solid ${riskColor(st.h)}40`, borderRadius: 10, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: riskColor(st.h), minWidth: 60, textAlign: "center" }}>{st.abbr}</div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--navy)" }}>{st.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>SSA Code: {st.c}</div>
                  </div>
                  {[
                    ["description", st.f.toLocaleString(), "Fills"],
                    ["groups", st.p.toLocaleString(), "Patients"],
                    ["trending_down", `${st.l}%`, "Late Rate"],
                    ["warning", `${st.h}%`, "High-Risk"],
                  ].map(([icon, val, lbl]) => (
                    <div key={lbl} style={{ textAlign: "center", minWidth: 80 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--accent)" }}>{icon}</span>
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: "var(--navy)" }}>{val}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sortable state table */}
        <div className="an-section">
          <div className="an-section-hdr" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--accent)" }}>table_chart</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>State-Level Data</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Click column headers to sort. All 52 states and territories.</div>
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <span className="material-symbols-outlined" style={{ position: "absolute", left: 10, top: 9, fontSize: 18, color: "#9ca3af" }}>search</span>
              <input
                type="text"
                placeholder="Filter states..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontFamily: "inherit", fontSize: 13, padding: "8px 12px 8px 34px", border: "1px solid var(--border)", borderRadius: 8, width: 200, outline: "none", background: "#fff" }}
              />
            </div>
          </div>
          <div className="an-section-body" style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="an-table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 22 }}>State</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("f")}>
                      Fills <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>{sortIcon("f")}</span>
                    </th>
                    <th>Volume</th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("p")}>
                      Patients <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>{sortIcon("p")}</span>
                    </th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("l")}>
                      Late % <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>{sortIcon("l")}</span>
                    </th>
                    <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("h")}>
                      High-Risk % <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>{sortIcon("h")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(s => (
                    <tr key={s.c} style={{ cursor: "pointer", background: selected === s.c ? "rgba(0,224,188,.06)" : undefined }} onClick={() => setSelected(selected === s.c ? null : s.c)}>
                      <td style={{ paddingLeft: 22 }}>
                        <span style={{ fontWeight: 700, color: "var(--navy)", marginRight: 8 }}>{s.abbr}</span>
                        <span style={{ color: "#6b7280", fontSize: 13 }}>{s.name}</span>
                      </td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{s.f.toLocaleString()}</td>
                      <td>
                        <div style={{ width: 120, height: 10, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${(s.f / maxFills) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 3, transition: "width 400ms" }} />
                        </div>
                      </td>
                      <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>{s.p.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: s.l >= 76.5 ? "var(--coral)" : s.l >= 76.0 ? "#d97706" : "#059669" }}>{s.l}%</td>
                      <td>
                        <span style={{ fontWeight: 700, color: riskColor(s.h), background: riskBg(s.h), padding: "2px 8px", borderRadius: 4, fontSize: 13 }}>{s.h}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Key insight */}
        <div className="an-section">
          <div className="an-section-hdr">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--accent)" }}>lightbulb</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>Geographic Insight</div>
            </div>
          </div>
          <div className="an-section-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>explore</span> What the data shows
                </div>
                <ul style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                  <li>Late rates vary only 1.6pp across states (75.3%–76.9%)</li>
                  <li>High-risk share ranges 53.5%–55.8% — a 2.3pp spread</li>
                  <li>Top 5 states (CA, FL, NY, TX, PA) hold 36% of all fills</li>
                  <li>Volume differences are significant but risk rates are not</li>
                </ul>
              </div>
              <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#a16207", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>science</span> Why geography looks flat
                </div>
                <ul style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                  <li>CMS DE-SynPUF deliberately coarsens geographic correlations</li>
                  <li>Real dispensing data would show meaningful regional variation</li>
                  <li>Supply chain decisions should use <strong>volume</strong>, not risk rate, for resource allocation in this demo</li>
                  <li>Rural vs urban, pharmacy desert effects would appear in real data</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ background: "#fff", borderRadius: "var(--card)", boxShadow: "var(--shadow)", padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12, marginTop: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>info</span>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--navy)" }}>Synthetic data.</strong> Geographic codes use CMS SSA numbering (not FIPS). State-level risk variation is minimal due to the DE-SynPUF synthesis process. Real Pharmacy2U data would enable postcode-level supply chain optimisation.
          </div>
        </div>
      </div>
    </div>
  );
}
