"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export const SPEECH_FAILURE_AUTO_DISMISS_MS = 12_000;

export type SpeechPlaybackFailureBannerProps = {
  requestId: number;
  onDismiss: (requestId: number) => void;
};

// The one shared, engine-wide learner notification for a Learning Engine
// speech failure. Renders only the fixed safe message — no stage, status,
// provider, or technical detail ever reaches this component.
export function SpeechPlaybackFailureBanner({
  requestId,
  onDismiss,
}: SpeechPlaybackFailureBannerProps) {
  const alertElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(requestId);
    }, SPEECH_FAILURE_AUTO_DISMISS_MS);

    // data-timer-armed-for exposes the instant this notice's own 12-second
    // timer is installed. It carries no learner-visible or privacy-bearing
    // data (only the internal monotonic request id), and exists solely so
    // the deterministic browser test can prove a replacement notice's timer
    // is actually armed before advancing a fake clock, instead of guessing a
    // fixed delay.
    alertElementRef.current?.setAttribute("data-timer-armed-for", String(requestId));

    return () => clearTimeout(timer);
    // Re-keying on requestId (not just mount/unmount) gives every newer
    // failure its own full lifetime instead of inheriting an older timer.
  }, [requestId, onDismiss]);

  return (
    <div
      ref={alertElementRef}
      role="alert"
      aria-atomic="true"
      data-request-id={requestId}
      className="sticky top-0 z-40 flex w-full items-center justify-between gap-3 border-b border-danger/(--alpha-soft) bg-danger/(--alpha-surface-soft) px-4 py-3 text-sm font-medium text-danger"
    >
      <span>Audio couldn&apos;t play. Please try again.</span>
      <button
        type="button"
        onClick={() => onDismiss(requestId)}
        aria-label="Dismiss audio error"
        className="shrink-0 cursor-pointer rounded-(--radius-sm) text-danger transition-colors duration-(--transition-fast) hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/(--alpha-medium)"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default SpeechPlaybackFailureBanner;
