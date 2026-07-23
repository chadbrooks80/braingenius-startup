import Image from "next/image";
import HeaderNav from "./HeaderNav";
import Button from "@/components/ui/Button";

export default function Header() {
  return (
    <header className="sticky top-0 z-[100] border-b border-surface/(--alpha-surface) bg-surface/(--alpha-surface-strong) backdrop-blur-header shadow-[0_10px_35px] shadow-primary/(--alpha-medium)">
      {/* Mobile: 3-col grid keeps logo perfectly centered between hamburger and CTA */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center px-1 md:px-6 py-3 md:hidden max-w-(--max-width-container) mx-auto">
        <HeaderNav />
        <Image src="/logo.png" alt="BrainGenius.ai" height={56} width={200} loading="eager" className="justify-self-center max-w-[200px] w-[90%] h-auto" />
        <div className="flex justify-end">
          <Button variant="cta" size="sm" href="/sign-up">
            Get Started Free
          </Button>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between gap-6 px-6 py-3 max-w-(--max-width-container) mx-auto">
        <div className="flex-shrink-0">
          <Image src="/logo.png" alt="BrainGenius.ai" height={56} width={200} loading="eager" className="h-[clamp(28px,3.9vw,56px)] w-auto" />
        </div>
        <HeaderNav />
        <Button variant="cta" href="/sign-up">
          Get Started Free
        </Button>
      </div>
    </header>
  );
}
