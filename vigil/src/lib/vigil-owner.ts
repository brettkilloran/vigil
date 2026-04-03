import { and, desc, eq } from "drizzle-orm";

import type { tryGetDb } from "@/src/db/index";
import { spaces, users } from "@/src/db/schema";

export type VigilDb = NonNullable<ReturnType<typeof tryGetDb>>;

export async function getOrCreateOwnerUser(db: VigilDb) {
  const forcedOwner = process.env.VIGIL_OWNER_ID;

  let user = forcedOwner
    ? (await db.select().from(users).where(eq(users.id, forcedOwner)).limit(1))[0]
    : undefined;

  if (!user) {
    const existing = await db.select().from(users).limit(1);
    user = existing[0];
  }

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        ...(forcedOwner ? { id: forcedOwner } : {}),
        name: "VIGIL Owner",
        email: "vigil@local",
      })
      .returning();
    user = created!;
  }

  return user;
}

export async function listSpacesForUser(db: VigilDb, userId: string) {
  return db
    .select()
    .from(spaces)
    .where(eq(spaces.userId, userId))
    .orderBy(desc(spaces.updatedAt));
}

/**
 * Ensures at least one space exists, resolves the active space (requested or most recently updated).
 */
export async function resolveActiveSpace(
  db: VigilDb,
  userId: string,
  requestedSpaceId?: string,
) {
  let userSpaces = await listSpacesForUser(db, userId);

  if (userSpaces.length === 0) {
    const [created] = await db
      .insert(spaces)
      .values({ userId, name: "Main space" })
      .returning();
    userSpaces = [created!];
  }

  const active =
    requestedSpaceId &&
    userSpaces.some((s) => s.id === requestedSpaceId)
      ? userSpaces.find((s) => s.id === requestedSpaceId)!
      : userSpaces[0];

  return { activeSpace: active, allSpaces: userSpaces };
}

export async function assertSpaceOwnedByUser(
  db: VigilDb,
  spaceId: string,
  userId: string,
) {
  const [row] = await db
    .select()
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)))
    .limit(1);
  return row;
}
