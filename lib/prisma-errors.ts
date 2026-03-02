import { Prisma } from "@prisma/client"

const PRISMA_CONNECTIVITY_ERROR_CODES = new Set(["P1001", "P1002"])
const CONNECTIVITY_MESSAGE_PATTERN =
  /can't reach database server|can't connect to database server|connection timed out|connection refused|econnrefused|enotfound/i

export function isPrismaDatabaseConnectivityError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return PRISMA_CONNECTIVITY_ERROR_CODES.has(error.code)
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return CONNECTIVITY_MESSAGE_PATTERN.test(error.message)
  }

  return error instanceof Error && CONNECTIVITY_MESSAGE_PATTERN.test(error.message)
}
