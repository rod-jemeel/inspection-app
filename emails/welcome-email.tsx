import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/layout"

interface WelcomeEmailProps {
  fullName: string
  email: string
  tempPassword: string
  loginUrl: string
}

export function WelcomeEmail({
  fullName,
  email,
  tempPassword,
  loginUrl,
}: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Welcome to Inspection Tracker, ${fullName}`}>
      <Section style={content}>
        <Text style={heading}>Welcome to Inspection Tracker</Text>

        <Text style={paragraph}>Hi {fullName},</Text>

        <Text style={paragraph}>
          An account has been created for you. Use the credentials below to sign
          in:
        </Text>

        <Section style={credentialsBox}>
          <Text style={credentialLabel}>Email</Text>
          <Text style={credentialValue}>{email}</Text>

          <Text style={{ ...credentialLabel, marginTop: "12px" }}>
            Temporary Password
          </Text>
          <Text style={credentialValueHighlight}>{tempPassword}</Text>
        </Section>

        <Text style={warningText}>
          For security, you will be required to change your password after your
          first login.
        </Text>

        <Button style={button} href={loginUrl}>
          Sign In Now
        </Button>

        <Text style={footnote}>
          If you did not expect this email, please contact your administrator.
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

const credentialsBox = {
  backgroundColor: "#f6f9fc",
  padding: "20px",
  marginBottom: "24px",
}

const credentialLabel = {
  fontSize: "11px",
  color: "#8898aa",
  margin: "0 0 4px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
}

const credentialValue = {
  fontSize: "14px",
  color: "#0a0a0a",
  margin: 0,
  fontWeight: "500",
}

const credentialValueHighlight = {
  fontSize: "16px",
  color: "#0a0a0a",
  margin: 0,
  fontWeight: "600",
  fontFamily: "monospace",
  letterSpacing: "1px",
}

const warningText = {
  fontSize: "13px",
  color: "#dc2626",
  lineHeight: "20px",
  margin: "0 0 24px",
  fontWeight: "500",
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

const footnote = {
  fontSize: "12px",
  color: "#8898aa",
  margin: 0,
}

export default WelcomeEmail
