// src/services/ybzApi.ts
import type { YbzProject, YbzWork } from '../types'

const OA_BASE = 'http://10.20.21.75'
const YBZ_BASE = 'http://10.20.23.127/ybz/api'

let _jwt: string | null = null

export function isAuthenticated(): boolean { return _jwt !== null }
export function clearJwt(): void { _jwt = null }

export async function authenticate(oaAccount: string): Promise<void> {
  const oaRes = await fetch(
    `${OA_BASE}/oa/login?loginName=${encodeURIComponent(oaAccount)}`,
    { signal: AbortSignal.timeout(10000) }
  )
  if (!oaRes.ok) throw new Error(`OA 登录失败 (${oaRes.status})`)
  const oaData = await oaRes.json()
  if (oaData.code !== 200) throw new Error(`OA 登录错误: ${oaData.msg}`)

  // msg format: "LtpaToken=AAECAz..."
  const ltpaToken = (oaData.msg as string).replace('LtpaToken=', '').trim()

  const ssoRes = await fetch(`${YBZ_BASE}/sys/agentLogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ LtpaToken: ltpaToken }),
    signal: AbortSignal.timeout(10000),
  })
  if (!ssoRes.ok) throw new Error(`单点登录失败 (${ssoRes.status})`)
  const ssoData = await ssoRes.json()
  if (ssoData.code !== 200) throw new Error(`单点登录错误: ${ssoData.msg}`)

  _jwt = ssoData.data.token
}

function authHeaders(): Record<string, string> {
  if (!_jwt) throw new Error('未登录日报系统')
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${_jwt}` }
}

export async function getProjects(): Promise<YbzProject[]> {
  const res = await fetch(`${YBZ_BASE}/cpjf/myProject/list`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ projectName: '', page: 1, dailyCategoryId: null, projectStatus: '' }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`获取项目列表失败 (${res.status})`)
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg)
  return data.list ?? []
}

export interface DailyRecord {
  dailyId: number
  projectId: number
  reportDate: string
  works: (YbzWork & { workId: number })[]
}

export async function getDailyList(startDate: string, endDate: string): Promise<DailyRecord[]> {
  const res = await fetch(`${YBZ_BASE}/cpjf/daily/list`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ startDate, endDate, page: 1, pageSize: 100 }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`获取日报列表失败 (${res.status})`)
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg)
  return data.list ?? []
}

export async function addOrEditDaily(payload: {
  dailyId?: number
  projectId: number
  reportDate: string
  works: Omit<YbzWork, 'workId'>[]
}): Promise<number> {
  const res = await fetch(`${YBZ_BASE}/cpjf/daily/addOrEdit`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`提交日报失败 (${res.status})`)
  const data = await res.json()
  if (data.code !== 200) throw new Error(data.msg)
  return data.data.dailyId
}
