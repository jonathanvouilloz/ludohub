CREATE TABLE "public_top_three_sites" (
	"top_three_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_top_three_sites_top_three_id_site_id_pk" PRIMARY KEY("top_three_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "public_top_threes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"theme" text NOT NULL,
	"games" jsonb NOT NULL,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_top_threes_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_top_threes_ludo_slug_unique" UNIQUE("ludo_id","slug"),
	CONSTRAINT "public_top_threes_publication_state_check" CHECK (("public_top_threes"."status" = 'draft' and "public_top_threes"."published_at" is null and "public_top_threes"."published_by_member_id" is null) or ("public_top_threes"."status" in ('published', 'hidden') and "public_top_threes"."published_at" is not null and "public_top_threes"."published_by_member_id" is not null)),
	CONSTRAINT "public_top_threes_slug_check" CHECK (char_length("public_top_threes"."slug") between 1 and 120),
	CONSTRAINT "public_top_threes_theme_check" CHECK (char_length(trim("public_top_threes"."theme")) between 1 and 160),
	CONSTRAINT "public_top_threes_games_shape_check" CHECK (jsonb_typeof("public_top_threes"."games") = 'array' and jsonb_array_length("public_top_threes"."games") = 3 and not jsonb_path_exists("public_top_threes"."games", '$[*] ? (@.type() != "object" || !exists(@.name) || @.name.type() != "string" || (exists(@.description) && @.description.type() != "string"))') and not jsonb_path_exists("public_top_threes"."games", '$[*].keyvalue() ? (@.key != "name" && @.key != "description")') and not jsonb_path_exists("public_top_threes"."games", '$[*] ? (!(@.name like_regex "^\\s*.{0,159}\\S\\s*$" flag "s") || (exists(@.description) && !(@.description like_regex "^\\s*.{0,1999}\\S\\s*$" flag "s")))'))
);
--> statement-breakpoint
ALTER TABLE "public_top_three_sites" ADD CONSTRAINT "public_top_three_sites_top_three_tenant_fk" FOREIGN KEY ("top_three_id","ludo_id") REFERENCES "public"."public_top_threes"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_top_three_sites" ADD CONSTRAINT "public_top_three_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_top_threes" ADD CONSTRAINT "public_top_threes_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_top_threes" ADD CONSTRAINT "public_top_threes_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_top_threes" ADD CONSTRAINT "public_top_threes_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_top_threes" ADD CONSTRAINT "public_top_threes_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_top_threes_public_published_idx" ON "public_top_threes" USING btree ("ludo_id","status","published_at" DESC NULLS LAST);
