import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'
import './i18n'
import { ThemeProvider } from './context/ThemeContext'

// One-time migration: if user had system-dark forced, reset to light
if (!localStorage.getItem('domrent_theme')) {
  document.documentElement.classList.remove('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
