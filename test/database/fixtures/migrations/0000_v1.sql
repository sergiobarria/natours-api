CREATE TABLE "persistence_children" (
	"id" uuid PRIMARY KEY NOT NULL,
	"record_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persistence_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_key" text NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "persistence_records_external_key_unique" UNIQUE("external_key"),
	CONSTRAINT "persistence_records_amount_in_cents_check" CHECK ("persistence_records"."amount_in_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "persistence_children" ADD CONSTRAINT "persistence_children_record_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."persistence_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "persistence_records_created_at_idx" ON "persistence_records" USING btree ("created_at");