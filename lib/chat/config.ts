const DEFAULT_CHAT_WS_PORT = 3001

export const CHAT_TOKEN_TTL_SECONDS = 60 * 5

export function getChatJwtSecret() {
  const secret = process.env.CHAT_JWT_SECRET

  if (!secret) {
    throw new Error("Missing CHAT_JWT_SECRET environment variable.")
  }

  return secret
}

export function getChatWsPort() {
  const rawPort = process.env.CHAT_WS_PORT
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : DEFAULT_CHAT_WS_PORT

  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    return DEFAULT_CHAT_WS_PORT
  }

  return parsedPort
}

export function getChatWsUrl() {
  return process.env.CHAT_WS_URL?.trim() || `ws://localhost:${getChatWsPort()}`
}
