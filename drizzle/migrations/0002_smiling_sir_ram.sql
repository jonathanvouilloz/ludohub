CREATE TYPE "public"."public_content_status" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
CREATE TABLE "public_site_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_site_settings_ludo_id_unique" UNIQUE("ludo_id")
);
--> statement-breakpoint
ALTER TABLE "public_site_settings" ADD CONSTRAINT "public_site_settings_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_id_ludo_id_unique" UNIQUE("id","ludo_id");