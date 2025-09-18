"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import * as MonthView from '../../lib/views/month.js';
import * as WeekView from '../../lib/views/week.js';
import * as DayView from '../../lib/views/day.js';
import * as AgendaView from '../../lib/views/agenda.js';

export default function CalendarPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [creds, setCreds] = useState({ serverUrl: '', username: '', password: '' });
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarUrls, setSelectedCalendarUrls] = useState(new Set());
  const [viewMode, setViewMode] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventsByCal, setEventsByCal] = useState(new Map());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorData, setEditorData] = useState(null);
  const calendarViewRef = useRef(null);

  // Load creds/calendars from storage or demo
  useEffect(() => {
    const paramsDemo = search?.get('demo') === '1';
    try {
      const raw = localStorage.getItem('caldavWebappCredsV2');
      if (raw) {
        const data = JSON.parse(raw);
        setCreds({ serverUrl: data.serverUrl || '', username: data.username || '', password: data.password || '' });
        setCalendars(Array.isArray(data.calendars) ? data.calendars : []);
        setSelectedCalendarUrls(new Set(Array.isArray(data.selectedCalendarUrls) ? data.selectedCalendarUrls : []));
      }
      if (!raw && !paramsDemo) {
        router.push('/');
      }
    } catch {
      router.push('/');
    }
  }, []);

  // Persist selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem('caldavWebappCredsV2');
      const data = raw ? JSON.parse(raw) : {};
      data.calendars = calendars;
      data.selectedCalendarUrls = [...selectedCalendarUrls];
      localStorage.setItem('caldavWebappCredsV2', JSON.stringify(data));
    } catch {}
  }, [calendars, selectedCalendarUrls]);

  const api = useCallback(async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Fehler');
    return data;
  }, []);

  const getVisibleRange = useCallback(() => {
    const anchor = new Date(currentDate);
    if (viewMode === 'month') {
      const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const start = startOfWeek(firstOfMonth);
      const end = new Date(start.getTime() + 41 * 86400000);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (viewMode === 'week') {
      const start = startOfWeek(anchor);
      const end = new Date(start.getTime() + 6 * 86400000);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (viewMode === 'agenda') {
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      const end = new Date(start.getTime() + 29 * 86400000);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
    return { start, end };
  }, [currentDate, viewMode]);

  const rangeLabel = useMemo(() => {
    const { start, end } = getVisibleRange();
    if (viewMode === 'month') return formatMonthLabel(currentDate);
    if (viewMode === 'week' || viewMode === 'agenda') return `${formatDayMonth(start)} – ${formatDayMonth(end)} ${start.getFullYear()}`;
    return formatLongDate(start);
  }, [currentDate, viewMode, getVisibleRange]);

  const getEventsForVisibleCalendars = useCallback(() => {
    const items = [];
    for (const cal of calendars) {
      if (!selectedCalendarUrls.has(cal.url)) continue;
      const list = eventsByCal.get(cal.url) || [];
      for (const e of list) items.push({ cal, e });
    }
    return items;
  }, [calendars, selectedCalendarUrls, eventsByCal]);

  const groupEventsByDateKey = useCallback((items) => {
    const map = new Map();
    for (const it of items) {
      const d = new Date(it.e.start);
      const key = toInputDate(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const key of map.keys()) map.get(key).sort((a, b) => new Date(a.e.start) - new Date(b.e.start));
    return map;
  }, []);

  const ctx = useMemo(() => ({
    state: { calendars, selectedCalendarUrls, currentDate },
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
    showEditor: (evt) => openEditor(evt),
    escapeHtml,
    formatDateTime
  }), [calendars, selectedCalendarUrls, currentDate, getEventsForVisibleCalendars, groupEventsByDateKey]);

  const refreshCalendar = useCallback(async () => {
    const { start, end } = getVisibleRange();
    const urls = [...selectedCalendarUrls];
    const results = await Promise.all(urls.map(async (url) => {
      const body = creds.serverUrl === 'demo' ? { demo: true, calendarUrl: url, timeMin: start.toISOString(), timeMax: end.toISOString() } : { serverUrl: creds.serverUrl, username: creds.username, password: creds.password, calendarUrl: url, timeMin: start.toISOString(), timeMax: end.toISOString() };
      const { events } = await api('/api/list-events', body);
      return { url, events: events || [] };
    }));
    const map = new Map();
    for (const { url, events } of results) map.set(url, events);
    setEventsByCal(map);
  }, [selectedCalendarUrls, creds, getVisibleRange, api]);

  // Initial load: fetch calendars if empty, then events
  useEffect(() => {
    (async () => {
      if (!calendars || calendars.length === 0) {
        try {
          const body = creds.serverUrl === 'demo' ? { demo: true } : { serverUrl: creds.serverUrl, username: creds.username, password: creds.password };
          const { calendars: list } = await api('/api/list-calendars', body);
          setCalendars(list || []);
          if (!selectedCalendarUrls || selectedCalendarUrls.size === 0) setSelectedCalendarUrls(new Set((list || []).map(c => c.url)));
        } catch {}
      }
    })();
  }, [creds]);

  useEffect(() => {
    if (calendars.length > 0 && selectedCalendarUrls.size > 0) {
      refreshCalendar();
    }
  }, [calendars, selectedCalendarUrls, viewMode, currentDate]);

  // Render view into container
  useEffect(() => {
    const container = calendarViewRef.current;
    if (!container) return;
    container.innerHTML = '';
    const range = getVisibleRange();
    if (viewMode === 'month') MonthView.render(container, ctx, range);
    else if (viewMode === 'week') WeekView.render(container, ctx, range);
    else if (viewMode === 'day') DayView.render(container, ctx, range);
    else if (viewMode === 'agenda') AgendaView.render(container, ctx, range);
  }, [eventsByCal, viewMode, currentDate, ctx]);

  function updateSelected(url, checked) {
    const next = new Set(selectedCalendarUrls);
    if (checked) next.add(url); else next.delete(url);
    setSelectedCalendarUrls(next);
  }

  function shiftCurrentDate(delta) {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + delta);
    else if (viewMode === 'week') d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCurrentDate(d);
  }

  function openEditor(evt) {
    setEditorData(evt || null);
    setEditorOpen(true);
  }
  function closeEditor() { setEditorOpen(false); setEditorData(null); }

  async function handleSaveEvent(payload) {
    const bodyBase = creds.serverUrl === 'demo' ? { demo: true } : { serverUrl: creds.serverUrl, username: creds.username, password: creds.password };
    try {
      if (payload.href) {
        await api('/api/update-event', { ...bodyBase, calendarObjectUrl: payload.href, etag: payload.etag, event: payload.event });
      } else {
        await api('/api/create-event', { ...bodyBase, calendarUrl: payload.calendarUrl, event: payload.event });
      }
      await refreshCalendar();
      closeEditor();
    } catch (err) {
      alert(err.message || 'Fehler beim Speichern');
    }
  }

  return (
    <>
      <section className="card">
        <h2>Kalender</h2>
        <div className="calendar-list">
          {calendars.map(cal => (
            <div className="calendar-item" key={cal.url}>
              <input type="checkbox" checked={selectedCalendarUrls.has(cal.url)} onChange={e => updateSelected(cal.url, e.target.checked)} />
              <span>{cal.displayName}</span>
              <span className="pill" style={{ borderColor: cal.color || 'var(--border)', color: cal.color || 'var(--muted)' }}>{cal.color || '#'}</span>
              <button onClick={() => openEditor({ calendarUrl: cal.url })}>Neu</button>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="calendar-toolbar" aria-label="Kalender Navigation">
          <div className="left">
            <div className="nav">
              <button onClick={() => shiftCurrentDate(-1)} title="Zurück">◀</button>
              <button onClick={() => shiftCurrentDate(1)} title="Weiter">▶</button>
              <button onClick={() => setCurrentDate(new Date())} title="Heute">Heute</button>
            </div>
            <div className="current-range">{rangeLabel}</div>
          </div>
          <div className="right">
            <div className="view-switch" role="tablist" aria-label="Ansicht wechseln">
              <button role="tab" aria-selected={String(viewMode === 'month')} onClick={() => setViewMode('month')}>Monat</button>
              <button role="tab" aria-selected={String(viewMode === 'week')} onClick={() => setViewMode('week')}>Woche</button>
              <button role="tab" aria-selected={String(viewMode === 'day')} onClick={() => setViewMode('day')}>Tag</button>
              <button role="tab" aria-selected={String(viewMode === 'agenda')} onClick={() => setViewMode('agenda')}>Liste</button>
            </div>
          </div>
        </div>
        <div className="calendar-view" ref={calendarViewRef} aria-live="polite" />
      </section>

      {editorOpen && (
        <EventEditor
          onCancel={closeEditor}
          onSave={handleSaveEvent}
          calendars={calendars}
          initial={editorData}
        />
      )}
    </>
  );

  function createEventChip(cal, e) {
    const chip = document.createElement('button');
    chip.className = 'evt-chip';
    chip.style.borderLeftColor = cal.color || 'var(--accent)';
    chip.title = `${e.summary || ''}`;
    const timeLabel = e.allDay ? 'Ganztägig' : formatTimeLabel(new Date(e.start));
    chip.innerHTML = `<span class="dot" style="background:${cal.color || 'var(--accent)'}"></span><span class="txt">${escapeHtml(timeLabel)} ${escapeHtml(e.summary || '')}</span>`;
    chip.addEventListener('click', (evt) => {
      evt.stopPropagation();
      openEditor({ href: e.href, etag: e.etag, calendarUrl: cal.url, summary: e.summary, description: e.description, location: e.location, start: e.start, end: e.end, allDay: e.allDay });
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
}

function EventEditor({ onCancel, onSave, calendars, initial }) {
  const [href, setHref] = useState(initial?.href || '');
  const [etag, setEtag] = useState(initial?.etag || '');
  const [calendarUrl, setCalendarUrl] = useState(initial?.calendarUrl || (calendars[0]?.url || ''));
  const [summary, setSummary] = useState(initial?.summary || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [location, setLocation] = useState(initial?.location || '');
  const [allDay, setAllDay] = useState(!!initial?.allDay);
  const initStart = initial?.start ? new Date(initial.start) : new Date();
  const initEnd = initial?.end ? new Date(initial.end) : new Date(initStart.getTime() + 60 * 60 * 1000);
  const [start, setStart] = useState(toInputDateTimeLocal(initStart));
  const [end, setEnd] = useState(toInputDateTimeLocal(initEnd));

  function submit(e) {
    e.preventDefault();
    let s = start, e2 = end;
    if (!s || !e2) return alert('Bitte Start/Ende angeben');
    const sd = new Date(s);
    const ed = new Date(e2);
    if (ed <= sd) return alert('Ende muss nach Start liegen');
    const event = { summary: summary.trim(), description: description.trim(), location: location.trim(), start: sd.toISOString(), end: ed.toISOString(), allDay };
    onSave({ calendarUrl, href: href || undefined, etag: etag || undefined, event });
  }

  return (
    <section className="card" id="editSection">
      <h2 id="editTitle">{href ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
      <form onSubmit={submit}>
        <input type="hidden" value={href} onChange={e => setHref(e.target.value)} />
        <input type="hidden" value={etag} onChange={e => setEtag(e.target.value)} />
        <label>
          Kalender
          <select required value={calendarUrl} onChange={e => setCalendarUrl(e.target.value)}>
            {calendars.map(cal => (<option key={cal.url} value={cal.url}>{cal.displayName}</option>))}
          </select>
        </label>
        <label>
          Betreff
          <input type="text" required value={summary} onChange={e => setSummary(e.target.value)} />
        </label>
        <label>
          Beschreibung
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <label>
          Ort
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} />
        </label>
        <div className="row">
          <label>
            Start
            <input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} />
          </label>
          <label>
            Ende
            <input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> Ganztägig
        </label>
        <div className="row right">
          <button type="button" onClick={onCancel}>Abbrechen</button>
          <button type="submit">Speichern</button>
        </div>
      </form>
    </section>
  );
}

// ---- Shared utils (ported) ----
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
function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[s]);
}
function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7;
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
function minutesFromStartOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function getHourHeightPx() { return 48; }
function layoutOverlappingEvents(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const tracks = [];
  const placed = [];
  for (const ev of sorted) {
    let assigned = -1;
    for (let i = 0; i < tracks.length; i++) {
      const last = tracks[i][tracks[i].length - 1];
      if (last.end <= ev.start) { tracks[i].push(ev); assigned = i; break; }
    }
    if (assigned === -1) { tracks.push([ev]); assigned = tracks.length - 1; }
    placed.push({ ...ev, trackIndex: assigned, trackCount: 0 });
  }
  const count = tracks.length || 1; for (const p of placed) p.trackCount = count; return placed;
}
function formatDateTime(val, allDay) {
  if (!val) return '';
  const d = new Date(val);
  if (allDay) return toInputDate(d);
  return `${toInputDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

