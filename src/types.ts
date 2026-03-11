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
}

export type FilterType = 'all' | 'active' | 'completed' | 'today' | 'overdue'

export type CatSize = 'baby' | 'small' | 'medium' | 'large' | 'mega'

export interface CatProgress {
  level: number
  exp: number
  expToNextLevel: number
  size: CatSize
}

export const STORAGE_KEY = 'dailytask-todos'
export const CAT_STORAGE_KEY = 'dailytask-cat-progress'
