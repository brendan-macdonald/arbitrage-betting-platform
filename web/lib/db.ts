/**
 * Prisma client singleton:
 * - In Next.js dev mode, files can hot-reload, creating multiple clients.
 * - We attach the client to globalThis in dev to reuse a single instance.
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ["query"], // uncomment to watch SQL in your terminal (great for learning)
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
