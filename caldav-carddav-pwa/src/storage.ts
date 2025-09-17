import localforage from 'localforage'

export type Credentials = {
  serverUrl: string
  username: string
  password: string
}

localforage.config({
  name: 'nextcloud-dav-pwa',
  storeName: 'kv',
  description: 'Offline storage for Nextcloud DAV PWA',
})

const CREDENTIALS_KEY = 'credentials'

export const saveCredentials = async (creds: Credentials) => {
  await localforage.setItem(CREDENTIALS_KEY, creds)
}

export const getCredentials = Object.assign(
  async (): Promise<Credentials | null> => {
    const creds = await localforage.getItem<Credentials | null>(CREDENTIALS_KEY)
    return creds || null
  },
  {
    sync: (): Credentials | null => {
      const raw = window.localStorage.getItem(CREDENTIALS_KEY)
      if (!raw) return null
      try {
        return JSON.parse(raw) as Credentials
      } catch {
        return null
      }
    },
  }
)

// Keep a small mirror in localStorage for quick access during initial render.
// This avoids async flash on simple reads like Login default values.
localforage.getItem<Credentials | null>(CREDENTIALS_KEY).then((value) => {
  if (value) {
    window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(value))
  }
})

export type StoredEvent = {
  id: string
  title: string
  start: string
  end?: string
}

export type StoredContact = {
  id: string
  fullName: string
  email?: string
}

export const eventsStore = localforage.createInstance({ name: 'nextcloud-dav-pwa', storeName: 'events' })
export const contactsStore = localforage.createInstance({ name: 'nextcloud-dav-pwa', storeName: 'contacts' })

