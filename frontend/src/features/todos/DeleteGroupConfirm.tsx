import { Modal } from '../_primitives/Modal';

type DeleteGroupConfirmProps = {
  isOpen: boolean;
  title: string;
  description: string;
  checkboxLabel: string;
  hint: string;
  checked: boolean;
  cancelLabel: string;
  confirmLabel: string;
  saving: boolean;
  onCheckedChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteGroupConfirm({
  isOpen,
  title,
  description,
  checkboxLabel,
  hint,
  checked,
  cancelLabel,
  confirmLabel,
  saving,
  onCheckedChange,
  onClose,
  onConfirm,
}: DeleteGroupConfirmProps) {
  return (
    <Modal open={isOpen} onClose={onClose} contentClassName="settings-confirm-card delete-confirm-card">
      <div className="settings-pane__header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <label className="delete-group-option">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          disabled={saving}
        />
        <span className="delete-group-option__copy">
          <strong>{checkboxLabel}</strong>
          <span>{hint}</span>
        </span>
      </label>

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