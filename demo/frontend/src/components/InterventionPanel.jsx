import { useState } from 'react';

const INTERVENTIONS = [
  {
    id: 'app_push',
    label: 'App Push Notification',
    icon: 'notifications',
    color: '#10b981',
    description: 'Automated reminder via the Pharmacy2U app',
    levelLabel: 'Minimal',
    level: 0,
  },
  {
    id: 'sms',
    label: 'SMS Reminder',
    icon: 'sms',
    color: '#3b82f6',
    description: 'Text message reminder to refill medication',
    levelLabel: 'Low',
    level: 1,
  },
  {
    id: 'letter',
    label: 'Physical Letter',
    icon: 'mail',
    color: '#8b5cf6',
    description: 'Posted letter with refill reminder and support information',
    levelLabel: 'Medium',
    level: 2,
  },
  {
    id: 'phone_call',
    label: 'Phone Call',
    icon: 'call',
    color: '#e89c0d',
    description: 'Personal call from pharmacy team',
    levelLabel: 'High',
    level: 3,
  },
  {
    id: 'gp_consultation',
    label: 'Book GP Consultation',
    icon: 'medical_services',
    color: '#e8423a',
    description: 'Escalate to GP for medication review and adherence assessment',
    levelLabel: 'Urgent',
    level: 4,
  },
];

const LEVEL_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#e89c0d', '#e8423a'];

function getSuggestedIntervention(age, riskCategory) {
  if (riskCategory === 'LOW') return 'app_push';
  if (riskCategory === 'HIGH') {
    if (age && age > 75) return 'phone_call';
    if (age && age < 25) return 'app_push';
    return 'phone_call';
  }
  if (age && age > 80) return 'phone_call';
  if (age && age > 65) return 'sms';
  if (age && age < 30) return 'app_push';
  return 'sms';
}

export function getInterventionLabel(id) {
  const item = INTERVENTIONS.find((i) => i.id === id);
  return item ? item.label : id;
}

export function getInterventionColor(id) {
  const item = INTERVENTIONS.find((i) => i.id === id);
  return item ? item.color : '#6b7280';
}

export default function InterventionPanel({ patient, onConfirm }) {
  const [selected, setSelected] = useState(null);

  const suggested = getSuggestedIntervention(patient.age, patient.risk_category);

  const handleConfirm = () => {
    if (selected && onConfirm) {
      onConfirm(selected, patient.patient_id);
    }
  };

  return (
    <div className="d-sec">
      <h3>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>support_agent</span> Clinician Intervention
      </h3>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
        Choose how to reach this patient. Suggested: <strong style={{ color: '#0d9488' }}>{getInterventionLabel(suggested)}</strong> based on risk level{patient.age ? ` and patient age (${patient.age}y)` : ''}.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INTERVENTIONS.map((item) => {
          const isSelected = selected === item.id;
          const isSuggested = suggested === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: isSelected ? `${item.color}08` : '#fff',
                border: '1px solid',
                borderColor: isSelected ? item.color : 'var(--border)',
                borderLeft: isSelected ? `10px solid ${item.color}` : '10px solid transparent',
                borderRadius: 'var(--sm)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 150ms',
                position: 'relative',
                width: '100%',
              }}
            >
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

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{item.label}</span>
                  {isSuggested && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#0d9488', background: '#ccfbf1',
                      padding: '2px 8px', borderRadius: 'var(--pill)', textTransform: 'uppercase', letterSpacing: '.5px',
                    }}>
                      Recommended
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.description}</div>
              </div>

              {/* Escalation bar with label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, minWidth: 44 }}>
                <div style={{
                  width: 6, height: 32, borderRadius: 3, background: '#f0f0f0',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${((item.level + 1) / INTERVENTIONS.length) * 100}%`,
                    background: `linear-gradient(to top, ${LEVEL_COLORS[item.level]}, ${LEVEL_COLORS[Math.max(0, item.level - 1)]})`,
                    borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 9, color: item.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                  {item.levelLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            onClick={handleConfirm}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 32px', background: '#0d9488', color: '#fff',
              border: 'none', borderRadius: 'var(--pill)', fontFamily: "'Inter', sans-serif",
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
            Confirm Intervention
          </button>
        </div>
      )}
    </div>
  );
}
