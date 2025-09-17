import { useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { saveCredentials, getCredentials } from '../storage'

function Login() {
  const existing = getCredentials.sync()
  const [serverUrl, setServerUrl] = useState(existing?.serverUrl || '')
  const [username, setUsername] = useState(existing?.username || '')
  const [password, setPassword] = useState(existing?.password || '')
  const [saved, setSaved] = useState(false)

  const onSave = async () => {
    setSaved(false)
    await saveCredentials({ serverUrl, username, password })
    setSaved(true)
  }

  return (
    <Box maxWidth={480} mx="auto">
      <Typography variant="h5" gutterBottom>Connect to Nextcloud</Typography>
      <Stack spacing={2}>
        <TextField label="Server URL" placeholder="https://your-cloud/remote.php/dav" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} fullWidth />
        <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
        <TextField label="App Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} fullWidth />
        <Button variant="contained" onClick={onSave}>Save</Button>
        {saved && <Alert severity="success">Saved. You can go to Calendar or Contacts.</Alert>}
      </Stack>
    </Box>
  )
}

export default Login

