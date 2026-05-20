export interface Task {
  id: string
  text: string
  done: boolean
  dueDate: string | null
  dueTime: string | null
}

export interface AppConfig {
  hideCompleted: boolean
}

export type TasksState = Record<string, Task[]>

export type TaskActionResult = { ok: true } | { ok: false; error: string }
