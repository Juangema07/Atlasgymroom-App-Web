const { app, BrowserWindow, shell } = require('electron')

const APP_URL = 'https://juangema07.github.io/Atlasgymroom-App-Web/'
const TRUSTED_HOST = 'juangema07.github.io'

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    title: 'Atlasgymroom · Administración',
    autoHideMenuBar: true,
    backgroundColor: '#101323',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url)
      if (target.protocol !== 'https:' || target.hostname !== TRUSTED_HOST) event.preventDefault()
    } catch { event.preventDefault() }
  })
  win.loadURL(APP_URL)
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
