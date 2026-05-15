import { useState } from 'react'
import './TaskItem.css'

function formatDueDate(dateString) {
  if (!dateString) return null
  // Only accept YYYY-MM-DD format (as produced by <input type="date">)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateString + 'T00:00:00')
  if (isNaN(due.getTime())) return null
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { label: 'Overdue', urgency: 'overdue' }
  if (diffDays === 0) return { label: 'Today', urgency: 'today' }
  if (diffDays === 1) return { label: 'Tomorrow', urgency: 'soon' }
  if (diffDays <= 3) return { label: `${diffDays} days`, urgency: 'soon' }
  return {
    label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
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
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(task.text)
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate ?? '')
  const [errorMessage, setErrorMessage] = useState('')

  function handleSave(event) {
    event.preventDefault()
    const result = onSave({ text: draftText, dueDate: draftDueDate || null })
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
    setDraftDueDate(task.dueDate ?? '')
    setIsEditing(false)
    setErrorMessage('')
  }

  const dueDateInfo = formatDueDate(task.dueDate)

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
          <label className="sr-only" htmlFor={`due-${task.id}`}>Due date</label>
          <input
            id={`due-${task.id}`}
            className="task-due-input"
            type="date"
            value={draftDueDate}
            onChange={(event) => setDraftDueDate(event.target.value)}
          />
          <button type="submit" className="task-action-btn" aria-label="Save task">Save</button>
          <button type="button" className="task-action-btn" onClick={handleCancel}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="task-text-area">
          <span className="task-text">{task.text}</span>
          {dueDateInfo && (
            <span
              className={`due-date-badge due-date-${dueDateInfo.urgency}`}
              aria-label={`Due: ${dueDateInfo.label}`}
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
