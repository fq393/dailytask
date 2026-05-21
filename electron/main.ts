import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import os from 'os'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let isQuiting = false
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let lastWindowBounds: Electron.Rectangle | null = null

// ── Persistent file storage (survives app updates) ───────────────────
function getDataPath() {
  const dir = app.getPath('userData')  // ~/Library/Application Support/DailyTask/
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return {
    tasks: path.join(dir, 'tasks.json'),
    cat: path.join(dir, 'cat-progress.json'),
    'llm-config': path.join(dir, 'llm-config.json'),
  }
}

ipcMain.handle('storage:load', (_e, key: string) => {
  try {
    const file = getDataPath()[key as 'tasks' | 'cat' | 'llm-config']
    if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf-8')
  } catch {}
  return null
})

ipcMain.handle('storage:save', (_e, key: string, data: string) => {
  try {
    const file = getDataPath()[key as 'tasks' | 'cat' | 'llm-config']
    if (file) fs.writeFileSync(file, data, 'utf-8')
    return true
  } catch { return false }
})

ipcMain.handle('storage:path', () => app.getPath('userData'))

// Embedded 32x32 black circle PNG (base64) - avoids all file path issues
// 16x16 pixel art cat face template icon
const TRAY_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARElEQVR4nGNgQID/DMQBrOr+k2jAf2wC5GCKDfhPVQOIdRFGWFDNAGwKsbFpFwZE2UYXF5BsACWGoACKNJNqCEFAtEYAIcHCPjrVWDMAAAAASUVORK5CYII='

function createTray() {
  let trayImage = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_BASE64}`)

  // Mark as template image so macOS auto-adapts to light/dark menu bar
  trayImage.setTemplateImage(true)

  console.log('Creating tray, icon isEmpty:', trayImage.isEmpty(), 'size:', trayImage.getSize())

  tray = new Tray(trayImage)
  console.log('Tray created successfully')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 DailyTask',
      click: () => showWindow()
    },
    { type: 'separator' },
    {
      label: '退出 DailyTask',
      click: () => {
        isQuiting = true
        app.quit()
      }
    },
  ])

  tray.setToolTip('DailyTask - 我的待办事项')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => showWindow())
  tray.on('double-click', () => showWindow())
}

function showWindow() {
  // Show dock icon when window is visible
  if (process.platform === 'darwin') {
    app.dock?.show()
  }

  if (mainWindow) {
    if (lastWindowBounds) {
      mainWindow.setBounds(lastWindowBounds)
    }
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}

function hideWindow() {
  if (mainWindow) {
    lastWindowBounds = mainWindow.getBounds()
    mainWindow.hide()
  }
  // Hide dock icon when window is hidden
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 480,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    ...(isMac ? {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 14, y: 8 },
    } : {
      frame: true,
    }),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    // Show dock when app first launches
    if (process.platform === 'darwin') {
      app.dock?.show()
    }
  })

  // Inject mac class so CSS can offset header below titlebar
  mainWindow.webContents.on('dom-ready', () => {
    if (process.platform === 'darwin') {
      mainWindow?.webContents.executeJavaScript('document.body.classList.add("mac")')
    }
  })

  // Intercept close button - hide to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault()
      hideWindow()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : [
          { role: 'close' as const },
        ]),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // Set dock icon to pixel cat
  if (process.platform === 'darwin' && app.dock) {
    const dockIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'public/app-icon.png')
      : path.join(__dirname, '../build/icon.iconset/icon_512x512.png')
    const dockIcon = nativeImage.createFromPath(dockIconPath)
    if (!dockIcon.isEmpty()) app.dock.setIcon(dockIcon)
  }

  createMenu()
  createTray()
  createWindow()

  // activate fires when clicking Dock icon (if visible)
  app.on('activate', () => {
    showWindow()
  })
})

// On macOS, don't quit when all windows are closed (tray keeps running)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  tray?.destroy()
  tray = null
})

// ── Browser History ──────────────────────────────────────────────────

interface HistoryRow { url: string; title: string; visit_time_ms: number }

// Chromium-based browsers store History at Default/History inside their app support dir.
// We probe all known locations; all that exist are read.
const CHROMIUM_PROFILE_CANDIDATES = [
  // Google Chrome (stable / beta / dev / canary)
  'Google/Chrome/Default',
  'Google/Chrome Beta/Default',
  'Google/Chrome Dev/Default',
  'Google/Chrome Canary/Default',
  // Microsoft Edge
  'Microsoft Edge/Default',
  'Microsoft Edge Beta/Default',
  'Microsoft Edge Dev/Default',
  'Microsoft Edge Canary/Default',
  // Brave
  'BraveSoftware/Brave-Browser/Default',
  'BraveSoftware/Brave-Browser-Beta/Default',
  'BraveSoftware/Brave-Browser-Nightly/Default',
  // Arc (The Browser Company)
  'Arc/User Data/Default',
  // Vivaldi
  'Vivaldi/Default',
  // Opera
  'com.operasoftware.Opera/Default',
  // Chromium
  'Chromium/Default',
]

function findChromiumHistoryPaths(): string[] {
  const base = path.join(os.homedir(), 'Library/Application Support')
  return CHROMIUM_PROFILE_CANDIDATES
    .map(p => path.join(base, p, 'History'))
    .filter(p => fs.existsSync(p))
}

function readChromiumHistory(dbPath: string, startMs: number, endMs: number, tmp: string): HistoryRow[] {
  fs.copyFileSync(dbPath, tmp)
  const db = new Database(tmp, { readonly: true, fileMustExist: true })
  // Chrome timestamps: microseconds since 1601-01-01
  const chromeEpochOffsetMs = 11644473600000
  const toChrome = (ms: number) => (ms + chromeEpochOffsetMs) * 1000
  try {
    const rows = db.prepare(`
      SELECT u.url, u.title, v.visit_time
      FROM urls u JOIN visits v ON u.id = v.url
      WHERE v.visit_time >= ? AND v.visit_time < ?
      ORDER BY v.visit_time ASC
    `).all(toChrome(startMs), toChrome(endMs)) as { url: string; title: string; visit_time: number }[]
    return rows.map(r => ({
      url: r.url,
      title: r.title ?? '',
      visit_time_ms: Math.round(r.visit_time / 1000) - chromeEpochOffsetMs,
    }))
  } finally {
    db.close()
  }
}

function readAllChromiumHistory(startMs: number, endMs: number): HistoryRow[] {
  const paths = findChromiumHistoryPaths()
  const all: HistoryRow[] = []
  for (const dbPath of paths) {
    const tmp = path.join(app.getPath('temp'), `chromium-history-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    try {
      all.push(...readChromiumHistory(dbPath, startMs, endMs, tmp))
    } catch (e) {
      console.error(`Chromium history read failed (${dbPath}):`, e)
    } finally {
      try { fs.unlinkSync(tmp) } catch {}
    }
  }
  return all
}

function readSafariHistory(startMs: number, endMs: number): HistoryRow[] {
  const src = path.join(os.homedir(), 'Library/Safari/History.db')
  if (!fs.existsSync(src)) return []

  const tmp = path.join(app.getPath('temp'), `safari-history-${Date.now()}.db`)
  try {
    fs.copyFileSync(src, tmp)
    // Also copy WAL/SHM files if they exist (Safari may use WAL mode)
    for (const ext of ['-wal', '-shm']) {
      const extra = src + ext
      if (fs.existsSync(extra)) fs.copyFileSync(extra, tmp + ext)
    }
    const db = new Database(tmp, { readonly: true, fileMustExist: true })
    const safariEpochOffsetMs = 978307200000
    const toSafari = (ms: number) => (ms - safariEpochOffsetMs) / 1000
    try {
      const rows = db.prepare(`
        SELECT hi.url, hv.title, hv.visit_time
        FROM history_visits hv
        JOIN history_items hi ON hv.history_item = hi.id
        WHERE hv.visit_time >= ? AND hv.visit_time < ?
        ORDER BY hv.visit_time ASC
      `).all(toSafari(startMs), toSafari(endMs)) as { url: string; title: string; visit_time: number }[]
      return rows.map(r => ({
        url: r.url,
        title: r.title ?? '',
        visit_time_ms: r.visit_time * 1000 + safariEpochOffsetMs,
      }))
    } finally {
      db.close()
    }
  } catch (e) {
    console.error('Safari history read failed:', e)
    return []
  } finally {
    try { fs.unlinkSync(tmp) } catch {}
    try { fs.unlinkSync(tmp + '-wal') } catch {}
    try { fs.unlinkSync(tmp + '-shm') } catch {}
  }
}

ipcMain.handle('browser-history:read', (_e, startMs: number, endMs: number) => {
  const chromium = readAllChromiumHistory(startMs, endMs)
  const safari = readSafariHistory(startMs, endMs)
  const all = [...chromium, ...safari]
  all.sort((a, b) => a.visit_time_ms - b.visit_time_ms)
  return all
})

ipcMain.on('app-quit', () => {
  isQuiting = true
  app.quit()
})
