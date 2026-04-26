export function buildPhase1Prompt(ticket) {
  return [
    {
      role: 'system',
      content: `You are a support ticket triage assistant. Analyze the ticket and return ONLY a valid JSON object with no markdown, no explanation, and no extra text.

Required fields (exact names and values):
- category: "billing" | "technical" | "account" | "feature_request" | "other"
- priority: "critical" | "high" | "medium" | "low"
- sentiment: "positive" | "neutral" | "negative" | "frustrated"
- escalation: boolean (true or false)
- routingTarget: "tier1" | "tier2" | "billing_team" | "engineering" | "account_management"
- summary: string, min 10 chars, max 300 chars

Priority guide:
- critical: System down, data loss, security breach
- high: Major feature broken, significant user impact
- medium: Minor issue, workaround available
- low: General inquiry, feature request

Example output:
{"category":"technical","priority":"high","sentiment":"frustrated","escalation":false,"routingTarget":"tier2","summary":"User unable to log in despite correct credentials. Issue persists for over 1 hour with no resolution."}`,
    },
    {
      role: 'user',
      content: `Subject: ${ticket.subject}\n\n${ticket.body}`,
    },
  ];
}
