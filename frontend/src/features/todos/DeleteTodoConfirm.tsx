type DeleteTodoConfirmProps = {
  isOpen: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteTodoConfirm({
  isOpen,
  title,
  description,
  cancelLabel,
  confirmLabel,
  saving,
  onClose,
  onConfirm,
}: DeleteTodoConfirmProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-confirm-card delete-confirm-card" onClick={(event) => event.stopPropagation()}>
        <div className="settings-pane__header">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <div className="settings-actions delete-confirm-actions">
          <button
            type="button"
            className="dialog-button dialog-button--secondary"
            onClick={onClose}
            disabled={saving}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="dialog-button dialog-button--danger"
            onClick={onConfirm}
            disabled={saving}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
