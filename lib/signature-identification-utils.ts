export interface SignatureIdentificationRowLike {
  name: string
  signature: string | null
  initials: string
}

export interface UpsertSignerIntoSignatureTableInput {
  name: string
  initials: string
  signature: string | null
}

export interface UpsertSignerIntoSignatureTableResult<T extends SignatureIdentificationRowLike> {
  signatures: T[]
  status: "matched" | "inserted" | "full"
  index: number | null
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function normalizeInitials(value: string): string {
  return value.trim().toUpperCase()
}

function isEmptyRow(row: SignatureIdentificationRowLike): boolean {
  return !row.name.trim() && !row.initials.trim() && !row.signature
}

export function upsertSignerInSignatureIdentification<T extends SignatureIdentificationRowLike>(
  signatures: T[],
  signer: UpsertSignerIntoSignatureTableInput,
): UpsertSignerIntoSignatureTableResult<T> {
  const normalizedSignerName = normalizeName(signer.name)
  const normalizedSignerInitials = normalizeInitials(signer.initials)

  const matchedIndex = signatures.findIndex((row) =>
    normalizeName(row.name) === normalizedSignerName &&
    normalizeInitials(row.initials) === normalizedSignerInitials,
  )

  if (matchedIndex >= 0) {
    const updated = [...signatures]
    const current = updated[matchedIndex]
    updated[matchedIndex] = {
      ...current,
      name: current.name.trim() ? current.name : signer.name,
      initials: current.initials.trim() ? current.initials : signer.initials,
      signature: current.signature ?? signer.signature,
    }
    return { signatures: updated, status: "matched", index: matchedIndex }
  }

  const emptyIndex = signatures.findIndex(isEmptyRow)
  if (emptyIndex < 0) {
    return { signatures, status: "full", index: null }
  }

  const updated = [...signatures]
  updated[emptyIndex] = {
    ...updated[emptyIndex],
    name: signer.name,
    initials: signer.initials,
    signature: signer.signature,
  }

  return { signatures: updated, status: "inserted", index: emptyIndex }
}

