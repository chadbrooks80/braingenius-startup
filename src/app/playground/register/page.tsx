"use client";

import { useActionState } from "react";
import { registerUser } from "@/actions/register";

type ActionState = { success: boolean; error?: string } | null;

export default function RegisterForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => registerUser(formData),
    null
  );

  return (
    <form action={action}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit" disabled={pending}>
        {pending ? "Signing up..." : "Sign Up"}
      </button>
      {state && !state.success && <p>{state.error}</p>}
      {state?.success && <p>Account created successfully.</p>}
    </form>
  );
}
