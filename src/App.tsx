import { useState, useEffect, useRef } from 'react'
import type { Task, FilterType, CatProgress, CatSize, LLMConfig } from './types'
import { loadTasks, loadTasksAsync, saveTasks, loadCat, loadCatAsync, saveCat, loadLLMConfig, saveLLMConfig } from './storage'
import { useSound } from './hooks/useSound'
import PixelCat from './components/PixelCat'
import './App.css'

// ── LLM ──────────────────────────────────────────────────────────────
const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseURL: 'http://10.26.236.214/v1',
  apiKey: 'gpustack_fc146ee01da0ab5d_56093b1a3a30a431af7d4d799a44b99a',
  model: 'qwen3-235b-a22b-instruct-2507-fp8',
}

// Mutable runtime config — updated when user saves settings
let _llmConfig: LLMConfig = { ...DEFAULT_LLM_CONFIG }
export function setActiveLLMConfig(cfg: LLMConfig) { _llmConfig = cfg }

const WORK_MINUTES_PER_DAY = 480

const SYSTEM_POLISH = `你是一个专业的任务管理助手。用户会提供一个任务的描述内容，请将其优化成结构清晰、有执行力的任务说明。

要求：
1. 明确任务目标（一句话核心目标）
2. 列出2-4个具体执行步骤
3. 注明完成标准（可选，如果原文有相关信息）

格式规范：
- 使用简洁的中文
- 每步骤用「•」开头
- 总字数不超过150字
- 直接输出内容，不要加任何前缀说明`

const SYSTEM_ESTIMATE = `你是工作量估算助手。根据任务标题估算完成所需分钟数。

规则：
- 只考虑实际操作时间，不含等待
- 简单任务（回复消息/简短文档）：15-30分钟
- 普通任务（写报告/修复bug/功能开发）：30-90分钟
- 复杂任务（系统设计/大型功能）：90-240分钟

只返回一个整数（分钟数），不要任何其他文字。例如：30`

const SYSTEM_GENERATE = `你是任务规划助手。根据任务标题，生成结构清晰的执行说明。

要求：
1. 明确核心目标（一句话）
2. 列出2-4个具体执行步骤
3. 总字数不超过120字

格式：
- 使用简洁中文
- 每步骤用「•」开头
- 直接输出内容，不加前缀说明`

async function llmCall(systemPrompt: string, userText: string, maxTokens = 512): Promise<string> {
  const cfg = _llmConfig
  const res = await fetch(`${cfg.baseURL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model, seed: null, stop: null,
      temperature: 0.7, top_p: 1, max_tokens: maxTokens,
      frequency_penalty: 0, presence_penalty: 0,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function polishWithAI(text: string): Promise<string> {
  const result = await llmCall(SYSTEM_POLISH, text)
  return result || text
}

// ── SVG Icons ────────────────────────────────────────────────────────
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)
const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const ChevronUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
)
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const ClipboardIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
)
const SparklesIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
)
const ClockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
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
const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const CalendarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const LeafIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 4 13V8a7 7 0 0 1 7-7 7 7 0 0 1 7 7v5a7 7 0 0 1-7 7z"/>
    <path d="M11 20v-9"/>
  </svg>
)
const ListIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

// ── App ───────────────────────────────────────────────────────────────
function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks())
  const [inputValue, setInputValue] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [darkMode, setDarkMode] = useState(() => {
    const s = localStorage.getItem('dailytask-darkmode')
    return s ? JSON.parse(s) : false
  })
  const [showConfetti, setShowConfetti] = useState(false)
  const [catProgress, setCatProgress] = useState<CatProgress>(() => {
    return loadCat() ?? { level: 1, exp: 0, expToNextLevel: 5, size: 'baby' as CatSize }
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<Record<string, string>>({})
  const [polishingId, setPolishingId] = useState<string | null>(null)
  const [estimatingIds, setEstimatingIds] = useState<Set<string>>(new Set())
  const [generatingContentIds, setGeneratingContentIds] = useState<Set<string>>(new Set())
  const [exportTip, setExportTip] = useState(false)
  const [page, setPage] = useState<'tasks' | 'history'>('tasks')
  const { playSound } = useSound()
  const [now, setNow] = useState(new Date())
  const [showSettings, setShowSettings] = useState(false)
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
  const [settingsDraft, setSettingsDraft] = useState<LLMConfig>({ ...DEFAULT_LLM_CONFIG })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null)
  const [estimateDraftValue, setEstimateDraftValue] = useState('')

  // Render trigger for progress bar refresh every 30s
  // Prefixed with _ to satisfy noUnusedLocals (value is intentionally unused — only the setter matters)
  const [_progressTick, setProgressTick] = useState(0)

  useEffect(() => {
    loadTasksAsync().then(t => { if (t.length > 0) setTasks(t) })
    loadCatAsync().then(c => { if (c) setCatProgress(c) })
  }, [])

  useEffect(() => { saveTasks(tasks) }, [tasks])
  useEffect(() => { saveCat(catProgress) }, [catProgress])
  useEffect(() => {
    localStorage.setItem('dailytask-darkmode', JSON.stringify(darkMode))
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Load LLM config from file on mount
  useEffect(() => {
    loadLLMConfig().then(cfg => {
      if (cfg) {
        setLLMConfig(cfg)
        setSettingsDraft(cfg)
        setActiveLLMConfig(cfg)
      }
    })
  }, [])

  // Keep module-level _llmConfig in sync with state
  useEffect(() => {
    setActiveLLMConfig(llmConfig)
  }, [llmConfig])

  // Progress bar refresh — triggers re-render every 30 seconds to update elapsed time displays
  useEffect(() => {
    const timer = setInterval(() => setProgressTick(n => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Live clock — updates every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const isComposing = useRef(false)

  const addTask = () => {
    if (!inputValue.trim()) return
    const nowMs = Date.now()
    const t: Task = {
      id: nowMs.toString(),
      text: inputValue.trim(),
      content: '',
      completed: false,
      rewarded: false,
      dueDate: today,
      createdAt: nowMs,
      startedAt: nowMs,   // auto-timer: creation = start of work
    }
    setTasks(prev => [t, ...prev])
    setInputValue('')
    setExpandedId(t.id)
    setEditingContent(prev => ({ ...prev, [t.id]: '' }))

    setEstimatingIds(prev => new Set(prev).add(t.id))
    llmCall(SYSTEM_ESTIMATE, t.text, 16)
      .then(raw => {
        const mins = parseInt(raw.replace(/\D/g, ''), 10)
        if (!isNaN(mins) && mins > 0 && mins <= 480) {
          setTasks(prev => prev.map(task =>
            task.id === t.id ? { ...task, estimatedMinutes: mins } : task
          ))
        }
      })
      .catch(() => {})
      .finally(() => setEstimatingIds(prev => { const s = new Set(prev); s.delete(t.id); return s }))

    setGeneratingContentIds(prev => new Set(prev).add(t.id))
    llmCall(SYSTEM_GENERATE, t.text, 512)
      .then(generated => {
        if (generated) {
          setTasks(prev => prev.map(task =>
            task.id === t.id ? { ...task, content: generated } : task
          ))
          setEditingContent(prev => ({ ...prev, [t.id]: generated }))
        }
      })
      .catch(() => {})
      .finally(() => setGeneratingContentIds(prev => {
        const s = new Set(prev); s.delete(t.id); return s
      }))
  }

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

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task => {
      if (task.id !== id) return task
      const newCompleted = !task.completed
      if (newCompleted && !task.rewarded) {
        triggerConfetti()
        playSound('success')
        setCatProgress(prev => {
          let newExp = prev.exp + 1
          let newLevel = prev.level
          let newExpToNextLevel = prev.expToNextLevel
          let newSize: CatSize = prev.size
          if (newExp >= prev.expToNextLevel) {
            newLevel++; newExp = 0
            newExpToNextLevel = Math.floor(newExpToNextLevel * 1.5)
            if (newLevel === 2) newSize = 'small'
            else if (newLevel === 4) newSize = 'medium'
            else if (newLevel === 7) newSize = 'large'
            else if (newLevel >= 10) newSize = 'mega'
          }
          return { level: newLevel, exp: newExp, expToNextLevel: newExpToNextLevel, size: newSize }
        })
        const completedAt = Date.now()
        const actualMinutes = task.startedAt
          ? Math.round((completedAt - task.startedAt) / 60000)
          : undefined
        return { ...task, completed: newCompleted, rewarded: true, completedAt, actualMinutes }
      }
      return {
        ...task,
        completed: newCompleted,
        completedAt: newCompleted ? Date.now() : undefined,
        actualMinutes: newCompleted ? task.actualMinutes : undefined,
      }
    }))
  }

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const saveContent = (id: string) => {
    const content = editingContent[id] ?? ''
    setTasks(tasks.map(t => t.id === id ? { ...t, content } : t))
  }

  const handlePolish = async (id: string) => {
    const content = editingContent[id] ?? tasks.find(t => t.id === id)?.content ?? ''
    if (!content.trim() || polishingId) return
    setPolishingId(id)
    try {
      const polished = await polishWithAI(content)
      setEditingContent(prev => ({ ...prev, [id]: polished }))
    } catch {
      // keep original
    } finally {
      setPolishingId(null)
    }
  }

  const handleSaveSettings = () => {
    setLLMConfig({ ...settingsDraft })
    saveLLMConfig(settingsDraft)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      saveContent(id)
      setExpandedId(null)
    } else {
      const task = tasks.find(t => t.id === id)
      if (task) setEditingContent(prev => ({ ...prev, [id]: task.content }))
      setExpandedId(id)
    }
  }

  const handleExport = () => {
    const todayStr = new Date().toISOString().split('T')[0]
    const lines = [`# DailyTask 导出 — ${todayStr}`, '']
    const active = tasks.filter(t => !t.completed)
    const done = tasks.filter(t => t.completed)
    if (active.length) {
      lines.push('## 待完成')
      active.forEach(t => {
        const date = t.dueDate ? ` 📅 ${t.dueDate}` : ''
        lines.push(`- [ ] **${t.text}**${date}`)
        if (t.content) lines.push(`  ${t.content.replace(/\n/g, '\n  ')}`)
      })
      lines.push('')
    }
    if (done.length) {
      lines.push('## 已完成')
      done.forEach(t => lines.push(`- [x] ~~${t.text}~~`))
    }
    navigator.clipboard.writeText(lines.join('\n'))
    setExportTip(true)
    setTimeout(() => setExportTip(false), 2000)
  }

  const triggerConfetti = () => {
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 2000)
  }

  const today = new Date().toISOString().split('T')[0]
  const dailyLoad = getDailyLoad()

  const d = new Date(today + 'T00:00:00')
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六']
  const todayDateStr = `${months[d.getMonth()]}${d.getDate()}日`
  const todayWeekday = weekdays[d.getDay()]
  const clockStr = now.toLocaleTimeString('zh-CN', { hour12: false })

  const viewTasks = tasks.filter(t => t.dueDate === today)
  const filteredTasks = viewTasks.filter(task => {
    if (filter === 'active') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  const activeCount = viewTasks.filter(t => !t.completed).length
  const completedCount = viewTasks.filter(t => t.completed).length

  const formatDate = (d: string | null) => {
    if (!d) return ''
    const todayStr = new Date().toISOString().split('T')[0]
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    if (d === todayStr) return '今天'
    if (d === tomorrowStr) return '明天'
    const dt = new Date(d + 'T00:00:00')
    const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    return `${months[dt.getMonth()]}${dt.getDate()}日`
  }

  const formatMins = (mins: number) =>
    mins >= 60 ? `${Math.round(mins / 60 * 10) / 10}h` : `${mins}分`

  const getElapsedMins = (task: Task): number | null => {
    if (!task.startedAt) return null
    if (task.completed && task.actualMinutes != null) return task.actualMinutes
    return (Date.now() - task.startedAt) / 60000
  }

  // ── History page ──────────────────────────────────────────────────
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

    return (
      <div className={`app ${darkMode ? 'dark' : ''}`}>
        <div className="titlebar" />
        <header className="header">
          <div className="header-main">
            <button className="back-btn" onClick={() => setPage('tasks')} aria-label="返回">
              <ArrowLeftIcon />
            </button>
            <span className="header-title">历史记录</span>
            <div style={{ flex: 1 }} />
            <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? '切换浅色模式' : '切换深色模式'}>
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>
        <div className="history-list">
          {sortedDates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ListIcon /></div>
              <p>还没有历史任务</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    )
  }

  // ── Tasks page ───────────────────────────────────────────────────
  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="titlebar" />
      {showConfetti && <div className="confetti-container"><Confetti /></div>}

      <header className="header">
        <div className="header-main">
          <button className="cat-btn" onClick={() => setPage('history')} aria-label="查看历史记录">
            <PixelCat progress={catProgress} overloadRatio={dailyLoad.ratio} />
          </button>
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
        </div>
      </header>

      <div className="input-section">
        <div className="input-wrapper">
          <input
            type="text"
            className="task-input"
            placeholder="添加任务…"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onCompositionStart={() => { isComposing.current = true }}
            onCompositionEnd={() => { isComposing.current = false }}
            onKeyDown={e => { if (e.key === 'Enter' && !isComposing.current) addTask() }}
            aria-label="输入新任务"
          />
          <button
            className="add-btn"
            onClick={addTask}
            disabled={!inputValue.trim()}
            aria-label="添加任务"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="filter-tabs" role="tablist">
        {([['全部', 'all'], ['未完成', 'active'], ['已完成', 'completed']] as [string, FilterType][]).map(([label, val]) => (
          <button
            key={val}
            role="tab"
            aria-selected={filter === val}
            className={`filter-tab ${filter === val ? 'active' : ''}`}
            onClick={() => setFilter(val)}
          >{label}</button>
        ))}
      </div>

      {dailyLoad.estimatedCount > 0 && (
        <div className={`workload-bar ${dailyLoad.ratio >= 1 ? 'overload' : dailyLoad.ratio >= 0.8 ? 'warning' : ''}`}>
          <div className="workload-info">
            <span className="workload-label">
              {dailyLoad.ratio >= 1
                ? <><AlertIcon /> 今日超载</>
                : <><ClockIcon /> 今日工作量</>
              }
            </span>
            <span className="workload-time">
              {Math.round(dailyLoad.totalMins / 60 * 10) / 10}h / 8h
            </span>
          </div>
          <div className="workload-track">
            <div className="workload-fill" style={{ width: `${Math.min(dailyLoad.ratio * 100, 100)}%` }} />
            {dailyLoad.ratio > 1 && (
              <div className="workload-overflow" style={{ width: `${Math.min((dailyLoad.ratio - 1) * 100, 30)}%` }} />
            )}
          </div>
        </div>
      )}

      <div className="task-list" role="list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><LeafIcon /></div>
            <p>{filter === 'active' ? '没有未完成的任务' : filter === 'completed' ? '还没有完成的任务' : '这天还没有任务'}</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isExpanded = expandedId === task.id
            const currentContent = isExpanded ? (editingContent[task.id] ?? task.content) : task.content
            const isPolishing = polishingId === task.id
            const isGenerating = generatingContentIds.has(task.id)
            return (
              <div key={task.id} role="listitem" className={`task-card ${task.completed ? 'completed' : ''} ${isExpanded ? 'expanded' : ''}`}>
                <div className="task-main">
                  <label className="checkbox-wrap" aria-label={`标记"${task.text}"为${task.completed ? '未完成' : '已完成'}`}>
                    <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
                    <span className="checkbox-custom"><CheckIcon /></span>
                  </label>
                  <div className="task-body" onClick={() => toggleExpand(task.id)} role="button" tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleExpand(task.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="task-title-row">
                      <span className="task-title">{task.text}</span>
                      <div className="task-time-info" onClick={e => e.stopPropagation()}>
                        {estimatingIds.has(task.id) ? (
                          <span className="estimating">估算中…</span>
                        ) : editingEstimateId === task.id ? (
                          <input
                            className="estimate-inline-input"
                            type="number"
                            min="1"
                            max="480"
                            autoFocus
                            value={estimateDraftValue}
                            onChange={e => setEstimateDraftValue(e.target.value)}
                            onBlur={() => {
                              const val = parseInt(estimateDraftValue, 10)
                              setTasks(prev => prev.map(t =>
                                t.id === task.id
                                  ? { ...t, estimatedMinutes: (!isNaN(val) && val > 0) ? val : t.estimatedMinutes }
                                  : t
                              ))
                              setEditingEstimateId(null)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') setEditingEstimateId(null)
                            }}
                          />
                        ) : (
                          <span
                            className="estimate-badge"
                            onDoubleClick={e => {
                              e.stopPropagation()
                              setEditingEstimateId(task.id)
                              setEstimateDraftValue(task.estimatedMinutes != null ? String(task.estimatedMinutes) : '')
                            }}
                            title="双击编辑预计时间"
                          >
                            预计 {task.estimatedMinutes ? formatMins(task.estimatedMinutes) : '--'}
                          </span>
                        )}
                        {(() => {
                          const elapsed = getElapsedMins(task)
                          if (elapsed == null) return null
                          if (task.completed) {
                            return <span className="elapsed-badge elapsed-badge--done">✓ {formatMins(elapsed)}</span>
                          }
                          return (
                            <span className={`elapsed-badge${task.estimatedMinutes && elapsed > task.estimatedMinutes ? ' elapsed-badge--over' : ''}`}>
                              ⏱ {formatMins(elapsed)}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                    {task.dueDate && (
                      <span className={`task-date-tag ${task.dueDate < today ? 'overdue' : ''}`}>
                        <CalendarIcon /> {formatDate(task.dueDate)}
                      </span>
                    )}
                    {!isExpanded && task.content && (
                      <p className="task-content-preview">{task.content}</p>
                    )}
                  </div>
                  <div className="task-actions">
                    <button className="expand-btn" onClick={() => toggleExpand(task.id)} aria-label={isExpanded ? '收起详情' : '展开详情'}>
                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </button>
                    <button className="delete-btn" onClick={() => deleteTask(task.id)} aria-label="删除任务">
                      <XIcon />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="task-detail">
                    <div className="content-editor">
                      <textarea
                        className="content-textarea"
                        placeholder={isGenerating ? 'AI 生成内容中…' : '添加任务详情、执行步骤、备注…'}
                        value={currentContent}
                        onChange={e => setEditingContent(prev => ({ ...prev, [task.id]: e.target.value }))}
                        onBlur={() => saveContent(task.id)}
                        rows={4}
                        autoFocus
                        disabled={isGenerating}
                      />
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
                    </div>
                  </div>
                )}
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
              </div>
            )
          })
        )}
      </div>

      <div className="footer">
        <span className="footer-stats">{activeCount} 待完成 · {completedCount} 已完成</span>
        <button className="export-btn" onClick={handleExport} aria-label="导出任务列表">
          {exportTip ? <><ClipboardIcon /> 已复制</> : <><ClipboardIcon /> 导出</>}
        </button>
      </div>

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
    </div>
  )
}

function Confetti() {
  const colors = ['#ff6b6b','#4ecdc4','#ffe66d','#95e1d3','#f38181','#aa96da']
  return (
    <>
      {Array.from({ length: 50 }).map((_, i) => (
        <div key={i} className="confetti-piece" style={{
          left: Math.random() * 100 + '%',
          backgroundColor: colors[i % colors.length],
          animationDelay: (Math.random() * 0.5) + 's',
        }} />
      ))}
    </>
  )
}

export default App
