export const REPO_URL = 'https://github.com/instantsoup/wizard-spellbook'

export type FeedbackKind = 'bug' | 'idea' | 'spell'

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string; prefix: string; labels: string }[] = [
  { value: 'bug', label: 'Something is broken', prefix: 'Bug', labels: 'bug' },
  { value: 'idea', label: 'Idea or request', prefix: 'Idea', labels: 'enhancement' },
  { value: 'spell', label: 'Wrong or missing spell', prefix: 'Spell data', labels: '' },
]

/**
 * A link to GitHub's "new issue" form, already filled in. The app has no server and no
 * GitHub login, so the issue is created by the player on github.com.
 */
export function feedbackUrl(kind: FeedbackKind, title: string, details: string, context: Record<string, string>): string {
  const k = FEEDBACK_KINDS.find((x) => x.value === kind) ?? FEEDBACK_KINDS[0]
  const info = Object.entries(context)
    .map(([key, v]) => `- ${key}: ${v}`)
    .join('\n')
  const body = `${details.trim() || '(no details)'}\n\n---\n${info}`
  const params = new URLSearchParams({ title: `${k.prefix}: ${title.trim() || '(no title)'}`, body })
  if (k.labels) params.set('labels', k.labels)
  return `${REPO_URL}/issues/new?${params}`
}
