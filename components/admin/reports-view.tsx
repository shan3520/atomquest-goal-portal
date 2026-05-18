"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { downloadCSV } from "@/lib/utils/csv-export";
import { formatScore, getScoreColor } from "@/lib/utils/score-calculator";

interface ReportData {
  employee_name: string;
  department: string;
  manager_name: string;
  goal_title: string;
  thrust_area: string;
  uom_type: string;
  target: string;
  q1_actual: string;
  q2_actual: string;
  q3_actual: string;
  q4_actual: string;
  q1_score: number | null;
  q2_score: number | null;
  q3_score: number | null;
  q4_score: number | null;
}

interface CompletionData {
  total_employees: number;
  submitted_count: number;
  approved_count: number;
  q1_checkins: number;
  q2_checkins: number;
  q3_checkins: number;
  q4_checkins: number;
  total_goals: number;
}

export function ReportsView({
  reportData, completionData
}: {
  reportData: ReportData[];
  completionData: CompletionData;
}) {
  function handleExport() {
    downloadCSV(
      reportData.map(r => ({
        "Employee Name": r.employee_name,
        "Department": r.department,
        "Manager": r.manager_name,
        "Goal Title": r.goal_title,
        "Thrust Area": r.thrust_area,
        "UoM": r.uom_type,
        "Target": r.target,
        "Q1 Actual": r.q1_actual,
        "Q2 Actual": r.q2_actual,
        "Q3 Actual": r.q3_actual,
        "Q4 Actual": r.q4_actual,
        "Q1 Score": r.q1_score ?? "",
        "Q2 Score": r.q2_score ?? "",
        "Q3 Score": r.q3_score ?? "",
        "Q4 Score": r.q4_score ?? "",
      })),
      `achievement_report_${new Date().toISOString().split("T")[0]}`
    );
  }

  const submPct = completionData.total_employees > 0
    ? Math.round((completionData.submitted_count / completionData.total_employees) * 100) : 0;
  const apprPct = completionData.total_employees > 0
    ? Math.round((completionData.approved_count / completionData.total_employees) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Achievement reports and completion dashboard</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Completion Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm">Goals submitted</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{submPct}%</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {completionData.submitted_count}/{completionData.total_employees}
              </span>
            </div>
            <Progress value={submPct} className="h-1.5" />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm">Goals approved</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{apprPct}%</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {completionData.approved_count}/{completionData.total_employees}
              </span>
            </div>
            <Progress value={apprPct} className="h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Achievement Table */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Achievement report</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Thrust area</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="text-center">Q1</TableHead>
                <TableHead className="text-center">Q2</TableHead>
                <TableHead className="text-center">Q3</TableHead>
                <TableHead className="text-center">Q4</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length > 0 ? reportData.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.employee_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.goal_title}</TableCell>
                  <TableCell>{row.thrust_area}</TableCell>
                  <TableCell>{row.target}</TableCell>
                  {[row.q1_score, row.q2_score, row.q3_score, row.q4_score].map((score, qi) => (
                    <TableCell key={qi} className="text-center tabular-nums">
                      {score !== null ? (
                        <span className={`font-semibold ${getScoreColor(score)}`}>{formatScore(score)}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No report data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
