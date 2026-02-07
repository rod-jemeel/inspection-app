import { Button, Section, Text } from "@react-email/components"
import { EmailLayout } from "./components/layout"

interface ReminderEmailProps {
  task: string
  dueAt: string
  locationName?: string
  inspectionUrl: string
  type: "reminder" | "overdue" | "escalation" | "due_today" | "upcoming" | "monthly_warning" | "assignment"
}

function getEmailContent(type: ReminderEmailProps["type"]) {
  switch (type) {
    case "assignment":
      return {
        title: "New Assignment",
        message: "You have been assigned a new inspection:",
        isOverdue: false,
        urgency: "",
        buttonText: "View Assignment",
      }
    case "overdue":
      return {
        title: "Overdue Inspection",
        message: "The following inspection is overdue and requires immediate attention:",
        isOverdue: true,
        urgency: "",
        buttonText: "Complete Inspection",
      }
    case "escalation":
      return {
        title: "Overdue Inspection",
        message: "The following inspection is overdue and requires immediate attention:",
        isOverdue: true,
        urgency: " - URGENT",
        buttonText: "Complete Inspection",
      }
    case "due_today":
      return {
        title: "Inspection Due Today",
        message: "The following inspection is due today:",
        isOverdue: false,
        urgency: "",
        buttonText: "Complete Inspection",
      }
    case "upcoming":
      return {
        title: "Upcoming Inspection",
        message: "You have an upcoming inspection that needs to be completed:",
        isOverdue: false,
        urgency: "",
        buttonText: "View Inspection",
      }
    case "monthly_warning":
      return {
        title: "Monthly Reminder",
        message: "This is your monthly reminder for an upcoming inspection:",
        isOverdue: false,
        urgency: "",
        buttonText: "View Inspection",
      }
    default:
      return {
        title: "Inspection Reminder",
        message: "You have an upcoming inspection that needs to be completed:",
        isOverdue: false,
        urgency: "",
        buttonText: "Complete Inspection",
      }
  }
}

export function ReminderEmail({
  task,
  dueAt,
  locationName,
  inspectionUrl,
  type,
}: ReminderEmailProps) {
  const { title, message, isOverdue, urgency, buttonText } = getEmailContent(type)

  return (
    <EmailLayout preview={`${title}: ${task}${urgency}`}>
      <Section style={content}>
        <Text style={heading}>
          {title}
          {urgency}
        </Text>

        <Text style={paragraph}>{message}</Text>

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
          {buttonText}
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
