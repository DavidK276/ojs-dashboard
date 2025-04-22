import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { json } from "@sveltejs/kit";

export const GET: RequestHandler = async () => {
    const emailsResult = await db.select({ email: users.email }).from(users).where(eq(users.disabled, false));
    const emails: string[] = [];
    emailsResult.forEach(row => emails.push(row.email))

    return json({ emails });
}