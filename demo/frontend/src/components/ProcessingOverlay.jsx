import { useState, useEffect, useRef } from 'react';

const STEPS = [
  'Validating input data...',
  'Loading patient records...',
  'Preprocessing temporal features...',
  'Computing refill gap statistics...',
  'Extracting cost & polypharmacy signals...',
  'Running LightGBM prediction...',
  'Computing MAPIE conformal prediction intervals...',
  'Calibrating probability scores (Platt scaling)...',
  'Computing SHAP feature contributions...',
  'Generating clinical recommendations...',
  'Compiling report...',
];

export default function ProcessingOverlay({ stream, onComplete, onError }) {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [doneSteps, setDoneSteps] = useState(new Set());
  const hasRun = useRef(false);

  useEffect(() => {
    if (!stream || hasRun.current) return;
    hasRun.current = true;

    async function readStream() {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resultData = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop();

          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(part.slice(6));
              if (data.type === 'progress') {
                setProgress(data.progress);
                const stepIdx = STEPS.indexOf(data.message);
                if (data.message === 'Complete' || stepIdx >= 0) {
                  setActiveStep(stepIdx >= 0 ? stepIdx : STEPS.length);
                  // Mark all previous steps as done
                  setDoneSteps((prev) => {
                    const next = new Set(prev);
                    const upTo = data.message === 'Complete' ? STEPS.length : stepIdx;
                    for (let i = 0; i < upTo; i++) next.add(i);
                    return next;
                  });
                }
              }
              if (data.type === 'result') {
                resultData = data;
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        // Mark all steps done
        setDoneSteps(new Set(STEPS.map((_, i) => i)));
        setProgress(100);

        await new Promise((r) => setTimeout(r, 500));
        if (resultData) {
          // Sort results
          const order = { HIGH: 0, MODERATE: 1, LOW: 2 };
          const sorted = resultData.predictions.slice().sort(
            (a, b) => (order[a.risk_category] - order[b.risk_category]) || (b.risk_score - a.risk_score)
          );
          onComplete({ ...resultData, sorted });
        }
      } catch (err) {
        onError(err.message);
      }
    }

    readStream();
  }, [stream, onComplete, onError]);

  return (
    <section className="processing active">
      <div className="container">
        <div className="proc-card">
          <h2>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: 28, verticalAlign: 'middle', marginRight: 8 }}>model_training</span>
            Running Adherence Risk Model
          </h2>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="prog-steps">
            {STEPS.map((step, i) => {
              const isDone = doneSteps.has(i);
              const isActive = i === activeStep;
              return (
                <div key={i} className={`prog-step${isDone ? ' done' : isActive ? ' active' : ''}`}>
                  {isDone ? (
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                  ) : isActive ? (
                    <div className="spinner" />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>radio_button_unchecked</span>
                  )}
                  {' '}{step}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
