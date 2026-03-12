import type { Task, CatProgress, LLMConfig } from './types'

// Use Electron file storage (userData directory) when available,
// fallback to localStorage for dev/browser environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = () => (window as any).electronAPI?.storage

// ── Tasks ─────────────────────────────────────────────────────────────
export function loadTasks(): Task[] {
  // Sync fallback from localStorage (for initial render before async load)
  try {
    const s = localStorage.getItem('dailytask-todos')
    if (s) {
      const tasks = JSON.parse(s)
      return tasks.map((t: Task) => ({ ...t, rewarded: t.rewarded ?? false, content: t.content ?? '' }))
    }
  } catch {}
  return []
}

export async function loadTasksAsync(): Promise<Task[]> {
  try {
    const raw = await api()?.load('tasks')
    if (raw) {
      const tasks = JSON.parse(raw)
      return tasks.map((t: Task) => ({ ...t, rewarded: t.rewarded ?? false, content: t.content ?? '' }))
    }
  } catch {}
  return loadTasks() // fallback to localStorage
}

export function saveTasks(tasks: Task[]): void {
  const data = JSON.stringify(tasks)
  // Save to both file and localStorage for redundancy
  api()?.save('tasks', data)
  try { localStorage.setItem('dailytask-todos', data) } catch {}
}

// ── Cat Progress ──────────────────────────────────────────────────────
export function loadCat(): CatProgress | null {
  try {
    const s = localStorage.getItem('dailytask-cat-progress')
    if (s) return JSON.parse(s)
  } catch {}
  return null
}

export async function loadCatAsync(): Promise<CatProgress | null> {
  try {
    const raw = await api()?.load('cat')
    if (raw) return JSON.parse(raw)
  } catch {}
  return loadCat()
}

export function saveCat(progress: CatProgress): void {
  const data = JSON.stringify(progress)
  api()?.save('cat', data)
  try { localStorage.setItem('dailytask-cat-progress', data) } catch {}
}

// ── LLM Config ────────────────────────────────────────────────────────
export async function loadLLMConfig(): Promise<LLMConfig | null> {
  try {
    const raw = await api()?.load('llm-config')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function saveLLMConfig(config: LLMConfig): void {
  api()?.save('llm-config', JSON.stringify(config))
}
