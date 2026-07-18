export function normalizeSpeechQueue(text: string | string[]): string[] {
  const entries = Array.isArray(text) ? text : [text];
  return entries.filter((entry) => entry.trim() !== "");
}
