"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#testimonials", label: "Reviews" },
  { href: "#word-generator", label: "Word Tools" },
];

const subscribeToClientEnvironment = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function HeaderNav() {
  // `Header` renders `HeaderNav` twice (one per breakpoint container), each
  // with its own portal-mounted drawer, so this must be per-instance rather
  // than a single hardcoded ID.
  const drawerId = useId();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToClientEnvironment,
    getClientSnapshot,
    getServerSnapshot
  );
  const drawerRef = useRef<HTMLDivElement>(null);

  function closeDrawer() {
    setOpen(false);
  }

  // Keyed only on `open`, so this runs exactly once per open/close
  // transition: moving focus into the drawer, then -- via cleanup --
  // restoring it to the trigger that opened this exact instance. Only the
  // instance whose own (visible) trigger was clicked ever has `open` true,
  // so this never reaches into the other breakpoint's hidden copy.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const drawer = drawerRef.current;
    const firstFocusable = drawer?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? drawer)?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeDrawer();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <>
      <nav className="hidden md:flex gap-[clamp(0px,0.4vw,4px)] items-center">
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="px-[clamp(0.45rem,1vw,0.9rem)] py-2 rounded-(--radius-full) text-[0.9rem] font-medium text-text no-underline transition-colors duration-(--transition-fast) hover:bg-primary/(--alpha-subtle) hover:text-heading"
          >
            {label}
          </a>
        ))}
      </nav>

      <button
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-(--radius-md) text-text hover:bg-primary/(--alpha-subtle) transition-colors duration-(--transition-fast)"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls={drawerId}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {mounted && createPortal(
        <>
          {open && (
            <div
              className="fixed inset-0 z-[200] bg-heading/(--alpha-medium) backdrop-blur-sm"
              onClick={closeDrawer}
            />
          )}
          <div
            id={drawerId}
            ref={drawerRef}
            inert={!open}
            aria-hidden={!open}
            tabIndex={-1}
            className={`fixed top-0 left-0 z-[201] h-full w-72 flex flex-col bg-surface/(--alpha-surface-strong) border-r border-surface/(--alpha-surface) shadow-[4px_0_32px] shadow-primary/(--alpha-medium) transition-transform duration-(--transition-normal) ${
              open ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface/(--alpha-surface)">
              <span className="text-text font-semibold text-sm">Menu</span>
              <button
                className="flex items-center justify-center w-8 h-8 rounded-(--radius-md) text-text hover:bg-primary/(--alpha-subtle) transition-colors duration-(--transition-fast)"
                onClick={closeDrawer}
                aria-label="Close menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={closeDrawer}
                  className="px-4 py-3 rounded-(--radius-md) text-[0.95rem] font-medium text-text no-underline transition-colors duration-(--transition-fast) hover:bg-primary/(--alpha-subtle) hover:text-heading"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="px-5 py-6 border-t border-surface/(--alpha-surface)">
              <Button variant="primary" href="/sign-up" className="w-full justify-center">
                Get Started Free
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
