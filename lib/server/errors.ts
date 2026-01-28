import "server-only"

const ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ROLE_REQUIRED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  INVALID_CODE: 400,
  EXPIRED_CODE: 410,
  CODE_EXHAUSTED: 409,
  ALREADY_SIGNED: 409,
  INVALID_TRANSITION: 400,
  INTERNAL_ERROR: 500,
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
    this.status = ERROR_CODES[code]
    this.name = "ApiError"
  }

  toResponse(): Response {
    return Response.json(
      { error: { code: this.code, message: this.message } },
      { status: this.status }
    )
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof ApiError) {
    return error.toResponse()
  }

  console.error("Unhandled error:", error)
  return new ApiError("INTERNAL_ERROR", "An unexpected error occurred").toResponse()
}

export function validationError(issues: { message: string }[]): ApiError {
  const message = issues.map((i) => i.message).join(", ")
  return new ApiError("VALIDATION_ERROR", message)
}
