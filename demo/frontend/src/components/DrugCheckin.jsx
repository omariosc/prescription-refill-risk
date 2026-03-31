import { useState } from 'react';
import { submitQuestionnaire } from '../utils/api';

const QUESTIONS = [
  {
    key: 'effectiveness',
    title: 'Effectiveness',
    prompt: (drug) => `How well is ${drug} managing your condition?`,
    labels: ['Not at all', 'Slightly', 'Moderately', 'Well', 'Very effectively'],
    type: 'scale',
  },
  {
    key: 'side_effects',
    title: 'Side Effects',
    prompt: (drug) => `Have you experienced any side effects?`,
    labels: ['None at all', 'Minimal', 'Some', 'Significant', 'Severe/unbearable'],
    type: 'side_effects',
    colors: ['#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'],
  },
  {
    key: 'qol_impact',
    title: 'Quality of Life',
    prompt: (drug) => `How has this medication affected your daily life?`,
    labels: ['Much worse', 'Somewhat worse', 'No change', 'Somewhat better', 'Much better'],
    type: 'emoji',
    emojis: ['\ud83d\ude1f', '\ud83d\ude15', '\ud83d\ude10', '\ud83d\ude42', '\ud83d\ude03'],
  },
  {
    key: 'ease_of_use',
    title: 'Ease of Use',
    prompt: (drug) => `How easy is it to take this medication as prescribed?`,
    labels: ['Very difficult', 'Difficult', 'Neutral', 'Easy', 'Very easy'],
    type: 'scale',
  },
  {
    key: 'would_continue',
    title: 'Continue Medication',
    prompt: (drug) => `Would you like to continue taking this medication?`,
    type: 'yesno',
  },
];

const INTERVENTION_LABELS = {
  app_push: 'We will keep you updated via the app',
  sms: 'We will follow up with a text message',
  phone_call: 'A member of our team will call you soon',
  gp_consultation: 'Your GP will review your case',
  letter: 'We will send you further information by post',
};

export default function DrugCheckin({ questionnaire, onComplete, onClose }) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [sideEffectNotes, setSideEffectNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const drugName = questionnaire.drug_name;
  const totalSteps = QUESTIONS.length;

  const currentQ = QUESTIONS[step];
  const currentValue = responses[currentQ?.key];

  const canNext = () => {
    if (!currentQ) return false;
    if (currentQ.type === 'yesno') return responses[currentQ.key] !== undefined;
    return currentValue !== undefined;
  };

  const handleSelect = (key, value) => {
    setResponses(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...responses };
      if (sideEffectNotes) payload.notes = sideEffectNotes;
      const data = await submitQuestionnaire(questionnaire.id, payload);
      setResult(data);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Result screen ──────────────────────────────────────────────
  if (result) {
    const sev = responses.side_effects || 0;
    let bannerBg, bannerBorder, bannerIcon, bannerColor, bannerText;
    if (sev >= 4) {
      bannerBg = '#fef2f2'; bannerBorder = '#fecaca'; bannerIcon = 'warning'; bannerColor = '#dc2626';
      bannerText = "We've flagged your responses for a GP review. You will be contacted shortly.";
    } else if (sev >= 3) {
      bannerBg = '#fffbeb'; bannerBorder = '#fde68a'; bannerIcon = 'info'; bannerColor = '#d97706';
      bannerText = "We'll have someone from our team check in with you soon.";
    } else {
      bannerBg = '#f0fdf4'; bannerBorder = '#bbf7d0'; bannerIcon = 'check_circle'; bannerColor = '#16a34a';
      bannerText = 'Thank you! Your responses help us provide better care.';
    }

    return (
      <div style={overlayStyle}>
        <div style={containerStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <span style={{ flex: 1 }} />
            <button onClick={() => { onComplete && onComplete(); onClose && onClose(); }} style={closeButtonStyle}>
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
            </button>
          </div>

          <div style={{ padding: '20px 20px 32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: bannerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: bannerColor }}>{bannerIcon}</span>
            </div>
            <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 20, color: '#003052', marginBottom: 8 }}>Check-in Complete</div>
            <div style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.5, marginBottom: 20 }}>{drugName}</div>

            {/* Banner message */}
            <div style={{ background: bannerBg, border: `1px solid ${bannerBorder}`, borderRadius: 12, padding: '14px 16px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: bannerColor, flexShrink: 0, marginTop: 1 }}>{bannerIcon}</span>
                <div style={{ fontSize: 14, color: bannerColor, lineHeight: 1.5, fontWeight: 600 }}>{bannerText}</div>
              </div>
            </div>

            {/* Next steps */}
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', textAlign: 'left', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#003052', marginBottom: 8 }}>What happens next</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#0d9488' }}>arrow_forward</span>
                <span style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                  {INTERVENTION_LABELS[result.intervention] || 'Your care team will be in touch'}
                </span>
              </div>
            </div>

            {/* Summary scores (visual, not numeric risk) */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#003052', marginBottom: 12 }}>Your Responses</div>
              <SummaryRow label="Effectiveness" value={responses.effectiveness} max={5} color="#0d9488" />
              <SummaryRow label="Side Effects" value={responses.side_effects} max={5} color="#ef4444" invert />
              <SummaryRow label="Quality of Life" value={responses.qol_impact} max={5} color="#3b82f6" />
              <SummaryRow label="Ease of Use" value={responses.ease_of_use} max={5} color="#8b5cf6" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Would continue</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: responses.would_continue ? '#16a34a' : '#dc2626' }}>
                  {responses.would_continue ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <button onClick={() => { onComplete && onComplete(); onClose && onClose(); }} style={{ ...tealButtonStyle, marginTop: 24, width: '100%' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Question screen ────────────────────────────────────────────
  return (
    <div style={overlayStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <button onClick={onClose} style={closeButtonStyle}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
          </button>
          <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 16, color: '#003052' }}>{drugName}</div>
          <span style={{ width: 32 }} />
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px 4px' }}>
          {QUESTIONS.map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i <= step ? '#00e0bc' : '#e5e7eb',
              transition: 'background 300ms ease',
            }} />
          ))}
        </div>

        {/* Question content */}
        <div style={{ padding: '20px 20px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#00e0bc', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {currentQ.title}
          </div>
          <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 18, color: '#003052', marginBottom: 24, lineHeight: 1.4 }}>
            {currentQ.prompt(drugName)}
          </div>

          {/* Scale type */}
          {currentQ.type === 'scale' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(v => {
                const isSelected = currentValue === v;
                return (
                  <button key={v} onClick={() => handleSelect(currentQ.key, v)} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    background: isSelected ? '#e6faf6' : '#fff',
                    border: `2px solid ${isSelected ? '#00e0bc' : '#e5e7eb'}`,
                    borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Inter', system-ui, sans-serif", transition: 'all 200ms',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? '#00e0bc' : '#f3f4f6',
                      color: isSelected ? '#fff' : '#6b7280',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, transition: 'all 200ms',
                    }}>
                      {v}
                    </div>
                    <span style={{ fontSize: 14, color: isSelected ? '#003052' : '#6b7280', fontWeight: isSelected ? 600 : 400 }}>
                      {currentQ.labels[v - 1]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Side effects type */}
          {currentQ.type === 'side_effects' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(v => {
                const isSelected = currentValue === v;
                const dotColor = currentQ.colors[v - 1];
                return (
                  <button key={v} onClick={() => handleSelect(currentQ.key, v)} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    background: isSelected ? `${dotColor}12` : '#fff',
                    border: `2px solid ${isSelected ? dotColor : '#e5e7eb'}`,
                    borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Inter', system-ui, sans-serif", transition: 'all 200ms',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: isSelected ? dotColor : `${dotColor}20`,
                      color: isSelected ? '#fff' : dotColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, transition: 'all 200ms',
                    }}>
                      {v}
                    </div>
                    <span style={{ fontSize: 14, color: isSelected ? '#003052' : '#6b7280', fontWeight: isSelected ? 600 : 400 }}>
                      {currentQ.labels[v - 1]}
                    </span>
                  </button>
                );
              })}
              {/* Sub-prompt for severe side effects */}
              {currentValue >= 4 && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#003052', display: 'block', marginBottom: 6 }}>
                    Please describe:
                  </label>
                  <textarea
                    value={sideEffectNotes}
                    onChange={(e) => setSideEffectNotes(e.target.value)}
                    placeholder="Tell us about the side effects you're experiencing..."
                    style={{
                      width: '100%', minHeight: 80, padding: '12px 14px', borderRadius: 12,
                      border: '1px solid #e5e7eb', fontSize: 14, fontFamily: "'Inter', system-ui, sans-serif",
                      resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#00e0bc'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              )}
            </div>
          )}

          {/* Emoji type */}
          {currentQ.type === 'emoji' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map(v => {
                const isSelected = currentValue === v;
                return (
                  <button key={v} onClick={() => handleSelect(currentQ.key, v)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '16px 12px', minWidth: 64,
                    background: isSelected ? '#e6faf6' : '#fff',
                    border: `2px solid ${isSelected ? '#00e0bc' : '#e5e7eb'}`,
                    borderRadius: 16, cursor: 'pointer',
                    fontFamily: "'Inter', system-ui, sans-serif", transition: 'all 200ms',
                  }}>
                    <span style={{ fontSize: 32 }}>{currentQ.emojis[v - 1]}</span>
                    <span style={{ fontSize: 11, color: isSelected ? '#003052' : '#9ca3af', fontWeight: isSelected ? 600 : 400, lineHeight: 1.3, textAlign: 'center' }}>
                      {currentQ.labels[v - 1]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Yes/No type */}
          {currentQ.type === 'yesno' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => handleSelect(currentQ.key, true)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '18px 24px',
                background: responses[currentQ.key] === true ? '#00e0bc' : '#fff',
                color: responses[currentQ.key] === true ? '#fff' : '#003052',
                border: `2px solid ${responses[currentQ.key] === true ? '#00e0bc' : '#e5e7eb'}`,
                borderRadius: 16, cursor: 'pointer', fontSize: 16, fontWeight: 700,
                fontFamily: "'Nunito', system-ui, sans-serif", transition: 'all 200ms',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>thumb_up</span>
                Yes, continue
              </button>
              <button onClick={() => handleSelect(currentQ.key, false)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '18px 24px',
                background: responses[currentQ.key] === false ? '#fef2f2' : '#fff',
                color: responses[currentQ.key] === false ? '#dc2626' : '#6b7280',
                border: `2px solid ${responses[currentQ.key] === false ? '#dc2626' : '#e5e7eb'}`,
                borderRadius: 16, cursor: 'pointer', fontSize: 16, fontWeight: 700,
                fontFamily: "'Nunito', system-ui, sans-serif", transition: 'all 200ms',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>chat</span>
                No, I'd like to discuss alternatives
              </button>
            </div>
          )}

          {error && (
            <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</div>
          )}
        </div>

        {/* Footer nav */}
        <div style={{ padding: '16px 20px 24px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={handleBack} disabled={step === 0} style={{
            padding: '12px 20px', borderRadius: 28, border: '1px solid #e5e7eb',
            background: '#fff', color: step === 0 ? '#d1d5db' : '#003052',
            fontSize: 14, fontWeight: 600, cursor: step === 0 ? 'default' : 'pointer',
            fontFamily: "'Inter', system-ui, sans-serif", flex: 1,
          }}>
            Back
          </button>
          <button onClick={handleNext} disabled={!canNext() || submitting} style={{
            ...tealButtonStyle, flex: 2,
            opacity: canNext() && !submitting ? 1 : 0.5,
            cursor: canNext() && !submitting ? 'pointer' : 'default',
          }}>
            {submitting ? 'Submitting...' : step === totalSteps - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, max, color, invert }) {
  const pct = ((value || 0) / max) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#003052' }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color, transition: 'width 400ms ease' }} />
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: '#f0f2f5', zIndex: 500,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  maxWidth: 480, margin: '0 auto',
};

const containerStyle = {
  width: '100%', maxWidth: 480, maxHeight: '100vh', height: '100%',
  background: '#f8fafc', display: 'flex', flexDirection: 'column',
  overflow: 'auto', position: 'relative',
};

const headerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb',
  position: 'sticky', top: 0, zIndex: 10,
};

const closeButtonStyle = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
  color: '#6b7280', display: 'flex', alignItems: 'center',
};

const tealButtonStyle = {
  padding: '14px 24px', background: '#00e0bc', color: '#003052',
  border: 'none', borderRadius: 28, fontSize: 15, fontWeight: 700,
  fontFamily: "'Nunito', system-ui, sans-serif", cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
