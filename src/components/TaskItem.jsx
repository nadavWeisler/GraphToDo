import { useEffect, useRef, useState } from 'react'
import './TaskItem.css'

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
  const [errorMessage, setErrorMessage] = useState('')
  const editInputRef = useRef(null)
  const editButtonRef = useRef(null)
  const shouldRestoreFocusRef = useRef(false)

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

  function handleSave(event) {
    event.preventDefault()
    const result = onSave(draftText)
    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    shouldRestoreFocusRef.current = true
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
    shouldRestoreFocusRef.current = true
    setIsEditing(false)
    setErrorMessage('')
  }

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
            ref={editInputRef}
            id={`edit-${task.id}`}
            className="task-edit-input"
            type="text"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            maxLength={120}
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
        </form>
      ) : (
        <span className="task-text">{task.text}</span>
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
