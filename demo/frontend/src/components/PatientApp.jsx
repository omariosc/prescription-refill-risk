import { useState, useEffect, useRef, useCallback } from 'react';
import { getNotifications, markNotificationRead, getQuestionnaires } from '../utils/api';
import DrugCheckin from './DrugCheckin';

// ── P-10003 full patient data (multiple drugs) ──────────────────────
const PATIENT_DATA = {
  'o.choudhry@leeds.ac.uk': {
    patient_id: 'P-10003',
    name: 'Omar Choudhry',
    nhs_number: '943 826 1740',
    age: 24,
    conditions: ['Hyperlipidemia', 'CHF', 'Diabetes'],
    prescriptions: [
      {
        drug_name: 'Atorvastatin',
        drug_dose: '20mg',
        drug_ndc: '00093-5057-01',
        last_fill_date: '2026-02-05',
        days_supply: 30,
        quantity: 30,
        refill_count: 2,
        total_cost: 55.00,
        patient_pay: 35.00,
      },
      {
        drug_name: 'Metformin',
        drug_dose: '500mg',
        drug_ndc: '00093-7212-01',
        last_fill_date: '2026-03-18',
        days_supply: 30,
        quantity: 60,
        refill_count: 8,
        total_cost: 85.00,
        patient_pay: 12.50,
      },
      {
        drug_name: 'Lisinopril',
        drug_dose: '10mg',
        drug_ndc: '00093-7339-01',
        last_fill_date: '2026-03-25',
        days_supply: 30,
        quantity: 30,
        refill_count: 15,
        total_cost: 22.00,
        patient_pay: 5.00,
      },
    ],
  },
};

const TODAY = new Date('2026-03-31');

const NOTIF_CONFIG = {
  in_app_survey: { icon: 'fact_check', titleFn: (n) => `${n.from_name} has sent you a medication check-in survey` },
  letter: { icon: 'mail', titleFn: (n) => `${n.from_name} has sent a letter — arriving within 2 working days` },
  phone_call: { icon: 'call', titleFn: (n) => `${n.from_name} will be calling you soon` },
  app_push: { icon: 'notifications', titleFn: (n) => `New notification from ${n.from_name}` },
  gp_consultation: { icon: 'medical_services', titleFn: (n) => `GP consultation booked by ${n.from_name}` },
};

function getDaysOverdue(lastFillDate, daysSupply) {
  const runOut = new Date(lastFillDate);
  runOut.setDate(runOut.getDate() + daysSupply);
  return Math.floor((TODAY - runOut) / 86400000);
}

function formatDate(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().split('T')[0]; }
function timeAgo(d) {
  const mins = Math.floor((TODAY - new Date(d)) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(d);
}

function P2ULogo() {
  return (
    <svg style={{ height: 24, width: 'auto' }} viewBox="0 0 480 80" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#00e0bc" y="38" width="33" height="33" rx="2"/>
      <path fill="#00e0bc" d="M15.8,0h15.4c1,0,1.8.8,1.8,1.8v29.4c0,1-0.8,1.8-1.8,1.8H1.8c-1,0-1.8-0.8-1.8-1.8v-15.4C0,7.1,7.1,0,15.8,0Z"/>
      <rect fill="#00e0bc" x="38" width="33" height="33" rx="2"/>
      <path fill="#00e0bc" d="M39.8,38h29.4c1,0,1.8.8,1.8,1.8v15.4c0,8.7-7.1,15.8-15.8,15.8h-15.4c-1,0-1.8-0.8-1.8-1.8v-29.4c0-1,.8-1.8,1.8-1.8Z"/>
      <text x="82" y="54" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="40" fill="#005c8f">Pharmacy2U</text>
    </svg>
  );
}

function Toast({ message, visible }) {
  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`, opacity: visible ? 1 : 0, background: '#003052', color: '#fff', padding: '10px 20px', borderRadius: 24, fontSize: 14, fontWeight: 600, zIndex: 1000, transition: 'all 300ms ease', pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
      {message}
    </div>
  );
}

// ── Animated banner that slides down from top ───────────────────────
function NewNotifBanner({ notif, onDismiss }) {
  if (!notif) return null;
  const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.app_push;
  return (
    <div style={{
      position: 'fixed', top: 56, left: 0, right: 0, zIndex: 150,
      maxWidth: 480, margin: '0 auto',
      animation: 'slideDown 400ms ease-out',
    }}>
      <div style={{
        margin: '8px 12px', background: '#fff', borderRadius: 16,
        padding: '14px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        borderLeft: '5px solid #f59e0b',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#f59e0b', flexShrink: 0, marginTop: 1 }}>{config.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', lineHeight: 1.4, marginBottom: 2 }}>
            {config.titleFn(notif)}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{notif.message}</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af' }}>close</span>
        </button>
      </div>
    </div>
  );
}

// ── Main PatientApp ─────────────────────────────────────────────────
export default function PatientApp({ user, onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [activeCheckin, setActiveCheckin] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [newBanner, setNewBanner] = useState(null);
  const [expandedDrug, setExpandedDrug] = useState(0);
  const profileRef = useRef(null);
  const prevCountRef = useRef(0);

  const emailKey = user.email.toLowerCase();
  const patientData = PATIENT_DATA[emailKey] || { patient_id: 'P-00000', name: user.name, nhs_number: '', age: null, conditions: [], prescriptions: [] };

  const loadNotifications = useCallback(() => {
    getNotifications().then(data => {
      setNotifications(prev => {
        // Detect new notifications
        if (prev.length > 0 && data.length > prev.length) {
          const newOnes = data.filter(n => !prev.find(p => p.id === n.id));
          if (newOnes.length > 0) {
            setNewBanner(newOnes[0]);
            setTimeout(() => setNewBanner(null), 8000);
          }
        }
        prevCountRef.current = data.length;
        return data;
      });
    }).catch(() => {});
  }, []);

  const loadQuestionnaires = useCallback(() => {
    getQuestionnaires().then(data => setQuestionnaires(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications();
    loadQuestionnaires();
    const pollNotifs = setInterval(loadNotifications, 3000);
    const pollSurveys = setInterval(loadQuestionnaires, 3000);
    return () => { clearInterval(pollNotifs); clearInterval(pollSurveys); };
  }, [loadNotifications, loadQuestionnaires]);

  useEffect(() => {
    const h = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const showToast = (msg) => { setToastMsg(msg); setToastVisible(true); setTimeout(() => setToastVisible(false), 2500); };
  const handleDismiss = async (id) => { try { await markNotificationRead(id); setNotifications(prev => prev.filter(n => n.id !== id)); } catch {} };
  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingQuestionnaires = questionnaires.filter(q => q.status === 'pending');
  const startCheckin = (q) => setActiveCheckin(q);

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', maxWidth: 480, margin: '0 auto', position: 'relative', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, height: 56, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <P2ULogo />
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowProfileMenu(!showProfileMenu)}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#84daff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003052', fontWeight: 700, fontSize: 12 }}>
              {patientData.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
            </div>
          </button>
          {showProfileMenu && (
            <div style={{ position: 'absolute', top: 40, right: 0, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 180, zIndex: 200 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#003052' }}>{patientData.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{user.email}</div>
              </div>
              <button onClick={() => { setShowProfileMenu(false); onLogout(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#dc2626', fontFamily: "'Inter'" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New notification banner (animates from top) */}
      <NewNotifBanner notif={newBanner} onDismiss={() => setNewBanner(null)} />

      {/* Content */}
      <div style={{ paddingTop: 56, paddingBottom: 64, minHeight: '100vh' }}>
        <div style={{ height: 12 }} />

        {/* Patient Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, margin: '0 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#84daff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#003052', fontWeight: 700, fontSize: 18, flexShrink: 0, fontFamily: "'Nunito'" }}>
            {patientData.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 17, color: '#003052' }}>{patientData.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Patient ID: {patientData.patient_id}</div>
            {patientData.nhs_number && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>NHS No: {patientData.nhs_number}</div>}
          </div>
        </div>

        {/* Conditions */}
        {patientData.conditions.length > 0 && (
          <div style={{ margin: '0 16px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {patientData.conditions.map(c => (
              <span key={c} style={{ padding: '3px 10px', borderRadius: 12, background: '#c5ffec', color: '#005c8f', fontSize: 11, fontWeight: 600 }}>{c}</span>
            ))}
          </div>
        )}

        {/* Pending Questionnaire Banners */}
        {pendingQuestionnaires.map(q => (
          <div key={q.id} style={{ background: '#fff', borderRadius: 16, padding: 16, margin: '0 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #00e0bc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#00e0bc' }}>fact_check</span>
              <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 15, color: '#003052' }}>
                7-Day Check-in
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5, marginBottom: 12 }}>
              How is <strong>{q.drug_name}</strong> working for you? Your feedback helps your care team.
            </div>
            <button onClick={() => startCheckin(q)} style={{
              width: '100%', padding: '12px 20px', background: '#00e0bc', color: '#003052',
              border: 'none', borderRadius: 24, fontSize: 14, fontWeight: 700,
              fontFamily: "'Nunito', system-ui, sans-serif", cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
              Start Check-in
            </button>
          </div>
        ))}

        {/* Notifications Banner */}
        {unreadCount > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: '12px 16px', margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#f59e0b' }}>notifications_active</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>You have {unreadCount} new notification{unreadCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Notifications List */}
        {notifications.length > 0 && (
          <div style={{ margin: '0 16px 12px' }}>
            <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 16, color: '#003052', marginBottom: 10 }}>Notifications</div>
            {notifications.map(notif => {
              const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.app_push;
              const isUnread = !notif.read;
              return (
                <div key={notif.id} style={{ background: isUnread ? '#fffbeb' : '#fff', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#f59e0b', marginTop: 1, flexShrink: 0 }}>{config.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isUnread ? 700 : 500, color: '#92400e', marginBottom: 4, lineHeight: 1.4 }}>{config.titleFn(notif)}</div>
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{notif.message}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(notif.created_at)}</span>
                        <button onClick={() => handleDismiss(notif.id)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 16, padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#6b7280', cursor: 'pointer', fontFamily: "'Inter'", display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Prescriptions */}
        <div style={{ margin: '0 16px 12px' }}>
          <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 16, color: '#003052', marginBottom: 10 }}>
            My Prescriptions ({patientData.prescriptions.length})
          </div>

          {patientData.prescriptions.map((rx, i) => {
            const daysOverdue = getDaysOverdue(rx.last_fill_date, rx.days_supply);
            const isOverdue = daysOverdue > 0;
            const isExpanded = expandedDrug === i;
            const steps = ['Prescribed', 'Filled', 'Run out'];
            if (isOverdue) steps.push('Overdue');
            const currentStep = isOverdue ? 3 : 2;

            return (
              <div key={i} style={{ background: '#fff', borderRadius: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', borderLeft: isOverdue ? '4px solid #ef4444' : '4px solid #10b981' }}>
                {/* Header row — always visible, clickable */}
                <button onClick={() => setExpandedDrug(isExpanded ? -1 : i)} style={{
                  display: 'flex', alignItems: 'center', width: '100%', padding: '14px 16px', gap: 12,
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter'",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: isOverdue ? '#ef4444' : '#10b981', flexShrink: 0 }}>medication</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 15, color: '#003052' }}>{rx.drug_name} {rx.drug_dose}</div>
                    <div style={{ fontSize: 12, color: isOverdue ? '#dc2626' : '#059669', fontWeight: 600, marginTop: 2 }}>
                      {isOverdue ? `${daysOverdue} days overdue` : 'On track'}
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#9ca3af', transition: 'transform 200ms', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <span style={{ display: 'inline-block', marginBottom: 12, padding: '2px 8px', borderRadius: 12, background: '#c5ffec', color: '#005c8f', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>NHS Prescription</span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      <InfoRow icon="calendar_today" label="Last filled" value={formatDate(rx.last_fill_date)} />
                      <InfoRow icon="schedule" label="Days supply" value={`${rx.days_supply} days`} />
                      <InfoRow icon="inventory_2" label="Quantity" value={`${rx.quantity} tablets`} />
                      <InfoRow icon="autorenew" label="Prior refills" value={String(rx.refill_count)} />
                      <InfoRow icon="payments" label="Your cost" value={`$${rx.patient_pay.toFixed(2)}`} />
                      <InfoRow icon="receipt_long" label="Total cost" value={`$${rx.total_cost.toFixed(2)}`} />
                    </div>

                    {isOverdue ? (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'patientPulse 1.5s infinite', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', fontFamily: "'Nunito'" }}>{daysOverdue} DAYS OVERDUE</div>
                          <div style={{ fontSize: 12, color: '#991b1b', marginTop: 2 }}>Ran out on {formatDate(addDays(rx.last_fill_date, rx.days_supply))}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#16a34a' }}>check_circle</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>On track — refill due {formatDate(addDays(rx.last_fill_date, rx.days_supply))}</span>
                      </div>
                    )}

                    {/* Progress Tracker */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {steps.map((step, si) => {
                        const isActive = si <= currentStep;
                        const isLast = si === steps.length - 1;
                        const isOD = step === 'Overdue';
                        const dotColor = isOD ? '#ef4444' : (isActive ? '#00e0bc' : '#d1d5db');
                        const textColor = isOD ? '#dc2626' : (isActive ? '#003052' : '#9ca3af');
                        return (
                          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: isActive ? dotColor : '#fff', border: `2px solid ${dotColor}` }} />
                              <div style={{ fontSize: 10, color: textColor, fontWeight: isActive ? 600 : 400, marginTop: 4, whiteSpace: 'nowrap' }}>{step}</div>
                            </div>
                            {!isLast && <div style={{ flex: 1, height: 2, background: si < currentStep ? (steps[si + 1] === 'Overdue' ? '#fca5a5' : '#00e0bc') : '#d1d5db', marginBottom: 18, marginLeft: 4, marginRight: 4 }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Refill Button */}
        <div style={{ margin: '4px 16px 20px' }}>
          <button onClick={() => showToast('Coming soon')} style={{ width: '100%', padding: '14px 24px', background: '#84daff', color: '#003052', border: 'none', borderRadius: 28, fontSize: 16, fontWeight: 700, fontFamily: "'Nunito'", cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>refresh</span>Request Refill
          </button>
        </div>
        <div style={{ height: 16 }} />
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, height: 64, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'stretch', zIndex: 100 }}>
        <NavTab icon="medication" label="Prescriptions" active />
        <NavTab icon="storefront" label="Shop" disabled />
        <NavTab icon="stethoscope" label="Doctor" disabled />
        <NavTab icon="more_horiz" label="More" disabled />
      </div>

      {/* Drug Check-in Overlay */}
      {activeCheckin && (
        <DrugCheckin
          questionnaire={activeCheckin}
          onComplete={() => { setActiveCheckin(null); loadQuestionnaires(); loadNotifications(); }}
          onClose={() => setActiveCheckin(null)}
        />
      )}

      <Toast message={toastMsg} visible={toastVisible} />
      <style>{`
        @keyframes patientPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
        @keyframes slideDown { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#003052' }}>{value}</span>
    </div>
  );
}

function NavTab({ icon, label, active, disabled }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative', paddingTop: 4, opacity: disabled ? 0.35 : 1 }}>
      {active && <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 3, background: '#00e0bc', borderRadius: '0 0 3px 3px' }} />}
      <span className="material-symbols-outlined" style={{ fontSize: 24, color: active ? '#003052' : '#9ca3af' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#003052' : '#9ca3af' }}>{label}</span>
    </div>
  );
}
