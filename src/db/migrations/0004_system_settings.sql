CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_single_row" CHECK ("id" = 1)
);
