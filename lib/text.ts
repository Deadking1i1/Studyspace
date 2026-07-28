export function sanitizePlain(value: FormDataEntryValue | string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ");
}

export function summarizeText(text: string | null | undefined) {
  if (!text) return "No content available to summarise.";
  const cleaned = String(text).replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 20);
  if (!sentences.length) return cleaned.slice(0, 140) + (cleaned.length > 140 ? "..." : "");
  const summary = sentences.slice(0, 2).join(" ");
  return summary.length > 220 ? `${summary.slice(0, 220).trimEnd()}...` : summary;
}

export function parseIsoDate(value: FormDataEntryValue | string | null | undefined) {
  const cleaned = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return null;
  const parsed = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return cleaned;
}
