/**
 * Generate and download a CSV file from tabular data.
 */
export function downloadCSV(
  data: Record<string, string | number | null | undefined>[],
  filename: string
): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCSV).join(","));

  // Data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return "";
      return escapeCSV(String(val));
    });
    csvRows.push(values.join(","));
  }

  // RFC 4180 line endings + UTF-8 BOM so Excel reads non-ASCII characters correctly
  const csvString = csvRows.join("\r\n");
  const blob = new Blob(["﻿" + csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format achievement report data for CSV export.
 */
export function formatAchievementReportCSV(
  data: {
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
    q1_score: string;
    q2_score: string;
    q3_score: string;
    q4_score: string;
  }[]
): void {
  downloadCSV(
    data.map((row) => ({
      "Employee Name": row.employee_name,
      Department: row.department,
      Manager: row.manager_name,
      "Goal Title": row.goal_title,
      "Thrust Area": row.thrust_area,
      "UoM Type": row.uom_type,
      Target: row.target,
      "Q1 Actual": row.q1_actual,
      "Q2 Actual": row.q2_actual,
      "Q3 Actual": row.q3_actual,
      "Q4 Actual": row.q4_actual,
      "Q1 Score": row.q1_score,
      "Q2 Score": row.q2_score,
      "Q3 Score": row.q3_score,
      "Q4 Score": row.q4_score,
    })),
    `achievement_report_${new Date().toISOString().split("T")[0]}`
  );
}
