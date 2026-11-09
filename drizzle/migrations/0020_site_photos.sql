ALTER TABLE "ludo_sites" ADD COLUMN "photo_url" text;
--> statement-breakpoint
ALTER TABLE "ludo_sites" ADD COLUMN "photo_storage_key" text;
--> statement-breakpoint
ALTER TABLE "ludo_sites" ADD COLUMN "photo_alt" text;
--> statement-breakpoint
ALTER TABLE "ludo_sites" ADD CONSTRAINT "ludo_sites_photo_check" CHECK (
  (photo_url IS NULL AND photo_storage_key IS NULL AND photo_alt IS NULL)
  OR (photo_url IS NOT NULL AND char_length(trim(photo_url)) BETWEEN 1 AND 2000
    AND photo_storage_key IS NOT NULL AND char_length(trim(photo_storage_key)) BETWEEN 1 AND 1000
    AND photo_alt IS NOT NULL AND char_length(trim(photo_alt)) BETWEEN 1 AND 300)
);
