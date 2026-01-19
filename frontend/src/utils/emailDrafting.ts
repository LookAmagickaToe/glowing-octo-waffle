export interface EmailDraft {
  subject: string;
  body: string;
}

export const parseEmailDraft = (raw: string): EmailDraft => {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const trimmed = cleaned;
  if (!trimmed) {
    return { subject: '', body: '' };
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<EmailDraft>;
    if (parsed.subject && parsed.body) {
      return {
        subject: String(parsed.subject),
        body: String(parsed.body),
      };
    }
  } catch {
    // Fallback to heuristic parsing.
  }

  const subjectMatch = trimmed.match(/^\s*Subject:\s*(.+)$/im);
  const subject = subjectMatch?.[1]?.trim() || 'Regarding your research';
  const body = trimmed.replace(/^\s*Subject:.*$/im, '').trim();

  return {
    subject,
    body: body || trimmed,
  };
};
