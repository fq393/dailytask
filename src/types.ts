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
