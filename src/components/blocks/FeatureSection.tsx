"use client";

import { useEffect, useRef } from "react";
import { TrendingUp, RotateCcw, Brain, Gamepad2, BarChart2, Users, Sparkles } from "lucide-react";
import Eyebrow from "@/components/ui/Eyebrow";
import FeatureCard from "@/components/blocks/FeatureCard";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

const features = [
  {
    id: "adaptive-difficulty",
    Icon: TrendingUp,
    accentColor: "primary" as ColorToken,
    title: "Adaptive Difficulty Engine",
    description:
      "The AI continuously adjusts question difficulty based on your performance. Too easy? It challenges you more. Struggling? It slows down and reinforces. You stay perfectly in your learning zone.",
    delay: "0s",
  },
  {
    id: "spaced-repetition",
    Icon: RotateCcw,
    accentColor: "secondary" as ColorToken,
    title: "Spaced Repetition (SM-2)",
    description:
      "Words you know get reviewed less. Words you struggle with come back sooner. Built on the proven SM-2 algorithm — the same science behind Anki and Duolingo — for maximum long-term retention.",
    delay: "0.1s",
  },
  {
    id: "ai-word-lists",
    Icon: Brain,
    accentColor: "feature" as ColorToken,
    title: "AI-Generated Word Lists",
    description:
      "Teachers can generate grade-appropriate word sets in seconds using AI. Provide a topic, a book, a URL, or a PDF and the system builds structured vocabulary content ready for students.",
    delay: "0.2s",
  },
  {
    id: "game-modes",
    Icon: Gamepad2,
    accentColor: "highlight" as ColorToken,
    title: "Multiple Game Modes",
    description:
      "Beyond multiple choice — word searches, crosswords, matching games, and fill-in-the-blank challenges. The same word list powers every game type so setup happens once.",
    delay: "0.3s",
  },
  {
    id: "progress-tracking",
    Icon: BarChart2,
    accentColor: "warning" as ColorToken,
    title: "Real-Time Progress Tracking",
    description:
      "Teachers see exactly where each student stands — mastery scores, streak data, words learned, and areas needing attention. No more guessing who needs extra help.",
    delay: "0.4s",
  },
  {
    id: "class-management",
    Icon: Users,
    accentColor: "success" as ColorToken,
    title: "Roster & Class Management",
    description:
      "Create student accounts directly from the teacher dashboard. Generate usernames and login codes — no student email required. Perfect for classrooms where school emails are inconsistent.",
    delay: "0.5s",
  },
];

export default function FeatureSection() {
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("reveal-visible");
        });
      },
      { threshold: 0.12 }
    );

    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      className="py-(--spacing-section) px-(--spacing-container)"
    >
      <div className="max-w-(--max-width-container) mx-auto">
        <div
          ref={(el) => { revealRefs.current[0] = el; }}
          className="reveal-item mb-12"
        >
          <Eyebrow>
            <Sparkles className="w-3.5 h-3.5" />
            Features
          </Eyebrow>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-black leading-[1.15] tracking-[-0.025em] text-text mt-4 mb-3">
            Everything a student needs to master vocabulary
          </h2>
          <p className="text-[1.05rem] text-muted leading-[1.7] max-w-(--max-width-content)">
            Designed for real classrooms, powered by the same science that top
            language apps use — built for K-12 students.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ id, Icon, accentColor, title, description, delay }, i) => (
            <div
              key={id}
              ref={(el) => { revealRefs.current[i + 1] = el; }}
              className="reveal-item h-full"
              style={{ transitionDelay: delay }}
            >
              <FeatureCard
                icon={<Icon className={`w-6 h-6 ${getColorClass(accentColor, "text")}`} />}
                iconBgColor={accentColor}
                borderColor={accentColor}
                title={title}
              >
                {description}
              </FeatureCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
