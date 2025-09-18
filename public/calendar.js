import { state, loadCredsFromStorage, ensureDemoFromUrl, saveCredsToStorage, fetchCalendars, fetchEventsForSelectedCalendars, toInputDateTimeLocal, api, creds } from './common.js';

let calendar;

const el = {
  calendarList: document.getElementById('calendarList'),
  fc: document.getElementById('fullcalendar'),
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
  initFullCalendar();
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
      if (checkbox.checked) state.selectedCalendarUrls.add(cal.url); else state.selectedCalendarUrls.delete(cal.url);
      saveCredsToStorage();
      calendar?.refetchEvents();
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
    opt.value = cal.url; opt.textContent = cal.displayName;
    el.eventCalendar.appendChild(opt);
  });
}

function initFullCalendar() {
  const { Calendar } = window.FullCalendar;
  calendar = new Calendar(el.fc, {
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
    },
    selectable: true,
    selectMirror: true,
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    events: async (info, success, failure) => {
      try {
        const items = await fetchEventsForSelectedCalendars(info.start, info.end);
        const mapped = items.map(({ cal, e }) => ({
          id: e.href,
          title: e.summary || '',
          start: e.start,
          end: e.end,
          allDay: !!e.allDay,
          backgroundColor: cal?.color || undefined,
          borderColor: cal?.color || undefined,
          extendedProps: {
            calUrl: cal?.url,
            etag: e.etag || null,
            description: e.description || '',
            location: e.location || ''
          }
        }));
        success(mapped);
      } catch (err) {
        failure(err);
      }
    },
    dateClick: (info) => {
      const start = info.date;
      if (info.allDay) {
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
        openEditor({ calendarUrl: state.calendars[0]?.url || '', start: start.toISOString(), end: end.toISOString(), allDay: true });
      } else {
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        openEditor({ calendarUrl: state.calendars[0]?.url || '', start: start.toISOString(), end: end.toISOString(), allDay: false });
      }
    },
    eventClick: (info) => {
      const e = info.event;
      openEditor({
        href: e.id,
        etag: e.extendedProps.etag,
        calendarUrl: e.extendedProps.calUrl,
        summary: e.title,
        description: e.extendedProps.description,
        location: e.extendedProps.location,
        start: e.start?.toISOString(),
        end: (e.end || e.start)?.toISOString(),
        allDay: e.allDay
      });
    }
  });
  calendar.render();
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
    await calendar?.refetchEvents();
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

