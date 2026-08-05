CREATE TYPE "public"."public_activity_lifecycle" AS ENUM('active', 'archived', 'trashed');--> statement-breakpoint
CREATE TYPE "public"."public_activity_type" AS ENUM('one_off', 'recurring', 'permanent');--> statement-breakpoint
CREATE TABLE "public_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"location" text,
	"type" "public_activity_type" NOT NULL,
	"recurrence_rule" text,
	"image_url" text,
	"image_storage_key" text,
	"image_alt" text,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"lifecycle" "public_activity_lifecycle" DEFAULT 'active' NOT NULL,
	"featured_rank" integer,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"archived_at" timestamp,
	"trashed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_activities_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_activities_ludo_slug_unique" UNIQUE("ludo_id","slug"),
	CONSTRAINT "public_activities_publication_state_check" CHECK (("public_activities"."status" = 'draft' and "public_activities"."published_at" is null and "public_activities"."published_by_member_id" is null) or ("public_activities"."status" in ('published', 'hidden') and "public_activities"."published_at" is not null and "public_activities"."published_by_member_id" is not null)),
	CONSTRAINT "public_activities_lifecycle_check" CHECK (("public_activities"."lifecycle" = 'active' and "public_activities"."archived_at" is null and "public_activities"."trashed_at" is null) or ("public_activities"."lifecycle" = 'archived' and "public_activities"."archived_at" is not null and "public_activities"."trashed_at" is null) or ("public_activities"."lifecycle" = 'trashed' and "public_activities"."trashed_at" is not null)),
	CONSTRAINT "public_activities_recurrence_check" CHECK (("public_activities"."type" = 'recurring' and "public_activities"."recurrence_rule" is not null and char_length(trim("public_activities"."recurrence_rule")) between 1 and 1000) or ("public_activities"."type" <> 'recurring' and "public_activities"."recurrence_rule" is null)),
	CONSTRAINT "public_activities_featured_rank_check" CHECK ("public_activities"."featured_rank" is null or ("public_activities"."featured_rank" between 1 and 3 and "public_activities"."status" = 'published' and "public_activities"."lifecycle" = 'active')),
	CONSTRAINT "public_activities_slug_check" CHECK (char_length("public_activities"."slug") between 1 and 120),
	CONSTRAINT "public_activities_title_check" CHECK (char_length(trim("public_activities"."title")) between 1 and 180),
	CONSTRAINT "public_activities_summary_check" CHECK (char_length(trim("public_activities"."summary")) between 1 and 500),
	CONSTRAINT "public_activities_body_check" CHECK (char_length(trim("public_activities"."body")) between 1 and 50000),
	CONSTRAINT "public_activities_image_check" CHECK (("public_activities"."image_url" is null and "public_activities"."image_storage_key" is null and "public_activities"."image_alt" is null) or ("public_activities"."image_url" is not null and char_length(trim("public_activities"."image_url")) between 1 and 2000 and "public_activities"."image_storage_key" is not null and char_length(trim("public_activities"."image_storage_key")) between 1 and 1000 and "public_activities"."image_alt" is not null and char_length(trim("public_activities"."image_alt")) between 1 and 300))
);
--> statement-breakpoint
CREATE TABLE "public_activity_dates" (
	"activity_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	CONSTRAINT "public_activity_dates_activity_id_starts_at_pk" PRIMARY KEY("activity_id","starts_at"),
	CONSTRAINT "public_activity_dates_range_check" CHECK ("public_activity_dates"."ends_at" is null or "public_activity_dates"."ends_at" > "public_activity_dates"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "public_activity_exceptions" (
	"activity_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"excluded_at" timestamp with time zone NOT NULL,
	"reason" text,
	CONSTRAINT "public_activity_exceptions_activity_id_excluded_at_pk" PRIMARY KEY("activity_id","excluded_at"),
	CONSTRAINT "public_activity_exceptions_reason_check" CHECK ("public_activity_exceptions"."reason" is null or char_length(trim("public_activity_exceptions"."reason")) between 1 and 500)
);
--> statement-breakpoint
CREATE TABLE "public_activity_sites" (
	"activity_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_activity_sites_activity_id_site_id_pk" PRIMARY KEY("activity_id","site_id")
);
--> statement-breakpoint
ALTER TABLE "public_activities" ADD CONSTRAINT "public_activities_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activities" ADD CONSTRAINT "public_activities_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activities" ADD CONSTRAINT "public_activities_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activities" ADD CONSTRAINT "public_activities_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_dates" ADD CONSTRAINT "public_activity_dates_activity_tenant_fk" FOREIGN KEY ("activity_id","ludo_id") REFERENCES "public"."public_activities"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_exceptions" ADD CONSTRAINT "public_activity_exceptions_activity_tenant_fk" FOREIGN KEY ("activity_id","ludo_id") REFERENCES "public"."public_activities"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_sites" ADD CONSTRAINT "public_activity_sites_activity_tenant_fk" FOREIGN KEY ("activity_id","ludo_id") REFERENCES "public"."public_activities"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_activity_sites" ADD CONSTRAINT "public_activity_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_activities_ludo_featured_rank_unique" ON "public_activities" USING btree ("ludo_id","featured_rank") WHERE "public_activities"."featured_rank" is not null;--> statement-breakpoint
CREATE INDEX "public_activities_public_idx" ON "public_activities" USING btree ("ludo_id","lifecycle","status","published_at" DESC NULLS LAST);