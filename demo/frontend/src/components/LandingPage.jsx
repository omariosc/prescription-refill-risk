import TrustBar from "./TrustBar";
import PipelineExplainer from "./PipelineExplainer";
import StatsSection from "./StatsSection";

const REFERENCES = [
  {
    num: 1,
    text: 'World Health Organization. "Adherence to Long-Term Therapies: Evidence for Action." WHO, Geneva, 2003.',
    url: 'https://iris.who.int/handle/10665/42682',
  },
  {
    num: 2,
    text: 'New England Healthcare Institute (NEHI). "Thinking Outside the Pillbox." 2009. / Watanabe JH, McInnis T, Hirsch JD. "Cost of Prescription Drug–Related Morbidity and Mortality." Ann Pharmacother. 2018;52(9):829–837.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29577766/',
  },
  {
    num: 3,
    text: 'Kaiser Family Foundation (KFF). "Analyzing Changes in Medicare Part D Enrollment for 2026," citing CMS enrollment data, February 2026.',
    url: 'https://www.kff.org/medicare/analyzing-changes-in-medicare-part-d-enrollment-for-2026/',
  },
  {
    num: 4,
    text: 'Medicare Payment Advisory Commission (MedPAC). "Report to Congress: Medicare Payment Policy." Chapter 12. March 2025.',
    url: 'https://www.medpac.gov',
  },
  {
    num: 5,
    text: 'Centers for Medicare & Medicaid Services (CMS). Medicare Part D Spending by Drug — Summary Statistics on Use and Payments. data.cms.gov, 2024.',
    url: 'https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/medicare-part-d-spending-by-drug',
  },
  {
    num: 6,
    text: 'Fortune Business Insights. "Healthcare Predictive Analytics Market Size, Share & Industry Analysis." 2024.',
    url: 'https://www.fortunebusinessinsights.com/healthcare-predictive-analytics-market-107352',
  },
  {
    num: 7,
    text: 'Pharmacy2U. Written Evidence PHA0026, UK Parliament Health and Social Care Committee, 2023–24 session.',
    url: 'https://committees.parliament.uk/writtenevidence/122311/html/',
  },
  {
    num: 8,
    text: 'Pharmacy2U Limited. Annual Report and Accounts, year ended 31 March 2025. Companies House No. 03802593, filed January 2026.',
    url: 'https://find-and-update.company-information.service.gov.uk/company/03802593/filing-history',
  },
  {
    num: 9,
    text: 'Centers for Medicare & Medicaid Services. "Medicare Claims Synthetic Public Use Files (DE-SynPUF)." 2008–2010 data sample. Used for model training and evaluation.',
    url: 'https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files',
  },
];

function ReferencesSection() {
  return (
    <section className="references-section">
      <div className="container">
        <h3 className="references-title">
          <span className="material-symbols-outlined">article</span>
          References &amp; Data Sources
        </h3>
        <ol className="references-list">
          {REFERENCES.map((ref) => (
            <li key={ref.num} id={`ref-${ref.num}`} className="references-item">
              <span className="ref-num">[{ref.num}]</span>
              <span className="ref-body">
                {ref.text}{' '}
                <a href={ref.url} target="_blank" rel="noopener noreferrer" className="ref-link">
                  {ref.url}
                </a>
              </span>
            </li>
          ))}
        </ol>
        <p className="references-note">
          All statistics marked with superscript reference numbers. Pipeline metrics derived from authors' own analysis of CMS DE-SynPUF data [9]. This demo uses synthetic data only — not clinical advice.
        </p>
      </div>
    </section>
  );
}

export default function LandingPage({ onGetStarted }) {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>
            Predict. Prevent.
            <br />
            <span>Protect.</span>
          </h1>
          <p>
            AI-powered late refill risk prediction. Identify patients at risk of
            medication non-adherence and intervene before they lapse.
          </p>
          <button className="hero-cta" onClick={onGetStarted}>
            <span className="material-symbols-outlined">speed</span> Get Started
          </button>
        </div>
      </section>
      <TrustBar />
      <PipelineExplainer />
      <StatsSection />
      <ReferencesSection />
    </>
  );
}
