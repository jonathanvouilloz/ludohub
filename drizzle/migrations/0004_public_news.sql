CREATE TABLE "public_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"image_storage_key" text,
	"image_alt" text,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_news_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_news_ludo_slug_unique" UNIQUE("ludo_id","slug"),
	CONSTRAINT "public_news_publication_state_check" CHECK (("public_news"."status" = 'draft' and "public_news"."published_at" is null and "public_news"."published_by_member_id" is null) or ("public_news"."status" in ('published', 'hidden') and "public_news"."published_at" is not null and "public_news"."published_by_member_id" is not null)),
	CONSTRAINT "public_news_slug_check" CHECK (char_length("public_news"."slug") between 1 and 120),
	CONSTRAINT "public_news_title_check" CHECK (char_length(trim("public_news"."title")) between 1 and 180),
	CONSTRAINT "public_news_summary_check" CHECK (char_length(trim("public_news"."summary")) between 1 and 500),
	CONSTRAINT "public_news_body_check" CHECK (char_length(trim("public_news"."body")) between 1 and 50000),
	CONSTRAINT "public_news_image_check" CHECK (("public_news"."image_url" is null and "public_news"."image_storage_key" is null and "public_news"."image_alt" is null) or ("public_news"."image_url" is not null and char_length(trim("public_news"."image_url")) between 1 and 2000 and "public_news"."image_storage_key" is not null and char_length(trim("public_news"."image_storage_key")) between 1 and 1000 and "public_news"."image_alt" is not null and char_length(trim("public_news"."image_alt")) between 1 and 300))
);
--> statement-breakpoint
CREATE TABLE "public_news_sites" (
	"news_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_news_sites_news_id_site_id_pk" PRIMARY KEY("news_id","site_id")
);
--> statement-breakpoint
ALTER TABLE "public_news" ADD CONSTRAINT "public_news_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_news" ADD CONSTRAINT "public_news_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_news" ADD CONSTRAINT "public_news_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_news" ADD CONSTRAINT "public_news_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_news_sites" ADD CONSTRAINT "public_news_sites_news_tenant_fk" FOREIGN KEY ("news_id","ludo_id") REFERENCES "public"."public_news"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_news_sites" ADD CONSTRAINT "public_news_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_news_public_published_idx" ON "public_news" USING btree ("ludo_id","status","published_at" DESC NULLS LAST);