import { useState, useEffect, useRef, useCallback } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../utils/api';

export default function AdminPanel({ onClose, currentUserEmail }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const qrRef = useRef(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data.users || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEsc);
    };
  }, [loadUsers, onClose]);

  useEffect(() => {
    if (newUser && qrRef.current && window.QrCreator) {
      // Clear previous QR code by removing child nodes safely
      while (qrRef.current.firstChild) {
        qrRef.current.removeChild(qrRef.current.firstChild);
      }
      window.QrCreator.render({
        text: newUser.totp_uri,
        radius: 0.4,
        ecLevel: 'M',
        fill: '#003052',
        background: '#fff',
        size: 200,
      }, qrRef.current);
    }
  }, [newUser]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;
    setCreating(true);
    setError('');
    try {
      const result = await createUser({
        name: formName.trim(),
        email: formEmail.trim(),
        organization: formOrg.trim() || undefined,
      });
      setNewUser(result);
      setFormName('');
      setFormEmail('');
      setFormOrg('');
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditOrg(user.organization || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditEmail('');
    setEditOrg('');
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim() || !editEmail.trim()) return;
    setActionLoading(id);
    setError('');
    try {
      await updateUser(id, {
        name: editName.trim(),
        email: editEmail.trim(),
        organization: editOrg.trim() || undefined,
      });
      setEditingId(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;
    setActionLoading(user.id);
    setError('');
    try {
      await deleteUser(user.id);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const copySecret = () => {
    if (newUser?.totp_secret) {
      navigator.clipboard.writeText(newUser.totp_secret);
    }
  };

  const actionBtnStyle = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 'var(--sm)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  };

  return (
    <div className="overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-hdr">
          <div className="panel-hdr-top">
            <div>
              <div className="panel-drug">Manage Users</div>
            </div>
            <button className="panel-close" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="panel-body">
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--sm)', padding: '10px 14px', fontSize: 13, color: 'var(--coral)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* New user creation result */}
          {newUser && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--sm)', padding: 20, marginBottom: 24, textAlign: 'center' }}>
              <h3 style={{ marginBottom: 12, fontSize: 16 }}>User Created Successfully</h3>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div ref={qrRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }} />
              <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--sm)', padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 12 }}>
                {newUser.totp_secret}
              </div>
              <button className="btn btn-s btn-sm" onClick={copySecret}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span> Copy Secret
              </button>
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 12 }}>
                Share this QR code or secret with the user. They will need it to log in.
              </p>
              <button className="btn btn-p btn-sm" style={{ marginTop: 12 }} onClick={() => setNewUser(null)}>
                Done
              </button>
            </div>
          )}

          {/* Add user form */}
          <div className="d-sec">
            <h3>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person_add</span> Add New User
            </h3>
            <form onSubmit={handleCreate}>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label>Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" required />
              </div>
              <div className="fg" style={{ marginBottom: 12 }}>
                <label>Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@pharmacy2u.co.uk" required />
              </div>
              <div className="fg" style={{ marginBottom: 16 }}>
                <label>Organization <span className="opt">(optional)</span></label>
                <input type="text" value={formOrg} onChange={(e) => setFormOrg(e.target.value)} placeholder="e.g. Pharmacy2U" />
              </div>
              <button className="btn btn-p btn-sm" type="submit" disabled={creating}>
                {creating ? (
                  <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span> Create User</>
                )}
              </button>
            </form>
          </div>

          {/* User list */}
          <div className="d-sec">
            <h3>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span> Existing Users
            </h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="rt" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Organization</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      editingId === u.id ? (
                        <tr key={u.id || u.email}>
                          <td>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              style={{ width: '100%', fontSize: 13, padding: '4px 8px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              style={{ width: '100%', fontSize: 13, padding: '4px 8px' }}
                            />
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--pill)',
                              background: u.role === 'admin' ? '#e0e7ff' : 'var(--grey)',
                              color: u.role === 'admin' ? '#3730a3' : '#6b7280',
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <input
                              type="text"
                              value={editOrg}
                              onChange={(e) => setEditOrg(e.target.value)}
                              style={{ width: '100%', fontSize: 13, padding: '4px 8px' }}
                              placeholder="(optional)"
                            />
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              style={{ ...actionBtnStyle, color: '#059669' }}
                              title="Save"
                              onClick={() => handleSaveEdit(u.id)}
                              disabled={actionLoading === u.id}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                            </button>
                            <button
                              style={{ ...actionBtnStyle, color: '#6b7280' }}
                              title="Cancel"
                              onClick={handleCancelEdit}
                              disabled={actionLoading === u.id}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={u.id || u.email}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td>{u.email}</td>
                          <td>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--pill)',
                              background: u.role === 'admin' ? '#e0e7ff' : 'var(--grey)',
                              color: u.role === 'admin' ? '#3730a3' : '#6b7280',
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td>{u.organization || '\u2014'}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              style={{ ...actionBtnStyle, color: '#3b82f6' }}
                              title="Edit user"
                              onClick={() => handleEdit(u)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                            </button>
                            <button
                              style={{
                                ...actionBtnStyle,
                                color: u.email === currentUserEmail ? '#d1d5db' : '#ef4444',
                                cursor: u.email === currentUserEmail ? 'not-allowed' : 'pointer',
                              }}
                              title={u.email === currentUserEmail ? 'Cannot delete yourself' : 'Delete user'}
                              onClick={() => handleDelete(u)}
                              disabled={u.email === currentUserEmail || actionLoading === u.id}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                            </button>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
