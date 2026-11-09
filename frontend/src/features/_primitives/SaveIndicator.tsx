import type { SaveStatus } from '../../appTypes';

type SaveIndicatorProps = {
  status: SaveStatus;
  labels: Record<SaveStatus, string>;
  retryLabel: string;
  onRetry: () => void;
};

export function SaveIndicator({ status, labels, retryLabel, onRetry }: SaveIndicatorProps) {
  return status === 'failed' ? (
    <button type="button" className="save-hint is-failed save-hint--retry" onClick={onRetry}>
      {labels.failed} · {retryLabel}
    </button>
  ) : <span className={`save-hint is-${status}`}>{labels[status]}</span>;
}
