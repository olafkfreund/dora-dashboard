import "server-only"
import crypto from "node:crypto"

// AES-256-GCM encryption for integration secrets (tokens). Never sent to the client.
function getKey(): Buffer {
  const b64 = process.env.APP_ENCRYPTION_KEY
  if (!b64) throw new Error("APP_ENCRYPTION_KEY is not set")
  const key = Buffer.from(b64, "base64")
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes (base64-encoded)")
  }
  return key
}

/** Returns "ciphertext:iv:tag" (all base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [enc.toString("base64"), iv.toString("base64"), tag.toString("base64")].join(":")
}

export function decryptSecret(blob: string): string {
  const [ct, iv, tag] = blob.split(":")
  if (!ct || !iv || !tag) throw new Error("Malformed encrypted blob")
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8")
}

/** Show only the last 4 chars of a secret for UI confirmation. */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••"
  return "••••" + plaintext.slice(-4)
}
