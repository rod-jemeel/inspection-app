"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, LogIn } from "lucide-react"

import { authClient } from "@/lib/auth-client"
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

interface LoginFormProps {
  showSetupSuccess?: boolean
}

export function LoginForm({ showSetupSuccess }: LoginFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.signIn.username({
        username,
        password,
      })

      if (result.error) {
        setError(result.error.message || "Invalid credentials")
      } else {
        router.push("/dashboard")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your credentials to continue</CardDescription>
      </CardHeader>

      <CardContent>
        {showSetupSuccess && (
          <div className="mb-4 p-3 bg-primary/10 text-primary text-xs rounded-md">
            Setup complete! Sign in with your new account.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="username" className="gap-2 flex items-center">
              <User className="size-4" />
              <span>Username</span>
            </FieldLabel>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
              disabled={loading}
              aria-label="Username"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              disabled={loading}
              aria-label="Password"
            />
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2"
          >
            <LogIn className="size-4" />
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Link
          href="/forgot-password"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
        >
          Forgot password?
        </Link>
        <p className="text-xs text-muted-foreground">
          Inspector?{" "}
          <Link
            href="/invite"
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            Enter invite code
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
