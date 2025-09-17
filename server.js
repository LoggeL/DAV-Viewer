import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';
import ICAL from 'ical.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function validateCreds(body) {
  const { serverUrl, username, password } = body || {};
  if (!serverUrl || !username || !password) {
    const err = new Error('serverUrl, username und password sind erforderlich');
    err.status = 400;
    throw err;
  }
}

async function buildClient({ serverUrl, username, password }) {
  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav'
  });
  await client.login();
  return client;
}

// ---- Helpers: ICS <-> JSON ----
function icalToJson(iCalString) {
  try {
    const jcalData = ICAL.parse(iCalString);
    const vcalendar = new ICAL.Component(jcalData);
    const vevent = vcalendar.getFirstSubcomponent('vevent');
    if (!vevent) return null;
    const event = new ICAL.Event(vevent);
    return {
      uid: event.uid,
      summary: event.summary || '',
      description: event.description || '',
      location: event.location || '',
      start: event.startDate ? event.startDate.toJSDate() : null,
      end: event.endDate ? event.endDate.toJSDate() : null,
      allDay: event.startDate ? event.startDate.isDate : false
    };
  } catch (e) {
    return null;
  }
}

function jsonToIcs({ uid, summary, description, location, start, end, allDay }) {
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  vcalendar.updatePropertyWithValue('prodid', '-//CalDAV Webapp//EN');
  vcalendar.updatePropertyWithValue('version', '2.0');

  const vevent = new ICAL.Component('vevent');
  const event = new ICAL.Event(vevent);
  if (uid) event.uid = uid;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (allDay) {
    const icalStart = ICAL.Time.fromJSDate(startDate, false);
    icalStart.isDate = true;
    const icalEnd = ICAL.Time.fromJSDate(endDate, false);
    icalEnd.isDate = true;
    event.startDate = icalStart;
    event.endDate = icalEnd;
  } else {
    const icalStart = ICAL.Time.fromJSDate(startDate, true);
    const icalEnd = ICAL.Time.fromJSDate(endDate, true);
    event.startDate = icalStart;
    event.endDate = icalEnd;
  }

  event.summary = summary || '';
  event.description = description || '';
  event.location = location || '';

  vcalendar.addSubcomponent(vevent);
  return vcalendar.toString();
}

// ---- Routes ----
app.post('/api/list-calendars', async (req, res) => {
  try {
    validateCreds(req.body);
    const { serverUrl, username, password } = req.body;
    const client = await buildClient({ serverUrl, username, password });
    const calendars = await client.fetchCalendars();
    const result = calendars
      .filter(cal => (cal.components || []).includes('VEVENT'))
      .map(cal => ({
        url: cal.url,
        displayName: cal.displayName || cal.url,
        ctag: cal.ctag || null,
        color: cal.color || null
      }));
    res.json({ calendars: result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Fehler' });
  }
});

app.post('/api/list-events', async (req, res) => {
  try {
    validateCreds(req.body);
    const { serverUrl, username, password, calendarUrl, timeMin, timeMax } = req.body;
    if (!calendarUrl) {
      const err = new Error('calendarUrl ist erforderlich');
      err.status = 400;
      throw err;
    }
    const client = await buildClient({ serverUrl, username, password });
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find(c => c.url === calendarUrl);
    if (!calendar) {
      const err = new Error('Kalender nicht gefunden');
      err.status = 404;
      throw err;
    }
    const start = timeMin ? new Date(timeMin) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const end = timeMax ? new Date(timeMax) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 60);

    const results = await client.calendarQuery({
      url: calendar.url,
      timeRange: { start, end },
      expand: false,
      depth: 1
    });

    // results: array of { href, etag, data }
    const events = (results || [])
      .map(obj => {
        const parsed = icalToJson(obj.data);
        if (!parsed) return null;
        return {
          href: obj.href,
          etag: obj.etag || null,
          ...parsed
        };
      })
      .filter(Boolean);

    res.json({ events });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Fehler' });
  }
});

app.post('/api/create-event', async (req, res) => {
  try {
    validateCreds(req.body);
    const { serverUrl, username, password, calendarUrl, event } = req.body;
    if (!calendarUrl || !event) {
      const err = new Error('calendarUrl und event sind erforderlich');
      err.status = 400;
      throw err;
    }
    const client = await buildClient({ serverUrl, username, password });
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find(c => c.url === calendarUrl);
    if (!calendar) {
      const err = new Error('Kalender nicht gefunden');
      err.status = 404;
      throw err;
    }
    const iCalString = jsonToIcs(event);
    const filename = `${event.uid || cryptoRandom()}.ics`;
    const resp = await client.createCalendarObject({ calendar, iCalString, filename });
    res.json({ href: resp?.href, etag: resp?.etag });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Fehler' });
  }
});

app.post('/api/update-event', async (req, res) => {
  try {
    validateCreds(req.body);
    const { serverUrl, username, password, calendarObjectUrl, etag, event } = req.body;
    if (!calendarObjectUrl || !event) {
      const err = new Error('calendarObjectUrl und event sind erforderlich');
      err.status = 400;
      throw err;
    }
    const client = await buildClient({ serverUrl, username, password });
    const iCalString = jsonToIcs(event);
    const resUpdate = await client.updateCalendarObject({
      calendarObject: { url: calendarObjectUrl, etag },
      iCalString
    });
    res.json({ ok: true, etag: resUpdate?.etag });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Fehler' });
  }
});

app.post('/api/delete-event', async (req, res) => {
  try {
    validateCreds(req.body);
    const { serverUrl, username, password, calendarObjectUrl, etag } = req.body;
    if (!calendarObjectUrl) {
      const err = new Error('calendarObjectUrl ist erforderlich');
      err.status = 400;
      throw err;
    }
    const client = await buildClient({ serverUrl, username, password });
    await client.deleteCalendarObject({ url: calendarObjectUrl, etag });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Fehler' });
  }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

function cryptoRandom(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

