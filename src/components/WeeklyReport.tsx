// src/components/WeeklyReport.tsx
import { useState } from 'react'
import type { WeekDayPreview } from '../types'
import TabBar, { type TabId } from './TabBar'
import { llmCall } from '../llm'

// ── Week helpers ─────────────────────────────────────────────────────
function getWeekDates(offset: number): string[] {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function weekdayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

function formatWeekHeader(dates: string[]): string {
  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getMonth() + 1}/${String(dt.getDate()).padStart(2, '0')}`
  }
  return `${fmt(dates[0])}（一）~ ${fmt(dates[4])}（五）`
}

const SYSTEM_WEEKLY_POLISH = `你是工作内容润色助手。将用户输入的工作周报整理成简洁专业的中文，保留所有关键信息，去除口语化表达，语言连贯自然。直接输出润色后内容，不加任何前缀说明。`

// ── Component ────────────────────────────────────────────────────────
interface WeeklyReportProps {
  darkMode: boolean
  oaAccount: string
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onOpenSettings: () => void
}

export default function WeeklyReport({
  darkMode, oaAccount, activeTab, onTabChange, onOpenSettings
}: WeeklyReportProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [inputText, setInputText] = useState('')
  const [preview, setPreview] = useState<WeekDayPreview[] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const [isPolishing, setIsPolishing] = useState(false)

  const handlePolish = async () => {
    if (!inputText.trim() || isPolishing) return
    setIsPolishing(true)
    try {
      const result = await llmCall(SYSTEM_WEEKLY_POLISH, inputText, 1024)
      if (result) setInputText(result)
    } catch {
      // keep original on error
    } finally {
      setIsPolishing(false)
    }
  }

  const dates = getWeekDates(weekOffset)
  const weekHeader = formatWeekHeader(dates)

  // weekdayLabel is used in future tasks; reference here to avoid dead-code removal
  void weekdayLabel
  // setPreview, setAuthError referenced to satisfy linter
  void setPreview; void setAuthError

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <div className="titlebar" />
      <header className="header">
        <div className="header-main">
          <span className="header-title">周报</span>
          <div className="week-selector">
            <button className="week-nav-btn" onClick={() => setWeekOffset(o => o - 1)} aria-label="上一周">‹</button>
            <span className="week-label">{weekHeader}</span>
            <button
              className="week-nav-btn"
              onClick={() => setWeekOffset(o => Math.min(o + 1, 0))}
              aria-label="下一周"
              disabled={weekOffset >= 0}
            >›</button>
          </div>
        </div>
      </header>

      {authError && (
        <div className="auth-error-banner">{authError}</div>
      )}
      {!oaAccount && (
        <div className="oa-missing-banner">
          未设置 OA 账号，<button className="link-btn" onClick={onOpenSettings}>去设置</button>
        </div>
      )}

      <div className="weekly-scroll">
        <div className="weekly-input-section">
          <textarea
            className="weekly-textarea"
            placeholder="描述这周做了哪些工作…"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            rows={5}
          />
          <div className="weekly-input-actions">
            <button
              className={`polish-btn ${isPolishing ? 'loading' : ''}`}
              onClick={handlePolish}
              disabled={isPolishing || !inputText.trim()}
            >
              ✨ {isPolishing ? '润色中…' : 'AI 润色'}
            </button>
            {/* AI distribute button — added in Task 7 */}
          </div>
        </div>

        {!preview && !inputText.trim() && (
          <div className="weekly-placeholder">描述你这周干了什么，AI 帮你分配到每天</div>
        )}
        {!preview && inputText.trim() && (
          <div className="weekly-placeholder">点击 "AI 分配 →" 生成每日预览</div>
        )}
      </div>

      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  )
}
