import { app, BrowserWindow, ipcMain, net, screen, session } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ⚠️ Security: accepting invalid TLS certificates is dangerous.
// This is enabled to support internal/self-signed backends that cannot be changed.
// Consider restricting by hostname/IP or making this a dev-only feature.
app.commandLine.appendSwitch('ignore-certificate-errors')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  // 获取屏幕尺寸
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  // 计算窗口大小，默认为屏幕的 80%
  const windowWidth = Math.floor(screenWidth * 0.6)
  const windowHeight = Math.floor(screenHeight * 0.6)

  win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 600,
    center: true,
    resizable: true,
    autoHideMenuBar: true,

    icon: path.join(process.env.APP_ROOT, 'public', 'lanhu_logo.png'),

    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
    }
  })

  // 加载页面
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // 开发环境下打开开发者工具
    win.webContents.openDevTools()
  } else {
    // 生产环境加载本地文件
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // 监听键盘事件，F12 打开开发者工具
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12') {
      win?.webContents.toggleDevTools()
    }
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  session.defaultSession.setCertificateVerifyProc((_request, callback) => callback(0))

  ipcMain.handle('http-request', async (_event, options) => {
    const method = String(options?.method || 'GET').toUpperCase()
    const url = String(options?.url || '')
    const headers = (options?.headers && typeof options.headers === 'object') ? options.headers : {}
    const body = options?.body ?? null

    if (!url) throw new Error('Missing url')

    return await new Promise((resolve, reject) => {
      const request = net.request({ method, url, session: session.defaultSession })

      for (const [key, value] of Object.entries(headers)) {
        if (value === undefined || value === null) continue
        request.setHeader(key, String(value))
      }

      request.on('response', (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            status: response.statusCode,
            headers: response.headers,
            data: text,
          })
        })
      })

      request.on('error', (error) => reject(error))

      if (body !== null && body !== undefined) request.write(String(body))
      request.end()
    })
  })

  createWindow()
})
