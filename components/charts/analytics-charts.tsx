"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

interface AnalyticsData {
  trendData: { quarter: string; score: number }[];
  statusData: { name: string; value: number; color: string }[];
  deptData: { department: string; completion: number }[];
  managerData: { manager: string; checkins: number; total: number }[];
}

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6"];

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Organization-wide performance insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QoQ Achievement Trend */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">QoQ Achievement Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 270)" />
                <XAxis dataKey="quarter" stroke="oklch(0.6 0.01 270)" fontSize={12} />
                <YAxis stroke="oklch(0.6 0.01 270)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.19 0.02 270)",
                    border: "1px solid oklch(0.28 0.025 270)",
                    borderRadius: "8px",
                    color: "oklch(0.95 0.005 270)",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="score" name="Avg Score" stroke="#f59e0b"
                  strokeWidth={2} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Goal Status Distribution */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Goal Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const total = data.statusData.reduce((s, d) => s + d.value, 0);
              return (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.statusData}
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={58}
                        paddingAngle={4}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {data.statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={((value: unknown, name: unknown) => {
                          const n = typeof value === "number" ? value : Number(value ?? 0);
                          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                          return [`${n} (${pct}%)`, String(name ?? "")];
                        }) as never}
                        contentStyle={{
                          background: "oklch(0.19 0.02 270)",
                          border: "1px solid oklch(0.28 0.025 270)",
                          borderRadius: "8px",
                          color: "oklch(0.95 0.005 270)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Custom legend — guaranteed not to overlap the donut. */}
                  <div className="mt-2 grid grid-cols-3 gap-3 text-xs w-full max-w-md">
                    {data.statusData.map((entry) => {
                      const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                      return (
                        <div key={entry.name} className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ background: entry.color }}
                            aria-hidden
                          />
                          <span className="truncate">
                            <span className="text-foreground/90">{entry.name}</span>
                            <span className="text-muted-foreground"> · {entry.value} ({pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Department Completion Rate */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Completion by Department</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 270)" />
                <XAxis dataKey="department" stroke="oklch(0.6 0.01 270)" fontSize={12} />
                <YAxis stroke="oklch(0.6 0.01 270)" fontSize={12} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.19 0.02 270)",
                    border: "1px solid oklch(0.28 0.025 270)",
                    borderRadius: "8px",
                    color: "oklch(0.95 0.005 270)",
                  }}
                />
                <Bar dataKey="completion" name="Completion %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Manager Check-in Comparison */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Manager Check-in Completion</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.managerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.02 270)" />
                <XAxis dataKey="manager" stroke="oklch(0.6 0.01 270)" fontSize={12} />
                <YAxis stroke="oklch(0.6 0.01 270)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.19 0.02 270)",
                    border: "1px solid oklch(0.28 0.025 270)",
                    borderRadius: "8px",
                    color: "oklch(0.95 0.005 270)",
                  }}
                />
                <Legend />
                <Bar dataKey="checkins" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
