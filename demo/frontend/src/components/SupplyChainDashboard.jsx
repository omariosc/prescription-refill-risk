import { useState, useMemo } from "react";

/* Wilson score confidence interval for a proportion (95%) */
function wilsonCI(pctVal, n) {
  if (!n || n === 0) return "";
  const z = 1.96;
  const p = pctVal / 100;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const s = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n) / d;
  const lo = Math.max(0, c - s) * 100;
  const hi = Math.min(1, c + s) * 100;
  return `[${lo.toFixed(1)}–${hi.toFixed(1)}%]`;
}

/* ──────────────────────────────────────────────────────────────────
   Supply Chain Dashboard — Geographic Risk View
   Data sourced from outputs/population/supply_chain.json
   1,473,595 scored fills across 67,085 patients, 52 states/territories,
   2,978 counties (CMS DE-SynPUF 2008-2010).
   ────────────────────────────────────────────────────────────────── */

/* SSA State Code mapping (hardcoded from CMS DE-SynPUF codebook) */
const SSA_MAP = {
  1:"AL",2:"AK",3:"AZ",4:"AR",5:"CA",6:"CO",7:"CT",8:"DE",9:"DC",10:"FL",
  11:"GA",12:"HI",13:"ID",14:"IL",15:"IN",16:"IA",17:"KS",18:"KY",19:"LA",
  20:"ME",21:"MD",22:"MA",23:"MI",24:"MN",25:"MS",26:"MO",27:"MT",28:"NE",
  29:"NV",30:"NH",31:"NJ",32:"NM",33:"NY",34:"NC",35:"ND",36:"OH",37:"OK",
  38:"OR",39:"PA",40:"PR",41:"RI",42:"SC",43:"SD",44:"TN",45:"TX",46:"UT",
  47:"VT",48:"VI",49:"VA",50:"WA",51:"WV",52:"WI",53:"WY",
};

const ABBR_TO_NAME = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",
  IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",
  MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",
  NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",
  OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",
  SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",
  VT:"Vermont",VI:"Virgin Islands",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",Other:"Other/Unknown",
};

/* Top 30 states by volume — exact numbers from supply_chain.json */
const STATE_DATA = [
  { ssa: 5,  abbr: "CA", fills: 162_129, patients: 7_321, pctLate: 76.1, pctHigh: 54.8, drugs: 3494, providers: 10_665 },
  { ssa: 10, abbr: "FL", fills: 104_216, patients: 4_760, pctLate: 76.4, pctHigh: 55.1, drugs: 3352, providers: 9_632 },
  { ssa: 33, abbr: "NY", fills: 92_334,  patients: 4_095, pctLate: 75.9, pctHigh: 54.7, drugs: 3330, providers: 8_679 },
  { ssa: 45, abbr: "TX", fills: 90_949,  patients: 4_072, pctLate: 76.2, pctHigh: 55.0, drugs: 3299, providers: 8_095 },
  { ssa: 39, abbr: "PA", fills: 77_543,  patients: 3_489, pctLate: 76.3, pctHigh: 55.0, drugs: 3253, providers: 6_678 },
  { ssa: 14, abbr: "IL", fills: 56_099,  patients: 2_535, pctLate: 76.1, pctHigh: 54.8, drugs: 3103, providers: 6_010 },
  { ssa: 36, abbr: "OH", fills: 53_564,  patients: 2_474, pctLate: 76.1, pctHigh: 55.1, drugs: 3041, providers: 5_754 },
  { ssa: 34, abbr: "NC", fills: 49_501,  patients: 2_162, pctLate: 76.2, pctHigh: 54.9, drugs: 3005, providers: 4_875 },
  { ssa: 23, abbr: "MI", fills: 46_427,  patients: 2_208, pctLate: 76.3, pctHigh: 55.2, drugs: 3023, providers: 5_452 },
  { ssa: 31, abbr: "NJ", fills: 40_221,  patients: 1_781, pctLate: 76.0, pctHigh: 54.4, drugs: 2938, providers: 4_763 },
  { ssa: 11, abbr: "GA", fills: 40_110,  patients: 1_720, pctLate: 75.9, pctHigh: 54.9, drugs: 2907, providers: 3_888 },
  { ssa: 44, abbr: "TN", fills: 38_557,  patients: 1_624, pctLate: 76.3, pctHigh: 54.9, drugs: 2887, providers: 3_346 },
  { ssa: 26, abbr: "MO", fills: 34_210,  patients: 1_483, pctLate: 76.0, pctHigh: 54.3, drugs: 2824, providers: 3_232 },
  { ssa: 49, abbr: "VA", fills: 33_995,  patients: 1_515, pctLate: 76.1, pctHigh: 54.8, drugs: 2819, providers: 4_273 },
  { ssa: 15, abbr: "IN", fills: 31_942,  patients: 1_399, pctLate: 75.6, pctHigh: 54.5, drugs: 2791, providers: 3_798 },
  { ssa: 22, abbr: "MA", fills: 30_607,  patients: 1_463, pctLate: 76.7, pctHigh: 55.6, drugs: 2748, providers: 3_881 },
  { ssa: 50, abbr: "WA", fills: 27_634,  patients: 1_264, pctLate: 76.2, pctHigh: 55.0, drugs: 2679, providers: 3_038 },
  { ssa: 1,  abbr: "AL", fills: 26_924,  patients: 1_224, pctLate: 76.5, pctHigh: 55.3, drugs: 2653, providers: 2_927 },
  { ssa: 3,  abbr: "AZ", fills: 26_729,  patients: 1_294, pctLate: 76.0, pctHigh: 54.9, drugs: 2660, providers: 2_567 },
  { ssa: 24, abbr: "MN", fills: 25_917,  patients: 1_249, pctLate: 76.9, pctHigh: 55.2, drugs: 2667, providers: 2_519 },
  { ssa: 18, abbr: "KY", fills: 25_880,  patients: 1_087, pctLate: 76.2, pctHigh: 55.2, drugs: 2610, providers: 2_610 },
  { ssa: 52, abbr: "WI", fills: 24_704,  patients: 1_158, pctLate: 76.1, pctHigh: 55.1, drugs: 2610, providers: 3_270 },
  { ssa: 54, abbr: "Other", fills: 24_139, patients: 1_045, pctLate: 76.1, pctHigh: 55.5, drugs: 2570, providers: 1_431 },
  { ssa: 19, abbr: "LA", fills: 23_018,  patients: 1_025, pctLate: 76.2, pctHigh: 55.5, drugs: 2578, providers: 2_272 },
  { ssa: 42, abbr: "SC", fills: 21_734,  patients: 980,   pctLate: 76.3, pctHigh: 54.7, drugs: 2544, providers: 2_745 },
  { ssa: 21, abbr: "MD", fills: 18_830,  patients: 877,   pctLate: 76.8, pctHigh: 55.8, drugs: 2423, providers: 3_080 },
  { ssa: 37, abbr: "OK", fills: 18_396,  patients: 837,   pctLate: 76.2, pctHigh: 55.2, drugs: 2420, providers: 2_103 },
  { ssa: 25, abbr: "MS", fills: 18_246,  patients: 746,   pctLate: 75.9, pctHigh: 55.0, drugs: 2410, providers: 1_820 },
  { ssa: 38, abbr: "OR", fills: 17_770,  patients: 873,   pctLate: 76.0, pctHigh: 54.2, drugs: 2413, providers: 1_876 },
  { ssa: 16, abbr: "IA", fills: 17_593,  patients: 808,   pctLate: 76.5, pctHigh: 54.8, drugs: 2376, providers: 2_117 },
  { ssa: 6,  abbr: "CO", fills: 16_637,  patients: 730,   pctLate: 76.4, pctHigh: 55.0, drugs: 2381, providers: 2_039 },
  { ssa: 9,  abbr: "DC", fills: 14_832,  patients: 599,   pctLate: 75.9, pctHigh: 54.2, drugs: 1056, providers: 416 },
  { ssa: 4,  abbr: "AR", fills: 14_399,  patients: 697,   pctLate: 76.2, pctHigh: 54.8, drugs: 2350, providers: 1_754 },
  { ssa: 17, abbr: "KS", fills: 14_069,  patients: 653,   pctLate: 76.2, pctHigh: 55.4, drugs: 2309, providers: 1_840 },
  { ssa: 29, abbr: "NV", fills: 13_445,  patients: 572,   pctLate: 76.2, pctHigh: 55.0, drugs: 1913, providers: 1_125 },
  { ssa: 7,  abbr: "CT", fills: 13_252,  patients: 580,   pctLate: 76.4, pctHigh: 55.2, drugs: 2316, providers: 2_054 },
  { ssa: 20, abbr: "ME", fills: 11_684,  patients: 504,   pctLate: 75.8, pctHigh: 54.0, drugs: 1901, providers: 1_204 },
  { ssa: 28, abbr: "NE", fills: 10_720,  patients: 515,   pctLate: 76.3, pctHigh: 55.5, drugs: 1953, providers: 1_211 },
  { ssa: 46, abbr: "UT", fills: 10_350,  patients: 442,   pctLate: 76.4, pctHigh: 54.5, drugs: 1810, providers: 1_004 },
  { ssa: 30, abbr: "NH", fills: 8_474,   patients: 372,   pctLate: 76.2, pctHigh: 54.2, drugs: 1638, providers: 1_028 },
  { ssa: 41, abbr: "RI", fills: 7_932,   patients: 338,   pctLate: 76.3, pctHigh: 55.0, drugs: 1653, providers: 646 },
  { ssa: 51, abbr: "WV", fills: 7_917,   patients: 357,   pctLate: 76.7, pctHigh: 56.4, drugs: 2185, providers: 1_325 },
  { ssa: 43, abbr: "SD", fills: 7_093,   patients: 308,   pctLate: 76.2, pctHigh: 55.2, drugs: 1479, providers: 628 },
  { ssa: 8,  abbr: "DE", fills: 6_895,   patients: 304,   pctLate: 76.5, pctHigh: 55.1, drugs: 1449, providers: 747 },
  { ssa: 2,  abbr: "AK", fills: 6_820,   patients: 320,   pctLate: 75.3, pctHigh: 53.5, drugs: 872, providers: 317 },
  { ssa: 32, abbr: "NM", fills: 6_605,   patients: 315,   pctLate: 76.2, pctHigh: 54.6, drugs: 1845, providers: 1_071 },
  { ssa: 47, abbr: "VT", fills: 6_113,   patients: 260,   pctLate: 76.3, pctHigh: 55.4, drugs: 1297, providers: 558 },
  { ssa: 13, abbr: "ID", fills: 5_822,   patients: 269,   pctLate: 75.6, pctHigh: 54.1, drugs: 1692, providers: 864 },
  { ssa: 35, abbr: "ND", fills: 5_626,   patients: 261,   pctLate: 75.7, pctHigh: 54.4, drugs: 1355, providers: 515 },
  { ssa: 53, abbr: "WY", fills: 5_358,   patients: 234,   pctLate: 76.3, pctHigh: 55.2, drugs: 1100, providers: 410 },
  { ssa: 27, abbr: "MT", fills: 5_253,   patients: 237,   pctLate: 76.1, pctHigh: 55.1, drugs: 1461, providers: 648 },
  { ssa: 40, abbr: "PR", fills: 5_060,   patients: 236,   pctLate: 76.0, pctHigh: 54.6, drugs: 0, providers: 0 },
  { ssa: 12, abbr: "HI", fills: 4_697,   patients: 211,   pctLate: 75.3, pctHigh: 53.7, drugs: 1624, providers: 513 },
  { ssa: 48, abbr: "VI", fills: 1_173,   patients: 54,    pctLate: 75.9, pctHigh: 55.8, drugs: 0, providers: 0 },
];

/* Manufacturer (labeler) counts per state from clean_main.csv via manufacturer_data.json */
const MFR_BY_SSA = {5:3493,10:3352,33:3329,45:3298,39:3252,14:3101,36:3040,23:3021,34:3004,31:2936,11:2905,44:2886,26:2822,49:2817,15:2789,22:2746,50:2677,1:2651,3:2658,24:2665,18:2608,52:2608,19:2576,42:2542,21:2421,37:2418,25:2408,38:2411,16:2374,6:2379,9:1054,4:2348,17:2307,29:1911,7:2314,20:1899,28:1951,46:1808,30:1636,41:1651,51:2183,43:1477,8:1447,2:870,32:1843,47:1295,13:1690,35:1353,53:1098,27:1459,40:0,12:1622,48:0,54:2568};
STATE_DATA.forEach((s) => { s.manufacturers = MFR_BY_SSA[s.ssa] || 0; });

/* Top 15 manufacturers (labeler codes) by fill volume */
const TOP_MANUFACTURERS = [
  { code: "58016", fills: 610_690 }, { code: "54868", fills: 163_915 },
  { code: "36987", fills: 121_813 }, { code: "00247", fills: 105_057 },
  { code: "61392", fills: 97_640 },  { code: "51129", fills: 91_991 },
  { code: "54569", fills: 82_488 },  { code: "00904", fills: 66_041 },
  { code: "67544", fills: 59_219 },  { code: "66267", fills: 52_935 },
  { code: "00179", fills: 52_403 },  { code: "63874", fills: 52_069 },
  { code: "00781", fills: 50_901 },  { code: "55887", fills: 46_468 },
  { code: "55154", fills: 45_613 },
];
const TOTAL_MANUFACTURERS = 3_743;

const TOTALS = { states: 52, counties: 2_978, fills: 1_473_595, patients: 67_085 };
const MAX_FILLS = STATE_DATA[0].fills; // CA

/* Build lookup by abbreviation */
const STATE_BY_ABBR = {};
STATE_DATA.forEach((s) => { STATE_BY_ABBR[s.abbr] = s; });

/* ── US Cartogram grid (row-major, 9 rows x 11 cols) ────────── */
/* Standard US tile grid (NPR / FiveThirtyEight layout) — 8 rows × 12 cols */
const CARTO_GRID = [
  ["AK", null, null, null, null, null, null, null, null, null, null, "ME"],
  [null, null, null, null, null, "WI", null, null, null, "VT", "NH", null],
  ["WA", "ID", "MT", "ND", "MN", "IL", "MI", null, null, "NY", "MA", null],
  ["OR", "NV", "WY", "SD", "IA", "IN", "OH", "PA", "NJ", "CT", "RI", null],
  ["CA", "UT", "CO", "NE", "MO", "KY", "WV", "VA", "MD", "DE", "DC", null],
  [null, "AZ", "NM", "KS", "AR", "TN", "NC", "SC", null, null, null, null],
  [null, null, null, "OK", "LA", "MS", "AL", "GA", null, null, null, null],
  ["HI", null, null, "TX", null, null, null, "FL", null, null, "PR", "VI"],
];

/* ── Risk colour helpers ──────────────────────────── */
function riskColor(pctHigh) {
  if (pctHigh >= 55.5) return "#dc2626";
  if (pctHigh >= 55.0) return "#ea580c";
  if (pctHigh >= 54.5) return "#d97706";
  if (pctHigh >= 54.0) return "#65a30d";
  return "#059669";
}

function riskBg(pctHigh) {
  if (pctHigh >= 55.5) return "#fef2f2";
  if (pctHigh >= 55.0) return "#fff7ed";
  if (pctHigh >= 54.5) return "#fffbeb";
  if (pctHigh >= 54.0) return "#f7fee7";
  return "#f0fdf4";
}

/* ── Sort configuration ──────────────────────────── */
const COLUMNS = [
  { key: "abbr",    label: "State",      align: "left" },
  { key: "fills",   label: "Fills",      align: "right" },
  { key: "patients",label: "Patients",   align: "right" },
  { key: "pctLate", label: "Late %",     align: "right" },
  { key: "pctHigh", label: "High-Risk %",align: "right" },
];

/* ── Reusable sub-components (same design system as AnalyticsDashboard) ── */

function StatCard({ icon, value, label, color, sub }) {
  return (
    <div className="an-stat">
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 28, color,
          background: `${color}14`,
          borderRadius: 10, width: 44, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nunito',sans-serif", color: "var(--navy)", lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function HBar({ label, value, pct, maxPct = 100, color = "var(--accent)", sub }) {
  const w = Math.max(2, (pct / maxPct) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 140, textAlign: "right", fontSize: 13, fontWeight: 500, color: "#374151", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 22, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${w}%`, height: "100%", background: color, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            paddingRight: 6, fontSize: 10, fontWeight: 700, color: "#fff",
            minWidth: 28, transition: "width 600ms ease-out",
          }}
        >
          {value}
        </div>
      </div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", width: 80, flexShrink: 0 }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ icon, title, sub, children }) {
  return (
    <div className="an-section">
      <div className="an-section-hdr">
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--accent)" }}>{icon}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: "#6b7280" }}>{sub}</div>}
        </div>
      </div>
      <div className="an-section-body">{children}</div>
    </div>
  );
}

/* ── Main dashboard component ──────────────────────── */
export default function SupplyChainDashboard({ onBack }) {
  const [selectedState, setSelectedState] = useState(null);
  const [sortKey, setSortKey] = useState("fills");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState("");

  /* Sort/filter the table data */
  const filteredData = useMemo(() => {
    const term = filter.toLowerCase().trim();
    let rows = [...STATE_DATA];
    if (term) {
      rows = rows.filter((s) => {
        const name = (ABBR_TO_NAME[s.abbr] || "").toLowerCase();
        return s.abbr.toLowerCase().includes(term) || name.includes(term);
      });
    }
    rows.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string") return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
    return rows;
  }, [filter, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "abbr"); }
  };

  const selectedData = selectedState ? STATE_BY_ABBR[selectedState] : null;

  /* Risk-rate range across the dataset */
  const minHigh = Math.min(...STATE_DATA.map((s) => s.pctHigh));
  const maxHigh = Math.max(...STATE_DATA.map((s) => s.pctHigh));

  return (
    <div className="section">
      <div className="container">

        {/* ── Back button ── */}
        <button onClick={onBack} className="btn btn-s btn-sm" style={{ marginBottom: 24 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Back to Risk Tool
        </button>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 24 }}>
          <h2 className="sec-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--accent)" }}>local_shipping</span>
            Supply Chain Geography
          </h2>
          <p className="sec-sub" style={{ marginBottom: 0 }}>
            Geographic distribution of prescription refill risk across {TOTALS.states} states and territories — {TOTALS.fills.toLocaleString()} fills, {TOTALS.patients.toLocaleString()} patients
          </p>
        </div>

        {/* ── Stat cards ── */}
        <div className="an-stats-grid">
          <StatCard icon="description" value={TOTALS.fills.toLocaleString()} label="Total Prescription Fills" color="#005c8f" sub="across all geographies" />
          <StatCard icon="groups" value={TOTALS.patients.toLocaleString()} label="Unique Patients" color="var(--accent)" sub="with state data" />
          <StatCard icon="map" value={String(TOTALS.states)} label="States & Territories" color="#8b5cf6" sub="including DC, PR, VI" />
          <StatCard icon="location_on" value={TOTALS.counties.toLocaleString()} label="Counties" color="#d97706" sub="SSA county codes" />
        </div>

        {/* ── Cartogram ── */}
        <SectionCard
          icon="grid_view"
          title="US State Risk Cartogram"
          sub={`Cell colour = high-risk patient % (${minHigh}%\u2013${maxHigh}%). Click a state for details.`}
        >
          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>palette</span>
              <span style={{ fontWeight: 600 }}>High-Risk %:</span>
            </div>
            {[
              ["#059669", "<54%"],
              ["#65a30d", "54\u201354.5%"],
              ["#d97706", "54.5\u201355%"],
              ["#ea580c", "55\u201355.5%"],
              ["#dc2626", "\u226555.5%"],
            ].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 16, height: 16, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11, color: "#4b5563" }}>{l}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ overflowX: "auto", paddingBottom: 8, display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(12, 50px)", gap: 3, flexShrink: 0 }}>
              {CARTO_GRID.flat().map((abbr, i) => {
                if (!abbr) return <div key={i} style={{ width: 50, height: 44 }} />;
                const st = STATE_BY_ABBR[abbr];
                const isActive = selectedState === abbr;

                /* States not in top-30 appear as muted placeholders */
                if (!st) {
                  return (
                    <div
                      key={i}
                      style={{
                        width: 50, height: 44, borderRadius: 6,
                        background: "#f3f4f6", border: "1px solid #e5e7eb",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af" }}>{abbr}</span>
                      <span style={{ fontSize: 8, color: "#d1d5db" }}>---</span>
                    </div>
                  );
                }

                /* Volume-scaled opacity (larger states more prominent) */
                const baseOpacity = 0.55 + 0.45 * (st.fills / MAX_FILLS);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedState(isActive ? null : abbr)}
                    title={`${ABBR_TO_NAME[abbr]}: ${st.pctHigh}% high-risk, ${st.patients.toLocaleString()} patients, ${st.fills.toLocaleString()} fills`}
                    style={{
                      width: 50, height: 44, borderRadius: 6,
                      border: isActive ? "2.5px solid var(--navy)" : "1.5px solid #e5e7eb",
                      background: riskBg(st.pctHigh),
                      opacity: baseOpacity,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 150ms ease",
                      transform: isActive ? "scale(1.12)" : "scale(1)",
                      boxShadow: isActive ? "0 4px 14px rgba(0,48,82,0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                      fontFamily: "inherit",
                      padding: 0,
                      position: "relative",
                      zIndex: isActive ? 10 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.zIndex = "5"; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.zIndex = "1"; } }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: riskColor(st.pctHigh), lineHeight: 1 }}>{abbr}</span>
                    <span style={{ fontSize: 8, color: "#6b7280", lineHeight: 1, marginTop: 2 }}>{st.pctHigh}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected state detail panel */}
          {selectedData && (
            <div
              style={{
                marginTop: 16,
                background: riskBg(selectedData.pctHigh),
                border: `1.5px solid ${riskColor(selectedData.pctHigh)}30`,
                borderRadius: 10, padding: 20,
                animation: "fadeIn 200ms ease-out",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    fontSize: 28, fontWeight: 900, fontFamily: "'Nunito',sans-serif",
                    color: riskColor(selectedData.pctHigh),
                    background: `${riskColor(selectedData.pctHigh)}14`,
                    width: 56, height: 56, borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selectedData.abbr}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>
                      {ABBR_TO_NAME[selectedData.abbr] || selectedData.abbr}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>SSA Code {selectedData.ssa} &middot; Rank #{STATE_DATA.indexOf(selectedData) + 1} by volume</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedState(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, display: "flex", alignItems: "center" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#9ca3af" }}>close</span>
                </button>
              </div>
              <div className="an-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginBottom: 0 }}>
                <StatCard icon="description" value={selectedData.fills.toLocaleString()} label="Prescription Fills" color="#005c8f" />
                <StatCard icon="groups" value={selectedData.patients.toLocaleString()} label="Patients" color="var(--accent)" />
                <StatCard icon="schedule" value={`${selectedData.pctLate}%`} label="Late Refill Rate" color="#d97706" sub={wilsonCI(selectedData.pctLate, selectedData.fills)} />
                <StatCard icon="warning" value={`${selectedData.pctHigh}%`} label="High-Risk" color="var(--coral)" />
                <StatCard icon="factory" value={selectedData.manufacturers.toLocaleString()} label="Manufacturers" color="#8b5cf6" />
                <StatCard icon="local_pharmacy" value={selectedData.providers.toLocaleString()} label="Providers" color="#0088b3" />
                <StatCard icon="medication" value={selectedData.drugs.toLocaleString()} label="Drug Codes" color="#059669" />
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Sortable state table ── */}
        <SectionCard icon="table_chart" title="State Rankings" sub="Top 30 states by volume. Click column headers to sort, or use the search box to filter.">
          {/* Search input */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 340 }}>
              <span
                className="material-symbols-outlined"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "#9ca3af", pointerEvents: "none" }}
              >
                search
              </span>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search states (e.g. California, TX)..."
                style={{
                  width: "100%",
                  padding: "10px 36px 10px 36px",
                  border: "1.5px solid var(--border)",
                  borderRadius: 8, fontSize: 13,
                  fontFamily: "'Inter',sans-serif",
                  outline: "none",
                  transition: "border-color 150ms, background 150ms",
                  background: "#f9fafb",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.background = "#f9fafb"; }}
              />
              {filter && (
                <button
                  onClick={() => setFilter("")}
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#9ca3af" }}>close</span>
                </button>
              )}
            </div>
            <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
              {filteredData.length} of {STATE_DATA.length} states
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="an-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: "center" }}>#</th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{ cursor: "pointer", textAlign: col.align, userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {col.label}
                        {sortKey === col.key ? (
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--accent)" }}>
                            {sortAsc ? "arrow_upward" : "arrow_downward"}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#d1d5db" }}>unfold_more</span>
                        )}
                      </span>
                    </th>
                  ))}
                  <th style={{ width: 150 }}>Volume</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((s, i) => {
                  const isActive = selectedState === s.abbr;
                  return (
                    <tr
                      key={`${s.abbr}-${s.ssa}`}
                      onClick={() => setSelectedState(isActive ? null : s.abbr)}
                      style={{
                        cursor: "pointer",
                        background: isActive ? "rgba(0,224,188,0.07)" : undefined,
                        transition: "background 100ms",
                      }}
                    >
                      <td style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{i + 1}</td>

                      {/* State */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 11, fontWeight: 800, color: "#fff",
                            background: riskColor(s.pctHigh),
                            padding: "2px 6px", borderRadius: 4,
                            width: 36, textAlign: "center",
                            display: "inline-block",
                          }}>
                            {s.abbr}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{ABBR_TO_NAME[s.abbr] || s.abbr}</span>
                        </div>
                      </td>

                      {/* Fills */}
                      <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>
                        {s.fills.toLocaleString()}
                      </td>

                      {/* Patients */}
                      <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
                        {s.patients.toLocaleString()}
                      </td>

                      {/* Late % with CI */}
                      <td style={{
                        textAlign: "right", fontWeight: 700,
                        color: s.pctLate >= 76.5 ? "var(--coral)" : s.pctLate >= 76.0 ? "#d97706" : "#059669",
                      }}>
                        {s.pctLate}%
                        <span style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af", marginLeft: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                          {wilsonCI(s.pctLate, s.fills)}
                        </span>
                      </td>

                      {/* High-Risk % */}
                      <td style={{ textAlign: "right" }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: riskColor(s.pctHigh),
                          background: riskBg(s.pctHigh),
                          padding: "2px 8px", borderRadius: 4,
                        }}>
                          {s.pctHigh}%
                        </span>
                      </td>

                      {/* Volume bar */}
                      <td>
                        <div style={{ width: 140, height: 14, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.max(4, (s.fills / MAX_FILLS) * 100)}%`,
                            height: "100%",
                            background: `linear-gradient(90deg, var(--accent), ${riskColor(s.pctHigh)})`,
                            borderRadius: 3,
                            transition: "width 600ms ease-out",
                          }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, display: "block", marginBottom: 8 }}>search_off</span>
              No states match &ldquo;{filter}&rdquo;
            </div>
          )}
        </SectionCard>

        {/* ── Top 10 by volume bar chart ── */}
        <SectionCard icon="bar_chart" title="Top 10 States by Fill Volume" sub="California alone accounts for 11% of all fills — nearly matching Florida and New York combined">
          {STATE_DATA.slice(0, 10).map((s) => (
            <HBar
              key={`${s.abbr}-vol`}
              label={`${s.abbr} \u2014 ${(ABBR_TO_NAME[s.abbr] || "").split(" ")[0]}`}
              value={`${(s.fills / 1000).toFixed(0)}K`}
              pct={s.fills}
              maxPct={MAX_FILLS}
              color={riskColor(s.pctHigh)}
              sub={`${s.patients.toLocaleString()} pts`}
            />
          ))}
        </SectionCard>

        {/* ── High-risk hotspots ── */}
        <SectionCard icon="local_fire_department" title="Highest High-Risk Rates" sub="States where the largest share of patients fall into the high-risk segment">
          {[...STATE_DATA]
            .sort((a, b) => b.pctHigh - a.pctHigh)
            .slice(0, 10)
            .map((s) => (
              <HBar
                key={`${s.abbr}-hr`}
                label={`${s.abbr} \u2014 ${(ABBR_TO_NAME[s.abbr] || "").split(" ")[0]}`}
                value={`${s.pctHigh}%`}
                pct={s.pctHigh}
                maxPct={57}
                color={riskColor(s.pctHigh)}
                sub={`${s.pctLate}% late`}
              />
            ))}
        </SectionCard>

        {/* ── Supplier concentration ── */}
        <SectionCard icon="factory" title="Supplier Landscape" sub={`${TOTAL_MANUFACTURERS.toLocaleString()} unique manufacturers (NDC-5 labeler codes) across the dataset`}>
          <div className="an-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 16 }}>
            <StatCard icon="factory" value={TOTAL_MANUFACTURERS.toLocaleString()} label="Unique Manufacturers" color="#8b5cf6" />
            <StatCard icon="inventory_2" value="610,690" label="Top Supplier Fills" color="#005c8f" sub="Labeler 58016" />
            <StatCard icon="pie_chart" value="41.4%" label="Top Supplier Market Share" color="var(--coral)" sub="58016 alone" />
            <StatCard icon="balance" value="84.4%" label="Top 15 Combined Share" color="#d97706" />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 8 }}>Top 15 manufacturers by prescription fill volume</div>
          {TOP_MANUFACTURERS.map((m, i) => {
            const pct = (m.fills / TOTALS.fills * 100);
            return (
              <div key={m.code} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                <div style={{ width: 22, textAlign: "right", fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{i + 1}</div>
                <div style={{ width: 60, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--navy)", fontWeight: 600 }}>{m.code}</div>
                <div style={{ flex: 1, height: 18, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(1, pct / 42 * 100)}%`, height: "100%", background: i === 0 ? "var(--navy)" : i < 5 ? "#0088b3" : "var(--accent)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4, fontSize: 10, fontWeight: 700, color: "#fff", minWidth: 36 }}>
                    {m.fills.toLocaleString()}
                  </div>
                </div>
                <div style={{ width: 50, textAlign: "right", fontSize: 11, color: "#6b7280" }}>{pct.toFixed(1)}%</div>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, fontStyle: "italic" }}>
            Manufacturer code 58016 dominates with 41.4% of all fills. In a real supply chain context, this concentration would flag dependency risk: disruption to a single supplier could affect hundreds of thousands of patients. Diversification analysis would be a key operational recommendation.
          </div>
        </SectionCard>

        {/* ── Key insights ── */}
        <SectionCard icon="lightbulb" title="Key Insights" sub="What the geographic data reveals about refill risk distribution">
          <div className="an-cohort-pair">
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>explore</span> Geographic uniformity
              </div>
              <ul style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                <li>Late refill rates vary only 75.6% to 76.9% across all states (1.3pp)</li>
                <li>High-risk percentages span just 54.2% to 55.8% (1.6pp range)</li>
                <li>No state is a clear outlier or safe harbour</li>
                <li>Volume differences are dramatic but risk rates are remarkably flat</li>
              </ul>
            </div>
            <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#a16207", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>science</span> Why geography appears flat
              </div>
              <ul style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                <li>CMS DE-SynPUF deliberately coarsens geographic correlations during synthesis</li>
                <li>Real dispensing data would show meaningful regional variation</li>
                <li>Pharmacy deserts, rural vs urban access gaps, and socioeconomic effects are not preserved</li>
                <li>Supply chain routing should prioritise <strong>volume hubs</strong> in this demo</li>
              </ul>
            </div>
          </div>

          <div style={{
            marginTop: 16, background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: 14,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#059669", flexShrink: 0, marginTop: 2 }}>check_circle</span>
            <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
              <strong style={{ color: "#065f46" }}>Operational recommendation:</strong> In production, Pharmacy2U would focus fulfilment centre placement and proactive outreach resources on the five highest-volume states (CA, FL, NY, TX, PA) which together account for 36% of all fills. Risk-rate-based targeting becomes relevant only with real claims data where geographic variation is preserved.
            </div>
          </div>
        </SectionCard>

        {/* ── Disclaimer footer ── */}
        <div style={{
          background: "#fff", borderRadius: "var(--card)", boxShadow: "var(--shadow)",
          padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 12, marginTop: 24,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--accent)", flexShrink: 0, marginTop: 2 }}>info</span>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--navy)" }}>Synthetic data.</strong> All figures are from CMS DE-SynPUF (2008-2010) &mdash; a fully synthetic dataset with deliberately altered correlations. Geographic codes use CMS SSA numbering (not FIPS). The uniformity in risk rates across states is an artefact of the data synthesis process. Real pharmacy claims data would exhibit meaningful regional variation driven by healthcare access, socioeconomic factors, and local pharmacy density.
          </div>
        </div>

      </div>
    </div>
  );
}
