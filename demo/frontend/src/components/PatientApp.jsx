import { useState, useEffect, useRef, useCallback } from 'react';
import { markNotificationRead, pollEvents } from '../utils/api';
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
    <svg style={{ height: 28, width: 'auto' }} viewBox="0 0 1226.57 302.38" xmlns="http://www.w3.org/2000/svg">
      <rect fill="#00e0bc" y="139.14" width="99.67" height="99.67" rx="5.46"/>
      <path fill="#00e0bc" d="M47.69,0h46.51c3.02,0,5.46,2.45,5.46,5.46v88.74c0,3.02-2.45,5.46-5.46,5.46H5.46c-3.02,0-5.46-2.45-5.46-5.46v-46.51C0,21.37,21.37,0,47.69,0Z"/>
      <rect fill="#00e0bc" x="139.16" width="99.67" height="99.67" rx="5.46"/>
      <path fill="#00e0bc" d="M144.62,139.14h88.74c3.02,0,5.46,2.45,5.46,5.46v46.51c0,26.32-21.37,47.69-47.69,47.69h-46.51c-3.02,0-5.46-2.45-5.46-5.46v-88.74c0-3.02,2.45-5.46,5.46-5.46Z"/>
      <path fill="#005c8f" d="M398.08,276.03v20.61c0,1.76-1.43,3.19-3.19,3.19l-102.56-.02c-1.76,0-3.19-1.42-3.19-3.18,0-7.53,0-16.71,0-19.27,0-1.04.5-2,1.36-2.58,25.12-17.23,67.92-48.06,73.75-62.96,4.37-11.15-3.04-22.92-13.98-26.34-13.47-4.31-28.11,4.14-33.75,16.99-.68,1.54-2.39,2.34-3.98,1.79l-18.96-6.57c-1.74-.6-2.61-2.54-1.91-4.24,4.96-12.02,13.86-22.29,24.8-28.5,26.25-15.6,62.75-4.15,72.93,24.79,8.64,25.26-4.45,44.27-22.93,60.32-8.76,8.16-18.14,15.62-27.72,22.79h56.16c1.76,0,3.19,1.43,3.19,3.19ZM431.16,136.13v-53.96c0-14.66,8.08-22.53,20.4-22.53s19.34,7.86,19.34,22.53v53.96c0,1.77,1.44,3.21,3.21,3.21h22.91c1.77,0,3.21-1.44,3.21-3.21v-60.55c0-27.2-15.94-42.93-37.62-42.93-15.51,0-25.5,7.65-31.45,18.28V3.21c0-1.77-1.44-3.21-3.21-3.21h-22.91c-1.77,0-3.21,1.44-3.21,3.21v132.92c0,1.77,1.44,3.21,3.21,3.21h22.91c1.77,0,3.21-1.44,3.21-3.21ZM1069.89,59.86c10.02,0,17.13,5.81,20.48,9.25,1.24,1.28,3.28,1.29,4.55.03l13.45-13.34c1.15-1.15,1.28-2.97.27-4.24-4.35-5.52-17.13-18.89-40.02-18.89-31.38,0-54.6,23.56-55.02,54.62.42,31.06,23.65,54.62,55.02,54.62,22.88,0,35.65-13.37,40.01-18.89,1.01-1.28.89-3.1-.27-4.25l-13.43-13.32c-1.27-1.26-3.32-1.25-4.56.05-3.31,3.46-10.31,9.22-20.48,9.22-16.83,0-27.53-12.28-28.01-27.24,0-.12,0-.24,0-.36.48-14.95,11.19-27.24,28.01-27.24ZM1000.14,38.4v97.76c0,1.76-1.43,3.19-3.19,3.19h-20.82c-1.72,0-3.12-1.36-3.19-3.07l-.43-11.59c-7.23,10.63-18.49,17.21-34,17.21-29.33,0-49.52-23.59-49.52-54.62s20.19-54.62,49.52-54.62c15.73,0,26.99,6.38,34,17.21l.43-11.59c.06-1.71,1.47-3.07,3.19-3.07h20.82c1.76,0,3.19,1.43,3.19,3.19ZM971.02,87.27c0-16.79-10.84-27.84-26.35-27.84s-26.99,11.26-26.99,27.84,11.48,27.84,26.99,27.84,26.35-11.05,26.35-27.84ZM289.13,136.12V3.22c0-1.78,1.44-3.22,3.22-3.22h44.81c35.28,0,52.28,19.77,52.28,48.24s-17,48.45-52.28,48.45h-14.42c-1.78,0-3.22,1.44-3.22,3.22v36.21c0,1.78-1.44,3.22-3.22,3.22h-23.95c-1.78,0-3.22-1.44-3.22-3.22ZM319.52,66.49c0,1.78,1.44,3.22,3.22,3.22h13.36c12.96,0,24.23-4.46,24.23-21.46s-11.26-21.25-24.23-21.25h-13.36c-1.78,0-3.22,1.44-3.22,3.22v36.28ZM527.7,160.49h-24.03c-1.76,0-3.19,1.43-3.19,3.19v81.39c0,15.65-12.17,28.98-27.81,29.54-16.42.58-29.92-12.56-29.92-28.85v-82.08c0-1.76-1.43-3.19-3.19-3.19h-24.03c-1.76,0-3.19,1.43-3.19,3.19v80.32c0,34.97,20.09,58.39,59.27,58.39s59.27-23.42,59.27-58.39v-80.32c0-1.76-1.43-3.19-3.19-3.19ZM1223.37,35.16h-23.41c-1.35,0-2.55.84-3.01,2.11l-24.77,68.04-24.94-68.05c-.46-1.26-1.66-2.1-3.01-2.1h-23.61c-2.27,0-3.82,2.29-2.97,4.39l38.06,94.95c.31.76.31,1.61,0,2.38l-1.38,3.46c-2.31,5.83-4.66,9.91-7.05,12.23-2.38,2.32-5.67,3.48-9.86,3.48-1.88,0-3.79-.13-5.75-.4-1.23-.17-2.64-.41-4.24-.74-1.69-.34-3.35.72-3.75,2.4l-3.79,15.94c-.4,1.67.59,3.34,2.23,3.83,2.82.83,5.67,1.45,8.57,1.84,3.9.53,7.88.8,11.93.8,6.94,0,12.68-1.23,17.24-3.68,4.55-2.45,8.6-6.36,12.14-11.73,3.54-5.37,7.19-12.43,10.95-21.18l43.36-103.53c.88-2.11-.67-4.44-2.95-4.44ZM704.85,35.64c-1.89-1.46-5.1-2.98-10.24-2.98-12.33,0-18.91,8.29-22.53,19.34l-.88-13.78c-.11-1.69-1.51-3.01-3.21-3.01h-22.03c-1.78,0-3.22,1.44-3.22,3.22v97.7c0,1.78,1.44,3.22,3.22,3.22h22.9c1.78,0,3.22-1.44,3.22-3.22v-52.04c0-14.88,7.65-24.44,22.1-24.44,2.99,0,5.63.46,7.85,1.1,2.03.58,4.05-.99,4.05-3.1v-19.46c0-1-.45-1.94-1.24-2.54ZM840.9,32.66c-16.15,0-26.35,7.86-32.09,18.49-5.74-12.11-16.15-18.49-29.54-18.49-14.24,0-23.59,7.23-29.33,17l-.66-11.42c-.1-1.7-1.51-3.03-3.21-3.03h-22.03c-1.78,0-3.22,1.44-3.22,3.22v97.7c0,1.78,1.44,3.22,3.22,3.22h22.9c1.78,0,3.22-1.44,3.22-3.22v-54.59c0-14.24,6.38-21.89,17.43-21.89s16.58,7.65,16.58,21.89v54.59c0,1.78,1.44,3.22,3.22,3.22h22.89c1.78,0,3.22-1.44,3.22-3.22v-54.59c0-14.24,6.38-21.89,17.43-21.89s16.58,7.65,16.58,21.89v54.59c0,1.78,1.44,3.22,3.22,3.22h22.89c1.78,0,3.22-1.44,3.22-3.22v-60.96c0-27.2-13.6-42.5-35.92-42.5ZM624.61,38.41v97.72c0,1.77-1.44,3.21-3.21,3.21h-20.79c-1.72,0-3.14-1.36-3.2-3.09l-.43-11.58c-7.23,10.63-18.49,17.21-34,17.21-29.33,0-49.52-23.59-49.52-54.62s20.19-54.62,49.52-54.62c15.73,0,26.99,6.38,34,17.21l.43-11.58c.06-1.72,1.48-3.09,3.2-3.09h20.79c1.77,0,3.21,1.44,3.21,3.21ZM595.5,87.27c0-16.79-10.84-27.84-26.35-27.84s-26.99,11.26-26.99,27.84,11.48,27.84,26.99,27.84,26.35-11.05,26.35-27.84Z"/>
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
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      maxWidth: 480, margin: '0 auto',
      animation: 'iosSlideDown 350ms cubic-bezier(0.32, 0.72, 0, 1)',
    }}>
      <div style={{
        margin: '8px 8px 0', background: 'rgba(255,255,255,0.97)', borderRadius: 14,
        padding: '14px 14px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #00e0bc, #00b89c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>{config.icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Pharmacy2U</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.35, marginBottom: 2 }}>
            {config.titleFn(notif)}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{notif.message}</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0, marginTop: -2 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#c7c7cc' }}>close</span>
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
  const knownNotifIds = useRef(new Set());
  const dismissedIds = useRef(new Set());
  const eventCursor = useRef('2026-01-01');
  const initialLoadDone = useRef(false);

  const emailKey = user.email.toLowerCase();
  const patientData = PATIENT_DATA[emailKey] || { patient_id: 'P-00000', name: user.name, nhs_number: '', age: null, conditions: [], prescriptions: [] };

  // Unified 1-second polling via /api/events
  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const data = await pollEvents(eventCursor.current);
        if (!data || !active) return;

        // Update cursor to server time
        if (data.server_time) eventCursor.current = data.server_time;

        // Merge notifications
        if (data.notifications && data.notifications.length > 0) {
          setNotifications(prev => {
            const merged = [...prev];
            for (const n of data.notifications) {
              // Skip dismissed notifications
              if (dismissedIds.current.has(n.id)) continue;
              if (!merged.find(x => x.id === n.id)) {
                merged.unshift(n);
                // Only show banner for notifications arriving AFTER initial load
                if (initialLoadDone.current && !knownNotifIds.current.has(n.id)) {
                  setNewBanner(n);
                  setTimeout(() => setNewBanner(null), 8000);
                }
                knownNotifIds.current.add(n.id);
              }
            }
            return merged;
          });
        }

        // Merge questionnaires
        if (data.questionnaires && data.questionnaires.length > 0) {
          setQuestionnaires(prev => {
            const merged = [...prev];
            for (const q of data.questionnaires) {
              const idx = merged.findIndex(x => x.id === q.id);
              if (idx >= 0) merged[idx] = q;
              else merged.unshift(q);
            }
            return merged;
          });
        }
      } catch { /* ignore network errors */ }

      // After first poll, mark initial load as done so subsequent new items trigger banners
      if (!initialLoadDone.current) initialLoadDone.current = true;
    };

    // Initial load (silent — no banners)
    poll();
    // Slow fallback poll (WebSocket handles real-time; this catches anything missed)
    const interval = setInterval(poll, 5000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // WebSocket for instant push notifications (Durable Objects)
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/api/ws`);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'notification' && msg.data) {
            const n = msg.data;
            setNotifications(prev => {
              if (prev.find(x => x.id === n.id)) return prev;
              if (dismissedIds.current && dismissedIds.current.has(n.id)) return prev;
              if (initialLoadDone.current && !knownNotifIds.current.has(n.id)) {
                setNewBanner(n);
                setTimeout(() => setNewBanner(null), 8000);
              }
              knownNotifIds.current.add(n.id);
              return [n, ...prev];
            });
          }

          if (msg.type === 'questionnaire' && msg.data) {
            const q = msg.data;
            setQuestionnaires(prev => {
              const idx = prev.findIndex(x => x.id === q.id);
              if (idx >= 0) { const updated = [...prev]; updated[idx] = q; return updated; }
              return [q, ...prev];
            });
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        // Reconnect after 2 seconds
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, []);

  useEffect(() => {
    const h = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const showToast = (msg) => { setToastMsg(msg); setToastVisible(true); setTimeout(() => setToastVisible(false), 2500); };
  const handleDismiss = async (id) => { dismissedIds.current.add(id); setNotifications(prev => prev.filter(n => n.id !== id)); try { await markNotificationRead(id); } catch {} };
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
          <div key={q.id} style={{ background: '#fff', borderRadius: 16, padding: 16, margin: '0 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderBottom: '15px solid #00e0bc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#00e0bc' }}>fact_check</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Nunito'", fontWeight: 700, fontSize: 15, color: '#003052' }}>
                  7-Day Check-in
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                  {q.drug_name}
                </div>
              </div>
              {q.due_at && (
                <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  Due {formatDate(q.due_at)}
                </span>
              )}
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
          <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', borderRadius: 16, padding: '12px 16px', margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
                <div key={notif.id} style={{ background: isUnread ? '#fffbeb' : '#fff', borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderBottom: '15px solid #f59e0b' }}>
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
              <div key={i} style={{ background: '#fff', borderRadius: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', borderBottom: isOverdue ? '15px solid #ef4444' : '15px solid #10b981' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>payments</span>
                        <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>Out of Pocket Cost</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#003052' }}>${rx.patient_pay.toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' }}>${rx.total_cost.toFixed(2)}</span>
                      </div>
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
          onComplete={() => { setActiveCheckin(null); /* polling will auto-refresh questionnaires and notifications */ }}
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative', paddingTop: 4, pointerEvents: disabled ? 'none' : 'auto' }}>
      {active && <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 3, background: '#00e0bc', borderRadius: '0 0 3px 3px' }} />}
      <span className="material-symbols-outlined" style={{ fontSize: 24, color: active ? '#003052' : '#9ca3af' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? '#003052' : '#9ca3af' }}>{label}</span>
    </div>
  );
}
