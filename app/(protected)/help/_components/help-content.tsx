"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  PlayCircle,
  Users,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Bell,
  HelpCircle,
  ChevronRight,
  Smartphone,
  KeyRound,
  FileText,
  PenTool,
  UserPlus,
  BarChart3,
  AlertTriangle,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

const sections = [
  { id: "getting-started", label: "Getting Started", icon: PlayCircle },
  { id: "authentication", label: "Authentication", icon: KeyRound },
  { id: "templates", label: "Template Management", icon: FileText },
  { id: "inspections", label: "Completing Inspections", icon: ClipboardCheck },
  { id: "signatures", label: "Signing Inspections", icon: PenTool },
  { id: "team", label: "Team & Invites", icon: UserPlus },
  { id: "dashboard", label: "Dashboard & Reports", icon: BarChart3 },
  { id: "settings", label: "Settings & Notifications", icon: Settings },
  { id: "mobile", label: "Mobile & PWA", icon: Smartphone },
  { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
]

export function HelpContent() {
  const [activeSection, setActiveSection] = useState("getting-started")

  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar Navigation */}
      <aside className="hidden w-64 shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <BookOpen className="size-4 text-primary" />
          <span className="text-sm font-semibold">Help & User Guide</span>
        </div>
        <ScrollArea className="h-[calc(100vh-7.5rem)]">
          <nav className="space-y-1 p-2">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {section.label}
                </button>
              )
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
          {/* Mobile Section Nav */}
          <div className="mb-6 flex flex-wrap gap-2 md:hidden">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors",
                    activeSection === section.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  <Icon className="size-3" />
                  {section.label}
                </button>
              )
            })}
          </div>

          {/* Getting Started */}
          <section id="getting-started" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <PlayCircle className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Getting Started</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Welcome to the Inspection App! This application helps you manage recurring inspections,
                track compliance, and maintain digital records with signature verification.
              </p>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Prerequisites</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Modern web browser (Chrome, Safari, Firefox, Edge)</li>
                  <li>For iOS: Safari on iOS 16.4 or later</li>
                  <li>For push notifications on iOS: Install as PWA (Add to Home Screen)</li>
                  <li>Stable internet connection</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">User Roles</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">Owner</span>
                    <span>Full access: manage locations, users, templates, settings, and view all data</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">Admin</span>
                    <span>Manage templates, inspections, team members, and create invite codes</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-600">Nurse</span>
                    <span>View and complete inspections for assigned locations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Inspector</span>
                    <span>Complete only inspections assigned to them</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">First-Time Setup (Owners)</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Navigate to the app URL</li>
                  <li>If no accounts exist, you'll see the Setup page</li>
                  <li>Enter your email, password, and full name</li>
                  <li>This creates the first location and assigns you as Owner</li>
                  <li>After setup, you can invite team members</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Authentication */}
          <section id="authentication" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <KeyRound className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Authentication</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div className="overflow-hidden rounded-md border">
                <Image
                  src="/help/login.png"
                  alt="Login page"
                  width={800}
                  height={500}
                  className="w-full"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Staff Login (Email & Password)</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Go to the login page</li>
                  <li>Enter your email and password</li>
                  <li>Click "Sign In"</li>
                  <li>You'll be redirected to the dashboard</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Inspector Login (Invite Code)</h3>
                <p className="mb-2">Inspectors receive an 8-character code from their admin:</p>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Click "Use Invite Code" on the login page</li>
                  <li>Enter the 8-character code (e.g., XQNJZUPD)</li>
                  <li>Enter your full name</li>
                  <li>Click "Verify" to create your account and sign in</li>
                </ol>
                <p className="mt-2 text-[10px] text-amber-600">
                  Note: Invite codes have expiry dates and usage limits set by your admin.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Password Reset</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Click "Forgot Password" on the login page</li>
                  <li>Enter your email address</li>
                  <li>Check your inbox for a reset link</li>
                  <li>Click the link and enter your new password</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Changing Your Password</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Navigate to Settings or click your profile menu</li>
                  <li>Select "Change Password"</li>
                  <li>Enter your current password</li>
                  <li>Enter and confirm your new password</li>
                  <li>Click "Update Password"</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Template Management */}
          <section id="templates" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <FileText className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Template Management</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Templates define recurring inspection tasks. Each template generates inspection instances
                automatically based on its frequency setting.
              </p>

              <div className="overflow-hidden rounded-md border">
                <Image
                  src="/help/templates.png"
                  alt="Templates page"
                  width={800}
                  height={500}
                  className="w-full"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Creating a Template</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Navigate to the Templates page</li>
                  <li>Click "Create Template"</li>
                  <li>Fill in the task name (required)</li>
                  <li>Add a description (optional but recommended)</li>
                  <li>Select the frequency: Weekly, Monthly, Yearly, or Every 3 Years</li>
                  <li>Optionally set a default assignee email</li>
                  <li>Click "Create"</li>
                </ol>
                <p className="mt-2 text-[10px] text-green-600">
                  Tip: The first inspection instance is created immediately after you create a template.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Frequency Options</h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">Weekly</span>
                    <span>Due every Monday at 9 AM</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-600">Monthly</span>
                    <span>Due on the 1st of each month at 9 AM</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Yearly</span>
                    <span>Due on January 1st at 9 AM</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">Every 3 Years</span>
                    <span>Due on January 1st, every 3 years</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Default Assignee</h3>
                <p className="mb-2">When you set a default assignee on a template:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>All new instances will be automatically assigned to that person</li>
                  <li>Changing the default assignee updates all pending instances</li>
                  <li>In-progress or completed instances are not affected</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Editing & Deleting Templates</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Click on a template card to open the edit dialog</li>
                  <li>You can change the task name, description, and default assignee</li>
                  <li>Frequency cannot be changed (create a new template instead)</li>
                  <li>Deleting a template is a "soft delete" - historical data is preserved</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Completing Inspections */}
          <section id="inspections" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <ClipboardCheck className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Completing Inspections</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="overflow-hidden rounded-md border">
                  <Image
                    src="/help/inspections.png"
                    alt="Inspections list"
                    width={400}
                    height={300}
                    className="w-full"
                  />
                  <p className="bg-muted/30 p-2 text-center text-[10px]">Inspections List</p>
                </div>
                <div className="overflow-hidden rounded-md border">
                  <Image
                    src="/help/inspection-modal.png"
                    alt="Inspection modal"
                    width={400}
                    height={300}
                    className="w-full"
                  />
                  <p className="bg-muted/30 p-2 text-center text-[10px]">Inspection Details Modal</p>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Inspection Status Flow</h3>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="rounded border px-2 py-1">Pending</span>
                  <ChevronRight className="size-3" />
                  <span className="rounded bg-blue-500/20 px-2 py-1 text-blue-600">In Progress</span>
                  <ChevronRight className="size-3" />
                  <span className="rounded bg-green-500/20 px-2 py-1 text-green-600">Passed</span>
                </div>
                <p className="mt-2 text-[10px]">
                  If an inspection fails, it can be re-inspected: Failed → In Progress → Passed
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Starting an Inspection</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Go to the Inspections page</li>
                  <li>Find your assigned inspection (look for your email)</li>
                  <li>Click on the inspection card to open it</li>
                  <li>Click "Start Inspection" to change status to In Progress</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">During the Inspection</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Perform the physical inspection as required</li>
                  <li>Add remarks in the text area (observations, issues, notes)</li>
                  <li>Remarks are saved when you update the status</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Completing an Inspection</h3>
                <p className="mb-2">When the inspection is done:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li><strong>If passed:</strong> Click "Complete & Sign" to capture your signature</li>
                  <li><strong>If failed:</strong> Click "Mark Failed" - the inspection can be re-done later</li>
                  <li><strong>If void:</strong> Admins can void inspections that are no longer needed</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Re-inspection After Failure</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>A failed inspection stays in the system</li>
                  <li>Admin/Owner can reassign if needed</li>
                  <li>Click "Re-inspect" to start the inspection again</li>
                  <li>Complete the inspection and sign when passed</li>
                  <li>The full history is preserved in the audit trail</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Signatures */}
          <section id="signatures" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <PenTool className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Signing Inspections</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Every passed inspection requires a digital signature. This provides accountability
                and creates a tamper-proof record.
              </p>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Signature Process</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Click "Complete & Sign" on an in-progress inspection</li>
                  <li>Enter your full name (printed name for the record)</li>
                  <li>Click "Continue to Sign"</li>
                  <li>Draw your signature on the canvas</li>
                  <li>Use "Undo" to remove the last stroke or "Clear" to start over</li>
                  <li>Click "Done" to submit your signature</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Mobile Signing Tips</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>On phones, the signature pad rotates to landscape for easier signing</li>
                  <li>Use your finger or a stylus for best results</li>
                  <li>The canvas detects touch gestures - sign naturally</li>
                  <li>A baseline guide shows where to sign</li>
                </ul>
              </div>

              <div className="rounded-md border bg-amber-500/10 p-4">
                <h3 className="mb-2 font-medium text-amber-600">Important</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Only the assigned inspector can sign an inspection</li>
                  <li>Signatures cannot be modified after submission</li>
                  <li>Your name and signature are permanently recorded</li>
                  <li>Device information is captured for audit purposes</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Team & Invites */}
          <section id="team" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <UserPlus className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Team & Invites</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div className="overflow-hidden rounded-md border">
                <Image
                  src="/help/invites.png"
                  alt="Invites page"
                  width={800}
                  height={500}
                  className="w-full"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Viewing Team Members</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Navigate to the Users page</li>
                  <li>See all team members for the current location</li>
                  <li>View their roles and email addresses</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Creating Invite Codes</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Go to the Invites page</li>
                  <li>Click "Create Invite"</li>
                  <li>Enter the inspector's email (optional but recommended)</li>
                  <li>Set expiry days (how long the code is valid)</li>
                  <li>Set max uses (how many times the code can be used)</li>
                  <li>Click "Create"</li>
                  <li>Copy the generated code and share it with the inspector</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Sharing Invite Codes</h3>
                <p className="mb-2">Share the code securely with your inspector:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Copy the code using the copy button</li>
                  <li>Send via secure messaging, email, or in person</li>
                  <li>Tell them to visit the app and click "Use Invite Code"</li>
                  <li>The code grants access only to your location</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Managing Invites</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>View all active and expired codes on the Invites page</li>
                  <li>See usage count for each code</li>
                  <li>Delete/revoke codes that are no longer needed</li>
                  <li>Expired codes are automatically invalidated</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Dashboard & Reports */}
          <section id="dashboard" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <BarChart3 className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Dashboard & Reports</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div className="overflow-hidden rounded-md border">
                <Image
                  src="/help/dashboard.png"
                  alt="Dashboard page"
                  width={800}
                  height={500}
                  className="w-full"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">KPI Cards</h3>
                <p className="mb-2">The dashboard shows key metrics at a glance:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li><strong>Pending:</strong> Inspections waiting to be started</li>
                  <li><strong>Overdue:</strong> Inspections past their due date</li>
                  <li><strong>Passed:</strong> Successfully completed inspections</li>
                  <li><strong>Failed:</strong> Inspections that need re-inspection</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Compliance Rate</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Shows the percentage of on-time completions (last 30 days)</li>
                  <li>Calculated as: Passed / (Passed + Failed + Overdue) × 100</li>
                  <li>Aim for 95%+ compliance</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Charts</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li><strong>Weekly Trend:</strong> Bar chart showing inspections over 4 weeks</li>
                  <li><strong>Status Breakdown:</strong> Pie chart of current status distribution</li>
                  <li><strong>Monthly Compliance:</strong> Line chart tracking compliance over time</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Calendar View</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>See all inspections on a calendar grid</li>
                  <li>Click a date to see inspections due that day</li>
                  <li>Color-coded by status</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Filtering</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Use the status filter on the Inspections page</li>
                  <li>Filter by: All, Pending, In Progress, Passed, Failed</li>
                  <li>Inspectors see only their assigned inspections</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Settings & Notifications */}
          <section id="settings" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <Settings className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Settings & Notifications</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div className="overflow-hidden rounded-md border">
                <Image
                  src="/help/settings.png"
                  alt="Settings page"
                  width={800}
                  height={500}
                  className="w-full"
                />
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Location Settings</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Edit location name</li>
                  <li>Set timezone (affects due date calculations)</li>
                  <li>Only owners can modify these settings</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Reminder Schedule (Owner Only)</h3>
                <p className="mb-2">Configure when reminders are sent:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li><strong>Weekly:</strong> Send reminder on Monday (on/off)</li>
                  <li><strong>Monthly:</strong> Days before due date (default: 7)</li>
                  <li><strong>Yearly:</strong> Months before due date (default: 6)</li>
                  <li><strong>Every 3 Years:</strong> Months before due date (default: 6)</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Push Notifications</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Go to Settings page</li>
                  <li>Toggle "Push Notifications" on</li>
                  <li>Allow notifications when your browser prompts</li>
                  <li>Click "Send Test" to verify it's working</li>
                </ol>
                <p className="mt-2 text-[10px] text-amber-600">
                  iOS users: You must install the app to your home screen first!
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">What Triggers Notifications?</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Upcoming inspections (based on reminder schedule)</li>
                  <li>Overdue inspections (daily reminders)</li>
                  <li>Escalations to owners for overdue items</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Mobile & PWA */}
          <section id="mobile" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <Smartphone className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Mobile & PWA</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                The Inspection App is a Progressive Web App (PWA), meaning it works like a native app
                on your phone without needing to download from an app store.
              </p>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Installing on iOS (iPhone/iPad)</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Open the app in Safari (required - Chrome won't work)</li>
                  <li>Tap the Share button (square with arrow)</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" in the top right</li>
                  <li>The app icon will appear on your home screen</li>
                </ol>
                <p className="mt-2 text-[10px] text-green-600">
                  This is required for push notifications on iOS!
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Installing on Android</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Open the app in Chrome</li>
                  <li>Tap the menu (three dots)</li>
                  <li>Tap "Install app" or "Add to Home screen"</li>
                  <li>Tap "Install"</li>
                  <li>The app icon will appear in your app drawer</li>
                </ol>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Mobile Signing</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>The signature pad automatically rotates to landscape on phones</li>
                  <li>Use your finger to sign naturally</li>
                  <li>The canvas is optimized for touch input</li>
                </ul>
              </div>

              <div className="rounded-md border bg-amber-500/10 p-4">
                <h3 className="mb-2 font-medium text-amber-600">iOS Requirements</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>iOS 16.4 or later required</li>
                  <li>Must use Safari browser</li>
                  <li>Must install to home screen for push notifications</li>
                  <li>Notifications require user permission after a tap gesture</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="mb-12 scroll-mt-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
                <AlertTriangle className="size-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Troubleshooting</h2>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">"Invalid invite code"</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Check that you entered the code exactly as given (codes are case-insensitive)</li>
                  <li>The code may have expired - ask your admin for a new one</li>
                  <li>The code may have reached its usage limit</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">"Only assigned inspector can sign"</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>You can only sign inspections assigned to you</li>
                  <li>Ask an admin to reassign the inspection to you if needed</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Signature pad stuck on "Loading"</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Refresh the page and try again</li>
                  <li>Make sure JavaScript is enabled in your browser</li>
                  <li>Try a different browser (Chrome or Safari recommended)</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Not receiving push notifications</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Make sure notifications are enabled in Settings</li>
                  <li>Check your browser/device notification settings</li>
                  <li>On iOS: Ensure the app is installed to home screen</li>
                  <li>Try the "Send Test" button to verify</li>
                  <li>Disable and re-enable notifications</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Can't see my assigned inspections</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Make sure you're viewing the correct location</li>
                  <li>Check the status filter is set to "All" or "Pending"</li>
                  <li>Contact your admin to verify you're assigned correctly</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <h3 className="mb-2 font-medium text-foreground">Templates page shows error</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>Make sure you have Admin or Owner role</li>
                  <li>Nurses and Inspectors cannot access templates</li>
                  <li>Try refreshing the page</li>
                </ul>
              </div>

              <div className="rounded-md border bg-primary/10 p-4">
                <h3 className="mb-2 font-medium text-foreground">Need More Help?</h3>
                <p>
                  Contact your system administrator or the app support team for assistance
                  with issues not covered here.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t pt-6 text-center text-[10px] text-muted-foreground">
            <p>Inspection App User Guide</p>
            <p className="mt-1">Last updated: February 2026</p>
          </footer>
        </div>
      </main>
    </div>
  )
}
