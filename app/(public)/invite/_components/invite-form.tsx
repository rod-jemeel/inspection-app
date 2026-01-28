"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Key, User } from "lucide-react"

import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

export function InviteForm() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.toUpperCase(),
          name: name.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error?.message || "Invalid invite code")
        return
      }

      // If we have credentials, sign in automatically
      if (data.credentials) {
        await signIn.email({
          email: data.credentials.email,
          password: data.credentials.password,
          fetchOptions: {
            onError: () => {
              setError("Failed to sign in. Please try again.")
            },
            onSuccess: () => {
              router.push(`/dashboard?loc=${data.locationId}`)
            },
          },
        })
      } else {
        // User already exists, just redirect
        router.push(`/dashboard?loc=${data.locationId}`)
      }
    } catch {
      setError("Failed to verify invite code. Please try again.")
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Invite Code</CardTitle>
        <CardDescription>Use the code provided by your admin</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="code" className="gap-2 flex items-center">
              <Key className="size-4" />
              <span>Invite Code</span>
            </FieldLabel>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              required
              autoComplete="one-time-code"
              inputMode="text"
              disabled={loading}
              aria-label="Invite code"
              className="uppercase"
              minLength={6}
              maxLength={20}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="name" className="gap-2 flex items-center">
              <User className="size-4" />
              <span>Your Name (optional)</span>
            </FieldLabel>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              disabled={loading}
              aria-label="Your name"
              maxLength={255}
            />
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2"
          >
            <Key className="size-4" />
            {loading ? "Verifying..." : "Enter"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-xs text-muted-foreground">
          Staff?{" "}
          <Link
            href="/login"
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
