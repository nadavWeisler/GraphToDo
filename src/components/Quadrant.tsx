import { useRef, useState } from 'react'
import TaskItem from './TaskItem'
import './Quadrant.css'
import type { Task, QuadrantDef, TaskResult } from '../types'

const TASK_DRAG_MIME_TYPE = 'application/x-graphtodo-task'

interface DragPayload {
  sourceQuadrantId: string
  taskId: string
}

interface QuadrantProps {
  id: string
  title: string
  subtitle: string
  colorClass: string
  tasks: Task[]
  totalCount: number
  visibleCount: number
  quadrants: QuadrantDef[]
  onAddTask: (quadrantId: string, text: string, dueDate: string | null, dueTime: string | null) => TaskResult
  onToggleTask: (quadrantId: string, taskId: string) => void
  onDeleteTask: (quadrantId: string, taskId: string) => void
  onEditTask: (quadrantId: string, taskId: string, text: string, dueDate: string | null, dueTime: string | null) => TaskResult
  onMoveTask: (sourceQuadrantId: string, taskId: string, targetQuadrantId: string) => TaskResult
}

function Quadrant({
  id,
  title,
  subtitle,
  colorClass,
  tasks,
  totalCount,
  visibleCount,
  quadrants,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onMoveTask,
}: QuadrantProps) {
  const [input, setInput] = useState<string>('')
  const [addDueDate, setAddDueDate] = useState<string>('')
  const [addDueTime, setAddDueTime] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)

  function handleAdd(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const tags = addTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const result = onAddTask(id, input, addDueDate || null, addDueTime || null, tags)

    if (!result.ok) {
      setErrorMessage(result.error ?? '')
      return
    }

    setInput('')
    setAddDueDate('')
    setAddDueTime('')
    setAddTags('')
    setErrorMessage('')
    addInputRef.current?.focus()
  }

  function handleTaskDragStart(event: React.DragEvent<HTMLLIElement>, sourceQuadrantId: string, taskId: string): void {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(
      TASK_DRAG_MIME_TYPE,
      JSON.stringify({ sourceQuadrantId, taskId })
    )
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>): void {
    if (!event.dataTransfer.types.includes(TASK_DRAG_MIME_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (!isDragOver) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(event: React.DragEvent<HTMLElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  function handleDrop(event: React.DragEvent<HTMLElement>): void {
    event.preventDefault()
    setIsDragOver(false)

    const rawPayload = event.dataTransfer.getData(TASK_DRAG_MIME_TYPE)
    if (!rawPayload) return

    try {
      const { sourceQuadrantId, taskId } = JSON.parse(rawPayload) as DragPayload
      const result = onMoveTask(sourceQuadrantId, taskId, id)

      if (!result.ok) {
        setErrorMessage(result.error ?? '')
        return
      }

      setErrorMessage('')
    } catch {
      setErrorMessage('Unable to move the dropped task.')
      return
    }

    const result = onMoveTask(payload.sourceQuadrantId, payload.taskId, id)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setErrorMessage('')
  }

  function handleKeyboardDrop(event) {
    if (event.target !== event.currentTarget || !activeMoveTask) return

    if (event.key === 'Escape') {
      event.preventDefault()
      onCancelTaskMove()
      setIsDragOver(false)
      setErrorMessage('')
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    const result = onMoveTask(activeMoveTask.sourceQuadrantId, activeMoveTask.taskId, id)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setErrorMessage('')
  }

  return (
    <section
      className={`quadrant ${colorClass}${isDragOver ? ' drag-over' : ''}`}
      role="region"
      aria-labelledby={`${titleId} ${labelId}`}
      aria-describedby={`${countId} ${instructionsId}${errorMessage ? ` error-${id}` : ''}`}
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyboardDrop}
    >
      <div className="quadrant-header">
        <h2 id={titleId}>{title}</h2>
        <span className="sr-only" id={labelId}>quadrant</span>
        <p>{subtitle}</p>
        <p className="count-text" id={countId} aria-live="polite">
          {totalCount} total{visibleCount !== totalCount ? ` • ${visibleCount} shown` : ''}
        </p>
        <p className="sr-only" id={instructionsId}>
          {activeMoveTask
            ? 'Press Enter or Space to drop the selected task in this quadrant. Press Escape to cancel the move.'
            : 'Drag a task into this quadrant or focus a task card, press Enter or Space to pick it up, then focus this quadrant and press Enter or Space to drop it.'}
        </p>
      </div>

      <ul className="task-list">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            quadrants={quadrants}
            currentQuadrantId={id}
            onToggle={() => onToggleTask(id, task.id)}
            onDelete={() => onDeleteTask(id, task.id)}
            onSave={(payload) => onEditTask(id, task.id, payload.text, payload.dueDate, payload.dueTime, payload.tags)}
            onMove={(targetQuadrantId) => onMoveTask(id, task.id, targetQuadrantId)}
            onDragStart={handleTaskDragStart}
            onDragEnd={(event) => {
              setIsDragOver(false)
              if (event.dataTransfer?.dropEffect === 'none') {
                onCancelTaskMove()
              }
            }}
            activeMoveTask={activeMoveTask}
            onStartTaskMove={onStartTaskMove}
            onCancelTaskMove={onCancelTaskMove}
          />
        ))}
      </ul>

      {!tasks.length ? <p className="empty-message">No tasks match this view.</p> : null}

      <form className="add-task-form" onSubmit={handleAdd}>
        <div className="add-task-row">
          <label className="sr-only" htmlFor={`add-${id}`}>
            Add task to {title}
          </label>
          <input
            ref={addInputRef}
            id={`add-${id}`}
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Add a task…"
            {...(errorMessage ? { 'aria-describedby': `error-${id}` } : {})}
            maxLength={120}
          />
          <button type="submit" aria-label={`Add task to ${title}`}>+</button>
        </div>
        <div className="add-task-date-row">
          <label className="sr-only" htmlFor={`add-due-date-${id}`}>New task due date</label>
          <input
            id={`add-due-date-${id}`}
            type="date"
            value={addDueDate}
            onChange={(event) => setAddDueDate(event.target.value)}
            aria-label="New task due date"
          />
          <label className="sr-only" htmlFor={`add-due-time-${id}`}>New task due time</label>
          <input
            id={`add-due-time-${id}`}
            type="time"
            value={addDueTime}
            onChange={(event) => setAddDueTime(event.target.value)}
            aria-label="New task due time"
            disabled={!addDueDate}
          />
        </div>
        <div className="add-task-tags-row">
          <label className="sr-only" htmlFor={`add-tags-${id}`}>New task tags</label>
          <input
            id={`add-tags-${id}`}
            type="text"
            value={addTags}
            onChange={(event) => setAddTags(event.target.value)}
            placeholder="tag1, tag2…"
            aria-label="New task tags"
          />
        </div>
      </form>

      <p className="input-error" id={`error-${id}`} role="status" aria-live="polite">
        {errorMessage}
      </p>
    </section>
  )
}

export default Quadrant
