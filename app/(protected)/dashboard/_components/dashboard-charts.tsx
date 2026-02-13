"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"

// Chart colors
const COLORS = {
  completed: "oklch(0.55 0.18 145)", // Green
  failed: "oklch(0.58 0.22 27)", // Red
  pending: "oklch(0.65 0.15 264)", // Blue/purple
  in_progress: "oklch(0.7 0.15 85)", // Amber
  compliance: "oklch(0.55 0.2 264)", // Primary purple
}

const PIE_COLORS = [COLORS.completed, COLORS.failed, COLORS.pending, COLORS.in_progress]

interface WeeklyTrend {
  week: string
  weekLabel: string
  completed: number
  failed: number
  pending: number
}

interface MonthlyCompliance {
  month: string
  monthLabel: string
  complianceRate: number
  completed: number
  total: number
}

interface PieData {
  name: string
  value: number
  color: string
}

interface DashboardChartsProps {
  weeklyTrends: WeeklyTrend[]
  pieData: PieData[]
  totalInspections: number
  monthlyCompliance: MonthlyCompliance[]
}

export function DashboardCharts({
  weeklyTrends,
  pieData,
  totalInspections,
  monthlyCompliance,
}: DashboardChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Weekly Trend Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Weekly Completion Trend</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconSize={10}
              />
              <Bar dataKey="completed" name="Completed" fill={COLORS.completed} radius={[2, 2, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill={COLORS.failed} radius={[2, 2, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill={COLORS.pending} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status Breakdown Pie Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Status Breakdown</h3>
        <div className="h-[220px]">
          {totalInspections > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value) => [value ?? 0, "Count"]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No inspection data available
            </div>
          )}
        </div>
        {totalInspections > 0 && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Total: {totalInspections} inspections
          </div>
        )}
      </div>

      {/* Monthly Compliance Trend - Line Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Compliance Rate Trend (6 Months)</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyCompliance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value) => [`${value}%`, "Compliance"]}
              />
              <Line
                type="monotone"
                dataKey="complianceRate"
                name="Compliance Rate"
                stroke={COLORS.compliance}
                strokeWidth={2}
                dot={{ fill: COLORS.compliance, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Volume - Area Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Monthly Inspection Volume</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyCompliance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconSize={10}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stackId="1"
                stroke={COLORS.completed}
                fill={COLORS.completed}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Due"
                stackId="2"
                stroke={COLORS.pending}
                fill={COLORS.pending}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
