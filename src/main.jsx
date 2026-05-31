import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'react-calendar/dist/Calendar.css'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { PreferenciasProvider } from './contexts/PreferenciasContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PreferenciasProvider>
        <App />
      </PreferenciasProvider>
    </AuthProvider>
  </React.StrictMode>,
)
