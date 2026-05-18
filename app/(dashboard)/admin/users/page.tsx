import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UsersManager } from "@/components/admin/user-management";
import type { Profile } from "@/types";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: users } = await supabase.from("profiles").select("*").order("name");
  return <UsersManager initialUsers={(users || []) as Profile[]} />;
}
