ALTER TYPE "public"."user_type" ADD VALUE IF NOT EXISTS 'sponsor';--> statement-breakpoint
CREATE TYPE "public"."sponsor_link_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "sponsor_links" (
	"link_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_user_id" uuid NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"relationship" "relationship" NOT NULL,
	"status" "sponsor_link_status" DEFAULT 'pending' NOT NULL,
	"medical_access_granted" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_links_sponsor_patient_unique" UNIQUE("sponsor_user_id","patient_user_id")
);--> statement-breakpoint
ALTER TABLE "sponsor_links" ADD CONSTRAINT "sponsor_links_sponsor_user_id_users_user_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_links" ADD CONSTRAINT "sponsor_links_patient_user_id_users_user_id_fk" FOREIGN KEY ("patient_user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
