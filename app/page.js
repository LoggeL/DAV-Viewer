"use client";
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ConnectPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [demoMsg, setDemoMsg] = useState('');

  useEffect(() => {
    const paramsDemo = search?.get('demo');
    if (paramsDemo === '1') {
      handleDemo();
    } else {
      try {
        const raw = localStorage.getItem('caldavWebappCredsV2');
        if (raw) {
          const data = JSON.parse(raw);
          setServerUrl(data.serverUrl || '');
          setUsername(data.username || '');
          setPassword(data.password || '');
        }
      } catch {}
    }
  }, []);

  async function handleConnect(e) {
    e?.preventDefault?.();
    setMsg('Verbinde...');
    try {
      const res = await fetch('/api/list-calendars', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: serverUrl.trim(), username: username.trim(), password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Fehler');
      const payload = { serverUrl: serverUrl.trim(), username: username.trim(), password, calendars: data.calendars || [], selectedCalendarUrls: (data.calendars || []).map(c => c.url) };
      localStorage.setItem('caldavWebappCredsV2', JSON.stringify(payload));
      setMsg(`${data.calendars?.length || 0} Kalender geladen.`);
      router.push('/calendar');
    } catch (err) {
      setMsg(err.message || 'Fehler bei der Verbindung');
    }
  }

  async function handleDemo() {
    setDemoMsg('Demo wird geladen...');
    try {
      const res = await fetch('/api/list-calendars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: true }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Fehler');
      const payload = { serverUrl: 'demo', username: 'demo', password: 'demo', calendars: data.calendars || [], selectedCalendarUrls: (data.calendars || []).map(c => c.url) };
      localStorage.setItem('caldavWebappCredsV2', JSON.stringify(payload));
      setDemoMsg('');
      router.push('/calendar?demo=1');
    } catch (err) {
      setDemoMsg(err.message || 'Demo konnte nicht geladen werden');
    }
  }

  return (
    <section className="card">
      <h2>Verbindung</h2>
      <form onSubmit={handleConnect}>
        <div className="row">
          <button type="button" onClick={handleDemo} title="Frontend im Demo-Modus testen">Demo starten</button>
          <span className="msg">{demoMsg}</span>
        </div>
        <label>
          Server URL
          <input type="url" placeholder="https://example.com/caldav/" required value={serverUrl} onChange={e => setServerUrl(e.target.value)} />
        </label>
        <label>
          Benutzername
          <input type="text" required value={username} onChange={e => setUsername(e.target.value)} />
        </label>
        <label>
          Kennwort
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button type="submit">Kalender laden</button>
      </form>
      <div className="msg">{msg}</div>
    </section>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageInner />
    </Suspense>
  );
}

