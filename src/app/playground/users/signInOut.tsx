"use client";

import { useSession, signOut, signIn } from "next-auth/react";

export default function SignInOut() {
  const { data: session, status } = useSession();

  return (
    <div>
      {status === "authenticated" ? (
        <div>
          <p>Signed in as {session.user?.email}</p>
          <button onClick={() => signOut()}>Sign Out</button>
        </div>
      ) : (
        <button onClick={() => signIn("google")}>Sign In</button>
      )}
    </div>
  );
}