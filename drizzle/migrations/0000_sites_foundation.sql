CREATE TABLE "ludo_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"postal_code" text,
	"city" text,
	"phone" text,
	"email" text,
	"access_info" text,
	"latitude" double precision,
	"longitude" double precision,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ludo_sites_ludo_slug_unique" UNIQUE("ludo_id", "slug"),
	CONSTRAINT "ludo_sites_id_ludo_id_unique" UNIQUE("id", "ludo_id")
);
--> statement-breakpoint
ALTER TABLE "ludo_sites" ADD CONSTRAINT "ludo_sites_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ludo_sites_one_active_primary_idx" ON "ludo_sites" USING btree ("ludo_id") WHERE "ludo_sites"."is_primary" = true and "ludo_sites"."is_active" = true;
--> statement-breakpoint
CREATE TABLE "site_opening_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"opens_at" time(0) NOT NULL,
	"closes_at" time(0) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_opening_intervals_slot_unique" UNIQUE("site_id", "day_of_week", "opens_at", "closes_at"),
	CONSTRAINT "site_opening_intervals_day_check" CHECK ("site_opening_intervals"."day_of_week" between 1 and 7),
	CONSTRAINT "site_opening_intervals_time_check" CHECK ("site_opening_intervals"."opens_at" < "site_opening_intervals"."closes_at")
);
--> statement-breakpoint
ALTER TABLE "site_opening_intervals" ADD CONSTRAINT "site_opening_intervals_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_opening_intervals" ADD CONSTRAINT "site_opening_intervals_site_tenant_fk" FOREIGN KEY ("site_id", "ludo_id") REFERENCES "public"."ludo_sites"("id", "ludo_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "site_id" uuid;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_site_tenant_fk" FOREIGN KEY ("site_id", "ludo_id") REFERENCES "public"."ludo_sites"("id", "ludo_id") ON DELETE restrict ON UPDATE no action;
