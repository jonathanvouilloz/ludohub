CREATE TYPE "public"."public_document_kind" AS ENUM('mission', 'statutes', 'annual_report', 'other');--> statement-breakpoint
CREATE TABLE "public_document_sites" (
	"document_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_document_sites_document_id_site_id_pk" PRIMARY KEY("document_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "public_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"kind" "public_document_kind" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_markdown" text,
	"year" integer,
	"pdf_url" text,
	"pdf_storage_key" text,
	"pdf_file_name" text,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_documents_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_documents_ludo_slug_unique" UNIQUE("ludo_id","slug"),
	CONSTRAINT "public_documents_publication_state_check" CHECK (("public_documents"."status" = 'draft' and "public_documents"."published_at" is null and "public_documents"."published_by_member_id" is null) or ("public_documents"."status" in ('published', 'hidden') and "public_documents"."published_at" is not null and "public_documents"."published_by_member_id" is not null)),
	CONSTRAINT "public_documents_slug_check" CHECK (char_length("public_documents"."slug") between 1 and 120),
	CONSTRAINT "public_documents_title_check" CHECK (char_length(trim("public_documents"."title")) between 1 and 180),
	CONSTRAINT "public_documents_summary_check" CHECK ("public_documents"."summary" is null or char_length(trim("public_documents"."summary")) between 1 and 500),
	CONSTRAINT "public_documents_body_check" CHECK ("public_documents"."body_markdown" is null or char_length(trim("public_documents"."body_markdown")) between 1 and 50000),
	CONSTRAINT "public_documents_year_check" CHECK (("public_documents"."kind" = 'annual_report' and "public_documents"."year" between 1000 and 9999) or ("public_documents"."kind" <> 'annual_report' and "public_documents"."year" is null)),
	CONSTRAINT "public_documents_pdf_check" CHECK (("public_documents"."pdf_url" is null and "public_documents"."pdf_storage_key" is null and "public_documents"."pdf_file_name" is null) or ("public_documents"."pdf_url" is not null and char_length(trim("public_documents"."pdf_url")) between 1 and 2000 and "public_documents"."pdf_storage_key" is not null and char_length(trim("public_documents"."pdf_storage_key")) between 1 and 1000 and "public_documents"."pdf_file_name" is not null and char_length(trim("public_documents"."pdf_file_name")) between 1 and 300)),
	CONSTRAINT "public_documents_content_check" CHECK ("public_documents"."status" = 'draft' or "public_documents"."body_markdown" is not null or "public_documents"."pdf_storage_key" is not null)
);
--> statement-breakpoint
CREATE TABLE "public_faq_sites" (
	"faq_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	CONSTRAINT "public_faq_sites_faq_id_site_id_pk" PRIMARY KEY("faq_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "public_faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer_markdown" text NOT NULL,
	"category" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "public_content_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"author_member_id" uuid NOT NULL,
	"updated_by_member_id" uuid NOT NULL,
	"published_by_member_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "public_faqs_id_ludo_id_unique" UNIQUE("id","ludo_id"),
	CONSTRAINT "public_faqs_publication_state_check" CHECK (("public_faqs"."status" = 'draft' and "public_faqs"."published_at" is null and "public_faqs"."published_by_member_id" is null) or ("public_faqs"."status" in ('published', 'hidden') and "public_faqs"."published_at" is not null and "public_faqs"."published_by_member_id" is not null)),
	CONSTRAINT "public_faqs_question_check" CHECK (char_length(trim("public_faqs"."question")) between 1 and 300),
	CONSTRAINT "public_faqs_answer_check" CHECK (char_length(trim("public_faqs"."answer_markdown")) between 1 and 20000),
	CONSTRAINT "public_faqs_category_check" CHECK ("public_faqs"."category" is null or char_length(trim("public_faqs"."category")) between 1 and 100),
	CONSTRAINT "public_faqs_sort_order_check" CHECK ("public_faqs"."sort_order" between 0 and 1000000)
);
--> statement-breakpoint
ALTER TABLE "public_document_sites" ADD CONSTRAINT "public_document_sites_document_tenant_fk" FOREIGN KEY ("document_id","ludo_id") REFERENCES "public"."public_documents"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_document_sites" ADD CONSTRAINT "public_document_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_documents" ADD CONSTRAINT "public_documents_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_documents" ADD CONSTRAINT "public_documents_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_documents" ADD CONSTRAINT "public_documents_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_documents" ADD CONSTRAINT "public_documents_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_faq_sites" ADD CONSTRAINT "public_faq_sites_faq_tenant_fk" FOREIGN KEY ("faq_id","ludo_id") REFERENCES "public"."public_faqs"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_faq_sites" ADD CONSTRAINT "public_faq_sites_site_tenant_fk" FOREIGN KEY ("site_id","ludo_id") REFERENCES "public"."ludo_sites"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_faqs" ADD CONSTRAINT "public_faqs_ludo_id_ludotheques_id_fk" FOREIGN KEY ("ludo_id") REFERENCES "public"."ludotheques"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_faqs" ADD CONSTRAINT "public_faqs_author_tenant_fk" FOREIGN KEY ("author_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_faqs" ADD CONSTRAINT "public_faqs_updated_by_tenant_fk" FOREIGN KEY ("updated_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_faqs" ADD CONSTRAINT "public_faqs_published_by_tenant_fk" FOREIGN KEY ("published_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_documents_public_idx" ON "public_documents" USING btree ("ludo_id","status","kind","year" DESC NULLS LAST,"published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "public_faqs_public_order_idx" ON "public_faqs" USING btree ("ludo_id","status","sort_order","id");