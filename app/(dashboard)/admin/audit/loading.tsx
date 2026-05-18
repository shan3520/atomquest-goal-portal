import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {/* Header row */}
          <div className="grid grid-cols-5 gap-3 px-4 py-3 border-b border-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-3 px-4 py-3 border-b border-border/30">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
