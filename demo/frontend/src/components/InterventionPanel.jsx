import { useState } from 'react';

const INTERVENTIONS = [
  {
    id: 'app_push',
    label: 'App Push Notification',
    icon: 'notifications',
    color: '#10b981',
    description: 'Automated reminder via the Pharmacy2U app',
    detail: 'Lowest effort, good for tech-savvy patients',
    level: 0,
  },
  {
    id: 'sms',
    label: 'SMS Reminder',
    icon: 'sms',
    color: '#3b82f6',
    description: 'Text message reminder to refill medication',
    detail: 'Quick, non-intrusive',
    level: 1,
  },
  {
    id: 'phone_call',
    label: 'Phone Call',
    icon: 'call',
    color: '#e89c0d',
    description: 'Personal call from pharmacy team',
    detail: 'Higher engagement, good for elderly',
    level: 2,
  },
  {
    id: 'letter',
    label: 'Physical Letter',
    icon: 'mail',
    color: '#8b5cf6',
    description: 'Posted letter with refill reminder and support information',
    detail: 'For patients without digital access',
    level: 3,
  },
  {
    id: 'gp_consultation',
    label: 'Book GP Consultation',
    icon: 'medical_services',
    color: '#e8423a',
    description: 'Escalate to GP for medication review and adherence assessment',
    detail: 'Highest intensity, for serious non-adherence',
    level: 4,
  },
];

const LEVEL_COLORS = ['#10b981', '#3b82f6', '#e89c0d', '#8b5cf6', '#e8423a'];

function getSuggestedIntervention(age, riskCategory) {
  if (riskCategory === 'LOW') return 'app_push';
  if (riskCategory === 'HIGH') {
    if (age && age > 75) return 'phone_call';
    if (age && age < 25) return 'app_push';
    return 'phone_call';
  }
  // MODERATE
  if (age && age > 80) return 'phone_call';
  if (age && age > 65) return 'sms';
  if (age && age < 30) return 'app_push';
  return 'sms';
}

function getSuggestedLabel(id) {
  const item = INTERVENTIONS.find((i) => i.id === id);
  return item ? item.label : id;
}

export default function InterventionPanel({ patient }) {
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const suggested = getSuggestedIntervention(patient.age, patient.risk_category);

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 4000);
  };

  return (
    <div className="d-sec">
      <h3>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>support_agent</span> Clinician Intervention
      </h3>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
        Choose how to reach this patient. Suggested: <strong style={{ color: '#0d9488' }}>{getSuggestedLabel(suggested)}</strong> based on risk level and patient age.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INTERVENTIONS.map((item) => {
          const isSelected = selected === item.id;
          const isSuggested = suggested === item.id;

          return (
            <button
              key={item.id}
              onClick={() => { setSelected(item.id); setConfirmed(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: isSelected ? 'rgba(0,224,188,.06)' : '#fff',
                border: '1px solid',
                borderColor: isSelected ? '#0d9488' : 'var(--border)',
                borderLeft: isSelected ? '4px solid #0d9488' : '4px solid transparent',
                borderRadius: 'var(--sm)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 150ms',
                position: 'relative',
                width: '100%',
              }}
            >
              {/* Icon */}
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 24,
                  color: item.color,
                  background: `${item.color}15`,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{item.label}</span>
                  {isSuggested && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#0d9488',
                      background: '#ccfbf1',
                      padding: '2px 8px',
                      borderRadius: 'var(--pill)',
                      textTransform: 'uppercase',
                      letterSpacing: '.5px',
                    }}>
                      Recommended
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.description}</div>
              </div>

              {/* Escalation level bar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <div style={{
                  width: 6,
                  height: 32,
                  borderRadius: 3,
                  background: '#f0f0f0',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${((item.level + 1) / INTERVENTIONS.length) * 100}%`,
                    background: `linear-gradient(to top, ${LEVEL_COLORS[item.level]}, ${LEVEL_COLORS[Math.max(0, item.level - 1)]})`,
                    borderRadius: 3,
                    transition: 'height 300ms',
                  }} />
                </div>
                <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.3px', display: 'inline-block', height: '12px', lineHeight: '12px' }}>
                  {item.level === 0 ? 'Low' : item.level === 4 ? 'High' : '\u00a0'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      {selected && !confirmed && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={handleConfirm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 32px',
              background: '#0d9488',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--pill)',
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
            Confirm Intervention
          </button>
        </div>
      )}

      {/* Success toast */}
      {confirmed && (
        <div style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 18px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 'var(--sm)',
          fontSize: 13,
          color: '#065f46',
          fontWeight: 500,
          animation: 'fadeIn 200ms ease-out',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#10b981' }}>task_alt</span>
          Intervention scheduled: <strong>{getSuggestedLabel(selected)}</strong> for {patient.patient_id}
        </div>
      )}
    </div>
  );
}
