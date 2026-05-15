import { useState } from 'react'
import './TaskItem.css'

function getTodayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateStatus(dueDate) {
  if (!dueDate) return null
  const todayStr = getTodayString()
  if (dueDate < todayStr) return 'overdue'
  if (dueDate === todayStr) return 'due-today'
  return 'upcoming'
}

function formatDueDate(dueDate, dueTime) {
  const date = new Date(`${dueDate}T00:00:00`)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return dueTime ? `${dateStr} ${dueTime}` : dateStr
}

function TaskItem({
  task,
  quadrants,
  currentQuadrantId,
  onToggle,
  onDelete,
  onSave,
  onMove,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(task.text)
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate || '')
  const [draftDueTime, setDraftDueTime] = useState(task.dueTime || '')
  const [errorMessage, setErrorMessage] = useState('')

  function handleSave(event) {
    event.preventDefault()
    const result = onSave(draftText, draftDueDate || null, draftDueTime || null)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setIsEditing(false)
    setErrorMessage('')
  }

  function handleMove(event) {
    const target = event.target.value
    const result = onMove(target)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setErrorMessage('')
  }

  function handleCancel() {
    setDraftText(task.text)
    setDraftDueDate(task.dueDate || '')
    setDraftDueTime(task.dueTime || '')
    setIsEditing(false)
    setErrorMessage('')
  }

  const dateStatus = getDateStatus(task.dueDate)

  return (
    <li className={`task-item${task.done ? ' done' : ''}`}>
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
              id={`edit-${task.id}`}
              className="task-edit-input"
              type="text"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              maxLength={120}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  handleCancel()
                }
              }}
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
      ) : (
        <div className="task-content">
          <span className="task-text">{task.text}</span>
          {task.dueDate ? (
            <span
              className={`due-badge due-badge--${dateStatus}`}
              aria-label={`Due: ${formatDueDate(task.dueDate, task.dueTime)}${dateStatus === 'overdue' ? ' (overdue)' : dateStatus === 'due-today' ? ' (due today)' : ''}`}
            >
              {dateStatus === 'overdue' ? '⚠\uFE0E ' : '📅\uFE0E '}
              {formatDueDate(task.dueDate, task.dueTime)}
            </span>
          ) : null}
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
