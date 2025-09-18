// Shared state and utilities across pages
export const state = {
  serverUrl: '',
  username: '',
  password: '',
  calendars: [],
  selectedCalendarUrls: new Set()
};

const STORAGE_KEY = 'caldavWebappCredsV2';

export function loadCredsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.serverUrl = data.serverUrl || '';
    state.username = data.username || '';
    state.password = data.password || '';
    state.calendars = Array.isArray(data.calendars) ? data.calendars : [];
    state.selectedCalendarUrls = new Set(Array.isArray(data.selectedCalendarUrls) ? data.selectedCalendarUrls : []);
    return true;
  } catch (_) {
    return false;
  }
}

export function saveCredsToStorage() {
  const data = {
    serverUrl: state.serverUrl,
    username: state.username,
    password: state.password,
    calendars: state.calendars,
    selectedCalendarUrls: [...state.selectedCalendarUrls]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function creds() {
  return { serverUrl: state.serverUrl, username: state.username, password: state.password };
}

export async function api(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Fehler');
  return data;
}

export async function fetchCalendars({ demo = false } = {}) {
  const body = demo ? { demo: true } : creds();
  const { calendars } = await api('/api/list-calendars', body);
  state.calendars = calendars || [];
  if (!state.selectedCalendarUrls || state.selectedCalendarUrls.size === 0) {
    state.selectedCalendarUrls = new Set((calendars || []).map(c => c.url));
  }
  saveCredsToStorage();
  return calendars;
}

export function ensureDemoFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    state.serverUrl = 'demo';
    state.username = 'demo';
    state.password = 'demo';
    return true;
  }
  return false;
}

// Date/time utilities
export function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function toInputDateTimeLocal(d) {
  const date = toInputDate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date}T${hh}:${mm}`;
}

export function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

export function formatDateTime(val, allDay) {
  if (!val) return '';
  const d = new Date(val);
  if (allDay) return toInputDate(d);
  return `${toInputDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Aggregate events from all selected calendars within a range
export async function fetchEventsForSelectedCalendars(rangeStart, rangeEnd) {
  const urls = [...state.selectedCalendarUrls];
  const results = await Promise.all(urls.map(async url => {
    const { events } = await api('/api/list-events', {
      ...(state.serverUrl === 'demo' ? { demo: true } : creds()),
      calendarUrl: url,
      timeMin: rangeStart ? new Date(rangeStart).toISOString() : undefined,
      timeMax: rangeEnd ? new Date(rangeEnd).toISOString() : undefined
    });
    return { url, events: events || [] };
  }));
  const merged = [];
  for (const { url, events } of results) {
    const cal = state.calendars.find(c => c.url === url);
    for (const e of events) merged.push({ cal, e });
  }
  return merged;
}

