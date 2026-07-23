"use client";

import { useEffect, useRef } from "react";
import { Rocket } from "lucide-react";
import Button from "@/components/ui/Button";

export default function CTASection() {
  const revealRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("reveal-visible");
        });
      },
      { threshold: 0.12 }
    );

    if (revealRef.current) observer.observe(revealRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="px-(--spacing-container) mb-20">
      <div
        ref={revealRef}
        className="reveal-item max-w-(--max-width-container) mx-auto rounded-[2rem] text-center px-12 py-16 relative overflow-hidden shadow-(--shadow-2xl) bg-linear-[135deg] from-heading to-text"
      >
        {/* cyan glow top-right */}
        <div className="absolute top-[-6rem] right-[-6rem] w-80 h-80 rounded-full pointer-events-none bg-radial/srgb from-primary/(--alpha-soft) to-transparent to-70%" />
        {/* lime glow bottom-left */}
        <div className="absolute bottom-[-5rem] left-[-4rem] w-64 h-64 rounded-full pointer-events-none bg-radial/srgb from-secondary/(--alpha-subtle) to-transparent to-70%" />

        <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-black text-surface mb-3 relative z-10">
          Ready to transform how your students learn vocabulary?
        </h2>
        <p className="text-[1.05rem] leading-[1.7] max-w-[40rem] mx-auto mb-8 relative z-10 text-surface/(--alpha-surface-soft)">
          Join hundreds of teachers using AI-powered adaptive learning to close
          vocabulary gaps for good. Free to start — no credit card needed.
        </p>

        <div className="flex justify-center relative z-10">
          <Button variant="primary" href="/sign-up">
            <Rocket className="w-4 h-4" />
            Get Started For Free!
          </Button>
        </div>
      </div>
    </section>
  );
}
