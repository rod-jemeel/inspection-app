"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  User,
  EnvelopeSimple,
  Lock,
  Buildings,
  Globe,
  Rocket,
  At,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "UTC", label: "UTC" },
]

export function SetupForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Admin fields
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("") // Optional
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Location fields
  const [locationName, setLocationName] = useState("")
  const [timezone, setTimezone] = useState("America/New_York")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!username.match(/^[a-zA-Z0-9_]+$/)) {
      setError("Username can only contain letters, numbers, and underscores")
      return
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters")
      return
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          username,
          email: email || undefined, // Optional
          password,
          locationName,
          timezone,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Setup failed")
      }

      // Redirect to login to sign in with new credentials
      router.push("/login?setup=success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="size-5" weight="bold" />
          Initial Setup
        </CardTitle>
        <CardDescription>
          Create your admin account and first location to get started
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Admin Account Section */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Admin Account
            </p>

            <Field>
              <FieldLabel htmlFor="fullName" className="gap-2 flex items-center">
                <User className="size-4" weight="bold" />
                <span>Full Name</span>
              </FieldLabel>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="username" className="gap-2 flex items-center">
                <At className="size-4" weight="bold" />
                <span>Username</span>
              </FieldLabel>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="admin"
                required
                autoComplete="username"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Letters, numbers, and underscores only
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="email" className="gap-2 flex items-center">
                <EnvelopeSimple className="size-4" weight="bold" />
                <span>Email</span>
                <span className="text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required for password reset via email
              </p>
            </Field>

            <Field>
              <FieldLabel htmlFor="password" className="gap-2 flex items-center">
                <Lock className="size-4" weight="bold" />
                <span>Password</span>
              </FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 12 characters"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </Field>
          </div>

          {/* Location Section */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              First Location
            </p>

            <Field>
              <FieldLabel
                htmlFor="locationName"
                className="gap-2 flex items-center"
              >
                <Buildings className="size-4" weight="bold" />
                <span>Location Name</span>
              </FieldLabel>
              <Input
                id="locationName"
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Main Office"
                required
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="timezone" className="gap-2 flex items-center">
                <Globe className="size-4" weight="bold" />
                <span>Timezone</span>
              </FieldLabel>
              <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                <SelectTrigger id="timezone" disabled={loading}>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {error && <FieldError>{error}</FieldError>}

          <Button type="submit" disabled={loading} className="w-full gap-2">
            <Rocket className="size-4" weight="bold" />
            {loading ? "Setting up..." : "Complete Setup"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
