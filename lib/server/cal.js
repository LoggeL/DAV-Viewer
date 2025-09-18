import ICAL from 'ical.js';
import { createDAVClient } from 'tsdav';

export const DEMO_MODE = process.env.DEMO === '1' || process.env.DEMO_MODE === '1';

export function isDemo(body) {
  if (DEMO_MODE) return true;
  if (!body) return false;
  if (body.demo === true) return true;
  if (typeof body.serverUrl === 'string' && body.serverUrl.trim().toLowerCase() === 'demo') return true;
  return false;
}

export const demoStore = {
  calendars: [
    { url: 'demo://work', displayName: 'Work', ctag: '1', color: '#3b82f6' },
    { url: 'demo://personal', displayName: 'Personal', ctag: '1', color: '#22c55e' }
  ],
  events: new Map()
};

export function initDemoEvents() {
  if (demoStore.events.size > 0) return;
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0, 0);
  const make = (calUrl, offsetDays, hours = 1, summary = 'Meeting', allDay = false) => {
    const start = new Date(base.getTime() + offsetDays * 86400000);
    const end = new Date(start.getTime() + hours * 3600000);
    const uid = cryptoRandom(10);
    const href = `${calUrl}/evt-${uid}.ics`;
    const etag = `"${cryptoRandom(6)}"`;
    return { href, etag, uid, summary, description: '', location: '', start: start.toISOString(), end: end.toISOString(), allDay };
  };
  demoStore.events.set('demo://work', [
    make('demo://work', -2, 1, 'Sync mit Team'),
    make('demo://work', -1, 2, 'Projekt Kickoff'),
    make('demo://work', 0, 1, '1:1 Check-in'),
    make('demo://work', 1, 1, 'Architektur-Review'),
    make('demo://work', 3, 2, 'Sprint Planung')
  ]);
  demoStore.events.set('demo://personal', [
    make('demo://personal', 0, 0, 'Geburtstag', true),
    make('demo://personal', 2, 1, 'Arzttermin'),
    make('demo://personal', 4, 1, 'Laufen im Park'),
    make('demo://personal', 6, 2, 'Familienessen'),
    make('demo://personal', -3, 1, 'Einkaufen')
  ]);
}

export function validateCreds(body) {
  if (isDemo(body)) return;
  const { serverUrl, username, password } = body || {};
  if (!serverUrl || !username || !password) {
    const err = new Error('serverUrl, username und password sind erforderlich');
    err.status = 400;
    throw err;
  }
}

export async function buildClient({ serverUrl, username, password }) {
  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav'
  });
  await client.login();
  return client;
}

export function icalToJson(iCalString) {
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

export function jsonToIcs({ uid, summary, description, location, start, end, allDay }) {
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

export function cryptoRandom(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

