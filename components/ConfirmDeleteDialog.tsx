import { useEffect, useRef } from 'react';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  itemType: string;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable delete confirmation dialog.
 * Shows item type and name, with Cancel as default focus.
 */
export default function ConfirmDeleteDialog({
  isOpen,
  itemType,
  itemName,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus Cancel button by default (safer action)
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="glass-card p-6 max-w-md w-full mx-4">
        <h3 className="font-display font-semibold text-gray-900 dark:text-white mb-3">
          Delete {itemType}
        </h3>
        <p className="text-sm text-gray-500 dark:text-white/50 mb-2">
          Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{itemName}</strong>?
        </p>
        <p className="text-xs text-gray-400 dark:text-white/30 mb-6">
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/10 rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-alert hover:bg-red-alert/80 text-white rounded-lg text-sm font-semibold transition-all duration-200 ease-snappy"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
