import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/layout"

interface ReminderEmailProps {
  task: string
  dueAt: string
  locationName?: string
  inspectionUrl: string
  type: "reminder" | "overdue" | "escalation"
}

export function ReminderEmail({
  task,
  dueAt,
  locationName,
  inspectionUrl,
  type,
}: ReminderEmailProps) {
  const isOverdue = type === "overdue" || type === "escalation"
  const title = isOverdue ? "Overdue Inspection" : "Inspection Reminder"
  const urgency = type === "escalation" ? " - URGENT" : ""

  return (
    <EmailLayout preview={`${title}: ${task}${urgency}`}>
      <Section style={content}>
        <Text style={heading}>
          {title}
          {urgency}
        </Text>

        <Text style={paragraph}>
          {isOverdue
            ? `The following inspection is overdue and requires immediate attention:`
            : `You have an upcoming inspection that needs to be completed:`}
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Task</Text>
          <Text style={detailValue}>{task}</Text>

          {locationName && (
            <>
              <Text style={detailLabel}>Location</Text>
              <Text style={detailValue}>{locationName}</Text>
            </>
          )}

          <Text style={detailLabel}>{isOverdue ? "Was Due" : "Due Date"}</Text>
          <Text
            style={{ ...detailValue, color: isOverdue ? "#dc2626" : "#0a0a0a" }}
          >
            {new Date(dueAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </Section>

        <Button style={button} href={inspectionUrl}>
          Complete Inspection
        </Button>
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

const detailsBox = {
  backgroundColor: "#f6f9fc",
  padding: "16px",
  marginBottom: "24px",
}

const detailLabel = {
  fontSize: "12px",
  color: "#8898aa",
  margin: "0 0 4px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
}

const detailValue = {
  fontSize: "14px",
  color: "#0a0a0a",
  margin: "0 0 12px",
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
}

export default ReminderEmail
