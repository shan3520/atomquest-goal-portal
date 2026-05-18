import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EscalationsPage from "@/components/admin/escalations";
import type { EscalationRule } from "@/types";

export default async function AdminEscalationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rules } = await supabase.from("escalation_rules").select("*").order("rule_type");
  return <EscalationsPage rules={(rules || []) as EscalationRule[]} />;
}
