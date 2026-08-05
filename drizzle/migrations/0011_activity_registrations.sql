CREATE TYPE "public"."public_activity_registration_outbox_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."public_activity_registration_status" AS ENUM('received', 'waitlisted', 'confirmed', 'declined', 'cancelled', 'archived');--> statement-breakpoint
CREATE TABLE "public_activity_registration_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"registration_id" uuid NOT NULL,
	"kind" text DEFAULT 'receipt' NOT NULL,
	"recipient_email" text NOT NULL,
	"status" "public_activity_registration_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_activity_registration_outbox_registration_kind_unique" UNIQUE("registration_id","kind"),
	CONSTRAINT "public_activity_registration_outbox_kind_check" CHECK ("public_activity_registration_outbox"."kind" = 'receipt'),
	CONSTRAINT "public_activity_registration_outbox_recipient_check" CHECK (char_length(trim("public_activity_registration_outbox"."recipient_email")) between 3 and 320),
	CONSTRAINT "public_activity_registration_outbox_attempts_check" CHECK ("public_activity_registration_outbox"."attempts" >= 0),
	CONSTRAINT "public_activity_registration_outbox_state_check" CHECK (("public_activity_registration_outbox"."status" = 'sent' and "public_activity_registration_outbox"."sent_at" is not null) or ("public_activity_registration_outbox"."status" <> 'sent' and "public_activity_registration_outbox"."sent_at" is null))
);
--> statement-breakpoint
CREATE TABLE "public_activity_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"participant_count" integer NOT NULL,
	"message" text,
	"status" "public_activity_registration_status" DEFAULT 'received' NOT NULL,
	"receipt_status" "public_activity_registration_status" DEFAULT 'received' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"handled_by_member_id" uuid,
	"handled_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_activity_registrations_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_activity_registrations_ludo_idempotency_unique" UNIQUE("ludo_id","idempotency_key_hash"),
	CONSTRAINT "public_activity_registrations_hash_check" CHECK (char_length("public_activity_registrations"."idempotency_key_hash") = 64),
	CONSTRAINT "public_activity_registrations_fingerprint_check" CHECK (char_length("public_activity_registrations"."request_fingerprint") = 64),
	CONSTRAINT "public_activity_registrations_name_check" CHECK (char_length(trim("public_activity_registrations"."contact_name")) between 1 and 160),
	CONSTRAINT "public_activity_registrations_email_check" CHECK (char_length(trim("public_activity_registrations"."email")) between 3 and 320),
	CONSTRAINT "public_activity_registrations_phone_check" CHECK ("public_activity_registrations"."phone" is null or char_length(trim("public_activity_registrations"."phone")) between 3 and 50),
	CONSTRAINT "public_activity_registrations_participant_count_check" CHECK ("public_activity_registrations"."participant_count" between 1 and 50),
	CONSTRAINT "public_activity_registrations_message_check" CHECK ("public_activity_registrations"."message" is null or char_length(trim("public_activity_registrations"."message")) between 1 and 2000),
	CONSTRAINT "public_activity_registrations_handling_check" CHECK (("public_activity_registrations"."handled_by_member_id" is null and "public_activity_registrations"."handled_at" is null) or ("public_activity_registrations"."handled_by_member_id" is not null and "public_activity_registrations"."handled_at" is not null)),
	CONSTRAINT "public_activity_registrations_archive_check" CHECK (("public_activity_registrations"."status" = 'archived' and "public_activity_registrations"."archived_at" is not null and "public_activity_registrations"."handled_by_member_id" is not null) or ("public_activity_registrations"."status" <> 'archived' and "public_activity_registrations"."archived_at" is null)),
	CONSTRAINT "public_activity_registrations_receipt_status_check" CHECK ("public_activity_registrations"."receipt_status" in ('received', 'waitlisted'))
);
--> statement-breakpoint
ALTER TABLE "public_activities" ADD COLUMN "registration_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "public_activities" ADD COLUMN "registration_capacity" integer;--> statement-breakpoint
ALTER TABLE "public_activity_registration_outbox" ADD CONSTRAINT "public_activity_registration_outbox_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_registration_outbox" ADD CONSTRAINT "public_activity_registration_outbox_registration_tenant_fk" FOREIGN KEY ("registration_id","ludo_id") REFERENCES "public"."public_activity_registrations"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_registrations" ADD CONSTRAINT "public_activity_registrations_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_registrations" ADD CONSTRAINT "public_activity_registrations_activity_tenant_fk" FOREIGN KEY ("activity_id","ludo_id") REFERENCES "public"."public_activities"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_registrations" ADD CONSTRAINT "public_activity_registrations_handler_tenant_fk" FOREIGN KEY ("handled_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_activity_registration_outbox_pending_idx" ON "public_activity_registration_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "public_activity_registrations_management_idx" ON "public_activity_registrations" USING btree ("ludo_id","activity_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "public_activities" ADD CONSTRAINT "public_activities_registration_capacity_check" CHECK ("public_activities"."registration_capacity" is null or "public_activities"."registration_capacity" between 1 and 10000);