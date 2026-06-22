import Image from "next/image";
import { Star } from "lucide-react";

interface TestimonialCardProps {
  children: React.ReactNode;
  name: string;
  title: string;
  imageUrl: string;
  backgroundColor?: string;
  fontColor?: string;
}

export default function TestimonialCard({
  children,
  name,
  title,
  imageUrl,
  backgroundColor,
  fontColor,
}: TestimonialCardProps) {
  return (
    <div
      style={
        {
          "--card-bg": backgroundColor ? `var(--${backgroundColor})` : "var(--color-surface)",
          "--card-font": fontColor ? `var(--${fontColor})` : "var(--color-text-primary)",
        } as React.CSSProperties
      }
      className="bg-(--card-bg) border border-border-soft rounded-2xl p-7 shadow-lg backdrop-blur-(--blur-glass) transition-transform duration-300 ease-in-out hover:-translate-y-1"
    >
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={16} className="fill-accent-amber text-accent-amber" />
        ))}
      </div>

      <p className="text-base leading-relaxed italic mb-5 text-(--card-font)">
        <span className="text-2xl not-italic text-(--color-primary-cyan) leading-none mr-1">&ldquo;</span>
        {children}
      </p>

      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border-2 border-(--color-primary-cyan)/40">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <div className="font-bold text-sm text-(--card-font)">{name}</div>
          <div className="text-label text-(--card-font)/60">{title}</div>
        </div>
      </div>
    </div>
  );
}
