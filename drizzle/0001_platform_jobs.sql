CREATE TABLE "job_effects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"completed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"available_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"dispatched_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_effects_job_name_idempotency_key_unique" ON "job_effects" USING btree ("job_name","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_messages_job_name_idempotency_key_unique" ON "outbox_messages" USING btree ("job_name","idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_messages_dispatched_at_available_at_idx" ON "outbox_messages" USING btree ("dispatched_at","available_at");