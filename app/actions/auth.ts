"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/goals";
import type { Profile, Role } from "@/types";

/**
 * Ensure the authenticated user has a row in `profiles`. If they don't (which
 * happens when an auth user was created before the `handle_new_user` trigger
 * was installed, or when the trigger silently errored), create one using the
 * service-role client to bypass RLS.
 *
 * Returns the resolved profile so the client can render immediately.
 */
export async function ensureProfile(): Promise<ActionResult<Profile>> {
  try {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return { error: "Not authenticated" };
    }

    // Check via the user's own client (respects RLS — they're allowed to read
    // their own row per policy "Users can view own profile")
    const { data: existing, error: readErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (readErr) {
      console.error("[ensureProfile] read failed:", readErr);
      return { error: `Profile read failed: ${readErr.message}` };
    }

    if (existing) {
      return { data: existing as Profile };
    }

    // No row — create one with the service client so we bypass the
    // INSERT-restricted-to-admin policy. This is the recovery path for demos
    // where auth users predate the handle_new_user trigger.
    const serviceClient = await createServiceClient();
    const inferredName =
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split("@")[0] ||
      "User";
    const inferredRole: Role =
      (user.user_metadata?.role as Role | undefined) || "employee";

    const { data: created, error: insertErr } = await serviceClient
      .from("profiles")
      .insert({
        id: user.id,
        name: inferredName,
        email: user.email ?? "",
        role: inferredRole,
      })
      .select()
      .single();

    if (insertErr || !created) {
      console.error("[ensureProfile] insert failed:", insertErr);
      return {
        error:
          `Could not auto-create profile (${insertErr?.message || "unknown"}). ` +
          `Make sure SUPABASE_SERVICE_ROLE_KEY is set and the handle_new_user trigger from migration 003 is installed.`,
      };
    }

    return { data: created as Profile };
  } catch (err) {
    console.error("[ensureProfile] unexpected:", err);
    return {
      error: err instanceof Error ? err.message : "Unexpected error ensuring profile",
    };
  }
}
