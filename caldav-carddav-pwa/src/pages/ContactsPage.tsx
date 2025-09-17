import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, List, ListItem, ListItemText, Stack } from '@mui/material'
import { getCredentials, contactsStore, type StoredContact } from '../storage'
import { CardDavClient } from '../tsdavClient'

type Contact = { id: string; fullName: string; email?: string }

function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)
  const creds = getCredentials.sync()

  const client = useMemo(() => {
    if (!creds) return null
    return new CardDavClient({
      serverUrl: creds.serverUrl,
      username: creds.username,
      password: creds.password,
    })
  }, [creds])

  useEffect(() => {
    const run = async () => {
      if (!client) return
      try {
        const cached: StoredContact[] = []
        await contactsStore.iterate<StoredContact, void>((value) => {
          cached.push(value)
        })
        if (cached.length) setContacts(cached)

        const c = await client.listContacts()
        setContacts(c)
        await contactsStore.clear()
        for (const ct of c) await contactsStore.setItem(ct.id, ct)
      } catch (err: any) {
        setError(err?.message || 'Failed to load contacts')
      }
    }
    run()
  }, [client])

  const onRefresh = async () => {
    if (!client) return
    setError(null)
    const c = await client.listContacts()
    setContacts(c)
    await contactsStore.clear()
    for (const ct of c) await contactsStore.setItem(ct.id, ct)
  }

  return (
    <Box>
      {!creds && <Alert severity="warning">No credentials saved. Go to Login.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={onRefresh}>Refresh</Button>
        <Button variant="outlined" href="/login">Login</Button>
      </Stack>
      <List>
        {contacts.map((c) => (
          <ListItem key={c.id} divider>
            <ListItemText primary={c.fullName} secondary={c.email} />
          </ListItem>
        ))}
      </List>
    </Box>
  )
}

export default ContactsPage

