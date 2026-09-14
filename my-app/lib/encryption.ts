import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.ENCRYPTION_KEY ?? "")) throw new Error("ENCRYPTION_KEY must be 64 hex characters.");
  return Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
}

export function encrypt(text: string, owner = ""): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(owner));
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string, owner = ""): string {
  const key = encryptionKey();
  if (!/^[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+$/i.test(encryptedText)) throw new Error("Invalid encrypted credential.");
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(Buffer.from(owner));
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
