CREATE TYPE "public"."public_contact_recipient" AS ENUM('paquis', 'secheron', 'general');--> statement-breakpoint
CREATE TYPE "public"."public_contact_status" AS ENUM('new', 'processed', 'archived');--> statement-breakpoint
CREATE TABLE "public_contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"recipient" "public_contact_recipient" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "public_contact_status" DEFAULT 'new' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"handled_by_member_id" uuid,
	"processed_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_contact_messages_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_contact_messages_ludo_idempotency_unique" UNIQUE("ludo_id","idempotency_key_hash"),
	CONSTRAINT "public_contact_messages_hash_check" CHECK (char_length("public_contact_messages"."idempotency_key_hash")=64),
	CONSTRAINT "public_contact_messages_name_check" CHECK (char_length(trim("public_contact_messages"."name")) between 1 and 160),
	CONSTRAINT "public_contact_messages_email_check" CHECK (char_length(trim("public_contact_messages"."email")) between 3 and 320),
	CONSTRAINT "public_contact_messages_phone_check" CHECK ("public_contact_messages"."phone" is null or char_length(trim("public_contact_messages"."phone")) between 3 and 50),
	CONSTRAINT "public_contact_messages_subject_check" CHECK (char_length(trim("public_contact_messages"."subject")) between 1 and 200),
	CONSTRAINT "public_contact_messages_message_check" CHECK (char_length(trim("public_contact_messages"."message")) between 1 and 5000),
	CONSTRAINT "public_contact_messages_state_check" CHECK (("public_contact_messages"."status"='new' and "public_contact_messages"."processed_at" is null and "public_contact_messages"."archived_at" is null) or ("public_contact_messages"."status"='processed' and "public_contact_messages"."processed_at" is not null and "public_contact_messages"."archived_at" is null and "public_contact_messages"."handled_by_member_id" is not null) or ("public_contact_messages"."status"='archived' and "public_contact_messages"."archived_at" is not null and "public_contact_messages"."handled_by_member_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "public_directory_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description_markdown" text,
	"address" text,
	"postal_code" text,
	"city" text DEFAULT 'Genève' NOT NULL,
	"phone" text,
	"email" text,
	"website" text,
	"directions_url" text NOT NULL,
	"official_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_directory_entries_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_directory_entries_ludo_slug_unique" UNIQUE("ludo_id","slug"),
	CONSTRAINT "public_directory_entries_publication_check" CHECK (("public_directory_entries"."status"='draft' and "public_directory_entries"."published_at" is null and "public_directory_entries"."published_by_member_id" is null) or ("public_directory_entries"."status" in ('published','hidden') and "public_directory_entries"."published_at" is not null and "public_directory_entries"."published_by_member_id" is not null)),
	CONSTRAINT "public_directory_entries_name_check" CHECK (char_length(trim("public_directory_entries"."name")) between 1 and 180),
	CONSTRAINT "public_directory_entries_description_check" CHECK ("public_directory_entries"."description_markdown" is null or char_length(trim("public_directory_entries"."description_markdown")) between 1 and 10000),
	CONSTRAINT "public_directory_entries_contact_check" CHECK ("public_directory_entries"."address" is null or char_length(trim("public_directory_entries"."address")) between 1 and 500),
	CONSTRAINT "public_directory_entries_urls_check" CHECK (char_length(trim("public_directory_entries"."directions_url")) between 1 and 2000 and char_length(trim("public_directory_entries"."official_url")) between 1 and 2000),
	CONSTRAINT "public_directory_entries_sort_check" CHECK ("public_directory_entries"."sort_order" between 0 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "public_contact_messages" ADD CONSTRAINT "public_contact_messages_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_contact_messages" ADD CONSTRAINT "public_contact_messages_handler_tenant_fk" FOREIGN KEY ("handled_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_directory_entries" ADD CONSTRAINT "public_directory_entries_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_directory_entries" ADD CONSTRAINT "public_directory_entries_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_directory_entries" ADD CONSTRAINT "public_directory_entries_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_directory_entries" ADD CONSTRAINT "public_directory_entries_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_contact_messages_inbox_idx" ON "public_contact_messages" USING btree ("ludo_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "public_directory_entries_public_order_idx" ON "public_directory_entries" USING btree ("ludo_id","status","sort_order","id");