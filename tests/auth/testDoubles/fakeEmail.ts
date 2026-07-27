type SentEmail = {
  type: "verification-code" | "password-reset";
  email: string;
  payload: string;
};

let sentEmails: SentEmail[] = [];
let failNextSend = false;

export function __resetFakeEmail(): void {
  sentEmails = [];
  failNextSend = false;
}

export function __getSentEmails(): SentEmail[] {
  return sentEmails;
}

// Simulates the provider rejecting the next send, so callers can prove
// delivery failure still returns the established generic contract instead
// of surfacing the provider error.
export function __failNextSend(): void {
  failNextSend = true;
}

export async function sendVerificationCodeEmail(email: string, code: string): Promise<void> {
  if (failNextSend) {
    failNextSend = false;
    throw new Error("fakeEmail: simulated provider failure");
  }
  sentEmails.push({ type: "verification-code", email, payload: code });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  if (failNextSend) {
    failNextSend = false;
    throw new Error("fakeEmail: simulated provider failure");
  }
  sentEmails.push({ type: "password-reset", email, payload: resetUrl });
}
