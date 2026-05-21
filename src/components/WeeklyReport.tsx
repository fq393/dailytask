// src/components/WeeklyReport.tsx
import { useState } from 'react'
import type { WeekDayPreview, YbzProject } from '../types'
import { WORKING_TYPES } from '../types'
import TabBar, { type TabId } from './TabBar'
import { llmCall } from '../llm'
import { authenticate, getProjects, getDailyList, isAuthenticated, addOrEditDaily } from '../services/ybzApi'

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

const SYSTEM_WEEKLY_DISTRIBUTE = `你是工作日志分配助手。根据工作描述，将内容分配到指定工作日，每天总工时不超过 8 小时，合理分配时长（可以是0.5小时的倍数）。同时从项目列表中为每条工作语义匹配最合适的项目（找不到则 projectId 返回 null），工作类型从枚举中选择：设计/开发/部署/联调/测试/推广/运维/其他。

输出严格 JSON 格式，不要任何其他文字：
[
  {
    "date": "YYYY-MM-DD",
    "works": [
      {
        "projectId": <number或null>,
        "projectName": "<string>",
        "workingType": "<枚举值>",
        "workingHours": <number>,
        "workingContent": "<string>"
      }
    ]
  }
]`

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
  const [isAllocating, setIsAllocating] = useState(false)
  const [projects, setProjects] = useState<YbzProject[]>([])

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

  const handleAllocate = async () => {
    if (!inputText.trim() || isAllocating) return
    if (!oaAccount) { onOpenSettings(); return }

    setIsAllocating(true)
    setAuthError(null)
    try {
      if (!isAuthenticated()) {
        await authenticate(oaAccount)
      }

      const [fetchedProjects, existingDailies] = await Promise.all([
        getProjects(),
        getDailyList(dates[0], dates[4]),
      ])
      setProjects(fetchedProjects)

      // Build projectId → dailyId map per date
      const dailyMapByDate: Record<string, Record<number, number>> = {}
      for (const daily of existingDailies) {
        if (!dailyMapByDate[daily.reportDate]) dailyMapByDate[daily.reportDate] = {}
        dailyMapByDate[daily.reportDate][daily.projectId] = daily.dailyId
      }

      const projectList = fetchedProjects.map(p => `${p.projectId}: ${p.projectName}`).join('\n')
      const userPrompt = `工作描述：\n${inputText}\n\n目标日期（周一到周五）：${dates.join(', ')}\n\n项目列表（id: 名称）：\n${projectList}`

      const raw = await llmCall(SYSTEM_WEEKLY_DISTRIBUTE, userPrompt, 2048)

      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('AI 返回格式错误，请重试')

      const allocated: {
        date: string
        works: { projectId: number | null; projectName: string; workingType: string; workingHours: number; workingContent: string }[]
      }[] = JSON.parse(jsonMatch[0])

      const newPreview: WeekDayPreview[] = dates.map(date => ({
        date,
        weekdayLabel: weekdayLabel(date),
        works: (allocated.find(d => d.date === date)?.works ?? []).map(w => ({
          id: crypto.randomUUID(),
          projectId: w.projectId,
          projectName: w.projectName,
          workingType: w.workingType as import('../types').WorkingType,
          workingHours: w.workingHours,
          workingContent: w.workingContent,
        })),
        existingDailyMap: dailyMapByDate[date] ?? {},
      }))
      setPreview(newPreview)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'AI 分配失败，请重试')
    } finally {
      setIsAllocating(false)
    }
  }

  const dates = getWeekDates(weekOffset)
  const weekHeader = formatWeekHeader(dates)

  const updateWork = (date: string, workId: string, field: string, value: string | number | null) => {
    setPreview(prev => prev?.map(day =>
      day.date !== date ? day : {
        ...day,
        works: day.works.map(w => w.id !== workId ? w : { ...w, [field]: value }),
      }
    ) ?? null)
  }

  const deleteWork = (date: string, workId: string) => {
    setPreview(prev => prev?.map(day =>
      day.date !== date ? day : { ...day, works: day.works.filter(w => w.id !== workId) }
    ) ?? null)
  }

  const addWork = (date: string) => {
    setPreview(prev => prev?.map(day =>
      day.date !== date ? day : {
        ...day,
        works: [...day.works, {
          id: crypto.randomUUID(),
          projectId: null,
          projectName: '',
          workingType: '开发' as import('../types').WorkingType,
          workingHours: 1,
          workingContent: '',
        }],
      }
    ) ?? null)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: number; failed: number } | null>(null)

  const handleSubmit = async () => {
    if (!preview || isSubmitting) return
    setIsSubmitting(true)
    setSubmitResult(null)

    let success = 0
    let failed = 0

    for (const day of preview) {
      if (day.works.length === 0) continue

      const grouped = new Map<number, typeof day.works>()
      for (const work of day.works) {
        if (work.projectId == null) continue
        grouped.set(work.projectId, [...(grouped.get(work.projectId) ?? []), work])
      }

      for (const [projectId, works] of grouped) {
        try {
          const existingDailyId = day.existingDailyMap[projectId]
          await addOrEditDaily({
            ...(existingDailyId !== undefined ? { dailyId: existingDailyId } : {}),
            projectId,
            reportDate: day.date,
            works: works.map(w => ({
              workingHours: w.workingHours,
              workingContent: w.workingContent,
              workingType: w.workingType,
            })),
          })
          success++
        } catch {
          failed++
        }
      }
    }

    setIsSubmitting(false)
    setSubmitResult({ success, failed })
  }

  const canSubmit =
    !!preview &&
    preview.some(d => d.works.length > 0) &&
    !preview.some(d => d.works.some(w => w.projectId == null))

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
            <button
              className={`allocate-btn ${isAllocating ? 'loading' : ''}`}
              onClick={handleAllocate}
              disabled={isAllocating || !inputText.trim() || !oaAccount}
              title={!oaAccount ? '请先在设置中填写 OA 账号' : ''}
            >
              {isAllocating ? '分配中…' : 'AI 分配 →'}
            </button>
          </div>
        </div>

        {preview ? (
          <div className="preview-section">
            <div className="preview-section-title">预览 & 确认</div>
            {preview.map(day => {
              const totalHours = day.works.reduce((s, w) => s + (Number(w.workingHours) || 0), 0)
              const isOverload = totalHours > 8
              const hasExisting = Object.keys(day.existingDailyMap).length > 0
              return (
                <div key={day.date} className={`preview-day ${isOverload ? 'preview-day--overload' : ''}`}>
                  <div className="preview-day-header">
                    <span className="preview-day-label">
                      {day.weekdayLabel} {day.date.slice(5).replace('-', '/')}
                    </span>
                    <span className={`preview-day-hours ${isOverload ? 'preview-hours-over' : ''}`}>
                      {totalHours}h
                    </span>
                    {hasExisting && <span className="preview-existing-tag">追加</span>}
                  </div>

                  {day.works.map(work => (
                    <div key={work.id} className="preview-work-row">
                      <select
                        className={`preview-select preview-project ${work.projectId == null ? 'preview-select--invalid' : ''}`}
                        value={work.projectId ?? ''}
                        onChange={e => {
                          const pid = e.target.value ? Number(e.target.value) : null
                          const pName = projects.find(p => p.projectId === pid)?.projectName ?? ''
                          updateWork(day.date, work.id, 'projectId', pid)
                          updateWork(day.date, work.id, 'projectName', pName)
                        }}
                      >
                        <option value="">请选择项目</option>
                        {projects.map(p => (
                          <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                        ))}
                      </select>

                      <select
                        className="preview-select preview-type"
                        value={work.workingType}
                        onChange={e => updateWork(day.date, work.id, 'workingType', e.target.value)}
                      >
                        {WORKING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>

                      <input
                        className="preview-hours-input"
                        type="number"
                        min="0.5"
                        max="8"
                        step="0.5"
                        value={work.workingHours}
                        onChange={e => updateWork(day.date, work.id, 'workingHours', parseFloat(e.target.value) || 0)}
                      />
                      <span className="preview-hours-unit">h</span>

                      <input
                        className="preview-content-input"
                        type="text"
                        value={work.workingContent}
                        placeholder="工作内容"
                        onChange={e => updateWork(day.date, work.id, 'workingContent', e.target.value)}
                      />

                      <button
                        className="preview-delete-btn"
                        onClick={() => deleteWork(day.date, work.id)}
                        aria-label="删除条目"
                      >×</button>
                    </div>
                  ))}

                  <button className="preview-add-btn" onClick={() => addWork(day.date)}>
                    + 添加条目
                  </button>
                </div>
              )
            })}
            <div className="submit-section">
              {submitResult && (
                <div className={`submit-result ${submitResult.failed > 0 ? 'submit-result--partial' : 'submit-result--ok'}`}>
                  {submitResult.failed === 0
                    ? `✓ 提交成功 ${submitResult.success} 条`
                    : `提交完成：${submitResult.success} 条成功，${submitResult.failed} 条失败`
                  }
                </div>
              )}
              <button
                className="submit-all-btn"
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
                title={!canSubmit ? '请先为所有条目选择项目' : ''}
              >
                {isSubmitting ? '提交中…' : '提交全部'}
              </button>
            </div>
          </div>
        ) : (
          <div className="weekly-placeholder">
            {inputText.trim() ? '点击 "AI 分配 →" 生成每日预览' : '描述你这周干了什么，AI 帮你分配到每天'}
          </div>
        )}
      </div>

      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  )
}
