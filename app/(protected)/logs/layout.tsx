import { LogsLayout } from "./_components/logs-layout"

export default function Layout({ children }: { children: React.ReactNode }) {
  return <LogsLayout>{children}</LogsLayout>
}
