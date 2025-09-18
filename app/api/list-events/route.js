import { NextResponse } from 'next/server';
import { isDemo, initDemoEvents, validateCreds, buildClient, demoStore, icalToJson } from '../../../lib/server/cal';

export async function POST(request) {
  try {
    const body = await request.json();
    if (isDemo(body)) {
      initDemoEvents();
      const { calendarUrl, timeMin, timeMax } = body;
      if (!calendarUrl) {
        return NextResponse.json({ error: 'calendarUrl ist erforderlich' }, { status: 400 });
      }
      const start = timeMin ? new Date(timeMin) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
      const end = timeMax ? new Date(timeMax) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 60);
      const items = (demoStore.events.get(calendarUrl) || []).filter(evt => {
        const s = new Date(evt.start);
        return s >= start && s <= end;
      });
      return NextResponse.json({ events: items });
    }
    validateCreds(body);
    const { serverUrl, username, password, calendarUrl, timeMin, timeMax } = body;
    if (!calendarUrl) return NextResponse.json({ error: 'calendarUrl ist erforderlich' }, { status: 400 });
    const client = await buildClient({ serverUrl, username, password });
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find(c => c.url === calendarUrl);
    if (!calendar) return NextResponse.json({ error: 'Kalender nicht gefunden' }, { status: 404 });
    const start = timeMin ? new Date(timeMin) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const end = timeMax ? new Date(timeMax) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 60);
    const results = await client.calendarQuery({ url: calendar.url, timeRange: { start, end }, expand: false, depth: 1 });
    const events = (results || [])
      .map(obj => {
        const parsed = icalToJson(obj.data);
        if (!parsed) return null;
        return { href: obj.href, etag: obj.etag || null, ...parsed };
      })
      .filter(Boolean);
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Fehler' }, { status: err.status || 500 });
  }
}

