import { useEffect, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Alert, Box, Button, Stack } from '@mui/material'
import { getCredentials, eventsStore, type StoredEvent } from '../storage'
import { CalDavClient } from '../tsdavClient'

function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const creds = getCredentials.sync()

  const client = useMemo(() => {
    if (!creds) return null
    return new CalDavClient({
      serverUrl: creds.serverUrl,
      username: creds.username,
      password: creds.password,
    })
  }, [creds])

  useEffect(() => {
    const run = async () => {
      if (!client) return
      try {
        // show cached first
        const cached: StoredEvent[] = []
        await eventsStore.iterate<StoredEvent, void>((value) => {
          cached.push(value)
        })
        if (cached.length) setEvents(cached)

        const e = await client.listEvents()
        setEvents(e)
        // update cache
        await eventsStore.clear()
        for (const ev of e) await eventsStore.setItem(ev.id, ev)
      } catch (err: any) {
        setError(err?.message || 'Failed to load events')
      }
    }
    run()
  }, [client])

  const onRefresh = async () => {
    if (!client) return
    setError(null)
    const e = await client.listEvents()
    setEvents(e)
    await eventsStore.clear()
    for (const ev of e) await eventsStore.setItem(ev.id, ev)
  }

  return (
    <Box>
      {!creds && <Alert severity="warning">No credentials saved. Go to Login.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={onRefresh}>Refresh</Button>
        <Button variant="outlined" href="/login">Login</Button>
      </Stack>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        height="auto"
      />
    </Box>
  )
}

export default CalendarPage

