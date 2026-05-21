// src/components/WeeklyReport.tsx
import { useState } from 'react'
import type { WeekDayPreview } from '../types'
import TabBar, { type TabId } from './TabBar'

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

  const dates = getWeekDates(weekOffset)
  const weekHeader = formatWeekHeader(dates)

  // weekdayLabel is used in future tasks; reference here to avoid dead-code removal
  void weekdayLabel
  // inputText, preview, setInputText, setPreview, setAuthError referenced to satisfy linter
  void inputText; void preview; void setInputText; void setPreview; void setAuthError

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
        {/* input + AI actions — added in Task 6 */}
        {/* preview — added in Task 7 */}
        <div className="weekly-placeholder">输入本周工作描述，点击 AI 分配 → 生成预览</div>
      </div>

      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  )
}
