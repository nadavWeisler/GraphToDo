import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from 'react'
import './TaskItem.css'
import type { QuadrantDefinition, Task, TaskMutationResult, TaskSavePayload } from '../types'

interface DueDateInfo {
  label: string
  urgency: 'overdue' | 'today' | 'soon' | 'normal'
}

interface TaskItemProps {
  task: Task
  quadrants: QuadrantDefinition[]
  currentQuadrantId: string
  onToggle: () => void
  onDelete: () => void
  onSave: (payload: TaskSavePayload) => TaskMutationResult
  onMove: (targetQuadrantId: string) => TaskMutationResult
  onDragStart: (event: DragEvent<HTMLElement>, sourceQuadrantId: string, taskId: string) => void
  onDragEnd: () => void
}

function formatDueDateLabel(dueDate: string | null, dueTime: string | null): DueDateInfo | null {
  if (!dueDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  if (Number.isNaN(due.getTime())) return null
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const timeStr = dueTime ? ` ${dueTime}` : ''

  if (diffDays < 0) return { label: `Overdue${timeStr}`, urgency: 'overdue' }
  if (diffDays === 0) return { label: `Today${timeStr}`, urgency: 'today' }
  if (diffDays === 1) return { label: `Tomorrow${timeStr}`, urgency: 'soon' }
  if (diffDays <= 3) return { label: `${diffDays} days${timeStr}`, urgency: 'soon' }
  return {
    label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + timeStr,
    urgency: 'normal',
  }
}

function TaskItem({
  task,
  quadrants,
  currentQuadrantId,
  onToggle,
  onDelete,
  onSave,
  onMove,
  onDragStart,
  onDragEnd,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [draftText, setDraftText] = useState<string>(task.text)
  const [draftDueDate, setDraftDueDate] = useState<string>(task.dueDate ?? '')
  const [draftDueTime, setDraftDueTime] = useState<string>(task.dueTime ?? '')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const editButtonRef = useRef<HTMLButtonElement | null>(null)
  const shouldRestoreFocusRef = useRef<boolean>(false)

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus()
      return
    }

    if (shouldRestoreFocusRef.current) {
      editButtonRef.current?.focus()
      shouldRestoreFocusRef.current = false
    }
  }, [isEditing])

  function handleSave(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const result = onSave({ text: draftText, dueDate: draftDueDate || null, dueTime: draftDueTime || null })
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Unable to save task.')
      return
    }

    shouldRestoreFocusRef.current = true
    setIsEditing(false)
    setErrorMessage('')
  }

  function handleMove(event: ChangeEvent<HTMLSelectElement>): void {
    const target = event.target.value
    const result = onMove(target)
    if (!result.ok) {
      setErrorMessage(result.error ?? 'Unable to move task.')
      return
    }

    setErrorMessage('')
  }

  function handleCancel(): void {
    setDraftText(task.text)
    setDraftDueDate(task.dueDate ?? '')
    setDraftDueTime(task.dueTime ?? '')
    shouldRestoreFocusRef.current = true
    setIsEditing(false)
    setErrorMessage('')
  }

  function handleEditInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      handleCancel()
    }
  }

  const dueDateInfo = formatDueDateLabel(task.dueDate, task.dueTime)
  const ariaLabelSuffix =
    dueDateInfo?.urgency === 'overdue'
      ? ' (overdue)'
      : dueDateInfo?.urgency === 'today'
        ? ' (due today)'
        : ''

  return (
    <li
      className={`task-item${task.done ? ' done' : ''}`}
      draggable={!isEditing}
      onDragStart={(event) => onDragStart(event, currentQuadrantId, task.id)}
      onDragEnd={onDragEnd}
    >
      <button
        className="toggle-btn"
        onClick={onToggle}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <span className="checkmark" aria-hidden="true">{task.done ? '✓' : ''}</span>
      </button>

      {isEditing ? (
        <form className="edit-task-form" onSubmit={handleSave}>
          <div className="edit-row">
            <label className="sr-only" htmlFor={`edit-${task.id}`}>Edit task text</label>
            <input
              ref={editInputRef}
              id={`edit-${task.id}`}
              className="task-edit-input"
              type="text"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              maxLength={120}
              onKeyDown={handleEditInputKeyDown}
            />
            <button type="submit" className="task-action-btn" aria-label="Save task">Save</button>
            <button type="button" className="task-action-btn" onClick={handleCancel}>
              Cancel
            </button>
          </div>
          <div className="edit-row">
            <label className="sr-only" htmlFor={`edit-due-date-${task.id}`}>Due date</label>
            <input
              id={`edit-due-date-${task.id}`}
              className="task-date-input"
              type="date"
              value={draftDueDate}
              onChange={(event) => setDraftDueDate(event.target.value)}
              aria-label="Due date"
            />
            <label className="sr-only" htmlFor={`edit-due-time-${task.id}`}>Due time</label>
            <input
              id={`edit-due-time-${task.id}`}
              className="task-date-input"
              type="time"
              value={draftDueTime}
              onChange={(event) => setDraftDueTime(event.target.value)}
              aria-label="Due time"
              disabled={!draftDueDate}
            />
          </div>
        </form>
      ) : task.done ? (
        <button
          type="button"
          className="task-text task-text-btn"
          onClick={onToggle}
          aria-label={`Reopen task: ${task.text}`}
        >
          {task.text}
        </button>
      ) : (
        <div className="task-text-area">
          <span className="task-text">{task.text}</span>
          {dueDateInfo && (
            <span
              className={`due-date-badge due-date-${dueDateInfo.urgency}`}
              aria-label={`Due: ${dueDateInfo.label}${ariaLabelSuffix}`}
            >
              📅 {dueDateInfo.label}
            </span>
          )}
        </div>
      )}

      {!isEditing ? (
        <>
          <label className="sr-only" htmlFor={`move-${task.id}`}>Move task to another quadrant</label>
          <select
            id={`move-${task.id}`}
            className="move-select"
            value={currentQuadrantId}
            onChange={handleMove}
            aria-label="Move task"
          >
            {quadrants.map((quadrant) => (
              <option key={quadrant.id} value={quadrant.id}>
                {quadrant.title}
              </option>
            ))}
          </select>

          <button
            ref={editButtonRef}
            className="task-action-btn"
            onClick={() => setIsEditing(true)}
            aria-label="Edit task"
          >
            Edit
          </button>
        </>
      ) : null}

      <button className="delete-btn" onClick={onDelete} aria-label="Delete task">
        ×
      </button>

      <p className="item-error" role="status" aria-live="polite">{errorMessage}</p>
    </li>
  )
}

export default TaskItem
