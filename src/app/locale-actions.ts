"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

/** A language preference is public; Next validates the origin of this Server Action. */
export async function setLocaleAction(form: FormData): Promise<void> {
  const locale = form.get("locale");
  if (!isLocale(locale)) throw new Error("Unsupported locale.");
  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
