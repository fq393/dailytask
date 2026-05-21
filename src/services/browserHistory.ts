// src/services/browserHistory.ts
import type { BrowserHistoryDay, BrowserHistoryDomain } from '../types'

const EXCLUDE_DOMAINS = new Set([
  'newtab', 'localhost', '127.0.0.1', '::1',
  'accounts.google.com', 'accounts.youtube.com',
  'ssl.gstatic.com', 'fonts.gstatic.com', 'fonts.googleapis.com',
  'www.gstatic.com',
])

function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url)
    return hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function isWorkHours(ms: number): boolean {
  const d = new Date(ms)
  const h = d.getHours()
  return h >= 8 && h < 20
}

export interface BrowserHistoryResult {
  days: BrowserHistoryDay[]
}

export async function fetchBrowserHistoryForWeek(
  weekDates: string[]
): Promise<BrowserHistoryResult> {
  const startMs = new Date(weekDates[0] + 'T00:00:00').getTime()
  const endMs = new Date(weekDates[4] + 'T23:59:59').getTime() + 999

  const raw = await (window as any).electronAPI?.browserHistory?.read(startMs, endMs) ?? []

  const byDate = new Map<string, Map<string, { count: number; titles: Set<string> }>>()

  for (const entry of raw) {
    if (!isWorkHours(entry.visit_time_ms)) continue
    const domain = extractDomain(entry.url)
    if (!domain || EXCLUDE_DOMAINS.has(domain)) continue

    const d2 = new Date(entry.visit_time_ms)
    const dateStr = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`
    if (!byDate.has(dateStr)) byDate.set(dateStr, new Map())
    const domainMap = byDate.get(dateStr)!
    if (!domainMap.has(domain)) domainMap.set(domain, { count: 0, titles: new Set() })
    const entry2 = domainMap.get(domain)!
    entry2.count++
    if (entry.title && entry2.titles.size < 3) entry2.titles.add(entry.title)
  }

  const days = weekDates.map(date => {
    const domainMap = byDate.get(date)
    if (!domainMap) return { date, domains: [] }
    const domains: BrowserHistoryDomain[] = Array.from(domainMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([domain, { count, titles }]) => ({
        domain,
        count,
        titles: Array.from(titles),
      }))
    return { date, domains }
  })

  return { days }
}

export function buildHistoryPrompt(days: BrowserHistoryDay[]): string {
  const lines: string[] = ['以下是本周浏览器访问记录（按域名聚合，括号内为访问次数）：']
  for (const day of days) {
    if (day.domains.length === 0) continue
    const d = new Date(day.date + 'T00:00:00')
    const label = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
    lines.push(`\n${label}（${day.date.slice(5).replace('-', '/')}）：`)
    for (const { domain, count, titles } of day.domains) {
      const titleHint = titles.length > 0 ? `（${titles[0].slice(0, 30)}）` : ''
      lines.push(`  - ${domain} ×${count}${titleHint}`)
    }
  }
  return lines.join('\n')
}

export function buildDayHistoryPrompt(day: BrowserHistoryDay): string {
  if (day.domains.length === 0) return ''
  const d = new Date(day.date + 'T00:00:00')
  const label = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
  const lines = [`${label}（${day.date.slice(5).replace('-', '/')}）浏览记录：`]
  for (const { domain, count, titles } of day.domains) {
    const titleHint = titles.length > 0 ? `（${titles[0].slice(0, 30)}）` : ''
    lines.push(`  - ${domain} ×${count}${titleHint}`)
  }
  return lines.join('\n')
}
