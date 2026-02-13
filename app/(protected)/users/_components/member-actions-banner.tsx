"use client"

import { UserPlus, Key, Check, Copy, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface MemberActionsBannerProps {
  generatedCredentials: {
    username: string
    password: string
    fullName: string
  } | null
  resetPasswordResult: {
    tempPassword: string
    fullName: string
  } | null
  generatedCode: string | null
  onDismissCredentials: () => void
  onDismissReset: () => void
  onDismissCode: () => void
}

export function MemberActionsBanner({
  generatedCredentials,
  resetPasswordResult,
  generatedCode,
  onDismissCredentials,
  onDismissReset,
  onDismissCode,
}: MemberActionsBannerProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <>
      {/* Generated Credentials Banner */}
      {generatedCredentials && (
        <div className="flex items-center gap-3 rounded-md border-2 border-green-500 bg-green-500/5 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-500/10">
            <UserPlus className="size-5 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">
              Member Created: {generatedCredentials.fullName}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <div>
                <span className="text-[11px] text-muted-foreground">Username: </span>
                <code className="text-sm font-mono font-semibold">{generatedCredentials.username}</code>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground">Password: </span>
                <code className="text-sm font-mono font-semibold">{generatedCredentials.password}</code>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Share these credentials. They'll be prompted to change their password.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(`Username: ${generatedCredentials.username}\nPassword: ${generatedCredentials.password}`)}
              className="gap-1.5"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissCredentials}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Reset Password Banner */}
      {resetPasswordResult && (
        <div className="flex items-center gap-3 rounded-md border-2 border-amber-500 bg-amber-500/5 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
            <Key className="size-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">
              Password Reset: {resetPasswordResult.fullName}
            </div>
            <div className="mt-1">
              <span className="text-[11px] text-muted-foreground">New Password: </span>
              <code className="text-sm font-mono font-semibold">{resetPasswordResult.tempPassword}</code>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Share this password. They'll be prompted to change it on next login.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(resetPasswordResult.tempPassword)}
              className="gap-1.5"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissReset}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Generated Invite Code Banner */}
      {generatedCode && (
        <div className="flex items-center gap-3 rounded-md border-2 border-primary bg-primary/5 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Key className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted-foreground">Invite Code Generated</div>
            <code className="text-base font-mono font-semibold tracking-widest">{generatedCode}</code>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedCode)} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissCode}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
