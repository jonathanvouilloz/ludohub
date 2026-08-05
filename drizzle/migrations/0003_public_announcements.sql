CREATE TABLE "public_announcement_sites" (
	"announcement_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_announcement_sites_announcement_id_site_id_pk" PRIMARY KEY("announcement_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "public_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_announcements_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_announcements_publication_state_check" CHECK (("public_announcements"."status" = 'draft' and "public_announcements"."published_at" is null and "public_announcements"."published_by_member_id" is null) or ("public_announcements"."status" in ('published', 'hidden') and "public_announcements"."published_at" is not null and "public_announcements"."published_by_member_id" is not null)),
	CONSTRAINT "public_announcements_title_length_check" CHECK (char_length(trim("public_announcements"."title")) between 1 and 160),
	CONSTRAINT "public_announcements_message_length_check" CHECK (char_length(trim("public_announcements"."message")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "public_announcement_sites" ADD CONSTRAINT "public_announcement_sites_announcement_tenant_fk" FOREIGN KEY ("announcement_id","ludo_id") REFERENCES "public"."public_announcements"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_announcement_sites" ADD CONSTRAINT "public_announcement_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_announcements" ADD CONSTRAINT "public_announcements_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_announcements" ADD CONSTRAINT "public_announcements_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_announcements" ADD CONSTRAINT "public_announcements_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_announcements" ADD CONSTRAINT "public_announcements_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_announcements_ludo_status_created_idx" ON "public_announcements" USING btree ("ludo_id","status","created_at" DESC NULLS LAST);