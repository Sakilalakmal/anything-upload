import { SignJWT, jwtVerify } from "jose"

import { CHAT_TOKEN_TTL_SECONDS, getChatJwtSecret } from "@/lib/chat/config"

const CHAT_JWT_ALGORITHM = "HS256"

function getJwtKey() {
  return new TextEncoder().encode(getChatJwtSecret())
}

export async function mintChatToken(userId: string) {
  const expiresAt = new Date(Date.now() + CHAT_TOKEN_TTL_SECONDS * 1000)
  const token = await new SignJWT({
    type: "chat",
  })
    .setProtectedHeader({
      alg: CHAT_JWT_ALGORITHM,
      typ: "JWT",
    })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getJwtKey())

  return {
    token,
    expiresAt,
  }
}

export async function verifyChatToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtKey(), {
    algorithms: [CHAT_JWT_ALGORITHM],
  })

  if (payload.type !== "chat" || typeof payload.sub !== "string" || !payload.sub.trim()) {
    throw new Error("Invalid chat token.")
  }

  return {
    userId: payload.sub,
  }
}
