import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  send: (channel: string, data: unknown) => {
    const validChannels = ['minimize-window', 'close-window', 'app-quit']
    if (validChannels.includes(channel)) ipcRenderer.send(channel, data)
  },
  storage: {
    load: (key: string): Promise<string | null> => ipcRenderer.invoke('storage:load', key),
    save: (key: string, data: string): Promise<boolean> => ipcRenderer.invoke('storage:save', key, data),
    path: (): Promise<string> => ipcRenderer.invoke('storage:path'),
  },
  browserHistory: {
    read: (startMs: number, endMs: number): Promise<{ url: string; title: string; visit_time_ms: number }[]> =>
      ipcRenderer.invoke('browser-history:read', startMs, endMs),
  },
})

declare global {
  interface Window {
    electronAPI: {
      platform: string
      send: (channel: string, data: unknown) => void
      storage: {
        load: (key: string) => Promise<string | null>
        save: (key: string, data: string) => Promise<boolean>
        path: () => Promise<string>
      }
      browserHistory: {
        read: (startMs: number, endMs: number) => Promise<{ url: string; title: string; visit_time_ms: number }[]>
      }
    }
  }
}
