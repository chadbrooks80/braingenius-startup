import { School, GraduationCap, Award, ShieldCheck } from "lucide-react";
import TrustSymbol from "@/components/blocks/TrustSymbol";

const TRUST_ITEMS = [
  {
    title: "Nixa Public Schools",
    subtitle: "Nixa, Missouri",
    icon: <School size={18} className="text-(--color-accent-teal)" />,
    iconBgColor: "var(--color-icon-bg-teal)",
  },
  {
    title: "Ozark R-VI Schools",
    subtitle: "Ozark, Missouri",
    icon: <GraduationCap size={18} className="text-(--color-accent-indigo)" />,
    iconBgColor: "var(--color-icon-bg-indigo)",
  },
  {
    title: "EdTech Horizon Award",
    subtitle: "2024 Best K-12 Tool",
    icon: <Award size={18} className="text-(--color-secondary-lime)" />,
    iconBgColor: "var(--color-icon-bg-lime)",
  },
];

export default function TrustSection() {
  return (
    <section className="py-14 px-6 bg-(--color-surface-strong) border-t border-(--color-border-soft) border-b">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-center text-[0.78rem] font-semibold tracking-[0.2em] uppercase text-(--color-text-muted) mb-8 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-(--color-accent-cyan)" />
          Trusted by schools and educators
        </p>
        <div className="flex items-center justify-center gap-12 flex-wrap">
          {TRUST_ITEMS.map((item) => (
            <TrustSymbol
              key={item.title}
              title={item.title}
              subtitle={item.subtitle}
              iconOrImage={item.icon}
              iconBgColor={item.iconBgColor}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
