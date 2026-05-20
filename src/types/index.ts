export interface Task {
  id: string
  text: string
  done: boolean
  dueDate: string | null
  dueTime: string | null
}

export type QuadrantState = Record<string, Task[]>

export interface QuadrantDefinition {
  id: string
  legacyId: string
  title: string
  subtitle: string
  colorClass: string
}

export interface TaskMutationResult {
  ok: boolean
  error?: string
}

export interface TaskSavePayload {
  text: string
  dueDate: string | null
  dueTime: string | null
}

export interface DragPayload {
  sourceQuadrantId: string
  taskId: string
}
