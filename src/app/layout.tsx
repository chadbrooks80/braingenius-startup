import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Baloo_2 } from "next/font/google";
import "./globals.css";
import AuthProvider from "./auth/Provider";


const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BrainGenius AI",
  description: "AI-powered vocabulary and reading comprehension platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${baloo.variable}`}
    >
      <body className="font-sans min-h-screen flex flex-col text-text">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
