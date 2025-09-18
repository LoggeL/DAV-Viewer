import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'CalDAV Webapp',
  description: 'Webanwendung zum Anzeigen und Editieren von CalDAV-Kalendern'
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <header>
          <h1>CalDAV Webapp</h1>
          <nav className="topnav">
            <Link href="/">Verbindung</Link>
            <Link href="/calendar">Kalender</Link>
            <Link href="/events">Termine</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer>
          <small>Hinweis: Viele CalDAV-Server erfordern vertrauenswürdige Zertifikate. CORS wird über den API-Server gelöst.</small>
        </footer>
      </body>
    </html>
  );
}

