import { useState, useEffect, useCallback } from 'react';

let _addNotification = null;

export function notify(message, color, icon) {
  if (_addNotification) _addNotification({ message, color, icon, id: Date.now() });
}

export default function NotificationManager() {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((n) => {
    setNotifications((prev) => [...prev, n]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
    }, 5000);
  }, []);

  useEffect(() => {
    _addNotification = addNotification;
    return () => { _addNotification = null; };
  }, [addNotification]);

  const dismiss = (id) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, left: 16, zIndex: 9000,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, pointerEvents: 'none',
    }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 12,
            background: '#fff', border: `2px solid ${n.color || '#10b981'}`,
            boxShadow: '0 8px 24px rgba(0,0,0,.15)',
            fontSize: 13, fontWeight: 500, color: '#001b1c',
            animation: 'slideUp 300ms ease-out',
            fontFamily: "'Inter', sans-serif",
            pointerEvents: 'auto', maxWidth: 400, width: '100%',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 22, color: n.color || '#10b981', flexShrink: 0 }}
          >
            {n.icon || 'check_circle'}
          </span>
          <div style={{ flex: 1, lineHeight: 1.4 }}>{n.message}</div>
          <button
            onClick={() => dismiss(n.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', padding: 2, flexShrink: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
