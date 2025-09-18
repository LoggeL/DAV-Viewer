import { state, loadCredsFromStorage, saveCredsToStorage, fetchCalendars } from './common.js';

const el = {
  connectForm: document.getElementById('connectForm'),
  demoBtn: document.getElementById('demoBtn'),
  demoMsg: document.getElementById('demoMsg'),
  serverUrl: document.getElementById('serverUrl'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  connectMsg: document.getElementById('connectMsg')
};

window.addEventListener('DOMContentLoaded', () => {
  if (loadCredsFromStorage()) {
    el.serverUrl.value = state.serverUrl || '';
    el.username.value = state.username || '';
    el.password.value = state.password || '';
  }
});

el.connectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  state.serverUrl = el.serverUrl.value.trim();
  state.username = el.username.value.trim();
  state.password = el.password.value;
  el.connectMsg.textContent = 'Verbinde...';
  el.connectMsg.className = 'msg';
  try {
    await fetchCalendars();
    saveCredsToStorage();
    location.href = '/calendar.html';
  } catch (err) {
    el.connectMsg.textContent = err.message || 'Fehler bei der Verbindung';
    el.connectMsg.className = 'msg error';
  }
});

el.demoBtn.addEventListener('click', async () => {
  try {
    el.demoMsg.textContent = 'Demo wird geladen...';
    el.demoMsg.className = 'msg';
    state.serverUrl = 'demo';
    state.username = 'demo';
    state.password = 'demo';
    await fetchCalendars({ demo: true });
    saveCredsToStorage();
    location.href = '/calendar.html?demo=1';
  } catch (err) {
    el.demoMsg.textContent = err.message || 'Demo konnte nicht geladen werden';
    el.demoMsg.className = 'msg error';
  }
});

