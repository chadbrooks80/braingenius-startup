import Image from "next/image";
import Eyebrow from "@/components/ui/Eyebrow";
import ExampleBlock from "@/components/blocks/ExampleBlock";
import TrustSymbol from "@/components/blocks/TrustSymbol";
import FeatureCard from "@/components/blocks/FeatureCard";
import CheckBadge from "@/components/ui/CheckBadge";
import TestimonialCard from "@/components/blocks/TestimonialCard";
import FeatureCheckCard from "@/components/blocks/FeatureCheckCard";
import {
  School,
  GraduationCap,
  Award,
  Star,
  BookOpen,
  Zap,
  ChartLine,
  RotateCw,
  Brain,
  Gamepad2,
  BarChart2,
  Users,
  Bot,
  FileText,
} from "lucide-react";

export default function PlaygroundPage() {
  return (
    <main className="flex flex-col gap-10 p-10">
      <h1 className="font-display text-2xl font-bold text-(--color-dark)">Component Playground</h1>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">CheckBadge</h2>

        <div className="flex flex-col gap-6 items-start">
          <div className="flex flex-wrap gap-3">
            <CheckBadge label="Never too easy" />
            <CheckBadge label="Never too hard" />
            <CheckBadge label="Spaced reviews" />
          </div>

          <div className="flex flex-wrap gap-3">
            <CheckBadge label="Never too easy" backgroundColor="--color-accent-cyan" fontColor="--color-dark" checkboxColor="--color-dark" />
            <CheckBadge label="Never too hard" backgroundColor="--color-accent-lime" fontColor="--color-dark" checkboxColor="--color-dark" />
            <CheckBadge label="Spaced reviews" backgroundColor="--color-accent-indigo" fontColor="--color-white" checkboxColor="--color-white" />
          </div>

          <div className="flex flex-wrap gap-3">
            <CheckBadge label="Mastery-based" checkboxColor="--color-accent-pink" />
            <CheckBadge label="Works offline" checkboxColor="--color-accent-amber" />
            <CheckBadge label="Grade-aligned" checkboxColor="--color-accent-teal" />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">Eyebrow</h2>

        <div className="flex flex-col gap-3 items-start">
          <Eyebrow>AI-Powered Vocabulary Learning</Eyebrow>
          <Eyebrow>Features</Eyebrow>
          <Eyebrow>Word Generator</Eyebrow>
          <Eyebrow>Testimonials</Eyebrow>
        </div>

        <h3 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest mt-4">Color Variants</h3>
        <div className="flex flex-col gap-3 items-start">
          <Eyebrow bgColor="--color-accent-lime" textColor="--color-dark">Lime Variant</Eyebrow>
          <Eyebrow bgColor="--color-accent-indigo" textColor="--color-accent-indigo">Indigo Variant</Eyebrow>
          <Eyebrow bgColor="--color-accent-pink" textColor="--color-accent-pink">Pink Variant</Eyebrow>
          <Eyebrow bgColor="--color-accent-amber" textColor="--color-dark">Amber Variant</Eyebrow>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">ExampleBlock</h2>

        <div className="grid grid-cols-1 gap-6 max-w-sm">
          <ExampleBlock label="Label Only">
            <p className="text-sm text-(--color-text-inverse)">Placeholder content — no status badge.</p>
          </ExampleBlock>

          <ExampleBlock label="With Status" status="Live">
            <p className="text-sm text-(--color-text-inverse)">Placeholder content — default lime status badge.</p>
          </ExampleBlock>

          <ExampleBlock label="Custom Color" status="Review" statusColor="--color-accent-indigo">
            <p className="text-sm text-(--color-text-inverse)">Placeholder content — custom indigo status badge.</p>
          </ExampleBlock>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">TrustSymbol</h2>

        <div className="flex flex-wrap gap-4">
          <TrustSymbol
            iconOrImage={<School className="w-5 h-5 text-(--color-primary-cyan)" />}
            iconBgColor="color-mix(in srgb, var(--color-primary-cyan) 12%, transparent)"
            title="Nixa Public Schools"
            subtitle="Nixa, Missouri"
          />
          <TrustSymbol
            iconOrImage={<GraduationCap className="w-5 h-5 text-(--color-accent-indigo)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-indigo) 12%, transparent)"
            title="Ozark R-VI Schools"
            subtitle="Ozark, Missouri"
          />
          <TrustSymbol
            iconOrImage={<Award className="w-5 h-5 text-(--color-accent-lime)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-lime) 12%, transparent)"
            title="EdTech Horizon Award"
            subtitle="2024 Best K-12 Tool"
          />
          <TrustSymbol
            iconOrImage={<Star className="w-5 h-5 text-(--color-accent-amber)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-amber) 12%, transparent)"
            title="4.9 / 5 Rating"
            subtitle="2,400+ reviews"
          />
          <TrustSymbol
            iconOrImage={<Zap className="w-5 h-5 text-(--color-accent-amber)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-amber) 12%, transparent)"
            title="District Ready"
            subtitle="FERPA Compliant"
          />
          <TrustSymbol
            iconOrImage={<BookOpen className="w-5 h-5 text-(--color-accent-teal)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-teal) 12%, transparent)"
            title="Reading First"
            subtitle="Curriculum Partner"
          />
          <TrustSymbol
            iconOrImage={
              <Image
                src="/person.jpeg"
                alt="TechCrunch"
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            }
            title="TechCrunch"
            subtitle="EdTech Spotlight"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">FeatureCard</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[900px]">
          <FeatureCard
            icon={<ChartLine size={22} className="text-(--color-accent-cyan)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-cyan) 15%, transparent)"
            borderColor="var(--color-accent-cyan)"
            title="Adaptive Learning"
          >
            Lessons adjust to your skill level in real time, keeping you in the optimal challenge zone.
          </FeatureCard>

          <FeatureCard
            icon={<RotateCw size={22} className="text-(--color-accent-lime)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-lime) 15%, transparent)"
            borderColor="var(--color-accent-lime)"
            title="Spaced Repetition"
          >
            Words resurface at the perfect moment so they move from short-term recall into long-term memory.
          </FeatureCard>

          <FeatureCard
            icon={<Brain size={22} className="text-(--color-accent-indigo)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-indigo) 15%, transparent)"
            borderColor="var(--color-accent-indigo)"
            title="AI-Generated Content"
          >
            Fresh passages and questions are created on demand, tuned to your grade level and interests.
          </FeatureCard>

          <FeatureCard
            icon={<Gamepad2 size={22} className="text-(--color-accent-pink)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-pink) 15%, transparent)"
            borderColor="var(--color-accent-pink)"
            title="Gamified Practice"
          >
            Earn streaks, badges, and leaderboard spots that make daily vocabulary practice feel like play.
          </FeatureCard>

          <FeatureCard
            icon={<BarChart2 size={22} className="text-(--color-accent-amber)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-amber) 15%, transparent)"
            borderColor="var(--color-accent-amber)"
            title="Progress Analytics"
          >
            Visual dashboards show mastery trends so students and teachers always know what to work on next.
          </FeatureCard>

          <FeatureCard
            icon={<Users size={22} className="text-(--color-accent-teal)" />}
            iconBgColor="color-mix(in srgb, var(--color-accent-teal) 15%, transparent)"
            borderColor="var(--color-accent-teal)"
            title="Class Management"
          >
            Assign lists, track individual progress, and share reports with parents — all in one place.
          </FeatureCard>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">TestimonialCard</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[900px]">
          <TestimonialCard
            name="Sarah M."
            title="7th Grade ELA Teacher · Nixa Public Schools"
            imageUrl="/sara.jpeg"
          >
            My students actually ask to do vocabulary practice now. The adaptive difficulty keeps them engaged because they&apos;re always working at exactly the right level.
          </TestimonialCard>

          <TestimonialCard
            name="Marcus T."
            title="8th Grade Science Teacher · Springfield, MO"
            imageUrl="/sara.jpeg"
            backgroundColor="color-dark"
            fontColor="color-white"
          >
            I used to spend hours building vocab lists for each unit. Now BrainGenius generates a complete word set with definitions in about 30 seconds.
          </TestimonialCard>

          <TestimonialCard
            name="Jayla R."
            title="9th Grade Student · Ozark High School"
            imageUrl="/sara.jpeg"
            backgroundColor="color-bg-top"
            fontColor="color-dark"
          >
            It&apos;s like having a tutor that remembers every word I&apos;ve ever gotten wrong. I went from a C to an A in English this semester.
          </TestimonialCard>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-sm text-(--color-text-muted) uppercase tracking-widest">FeatureCheckCard</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1200px]">
          <FeatureCheckCard
            icon={<Bot size={24} className="text-(--color-primary-cyan)" />}
            iconBackgroundColor="color-mix(in srgb, var(--color-primary-cyan) 12%, transparent)"
            title="AI-Generated Words by Topic"
            checkItems={[
              "Any subject or theme",
              "Matches grade-level complexity",
              "Includes context-specific definitions",
              'Refine in conversation: "make these harder"',
            ]}
          >
            Tell the AI what you&apos;re studying — ancient civilizations, ecosystems, the Civil War — and it generates a rich vocabulary set tailored to that topic.
          </FeatureCheckCard>

          <FeatureCheckCard
            icon={<GraduationCap size={24} className="text-accent-indigo" />}
            iconBackgroundColor="color-mix(in srgb, var(--color-accent-indigo) 15%, transparent)"
            title="Recommended Words by Grade Level"
            checkItems={[
              "K–12 grade bands supported",
              "Aligned to reading level expectations",
              "Pre-loaded definitions & example sentences",
              "Instantly ready for student practice",
            ]}
            checkboxColor="color-accent-indigo"
          >
            Instantly generate a vocabulary list aligned to your students&apos; grade, curated from academic standards and leveled reading lists.
          </FeatureCheckCard>

          <FeatureCheckCard
            icon={<FileText size={24} className="text-white" />}
            iconBackgroundColor="color-mix(in srgb, var(--color-white) 12%, transparent)"
            title="Words from URLs or PDF Uploads"
            checkItems={[
              "Paste any HTML link or article URL",
              "Upload PDFs (textbooks, worksheets)",
              "AI picks the most useful words",
              "Filtered to match your grade level",
            ]}
            backgroundColor="color-dark"
            fontColor="color-white"
            checkboxColor="color-secondary-lime"
          >
            Upload a PDF or paste a webpage link and BrainGenius extracts the most valuable vocabulary for your students automatically.
          </FeatureCheckCard>
        </div>
      </section>
    </main>
  );
}
