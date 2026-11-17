import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { systemSettings } from '../db/schemas/system-settings';
import { logger } from '../config/logger';

// Admin-editable settings, stored in system_settings (one row). Each one has a real effect:
// - supportEmail: shown to users (GET /misc/configuration).
// - allowSelfSignup: false closes POST /auth/register (admins can still create accounts).
// - emailNotifications: false stops appointment confirmations and payment receipts.
//   Security emails (password reset, email verification) are always sent.
// - maintenanceMode + maintenanceMessage: the web app shows the message, and the API refuses
//   changes (POST, PUT, PATCH, DELETE) from everyone except admins. Reading and signing in still work.

export const settingsSchema = z.object({
  supportEmail: z.string().trim().email('Enter a valid email address'),
  allowSelfSignup: z.boolean(),
  emailNotifications: z.boolean(),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().max(300, 'Keep the message under 300 characters'),
});

export type SystemSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SystemSettings = {
  supportEmail: 'support@isanomed.org',
  allowSelfSignup: true,
  emailNotifications: true,
  maintenanceMode: false,
  maintenanceMessage: 'IsanoMed is undergoing maintenance. You can still view your information; changes are paused for a short while.',
};

export interface SettingsView extends SystemSettings {
  updatedAt: string | null;
}

// Read on most requests (maintenance check), so keep a short in-memory copy.
const CACHE_MS = 15_000;
let cache: { value: SettingsView; at: number } | null = null;

const merge = (stored: unknown): SystemSettings => {
  const parsed = settingsSchema.partial().safeParse(stored ?? {});
  return { ...DEFAULT_SETTINGS, ...(parsed.success ? parsed.data : {}) };
};

export const getSettings = async (): Promise<SettingsView> => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
    const value: SettingsView = { ...merge(row?.settings), updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null };
    cache = { value, at: Date.now() };
    return value;
  } catch (error) {
    // A missing table (migration not applied yet) must not take the API down.
    logger.error(`Settings could not be read, using defaults: ${error instanceof Error ? error.message : String(error)}`);
    return { ...DEFAULT_SETTINGS, updatedAt: null };
  }
};

export const updateSettings = async (input: unknown, adminUserId: string): Promise<SettingsView> => {
  const changes = settingsSchema.partial().strict().parse(input);
  const current = await getSettings();
  const { updatedAt: _ignored, ...currentSettings } = current;
  const next = settingsSchema.parse({ ...currentSettings, ...changes });
  const now = new Date();

  await db
    .insert(systemSettings)
    .values({ id: 1, settings: next, updatedBy: adminUserId, updatedAt: now })
    .onConflictDoUpdate({ target: systemSettings.id, set: { settings: next, updatedBy: adminUserId, updatedAt: now } });

  const value: SettingsView = { ...next, updatedAt: now.toISOString() };
  cache = { value, at: Date.now() };
  logger.info(`System settings updated by ${adminUserId}: ${Object.keys(changes).join(', ') || 'no changes'}`);
  return value;
};

/** Settings anyone may see (no admin details). */
export const publicSettings = (s: SettingsView) => ({
  supportEmail: s.supportEmail,
  allowSelfSignup: s.allowSelfSignup,
  maintenance: { enabled: s.maintenanceMode, message: s.maintenanceMode ? s.maintenanceMessage : null },
});
