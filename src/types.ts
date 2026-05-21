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
  baseURL: string   // e.g. "https://dashscope.aliyuncs.com/compatible-mode/v1"
  apiKey: string
  model: string
  oaAccount?: string   // OA login username, e.g. "fq393"
}

export const STORAGE_KEY = 'dailytask-todos'
export const CAT_STORAGE_KEY = 'dailytask-cat-progress'

// Ybz API types
export interface YbzProject {
  projectId: number
  projectName: string
  projectStatus: string
  dailyCategoryId: number
  workingType: string[]
}

export interface YbzWork {
  workId?: number
  workingHours: number
  workingContent: string
  workingType: string
}

export const WORKING_TYPES = ['设计','开发','部署','联调','测试','推广','运维','其他'] as const
export type WorkingType = typeof WORKING_TYPES[number]

// Weekly report internal state
export interface WeekWorkEntry {
  id: string               // local React key (crypto.randomUUID())
  projectId: number | null
  projectName: string
  workingType: WorkingType
  workingHours: number
  workingContent: string
}

export interface WeekDayPreview {
  date: string             // YYYY-MM-DD
  weekdayLabel: string     // '周一' … '周五'
  works: WeekWorkEntry[]
  existingDailyMap: Record<number, number>  // projectId → existing dailyId
}

// Browser history
export interface BrowserHistoryEntry {
  url: string
  title: string
  visit_time_ms: number
}

export interface BrowserHistoryDomain {
  domain: string
  count: number
  titles: string[]  // up to 3 distinct titles
}

export interface BrowserHistoryDay {
  date: string  // YYYY-MM-DD
  domains: BrowserHistoryDomain[]
}
