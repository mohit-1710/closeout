import type { AccountProfile } from "./account-profile";

export type RecentProfile = Pick<AccountProfile, "accountAddress" | "displayName" | "username">;
export const RECENT_PROFILE_KEY = "closeout-recent-profile-v1";

/** A convenience bookmark, never a session, permission or trusted account binding. */
export function readRecentProfile(raw: string | null): RecentProfile | null {
  if (!raw || raw.length > 1_000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (
      typeof value.accountAddress !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(value.accountAddress)
    )
      return null;
    if (/^0x0{40}$/i.test(value.accountAddress)) return null;
    const label = (name: unknown) => (typeof name === "string" && name.length <= 200 ? name : null);
    return {
      accountAddress: value.accountAddress,
      displayName: label(value.displayName),
      username: label(value.username),
    };
  } catch {
    return null;
  }
}
