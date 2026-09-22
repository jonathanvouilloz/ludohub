ALTER TABLE "ludo_sites" ADD COLUMN "important_info" text;

CREATE TABLE "public_faq_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ludo_id" uuid NOT NULL REFERENCES "ludotheques"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "public_faq_categories_id_ludo_id_unique" UNIQUE("id", "ludo_id"),
  CONSTRAINT "public_faq_categories_ludo_name_unique" UNIQUE("ludo_id", "name"),
  CONSTRAINT "public_faq_categories_name_check" CHECK (char_length(trim("name")) between 1 and 100),
  CONSTRAINT "public_faq_categories_sort_order_check" CHECK ("sort_order" between 0 and 1000000)
);
CREATE INDEX "public_faq_categories_ludo_order_idx" ON "public_faq_categories" ("ludo_id", "sort_order", "created_at");

INSERT INTO "public_faq_categories" ("ludo_id", "name", "sort_order")
SELECT "id", category.name, category.sort_order
FROM "ludotheques"
CROSS JOIN (VALUES
  ('Adhésion et tarifs', 0),
  ('Emprunts et retours', 1),
  ('Horaires et accès', 2),
  ('Jeux sur place', 3),
  ('Enfants et accompagnement', 4),
  ('Activités et événements', 5),
  ('Autre', 6)
) AS category(name, sort_order);

ALTER TABLE "public_faqs" ADD COLUMN "answer_text" text;
ALTER TABLE "public_faqs" ADD COLUMN "category_id" uuid;
UPDATE "public_faqs" faq
SET "answer_text" = faq."answer_markdown",
    "category_id" = category."id"
FROM "public_faq_categories" category
WHERE category."ludo_id" = faq."ludo_id" AND category."name" = 'Autre';
ALTER TABLE "public_faqs" ALTER COLUMN "answer_text" SET NOT NULL;
ALTER TABLE "public_faqs" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "public_faqs" ADD CONSTRAINT "public_faqs_category_tenant_fk"
  FOREIGN KEY ("category_id", "ludo_id") REFERENCES "public_faq_categories"("id", "ludo_id");
ALTER TABLE "public_faqs" DROP CONSTRAINT "public_faqs_answer_check";
ALTER TABLE "public_faqs" DROP CONSTRAINT "public_faqs_category_check";
ALTER TABLE "public_faqs" DROP CONSTRAINT "public_faqs_sort_order_check";
ALTER TABLE "public_faqs" ADD CONSTRAINT "public_faqs_answer_check"
  CHECK (char_length(trim("answer_text")) between 1 and 20000);
DROP INDEX "public_faqs_public_order_idx";
CREATE INDEX "public_faqs_public_order_idx" ON "public_faqs" ("ludo_id", "status", "category_id", "created_at");
ALTER TABLE "public_faqs" DROP COLUMN "answer_markdown";
ALTER TABLE "public_faqs" DROP COLUMN "category";
ALTER TABLE "public_faqs" DROP COLUMN "sort_order";

DROP TABLE "public_profile_sites";
ALTER TABLE "public_profiles" DROP CONSTRAINT "public_profiles_member_tenant_fk";
ALTER TABLE "public_profiles" ADD COLUMN "bio_text" text;
UPDATE "public_profiles" SET "bio_text" = "bio_markdown";
ALTER TABLE "public_profiles" DROP CONSTRAINT "public_profiles_bio_check";
ALTER TABLE "public_profiles" DROP CONSTRAINT "public_profiles_sort_check";
ALTER TABLE "public_profiles" ADD CONSTRAINT "public_profiles_bio_check"
  CHECK ("bio_text" is null or char_length(trim("bio_text")) between 1 and 255);
DROP INDEX "public_profiles_public_order_idx";
CREATE INDEX "public_profiles_public_order_idx" ON "public_profiles" ("ludo_id", "status", "section", "created_at");
ALTER TABLE "public_profiles" DROP COLUMN "member_id";
ALTER TABLE "public_profiles" DROP COLUMN "bio_markdown";
ALTER TABLE "public_profiles" DROP COLUMN "sort_order";

DROP TABLE "public_activity_exceptions";
DROP TABLE "public_activity_dates";
ALTER TABLE "public_activities" DROP CONSTRAINT "public_activities_recurrence_check";
ALTER TABLE "public_activities" DROP COLUMN "recurrence_rule";
