import { formatISO, parseISO, format } from "date-fns";

export interface MessageTimestampMeta {
  iso: string;
  formatted: string;
}

export function getMessageTimestampMeta(createdAt?: string): MessageTimestampMeta | null {
  if (!createdAt) {
    return null;
  }

  const parsed = parseISO(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const iso = formatISO(parsed);
  const formatted = format(parsed, "MMM d, yyyy • h:mm:ss a");

  return { iso, formatted };
}
