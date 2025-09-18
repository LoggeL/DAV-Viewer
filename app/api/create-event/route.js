import { NextResponse } from 'next/server';
import { isDemo, initDemoEvents, validateCreds, buildClient, demoStore, jsonToIcs, cryptoRandom } from '../../../../lib/server/cal';

export async function POST(request) {
  try {
    const body = await request.json();
    if (isDemo(body)) {
      initDemoEvents();
      const { calendarUrl, event } = body;
      if (!calendarUrl || !event) return NextResponse.json({ error: 'calendarUrl und event sind erforderlich' }, { status: 400 });
      const list = demoStore.events.get(calendarUrl) || [];
      const uid = event.uid || cryptoRandom(10);
      const href = `${calendarUrl}/evt-${uid}.ics`;
      const etag = `"${cryptoRandom(6)}"`;
      const newEvt = { href, etag, uid, summary: event.summary || '', description: event.description || '', location: event.location || '', start: event.start, end: event.end, allDay: !!event.allDay };
      list.push(newEvt);
      demoStore.events.set(calendarUrl, list);
      return NextResponse.json({ href, etag });
    }
    validateCreds(body);
    const { serverUrl, username, password, calendarUrl, event } = body;
    if (!calendarUrl || !event) return NextResponse.json({ error: 'calendarUrl und event sind erforderlich' }, { status: 400 });
    const client = await buildClient({ serverUrl, username, password });
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find(c => c.url === calendarUrl);
    if (!calendar) return NextResponse.json({ error: 'Kalender nicht gefunden' }, { status: 404 });
    const iCalString = jsonToIcs(event);
    const filename = `${event.uid || cryptoRandom()}.ics`;
    const resp = await client.createCalendarObject({ calendar, iCalString, filename });
    return NextResponse.json({ href: resp?.href, etag: resp?.etag });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Fehler' }, { status: err.status || 500 });
  }
}

