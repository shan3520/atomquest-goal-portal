import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { CheckinForm } from "@/components/goals/checkin-form";
import type { Goal, Quarter } from "@/types";

function getCurrentQuarter(): Quarter {
  const month = new Date().getMonth() + 1;
  if (month >= 7 && month <= 9) return "Q1";
  if (month >= 10 && month <= 12) return "Q2";
  if (month >= 1 && month <= 3) return "Q3";
  return "Q4";
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  const { sheetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sheet } = await supabase
    .from("goal_sheets")
    .select("*, goals(*, checkins:quarterly_checkins(*)), cycle:goal_cycles(*)")
    .eq("id", sheetId)
    .single();

  if (!sheet) notFound();
  if (sheet.status !== "approved") {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Sheet not yet approved</h2>
        <p className="text-muted-foreground text-sm">Check-ins are only available for approved goal sheets.</p>
        <Link href={`/goals/${sheetId}`} className="text-primary hover:underline mt-4 inline-block text-sm">
          Back to goal sheet
        </Link>
      </div>
    );
  }

  const quarter = getCurrentQuarter();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link href={`/goals/${sheetId}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to Sheet
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Quarterly check-in</h1>
          <Badge className="status-on_track">{quarter}</Badge>
        </div>
        <p className="text-muted-foreground mt-1">{sheet.cycle?.name}</p>
      </div>

      <CheckinForm goals={sheet.goals as Goal[]} quarter={quarter} />
    </div>
  );
}
