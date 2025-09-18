import { NextResponse } from 'next/server';
import { isDemo, initDemoEvents, validateCreds, buildClient, demoStore } from '../../../../lib/server/cal';

export async function POST(request) {
  try {
    const body = await request.json();
    if (isDemo(body)) {
      initDemoEvents();
      const { calendarObjectUrl } = body;
      if (!calendarObjectUrl) return NextResponse.json({ error: 'calendarObjectUrl ist erforderlich' }, { status: 400 });
      const parts = calendarObjectUrl.split('/');
      const calUrl = parts.slice(0, 3).join('/');
      const list = demoStore.events.get(calUrl) || [];
      const idx = list.findIndex(x => x.href === calendarObjectUrl);
      if (idx !== -1) list.splice(idx, 1);
      demoStore.events.set(calUrl, list);
      return NextResponse.json({ ok: true });
    }
    validateCreds(body);
    const { serverUrl, username, password, calendarObjectUrl, etag } = body;
    if (!calendarObjectUrl) return NextResponse.json({ error: 'calendarObjectUrl ist erforderlich' }, { status: 400 });
    const client = await buildClient({ serverUrl, username, password });
    await client.deleteCalendarObject({ url: calendarObjectUrl, etag });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Fehler' }, { status: err.status || 500 });
  }
}

