import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './TaskEditModal.css'

function TaskEditModal({ task, onSave, onCancel }) {
  const titleId = useId()
  const editInputRef = useRef(null)
  const [draftText, setDraftText] = useState(task.text)
  const [draftDueDate, setDraftDueDate] = useState(task.dueDate ?? '')
  const [draftDueTime, setDraftDueTime] = useState(task.dueTime ?? '')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    editInputRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function handleCancel() {
    setErrorMessage('')
    onCancel()
  }

  function handleSubmit(event) {
    event.preventDefault()

    const result = onSave({
      text: draftText,
      dueDate: draftDueDate || null,
      dueTime: draftDueDate ? draftDueTime || null : null,
    })

    if (!result.ok) {
      setErrorMessage(result.error)
      return
    }

    setErrorMessage('')
  }

  return createPortal(
    <div
      className="task-edit-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleCancel()
        }
      }}
    >
      <div
        className="task-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            handleCancel()
          }
        }}
      >
        <div className="task-edit-modal-header">
          <h3 id={titleId}>Edit task</h3>
          <button
            type="button"
            className="task-edit-modal-close"
            onClick={handleCancel}
            aria-label="Close edit modal"
          >
            ×
          </button>
        </div>

        <form className="task-edit-modal-form" onSubmit={handleSubmit}>
          <label className="task-edit-modal-label" htmlFor={`edit-${task.id}`}>
            Task details
          </label>
          <input
            ref={editInputRef}
            id={`edit-${task.id}`}
            className="task-edit-modal-input"
            type="text"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            aria-label="Edit task text"
            maxLength={120}
          />

          <div className="task-edit-modal-grid">
            <div className="task-edit-modal-field">
              <label className="task-edit-modal-label" htmlFor={`edit-due-date-${task.id}`}>
                Due date
              </label>
              <input
                id={`edit-due-date-${task.id}`}
                className="task-edit-modal-input"
                type="date"
                value={draftDueDate}
                onChange={(event) => {
                  setDraftDueDate(event.target.value)
                  if (!event.target.value) {
                    setDraftDueTime('')
                  }
                }}
                aria-label="Due date"
              />
            </div>

            <div className="task-edit-modal-field">
              <label className="task-edit-modal-label" htmlFor={`edit-due-time-${task.id}`}>
                Due time
              </label>
              <input
                id={`edit-due-time-${task.id}`}
                className="task-edit-modal-input"
                type="time"
                value={draftDueTime}
                onChange={(event) => setDraftDueTime(event.target.value)}
                aria-label="Due time"
                disabled={!draftDueDate}
              />
            </div>
          </div>

          <div className="task-edit-modal-actions">
            <button type="button" className="task-action-btn" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="task-action-btn" aria-label="Save task">
              Save
            </button>
          </div>
        </form>

        <p className="item-error" role="status" aria-live="polite">{errorMessage}</p>
      </div>
    </div>,
    document.body
  )
}

export default TaskEditModal
