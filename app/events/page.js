"use client";
import { useEffect, useMemo, useState } from 'react';

export default function EventsPage() {
  const [creds, setCreds] = useState({ serverUrl: '', username: '', password: '' });
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarUrls, setSelectedCalendarUrls] = useState(new Set());
  const [dateFrom, setDateFrom] = useState(() => toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [rows, setRows] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorData, setEditorData] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('caldavWebappCredsV2');
      if (raw) {
        const data = JSON.parse(raw);
        setCreds({ serverUrl: data.serverUrl || '', username: data.username || '', password: data.password || '' });
        setCalendars(Array.isArray(data.calendars) ? data.calendars : []);
        setSelectedCalendarUrls(new Set(Array.isArray(data.selectedCalendarUrls) ? data.selectedCalendarUrls : []));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('caldavWebappCredsV2');
      const data = raw ? JSON.parse(raw) : {};
      data.calendars = calendars;
      data.selectedCalendarUrls = [...selectedCalendarUrls];
      localStorage.setItem('caldavWebappCredsV2', JSON.stringify(data));
    } catch {}
  }, [calendars, selectedCalendarUrls]);

  async function api(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Fehler');
    return data;
  }

  async function loadEvents() {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const urls = [...selectedCalendarUrls];
    const bodyBase = creds.serverUrl === 'demo' ? { demo: true } : { serverUrl: creds.serverUrl, username: creds.username, password: creds.password };
    const results = await Promise.all(urls.map(async (url) => {
      const { events } = await api('/api/list-events', {
        ...bodyBase,
        calendarUrl: url,
        timeMin: from ? from.toISOString() : undefined,
        timeMax: to ? endOfDay(to).toISOString() : undefined
      });
      return { url, events: events || [] };
    }));
    const rowsTmp = [];
    for (const cal of calendars) {
      const events = (results.find(r => r.url === cal.url)?.events) || [];
      for (const e of events) rowsTmp.push({ cal, e });
    }
    rowsTmp.sort((a, b) => new Date(a.e.start) - new Date(b.e.start));
    setRows(rowsTmp);
  }

  function updateSelected(url, checked) {
    const next = new Set(selectedCalendarUrls);
    if (checked) next.add(url); else next.delete(url);
    setSelectedCalendarUrls(next);
  }

  function openEditor(evt) { setEditorData(evt || null); setEditorOpen(true); }
  function closeEditor() { setEditorOpen(false); setEditorData(null); }

  async function handleSaveEvent(payload) {
    const bodyBase = creds.serverUrl === 'demo' ? { demo: true } : { serverUrl: creds.serverUrl, username: creds.username, password: creds.password };
    try {
      if (payload.href) {
        await api('/api/update-event', { ...bodyBase, calendarObjectUrl: payload.href, etag: payload.etag, event: payload.event });
      } else {
        await api('/api/create-event', { ...bodyBase, calendarUrl: payload.calendarUrl, event: payload.event });
      }
      await loadEvents();
      closeEditor();
    } catch (err) {
      alert(err.message || 'Fehler beim Speichern');
    }
  }

  async function handleDelete(e) {
    if (!confirm('Termin wirklich löschen?')) return;
    const bodyBase = creds.serverUrl === 'demo' ? { demo: true } : { serverUrl: creds.serverUrl, username: creds.username, password: creds.password };
    try {
      await api('/api/delete-event', { ...bodyBase, calendarObjectUrl: e.href, etag: e.etag });
      await loadEvents();
    } catch (err) {
      alert(err.message || 'Fehler beim Löschen');
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
        <div className="row">
          <label>
            Von
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label>
            Bis
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
          <button onClick={loadEvents}>Termine laden</button>
        </div>
      </section>

      <section className="card">
        <h2>Termine</h2>
        <table>
          <thead>
            <tr>
              <th>Kalender</th>
              <th>Betreff</th>
              <th>Start</th>
              <th>Ende</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cal, e }) => (
              <tr key={e.href}>
                <td>{cal.displayName}</td>
                <td>{e.summary || ''}</td>
                <td>{formatDateTime(e.start, e.allDay)}</td>
                <td>{formatDateTime(e.end, e.allDay)}</td>
                <td>
                  <button onClick={() => openEditor({ href: e.href, etag: e.etag, calendarUrl: cal.url, summary: e.summary, description: e.description, location: e.location, start: e.start, end: e.end, allDay: e.allDay })}>Bearbeiten</button>
                  <button className="danger" onClick={() => handleDelete(e)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editorOpen && (
        <EventEditor
          onCancel={() => setEditorOpen(false)}
          onSave={handleSaveEvent}
          calendars={calendars}
          initial={editorData}
        />
      )}
    </>
  );
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

// --- Utils ---
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
  const dd = new Date(val);
  if (allDay) return toInputDate(dd);
  return `${toInputDate(dd)} ${String(dd.getHours()).padStart(2, '0')}:${String(dd.getMinutes()).padStart(2, '0')}`;
}

