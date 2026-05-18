import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

// Caches the diagnostic once so we don't decode the JWT on every action call.
let serviceKeyCheckedOnce = false;

function diagnoseServiceKey(key: string): void {
  if (serviceKeyCheckedOnce) return;
  serviceKeyCheckedOnce = true;
  try {
    const [, payloadB64] = key.split(".");
    if (!payloadB64) {
      console.error(
        "[Supabase] SUPABASE_SERVICE_ROLE_KEY does not look like a JWT (missing '.' separators). " +
          "Re-copy the key from Supabase Dashboard → Settings → API → service_role."
      );
      return;
    }
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64").toString("utf-8")
    ) as { role?: string };
    if (payload.role !== "service_role") {
      // Error path always logs: this is a misconfiguration that causes real
      // breakage in production (privileged writes fall through to RLS).
      console.error(
        `[Supabase] SUPABASE_SERVICE_ROLE_KEY has role="${payload.role}" — expected "service_role". ` +
          "You likely pasted the anon key into the service_role slot. " +
          "Privileged writes will fall through to RLS/GRANT checks and fail with 'permission denied'. " +
          "Fix in Supabase Dashboard → Settings → API → service_role key."
      );
    }
    // Success path: silent in production. The detector only matters when
    // something is wrong; logging "everything's fine" on cold start adds noise
    // to operator logs without value.
  } catch (err) {
    console.error("[Supabase] Could not decode SUPABASE_SERVICE_ROLE_KEY:", err);
  }
}

export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("[Supabase] NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!key) {
    throw new Error(
      "[Supabase] SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Add it to .env.local (Supabase Dashboard → Settings → API → service_role key — " +
        "this is a DIFFERENT key from the anon/public key)."
    );
  }
  diagnoseServiceKey(key);

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
