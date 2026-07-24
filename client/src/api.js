const BASE = '/api/tasks';
const PROJECTS = '/api/projects';

async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export function getTasks({ search, status } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const qs = params.toString();
  return request(qs ? `${BASE}?${qs}` : BASE);
}

export function createTask(data) {
  return request(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateTask(id, data) {
  return request(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteTask(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' });
}

export function getProjects() {
  return request(PROJECTS);
}

export function createProject(name) {
  return request(PROJECTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteProject(id) {
  return request(`${PROJECTS}/${id}`, { method: 'DELETE' });
}
