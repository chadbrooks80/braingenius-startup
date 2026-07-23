import Image from "next/image";
import { Star } from "lucide-react";
import { getColorClass, type ColorToken } from "@/lib/theme-colors";

interface TestimonialCardProps {
  children: React.ReactNode;
  name: string;
  title: string;
  imageUrl: string;
  backgroundColor?: ColorToken;
  fontColor?: ColorToken;
}

export default function TestimonialCard({
  children,
  name,
  title,
  imageUrl,
  backgroundColor,
  fontColor = "text",
}: TestimonialCardProps) {
  /* Default card background is white at --alpha-surface (74%) */
  const bgClass = backgroundColor
    ? getColorClass(backgroundColor, "bg")
    : "bg-surface/(--alpha-surface)";
  const fontClass = getColorClass(fontColor, "text");

  return (
    <div
      className={`${bgClass} border border-surface/(--alpha-surface) rounded-2xl p-7 shadow-lg backdrop-blur-(--blur-glass) transition-transform duration-300 ease-in-out hover:-translate-y-1`}
    >
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={16} className="fill-warning text-warning" />
        ))}
      </div>

      <p className={`text-base leading-relaxed italic mb-5 ${fontClass}`}>
        <span className="text-2xl not-italic text-primary leading-none mr-1">&ldquo;</span>
        {children}
      </p>

      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border-2 border-primary/(--alpha-medium)">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <div className={`font-bold text-sm ${fontClass}`}>{name}</div>
          <div className={`text-label ${getColorClass(fontColor, "textMuted")}`}>{title}</div>
        </div>
      </div>
    </div>
  );
}
