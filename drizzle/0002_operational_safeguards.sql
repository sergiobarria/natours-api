CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"system_actor_name" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"request_id" text,
	"before" jsonb,
	"after" jsonb,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_actor_shape_check" CHECK (("audit_events"."actor_type" = 'user' AND "audit_events"."actor_id" IS NOT NULL AND "audit_events"."system_actor_name" IS NULL) OR ("audit_events"."actor_type" = 'system' AND "audit_events"."actor_id" IS NULL AND "audit_events"."system_actor_name" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "health_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"component" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"observed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_event_key_unique" ON "audit_events" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "audit_events_target_type_target_id_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "health_history_observed_at_idx" ON "health_history" USING btree ("observed_at");--> statement-breakpoint
CREATE FUNCTION reject_audit_event_mutation() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER audit_events_reject_update BEFORE UPDATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_event_mutation();--> statement-breakpoint
CREATE TRIGGER audit_events_reject_delete BEFORE DELETE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_event_mutation();--> statement-breakpoint
CREATE TRIGGER audit_events_reject_truncate BEFORE TRUNCATE ON audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_event_mutation();
