import TrustBar from './TrustBar';
import PipelineExplainer from './PipelineExplainer';
import StatsSection from './StatsSection';

export default function LandingPage({ onGetStarted }) {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Predict. Prevent.<br /><span>Protect.</span></h1>
          <p>AI-powered late refill risk prediction for Medicare Part D beneficiaries. Identify patients at risk of medication non-adherence and intervene before they lapse.</p>
          <button className="hero-cta" onClick={onGetStarted}>
            <span className="material-symbols-outlined">speed</span> Get Started
          </button>
        </div>
      </section>
      <TrustBar />
      <PipelineExplainer />
      <StatsSection />
    </>
  );
}
