import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/layout"

interface PasswordResetEmailProps {
  fullName: string
  resetUrl: string
}

export function PasswordResetEmail({
  fullName,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your password">
      <Section style={content}>
        <Text style={heading}>Reset Your Password</Text>

        <Text style={paragraph}>Hi {fullName},</Text>

        <Text style={paragraph}>
          We received a request to reset your password. Click the button below
          to choose a new password:
        </Text>

        <Button style={button} href={resetUrl}>
          Reset Password
        </Button>

        <Text style={warningText}>
          This link will expire in 1 hour. If you didn't request a password
          reset, you can safely ignore this email.
        </Text>

        <Text style={footnote}>
          If the button doesn't work, copy and paste this link into your
          browser:
          <br />
          <span style={{ color: "#525f7f", wordBreak: "break-all" }}>
            {resetUrl}
          </span>
        </Text>
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

const button = {
  backgroundColor: "#0a0a0a",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "500",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
  marginBottom: "24px",
}

const warningText = {
  fontSize: "13px",
  color: "#8898aa",
  lineHeight: "20px",
  margin: "0 0 24px",
}

const footnote = {
  fontSize: "12px",
  color: "#8898aa",
  margin: 0,
  lineHeight: "18px",
}

export default PasswordResetEmail
