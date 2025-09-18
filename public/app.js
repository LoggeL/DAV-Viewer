const state = {
  serverUrl: '',
  username: '',
  password: '',
  calendars: [],
  selectedCalendarUrls: new Set(),
  eventsByCal: new Map(),
  viewMode: 'month', // 'month' | 'week' | 'day'
  currentDate: new Date()
};

const el = {
  connectForm: document.getElementById('connectForm'),
  demoBtn: document.getElementById('demoBtn'),
  demoMsg: document.getElementById('demoMsg'),
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
  saveEventBtn: document.getElementById('saveEventBtn'),
  // Calendar view UI
  todayBtn: document.getElementById('todayBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  viewMonthBtn: document.getElementById('viewMonthBtn'),
  viewWeekBtn: document.getElementById('viewWeekBtn'),
  viewDayBtn: document.getElementById('viewDayBtn'),
  calendarView: document.getElementById('calendarView'),
  currentRangeLabel: document.getElementById('currentRangeLabel')
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
    await refreshCalendar();
  } catch (err) {
    el.connectMsg.textContent = err.message || 'Fehler bei der Verbindung';
    el.connectMsg.className = 'msg error';
  }
});

// Demo Button
el.demoBtn.addEventListener('click', async () => {
  try {
    el.demoMsg.textContent = 'Demo wird geladen...';
    el.demoMsg.className = 'msg';
    state.serverUrl = 'demo';
    state.username = 'demo';
    state.password = 'demo';
    const { calendars } = await api('/api/list-calendars', { demo: true });
    state.calendars = calendars;
    state.selectedCalendarUrls = new Set(calendars.map(c => c.url));
    renderCalendars();
    populateCalendarSelect();
    el.calendarSection.hidden = false;
    el.connectMsg.textContent = 'Demo-Modus aktiv.';
    el.connectMsg.className = 'msg ok';
    el.demoMsg.textContent = '';
    // Load events for visible range
    await refreshCalendar();
    // Update URL
    const url = new URL(location.href);
    url.searchParams.set('demo', '1');
    history.replaceState(null, '', url.toString());
  } catch (err) {
    el.demoMsg.textContent = err.message || 'Demo konnte nicht geladen werden';
    el.demoMsg.className = 'msg error';
  }
});

el.loadEventsBtn.addEventListener('click', async () => {
  await refreshCalendar();
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

// Auto-demo via query param
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    el.demoBtn.click();
  }
  initCalendarUI();
});

function renderCalendars() {
  el.calendarList.innerHTML = '';
  state.calendars.forEach(cal => {
    const row = document.createElement('div');
    row.className = 'calendar-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedCalendarUrls.has(cal.url);
    checkbox.addEventListener('change', async () => {
      if (checkbox.checked) state.selectedCalendarUrls.add(cal.url);
      else state.selectedCalendarUrls.delete(cal.url);
      await refreshCalendar();
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

// ---- Calendar View (Month/Week/Day) ----
function initCalendarUI() {
  if (!el.todayBtn) return; // in case markup not present
  el.todayBtn.addEventListener('click', async () => {
    state.currentDate = new Date();
    await refreshCalendar();
  });
  el.prevBtn.addEventListener('click', async () => {
    shiftCurrentDate(-1);
    await refreshCalendar();
  });
  el.nextBtn.addEventListener('click', async () => {
    shiftCurrentDate(1);
    await refreshCalendar();
  });
  el.viewMonthBtn.addEventListener('click', async () => {
    setViewMode('month');
    await refreshCalendar();
  });
  el.viewWeekBtn.addEventListener('click', async () => {
    setViewMode('week');
    await refreshCalendar();
  });
  el.viewDayBtn.addEventListener('click', async () => {
    setViewMode('day');
    await refreshCalendar();
  });
  // Initialize labels and selection
  updateViewSwitchButtons();
  updateToolbarLabel();
}

function setViewMode(mode) {
  state.viewMode = mode;
  updateViewSwitchButtons();
  updateToolbarLabel();
}

function shiftCurrentDate(delta) {
  const d = new Date(state.currentDate);
  if (state.viewMode === 'month') {
    d.setMonth(d.getMonth() + delta);
  } else if (state.viewMode === 'week') {
    d.setDate(d.getDate() + delta * 7);
  } else {
    d.setDate(d.getDate() + delta);
  }
  state.currentDate = d;
  updateToolbarLabel();
}

function updateViewSwitchButtons() {
  if (!el.viewMonthBtn) return;
  const map = {
    month: el.viewMonthBtn,
    week: el.viewWeekBtn,
    day: el.viewDayBtn
  };
  for (const key of Object.keys(map)) {
    map[key].setAttribute('aria-selected', String(key === state.viewMode));
  }
}

function getVisibleRange() {
  const anchor = new Date(state.currentDate);
  if (state.viewMode === 'month') {
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(firstOfMonth);
    const end = new Date(start.getTime() + 41 * 86400000); // 6 weeks grid
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (state.viewMode === 'week') {
    const start = startOfWeek(anchor);
    const end = new Date(start.getTime() + 6 * 86400000);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // day
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function updateToolbarLabel() {
  if (!el.currentRangeLabel) return;
  const { start, end } = getVisibleRange();
  if (state.viewMode === 'month') {
    el.currentRangeLabel.textContent = formatMonthLabel(state.currentDate);
  } else if (state.viewMode === 'week') {
    el.currentRangeLabel.textContent = `${formatDayMonth(start)} – ${formatDayMonth(end)} ${start.getFullYear()}`;
  } else {
    el.currentRangeLabel.textContent = formatLongDate(start);
  }
}

async function refreshCalendar() {
  // Sync inputs for backend fetching
  const { start, end } = getVisibleRange();
  el.dateFrom.value = toInputDate(start);
  el.dateTo.value = toInputDate(end);
  updateToolbarLabel();
  // Fetch events using existing function
  await loadEvents();
  // Render calendar view
  renderCalendarView();
}

function renderCalendarView() {
  const container = el.calendarView;
  if (!container) return;
  container.innerHTML = '';
  const range = getVisibleRange();
  if (state.viewMode === 'month') {
    renderMonthView(container, range);
  } else if (state.viewMode === 'week') {
    renderWeekView(container, range);
  } else {
    renderDayView(container, range);
  }
}

function renderMonthView(container, { start }) {
  const month = state.currentDate.getMonth();
  const year = state.currentDate.getFullYear();

  const header = document.createElement('div');
  header.className = 'weekday-header';
  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  for (const wd of weekdays) {
    const cell = document.createElement('div');
    cell.textContent = wd;
    header.appendChild(cell);
  }
  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'month-grid';
  container.appendChild(grid);

  const events = getEventsForVisibleCalendars();
  const eventsByDateKey = groupEventsByDateKey(events);

  for (let i = 0; i < 42; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const isOutside = date.getMonth() !== month;
    const isToday = isSameDate(date, new Date());
    const dateKey = toInputDate(date);

    const cell = document.createElement('div');
    cell.className = 'month-day' + (isOutside ? ' outside' : '') + (isToday ? ' today' : '');
    cell.dataset.date = dateKey;

    const head = document.createElement('div');
    head.className = 'month-date';
    head.textContent = String(date.getDate());
    cell.appendChild(head);

    const list = document.createElement('div');
    list.className = 'month-events';
    const dayEvents = eventsByDateKey.get(dateKey) || [];
    // Limit visible chips to 3 and show +N more
    const maxChips = 4;
    dayEvents.slice(0, maxChips).forEach(({ cal, e }) => {
      const chip = createEventChip(cal, e);
      list.appendChild(chip);
    });
    if (dayEvents.length > maxChips) {
      const more = document.createElement('button');
      more.className = 'more-chip';
      more.textContent = `+${dayEvents.length - maxChips} mehr`;
      more.addEventListener('click', (evt) => {
        evt.stopPropagation();
        showDayEventListModal(dateKey, dayEvents);
      });
      list.appendChild(more);
    }
    cell.appendChild(list);

    cell.addEventListener('click', () => {
      const startTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      showEditor({ calendarUrl: state.calendars[0]?.url || '', start: startTime.toISOString(), end: endTime.toISOString(), allDay: false });
    });

    grid.appendChild(cell);
  }
}

function showDayEventListModal(dateKey, items) {
  // Simple inline modal implementation
  const existing = document.querySelector('.modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal';
  const modalCard = document.createElement('div');
  modalCard.className = 'modal-card';
  const title = document.createElement('div');
  title.className = 'modal-title';
  const d = new Date(dateKey + 'T00:00:00');
  title.textContent = formatLongDate(d);
  const list = document.createElement('div');
  list.className = 'modal-list';
  for (const { cal, e } of items) {
    const row = document.createElement('button');
    row.className = 'modal-row';
    row.innerHTML = `<span class="dot" style="background:${cal.color || 'var(--muted)'}"></span><span>${escapeHtml(e.summary || '')}</span><span class="time">${formatDateTime(e.start, e.allDay)}</span>`;
    row.addEventListener('click', () => {
      showEditor({
        href: e.href,
        etag: e.etag,
        calendarUrl: cal.url,
        summary: e.summary,
        description: e.description,
        location: e.location,
        start: e.start,
        end: e.end,
        allDay: e.allDay
      });
      modal.remove();
    });
    list.appendChild(row);
  }
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = 'Schließen';
  closeBtn.addEventListener('click', () => modal.remove());
  modalCard.append(title, list, closeBtn);
  modal.appendChild(modalCard);
  document.body.appendChild(modal);
}

function createEventChip(cal, e) {
  const chip = document.createElement('button');
  chip.className = 'evt-chip';
  chip.style.borderLeftColor = cal.color || 'var(--accent)';
  chip.title = `${e.summary || ''}`;
  const timeLabel = e.allDay ? 'Ganztägig' : formatTimeLabel(new Date(e.start));
  chip.innerHTML = `<span class="dot" style="background:${cal.color || 'var(--accent)'}"></span><span class="txt">${escapeHtml(timeLabel)} ${escapeHtml(e.summary || '')}</span>`;
  chip.addEventListener('click', (evt) => {
    evt.stopPropagation();
    showEditor({
      href: e.href,
      etag: e.etag,
      calendarUrl: cal.url,
      summary: e.summary,
      description: e.description,
      location: e.location,
      start: e.start,
      end: e.end,
      allDay: e.allDay
    });
  });
  return chip;
}

function renderWeekView(container, { start, end }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'week-grid';

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push(d);
  }

  // All-day row
  const allDayRow = document.createElement('div');
  allDayRow.className = 'allday-row';
  const allDayHeader = document.createElement('div');
  allDayHeader.className = 'time-col allday-label';
  allDayHeader.textContent = 'Ganztägig';
  allDayRow.appendChild(allDayHeader);

  const allDayContainer = document.createElement('div');
  allDayContainer.className = 'allday-cells';
  for (let i = 0; i < 7; i++) {
    const cell = document.createElement('div');
    cell.className = 'allday-cell';
    cell.dataset.date = toInputDate(days[i]);
    cell.appendChild(createDayHeader(days[i]));
    cell.addEventListener('click', () => {
      const date = days[i];
      // Create all-day event for that day
      const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      showEditor({ calendarUrl: state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: true });
    });
    allDayContainer.appendChild(cell);
  }
  allDayRow.appendChild(allDayContainer);
  wrapper.appendChild(allDayRow);

  // Time grid
  const grid = document.createElement('div');
  grid.className = 'time-grid';
  const timeCol = document.createElement('div');
  timeCol.className = 'time-col';
  for (let h = 0; h < 24; h++) {
    const hour = document.createElement('div');
    hour.className = 'hour';
    hour.textContent = String(h).padStart(2, '0') + ':00';
    timeCol.appendChild(hour);
  }
  grid.appendChild(timeCol);

  const daysWrap = document.createElement('div');
  daysWrap.className = 'days-wrap';

  const events = getEventsForVisibleCalendars();
  const eventsByDay = new Map();
  for (const d of days) eventsByDay.set(toInputDate(d), []);
  for (const item of events) {
    const dateKey = toInputDate(new Date(item.e.start));
    if (eventsByDay.has(dateKey)) eventsByDay.get(dateKey).push(item);
  }

  for (let i = 0; i < 7; i++) {
    const dayDate = days[i];
    const dateKey = toInputDate(dayDate);
    const col = document.createElement('div');
    col.className = 'day-col';
    col.dataset.date = dateKey;

    const colInner = document.createElement('div');
    colInner.className = 'day-col-inner';
    col.appendChild(colInner);

    // Click to create event at clicked time
    col.addEventListener('click', (evt) => {
      const bounds = col.getBoundingClientRect();
      const y = evt.clientY - bounds.top;
      const minutes = Math.max(0, Math.min(1439, Math.round((y / bounds.height) * 1440)));
      const snapped = Math.round(minutes / 30) * 30;
      const startDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), Math.floor(snapped / 60), snapped % 60);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      showEditor({ calendarUrl: state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: false });
    });

    const dayEvents = (eventsByDay.get(dateKey) || []);
    const allDayEvents = dayEvents.filter(x => x.e.allDay);
    const timedEvents = dayEvents.filter(x => !x.e.allDay);

    // Render all-day as chips in top row
    const alldayCell = allDayContainer.children[i];
    for (const { cal, e } of allDayEvents) {
      const chip = createEventChip(cal, e);
      alldayCell.appendChild(chip);
    }

    // Layout timed events within day column
    const layouts = layoutOverlappingEvents(timedEvents.map(x => ({
      cal: x.cal,
      e: x.e,
      start: new Date(x.e.start),
      end: new Date(x.e.end)
    })));

    for (const it of layouts) {
      const block = document.createElement('button');
      block.className = 'event-block';
      block.style.borderLeftColor = it.cal.color || 'var(--accent)';
      const top = minutesFromStartOfDay(it.start) / 60 * getHourHeightPx();
      const height = Math.max(20, ((minutesFromStartOfDay(it.end) - minutesFromStartOfDay(it.start)) / 60) * getHourHeightPx());
      const widthPercent = 100 / it.trackCount;
      const leftPercent = widthPercent * it.trackIndex;
      block.style.top = `${top}px`;
      block.style.height = `${height}px`;
      block.style.left = `calc(${leftPercent}% + 2px)`;
      block.style.width = `calc(${widthPercent}% - 4px)`;
      block.innerHTML = `<div class="evt-time">${formatTimeLabel(it.start)}–${formatTimeLabel(it.end)}</div><div class="evt-title">${escapeHtml(it.e.summary || '')}</div>`;
      block.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showEditor({
          href: it.e.href,
          etag: it.e.etag,
          calendarUrl: it.cal.url,
          summary: it.e.summary,
          description: it.e.description,
          location: it.e.location,
          start: it.e.start,
          end: it.e.end,
          allDay: it.e.allDay
        });
      });
      colInner.appendChild(block);
    }

    daysWrap.appendChild(col);
  }

  wrapper.appendChild(grid);
  wrapper.appendChild(daysWrap);
  container.appendChild(wrapper);
}

function renderDayView(container, { start }) {
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  // Header row similar to all-day row
  const alldayRow = document.createElement('div');
  alldayRow.className = 'allday-row';
  const allDayHeader = document.createElement('div');
  allDayHeader.className = 'time-col allday-label';
  allDayHeader.textContent = 'Ganztägig';
  alldayRow.appendChild(allDayHeader);

  const allDayContainer = document.createElement('div');
  allDayContainer.className = 'allday-cells';
  const cell = document.createElement('div');
  cell.className = 'allday-cell';
  cell.dataset.date = toInputDate(day);
  cell.appendChild(createDayHeader(day));
  cell.addEventListener('click', () => {
    const startDate = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const endDate = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    showEditor({ calendarUrl: state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: true });
  });
  allDayContainer.appendChild(cell);
  alldayRow.appendChild(allDayContainer);
  container.appendChild(alldayRow);

  const grid = document.createElement('div');
  grid.className = 'time-grid';
  const timeCol = document.createElement('div');
  timeCol.className = 'time-col';
  for (let h = 0; h < 24; h++) {
    const hour = document.createElement('div');
    hour.className = 'hour';
    hour.textContent = String(h).padStart(2, '0') + ':00';
    timeCol.appendChild(hour);
  }
  grid.appendChild(timeCol);

  const daysWrap = document.createElement('div');
  daysWrap.className = 'days-wrap';
  const col = document.createElement('div');
  col.className = 'day-col';
  col.dataset.date = toInputDate(day);
  const colInner = document.createElement('div');
  colInner.className = 'day-col-inner';
  col.appendChild(colInner);
  col.addEventListener('click', (evt) => {
    const bounds = col.getBoundingClientRect();
    const y = evt.clientY - bounds.top;
    const minutes = Math.max(0, Math.min(1439, Math.round((y / bounds.height) * 1440)));
    const snapped = Math.round(minutes / 30) * 30;
    const startDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(snapped / 60), snapped % 60);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    showEditor({ calendarUrl: state.calendars[0]?.url || '', start: startDate.toISOString(), end: endDate.toISOString(), allDay: false });
  });

  // Events
  const events = getEventsForVisibleCalendars().filter(({ e }) => isSameDate(new Date(e.start), day));
  const allDayEvents = events.filter(x => x.e.allDay);
  const timedEvents = events.filter(x => !x.e.allDay);
  for (const { cal, e } of allDayEvents) {
    const chip = createEventChip(cal, e);
    cell.appendChild(chip);
  }
  const layouts = layoutOverlappingEvents(timedEvents.map(x => ({
    cal: x.cal, e: x.e, start: new Date(x.e.start), end: new Date(x.e.end)
  })));
  for (const it of layouts) {
    const block = document.createElement('button');
    block.className = 'event-block';
    block.style.borderLeftColor = it.cal.color || 'var(--accent)';
    const top = minutesFromStartOfDay(it.start) / 60 * getHourHeightPx();
    const height = Math.max(20, ((minutesFromStartOfDay(it.end) - minutesFromStartOfDay(it.start)) / 60) * getHourHeightPx());
    const widthPercent = 100 / it.trackCount;
    const leftPercent = widthPercent * it.trackIndex;
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.left = `calc(${leftPercent}% + 2px)`;
    block.style.width = `calc(${widthPercent}% - 4px)`;
    block.innerHTML = `<div class=\"evt-time\">${formatTimeLabel(it.start)}–${formatTimeLabel(it.end)}</div><div class=\"evt-title\">${escapeHtml(it.e.summary || '')}</div>`;
    block.addEventListener('click', (ev) => {
      ev.stopPropagation();
      showEditor({
        href: it.e.href,
        etag: it.e.etag,
        calendarUrl: it.cal.url,
        summary: it.e.summary,
        description: it.e.description,
        location: it.e.location,
        start: it.e.start,
        end: it.e.end,
        allDay: it.e.allDay
      });
    });
    colInner.appendChild(block);
  }

  daysWrap.appendChild(col);
  container.appendChild(grid);
  container.appendChild(daysWrap);
}

function createDayHeader(d) {
  const head = document.createElement('div');
  head.className = 'day-head';
  const isToday = isSameDate(d, new Date());
  head.innerHTML = `<span class="dow">${formatWeekdayShort(d)}</span><span class="dom ${isToday ? 'today' : ''}">${d.getDate()}</span>`;
  return head;
}

function getEventsForVisibleCalendars() {
  const items = [];
  for (const cal of state.calendars) {
    if (!state.selectedCalendarUrls.has(cal.url)) continue;
    const events = state.eventsByCal.get(cal.url) || [];
    for (const e of events) items.push({ cal, e });
  }
  return items;
}

function groupEventsByDateKey(items) {
  const map = new Map();
  for (const it of items) {
    const d = new Date(it.e.start);
    const key = toInputDate(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  // Sort within day by start time
  for (const key of map.keys()) {
    map.get(key).sort((a, b) => new Date(a.e.start) - new Date(b.e.start));
  }
  return map;
}

function layoutOverlappingEvents(events) {
  // events: {cal, e, start: Date, end: Date}
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const tracks = [];
  const placed = [];
  for (const ev of sorted) {
    let assignedTrackIndex = -1;
    for (let i = 0; i < tracks.length; i++) {
      const last = tracks[i][tracks[i].length - 1];
      if (last.end <= ev.start) { // no overlap
        tracks[i].push(ev);
        assignedTrackIndex = i;
        break;
      }
    }
    if (assignedTrackIndex === -1) {
      tracks.push([ev]);
      assignedTrackIndex = tracks.length - 1;
    }
    placed.push({ ...ev, trackIndex: assignedTrackIndex, trackCount: 0 });
  }
  const trackCount = tracks.length || 1;
  for (const p of placed) p.trackCount = trackCount;
  return placed;
}

function minutesFromStartOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function getHourHeightPx() {
  return 48; // keep in sync with CSS --hour-height
}

function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7; // 0=Mon
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - day);
  return start;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatWeekdayShort(d) {
  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][(d.getDay() + 6) % 7];
}

function formatTimeLabel(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatMonthLabel(d) {
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDayMonth(d) {
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${d.getDate()}. ${months[d.getMonth()]}`;
}

function formatLongDate(d) {
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${weekdays[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

