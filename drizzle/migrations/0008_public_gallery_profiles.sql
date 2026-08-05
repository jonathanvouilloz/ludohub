CREATE TYPE "public"."public_profile_section" AS ENUM('team', 'committee');--> statement-breakpoint
CREATE TABLE "public_gallery_image_sites" (
	"image_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_gallery_image_sites_image_id_site_id_pk" PRIMARY KEY("image_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "public_gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"caption" text,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"image_storage_key" text,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_gallery_images_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_gallery_images_publication_check" CHECK (("public_gallery_images"."status" = 'draft' and "public_gallery_images"."published_at" is null and "public_gallery_images"."published_by_member_id" is null) or ("public_gallery_images"."status" in ('published','hidden') and "public_gallery_images"."published_at" is not null and "public_gallery_images"."published_by_member_id" is not null and "public_gallery_images"."image_storage_key" is not null and "public_gallery_images"."alt" is not null)),
	CONSTRAINT "public_gallery_images_caption_check" CHECK ("public_gallery_images"."caption" is null or char_length(trim("public_gallery_images"."caption")) between 1 and 500),
	CONSTRAINT "public_gallery_images_alt_check" CHECK ("public_gallery_images"."alt" is null or char_length(trim("public_gallery_images"."alt")) between 1 and 300),
	CONSTRAINT "public_gallery_images_sort_check" CHECK ("public_gallery_images"."sort_order" between 0 and 1000000),
	CONSTRAINT "public_gallery_images_file_check" CHECK (("public_gallery_images"."image_url" is null and "public_gallery_images"."image_storage_key" is null) or ("public_gallery_images"."image_url" is not null and char_length(trim("public_gallery_images"."image_url")) between 1 and 2000 and "public_gallery_images"."image_storage_key" is not null and char_length(trim("public_gallery_images"."image_storage_key")) between 1 and 1000))
);
--> statement-breakpoint
CREATE TABLE "public_profile_sites" (
	"profile_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_profile_sites_profile_id_site_id_pk" PRIMARY KEY("profile_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "public_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"member_id" uuid,
	"section" "public_profile_section" NOT NULL,
	"display_name" text NOT NULL,
	"role_title" text,
	"bio_markdown" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"photo_url" text,
	"photo_storage_key" text,
	"photo_alt" text,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_profiles_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_profiles_publication_check" CHECK (("public_profiles"."status" = 'draft' and "public_profiles"."published_at" is null and "public_profiles"."published_by_member_id" is null) or ("public_profiles"."status" in ('published','hidden') and "public_profiles"."published_at" is not null and "public_profiles"."published_by_member_id" is not null)),
	CONSTRAINT "public_profiles_display_name_check" CHECK (char_length(trim("public_profiles"."display_name")) between 1 and 160),
	CONSTRAINT "public_profiles_role_check" CHECK ("public_profiles"."role_title" is null or char_length(trim("public_profiles"."role_title")) between 1 and 200),
	CONSTRAINT "public_profiles_bio_check" CHECK ("public_profiles"."bio_markdown" is null or char_length(trim("public_profiles"."bio_markdown")) between 1 and 10000),
	CONSTRAINT "public_profiles_sort_check" CHECK ("public_profiles"."sort_order" between 0 and 1000000),
	CONSTRAINT "public_profiles_photo_check" CHECK (("public_profiles"."photo_url" is null and "public_profiles"."photo_storage_key" is null and "public_profiles"."photo_alt" is null) or ("public_profiles"."photo_url" is not null and char_length(trim("public_profiles"."photo_url")) between 1 and 2000 and "public_profiles"."photo_storage_key" is not null and char_length(trim("public_profiles"."photo_storage_key")) between 1 and 1000 and "public_profiles"."photo_alt" is not null and char_length(trim("public_profiles"."photo_alt")) between 1 and 300))
);
--> statement-breakpoint
ALTER TABLE "public_gallery_image_sites" ADD CONSTRAINT "public_gallery_image_sites_image_tenant_fk" FOREIGN KEY ("image_id","ludo_id") REFERENCES "public"."public_gallery_images"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_gallery_image_sites" ADD CONSTRAINT "public_gallery_image_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_gallery_images" ADD CONSTRAINT "public_gallery_images_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_gallery_images" ADD CONSTRAINT "public_gallery_images_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_gallery_images" ADD CONSTRAINT "public_gallery_images_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_gallery_images" ADD CONSTRAINT "public_gallery_images_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profile_sites" ADD CONSTRAINT "public_profile_sites_profile_tenant_fk" FOREIGN KEY ("profile_id","ludo_id") REFERENCES "public"."public_profiles"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profile_sites" ADD CONSTRAINT "public_profile_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_member_tenant_fk" FOREIGN KEY ("member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_gallery_images_public_order_idx" ON "public_gallery_images" USING btree ("ludo_id","status","sort_order","id");--> statement-breakpoint
CREATE INDEX "public_profiles_public_order_idx" ON "public_profiles" USING btree ("ludo_id","status","section","sort_order","id");