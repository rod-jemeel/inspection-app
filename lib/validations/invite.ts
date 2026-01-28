import { z } from "zod"

export const createInviteSchema = z.object({
  assigned_email: z.string().email(),
  expires_in_days: z.number().int().min(1).max(30).default(7),
  max_uses: z.number().int().min(1).max(10).default(1),
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>

export const exchangeInviteSchema = z.object({
  code: z.string().min(6).max(20),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
})

export type ExchangeInviteInput = z.infer<typeof exchangeInviteSchema>
