import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrainGenius – Learning Engine",
  description: "Learning Engine prototype",
};

export default function LearningLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-full flex flex-col">{children}</div>;
}