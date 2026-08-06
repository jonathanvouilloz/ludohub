CREATE TYPE "public"."extension_device_authorization_status" AS ENUM('pending', 'approved', 'denied', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."extension_refresh_token_status" AS ENUM('active', 'used', 'revoked');--> statement-breakpoint
CREATE TABLE "extension_device_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_code_hash" text NOT NULL,
	"user_code_hmac" text NOT NULL,
	"code_challenge" text NOT NULL,
	"client_name" text NOT NULL,
	"status" "extension_device_authorization_status" DEFAULT 'pending' NOT NULL,
	"ludo_id" uuid,
	"member_id" uuid,
	"password_version" text,
	"interval_seconds" integer DEFAULT 5 NOT NULL,
	"poll_count" integer DEFAULT 0 NOT NULL,
	"last_polled_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"approved_at" timestamp,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "extension_device_authorizations_device_code_hash_unique" UNIQUE("device_code_hash"),
	CONSTRAINT "extension_device_authorizations_user_code_hmac_unique" UNIQUE("user_code_hmac"),
	CONSTRAINT "extension_device_authorizations_pkce_check" CHECK (char_length("extension_device_authorizations"."code_challenge") = 43),
	CONSTRAINT "extension_device_authorizations_poll_check" CHECK ("extension_device_authorizations"."interval_seconds" between 5 and 30 and "extension_device_authorizations"."poll_count" between 0 and 240),
	CONSTRAINT "extension_device_authorizations_approval_check" CHECK (("extension_device_authorizations"."status" in ('pending','denied') and "extension_device_authorizations"."ludo_id" is null and "extension_device_authorizations"."member_id" is null and "extension_device_authorizations"."password_version" is null and "extension_device_authorizations"."approved_at" is null) or ("extension_device_authorizations"."status" in ('approved','consumed') and "extension_device_authorizations"."ludo_id" is not null and "extension_device_authorizations"."member_id" is not null and "extension_device_authorizations"."password_version" is not null and "extension_device_authorizations"."approved_at" is not null)),
	CONSTRAINT "extension_device_authorizations_consumed_check" CHECK (("extension_device_authorizations"."status" = 'consumed' and "extension_device_authorizations"."consumed_at" is not null) or ("extension_device_authorizations"."status" <> 'consumed' and "extension_device_authorizations"."consumed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "extension_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"ludo_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"generation" integer NOT NULL,
	"status" "extension_refresh_token_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "extension_refresh_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "extension_refresh_tokens_session_generation_unique" UNIQUE("session_id","generation"),
	CONSTRAINT "extension_refresh_tokens_generation_check" CHECK ("extension_refresh_tokens"."generation" >= 0),
	CONSTRAINT "extension_refresh_tokens_used_check" CHECK (("extension_refresh_tokens"."status" = 'active' and "extension_refresh_tokens"."used_at" is null) or ("extension_refresh_tokens"."status" <> 'active' and "extension_refresh_tokens"."used_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "extension_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ludo_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"label" text NOT NULL,
	"password_version" text NOT NULL,
	"access_token_hash" text NOT NULL,
	"access_expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"revoked_by_member_id" uuid,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "extension_sessions_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "extension_sessions_id_ludo_unique" UNIQUE("id","ludo_id")
);
--> statement-breakpoint
ALTER TABLE "extension_device_authorizations" ADD CONSTRAINT "extension_device_authorizations_member_tenant_fk" FOREIGN KEY ("member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_refresh_tokens" ADD CONSTRAINT "extension_refresh_tokens_session_tenant_fk" FOREIGN KEY ("session_id","ludo_id") REFERENCES "public"."extension_sessions"("id","ludo_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_sessions" ADD CONSTRAINT "extension_sessions_member_tenant_fk" FOREIGN KEY ("member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_sessions" ADD CONSTRAINT "extension_sessions_revoker_tenant_fk" FOREIGN KEY ("revoked_by_member_id","ludo_id") REFERENCES "public"."members"("id","ludo_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extension_device_authorizations_expiry_idx" ON "extension_device_authorizations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "extension_refresh_tokens_expiry_idx" ON "extension_refresh_tokens" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "extension_sessions_member_idx" ON "extension_sessions" USING btree ("ludo_id","member_id","revoked_at");