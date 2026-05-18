/**
 * Microsoft Teams notifications via a Workflow webhook (BRD §5.2).
 *
 * Setup (done once, by the user, in the Teams desktop / web client):
 *   1. Pick a channel → ⋯ → Workflows → "Post to a channel when a webhook
 *      request is received".
 *   2. Click through the wizard, copy the resulting webhook URL.
 *   3. Set TEAMS_WEBHOOK_URL=<that url> in .env.local (or Vercel env).
 *
 * If TEAMS_WEBHOOK_URL is unset, every call here is a silent no-op so the
 * rest of the app keeps working in environments without Teams configured —
 * same pattern as our Resend integration.
 *
 * Card schema: Adaptive Card 1.5 wrapped in the message-with-attachments
 * envelope that Teams Workflows expects.
 */

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

type AdaptiveElement = Record<string, unknown>;

interface CardOptions {
  title: string;
  subtitle?: string;
  /** Coloured accent shown above the title — "good" / "warning" / "attention" / "accent". */
  accent?: "good" | "warning" | "attention" | "accent" | "default";
  facts?: Array<{ title: string; value: string }>;
  body?: string;
  /** Optional button. Use a relative path (e.g. "/manager/dashboard") or full URL. */
  cta?: { label: string; href: string };
}

function buildCard(opts: CardOptions): AdaptiveElement {
  const elements: AdaptiveElement[] = [
    {
      type: "TextBlock",
      text: opts.title,
      weight: "Bolder",
      size: "Medium",
      color: opts.accent ?? "default",
      wrap: true,
    },
  ];
  if (opts.subtitle) {
    elements.push({
      type: "TextBlock",
      text: opts.subtitle,
      isSubtle: true,
      spacing: "None",
      wrap: true,
    });
  }
  if (opts.body) {
    elements.push({ type: "TextBlock", text: opts.body, wrap: true });
  }
  if (opts.facts && opts.facts.length > 0) {
    elements.push({
      type: "FactSet",
      facts: opts.facts,
    });
  }

  const actions: AdaptiveElement[] = [];
  if (opts.cta) {
    const url = opts.cta.href.startsWith("http")
      ? opts.cta.href
      : `${APP_URL}${opts.cta.href}`;
    actions.push({
      type: "Action.OpenUrl",
      title: opts.cta.label,
      url,
    });
  }

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: elements,
    actions,
  };
}

let missingWebhookWarned = false;

/**
 * Post an adaptive card to the configured Teams channel.
 * Returns { success: true } when no webhook is configured (graceful no-op)
 * so callers don't need to check the env var themselves.
 */
export async function sendTeamsCard(
  opts: CardOptions
): Promise<{ success: boolean; error?: string }> {
  if (!TEAMS_WEBHOOK_URL) {
    if (!missingWebhookWarned) {
      console.warn("[Teams] TEAMS_WEBHOOK_URL not set, Teams notifications disabled");
      missingWebhookWarned = true;
    }
    return { success: true };
  }
  try {
    const payload = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: buildCard(opts),
        },
      ],
    };
    const res = await fetch(TEAMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Teams] webhook returned non-OK:", res.status, text);
      return { success: false, error: `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    console.error("[Teams] send failed:", err);
    return { success: false, error: String(err) };
  }
}

// ===========================================================
// Event-specific card helpers — keep the call sites readable.
// Deep links go directly to the relevant page so the recipient
// can act on the notification in one click (BRD §5.2).
// ===========================================================

export async function teamsNotifySubmitted(
  employee: { name: string },
  manager: { name: string },
  sheetId: string
) {
  return sendTeamsCard({
    accent: "warning",
    title: "🎯 Goal sheet submitted — review needed",
    subtitle: `${employee.name} submitted their goal sheet`,
    facts: [
      { title: "Employee", value: employee.name },
      { title: "Reviewer", value: manager.name },
      { title: "Status", value: "Awaiting your approval" },
    ],
    cta: {
      label: "Open in AtomQuest →",
      href: `/manager/team/${sheetId}/goals`,
    },
  });
}

export async function teamsNotifyApproved(
  employee: { name: string },
  sheetId: string
) {
  return sendTeamsCard({
    accent: "good",
    title: "✅ Goal sheet approved",
    subtitle: `${employee.name}'s goals are now active for the cycle`,
    facts: [
      { title: "Employee", value: employee.name },
      { title: "Status", value: "Approved · locked for editing" },
    ],
    cta: { label: "View sheet", href: `/goals/${sheetId}` },
  });
}

export async function teamsNotifyReturned(
  employee: { name: string },
  reason: string,
  sheetId: string
) {
  return sendTeamsCard({
    accent: "attention",
    title: "↩️ Goal sheet returned for revision",
    subtitle: employee.name,
    facts: [
      { title: "Employee", value: employee.name },
      { title: "Reason", value: reason },
    ],
    cta: { label: "Open & revise", href: `/goals/${sheetId}` },
  });
}

export async function teamsNotifyOverdue(
  who: string,
  type: string
) {
  return sendTeamsCard({
    accent: "attention",
    title: `⏰ ${type} overdue`,
    subtitle: who,
    body: `Please take action — this is past the escalation threshold.`,
    cta: { label: "Take action", href: "/dashboard" },
  });
}
