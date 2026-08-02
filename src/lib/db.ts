import { PrismaClient } from "@prisma/client";
import { previewDatabaseIsShared } from "@/lib/externalWrites";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Prisma operations that change data. Anything not listed is a read.
 */
const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
  "executeRawUnsafe",
  "queryRaw",
  "queryRawUnsafe",
]);

/**
 * A preview deployment gets the same `DATABASE_URL` as production unless
 * someone scopes it, which means any branch can write to live data just by
 * being deployed. Reads are what a preview is for; writes are refused until
 * the deployment is told it has a database of its own.
 *
 * Set `PREVIEW_DATABASE_IS_SHADOW=1` on the Preview environment once it points
 * at a shadow database — then previews write normally again, to their own copy.
 */
function guarded(client: PrismaClient): PrismaClient {
  if (!previewDatabaseIsShared()) return client;

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          if (WRITE_OPERATIONS.has(operation)) {
            throw new Error(
              `This deployment shares the production database and may not write ` +
                `(${model}.${operation}). Point Preview at a shadow database and set ` +
                `PREVIEW_DATABASE_IS_SHADOW=1.`
            );
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? guarded(new PrismaClient());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
