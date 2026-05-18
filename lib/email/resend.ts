import { Resend } from "resend";

let resend: Resend | null = null;
let missingKeyWarned = false;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    // Warn once on first invocation so operators can spot a misconfigured
    // environment, without flooding logs when the app does many sends.
    if (!missingKeyWarned) {
      console.warn("[Email] RESEND_API_KEY not set, email notifications disabled");
      missingKeyWarned = true;
    }
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = "AtomQuest <noreply@atomberg.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();
  if (!client) return { success: true }; // Graceful no-op

  try {
    await client.emails.send({ from: FROM_EMAIL, to, subject, html });
    return { success: true };
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return { success: false, error: String(error) };
  }
}

// === Shared template chrome ===
function shell(body: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;max-width:600px;margin:0 auto;background:#f9f9f9">
  <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
    <h2 style="color:#f59e0b;margin:0;font-size:20px">AtomQuest Goal Portal</h2>
    <p style="color:#a0a0b8;margin:4px 0 0;font-size:12px">by Atomberg Technologies</p>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
    ${body}
  </div>
  <p style="color:#888;font-size:11px;margin-top:16px;text-align:center">
    You are receiving this because you have an account on AtomQuest.
  </p>
</div>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#f59e0b;color:#1a1a2e;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">${label}</a></p>`;
}

// === Notification templates ===

export async function notifySheetSubmitted(
  employee: { id: string; name: string; email: string },
  manager: { name: string; email: string },
  sheetId: string
): Promise<{ success: boolean; error?: string }> {
  if (!manager.email) return { success: true };
  const reviewUrl = `${APP_URL}/manager/team/${employee.id}/goals`;
  return sendEmail(
    manager.email,
    `Goal sheet submitted, ${employee.name}`,
    shell(
      `<p>Hi ${manager.name},</p>
       <p><strong>${employee.name}</strong> has submitted their goal sheet and is awaiting your review.</p>
       <p style="color:#666;font-size:12px">Sheet reference: <code>${sheetId}</code></p>
       ${cta(reviewUrl, "Review Now →")}`
    )
  );
}

/**
 * Confirmation receipt sent to the EMPLOYEE on submit, in addition to the
 * manager notification above. Closes the "did it go through" loop so a
 * first-time submitter doesn't have to guess from the success toast alone.
 */
export async function notifySheetSubmittedReceipt(
  employee: { name: string; email: string },
  sheetId: string
): Promise<{ success: boolean; error?: string }> {
  if (!employee.email) return { success: true };
  const sheetUrl = `${APP_URL}/goals/${sheetId}`;
  return sendEmail(
    employee.email,
    "Your goal sheet was submitted",
    shell(
      `<p>Hi ${employee.name},</p>
       <p>We received your goal sheet. Your manager has been notified and will review it shortly.</p>
       <p>You can keep tabs on its status anytime:</p>
       ${cta(sheetUrl, "View your sheet →")}
       <p style="color:#666;font-size:12px;margin-top:16px">If you need to make changes, your manager can return the sheet for revision.</p>`
    )
  );
}

export async function notifySheetApproved(
  employee: { name: string; email: string },
  sheetId: string
): Promise<{ success: boolean; error?: string }> {
  if (!employee.email) return { success: true };
  const sheetUrl = `${APP_URL}/goals/${sheetId}`;
  return sendEmail(
    employee.email,
    "Your Goal Sheet Has Been Approved",
    shell(
      `<p>Hi ${employee.name},</p>
       <p>Your goal sheet has been <strong style="color:#10b981">approved</strong> by your manager.</p>
       <p>You can now submit quarterly check-ins as each quarter window opens.</p>
       ${cta(sheetUrl, "View Goal Sheet →")}`
    )
  );
}

export async function notifySheetReturned(
  employee: { name: string; email: string },
  reason: string,
  sheetId: string
): Promise<{ success: boolean; error?: string }> {
  if (!employee.email) return { success: true };
  const sheetUrl = `${APP_URL}/goals/${sheetId}`;
  return sendEmail(
    employee.email,
    "Your Goal Sheet Has Been Returned",
    shell(
      `<p>Hi ${employee.name},</p>
       <p>Your goal sheet has been <strong style="color:#ef4444">returned</strong> for revision.</p>
       <div style="background:#fef2f2;border:1px solid #fecaca;padding:14px 16px;margin:14px 0;border-radius:6px">
         <p style="margin:0;font-size:12px;color:#991b1b;font-weight:600">Manager's reason</p>
         <p style="margin:6px 0 0;color:#7f1d1d">${reason}</p>
       </div>
       ${cta(sheetUrl, "Edit &amp; Resubmit →")}`
    )
  );
}

export async function notifyCheckinWindow(
  employeeEmail: string,
  quarter: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(
    employeeEmail,
    `${quarter} Check-in Window is Open`,
    shell(
      `<p>The <strong>${quarter}</strong> check-in window is now open.</p>
       <p>Please log your quarterly progress on each goal.</p>
       ${cta(`${APP_URL}/dashboard`, "Check-in Now →")}`
    )
  );
}

export async function notifyOverdue(
  employeeEmail: string,
  type: string
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(
    employeeEmail,
    `Reminder: ${type} Overdue`,
    shell(
      `<p>Your <strong>${type}</strong> is overdue. Please take action.</p>
       ${cta(`${APP_URL}/dashboard`, "Take Action →")}`
    )
  );
}
