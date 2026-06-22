"use client";

import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import Eyebrow from "@/components/ui/Eyebrow";
import TestimonialCard from "@/components/blocks/TestimonialCard";

type TestimonialData = {
  name: string;
  title: string;
  quote: string;
  imageUrl: string;
};

const TESTIMONIALS: TestimonialData[] = [
  {
    name: "Sarah M.",
    title: "7th Grade ELA Teacher · Nixa Public Schools",
    quote:
      "My students actually ask to do vocabulary practice now. The adaptive difficulty keeps them engaged because they're always working at exactly the right level — not bored, not frustrated.",
    imageUrl: "/sara.jpeg",
  },
  {
    name: "Marcus T.",
    title: "8th Grade Science Teacher · Springfield, MO",
    quote:
      "I used to spend hours building vocab lists for each unit. Now I paste in a PDF of our textbook chapter and BrainGenius generates a complete word set with definitions in about 30 seconds.",
    imageUrl: "/sara.jpeg",
  },
  {
    name: "Jayla R.",
    title: "9th Grade Student · Ozark High School",
    quote:
      "It's like having a tutor that remembers every word I've ever gotten wrong. I went from a C to an A in English this semester and my teacher says my writing vocabulary has completely changed.",
    imageUrl: "/sara.jpeg",
  },
  {
    name: "Donna K.",
    title: "Curriculum Coordinator · Greene County Schools",
    quote:
      "The spaced repetition is genuinely different from flashcards. My students retain vocabulary from units we covered months ago. Test scores on cumulative assessments have jumped noticeably.",
    imageUrl: "/sara.jpeg",
  },
  {
    name: "Brian A.",
    title: "5th Grade Teacher · Willard R-II School District",
    quote:
      "Setting up student accounts was painless. I generated usernames and codes for my whole class in minutes. No scrambling for school emails, no IT tickets — just ready to practice on day one.",
    imageUrl: "/sara.jpeg",
  },
  {
    name: "Tyler W.",
    title: "6th Grade Student · Nixa Middle School",
    quote:
      "I love the word search and matching games. It doesn't feel like studying — it feels like a game. But then I actually know the words on the test. My mom thinks I studied all night but it was just BrainGenius.",
    imageUrl: "/sara.jpeg",
  },
];

export default function TestimonialsSection() {
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
      id="testimonials"
      className="py-(--spacing-section) px-(--spacing-container)"
    >
      <div className="max-w-container mx-auto">
        <div
          ref={(el) => { revealRefs.current[0] = el; }}
          className="reveal-item mb-12"
        >
          <Eyebrow bgColor="--color-accent-indigo" textColor="--color-accent-indigo">
            <Heart className="w-3.5 h-3.5" />
            Testimonials
          </Eyebrow>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-black leading-[1.15] tracking-[-0.025em] text-text-primary mt-4 mb-3">
            Students and teachers love it
          </h2>
          <p className="text-[1.05rem] text-text-muted leading-[1.7] max-w-(--max-width-content)">
            Real results from real classrooms. Here&rsquo;s what educators and students are saying.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, title, quote, imageUrl }, i) => (
            <div
              key={name}
              ref={(el) => { revealRefs.current[i + 1] = el; }}
              className="reveal-item"
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <TestimonialCard name={name} title={title} imageUrl={imageUrl}>
                {quote}
              </TestimonialCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
