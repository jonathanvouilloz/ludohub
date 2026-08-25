CREATE TYPE "public"."public_editorial_asset_kind" AS ENUM('support_image', 'pdf_attachment');--> statement-breakpoint
CREATE TABLE "public_editorial_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"news_id" uuid,
	"activity_id" uuid,
	"kind" "public_editorial_asset_kind" NOT NULL,
	"url" text NOT NULL,
	"download_url" text,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_name" text,
	"size_bytes" integer NOT NULL,
	"alt" text,
	"caption" text,
	"credit" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_member_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_editorial_assets_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_editorial_assets_owner_check" CHECK (("public_editorial_assets"."news_id" is not null and "public_editorial_assets"."activity_id" is null) or ("public_editorial_assets"."news_id" is null and "public_editorial_assets"."activity_id" is not null)),
	CONSTRAINT "public_editorial_assets_file_check" CHECK (char_length(trim("public_editorial_assets"."url")) between 1 and 2000 and char_length(trim("public_editorial_assets"."storage_key")) between 1 and 1000 and char_length(trim("public_editorial_assets"."mime_type")) between 1 and 100 and "public_editorial_assets"."size_bytes" between 1 and 15728640),
	CONSTRAINT "public_editorial_assets_kind_check" CHECK (("public_editorial_assets"."kind" = 'support_image' and "public_editorial_assets"."mime_type" in ('image/jpeg','image/png','image/webp') and "public_editorial_assets"."alt" is not null and char_length(trim("public_editorial_assets"."alt")) between 1 and 300 and "public_editorial_assets"."file_name" is null and "public_editorial_assets"."download_url" is null) or ("public_editorial_assets"."kind" = 'pdf_attachment' and "public_editorial_assets"."mime_type" = 'application/pdf' and "public_editorial_assets"."file_name" is not null and char_length(trim("public_editorial_assets"."file_name")) between 1 and 300 and "public_editorial_assets"."download_url" is not null and char_length(trim("public_editorial_assets"."download_url")) between 1 and 2000 and "public_editorial_assets"."alt" is null)),
	CONSTRAINT "public_editorial_assets_caption_check" CHECK ("public_editorial_assets"."caption" is null or char_length(trim("public_editorial_assets"."caption")) between 1 and 500),
	CONSTRAINT "public_editorial_assets_credit_check" CHECK ("public_editorial_assets"."credit" is null or char_length(trim("public_editorial_assets"."credit")) between 1 and 200),
	CONSTRAINT "public_editorial_assets_sort_check" CHECK ("public_editorial_assets"."sort_order" between 0 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "public_editorial_assets" ADD CONSTRAINT "public_editorial_assets_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_editorial_assets" ADD CONSTRAINT "public_editorial_assets_news_tenant_fk" FOREIGN KEY ("news_id","ludo_id") REFERENCES "public"."public_news"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_editorial_assets" ADD CONSTRAINT "public_editorial_assets_activity_tenant_fk" FOREIGN KEY ("activity_id","ludo_id") REFERENCES "public"."public_activities"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_editorial_assets" ADD CONSTRAINT "public_editorial_assets_author_tenant_fk" FOREIGN KEY ("created_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "public_editorial_assets_news_support_unique" ON "public_editorial_assets" USING btree ("news_id") WHERE "public_editorial_assets"."news_id" is not null and "public_editorial_assets"."kind" = 'support_image';--> statement-breakpoint
CREATE UNIQUE INDEX "public_editorial_assets_activity_support_unique" ON "public_editorial_assets" USING btree ("activity_id") WHERE "public_editorial_assets"."activity_id" is not null and "public_editorial_assets"."kind" = 'support_image';--> statement-breakpoint
CREATE INDEX "public_editorial_assets_news_order_idx" ON "public_editorial_assets" USING btree ("news_id","kind","sort_order","id");--> statement-breakpoint
CREATE INDEX "public_editorial_assets_activity_order_idx" ON "public_editorial_assets" USING btree ("activity_id","kind","sort_order","id");