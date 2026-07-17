"use client";

import { useState, useSyncExternalStore } from "react";
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

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToClientEnvironment,
    getClientSnapshot,
    getServerSnapshot
  );

  return (
    <>
      <nav className="hidden md:flex gap-[clamp(0px,0.4vw,4px)] items-center">
        {NAV_LINKS.map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className="px-[clamp(0.45rem,1vw,0.9rem)] py-2 rounded-(--radius-full) text-[0.9rem] font-medium text-(--color-text-primary) no-underline transition-colors duration-(--transition-fast) hover:bg-(--color-primary-cyan)/12 hover:text-(--color-dark)"
          >
            {label}
          </a>
        ))}
      </nav>

      <button
        className="md:hidden flex items-center justify-center w-10 h-10 rounded-(--radius-md) text-(--color-text-primary) hover:bg-(--color-primary-cyan)/12 transition-colors duration-(--transition-fast)"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {mounted && createPortal(
        <>
          {open && (
            <div
              className="fixed inset-0 z-[200] bg-(--color-dark)/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
          )}
          <div
            className={`fixed top-0 left-0 z-[201] h-full w-72 flex flex-col bg-(--color-surface-strong) border-r border-(--color-border-soft) shadow-[4px_0_32px_var(--color-glow-cyan)] transition-transform duration-(--transition-normal) ${
              open ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-border-soft)">
              <span className="text-(--color-text-primary) font-semibold text-sm">Menu</span>
              <button
                className="flex items-center justify-center w-8 h-8 rounded-(--radius-md) text-(--color-text-primary) hover:bg-(--color-primary-cyan)/12 transition-colors duration-(--transition-fast)"
                onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-(--radius-md) text-[0.95rem] font-medium text-(--color-text-primary) no-underline transition-colors duration-(--transition-fast) hover:bg-(--color-primary-cyan)/12 hover:text-(--color-dark)"
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="px-5 py-6 border-t border-(--color-border-soft)">
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
