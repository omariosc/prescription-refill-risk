export async function fetchAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return null;
  const data = await res.json();
  return data.user || null;
}

export async function login(email, code) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
}

export async function predict(patients) {
  const res = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patients }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Prediction failed');
  }
  return res.body;
}

export function downloadTemplate() {
  const a = document.createElement('a');
  a.href = '/api/template';
  a.download = 'refill_risk_template.csv';
  a.click();
}

export async function searchNdc(query) {
  const res = await fetch('/api/ndc-search?q=' + encodeURIComponent(query));
  if (!res.ok) return [];
  return res.json();
}

export async function getUsers() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(data) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to create user');
  return result;
}

export async function updateUser(id, data) {
  const res = await fetch('/api/admin/users/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to update user');
  return result;
}

export async function deleteUser(id) {
  const res = await fetch('/api/admin/users/' + id, { method: 'DELETE' });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to delete user');
  return result;
}

export async function register(name, email, organization, role = 'patient') {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, organization, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function verifyRegistration(email, code) {
  const res = await fetch('/api/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data;
}

export async function getNotifications() {
  const res = await fetch('/api/patient/notifications');
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationRead(id) {
  await fetch('/api/patient/notifications/read/' + id, { method: 'POST', credentials: 'include' });
}

export async function sendNotification(patientEmail, type, message, extra = {}) {
  const res = await fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_email: patientEmail, type, message, ...extra }),
  });
  if (!res.ok) throw new Error('Failed to send notification');
  return res.json();
}

export async function getQuestionnaires() {
  const res = await fetch('/api/patient/questionnaires');
  if (!res.ok) return [];
  return res.json();
}

export async function submitQuestionnaire(questionnaireId, responses) {
  const res = await fetch('/api/patient/questionnaires/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionnaire_id: questionnaireId, responses }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit');
  return data;
}

export async function getPatientQuestionnaires(patientEmail) {
  const res = await fetch('/api/questionnaires?patient_email=' + encodeURIComponent(patientEmail));
  if (!res.ok) return [];
  return res.json();
}

export async function getClinicianAlerts(since) {
  const res = await fetch('/api/clinician/alerts?since=' + encodeURIComponent(since));
  if (!res.ok) return [];
  return res.json();
}

export async function pollEvents(since) {
  const res = await fetch('/api/events?since=' + encodeURIComponent(since), {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}
