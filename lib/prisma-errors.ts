import { Prisma } from "@prisma/client"

const PRISMA_CONNECTIVITY_ERROR_CODES = new Set(["P1001", "P1002"])
const CONNECTIVITY_MESSAGE_PATTERN =
  /can't reach database server|can't connect to database server|connection timed out|connection refused|econnrefused|enotfound/i

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null
}

function hasConnectivityMessage(value: unknown) {
  return typeof value === "string" && CONNECTIVITY_MESSAGE_PATTERN.test(value)
}

function hasPrismaConnectivitySignal(error: unknown, visited = new WeakSet<object>()): boolean {
  if (hasConnectivityMessage(error)) {
    return true
  }

  if (!isRecord(error)) {
    return false
  }

  if (visited.has(error)) {
    return false
  }

  visited.add(error)

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return PRISMA_CONNECTIVITY_ERROR_CODES.has(error.code)
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return CONNECTIVITY_MESSAGE_PATTERN.test(error.message)
  }

  if (error instanceof Error) {
    if (hasConnectivityMessage(error.message)) {
      return true
    }

    if (hasPrismaConnectivitySignal(error.cause, visited)) {
      return true
    }
  }

  if (Array.isArray(error)) {
    return error.some((value) => hasPrismaConnectivitySignal(value, visited))
  }

  const errorCode = error.code

  if (typeof errorCode === "string" && PRISMA_CONNECTIVITY_ERROR_CODES.has(errorCode.toUpperCase())) {
    return true
  }

  return Object.values(error).some((value) => hasPrismaConnectivitySignal(value, visited))
}

export function isPrismaDatabaseConnectivityError(error: unknown) {
  return hasPrismaConnectivitySignal(error)
}
