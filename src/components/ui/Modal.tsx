"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--color-dark)/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-(--radius-xl) border-2 border-(--color-border-muted) bg-(--color-white) p-6 shadow-(--shadow-xl)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="font-display text-lg font-extrabold text-(--color-dark)">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto cursor-pointer text-(--color-text-muted) transition-colors duration-(--transition-fast) hover:text-(--color-text-primary)"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
