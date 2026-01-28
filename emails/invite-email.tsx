import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/layout"

interface InviteEmailProps {
  inviteCode: string
  locationName: string
  inviteUrl: string
  expiresAt: string
}

export function InviteEmail({
  inviteCode,
  locationName,
  inviteUrl,
  expiresAt,
}: InviteEmailProps) {
  return (
    <EmailLayout preview={`You've been invited to ${locationName}`}>
      <Section style={content}>
        <Text style={heading}>You're Invited</Text>

        <Text style={paragraph}>
          You've been invited to join <strong>{locationName}</strong> on
          Inspection Tracker.
        </Text>

        <Section style={codeBox}>
          <Text style={codeLabel}>Your Invite Code</Text>
          <Text style={codeValue}>{inviteCode}</Text>
        </Section>

        <Text style={paragraph}>
          This code expires on{" "}
          {new Date(expiresAt).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </Text>

        <Button style={button} href={inviteUrl}>
          Accept Invitation
        </Button>

        <Text style={footnote}>Or enter the code manually at the login page.</Text>
      </Section>
    </EmailLayout>
  )
}

const content = {
  padding: "20px 48px",
}

const heading = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#0a0a0a",
  margin: "0 0 16px",
}

const paragraph = {
  fontSize: "14px",
  color: "#525f7f",
  lineHeight: "24px",
  margin: "0 0 16px",
}

const codeBox = {
  backgroundColor: "#0a0a0a",
  padding: "24px",
  textAlign: "center" as const,
  marginBottom: "24px",
}

const codeLabel = {
  fontSize: "12px",
  color: "#a1a1aa",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
}

const codeValue = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#ffffff",
  fontFamily: "monospace",
  letterSpacing: "4px",
  margin: 0,
}

const button = {
  backgroundColor: "#0a0a0a",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "500",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
}

const footnote = {
  fontSize: "12px",
  color: "#8898aa",
  textAlign: "center" as const,
  marginTop: "16px",
}

export default InviteEmail
