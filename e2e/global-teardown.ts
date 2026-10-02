import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { cleanup } from './global-setup'

export default async function globalTeardown() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  try {
    await cleanup(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
