const state = {
  serverUrl: '',
  username: '',
  password: '',
  calendars: [],
  selectedCalendarUrls: new Set(),
  eventsByCal: new Map()
};

const el = {
  connectForm: document.getElementById('connectForm'),
  serverUrl: document.getElementById('serverUrl'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  connectMsg: document.getElementById('connectMsg'),
  calendarSection: document.getElementById('calendarSection'),
  calendarList: document.getElementById('calendarList'),
  dateFrom: document.getElementById('dateFrom'),
  dateTo: document.getElementById('dateTo'),
  loadEventsBtn: document.getElementById('loadEventsBtn'),
  eventsSection: document.getElementById('eventsSection'),
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

// Prefill dates
const today = new Date();
const from = new Date(today.getFullYear(), today.getMonth(), 1);
const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
el.dateFrom.value = toInputDate(from);
el.dateTo.value = toInputDate(to);

el.connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  state.serverUrl = el.serverUrl.value.trim();
  state.username = el.username.value.trim();
  state.password = el.password.value;
  el.connectMsg.textContent = 'Verbinde...';
  el.connectMsg.className = 'msg';
  try {
    const { calendars } = await api('/api/list-calendars', creds());
    state.calendars = calendars;
    state.selectedCalendarUrls = new Set(calendars.map(c => c.url));
    renderCalendars();
    populateCalendarSelect();
    el.calendarSection.hidden = false;
    el.connectMsg.textContent = `${calendars.length} Kalender geladen.`;
    el.connectMsg.className = 'msg ok';
  } catch (err) {
    el.connectMsg.textContent = err.message || 'Fehler bei der Verbindung';
    el.connectMsg.className = 'msg error';
  }
});

el.loadEventsBtn.addEventListener('click', async () => {
  await loadEvents();
});

el.cancelEditBtn.addEventListener('click', () => {
  hideEditor();
});

el.eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = collectEventForm();
  if (!payload) return;
  el.saveEventBtn.disabled = true;
  try {
    if (payload.href) {
      await api('/api/update-event', {
        ...creds(),
        calendarObjectUrl: payload.href,
        etag: payload.etag,
        event: payload.event
      });
    } else {
      await api('/api/create-event', {
        ...creds(),
        calendarUrl: payload.calendarUrl,
        event: payload.event
      });
    }
    await loadEvents();
    hideEditor();
  } catch (err) {
    alert(err.message || 'Fehler beim Speichern');
  } finally {
    el.saveEventBtn.disabled = false;
  }
});

function creds() {
  return { serverUrl: state.serverUrl, username: state.username, password: state.password };
}

async function api(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Fehler');
  return data;
}

function renderCalendars() {
  el.calendarList.innerHTML = '';
  state.calendars.forEach(cal => {
    const row = document.createElement('div');
    row.className = 'calendar-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedCalendarUrls.has(cal.url);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedCalendarUrls.add(cal.url);
      else state.selectedCalendarUrls.delete(cal.url);
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
    opt.value = cal.url;
    opt.textContent = cal.displayName;
    el.eventCalendar.appendChild(opt);
  });
}

async function loadEvents() {
  el.eventsSection.hidden = false;
  el.eventsTableBody.innerHTML = '';
  state.eventsByCal.clear();
  const dateFrom = el.dateFrom.value ? new Date(el.dateFrom.value) : null;
  const dateTo = el.dateTo.value ? new Date(el.dateTo.value) : null;

  const promises = [...state.selectedCalendarUrls].map(async url => {
    const { events } = await api('/api/list-events', {
      ...creds(),
      calendarUrl: url,
      timeMin: dateFrom ? dateFrom.toISOString() : undefined,
      timeMax: dateTo ? endOfDay(dateTo).toISOString() : undefined
    });
    state.eventsByCal.set(url, events);
  });
  await Promise.all(promises);

  const rows = [];
  for (const cal of state.calendars) {
    const events = state.eventsByCal.get(cal.url) || [];
    for (const e of events) {
      rows.push({ cal, e });
    }
  }
  rows.sort((a, b) => new Date(a.e.start) - new Date(b.e.start));

  for (const { cal, e } of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(cal.displayName)}</td>
      <td>${escapeHtml(e.summary || '')}</td>
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
        await api('/api/delete-event', { ...creds(), calendarObjectUrl: e.href, etag: e.etag });
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
  let end = evt?.end ? new Date(evt.end) : new Date(start.getTime() + 60 * 60 * 1000);
  if (el.eventAllDay.checked) {
    // For all day, ensure end >= start + 1 day
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
    el.eventStart.value = toInputDate(s);
    el.eventEnd.value = toInputDate(e);
  } else {
    el.eventStart.value = toInputDateTimeLocal(start);
    el.eventEnd.value = toInputDateTimeLocal(end);
  }
}

function hideEditor() {
  el.editSection.hidden = true;
}

function collectEventForm() {
  const calendarUrl = el.eventCalendar.value;
  const summary = el.eventSummary.value.trim();
  const description = el.eventDescription.value.trim();
  const location = el.eventLocation.value.trim();
  const allDay = el.eventAllDay.checked;
  const href = el.eventHref.value || undefined;
  const etag = el.eventEtag.value || undefined;

  let start;
  let end;
  if (allDay) {
    const s = el.eventStart.value;
    const e = el.eventEnd.value;
    if (!s || !e) { alert('Bitte Start/Ende angeben'); return; }
    start = new Date(s + 'T00:00:00');
    end = new Date(e + 'T00:00:00');
  } else {
    const s = el.eventStart.value;
    const e = el.eventEnd.value;
    if (!s || !e) { alert('Bitte Start/Ende angeben'); return; }
    start = new Date(s);
    end = new Date(e);
  }

  if (end <= start) { alert('Ende muss nach Start liegen'); return; }

  const event = {
    summary,
    description,
    location,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay
  };
  return { calendarUrl, href, etag, event };
}

// ---- Utils ----
function toInputDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function toInputDateTimeLocal(d) {
  const date = toInputDate(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date}T${hh}:${mm}`;
}
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function formatDateTime(val, allDay) {
  if (!val) return '';
  const d = new Date(val);
  if (allDay) return toInputDate(d);
  return `${toInputDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

