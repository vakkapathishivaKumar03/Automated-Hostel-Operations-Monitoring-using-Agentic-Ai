import React, { useEffect } from 'react';
import '../styles/context-action-modal.css';

const ContextActionModal = ({
  open,
  title,
  message,
  subtext,
  icon = '⚠️',
  tone = 'danger',
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  showCancel,
  hideCancel = false,
  onCancel,
  onClose,
  onConfirm,
}) => {
  const resolvedConfirmLabel = confirmText || confirmLabel || 'Confirm';
  const resolvedCancelLabel = cancelText || cancelLabel || 'Cancel';
  const resolvedShowCancel = typeof showCancel === 'boolean' ? showCancel : !hideCancel;
  const resolvedCloseHandler = onClose || onCancel;

  useEffect(() => {
    if (!open) return undefined;

    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="context-action-overlay" onClick={resolvedCloseHandler}>
      <div className="context-action-card" onClick={(event) => event.stopPropagation()}>
        <div className="context-action-header">
          <h2>{title}</h2>
          <button type="button" className="context-action-close" onClick={resolvedCloseHandler} aria-label="Close dialog">
            ×
          </button>
        </div>

        <div className="context-action-body">
          {icon && <div className="context-action-icon">{icon}</div>}
          <p className="context-action-message">{message}</p>
          {subtext ? <p className="context-action-subtext">{subtext}</p> : null}
        </div>

        <div className="context-action-footer">
          {resolvedShowCancel ? (
            <button type="button" className="context-action-button context-action-button-secondary" onClick={resolvedCloseHandler}>
              {resolvedCancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`context-action-button context-action-button-${tone}`}
            onClick={onConfirm}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextActionModal;