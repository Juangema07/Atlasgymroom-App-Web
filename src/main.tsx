import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const isLocalNativeShell = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

if (!isLocalNativeShell && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((error) => {
      console.error('No se pudo registrar el service worker', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
