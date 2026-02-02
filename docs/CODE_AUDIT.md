# Inspection App - Comprehensive Code Audit

**Date**: 2026-02-02
**Reviewer**: Claude Code Review
**Codebase**: E:\client-app\inspection-app

---

## Executive Summary

This audit reviews the inspection-app codebase for Next.js optimization, database query efficiency, React best practices, performance, and security. The codebase is generally well-structured with good patterns, but several issues were identified ranging from LOW to HIGH severity.

**Files Reviewed**: 70+
**Total Issues**: 23

### By Severity
- CRITICAL: 1 (must fix)
- HIGH: 5 (should fix)
- MEDIUM: 10 (consider fixing)
- LOW: 7 (optional)

### Recommendation: REQUEST CHANGES

The CRITICAL security issue (sequential N+1 in cron job) and HIGH issues should be addressed before production deployment.

---

## 1. Next.js Page/Layout Optimization

### Positive Findings

1. **Good use of Suspense boundaries**: Pages properly use `<Suspense>` with loading fallbacks
2. **Correct Next.js 16 patterns**: Async `params` and `searchParams` are properly awaited
3. **Layout separation**: Protected and public layouts are cleanly separated
4. **Server Components**: Data fetching is done at the page level, not in client components

### Issues

#### [MEDIUM] Dashboard page fetches 13 queries sequentially in Promise.all
**File**: `E:\client-app\inspection-app\app\(protected)\dashboard\page.tsx:130-267`
**Issue**: While Promise.all parallelizes these queries, the dashboard fetches an excessive number of separate queries (13 total) that could be consolidated.
```typescript
const [
  { count: pendingCount },
  { count: overdueCount },
  { count: passedCount },
  { count: failedCount },
  { count: dueThisWeekCount },
  { count: completedLast30Days },
  { count: totalDueLast30Days },
  { data: calendarInstances },
  { data: overdueInstances },
  { data: trendInstances },
  { data: statusBreakdown },
  { data: monthlyInstances },
  { data: recentInspections },
] = await Promise.all([...])
```
**Fix**: Create a database view or stored procedure that returns aggregated dashboard stats in a single query. This reduces network round-trips and database load.
**Why it matters**: Each query has network overhead. A single aggregated query would be more efficient.

#### [LOW] Repeated location access checks in pages
**File**: Multiple pages (dashboard, inspections, templates, settings)
**Issue**: Each page calls `requireLocationAccess(loc)` separately even though the layout already validates authentication.
**Why it matters**: While necessary for location-specific authorization, consider caching the result using React's `cache()` function (already used in auth-helpers.ts).

#### [LOW] Missing loading.tsx in some routes
**File**: `E:\client-app\inspection-app\app\(protected)\users\`
**Issue**: The users route doesn't have a loading.tsx file while other routes do.
**Fix**: Add consistent loading.tsx files across all routes.

---

## 2. Database Query Optimization

### Positive Findings

1. **Good use of `unstable_cache`**: Instance and template queries are cached with revalidation tags
2. **Fallback queries**: The code handles missing views gracefully with fallback queries
3. **Proper use of JOINs via Supabase select syntax**: e.g., `select("*, inspection_templates(task)")`

### Issues

#### [CRITICAL] Sequential await in cron loop - N+1 pattern
**File**: `E:\client-app\inspection-app\app\api\cron\reminders\route.ts:124-150`
**Issue**: The cron job processes notifications sequentially with `await` inside a `for` loop, creating an N+1 pattern.
```typescript
for (const notification of pending) {
  const result = await sendNotificationEmail(notification)  // Sequential!
  if (result.success) {
    try {
      await markNotificationSent(notification.id)  // Another sequential await
    }
    // ...
  }
}
```
**Fix**: Use `Promise.allSettled` to process notifications in parallel:
```typescript
const results = await Promise.allSettled(
  pending.map(async (notification) => {
    const result = await sendNotificationEmail(notification)
    if (result.success) {
      await markNotificationSent(notification.id)
    } else {
      await markNotificationFailed(notification.id, result.error)
    }
    return result
  })
)
```
**Why it matters**: With 50 pending notifications, this could take 50x longer than necessary. Cron jobs have time limits.

#### [HIGH] Overly broad SELECT * queries
**File**: Multiple service files
**Issue**: Many queries use `select("*")` when only specific columns are needed:
- `E:\client-app\inspection-app\lib\server\auth-helpers.ts:34`
- `E:\client-app\inspection-app\lib\server\services\events.ts:17`
- `E:\client-app\inspection-app\lib\server\services\templates.ts:62,89`
- `E:\client-app\inspection-app\lib\server\services\locations.ts:29`
- `E:\client-app\inspection-app\lib\server\services\instances.ts:48,103`
- `E:\client-app\inspection-app\lib\server\services\signatures.ts:19`
- `E:\client-app\inspection-app\lib\server\services\invite-codes.ts:23,66`
- `E:\client-app\inspection-app\lib\server\services\push-sender.ts:43,75,114`
- `E:\client-app\inspection-app\lib\server\services\reminders.ts:42`
**Fix**: Replace `select("*")` with explicit column lists.
**Why it matters**: Fetching unnecessary columns increases bandwidth, memory usage, and can expose sensitive data.

#### [MEDIUM] N+1 in enrichWithUserNames
**File**: `E:\client-app\inspection-app\lib\server\services\templates.ts:33-57`
**Issue**: The function fetches templates, then makes a separate query for user names.
```typescript
async function enrichWithUserNames(templates: Template[]): Promise<Template[]> {
  // Collects userIds, then makes separate query
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", Array.from(userIds))
  // ...
}
```
**Fix**: Use a JOIN in the original query:
```typescript
.select("*, created_by_profile:profiles!created_by(full_name), updated_by_profile:profiles!updated_by(full_name)")
```
**Why it matters**: Two queries instead of one for every template list request.

#### [MEDIUM] Multiple queries for user listing
**File**: `E:\client-app\inspection-app\app\api\users\route.ts:178-232`
**Issue**: GET handler makes 3 sequential queries to list users.
```typescript
// Query 1: Get caller's locations
const { data: callerLocations } = await supabase.from("profile_locations")...

// Query 2: Get all profile IDs in those locations
const { data: profileLinks } = await supabase.from("profile_locations")...

// Query 3: Get profile details
const { data: profiles } = await supabase.from("profiles")...
```
**Fix**: Consolidate into a single query with proper JOINs or use a database view.

#### [MEDIUM] reorderTemplates makes N sequential updates
**File**: `E:\client-app\inspection-app\lib\server\services\templates.ts:171-191`
**Issue**: Updates each template's sort_order individually.
```typescript
const updates = orderedIds.map((id, index) =>
  supabase
    .from("inspection_templates")
    .update({ sort_order: index, updated_at: new Date().toISOString() })
    .eq("id", id)
    // ...
)
const results = await Promise.all(updates)
```
**Fix**: Use a single upsert operation or a stored procedure. While Promise.all helps, it still creates N database connections.

---

## 3. React Best Practices

### Positive Findings

1. **Good use of useMemo/useCallback**: `inspection-modal.tsx` properly memoizes computed values
2. **Proper state management**: State is colocated with components that need it
3. **nuqs for URL state**: Clean URL state management pattern
4. **Type safety**: Good TypeScript usage throughout

### Issues

#### [HIGH] Large component with many useState calls
**File**: `E:\client-app\inspection-app\app\(protected)\inspections\_components\inspection-modal.tsx`
**Issue**: The InspectionModal component has 10+ useState calls and a very large useEffect (130+ lines).
```typescript
const [instance, setInstance] = useState<Instance | null>(null)
const [template, setTemplate] = useState<Template | null>(null)
const [events, setEvents] = useState<InspectionEvent[]>([])
const [signatures, setSignatures] = useState<Signature[]>([])
const [remarks, setRemarks] = useState("")
const [loading, setLoading] = useState(false)
const [fetching, setFetching] = useState(false)
const [error, setError] = useState<string | null>(null)
const [showSignature, setShowSignature] = useState(false)
const [showReassign, setShowReassign] = useState(false)
const [reassignEmail, setReassignEmail] = useState("")
```
**Fix**:
- Consider using `useReducer` for related state
- Extract the data fetching logic into a custom hook
- Split into smaller sub-components
**Why it matters**: Large components are harder to maintain and test. Multiple related state values can lead to inconsistent states.

#### [MEDIUM] Inline function creation in JSX
**File**: `E:\client-app\inspection-app\app\(protected)\inspections\_components\inspection-modal.tsx:578-580`
```typescript
onClick={() => {
  setShowReassign(false)
  setReassignEmail("")
}}
```
**Fix**: Extract to useCallback for frequently rendered components.
**Why it matters**: Creates new function reference on every render, potentially causing unnecessary child re-renders.

#### [LOW] Date formatter created outside component
**File**: `E:\client-app\inspection-app\app\(protected)\inspections\_components\inspection-modal.tsx:87-100`
```typescript
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {...})
const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {...})
```
**Why it matters**: This is actually a good pattern - keeping formatters outside components to avoid recreation.

#### [LOW] Duplicate date formatting functions
**File**:
- `E:\client-app\inspection-app\app\(protected)\inspections\_components\inspection-modal.tsx:430-436`
- `E:\client-app\inspection-app\app\(protected)\inspections\[instanceId]\_components\inspection-detail.tsx:159-178`
**Issue**: Both files define similar `formatDate` and `formatEventTime` functions.
**Fix**: Extract to a shared utility function in `lib/utils.ts`.

---

## 4. Performance Issues

### Positive Findings

1. **Good use of Next.js caching**: `unstable_cache` with proper tags
2. **Parallel data fetching**: Promise.all used in most places
3. **Lazy loading images**: Signature images use `loading="lazy"`
4. **Service worker**: PWA support with service worker registration

### Issues

#### [HIGH] No pagination in dashboard calendar events
**File**: `E:\client-app\inspection-app\app\(protected)\dashboard\page.tsx:207-217`
**Issue**: Fetches all calendar events for 6 months without pagination.
```typescript
.gte("due_at", threeMonthsAgo.toISOString())
.lte("due_at", threeMonthsAhead.toISOString())
// No limit!
```
**Fix**: Add a reasonable limit and implement pagination or virtualization on the frontend.
**Why it matters**: A busy location could have thousands of inspections over 6 months.

#### [MEDIUM] Console.log in production code
**File**: `E:\client-app\inspection-app\components\service-worker-register.tsx:24`
```typescript
console.log("New service worker installed")
```
**Fix**: Remove or use a proper logging service with log levels.
**Why it matters**: Console logs in production can impact performance and clutter browser console.

#### [MEDIUM] Large client component bundle
**File**: `E:\client-app\inspection-app\app\(protected)\inspections\_components\inspection-modal.tsx`
**Issue**: 810+ line client component imports many icons and UI components.
**Fix**:
- Split into smaller components
- Consider dynamic imports for the signature pad
- Tree-shake unused icons

#### [LOW] Multiple Google fonts loaded
**File**: `E:\client-app\inspection-app\app\layout.tsx:7-17`
```typescript
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
```
**Issue**: Three font families are loaded but CLAUDE.md specifies Inter as the primary font.
**Fix**: Remove unused Geist fonts if not needed.
**Why it matters**: Each font adds to initial page load time.

---

## 5. Security Issues

### Positive Findings

1. **Proper auth checks**: All API routes check authentication
2. **Location-based access control**: `requireLocationAccess()` enforces tenant isolation
3. **Input validation**: Zod schemas validate all API inputs
4. **Server-only modules**: Sensitive code uses `"server-only"` import
5. **No dangerouslySetInnerHTML**: No XSS vectors found
6. **CRON_SECRET for cron jobs**: Protected endpoint

### Issues

#### [HIGH] Potential timing attack in invite code exchange
**File**: `E:\client-app\inspection-app\app\api\auth\invite\route.ts:26-30`
**Issue**: The code checks for existing users before creating new ones, which could leak information about registered emails.
```typescript
const { data: existingUser } = await supabase
  .from("user")
  .select("id, email")
  .eq("email", inspectorEmail)
  .single()
```
**Fix**: Use constant-time comparison or always perform the same operations regardless of user existence.
**Why it matters**: Attackers could enumerate valid email addresses.

#### [HIGH] Unvalidated JSON.parse in signature route
**File**: `E:\client-app\inspection-app\app\api\locations\[locationId]\instances\[instanceId]\sign\route.ts:68-69`
```typescript
signature_points: signaturePoints ? JSON.parse(signaturePoints) : null,
device_meta: deviceMeta ? JSON.parse(deviceMeta) : null,
```
**Issue**: JSON.parse can throw on malformed input, but there's no try-catch or validation.
**Fix**: Wrap in try-catch or validate with Zod schema before parsing.
**Why it matters**: Malformed JSON will cause 500 errors.

#### [MEDIUM] Temp password returned in API response
**File**: `E:\client-app\inspection-app\app\api\users\route.ts:157`
```typescript
tempPassword, // Show to admin on screen (important if no email)
```
**Issue**: While intentional (noted in comment), returning passwords in API responses is risky.
**Fix**: Consider alternative approaches like one-time password links or secure password delivery.
**Why it matters**: API responses may be logged, cached, or intercepted.

#### [MEDIUM] Non-null assertions on environment variables
**File**: Multiple files
```typescript
process.env.SUPABASE_URL!,
process.env.SUPABASE_SECRET_KEY!,
process.env.NEXT_PUBLIC_APP_URL!,
```
**Issue**: Non-null assertions will cause runtime errors if env vars are missing.
**Fix**: Add startup validation that checks all required environment variables.
**Why it matters**: Silent failures or cryptic errors in production.

#### [MEDIUM] Inspector can be reassigned by anyone with location access
**File**: `E:\client-app\inspection-app\app\api\locations\[locationId]\instances\[instanceId]\route.ts:30`
**Issue**: The PUT endpoint only checks `requireLocationAccess(locationId)` without role restrictions for reassignment.
```typescript
const { profile } = await requireLocationAccess(locationId)
// No role check for reassignment
```
**Fix**: Add role check for assignment changes (should require admin/owner/nurse role).
**Why it matters**: Inspectors could reassign tasks to others without authorization.

#### [LOW] No rate limiting on auth endpoints
**File**: `E:\client-app\inspection-app\app\api\auth\invite\route.ts`
**Issue**: No rate limiting on invite code exchange endpoint.
**Fix**: Implement rate limiting (can use Vercel Edge Config or a library).
**Why it matters**: Could allow brute-force attacks on invite codes.

---

## 6. Code Quality Issues

### [LOW] Unused imports and code
**File**: Various
- `example.tsx` and `component-example.tsx` appear to be sample files
**Fix**: Remove unused example files.

### [LOW] Inconsistent error handling patterns
**Issue**: Some API routes use `handleError(error)`, others manually return Response.json with error objects.
**Fix**: Standardize on `handleError()` pattern throughout.

### [LOW] Magic numbers without constants
**File**: Various
```typescript
.limit(100)  // in cron route
.limit(50)   // in processQueuedNotifications
expiresIn: 60 * 60 * 24 * 7  // 7 days
```
**Fix**: Extract to named constants for clarity.

---

## Recommendations Summary

### Must Fix (CRITICAL/HIGH)

1. **Fix sequential N+1 in cron job** - Use Promise.allSettled for parallel processing
2. **Replace SELECT * with explicit columns** - Reduce data transfer and exposure
3. **Add pagination to dashboard calendar** - Prevent unbounded queries
4. **Validate JSON.parse inputs** - Prevent 500 errors from malformed data
5. **Add role check for reassignment** - Enforce proper authorization
6. **Refactor InspectionModal** - Break into smaller components with useReducer

### Should Fix (MEDIUM)

1. Consolidate dashboard queries into aggregated view
2. Fix N+1 in enrichWithUserNames with JOIN
3. Add environment variable validation at startup
4. Remove console.log statements
5. Add rate limiting to auth endpoints
6. Consolidate user listing queries

### Consider (LOW)

1. Add missing loading.tsx files
2. Extract shared date formatting utilities
3. Remove unused font imports
4. Standardize error handling patterns
5. Remove example/unused files

---

## Appendix: Files Reviewed

### Pages/Layouts
- app/layout.tsx
- app/(protected)/layout.tsx
- app/(public)/layout.tsx
- app/(protected)/dashboard/page.tsx
- app/(protected)/inspections/page.tsx
- app/(protected)/inspections/[instanceId]/page.tsx
- app/(protected)/templates/page.tsx
- app/(protected)/settings/page.tsx

### API Routes
- app/api/auth/[...all]/route.ts
- app/api/auth/invite/route.ts
- app/api/cron/reminders/route.ts
- app/api/locations/[locationId]/instances/route.ts
- app/api/locations/[locationId]/instances/[instanceId]/route.ts
- app/api/locations/[locationId]/instances/[instanceId]/sign/route.ts
- app/api/setup/route.ts
- app/api/users/route.ts

### Services
- lib/server/services/instances.ts
- lib/server/services/templates.ts
- lib/server/services/locations.ts
- lib/server/services/signatures.ts
- lib/server/services/reminders.ts
- lib/server/services/push-sender.ts
- lib/server/services/events.ts
- lib/server/services/invite-codes.ts

### Components
- app/(protected)/_components/app-shell.tsx
- app/(protected)/inspections/_components/inspection-modal.tsx
- app/(protected)/inspections/[instanceId]/_components/inspection-detail.tsx
- components/service-worker-register.tsx

### Utilities
- lib/auth.ts
- lib/auth-client.ts
- lib/server/auth-helpers.ts
- lib/server/db.ts
- lib/validations/instance.ts
