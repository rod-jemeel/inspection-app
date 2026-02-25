import { NextRequest } from "next/server"
import { requireExportReports } from "@/lib/server/auth-helpers"
import { handleError, validationError } from "@/lib/server/errors"
import { exportLogPdfRequestSchema } from "@/lib/validations/log-export"
import { buildLogExportPdf } from "@/lib/server/log-pdf/export-service"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params
    await requireExportReports(locationId)

    const body = await request.json()
    const parsed = exportLogPdfRequestSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues).toResponse()

    const result = await buildLogExportPdf(locationId, parsed.data)

    return new Response(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return handleError(error)
  }
}
