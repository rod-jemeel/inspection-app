import "server-only"
import crypto from "crypto"

/**
 * Generate a cryptographically secure random password
 * @param length Password length (default 16)
 * @returns Random password string
 */
export function generateSecurePassword(length = 16): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz"
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const special = "!@#$%^&*"
  const charset = lowercase + uppercase + numbers + special

  const randomBytes = crypto.randomBytes(length)
  let password = ""

  // Ensure at least one of each type
  password += lowercase[crypto.randomInt(lowercase.length)]
  password += uppercase[crypto.randomInt(uppercase.length)]
  password += numbers[crypto.randomInt(numbers.length)]
  password += special[crypto.randomInt(special.length)]

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[randomBytes[i] % charset.length]
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("")
}

/**
 * Check if a user exists in the database
 */
export async function checkHasUsers(): Promise<boolean> {
  const { supabase } = await import("@/lib/server/db")
  const { count } = await supabase
    .from("user")
    .select("*", { count: "exact", head: true })

  return (count ?? 0) > 0
}
