# Feature Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 features to DailyTask: all-tasks history view, live HH:MM:SS clock, IME composition fix, LLM settings drawer, and auto-timer with progress bar.

**Architecture:** All logic stays in the existing monolithic `App.tsx` + `App.css` pattern. Foundation changes (types, storage, electron main) are done first, then UI is added layer by layer. No new component files are created — the codebase pattern favors keeping everything in App.tsx.

**Tech Stack:** Electron 41 + Vite + React 19 + TypeScript. No test framework — use `npx tsc --noEmit` for type validation at each step, and `npm run dev` for visual verification.

**Spec:** `docs/superpowers/specs/2026-03-11-feature-enhancements-design.md`

---

## Chunk 1: Foundation — Types, Storage, Electron Main

### Task 1: Extend Task type and add LLMConfig

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new fields to Task and add LLMConfig interface**

Open `src/types.ts`. Add the three new optional Task fields and the new LLMConfig interface:

```typescript
// Task type definition
export interface Task {
  id: string
  text: string              // title
  content: string           // description / details
  completed: boolean
  rewarded: boolean         // whether exp was already awarded (prevent farming)
  dueDate: string | null
  estimatedMinutes?: number // AI estimated duration
  createdAt: number
  // --- new fields ---
  startedAt?: number        // Unix ms — set at creation (auto-timer start = creation time)
  completedAt?: number      // Unix ms — set when task is marked complete
  actualMinutes?: number    // Math.round((completedAt - startedAt) / 60000); undefined if startedAt absent
}

export type FilterType = 'all' | 'active' | 'completed' | 'today' | 'overdue'

export type CatSize = 'baby' | 'small' | 'medium' | 'large' | 'mega'

export interface CatProgress {
  level: number
  exp: number
  expToNextLevel: number
  size: CatSize
}

// --- new ---
export interface LLMConfig {
  baseURL: string   // e.g. "http://10.26.236.214/v1"
  apiKey: string
  model: string
}

export const STORAGE_KEY = 'dailytask-todos'
export const CAT_STORAGE_KEY = 'dailytask-cat-progress'
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Task timer fields and LLMConfig type"
```

---

### Task 2: Add LLMConfig storage functions

**Files:**
- Modify: `src/storage.ts`

- [ ] **Step 1: Add loadLLMConfig and saveLLMConfig functions**

Append to the bottom of `src/storage.ts` (after `saveCat`):

```typescript
import type { Task, CatProgress, LLMConfig } from './types'

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
```

Note: the import line at the top of `storage.ts` currently reads `import type { Task, CatProgress } from './types'` — update it to include `LLMConfig`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/storage.ts
git commit -m "feat: add LLM config storage functions"
```

---

### Task 3: Add llm-config key to Electron main

**Files:**
- Modify: `electron/main.ts:17-21`

- [ ] **Step 1: Update getDataPath to include llm-config**

In `electron/main.ts`, find the `getDataPath` function (around line 14):

```typescript
function getDataPath() {
  const dir = app.getPath('userData')  // ~/Library/Application Support/DailyTask/
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return {
    tasks: path.join(dir, 'tasks.json'),
    cat: path.join(dir, 'cat-progress.json'),
  }
}
```

Change to:

```typescript
function getDataPath() {
  const dir = app.getPath('userData')  // ~/Library/Application Support/DailyTask/
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return {
    tasks: path.join(dir, 'tasks.json'),
    cat: path.join(dir, 'cat-progress.json'),
    'llm-config': path.join(dir, 'llm-config.json'),
  }
}
```

Also update the IPC handler type casts to allow the new key. Find:

```typescript
ipcMain.handle('storage:load', (_e, key: string) => {
  try {
    const file = getDataPath()[key as 'tasks' | 'cat']
```

Change `key as 'tasks' | 'cat'` to `key as 'tasks' | 'cat' | 'llm-config'` in both `storage:load` and `storage:save` handlers.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add llm-config storage key to electron main"
```

---

## Chunk 2: App Logic — LLM Config, IME Fix, Clock, Timer Logic

### Task 4: Make LLM calls use runtime config + add LLMConfig state

**Files:**
- Modify: `src/App.tsx:9-64` (LLM constants and llmCall function)

- [ ] **Step 1: Update imports at top of App.tsx**

Find the import line:
```typescript
import { loadTasks, loadTasksAsync, saveTasks, loadCat, loadCatAsync, saveCat } from './storage'
```

Change to:
```typescript
import { loadTasks, loadTasksAsync, saveTasks, loadCat, loadCatAsync, saveCat, loadLLMConfig, saveLLMConfig } from './storage'
import type { Task, FilterType, CatProgress, CatSize, LLMConfig } from './types'
```

- [ ] **Step 2: Replace hardcoded LLM constants with a mutable ref approach**

Find the module-level constants (lines 9–11):
```typescript
const LLM_API = 'http://10.26.236.214/v1/chat/completions'
const LLM_KEY = 'gpustack_fc146ee01da0ab5d_56093b1a3a30a431af7d4d799a44b99a'
const LLM_MODEL = 'qwen3-235b-a22b-instruct-2507-fp8'
```

Replace with a config object + getter pattern that App will update:

```typescript
const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseURL: 'http://10.26.236.214/v1',
  apiKey: 'gpustack_fc146ee01da0ab5d_56093b1a3a30a431af7d4d799a44b99a',
  model: 'qwen3-235b-a22b-instruct-2507-fp8',
}

// Mutable runtime config — updated when user saves settings
let _llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG }
export function setActiveLLMConfig(cfg: LLMConfig) { _llmConfig = cfg }
```

- [ ] **Step 3: Update llmCall to use _llmConfig**

Find the `llmCall` function (around line 50):
```typescript
async function llmCall(systemPrompt: string, userText: string, maxTokens = 512): Promise<string> {
  const res = await fetch(LLM_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLM_KEY}` },
    body: JSON.stringify({
      model: LLM_MODEL, seed: null, stop: null,
```

Replace with:
```typescript
async function llmCall(systemPrompt: string, userText: string, maxTokens = 512): Promise<string> {
  const cfg = _llmConfig
  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model, seed: null, stop: null,
```

- [ ] **Step 4: Add useRef import and LLM config load useEffect**

Add `useRef` to the React import at the top:
```typescript
import { useState, useEffect, useRef } from 'react'
```

After the existing `useEffect` blocks (after the `darkMode` effect), add only the LLM config load effect (other state and effects are added in later tasks alongside their consuming code):

```typescript
  // Load LLM config from file on mount
  useEffect(() => {
    loadLLMConfig().then(cfg => {
      if (cfg) {
        setActiveLLMConfig(cfg)
      }
    })
  }, [])
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: LLM runtime config switchable at runtime"
```

---

### Task 5: IME fix + update addTask to set startedAt

**Files:**
- Modify: `src/App.tsx` — `addTask` function and task input JSX

- [ ] **Step 1: Add isComposing ref and update addTask to set startedAt**

In the `App` function, right before `addTask` (after the existing state declarations), add:

```typescript
  const isComposing = useRef(false)
```

Inside `addTask`, find the task object creation:
```typescript
    const t: Task = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      content: '',
      completed: false,
      rewarded: false,
      dueDate: today,
      createdAt: Date.now(),
    }
```

Change to:
```typescript
    const now = Date.now()
    const t: Task = {
      id: now.toString(),
      text: inputValue.trim(),
      content: '',
      completed: false,
      rewarded: false,
      dueDate: today,
      createdAt: now,
      startedAt: now,   // auto-timer: creation = start of work
    }
```

- [ ] **Step 2: Fix IME composition in input onKeyDown**

Find the task input JSX (around line 457):
```tsx
            onKeyDown={e => e.key === 'Enter' && addTask()}
```

Replace with:
```tsx
            onCompositionStart={() => { isComposing.current = true }}
            onCompositionEnd={() => { isComposing.current = false }}
            onKeyDown={e => { if (e.key === 'Enter' && !isComposing.current) addTask() }}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: set startedAt on task creation, fix IME enter key"
```

---

### Task 6: Update toggleTask to record completedAt + actualMinutes

**Files:**
- Modify: `src/App.tsx` — `toggleTask` function

- [ ] **Step 1: Update toggleTask to compute actualMinutes on completion**

Find the `toggleTask` function. The current return for the completing case is:
```typescript
        return { ...task, completed: newCompleted, rewarded: true }
```

Replace with:
```typescript
        const completedAt = Date.now()
        const actualMinutes = task.startedAt
          ? Math.round((completedAt - task.startedAt) / 60000)
          : undefined
        return { ...task, completed: newCompleted, rewarded: true, completedAt, actualMinutes }
```

Also find the non-rewarded completion toggle (the last return):
```typescript
      return { ...task, completed: newCompleted }
```

This handles toggling back to incomplete. Add `completedAt` clearing:
```typescript
      return { ...task, completed: newCompleted, completedAt: newCompleted ? Date.now() : undefined }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: record completedAt and actualMinutes on task completion"
```

---

### Task 7: Update getDailyLoad to new workload formula

**Files:**
- Modify: `src/App.tsx` — `getDailyLoad` function

- [ ] **Step 1: Add progress tick state and its useEffect**

In the `App` function body (before `getDailyLoad`), add:

```typescript
  // Render trigger for progress bar refresh every 30s
  // Prefixed with _ to satisfy noUnusedLocals (value is intentionally unused — only the setter matters)
  const [_progressTick, setProgressTick] = useState(0)
```

After the existing `useEffect` blocks, add:

```typescript
  // Progress bar refresh — triggers re-render every 30 seconds to update elapsed time displays
  useEffect(() => {
    const timer = setInterval(() => setProgressTick(n => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])
```

- [ ] **Step 2: Replace getDailyLoad implementation**

Find the existing `getDailyLoad` function:
```typescript
  const getDailyLoad = () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const todayTasks = tasks.filter(t =>
      !t.completed && (t.dueDate === todayStr || (!t.dueDate && new Date(t.createdAt).toISOString().split('T')[0] === todayStr))
    )
    const totalMins = todayTasks.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0)
    const estimatedCount = todayTasks.filter(t => t.estimatedMinutes != null).length
    const ratio = totalMins / WORK_MINUTES_PER_DAY
    return { totalMins, estimatedCount, ratio, taskCount: todayTasks.length }
  }
```

Replace with:
```typescript
  const getDailyLoad = () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const nowMs = Date.now()
    const todayTasks = tasks.filter(t =>
      t.dueDate === todayStr || (!t.dueDate && new Date(t.createdAt).toISOString().split('T')[0] === todayStr)
    )
    const totalMins = todayTasks.reduce((sum, t) => {
      if (t.completed) {
        // Use actual time if available, skip otherwise
        return sum + (t.actualMinutes ?? 0)
      }
      if (t.startedAt) {
        // Active task: use real elapsed time
        return sum + (nowMs - t.startedAt) / 60000
      }
      // No timer: fall back to estimate (skip if undefined)
      return sum + (t.estimatedMinutes ?? 0)
    }, 0)
    const estimatedCount = todayTasks.filter(t =>
      t.actualMinutes != null || t.startedAt != null || t.estimatedMinutes != null
    ).length
    const ratio = totalMins / WORK_MINUTES_PER_DAY
    return { totalMins, estimatedCount, ratio, taskCount: todayTasks.length }
  }
```

Note: `getDailyLoad` is called in the render body. Since `_progressTick` state changes every 30s, it triggers re-render and `getDailyLoad` recalculates automatically.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: update workload calculation to use actual/elapsed time"
```

---

## Chunk 3: UI — Header, Settings Drawer

### Task 8: Add gear icon + live clock to header

**Files:**
- Modify: `src/App.tsx` — header JSX section
- Modify: `src/App.css` — header clock and gear icon styles

- [ ] **Step 1: Add SettingsIcon and EyeIcon SVGs**

In `App.tsx`, after the existing `ClockIcon` SVG component (around line 122), add:

```tsx
const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
```

- [ ] **Step 2: Add now + showSettings state and clock useEffect**

In the `App` function body (after the existing `useState` declarations), add:

```typescript
  const [now, setNow] = useState(new Date())
  const [showSettings, setShowSettings] = useState(false)
```

After the existing `useEffect` blocks, add:

```typescript
  // Live clock — updates every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
```

- [ ] **Step 3: Compute clock string in render body**

In the render body, after the existing `const todayWeekday = weekdays[d.getDay()]` line, add:

```typescript
  const clockStr = now.toLocaleTimeString('zh-CN', { hour12: false })
```

- [ ] **Step 4: Update tasks-page header JSX**

Find the header section in the tasks page (around line 434). The current header-date div:
```tsx
          <div className="header-date">
            <span className="header-date-main">{todayDateStr}</span>
            <span className="header-date-sub">{todayWeekday}</span>
          </div>
          <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? '切换浅色模式' : '切换深色模式'}>
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
```

Replace with:
```tsx
          <div className="header-date">
            <span className="header-date-main">{todayDateStr}</span>
            <span className="header-date-sub">{todayWeekday}</span>
            <span className="header-clock">{clockStr}</span>
          </div>
          <div className="header-actions">
            <button className="settings-btn" onClick={() => { setSettingsDraft({ ...llmConfig }); setShowSettings(true) }} aria-label="打开设置">
              <SettingsIcon />
            </button>
            <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? '切换浅色模式' : '切换深色模式'}>
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
```

- [ ] **Step 5: Add header clock + settings button CSS**

In `src/App.css`, find the `.header` section. After the existing `.header-date-sub` rule, add:

```css
.header-clock {
  font-size: 11px;
  color: var(--text2);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  margin-top: 1px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.settings-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: color var(--transition), background var(--transition);
}
.settings-btn:hover {
  color: var(--accent);
  background: var(--accent-light);
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add live clock and settings gear icon to header"
```

---

### Task 9: Build settings drawer

**Files:**
- Modify: `src/App.tsx` — add settings drawer JSX
- Modify: `src/App.css` — drawer styles

- [ ] **Step 1: Add remaining LLM settings state variables**

In the `App` function body (after the existing `useState` declarations), add:

```typescript
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
  const [settingsDraft, setSettingsDraft] = useState<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
```

Also update the LLM config load `useEffect` (added in Task 4) to also update state:

```typescript
  useEffect(() => {
    loadLLMConfig().then(cfg => {
      if (cfg) {
        setLLMConfig(cfg)
        setSettingsDraft(cfg)
        setActiveLLMConfig(cfg)
      }
    })
  }, [])
```

And add a sync effect so `_llmConfig` stays in sync when state changes:

```typescript
  useEffect(() => {
    setActiveLLMConfig(llmConfig)
  }, [llmConfig])
```

- [ ] **Step 2: Add settings drawer save handler**

In `App.tsx`, after the `handlePolish` function, add:

```typescript
  const handleSaveSettings = () => {
    setLLMConfig({ ...settingsDraft })
    saveLLMConfig(settingsDraft)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }
```

- [ ] **Step 3: Add settings drawer JSX to tasks page**

In the tasks-page return JSX, just before the closing `</div>` of the root `.app` div (before `</div>` at the end), add:

```tsx
      {/* Settings Drawer */}
      {showSettings && (
        <div className="drawer-backdrop" onClick={() => setShowSettings(false)} aria-hidden="true" />
      )}
      <div className={`settings-drawer ${showSettings ? 'open' : ''}`} role="dialog" aria-label="模型设置" aria-modal="true">
        <div className="drawer-header">
          <span className="drawer-title">模型设置</span>
          <button className="drawer-close" onClick={() => setShowSettings(false)} aria-label="关闭设置">
            <XIcon />
          </button>
        </div>
        <div className="drawer-body">
          <label className="settings-label" htmlFor="settings-baseurl">API 地址</label>
          <input
            id="settings-baseurl"
            className="settings-input"
            type="url"
            autoComplete="off"
            value={settingsDraft.baseURL}
            onChange={e => setSettingsDraft(prev => ({ ...prev, baseURL: e.target.value }))}
          />
          <label className="settings-label" htmlFor="settings-apikey">API Key</label>
          <div className="settings-input-wrap">
            <input
              id="settings-apikey"
              className="settings-input"
              type={showApiKey ? 'text' : 'password'}
              autoComplete="off"
              value={settingsDraft.apiKey}
              onChange={e => setSettingsDraft(prev => ({ ...prev, apiKey: e.target.value }))}
            />
            <button className="eye-btn" onClick={() => setShowApiKey(v => !v)} aria-label={showApiKey ? '隐藏 Key' : '显示 Key'}>
              {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <label className="settings-label" htmlFor="settings-model">模型名称</label>
          <input
            id="settings-model"
            className="settings-input"
            type="text"
            autoComplete="off"
            value={settingsDraft.model}
            onChange={e => setSettingsDraft(prev => ({ ...prev, model: e.target.value }))}
          />
          <button
            className={`settings-save-btn ${settingsSaved ? 'saved' : ''}`}
            onClick={handleSaveSettings}
          >
            {settingsSaved ? '✓ 已保存' : '保存'}
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Add drawer CSS**

In `src/App.css`, before the end of the file, add:

```css
/* ── Settings Drawer ── */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 300;
  animation: fadeIn 0.15s ease-out;
}

.settings-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 280px;
  background: var(--surface);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  z-index: 301;
  transform: translateX(100%);
  transition: transform 0.2s ease-out;
  display: flex;
  flex-direction: column;
}
.settings-drawer.open { transform: translateX(0); }

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border);
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
}
body.mac .drawer-header { padding-top: 48px; }

.drawer-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.drawer-close {
  width: 32px; height: 32px;
  border: none;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
}
.drawer-close:hover { background: var(--surface2); }

.drawer-body {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.settings-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text2);
  margin-top: 8px;
}
.settings-label:first-child { margin-top: 0; }

.settings-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition);
  font-family: inherit;
}
.settings-input:focus { border-color: var(--accent); }

.settings-input-wrap {
  position: relative;
}
.settings-input-wrap .settings-input { padding-right: 36px; }

.eye-btn {
  position: absolute;
  right: 6px; top: 50%;
  transform: translateY(-50%);
  width: 28px; height: 28px;
  border: none; background: transparent;
  color: var(--text2); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.eye-btn:hover { color: var(--text); }

.settings-save-btn {
  margin-top: 16px;
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition), transform 0.1s;
}
.settings-save-btn:hover { background: var(--accent-hover); }
.settings-save-btn:active { transform: scale(0.98); }
.settings-save-btn.saved { background: var(--success); }

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .settings-drawer { transition: none; }
  .drawer-backdrop { animation: none; }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add LLM settings drawer with save/load"
```

---

## Chunk 4: UI — Task Timer Progress Bar

### Task 10: Add timer progress bar and updated time badge to task cards

**Files:**
- Modify: `src/App.tsx` — task card JSX
- Modify: `src/App.css` — progress bar styles

- [ ] **Step 1: Add helper to compute elapsed minutes**

In `App.tsx`, after the `formatMins` function, add:

```typescript
  const getElapsedMins = (task: Task): number | null => {
    if (!task.startedAt) return null
    if (task.completed && task.actualMinutes != null) return task.actualMinutes
    return (Date.now() - task.startedAt) / 60000
  }
```

- [ ] **Step 2: Update the time badge in task card JSX**

Find inside the task card map, the time badge section:
```tsx
                      <span className="task-time-tag">
                        {estimatingIds.has(task.id)
                          ? <span className="estimating">估算中…</span>
                          : task.estimatedMinutes
                            ? <span className="time-badge"><ClockIcon /> {formatMins(task.estimatedMinutes)}</span>
                            : null
                        }
                      </span>
```

Replace with:
```tsx
                      <span className="task-time-tag">
                        {estimatingIds.has(task.id) ? (
                          <span className="estimating">估算中…</span>
                        ) : (() => {
                          const elapsed = getElapsedMins(task)
                          if (elapsed != null && task.estimatedMinutes) {
                            if (task.completed) {
                              return <span className="time-badge time-badge--done"><ClockIcon /> {formatMins(elapsed)} 实际</span>
                            }
                            return <span className={`time-badge ${elapsed > task.estimatedMinutes ? 'time-badge--over' : ''}`}>
                              <ClockIcon /> {formatMins(elapsed)}
                            </span>
                          }
                          return task.estimatedMinutes
                            ? <span className="time-badge"><ClockIcon /> {formatMins(task.estimatedMinutes)}</span>
                            : null
                        })()}
                      </span>
```

- [ ] **Step 3: Add progress bar at the bottom of each task card**

Find the task card closing `</div>` (after the `{isExpanded && ...}` block). The current structure ends with:
```tsx
              </div>
            )
          })
```

Before the outer closing `</div>` of each task-card, add the progress bar. The full task card ends like this after `{isExpanded && (...)}`:
```tsx
              </div>  {/* end task-card */}
```

Add the progress bar just before that closing div:
```tsx
                {/* Timer progress bar */}
                {(() => {
                  const elapsed = getElapsedMins(task)
                  if (elapsed == null || !task.estimatedMinutes || task.estimatedMinutes <= 0) return null
                  const pct = Math.min(elapsed / task.estimatedMinutes, 1) * 100
                  const overPct = elapsed > task.estimatedMinutes
                    ? Math.min((elapsed - task.estimatedMinutes) / task.estimatedMinutes, 1) * 100
                    : 0
                  return (
                    <div
                      className={`task-progress-track ${task.completed ? 'task-progress-track--done' : ''}`}
                      title={`已用 ${formatMins(elapsed)} / 预计 ${formatMins(task.estimatedMinutes)}`}
                    >
                      <div className="task-progress-fill" style={{ width: `${pct}%` }} />
                      {overPct > 0 && (
                        <div className="task-progress-over" style={{ width: `${overPct}%` }} />
                      )}
                    </div>
                  )
                })()}
```

- [ ] **Step 4: Add progress bar CSS**

In `src/App.css`, after the `.task-card` rules, add:

```css
/* ── Task Timer Progress Bar ── */
.task-progress-track {
  position: relative;
  height: 4px;
  background: var(--surface2);
  border-radius: 0 0 var(--radius) var(--radius);
  overflow: hidden;
}

.task-progress-fill {
  position: absolute;
  left: 0; top: 0; height: 100%;
  background: var(--accent);
  transition: width 0.5s ease-out;
}

.task-progress-over {
  position: absolute;
  right: 0; top: 0; height: 100%;
  background: var(--danger);
  transition: width 0.5s ease-out;
  opacity: 0.85;
}

.task-progress-track--done .task-progress-fill {
  background: var(--text2);
  opacity: 0.5;
}
.task-progress-track--done .task-progress-over { display: none; }

/* Time badge variants */
.time-badge--over { color: var(--danger); }
.time-badge--done { color: var(--text2); }

@media (prefers-reduced-motion: reduce) {
  .task-progress-fill,
  .task-progress-over { transition: none; }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add task timer progress bar with overtime indicator"
```

---

### Task 11: Add editable estimatedMinutes in expanded task view

**Files:**
- Modify: `src/App.tsx` — task detail expanded section
- Modify: `src/App.css` — estimate input styles

- [ ] **Step 1: Add estimate input to the expanded task detail**

Find the `task-detail` div (inside `{isExpanded && (...)}`) — the `content-toolbar` div currently is:
```tsx
                      <div className="content-toolbar">
                        <span className="content-hint">失焦自动保存</span>
                        <button
                          className={`polish-btn ${isPolishing ? 'loading' : ''}`}
                          onClick={() => handlePolish(task.id)}
                          disabled={isPolishing || !currentContent.trim()}
                          aria-label="AI 润色内容"
                        >
                          <SparklesIcon />
                          {isPolishing ? '润色中…' : 'AI 润色'}
                        </button>
                      </div>
```

Replace with (adds the estimate editor row above the toolbar; preserve the button exactly as shown):
```tsx
                      <div className="estimate-row">
                        <span className="estimate-label">预计时间</span>
                        <input
                          className="estimate-input"
                          type="number"
                          min="1"
                          max="480"
                          value={task.estimatedMinutes ?? ''}
                          placeholder="分钟"
                          onChange={e => {
                            const val = parseInt(e.target.value, 10)
                            setTasks(prev => prev.map(t =>
                              t.id === task.id
                                ? { ...t, estimatedMinutes: (!isNaN(val) && val > 0) ? val : undefined }
                                : t
                            ))
                          }}
                          aria-label="预计完成时间（分钟）"
                        />
                        <span className="estimate-unit">分钟</span>
                      </div>
                      <div className="content-toolbar">
                        <span className="content-hint">失焦自动保存</span>
                        <button
                          className={`polish-btn ${isPolishing ? 'loading' : ''}`}
                          onClick={() => handlePolish(task.id)}
                          disabled={isPolishing || !currentContent.trim()}
                          aria-label="AI 润色内容"
                        >
                          <SparklesIcon />
                          {isPolishing ? '润色中…' : 'AI 润色'}
                        </button>
                      </div>
```

- [ ] **Step 2: Add estimate input CSS**

In `src/App.css`, after the `.content-toolbar` rules:

```css
.estimate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.estimate-label {
  font-size: 12px;
  color: var(--text2);
  white-space: nowrap;
}
.estimate-input {
  width: 64px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  text-align: center;
  outline: none;
  font-variant-numeric: tabular-nums;
}
.estimate-input:focus { border-color: var(--accent); }
.estimate-unit {
  font-size: 12px;
  color: var(--text2);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: add editable estimated minutes in expanded task view"
```

---

## Chunk 5: History Page Update

### Task 12: Update history page to show all past-day tasks

**Files:**
- Modify: `src/App.tsx` — history page logic and JSX
- Modify: `src/App.css` — history incomplete task styles

- [ ] **Step 1: Rewrite history page data preparation**

Find the history page section (around line 372):
```typescript
  if (page === 'history') {
    const completedByDate = tasks
      .filter(t => t.completed && t.dueDate)
      .reduce((acc, task) => {
        const d = task.dueDate!
        if (!acc[d]) acc[d] = []
        acc[d].push(task)
        return acc
      }, {} as Record<string, Task[]>)
    const sortedDates = Object.keys(completedByDate).sort().reverse()
```

Replace with:
```typescript
  if (page === 'history') {
    const todayStr = new Date().toISOString().split('T')[0]
    // All tasks from before today (completed + incomplete), grouped by dueDate
    const tasksByDate = tasks
      .filter(t => t.dueDate && t.dueDate < todayStr)
      .reduce((acc, task) => {
        const d = task.dueDate!
        if (!acc[d]) acc[d] = []
        acc[d].push(task)
        return acc
      }, {} as Record<string, Task[]>)
    const sortedDates = Object.keys(tasksByDate).sort().reverse()
```

- [ ] **Step 2: Update history JSX to show both completed and incomplete tasks**

Find the history task list render (around line 405):
```tsx
            sortedDates.map(date => (
              <div key={date} className="history-day">
                <div className="history-day-header">
                  <span className="history-day-label">{formatDate(date) || date}</span>
                  <span className="history-day-count">{completedByDate[date].length} 个完成</span>
                </div>
                {completedByDate[date].map(task => (
                  <div key={task.id} className="history-task">
                    <span className="history-check"><CheckIcon /></span>
                    <span className="history-task-text">{task.text}</span>
                    {task.estimatedMinutes && (
                      <span className="history-time">{formatMins(task.estimatedMinutes)}</span>
                    )}
                  </div>
                ))}
              </div>
            ))
```

Replace with:
```tsx
            sortedDates.map(date => {
              const dayTasks = tasksByDate[date]
              const doneCount = dayTasks.filter(t => t.completed).length
              const todoCount = dayTasks.filter(t => !t.completed).length
              return (
                <div key={date} className="history-day">
                  <div className="history-day-header">
                    <span className="history-day-label">{formatDate(date) || date}</span>
                    <span className="history-day-count">
                      {doneCount > 0 && `${doneCount} 完成`}
                      {doneCount > 0 && todoCount > 0 && ' / '}
                      {todoCount > 0 && <span className="history-count-todo">{todoCount} 未完成</span>}
                    </span>
                  </div>
                  {dayTasks.map(task => (
                    <div key={task.id} className={`history-task ${task.completed ? '' : 'history-task--todo'}`}>
                      <span className="history-check">
                        {task.completed ? <CheckIcon /> : <span className="history-todo-dot" />}
                      </span>
                      <span className={`history-task-text ${task.completed ? 'history-task-text--done' : ''}`}>{task.text}</span>
                      {(task.actualMinutes != null || task.estimatedMinutes != null) && (
                        <span className="history-time">{formatMins(task.actualMinutes ?? task.estimatedMinutes!)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })
```

Also update the empty state message from `'还没有完成过任务'` to `'还没有历史任务'`.

- [ ] **Step 3: Update history page title**

Find:
```tsx
            <span className="header-title">历史完成</span>
```
Change to:
```tsx
            <span className="header-title">历史记录</span>
```

- [ ] **Step 4: Add history incomplete task CSS**

In `src/App.css`, after the `.history-task` rules, add:

```css
.history-task--todo {
  opacity: 0.75;
}

.history-task-text--done {
  text-decoration: line-through;
  color: var(--text2);
}

.history-todo-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border: 2px solid var(--text2);
  border-radius: 50%;
}

.history-count-todo {
  color: var(--warning-text);
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vanche/Desktop/dailyTask && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat: history page shows all past tasks (completed + incomplete)"
```

---

## Chunk 6: Final Build and Verification

### Task 13: Build and install

- [ ] **Step 1: Run full build**

```bash
cd /Users/vanche/Desktop/dailyTask && npm run electron:release
```

Expected: Build completes with no TypeScript errors, produces `release/mac-arm64/DailyTask.app`.

- [ ] **Step 2: Install to Applications**

```bash
rm -rf /Applications/DailyTask.app && cp -R release/mac-arm64/DailyTask.app /Applications/DailyTask.app
```

- [ ] **Step 3: Manual verification checklist**

Open `/Applications/DailyTask.app` and verify:

- [ ] Header shows live clock `HH:MM:SS` ticking every second
- [ ] Gear icon appears next to moon toggle; clicking opens drawer from right
- [ ] Settings drawer: can edit baseURL, apiKey (password hidden by default, eye toggle works), model; Save shows ✓
- [ ] Add a task with pinyin input method: pressing Enter during composition does NOT submit; pressing Enter after composition ends DOES submit
- [ ] New tasks have a blue progress bar at the bottom (after AI estimates `estimatedMinutes`)
- [ ] Progress bar advances over time (wait 30s or change to a short estimate to verify)
- [ ] Expanding a task shows "预计时间 [___] 分钟" editable field; changing value updates progress bar
- [ ] Completing a task stops the bar (gray), shows "X分钟 实际" badge
- [ ] History page (click cat) shows past-day tasks including incomplete ones
- [ ] History incomplete tasks show circle `○` and no strikethrough; completed show checkmark and strikethrough
- [ ] Workload bar reflects elapsed time from active tasks

- [ ] **Step 4: Build Windows version**

```bash
cd /Users/vanche/Desktop/dailyTask && npm run electron:build:win
```

- [ ] **Step 5: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix: post-verification adjustments"
```
