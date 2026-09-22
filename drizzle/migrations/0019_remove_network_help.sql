-- Neon HTTP n’accepte qu’une instruction préparée par migration. Ce bloc conserve
-- l'opération atomique tout en laissant Drizzle enregistrer la migration normalement.
DO $$ BEGIN
DELETE FROM "notifications" WHERE "type" IN ('help_response', 'help_confirmed');
DROP TABLE "help_responses";
DROP TABLE "help_requests";
DROP TYPE "help_response_status";
DROP TYPE "help_request_status";
END $$;
