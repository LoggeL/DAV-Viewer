import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { AppBar, Box, CssBaseline, IconButton, Toolbar, Typography } from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ContactsIcon from '@mui/icons-material/Contacts'
import Login from './pages/Login'
import CalendarPage from './pages/CalendarPage'
import ContactsPage from './pages/ContactsPage'

function App() {
  return (
    <BrowserRouter>
      <CssBaseline />
      <AppBar position="static" color="primary">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Nextcloud DAV</Typography>
          <IconButton color="inherit" component={Link} to="/calendar" aria-label="calendar">
            <CalendarMonthIcon />
          </IconButton>
          <IconButton color="inherit" component={Link} to="/contacts" aria-label="contacts">
            <ContactsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
        </Routes>
      </Box>
    </BrowserRouter>
  )
}

export default App
