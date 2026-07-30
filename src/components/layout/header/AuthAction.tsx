"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Button, { type ButtonSize } from "@/components/ui/Button";

type AuthActionProps = {
  isAuthenticated: boolean;
  size?: ButtonSize;
  className?: string;
};

export default function AuthAction({ isAuthenticated, size, className }: AuthActionProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (isAuthenticated) {
    return (
      <Button
        variant="secondary"
        size={size}
        className={className}
        disabled={isSigningOut}
        onClick={() => {
          setIsSigningOut(true);
          void signOut();
        }}
      >
        {isSigningOut ? "Signing Out..." : "Sign Out"}
      </Button>
    );
  }

  return (
    <Button variant="secondary" size={size} href="/sign-in" className={className}>
      Sign In
    </Button>
  );
}
