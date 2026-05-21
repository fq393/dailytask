// src/components/BrowserHistoryDrawer.tsx
import { useState, useEffect } from 'react'
import type { BrowserHistoryDay } from '../types'
import { fetchBrowserHistoryForWeek, buildHistoryPrompt, buildDayHistoryPrompt } from '../services/browserHistory'

interface Props {
  isOpen: boolean
  onClose: () => void
  weekDates: string[]
  onImportWeek: (text: string) => void
  onImportDay: (date: string, text: string) => void
}

function weekdayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
}

export default function BrowserHistoryDrawer({ isOpen, onClose, weekDates, onImportWeek, onImportDay }: Props) {
  const [days, setDays] = useState<BrowserHistoryDay[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noData, setNoData] = useState(false)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchBrowserHistoryForWeek(weekDates)
        if (!cancelled) {
          setDays(result.days)
          setNoData(result.days.every(d => d.domains.length === 0))
          setExpandedDays(new Set(result.days.filter(d => d.domains.length > 0).map(d => d.date)))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '读取失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, weekDates.join(',')])

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date); else next.add(date)
      return next
    })
  }

  const handleRefresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchBrowserHistoryForWeek(weekDates)
      setDays(result.days)
      setNoData(result.days.every(d => d.domains.length === 0))
      setExpandedDays(new Set(result.days.filter(d => d.domains.length > 0).map(d => d.date)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="bh-backdrop" onClick={onClose} />
      <div className="bh-drawer">
        <div className="bh-header">
          <span className="bh-title">浏览器历史</span>
          <div className="bh-header-actions">
            <button
              className="bh-refresh-btn"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="重新读取"
              title="重新读取"
            >
              {loading ? '⟳' : '↻'}
            </button>
            <button className="bh-close-btn" onClick={onClose} aria-label="关闭">✕</button>
          </div>
        </div>

        <div className="bh-body">
          {error && <div className="bh-error">{error}</div>}

          {loading && !days && (
            <div className="bh-loading">读取浏览历史中…</div>
          )}

          {noData && !loading && (
            <div className="bh-empty">
              <div>本周无工作时段浏览记录</div>
              <div className="bh-empty-hint">
                如使用 Safari，请在「系统设置 → 隐私与安全性 → 完整磁盘访问权限」中允许 DailyTask
              </div>
            </div>
          )}

          {days && !noData && days.map(day => {
            const hasData = day.domains.length > 0
            const isExpanded = expandedDays.has(day.date)
            return (
              <div key={day.date} className={`bh-day ${!hasData ? 'bh-day--empty' : ''}`}>
                <div
                  className="bh-day-header"
                  onClick={() => hasData && toggleDay(day.date)}
                  style={{ cursor: hasData ? 'pointer' : 'default' }}
                >
                  <span className="bh-day-label">
                    {weekdayLabel(day.date)} {day.date.slice(5).replace('-', '/')}
                  </span>
                  <span className="bh-day-count">
                    {hasData ? `${day.domains.length} 个域名` : '无记录'}
                  </span>
                  {hasData && (
                    <button
                      className="bh-import-day-btn"
                      onClick={e => {
                        e.stopPropagation()
                        onImportDay(day.date, buildDayHistoryPrompt(day))
                        onClose()
                      }}
                      title="将此天历史导入到文本框"
                    >
                      导入此天
                    </button>
                  )}
                  {hasData && <span className="bh-day-caret">{isExpanded ? '▾' : '▸'}</span>}
                </div>

                {isExpanded && hasData && (
                  <ul className="bh-domain-list">
                    {day.domains.map(({ domain, count, titles }) => (
                      <li key={domain} className="bh-domain-item">
                        <span className="bh-domain-name">{domain}</span>
                        <span className="bh-domain-count">×{count}</span>
                        {titles[0] && (
                          <span className="bh-domain-title">{titles[0].slice(0, 40)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {days && !noData && days.some(d => d.domains.length > 0) && (
          <div className="bh-footer">
            <button
              className="bh-import-week-btn"
              onClick={() => {
                onImportWeek(buildHistoryPrompt(days))
                onClose()
              }}
            >
              导入整周 → AI 分配
            </button>
          </div>
        )}
      </div>
    </>
  )
}
