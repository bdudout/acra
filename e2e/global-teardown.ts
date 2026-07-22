import { PrismaClient } from '@prisma/client'
import { cleanup } from './global-setup'

export default async function globalTeardown() {
  const prisma = new PrismaClient()
  try {
    await cleanup(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
