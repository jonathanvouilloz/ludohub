CREATE TYPE "public"."family_registration_document_kind" AS ENUM('rules', 'contract', 'privacy', 'other');--> statement-breakpoint
CREATE TYPE "public"."family_registration_gender" AS ENUM('female', 'male', 'other', 'unspecified');--> statement-breakpoint
CREATE TYPE "public"."family_registration_payment_method" AS ENUM('twint', 'cash');--> statement-breakpoint
CREATE TYPE "public"."family_registration_submission_status" AS ENUM('new', 'processed');--> statement-breakpoint
CREATE TABLE "family_processing_daily_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"processed_on" date NOT NULL,
	"submissions_count" integer DEFAULT 0 NOT NULL,
	"persons_count" integer DEFAULT 0 NOT NULL,
	"twint_count" integer DEFAULT 0 NOT NULL,
	"cash_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_processing_daily_stats_ludo_site_date_unique" UNIQUE("ludo_id","site_id","processed_on"),
	CONSTRAINT "family_processing_daily_stats_counts_check" CHECK ("family_processing_daily_stats"."submissions_count" >= 0 and "family_processing_daily_stats"."persons_count" >= 0 and "family_processing_daily_stats"."twint_count" >= 0 and "family_processing_daily_stats"."cash_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "family_registration_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"kind" "family_registration_document_kind" NOT NULL,
	"required_acceptance" boolean NOT NULL,
	"content_markdown" text NOT NULL,
	"sha256" text NOT NULL,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_registration_document_versions_id_ludo_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "family_registration_document_versions_document_version_unique" UNIQUE("document_id","version"),
	CONSTRAINT "family_registration_document_versions_version_check" CHECK ("family_registration_document_versions"."version" >= 1),
	CONSTRAINT "family_registration_document_versions_hash_check" CHECK (char_length("family_registration_document_versions"."sha256") = 64)
);
--> statement-breakpoint
CREATE TABLE "family_registration_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"kind" "family_registration_document_kind" DEFAULT 'other' NOT NULL,
	"required_acceptance" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_registration_documents_id_ludo_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "family_registration_documents_form_slug_unique" UNIQUE("form_id","slug")
);
--> statement-breakpoint
CREATE TABLE "family_registration_form_version_documents" (
	"form_version_id" uuid NOT NULL,
	"document_version_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "family_registration_form_version_documents_form_version_id_document_version_id_pk" PRIMARY KEY("form_version_id","document_version_id")
);
--> statement-breakpoint
CREATE TABLE "family_registration_form_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"consent_label" text NOT NULL,
	"max_members" integer NOT NULL,
	"retention_days" integer NOT NULL,
	"annual_fee_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"allows_twint" boolean NOT NULL,
	"allows_cash" boolean NOT NULL,
	"published_by_member_id" uuid NOT NULL,
	"published_at" timestamp NOT NULL,
	CONSTRAINT "family_registration_form_versions_id_ludo_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "family_registration_form_versions_id_ludo_form_unique" UNIQUE("id","ludo_id","form_id"),
	CONSTRAINT "family_registration_form_versions_form_version_unique" UNIQUE("form_id","version"),
	CONSTRAINT "family_registration_form_versions_max_members_check" CHECK ("family_registration_form_versions"."max_members" between 1 and 50),
	CONSTRAINT "family_registration_form_versions_retention_check" CHECK ("family_registration_form_versions"."retention_days" between 1 and 365),
	CONSTRAINT "family_registration_form_versions_fee_check" CHECK ("family_registration_form_versions"."annual_fee_cents" between 0 and 1000000),
	CONSTRAINT "family_registration_form_versions_currency_check" CHECK ("family_registration_form_versions"."currency" = 'CHF'),
	CONSTRAINT "family_registration_form_versions_payment_methods_check" CHECK ("family_registration_form_versions"."allows_twint" or "family_registration_form_versions"."allows_cash")
);
--> statement-breakpoint
CREATE TABLE "family_registration_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text DEFAULT 'adhesion-famille' NOT NULL,
	"title" text NOT NULL,
	"intro" text,
	"consent_label" text,
	"annual_fee_cents" integer DEFAULT 3000 NOT NULL,
	"currency" text DEFAULT 'CHF' NOT NULL,
	"allows_twint" boolean DEFAULT true NOT NULL,
	"allows_cash" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"max_members" integer DEFAULT 20 NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by_member_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_registration_forms_id_ludo_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "family_registration_forms_ludo_slug_unique" UNIQUE("ludo_id","slug"),
	CONSTRAINT "family_registration_forms_max_members_check" CHECK ("family_registration_forms"."max_members" between 1 and 50),
	CONSTRAINT "family_registration_forms_retention_check" CHECK ("family_registration_forms"."retention_days" between 1 and 365),
	CONSTRAINT "family_registration_forms_fee_check" CHECK ("family_registration_forms"."annual_fee_cents" between 0 and 1000000),
	CONSTRAINT "family_registration_forms_currency_check" CHECK ("family_registration_forms"."currency" = 'CHF'),
	CONSTRAINT "family_registration_forms_payment_methods_check" CHECK ("family_registration_forms"."allows_twint" or "family_registration_forms"."allows_cash")
);
--> statement-breakpoint
CREATE TABLE "family_registration_submission_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"gender" "family_registration_gender" DEFAULT 'unspecified' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"sort_order" integer NOT NULL,
	CONSTRAINT "family_registration_submission_members_submission_order_unique" UNIQUE("submission_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "family_registration_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"form_id" uuid NOT NULL,
	"form_version_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"gender" "family_registration_gender" DEFAULT 'unspecified' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_date" date,
	"address" text NOT NULL,
	"postal_code" text NOT NULL,
	"city" text NOT NULL,
	"phone" text NOT NULL,
	"secondary_phone" text,
	"email" text NOT NULL,
	"consent_accepted" boolean NOT NULL,
	"consent_full_name" text NOT NULL,
	"consent_accepted_on" date NOT NULL,
	"consent_accepted_at" timestamp NOT NULL,
	"consent_label_snapshot" text NOT NULL,
	"consent_documents_snapshot" jsonb NOT NULL,
	"status" "family_registration_submission_status" DEFAULT 'new' NOT NULL,
	"payment_method" "family_registration_payment_method",
	"payment_recorded_at" timestamp,
	"payment_recorded_by_member_id" uuid,
	"revision" integer DEFAULT 1 NOT NULL,
	"processed_by_member_id" uuid,
	"processed_at" timestamp,
	"purge_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "family_registration_submissions_id_ludo_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "family_registration_submissions_consent_check" CHECK ("family_registration_submissions"."consent_accepted" = true),
	CONSTRAINT "family_registration_submissions_process_check" CHECK (("family_registration_submissions"."status" = 'new' and "family_registration_submissions"."processed_at" is null and "family_registration_submissions"."purge_at" is null and "family_registration_submissions"."processed_by_member_id" is null) or ("family_registration_submissions"."status" = 'processed' and "family_registration_submissions"."processed_at" is not null and "family_registration_submissions"."purge_at" is not null and "family_registration_submissions"."processed_by_member_id" is not null)),
	CONSTRAINT "family_registration_submissions_payment_check" CHECK (("family_registration_submissions"."payment_method" is null and "family_registration_submissions"."payment_recorded_at" is null and "family_registration_submissions"."payment_recorded_by_member_id" is null) or ("family_registration_submissions"."payment_method" is not null and "family_registration_submissions"."payment_recorded_at" is not null and "family_registration_submissions"."payment_recorded_by_member_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "family_submission_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"idempotency_key_hash" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"receipt_id" uuid NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"purged_at" timestamp,
	CONSTRAINT "family_submission_receipts_ludo_key_unique" UNIQUE("ludo_id","idempotency_key_hash"),
	CONSTRAINT "family_submission_receipts_ludo_receipt_unique" UNIQUE("ludo_id","receipt_id"),
	CONSTRAINT "family_submission_receipts_key_hash_check" CHECK (char_length("family_submission_receipts"."idempotency_key_hash") = 64),
	CONSTRAINT "family_submission_receipts_fingerprint_check" CHECK (char_length("family_submission_receipts"."request_fingerprint") = 64)
);
--> statement-breakpoint
ALTER TABLE "family_processing_daily_stats" ADD CONSTRAINT "family_processing_daily_stats_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_processing_daily_stats" ADD CONSTRAINT "family_processing_daily_stats_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_document_versions" ADD CONSTRAINT "family_registration_document_versions_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_document_versions" ADD CONSTRAINT "family_registration_document_versions_document_tenant_fk" FOREIGN KEY ("document_id","ludo_id") REFERENCES "public"."family_registration_documents"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_document_versions" ADD CONSTRAINT "family_registration_document_versions_author_tenant_fk" FOREIGN KEY ("created_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_documents" ADD CONSTRAINT "family_registration_documents_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_documents" ADD CONSTRAINT "family_registration_documents_form_tenant_fk" FOREIGN KEY ("form_id","ludo_id") REFERENCES "public"."family_registration_forms"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_form_version_documents" ADD CONSTRAINT "family_registration_form_version_documents_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_form_version_documents" ADD CONSTRAINT "family_registration_version_documents_form_tenant_fk" FOREIGN KEY ("form_version_id","ludo_id") REFERENCES "public"."family_registration_form_versions"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_form_version_documents" ADD CONSTRAINT "family_registration_version_documents_document_tenant_fk" FOREIGN KEY ("document_version_id","ludo_id") REFERENCES "public"."family_registration_document_versions"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_form_versions" ADD CONSTRAINT "family_registration_form_versions_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_form_versions" ADD CONSTRAINT "family_registration_form_versions_form_tenant_fk" FOREIGN KEY ("form_id","ludo_id") REFERENCES "public"."family_registration_forms"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_form_versions" ADD CONSTRAINT "family_registration_form_versions_publisher_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_forms" ADD CONSTRAINT "family_registration_forms_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_forms" ADD CONSTRAINT "family_registration_forms_updater_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submission_members" ADD CONSTRAINT "family_registration_submission_members_submission_tenant_fk" FOREIGN KEY ("submission_id","ludo_id") REFERENCES "public"."family_registration_submissions"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submissions" ADD CONSTRAINT "family_registration_submissions_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submissions" ADD CONSTRAINT "family_registration_submissions_form_tenant_fk" FOREIGN KEY ("form_id","ludo_id") REFERENCES "public"."family_registration_forms"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submissions" ADD CONSTRAINT "family_registration_submissions_version_form_tenant_fk" FOREIGN KEY ("form_version_id","ludo_id","form_id") REFERENCES "public"."family_registration_form_versions"("id","ludo_id","form_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submissions" ADD CONSTRAINT "family_registration_submissions_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submissions" ADD CONSTRAINT "family_registration_submissions_processor_tenant_fk" FOREIGN KEY ("processed_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_registration_submissions" ADD CONSTRAINT "family_registration_submissions_payment_recorder_tenant_fk" FOREIGN KEY ("payment_recorded_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_submission_receipts" ADD CONSTRAINT "family_submission_receipts_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_registration_submissions_management_idx" ON "family_registration_submissions" USING btree ("ludo_id","status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "family_registration_submissions_purge_idx" ON "family_registration_submissions" USING btree ("status","purge_at");