import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={headerText}>Inspection Tracker</Text>
          </Section>
          {children}
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated message from Inspection Tracker.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    "'Noto Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
}

const header = {
  padding: "20px 48px",
  borderBottom: "1px solid #e6ebf1",
}

const headerText = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#0a0a0a",
  margin: 0,
}

const footer = {
  padding: "20px 48px",
  borderTop: "1px solid #e6ebf1",
}

const footerText = {
  fontSize: "12px",
  color: "#8898aa",
  margin: 0,
}
