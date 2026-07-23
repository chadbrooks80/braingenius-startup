"use client";

import { useEffect, useRef } from "react";
import { Wand2, GraduationCap, Bot, FileText } from "lucide-react";
import Eyebrow from "@/components/ui/Eyebrow";
import FeatureCheckCard from "@/components/blocks/FeatureCheckCard";
import type { ColorToken } from "@/lib/theme-colors";

type CardConfig = {
  icon: React.ReactNode;
  iconBackgroundColor: ColorToken;
  title: string;
  description: string;
  checkItems: string[];
  backgroundColor?: ColorToken;
  fontColor?: ColorToken;
  checkboxColor?: ColorToken;
  delay: string;
};

const CARDS: CardConfig[] = [
  {
    icon: <GraduationCap size={24} className="text-surface" />,
    iconBackgroundColor: "surface",
    title: "Recommended Words by Grade Level",
    description:
      "Instantly generate a vocabulary list aligned to your students\u2019 grade. Words are curated from academic standards and leveled reading lists.",
    checkItems: [
      "K\u201312 grade bands supported",
      "Aligned to reading level expectations",
      "Pre-loaded definitions, prompts & example sentences",
      "Instantly ready for student practice",
    ],
    backgroundColor: "heading",
    fontColor: "surface",
    checkboxColor: "secondary",
    delay: "0s",
  },
  {
    icon: <Bot size={24} className="text-primary" />,
    iconBackgroundColor: "primary",
    title: "AI-Generated Words by Topic",
    description:
      "Tell the AI what you\u2019re studying \u2014 ancient civilizations, ecosystems, the Civil War \u2014 and it generates a rich vocabulary set tailored to that topic.",
    checkItems: [
      "Any subject or theme",
      "Matches grade-level reading complexity",
      "Includes context-specific definitions",
      'Refine in conversation: \u201cmake these harder\u201d',
    ],
    delay: "0.1s",
  },
  {
    icon: <FileText size={24} className="text-surface" />,
    iconBackgroundColor: "surface",
    title: "Words from URLs or PDF Uploads",
    description:
      "Paste a webpage link or upload a PDF \u2014 a textbook chapter, article, or passage \u2014 and BrainGenius.ai extracts the most valuable vocabulary for your students.",
    checkItems: [
      "Paste any HTML link or article URL",
      "Upload PDFs (textbooks, worksheets, passages)",
      "AI picks the most academically useful words",
      "Filtered to match your grade level setting",
    ],
    backgroundColor: "heading",
    fontColor: "surface",
    checkboxColor: "secondary",
    delay: "0.2s",
  },
];

export default function WordGeneratorSection() {
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
      id="word-generator"
      className="py-(--spacing-section) px-(--spacing-container)"
    >
      <div className="max-w-container mx-auto">
        <div
          ref={(el) => { revealRefs.current[0] = el; }}
          className="reveal-item mb-12"
        >
          <Eyebrow>
            <Wand2 className="w-3.5 h-3.5" />
            Word Generator
          </Eyebrow>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-black leading-[1.15] tracking-[-0.025em] text-text mt-4 mb-3">
            Generate words for your students to learn through various sources
          </h2>
          <p className="text-[1.05rem] text-muted leading-[1.7] max-w-(--max-width-content)">
            Stop spending hours building word lists manually. Let the AI do the heavy lifting &mdash; from grade-level standards to custom topics to extracting vocabulary straight from your curriculum.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CARDS.map(({ icon, iconBackgroundColor, title, description, checkItems, backgroundColor, fontColor, checkboxColor, delay }, i) => (
            <div
              key={title}
              ref={(el) => { revealRefs.current[i + 1] = el; }}
              className="reveal-item h-full"
              style={{ transitionDelay: delay }}
            >
              <FeatureCheckCard
                icon={icon}
                iconBackgroundColor={iconBackgroundColor}
                title={title}
                checkItems={[...checkItems]}
                backgroundColor={backgroundColor}
                fontColor={fontColor}
                checkboxColor={checkboxColor}
              >
                {description}
              </FeatureCheckCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
