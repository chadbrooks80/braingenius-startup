import { School, GraduationCap, Award, ShieldCheck } from "lucide-react";
import TrustSymbol from "@/components/blocks/TrustSymbol";
import type { ColorTokenFor } from "@/lib/theme-colors";

const TRUST_ITEMS: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBgColor: ColorTokenFor<"iconBg">;
}[] = [
  {
    title: "Nixa Public Schools",
    subtitle: "Nixa, Missouri",
    icon: <School size={18} className="text-success" />,
    iconBgColor: "primary",
  },
  {
    title: "Ozark R-VI Schools",
    subtitle: "Ozark, Missouri",
    icon: <GraduationCap size={18} className="text-feature" />,
    iconBgColor: "feature",
  },
  {
    title: "EdTech Horizon Award",
    subtitle: "2024 Best K-12 Tool",
    icon: <Award size={18} className="text-secondary" />,
    iconBgColor: "secondary",
  },
];

export default function TrustSection() {
  return (
    <section className="py-14 px-6 bg-surface/(--alpha-surface-strong) border-t border-surface/(--alpha-surface) border-b">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-center text-[0.78rem] font-semibold tracking-[0.2em] uppercase text-muted mb-8 flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-primary" />
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
