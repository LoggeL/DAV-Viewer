import { NextResponse } from 'next/server';
import { isDemo, initDemoEvents, demoStore, validateCreds, buildClient } from '../../../../lib/server/cal';

export async function POST(request) {
  try {
    const body = await request.json();
    if (isDemo(body)) {
      initDemoEvents();
      const result = demoStore.calendars.map(cal => ({ url: cal.url, displayName: cal.displayName, ctag: cal.ctag || null, color: cal.color || null }));
      return NextResponse.json({ calendars: result });
    }
    validateCreds(body);
    const { serverUrl, username, password } = body;
    const client = await buildClient({ serverUrl, username, password });
    const calendars = await client.fetchCalendars();
    const result = calendars
      .filter(cal => (cal.components || []).includes('VEVENT'))
      .map(cal => ({ url: cal.url, displayName: cal.displayName || cal.url, ctag: cal.ctag || null, color: cal.color || null }));
    return NextResponse.json({ calendars: result });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Fehler' }, { status: err.status || 500 });
  }
}

