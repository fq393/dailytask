# DailyTask Feature Enhancements — Design Spec

**Date:** 2026-03-11
**Status:** Approved by user
**Project:** DailyTask (Electron + Vite + React 19 + TypeScript)

---

## Overview

Five enhancements to the existing DailyTask desktop app:

1. History page shows all past tasks (completed + incomplete)
2. Live HH:MM:SS clock in the header
3. IME composition fix (pinyin Enter no longer submits)
4. LLM settings via a side-drawer (gear icon in header)
5. Task auto-timer: progress bar, overtime tracking, workload integration

---

## 1. Data Model Changes

### Task — new fields (`src/types.ts`)

```typescript
interface Task {
  // existing fields unchanged...
  startedAt?: number      // Unix ms — set at task creation (auto-timer)
  completedAt?: number    // Unix ms — set when task is marked complete
  actualMinutes?: number  // Computed on completion: (completedAt - startedAt) / 60000
}
```

`startedAt` is written at `addTask()` time, always. `actualMinutes` is written only when `completed` transitions from `false → true`.

### LLMConfig — new interface (`src/types.ts`)

```typescript
interface LLMConfig {
  baseURL: string   // e.g. "http://10.26.236.214/v1"
  apiKey: string
  model: string
}
```

Persisted to `userData/llm-config.json` via the existing IPC storage channel (`storage:load` / `storage:save`). Falls back to hardcoded defaults if file doesn't exist.

---

## 2. Workload Calculation (updated)

The workload bar on the main page now uses actual elapsed time instead of estimated-only:

```
totalMinutes =
  Σ completed tasks → actualMinutes
  + Σ active tasks  → (Date.now() - startedAt) / 60000   [real-time]
  + Σ tasks without startedAt → estimatedMinutes          [fallback]
```

Refreshed every 30 seconds (via shared `setInterval`), co-timed with the task progress bars.

---

## 3. UI Changes

### 3.1 Header

```
[ 🐱 cat ]   2026-03-11 周二  14:23:45   [ gear ]  [ moon ]
```

- Date + weekday: existing
- Clock: appended after weekday, updates every second via `setInterval`
- Clock format: `HH:MM:SS` using `Date#toLocaleTimeString('zh-CN', { hour12: false })`
- Gear icon: SVG (Lucide `Settings`), 20×20px, opens settings drawer on click
- Icon uses `cursor-pointer`, hover: opacity 0.7, transition 150ms

### 3.2 Settings Drawer

- **Trigger:** gear icon in header
- **Behavior:** slides in from the right edge; semi-transparent backdrop covers the rest of the window
- **Width:** 280px
- **Close:** click backdrop OR ✕ button in drawer header
- **Animation:** `transform: translateX(100%) → translateX(0)`, duration 200ms ease-out (enter); 150ms ease-in (exit)

**Drawer layout:**

```
┌──────────────────────────────┐
│  模型设置              [✕]   │
│  ──────────────────────────  │
│  API 地址                    │
│  ┌────────────────────────┐  │
│  │ http://10.26.236.214/v1│  │
│  └────────────────────────┘  │
│                              │
│  API Key                     │
│  ┌────────────────────────┐  │
│  │ gpustack_fc146ee...    │  │
│  └────────────────────────┘  │
│                              │
│  模型名称                    │
│  ┌────────────────────────┐  │
│  │ qwen3-235b-a22b-...    │  │
│  └────────────────────────┘  │
│                              │
│  [        保  存        ]    │
└──────────────────────────────┘
```

- Fields: visible `<label>` + `<input>`, no placeholder-only labels
- API Key field: `type="password"` with show/hide toggle
- 保存 button: primary style, full width, shows ✓ flash on success
- On save: writes `llm-config.json`, updates in-memory LLM config (no restart needed)

### 3.3 Task Card — Timer Progress Bar

A 4px progress track sits flush at the bottom of each task card:

**States:**

| State | Color | Behavior |
|---|---|---|
| In progress, within estimate | Blue (`#2563EB`) | Width animates from 0→100% as time elapses |
| In progress, over estimate | Blue full + Red extension | Red bar extends rightward from 100% |
| Completed | Gray (`#94A3B8`) | Static, shows actual/estimated ratio |
| No `startedAt` | Hidden | No bar shown |

- Progress = `Math.min(elapsed / estimatedMinutes, 1) * 100%`
- Overtime extension = `((elapsed - estimatedMinutes) / estimatedMinutes) * 100%`, capped at 100% (so bar doubles at most)
- CSS transition on `width`: `transition: width 0.5s ease-out` (smooth, not janky)
- Refreshes every 30s via shared interval

**Time badge (top-right of card):**

| State | Label |
|---|---|
| In progress | `⏱ 45min` (updates every 30s) |
| Completed | `✓ 45min 实际` |
| No timer | `~60min` (estimate only, unchanged) |

**Tooltip on hover over progress bar:**
```
已用 45min / 预计 60min
```
Shown via CSS `title` attribute or a small absolutely-positioned tooltip (dark bg, white text, 12px, 4px radius).

### 3.4 Adjustable Estimated Time

In the task card's expanded view, the `estimatedMinutes` field becomes editable:

- Displayed as: `预计时间: [____] 分钟` — an inline number input (width: 60px)
- Changing the value updates `estimatedMinutes` and immediately recalculates the progress bar
- Persisted on blur

### 3.5 History Page

- Shows all tasks where `dueDate < today` (strict less-than, so today's tasks are excluded)
- Completed tasks: strikethrough text, muted color
- Incomplete tasks: normal text, slightly muted with `opacity: 0.8`, a small `○` indicator
- Grouped by `dueDate` descending (newest first), same as before
- Day header shows: `MM月DD日 (周X)` + count badge split: `3完成 / 1未完成`

---

## 4. IME Composition Fix

In the task input `<input>` element:

```typescript
const isComposing = useRef(false)

<input
  onCompositionStart={() => { isComposing.current = true }}
  onCompositionEnd={() => { isComposing.current = false }}
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !isComposing.current) {
      handleAddTask()
    }
  }}
/>
```

The `onKeyDown` handler that currently fires on Enter is gated by `isComposing.current`. No change to submit button behavior.

---

## 5. Design System (UI/UX Pro Max)

From design system analysis:

- **Style:** Micro-interactions — small animations, tactile feedback, responsive hover states
- **Primary color:** `#2563EB` (blue) — used for progress bars, active states, primary actions
- **Accent/CTA:** `#F97316` (orange) — existing add button style can stay
- **Background:** `#F8FAFC` (light) / dark mode existing
- **Text:** `#1E293B`
- **Typography:** Inter (already system-compatible)
- **Icons:** SVG only — use Lucide React (`settings`, `check`, `eye`, `eye-off`) — no emoji
- **Animation timing:** 150–300ms for micro-interactions; 200ms for drawer enter, 150ms exit
- **Progress bar:** CSS `transition: width` only (not `transform`) since width conveys meaning; 500ms ease-out for smoothness
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` — disable or reduce all transitions

---

## 6. State Changes in `App.tsx`

New state additions:

```typescript
const [now, setNow] = useState(new Date())           // live clock
const [llmConfig, setLLMConfig] = useState<LLMConfig>(DEFAULT_LLM_CONFIG)
const [showSettings, setShowSettings] = useState(false)  // settings drawer
const [progressTick, setProgressTick] = useState(0)  // forces 30s re-render for bars
const isComposing = useRef(false)                    // IME gate
```

`useEffect` additions:
1. 1-second interval → `setNow(new Date())`
2. 30-second interval → `setProgressTick(n => n + 1)`
3. On mount: load `llm-config.json` → `setLLMConfig()`

---

## 7. File Changes Summary

| File | Change |
|---|---|
| `src/types.ts` | Add `startedAt`, `completedAt`, `actualMinutes` to `Task`; add `LLMConfig` interface |
| `src/storage.ts` | Add `loadLLMConfig()` / `saveLLMConfig()` functions |
| `src/App.tsx` | All UI and state changes (clock, drawer, timer, IME fix, history filter) |
| `src/App.css` | Progress bar styles, drawer slide animation, settings panel styles, history incomplete styles |
| `electron/main.ts` | No changes needed |
| `electron/preload.ts` | No changes needed |

---

## 8. Out of Scope

- Multiple simultaneous task timers (only one timer per task, auto-start on creation)
- Push notifications for overtime
- Task editing (title remains read-only)
- Date navigation on main page

---

## Acceptance Criteria

- [ ] Header shows live `HH:MM:SS` updating every second
- [ ] Gear icon opens settings drawer from right; backdrop closes it
- [ ] LLM config saves to file and takes effect on next LLM call without restart
- [ ] New tasks have `startedAt` set to creation time
- [ ] Progress bar visible on task cards with `startedAt` and `estimatedMinutes`
- [ ] Progress bar shows blue → red when overtime; updates every 30s
- [ ] Estimated minutes editable in expanded task view
- [ ] Completing a task records `completedAt` and `actualMinutes`
- [ ] Workload bar uses `actualMinutes` for completed, elapsed for active
- [ ] History page shows ALL past-day tasks (completed + incomplete)
- [ ] IME composition: Enter during pinyin does not submit
- [ ] All icons are SVG (Lucide), no emoji used as UI icons
- [ ] Drawer animation: 200ms enter, 150ms exit, ease-out/ease-in
