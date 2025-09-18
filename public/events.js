import { state, loadCredsFromStorage, ensureDemoFromUrl, saveCredsToStorage, fetchCalendars, api, creds, endOfDay, toInputDate, toInputDateTimeLocal, formatDateTime } from './common.js';

const el = {
  calendarList: document.getElementById('calendarList'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  loadEventsBtn: document.getElementById('loadEventsBtn'),
  eventsTableBody: document.querySelector('#eventsTable tbody'),
  editSection: document.getElementById('editSection'),
  editTitle: document.getElementById('editTitle'),
  eventForm: document.getElementById('eventForm'),
  eventHref: document.getElementById('eventHref'),
  eventEtag: document.getElementById('eventEtag'),
  eventCalendar: document.getElementById('eventCalendar'),
  eventSummary: document.getElementById('eventSummary'),
  eventDescription: document.getElementById('eventDescription'),
  eventLocation: document.getElementById('eventLocation'),
  eventStart: document.getElementById('eventStart'),
  eventEnd: document.getElementById('eventEnd'),
  eventAllDay: document.getElementById('eventAllDay'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  saveEventBtn: document.getElementById('saveEventBtn')
};

window.addEventListener('DOMContentLoaded', init);

async function init() {
  ensureDemoFromUrl();
  if (!loadCredsFromStorage() && state.serverUrl !== 'demo') { location.href = '/index.html'; return; }
  if (!state.calendars || state.calendars.length === 0) {
    try { await fetchCalendars({ demo: state.serverUrl === 'demo' }); } catch (_) {}
  }
  renderCalendars();
  populateCalendarSelect();
  // Prefill date range
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  el.dateFrom.value = toInputDate(from);
  el.dateTo.value = toInputDate(to);
  el.loadEventsBtn.addEventListener('click', loadEvents);
  el.cancelEditBtn.addEventListener('click', () => hideEditor());
  el.eventForm.addEventListener('submit', onSave);
  await loadEvents();
}

function renderCalendars() {
  el.calendarList.innerHTML = '';
  state.calendars.forEach(cal => {
    const row = document.createElement('div');
    row.className = 'calendar-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedCalendarUrls.has(cal.url);
    checkbox.addEventListener('change', async () => {
      if (checkbox.checked) state.selectedCalendarUrls.add(cal.url); else state.selectedCalendarUrls.delete(cal.url);
      saveCredsToStorage();
      await loadEvents();
    });
    const label = document.createElement('span');
    label.textContent = cal.displayName;
    const color = document.createElement('span');
    color.className = 'pill';
    color.style.borderColor = cal.color || 'var(--border)';
    color.style.color = cal.color || 'var(--muted)';
    color.textContent = cal.color || '#';
    const createBtn = document.createElement('button');
    createBtn.textContent = 'Neu';
    createBtn.addEventListener('click', () => showEditor({ calendarUrl: cal.url }));
    row.append(checkbox, label, color, createBtn);
    el.calendarList.appendChild(row);
  });
}

function populateCalendarSelect() {
  el.eventCalendar.innerHTML = '';
  state.calendars.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.url; opt.textContent = cal.displayName;
    el.eventCalendar.appendChild(opt);
  });
}

async function loadEvents() {
  el.eventsTableBody.innerHTML = '';
  const dateFrom = el.dateFrom.value ? new Date(el.dateFrom.value) : null;
  const dateTo = el.dateTo.value ? new Date(el.dateTo.value) : null;
  const rows = [];
  const promises = [...state.selectedCalendarUrls].map(async url => {
    const { events } = await api('/api/list-events', {
      ...(state.serverUrl === 'demo' ? { demo: true } : creds()),
      calendarUrl: url,
      timeMin: dateFrom ? dateFrom.toISOString() : undefined,
      timeMax: dateTo ? endOfDay(dateTo).toISOString() : undefined
    });
    const cal = state.calendars.find(c => c.url === url);
    for (const e of events || []) rows.push({ cal, e });
  });
  await Promise.all(promises);
  rows.sort((a, b) => new Date(a.e.start) - new Date(b.e.start));
  for (const { cal, e } of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cal?.displayName || ''}</td>
      <td>${e.summary || ''}</td>
      <td>${formatDateTime(e.start, e.allDay)}</td>
      <td>${formatDateTime(e.end, e.allDay)}</td>
      <td></td>
    `;
    const actions = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => showEditor({
      href: e.href,
      etag: e.etag,
      calendarUrl: cal.url,
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: e.start,
      end: e.end,
      allDay: e.allDay
    }));
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Löschen';
    delBtn.className = 'danger';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Termin wirklich löschen?')) return;
      try {
        await api('/api/delete-event', { ...(state.serverUrl === 'demo' ? { demo: true } : creds()), calendarObjectUrl: e.href, etag: e.etag });
        await loadEvents();
      } catch (err) {
        alert(err.message || 'Fehler beim Löschen');
      }
    });
    actions.append(editBtn, delBtn);
    tr.lastElementChild.replaceWith(actions);
    el.eventsTableBody.appendChild(tr);
  }
}

function showEditor(evt) {
  el.editSection.hidden = false;
  el.editTitle.textContent = evt?.href ? 'Termin bearbeiten' : 'Neuer Termin';
  el.eventHref.value = evt?.href || '';
  el.eventEtag.value = evt?.etag || '';
  el.eventCalendar.value = evt?.calendarUrl || (state.calendars[0]?.url || '');
  el.eventSummary.value = evt?.summary || '';
  el.eventDescription.value = evt?.description || '';
  el.eventLocation.value = evt?.location || '';
  el.eventAllDay.checked = !!evt?.allDay;
  const start = evt?.start ? new Date(evt.start) : new Date();
  const end = evt?.end ? new Date(evt.end) : new Date(start.getTime() + 60 * 60 * 1000);
  el.eventStart.value = toInputDateTimeLocal(start);
  el.eventEnd.value = toInputDateTimeLocal(end);
}

function hideEditor() { el.editSection.hidden = true; }

async function onSave(e) {
  e.preventDefault();
  el.saveEventBtn.disabled = true;
  try {
    const payload = collectEventForm();
    if (!payload) return;
    if (payload.href) {
      await api('/api/update-event', { ...(state.serverUrl === 'demo' ? { demo: true } : creds()), calendarObjectUrl: payload.href, etag: payload.etag, event: payload.event });
    } else {
      await api('/api/create-event', { ...(state.serverUrl === 'demo' ? { demo: true } : creds()), calendarUrl: payload.calendarUrl, event: payload.event });
    }
    await loadEvents();
    hideEditor();
  } catch (err) {
    alert(err.message || 'Fehler beim Speichern');
  } finally {
    el.saveEventBtn.disabled = false;
  }
}

function collectEventForm() {
  const calendarUrl = el.eventCalendar.value;
  const summary = el.eventSummary.value.trim();
  const description = el.eventDescription.value.trim();
  const location = el.eventLocation.value.trim();
  const allDay = el.eventAllDay.checked;
  const href = el.eventHref.value || undefined;
  const etag = el.eventEtag.value || undefined;
  let start; let end;
  if (allDay) {
    const s = el.eventStart.value; const e = el.eventEnd.value;
    if (!s || !e) { alert('Bitte Start/Ende angeben'); return null; }
    start = new Date(s + 'T00:00:00');
    end = new Date(e + 'T00:00:00');
  } else {
    const s = el.eventStart.value; const e = el.eventEnd.value;
    if (!s || !e) { alert('Bitte Start/Ende angeben'); return null; }
    start = new Date(s); end = new Date(e);
  }
  if (end <= start) { alert('Ende muss nach Start liegen'); return null; }
  const event = { summary, description, location, start: start.toISOString(), end: end.toISOString(), allDay };
  return { calendarUrl, href, etag, event };
}

