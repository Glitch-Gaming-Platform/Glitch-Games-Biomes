import { randomString } from "@/shared/util/helpers";

export function generateInitialUsername() {
  return `NewPlayer${randomString(4).toUpperCase()}`;
}

export function isInitialUsername(name: string) {
  return name.startsWith("NewPlayer");
}

// HARTHMERE_GLITCH_USERNAME (2026-07-05): usernames the backend auto-generates
// when no real display name was available at account-creation time. These are
// PLACEHOLDERS, not user choices — the UI may (and should) replace them with
// the real username returned by the Glitch API (`user_name`), and the
// auto-login flow upgrades them in place once the API returns a real name.
// Patterns: NewPlayerXXXX (biomes onboarding), GlitchXXXXXXXX (glitch
// user-id-derived), GuestXXXX (guest installs), user-<id> (username-collision
// fallback in getUserOrCreateIfNotExists).
export function isGeneratedPlaceholderUsername(
  name: string | null | undefined
) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return true;
  return (
    isInitialUsername(trimmed) ||
    /^Glitch[a-zA-Z0-9]{0,14}$/.test(trimmed) ||
    /^Guest[a-zA-Z0-9]{0,14}$/.test(trimmed) ||
    /^GlitchPlayer$/.test(trimmed) ||
    /^user-\d+$/.test(trimmed)
  );
}

// HARTHMERE_GLITCH_DISPLAY_USERNAME (2026-07-05): the username shown on screen
// load must be the REAL name the Glitch API returned (`user_name`, e.g.
// "blackmage"), not an id-derived placeholder like "Glitch43af071c9979a6".
// Sanitizes the API name into a valid biomes username (alnum + dots, must
// start and end alphanumeric, 3-20 chars); returns undefined when no usable
// real name is present (guests, empty/too-short names) so callers fall back to
// the stable generated scheme.
export function preferredGlitchDisplayUsername(identity: {
  userName: string | null | undefined;
  guest?: boolean;
}): string | undefined {
  if (identity.guest) return undefined;
  const raw = String(identity.userName ?? "").trim();
  // Glitch returns "Guest Player" / "Guest" / "guest_user" style names for
  // trial/guest contexts — never adopt those as a display name.
  if (!raw || /^guest[ ._-]?(user|player)?$/i.test(raw)) return undefined;
  const sanitized = raw
    .replace(/\s+/g, ".")
    .replace(/[^a-zA-Z0-9.]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 20)
    .replace(/\.+$/g, "");
  if (
    sanitized.length < 3 ||
    !/^[a-zA-Z0-9]+[a-zA-Z0-9.]*[a-zA-Z0-9]+$/.test(sanitized)
  ) {
    return undefined;
  }
  return sanitized;
}
