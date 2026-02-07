# PLAN_05: Dashboard Analytics & Charts

**Status**: Draft
**Dependencies**: PLAN_01 (Binder/Form System), PLAN_04 (Access Control)
**Created**: 2026-02-07

---

## 1. Current Dashboard State

### Existing Implementation

**File**: `app/dashboard/page.tsx`

**Current KPI Stats**:
```typescript
interface DashboardStats {
  pending: number           // Status = 'pending'
  overdue: number          // Status = 'pending' AND scheduled_date < today
  passed: number           // Status = 'passed'
  failed: number           // Status = 'failed'
  dueThisWeek: number      // scheduled_date in next 7 days
  complianceRate: number   // (passed / (passed + failed)) * 100
}
```

**Current Tabs**:
1. **Calendar View**: Full calendar with inspection dots
2. **Analytics View**:
   - Weekly bar chart (inspections completed per week)
   - Status pie chart (pending/passed/failed/void distribution)
3. **Trends View**:
   - Compliance line chart (weekly compliance rate over time)
   - Volume area chart (inspection volume over time)

**Recent Inspections Table**:
- Last 10 inspections with status, scheduled date, location
- CSV/PDF export buttons
- Uses `react-csv` and `jspdf` + `jspdf-autotable`

**Chart Library**: `recharts` (already installed)

**Overdue Alerts**:
- Red alert cards at top of dashboard
- Shows inspection name, location, days overdue
- Click to navigate to inspection detail

**Data Queries** (from `lib/actions/dashboard.ts`):
```sql
-- Get all inspections for stats
SELECT status, scheduled_date FROM inspection_instances
WHERE profile_id = $1;

-- Get overdue inspections
SELECT ii.*, it.name, l.name as location_name
FROM inspection_instances ii
JOIN inspection_templates it ON ii.template_id = it.id
JOIN locations l ON ii.location_id = l.id
WHERE ii.profile_id = $1
  AND ii.status = 'pending'
  AND ii.scheduled_date < NOW()
ORDER BY ii.scheduled_date ASC;
```

---

## 2. New Analytics Needed

### 2.1 By Inspector Analytics

**Purpose**: Owner/Admin can evaluate inspector performance and workload.

**Metrics**:
1. **Compliance Rate per Inspector**:
   - Formula: `(passed / (passed + failed)) * 100` per inspector
   - Chart: Horizontal bar chart (inspectors on Y-axis, compliance % on X-axis)
   - Color: Green if > 95%, Yellow if 80-95%, Red if < 80%

2. **Workload Distribution**:
   - Formula: Count of assigned inspections per inspector (pending + completed)
   - Chart: Stacked bar chart (inspector → pending/completed/overdue)
   - Shows if workload is balanced

3. **Response Time Trends**:
   - Formula: Average time from `scheduled_date` to `completed_at` per inspector
   - Chart: Line chart over time (X=weeks, Y=avg days to complete)
   - Identifies inspectors who consistently complete early/late

4. **Inspector Activity Heatmap**:
   - Formula: Inspections completed per day per inspector
   - Chart: Calendar heatmap (like GitHub contributions)
   - Shows activity patterns (busiest days, vacation gaps)

**SQL Query Example**:
```sql
-- Compliance rate per inspector
SELECT
  p.name as inspector_name,
  p.id as inspector_id,
  COUNT(*) FILTER (WHERE ii.status = 'passed') as passed,
  COUNT(*) FILTER (WHERE ii.status = 'failed') as failed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ii.status = 'passed') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
    2
  ) as compliance_rate
FROM profiles p
LEFT JOIN inspection_instances ii ON ii.profile_id = p.id
WHERE p.role IN ('inspector', 'nurse')
  AND ii.completed_at > NOW() - INTERVAL '90 days'
GROUP BY p.id, p.name
ORDER BY compliance_rate DESC;
```

### 2.2 By Binder Analytics

**Purpose**: Track compliance by regulatory category (Life Safety, Infection Control, etc.).

**Metrics**:
1. **Compliance Rate per Binder**:
   - Formula: `(passed / (passed + failed)) * 100` per binder
   - Chart: Donut chart with binder segments
   - Click segment to drill down to forms in that binder

2. **Completion Rates by Form Category**:
   - Formula: `(completed / total_due) * 100` per form template in binder
   - Chart: Grouped bar chart (binder → form templates → completion %)
   - Shows which forms are lagging

3. **Overdue by Binder**:
   - Formula: Count of overdue inspections per binder
   - Chart: Table with binder name, overdue count, oldest overdue date
   - Sortable by overdue count

4. **Binder Trend Over Time**:
   - Formula: Monthly compliance rate per binder
   - Chart: Multi-line chart (X=months, Y=compliance %, one line per binder)
   - Shows if specific binders are improving/degrading

**SQL Query Example**:
```sql
-- Compliance per binder
SELECT
  b.name as binder_name,
  b.id as binder_id,
  COUNT(*) FILTER (WHERE ii.status = 'passed') as passed,
  COUNT(*) FILTER (WHERE ii.status = 'failed') as failed,
  COUNT(*) FILTER (WHERE ii.status = 'pending' AND ii.scheduled_date < NOW()) as overdue,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ii.status = 'passed') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
    2
  ) as compliance_rate
FROM binders b
LEFT JOIN form_templates ft ON ft.binder_id = b.id
LEFT JOIN inspection_instances ii ON ii.form_template_id = ft.id
WHERE ii.scheduled_date > NOW() - INTERVAL '90 days'
GROUP BY b.id, b.name
ORDER BY compliance_rate DESC;
```

### 2.3 By Frequency Analytics

**Purpose**: Ensure daily/weekly/monthly/quarterly/annual inspections are tracked properly.

**Metrics**:
1. **On-Time Rate by Frequency**:
   - Formula: `(completed_on_time / total_due) * 100` per frequency
   - Chart: Radar chart (5 axes: daily/weekly/monthly/quarterly/annual)
   - Shows which frequencies are falling behind

2. **Upcoming Due by Frequency**:
   - Formula: Count of inspections due in next 7/30 days per frequency
   - Chart: Table with frequency, due this week, due this month
   - Helps prioritize inspector schedules

3. **Frequency Distribution**:
   - Formula: Count of templates per frequency
   - Chart: Simple pie chart (daily/weekly/monthly/quarterly/annual)
   - Shows workload composition

**SQL Query Example**:
```sql
-- On-time rate by frequency
SELECT
  ft.frequency,
  COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')) as total_completed,
  COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed') AND ii.completed_at <= ii.scheduled_date + INTERVAL '1 day') as completed_on_time,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed') AND ii.completed_at <= ii.scheduled_date + INTERVAL '1 day') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
    2
  ) as on_time_rate
FROM form_templates ft
LEFT JOIN inspection_instances ii ON ii.form_template_id = ft.id
WHERE ii.scheduled_date > NOW() - INTERVAL '90 days'
GROUP BY ft.frequency
ORDER BY
  CASE ft.frequency
    WHEN 'daily' THEN 1
    WHEN 'weekly' THEN 2
    WHEN 'monthly' THEN 3
    WHEN 'quarterly' THEN 4
    WHEN 'annual' THEN 5
  END;
```

### 2.4 Trend Analysis

**Purpose**: Identify month-over-month improvements and seasonal patterns.

**Metrics**:
1. **Month-over-Month Compliance Change**:
   - Formula: `compliance_current_month - compliance_previous_month`
   - Chart: Bar chart with +/- deltas (green bars for improvement, red for decline)
   - Shows if compliance is trending up or down

2. **Seasonal Patterns**:
   - Formula: Average inspection volume per month (across all years)
   - Chart: Line chart (X=Jan to Dec, Y=avg inspections per month)
   - Identifies busy seasons (e.g., Q4 audits)

3. **Failure Trend**:
   - Formula: Count of failed inspections per week over time
   - Chart: Line chart with trend line (linear regression)
   - Shows if failures are increasing/decreasing

4. **Corrective Action Effectiveness**:
   - Formula: Re-inspection pass rate after initial failure
   - Chart: Line chart (X=weeks, Y=re-inspection pass rate)
   - Measures if corrective actions are working

**SQL Query Example**:
```sql
-- Month-over-month compliance
WITH monthly_compliance AS (
  SELECT
    DATE_TRUNC('month', ii.completed_at) as month,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE ii.status = 'passed') /
      NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
      2
    ) as compliance_rate
  FROM inspection_instances ii
  WHERE ii.completed_at > NOW() - INTERVAL '12 months'
  GROUP BY DATE_TRUNC('month', ii.completed_at)
  ORDER BY month
)
SELECT
  month,
  compliance_rate,
  compliance_rate - LAG(compliance_rate) OVER (ORDER BY month) as mom_change
FROM monthly_compliance;
```

### 2.5 Calendar Heatmap

**Purpose**: Visual overview of inspection activity across entire year.

**Metrics**:
1. **Inspections per Day**:
   - Formula: Count of completed inspections per day
   - Chart: Calendar grid heatmap (like GitHub contributions)
   - Color intensity: Light green (1-2 inspections) → Dark green (10+ inspections)
   - Gaps show days with no activity

**Data Format**:
```typescript
interface HeatmapDay {
  date: string        // "2026-01-15"
  count: number       // 5 inspections
  status: {
    passed: number
    failed: number
  }
}
```

**SQL Query Example**:
```sql
-- Heatmap data for last 365 days
SELECT
  DATE(ii.completed_at) as date,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE ii.status = 'passed') as passed,
  COUNT(*) FILTER (WHERE ii.status = 'failed') as failed
FROM inspection_instances ii
WHERE ii.completed_at > NOW() - INTERVAL '365 days'
GROUP BY DATE(ii.completed_at)
ORDER BY date;
```

---

## 3. New Dashboard Views

### 3.1 Inspector Performance View (Owner/Admin Only)

**Route**: `/dashboard/inspectors`

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Inspector Performance                        [Export PDF]    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Filters: [Last 90 Days ▼] [All Binders ▼] [All Inspectors ▼]│
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Compliance Rate by Inspector                          │   │
│ │                                                         │   │
│ │ John Doe        ████████████████████████ 98%          │   │
│ │ Jane Smith      ███████████████████      92%          │   │
│ │ Bob Lee         ████████████             85%          │   │
│ │                                                         │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌──────────────────────┐  ┌──────────────────────────────┐  │
│ │ Workload Distribution│  │ Response Time Trends         │  │
│ │                      │  │                              │  │
│ │ [Stacked Bar Chart]  │  │ [Line Chart]                 │  │
│ │                      │  │                              │  │
│ └──────────────────────┘  └──────────────────────────────┘  │
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Inspector Activity Heatmap                            │   │
│ │                                                         │   │
│ │ John Doe:  [GitHub-style calendar heatmap]            │   │
│ │ Jane Smith: [GitHub-style calendar heatmap]            │   │
│ │                                                         │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Components Needed**:
- `InspectorComplianceChart` (horizontal bar chart)
- `WorkloadDistributionChart` (stacked bar chart)
- `ResponseTimeTrendsChart` (line chart)
- `InspectorHeatmap` (calendar heatmap, use `react-calendar-heatmap` library)

**Access Control**:
```typescript
const { profile } = await requireRole(['owner', 'admin'])
if (!profile.can_view_all_responses) {
  redirect('/dashboard')
}
```

### 3.2 Binder Compliance View

**Route**: `/dashboard/binders`

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Binder Compliance Overview                   [Export PDF]    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Filters: [Last 90 Days ▼] [All Binders ▼]                    │
│                                                               │
│ ┌──────────────────────┐  ┌──────────────────────────────┐  │
│ │ Compliance by Binder │  │ Overdue by Binder            │  │
│ │                      │  │                              │  │
│ │ [Donut Chart]        │  │ Binder          Overdue      │  │
│ │                      │  │ Life Safety     3 items      │  │
│ │ Click segment →      │  │ Infection Ctrl  1 item       │  │
│ │ drill down to forms  │  │ Environment     0 items      │  │
│ │                      │  │                              │  │
│ └──────────────────────┘  └──────────────────────────────┘  │
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Binder Trends Over Time                               │   │
│ │                                                         │   │
│ │ [Multi-line Chart: Each binder = one line]            │   │
│ │                                                         │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
│ Drill-Down: Life Safety Code                                 │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Form Completion Rates                                 │   │
│ │                                                         │   │
│ │ Fire Extinguishers      ████████████████ 95%          │   │
│ │ Emergency Exits         ████████████     80%          │   │
│ │ Fire Alarm Test         █████            45%          │   │
│ │                                                         │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Components Needed**:
- `BinderComplianceDonut` (donut chart with click handler)
- `OverdueByBinderTable` (sortable table)
- `BinderTrendsChart` (multi-line chart)
- `FormCompletionBars` (horizontal bar chart, shown on drill-down)

**Interaction**:
- Click donut segment → expand drill-down panel below chart
- Drill-down shows all form templates in that binder with completion rates

### 3.3 Regulatory Readiness Score

**Route**: `/dashboard` (new card at top)

**Purpose**: Single composite metric for "audit preparedness".

**Formula**:
```typescript
const regulatoryReadinessScore = (
  (complianceRate * 0.4) +                    // 40% weight: overall compliance
  ((1 - overdueRate) * 0.3) +                 // 30% weight: no overdue inspections
  (onTimeCompletionRate * 0.2) +              // 20% weight: complete on schedule
  (correctiveActionEffectiveness * 0.1)       // 10% weight: fix failures quickly
) * 100
```

**Display**:
```
┌─────────────────────────────────────┐
│ Regulatory Readiness Score          │
│                                     │
│         ╔═══════════════════╗       │
│         ║                   ║       │
│         ║        92%        ║       │
│         ║                   ║       │
│         ╚═══════════════════╝       │
│                                     │
│  ████████████████░░░░  92/100       │
│                                     │
│  Status: EXCELLENT                  │
│  Ready for inspection               │
│                                     │
│  Breakdown:                         │
│  • Compliance:    98% ✓             │
│  • Overdue:       2%  ✓             │
│  • On-time:       95% ✓             │
│  • Corrective:    80% ⚠             │
│                                     │
└─────────────────────────────────────┘
```

**Color Coding**:
- 90-100: Green (Excellent)
- 80-89: Yellow (Good)
- 70-79: Orange (Needs Improvement)
- <70: Red (Critical)

**Components Needed**:
- `RegulatoryReadinessCard` (circular progress + breakdown)

---

## 4. Data Queries & Performance

### 4.1 SQL Views for Dashboard

Create materialized views for expensive calculations:

**File**: `supabase/migrations/005_dashboard_views.sql`

```sql
-- Materialized view: Inspector performance stats
CREATE MATERIALIZED VIEW inspector_performance AS
SELECT
  p.id as inspector_id,
  p.name as inspector_name,
  COUNT(*) as total_inspections,
  COUNT(*) FILTER (WHERE ii.status = 'passed') as passed,
  COUNT(*) FILTER (WHERE ii.status = 'failed') as failed,
  COUNT(*) FILTER (WHERE ii.status = 'pending' AND ii.scheduled_date < NOW()) as overdue,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ii.status = 'passed') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
    2
  ) as compliance_rate,
  AVG(EXTRACT(EPOCH FROM (ii.completed_at - ii.scheduled_date)) / 86400.0) as avg_response_days
FROM profiles p
LEFT JOIN inspection_instances ii ON ii.profile_id = p.id
WHERE p.role IN ('inspector', 'nurse')
  AND ii.scheduled_date > NOW() - INTERVAL '90 days'
GROUP BY p.id, p.name;

CREATE UNIQUE INDEX ON inspector_performance (inspector_id);

-- Refresh schedule: nightly at 2am
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'refresh-inspector-performance',
  '0 2 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY inspector_performance;'
);

-- Materialized view: Binder compliance stats
CREATE MATERIALIZED VIEW binder_compliance AS
SELECT
  b.id as binder_id,
  b.name as binder_name,
  COUNT(DISTINCT ft.id) as form_count,
  COUNT(ii.id) as total_inspections,
  COUNT(*) FILTER (WHERE ii.status = 'passed') as passed,
  COUNT(*) FILTER (WHERE ii.status = 'failed') as failed,
  COUNT(*) FILTER (WHERE ii.status = 'pending' AND ii.scheduled_date < NOW()) as overdue,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ii.status = 'passed') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
    2
  ) as compliance_rate
FROM binders b
LEFT JOIN form_templates ft ON ft.binder_id = b.id
LEFT JOIN inspection_instances ii ON ii.form_template_id = ft.id
WHERE ii.scheduled_date > NOW() - INTERVAL '90 days'
  OR ii.id IS NULL
GROUP BY b.id, b.name;

CREATE UNIQUE INDEX ON binder_compliance (binder_id);

-- Refresh schedule: nightly at 2am
SELECT cron.schedule(
  'refresh-binder-compliance',
  '0 2 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY binder_compliance;'
);

-- Regular view: Frequency performance (fast enough without materialization)
CREATE OR REPLACE VIEW frequency_performance AS
SELECT
  ft.frequency,
  COUNT(*) as total_due,
  COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')) as completed,
  COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed') AND ii.completed_at <= ii.scheduled_date + INTERVAL '1 day') as completed_on_time,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed') AND ii.completed_at <= ii.scheduled_date + INTERVAL '1 day') /
    NULLIF(COUNT(*) FILTER (WHERE ii.status IN ('passed', 'failed')), 0),
    2
  ) as on_time_rate
FROM form_templates ft
LEFT JOIN inspection_instances ii ON ii.form_template_id = ft.id
WHERE ii.scheduled_date > NOW() - INTERVAL '90 days'
GROUP BY ft.frequency;
```

### 4.2 Caching Strategy

**Server-Side Caching** (Next.js 16):

```typescript
// lib/actions/dashboard.ts
import { unstable_cache } from 'next/cache'

export const getInspectorPerformance = unstable_cache(
  async () => {
    const result = await db.query('SELECT * FROM inspector_performance ORDER BY compliance_rate DESC')
    return result.rows
  },
  ['inspector-performance'],
  {
    revalidate: 3600,  // 1 hour cache
    tags: ['dashboard', 'inspector-performance']
  }
)

export const getBinderCompliance = unstable_cache(
  async () => {
    const result = await db.query('SELECT * FROM binder_compliance ORDER BY compliance_rate DESC')
    return result.rows
  },
  ['binder-compliance'],
  {
    revalidate: 3600,  // 1 hour cache
    tags: ['dashboard', 'binder-compliance']
  }
)

// Revalidate cache when inspection is completed
export async function completeInspection(inspectionId: string) {
  // ... complete inspection logic
  revalidateTag('dashboard')
  revalidateTag('inspector-performance')
  revalidateTag('binder-compliance')
}
```

**Client-Side Caching** (React Query):

```typescript
// lib/queries/dashboard.ts
import { useQuery } from '@tanstack/react-query'

export function useInspectorPerformance() {
  return useQuery({
    queryKey: ['inspector-performance'],
    queryFn: () => fetch('/api/dashboard/inspector-performance').then(r => r.json()),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  })
}

export function useBinderCompliance() {
  return useQuery({
    queryKey: ['binder-compliance'],
    queryFn: () => fetch('/api/dashboard/binder-compliance').then(r => r.json()),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  })
}
```

---

## 5. UI Components

### 5.1 New Chart Components

All components use `recharts` library (already installed).

**File**: `components/dashboard/inspector-compliance-chart.tsx`

```typescript
"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface InspectorData {
  inspector_name: string
  compliance_rate: number
}

export function InspectorComplianceChart({ data }: { data: InspectorData[] }) {
  const getColor = (rate: number) => {
    if (rate >= 95) return 'hsl(142, 76%, 36%)'  // green
    if (rate >= 80) return 'hsl(48, 96%, 53%)'   // yellow
    return 'hsl(0, 84%, 60%)'                     // red
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="horizontal">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} />
        <YAxis type="category" dataKey="inspector_name" width={120} />
        <Tooltip />
        <Bar dataKey="compliance_rate" label={{ position: 'right' }}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.compliance_rate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

**File**: `components/dashboard/binder-compliance-donut.tsx`

```typescript
"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface BinderData {
  binder_name: string
  compliance_rate: number
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export function BinderComplianceDonut({
  data,
  onSegmentClick
}: {
  data: BinderData[]
  onSegmentClick?: (binder: BinderData) => void
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="compliance_rate"
          label={(entry) => `${entry.binder_name}: ${entry.compliance_rate}%`}
          onClick={(entry) => onSegmentClick?.(entry)}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

**File**: `components/dashboard/activity-heatmap.tsx`

```typescript
"use client"

import CalendarHeatmap from 'react-calendar-heatmap'
import 'react-calendar-heatmap/dist/styles.css'
import { Tooltip } from '@/components/ui/tooltip'

interface HeatmapDay {
  date: string
  count: number
}

export function ActivityHeatmap({ data, inspectorName }: { data: HeatmapDay[], inspectorName: string }) {
  const startDate = new Date(new Date().getFullYear(), 0, 1)
  const endDate = new Date()

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{inspectorName}</h4>
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={data}
        classForValue={(value) => {
          if (!value || value.count === 0) return 'color-empty'
          if (value.count < 3) return 'color-scale-1'
          if (value.count < 6) return 'color-scale-2'
          if (value.count < 10) return 'color-scale-3'
          return 'color-scale-4'
        }}
        tooltipDataAttrs={(value: HeatmapDay) => ({
          'data-tip': value.date
            ? `${value.date}: ${value.count} inspections`
            : 'No data'
        })}
      />
    </div>
  )
}
```

**Styles for heatmap** (add to `app/globals.css`):

```css
.react-calendar-heatmap .color-empty { fill: hsl(var(--muted)); }
.react-calendar-heatmap .color-scale-1 { fill: hsl(142, 76%, 80%); }
.react-calendar-heatmap .color-scale-2 { fill: hsl(142, 76%, 60%); }
.react-calendar-heatmap .color-scale-3 { fill: hsl(142, 76%, 40%); }
.react-calendar-heatmap .color-scale-4 { fill: hsl(142, 76%, 20%); }
```

### 5.2 Filter Controls

**File**: `components/dashboard/dashboard-filters.tsx`

```typescript
"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQueryState } from 'nuqs'

export function DashboardFilters() {
  const [dateRange, setDateRange] = useQueryState('range', { defaultValue: '90' })
  const [binderId, setBinderId] = useQueryState('binder')
  const [inspectorId, setInspectorId] = useQueryState('inspector')

  return (
    <div className="flex gap-4">
      <Select value={dateRange} onValueChange={setDateRange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 Days</SelectItem>
          <SelectItem value="30">Last 30 Days</SelectItem>
          <SelectItem value="90">Last 90 Days</SelectItem>
          <SelectItem value="365">Last Year</SelectItem>
          <SelectItem value="all">All Time</SelectItem>
        </SelectContent>
      </Select>

      <Select value={binderId || 'all'} onValueChange={setBinderId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Binders" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Binders</SelectItem>
          {/* Dynamic binder list */}
        </SelectContent>
      </Select>

      <Select value={inspectorId || 'all'} onValueChange={setInspectorId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Inspectors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Inspectors</SelectItem>
          {/* Dynamic inspector list */}
        </SelectContent>
      </Select>
    </div>
  )
}
```

### 5.3 Responsive Layout

Dashboard uses grid layout that adapts to screen size:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
  <Card className="col-span-1">
    <CardHeader>
      <CardTitle>Compliance by Inspector</CardTitle>
    </CardHeader>
    <CardContent>
      <InspectorComplianceChart data={inspectorData} />
    </CardContent>
  </Card>

  <Card className="col-span-1">
    <CardHeader>
      <CardTitle>Workload Distribution</CardTitle>
    </CardHeader>
    <CardContent>
      <WorkloadChart data={workloadData} />
    </CardContent>
  </Card>

  <Card className="col-span-1 xl:col-span-1">
    <CardHeader>
      <CardTitle>Binder Compliance</CardTitle>
    </CardHeader>
    <CardContent>
      <BinderComplianceDonut data={binderData} />
    </CardContent>
  </Card>
</div>
```

---

## 6. Export Enhancements

### 6.1 PDF Reports by Binder

**Purpose**: Generate compliance report for specific binder (for regulatory audits).

**File**: `lib/pdf/binder-report.ts`

```typescript
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generateBinderReport(binderName: string, data: any) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.text(`${binderName} - Compliance Report`, 14, 22)

  // Metadata
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)
  doc.text(`Report Period: Last 90 Days`, 14, 35)

  // Summary stats
  doc.setFontSize(12)
  doc.text('Summary Statistics', 14, 45)
  autoTable(doc, {
    startY: 50,
    head: [['Metric', 'Value']],
    body: [
      ['Total Inspections', data.total.toString()],
      ['Passed', data.passed.toString()],
      ['Failed', data.failed.toString()],
      ['Compliance Rate', `${data.complianceRate}%`],
      ['Overdue', data.overdue.toString()],
    ],
  })

  // Form breakdown
  doc.addPage()
  doc.text('Form Completion Breakdown', 14, 22)
  autoTable(doc, {
    startY: 30,
    head: [['Form Name', 'Frequency', 'Completed', 'Compliance Rate']],
    body: data.forms.map((f: any) => [
      f.name,
      f.frequency,
      f.completed.toString(),
      `${f.complianceRate}%`
    ]),
  })

  // Recent failures
  if (data.recentFailures.length > 0) {
    doc.addPage()
    doc.text('Recent Failures', 14, 22)
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Form', 'Inspector', 'Remarks']],
      body: data.recentFailures.map((f: any) => [
        new Date(f.date).toLocaleDateString(),
        f.formName,
        f.inspectorName,
        f.remarks || 'N/A'
      ]),
    })
  }

  return doc.save(`${binderName.replace(/\s+/g, '_')}_Report_${Date.now()}.pdf`)
}
```

**API Endpoint**: `POST /api/reports/binder`

```typescript
export async function POST(request: Request) {
  const { profile } = await requireExportReports()
  const { binderId } = await request.json()

  const data = await getBinderReportData(binderId)
  return Response.json(data)
}
```

### 6.2 Compliance Certificates

**Purpose**: Generate PDF certificate for inspections that passed (for display).

**Example Certificate**:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              COMPLIANCE CERTIFICATE                       ║
║                                                           ║
║    This certifies that the following inspection has       ║
║    been completed and passed all requirements:            ║
║                                                           ║
║    Inspection: Fire Extinguisher Inspection               ║
║    Location: Building A - 2nd Floor                       ║
║    Date: February 7, 2026                                 ║
║    Inspector: John Doe                                    ║
║                                                           ║
║    Compliance Score: 100%                                 ║
║                                                           ║
║    ___________________                                    ║
║    Inspector Signature                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

**Implementation**: Similar to binder report but with visual styling (logo, borders, signature image embed).

### 6.3 Regulatory Audit Export

**Purpose**: Export all inspection data for specific date range in structured format (CSV or JSON).

**API Endpoint**: `POST /api/reports/audit-export`

```typescript
export async function POST(request: Request) {
  const { profile } = await requireExportReports()
  const { startDate, endDate, format } = await request.json()

  const data = await getAuditExportData(startDate, endDate)

  if (format === 'csv') {
    const csv = generateCSV(data)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit_export_${Date.now()}.csv"`
      }
    })
  }

  return Response.json(data)
}
```

---

## 7. Implementation Timeline

### Week 1: Foundation
- [ ] Create materialized views (`005_dashboard_views.sql`)
- [ ] Set up caching strategy (unstable_cache, revalidateTag)
- [ ] Add `react-calendar-heatmap` and `@tanstack/react-query` dependencies
- [ ] Create filter components (DashboardFilters)

### Week 2: Inspector Analytics
- [ ] Build Inspector Performance page (`/dashboard/inspectors`)
- [ ] Implement InspectorComplianceChart
- [ ] Implement WorkloadDistributionChart
- [ ] Implement ResponseTimeTrendsChart
- [ ] Implement ActivityHeatmap
- [ ] Create API endpoints for inspector data

### Week 3: Binder Analytics
- [ ] Build Binder Compliance page (`/dashboard/binders`)
- [ ] Implement BinderComplianceDonut with drill-down
- [ ] Implement BinderTrendsChart
- [ ] Implement FormCompletionBars
- [ ] Implement OverdueByBinderTable

### Week 4: Advanced Features
- [ ] Add Regulatory Readiness Score card to main dashboard
- [ ] Implement frequency performance charts
- [ ] Add month-over-month trend analysis
- [ ] Build PDF report generators
- [ ] Add compliance certificate generator
- [ ] Add audit export functionality

### Week 5: Polish & Testing
- [ ] Responsive layout testing on mobile/tablet
- [ ] Performance testing with large datasets (1000+ inspections)
- [ ] Add loading states and error boundaries
- [ ] Write unit tests for chart components
- [ ] User acceptance testing with owner/admin roles

---

## 8. Future Enhancements

1. **Real-Time Updates**: Use WebSockets or Server-Sent Events to update charts in real-time when inspections complete
2. **Custom Reports**: Allow users to build custom reports with drag-and-drop metrics
3. **Email Digest**: Send weekly compliance summary email to owner/admin
4. **Predictive Analytics**: ML model to predict inspection failures based on historical data
5. **Mobile Dashboard**: Simplified mobile view with swipeable cards
6. **Dashboard Sharing**: Generate shareable links for external auditors (time-limited, read-only)

---

## Summary

**New Dashboard Views**:
1. Inspector Performance (compliance, workload, response time, activity heatmap)
2. Binder Compliance (donut chart, overdue table, trends, form drill-down)
3. Regulatory Readiness Score (composite metric on main dashboard)

**New Charts**:
- Inspector compliance horizontal bar chart
- Workload distribution stacked bar chart
- Response time trends line chart
- Inspector activity calendar heatmap
- Binder compliance donut chart
- Binder trends multi-line chart
- Frequency performance radar chart

**Performance**:
- Materialized views for inspector/binder stats (refresh nightly)
- Server-side caching with Next.js unstable_cache (1 hour TTL)
- Client-side caching with React Query (5 min stale time)

**Export Enhancements**:
- PDF reports by binder
- Compliance certificates
- Regulatory audit export (CSV/JSON)

**Implementation**: 5 weeks (foundation → inspector analytics → binder analytics → advanced features → polish).
