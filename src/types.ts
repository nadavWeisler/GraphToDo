export interface Task {
  id: string
  text: string
  done: boolean
  dueDate: string | null
  dueTime: string | null
}

export interface QuadrantDef {
  id: string
  title: string
  subtitle: string
  colorClass: string
  legacyId: string
}

export type TasksState = Record<string, Task[]>

export interface AppConfig {
  hideCompleted: boolean
}

export interface AppState {
  tasks: TasksState
  config: AppConfig
  storageAvailable: boolean
}

export interface TaskResult {
  ok: boolean
  error?: string
}

export interface EditTaskPayload {
  text: string
  dueDate: string | null
  dueTime: string | null
}
