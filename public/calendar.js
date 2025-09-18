import { state, loadCredsFromStorage, ensureDemoFromUrl, saveCredsToStorage, fetchCalendars, fetchEventsForSelectedCalendars, toInputDate, toInputDateTimeLocal, endOfDay, api, creds, formatDateTime } from './common.js';

// UI state for calendar view
const ui = {
  eventsByCal: new Map(),
  viewMode: 'month', // 'month' | 'week' | 'day' | 'agenda'
  currentDate: new Date()
};

const el = {
  calendarList: document.getElementById('calendarList'),
  calendarView: document.getElementById('calendarView'),
  // Toolbar
  todayBtn: document.getElementById('todayBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  viewMonthBtn: document.getElementById('viewMonthBtn'),
  viewWeekBtn: document.getElementById('viewWeekBtn'),
  viewDayBtn: document.getElementById('viewDayBtn'),
  viewAgendaBtn: document.getElementById('viewAgendaBtn'),
  currentRangeLabel: document.getElementById('currentRangeLabel'),
  // Editor
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
  if (!loadCredsFromStorage() && state.serverUrl !== 'demo') {
    location.href = '/index.html';
    return;
  }
  if (!state.calendars || state.calendars.length === 0) {
    try { await fetchCalendars({ demo: state.serverUrl === 'demo' }); } catch (_) {}
  }
  renderCalendars();
  populateCalendarSelect();
  initToolbar();
  await refreshCalendar();
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
      if (checkbox.checked) state.selectedCalendarUrls.add(cal.url);
      else state.selectedCalendarUrls.delete(cal.url);
      saveCredsToStorage();
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
    createBtn.addEventListener('click', () => openEditor({ calendarUrl: cal.url }));
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

function initToolbar() {
  if (!el.todayBtn) return;
  el.todayBtn.addEventListener('click', async () => {
    ui.currentDate = new Date();
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
  el.viewAgendaBtn.addEventListener('click', async () => {
    setViewMode('agenda');
    await refreshCalendar();
  });
  updateViewSwitchButtons();
  updateToolbarLabel();
}

function setViewMode(mode) {
  ui.viewMode = mode;
  updateViewSwitchButtons();
  updateToolbarLabel();
}

function shiftCurrentDate(delta) {
  const d = new Date(ui.currentDate);
  if (ui.viewMode === 'month') d.setMonth(d.getMonth() + delta);
  else if (ui.viewMode === 'week') d.setDate(d.getDate() + delta * 7);
  else d.setDate(d.getDate() + delta);
  ui.currentDate = d;
  updateToolbarLabel();
}

function updateViewSwitchButtons() {
  const map = {
    month: el.viewMonthBtn,
    week: el.viewWeekBtn,
    day: el.viewDayBtn,
    agenda: el.viewAgendaBtn
  };
  for (const key of Object.keys(map)) {
    map[key].setAttribute('aria-selected', String(key === ui.viewMode));
  }
}

function getVisibleRange() {
  const anchor = new Date(ui.currentDate);
  if (ui.viewMode === 'month') {
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(firstOfMonth);
    const end = new Date(start.getTime() + 41 * 86400000);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (ui.viewMode === 'week') {
    const start = startOfWeek(anchor);
    const end = new Date(start.getTime() + 6 * 86400000);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (ui.viewMode === 'agenda') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const end = new Date(start.getTime() + 29 * 86400000);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function updateToolbarLabel() {
  if (!el.currentRangeLabel) return;
  const { start, end } = getVisibleRange();
  if (ui.viewMode === 'month') {
    el.currentRangeLabel.textContent = formatMonthLabel(ui.currentDate);
  } else if (ui.viewMode === 'week' || ui.viewMode === 'agenda') {
    el.currentRangeLabel.textContent = `${formatDayMonth(start)} – ${formatDayMonth(end)} ${start.getFullYear()}`;
  } else {
    el.currentRangeLabel.textContent = formatLongDate(start);
  }
}

async function refreshCalendar() {
  const { start, end } = getVisibleRange();
  updateToolbarLabel();
  // Fetch events for visible range
  ui.eventsByCal.clear();
  try {
    const items = await fetchEventsForSelectedCalendars(start, end);
    for (const { cal, e } of items) {
      if (!cal) continue;
      if (!ui.eventsByCal.has(cal.url)) ui.eventsByCal.set(cal.url, []);
      ui.eventsByCal.get(cal.url).push(e);
    }
  } catch (_) {}
  await renderCalendarView();
}

async function renderCalendarView() {
  const container = el.calendarView;
  if (!container) return;
  container.innerHTML = '';
  const range = getVisibleRange();
  const ctx = getViewContext();
  if (ui.viewMode === 'month') {
    const mod = await import('/views/month.js');
    mod.render(container, ctx, range);
  } else if (ui.viewMode === 'week') {
    const mod = await import('/views/week.js');
    mod.render(container, ctx, range);
  } else if (ui.viewMode === 'day') {
    const mod = await import('/views/day.js');
    mod.render(container, ctx, range);
  } else if (ui.viewMode === 'agenda') {
    const mod = await import('/views/agenda.js');
    mod.render(container, ctx, range);
  }
}

function getViewContext() {
  return {
    state,
    toInputDate,
    toInputDateTimeLocal,
    endOfDay,
    isSameDate,
    formatWeekdayShort,
    formatTimeLabel,
    formatMonthLabel,
    formatDayMonth,
    formatLongDate,
    startOfWeek,
    minutesFromStartOfDay,
    getHourHeightPx,
    layoutOverlappingEvents,
    getEventsForVisibleCalendars,
    groupEventsByDateKey,
    createEventChip,
    createDayHeader,
    showEditor: openEditor,
    escapeHtml: escapeHtml,
    formatDateTime
  };
}

function getEventsForVisibleCalendars() {
  const items = [];
  for (const cal of state.calendars) {
    if (!state.selectedCalendarUrls.has(cal.url)) continue;
    const events = ui.eventsByCal.get(cal.url) || [];
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
  for (const key of map.keys()) {
    map.get(key).sort((a, b) => new Date(a.e.start) - new Date(b.e.start));
  }
  return map;
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
    openEditor({
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

function createDayHeader(d) {
  const head = document.createElement('div');
  head.className = 'day-head';
  const isToday = isSameDate(d, new Date());
  head.innerHTML = `<span class="dow">${formatWeekdayShort(d)}</span><span class="dom ${isToday ? 'today' : ''}">${d.getDate()}</span>`;
  return head;
}

function layoutOverlappingEvents(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const tracks = [];
  const placed = [];
  for (const ev of sorted) {
    let assignedTrackIndex = -1;
    for (let i = 0; i < tracks.length; i++) {
      const last = tracks[i][tracks[i].length - 1];
      if (last.end <= ev.start) {
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

function openEditor(evt) {
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

function hideEditor() {
  el.editSection.hidden = true;
}

el.cancelEditBtn.addEventListener('click', () => hideEditor());

el.eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.saveEventBtn.disabled = true;
  const payload = collectEventForm();
  if (!payload) { el.saveEventBtn.disabled = false; return; }
  try {
    if (payload.href) {
      await api('/api/update-event', { ...(state.serverUrl === 'demo' ? { demo: true } : creds()), calendarObjectUrl: payload.href, etag: payload.etag, event: payload.event });
    } else {
      await api('/api/create-event', { ...(state.serverUrl === 'demo' ? { demo: true } : creds()), calendarUrl: payload.calendarUrl, event: payload.event });
    }
    await refreshCalendar();
    hideEditor();
  } catch (err) {
    alert(err.message || 'Fehler beim Speichern');
  } finally {
    el.saveEventBtn.disabled = false;
  }
});

function collectEventForm() {
  const calendarUrl = el.eventCalendar.value;
  const summary = el.eventSummary.value.trim();
  const description = el.eventDescription.value.trim();
  const location = el.eventLocation.value.trim();
  const allDay = el.eventAllDay.checked;
  const href = el.eventHref.value || undefined;
  const etag = el.eventEtag.value || undefined;
  const s = el.eventStart.value; const e = el.eventEnd.value;
  if (!s || !e) { alert('Bitte Start/Ende angeben'); return null; }
  const start = new Date(s);
  const end = new Date(e);
  if (end <= start) { alert('Ende muss nach Start liegen'); return null; }
  const event = { summary, description, location, start: start.toISOString(), end: end.toISOString(), allDay };
  return { calendarUrl, href, etag, event };
}
