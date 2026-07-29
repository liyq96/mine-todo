import { Modal } from '../_primitives/Modal';

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
  return (
    <Modal open={isOpen} onClose={onClose} contentClassName="settings-confirm-card delete-confirm-card">
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
    </Modal>
  );
}