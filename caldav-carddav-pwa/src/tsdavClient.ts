import { DAVClient } from 'tsdav'
import type { Credentials, StoredContact, StoredEvent } from './storage'

type ClientOpts = Credentials

export class CalDavClient {
  private client: DAVClient

  constructor(opts: ClientOpts) {
    this.client = new DAVClient({
      serverUrl: opts.serverUrl,
      credentials: { username: opts.username, password: opts.password },
      authMethod: 'Basic',
    })
  }

  async listEvents(): Promise<StoredEvent[]> {
    await this.client.login()
    const account = await this.client.createAccount({
      account: {
        accountType: 'caldav',
        serverUrl: this.client.serverUrl,
        credentials: this.client.credentials,
      },
      loadCollections: true,
      loadObjects: true,
    })

    const calendars = account.calendars || []
    const events: StoredEvent[] = []
    for (const calendar of calendars) {
      const objects = calendar.objects || (await this.client.fetchCalendarObjects({ calendar })) || []
      for (const obj of objects) {
        const ics = (obj as any).data || ''
        const title = matchLine(ics, 'SUMMARY') || 'Event'
        const dtStart = matchLine(ics, 'DTSTART')
        const dtEnd = matchLine(ics, 'DTEND')
        if (dtStart) {
          events.push({
            id: obj.url || `${title}-${dtStart}`,
            title,
            start: toISODate(dtStart),
            end: dtEnd ? toISODate(dtEnd) : undefined,
          })
        }
      }
    }
    return events
  }
}

export class CardDavClient {
  private client: DAVClient

  constructor(opts: ClientOpts) {
    this.client = new DAVClient({
      serverUrl: opts.serverUrl,
      credentials: { username: opts.username, password: opts.password },
      authMethod: 'Basic',
    })
  }

  async listContacts(): Promise<StoredContact[]> {
    await this.client.login()
    const account = await this.client.createAccount({
      account: {
        accountType: 'carddav',
        serverUrl: this.client.serverUrl,
        credentials: this.client.credentials,
      },
      loadCollections: true,
      loadObjects: true,
    })
    const books = account.addressBooks || []
    const contacts: StoredContact[] = []
    for (const book of books) {
      const objects = book.objects || []
      for (const obj of objects) {
        const vcf = (obj as any).data || ''
        const fullName = matchLine(vcf, 'FN') || 'Contact'
        const email = matchLine(vcf, 'EMAIL') || undefined
        contacts.push({ id: obj.url || fullName, fullName, email })
      }
    }
    return contacts
  }
}

function matchLine(data: string, key: string): string | null {
  const re = new RegExp(`^${key}[:;].*$`, 'm')
  const m = data.match(re)
  if (!m) return null
  const line = m[0]
  const idx = line.indexOf(':')
  return idx >= 0 ? line.slice(idx + 1).trim() : line.trim()
}

function toISODate(val: string): string {
  // Handles forms like 20250101 or 20250101T090000Z
  if (/^\d{8}$/.test(val)) {
    const y = val.slice(0, 4)
    const m = val.slice(4, 6)
    const d = val.slice(6, 8)
    return `${y}-${m}-${d}`
  }
  if (/^\d{8}T\d{6}Z?$/.test(val)) {
    const y = val.slice(0, 4)
    const m = val.slice(4, 6)
    const d = val.slice(6, 8)
    const hh = val.slice(9, 11)
    const mm = val.slice(11, 13)
    const ss = val.slice(13, 15)
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}${val.endsWith('Z') ? 'Z' : ''}`
  }
  return val
}

