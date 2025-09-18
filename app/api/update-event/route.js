import { NextResponse } from 'next/server';
import { isDemo, initDemoEvents, validateCreds, buildClient, demoStore, jsonToIcs, cryptoRandom } from '../../../../lib/server/cal';

export async function POST(request) {
  try {
    const body = await request.json();
    if (isDemo(body)) {
      initDemoEvents();
      const { calendarObjectUrl, event } = body;
      if (!calendarObjectUrl || !event) return NextResponse.json({ error: 'calendarObjectUrl und event sind erforderlich' }, { status: 400 });
      const parts = calendarObjectUrl.split('/');
      const calUrl = parts.slice(0, 3).join('/');
      const list = demoStore.events.get(calUrl) || [];
      const idx = list.findIndex(x => x.href === calendarObjectUrl);
      if (idx === -1) return NextResponse.json({ error: 'Demo-Termin nicht gefunden' }, { status: 404 });
      const old = list[idx];
      const newEtag = `"${cryptoRandom(6)}"`;
      list[idx] = { ...old, summary: event.summary || '', description: event.description || '', location: event.location || '', start: event.start, end: event.end, allDay: !!event.allDay, etag: newEtag };
      demoStore.events.set(calUrl, list);
      return NextResponse.json({ ok: true, etag: newEtag });
    }
    validateCreds(body);
    const { serverUrl, username, password, calendarObjectUrl, etag, event } = body;
    if (!calendarObjectUrl || !event) return NextResponse.json({ error: 'calendarObjectUrl und event sind erforderlich' }, { status: 400 });
    const client = await buildClient({ serverUrl, username, password });
    const iCalString = jsonToIcs(event);
    const resUpdate = await client.updateCalendarObject({ calendarObject: { url: calendarObjectUrl, etag }, iCalString });
    return NextResponse.json({ ok: true, etag: resUpdate?.etag });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Fehler' }, { status: err.status || 500 });
  }
}

