CREATE TABLE "tour_departures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tour_id" uuid NOT NULL,
	"start_at" timestamp (3) with time zone NOT NULL,
	"available_spots" integer NOT NULL,
	"reserved_spots" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "tour_departures_available_spots_check" CHECK ("tour_departures"."available_spots" >= 0),
	CONSTRAINT "tour_departures_reserved_spots_check" CHECK ("tour_departures"."reserved_spots" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tour_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tour_id" uuid NOT NULL,
	"position" smallint,
	"state" text NOT NULL,
	"key_prefix" text NOT NULL,
	"original_format" text NOT NULL,
	"original_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tour_media_position_check" CHECK ("tour_media"."position" IS NULL OR "tour_media"."position" BETWEEN 1 AND 10),
	CONSTRAINT "tour_media_state_check" CHECK ("tour_media"."state" IN ('pending_upload', 'active', 'pending_delete')),
	CONSTRAINT "tour_media_original_size_check" CHECK ("tour_media"."original_size" BETWEEN 1 AND 10485760),
	CONSTRAINT "tour_media_dimensions_check" CHECK ("tour_media"."width" > 0 AND "tour_media"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_media" ADD CONSTRAINT "tour_media_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tour_departures_tour_id_start_at_unique" ON "tour_departures" USING btree ("tour_id","start_at");--> statement-breakpoint
CREATE INDEX "tour_departures_tour_id_start_at_id_idx" ON "tour_departures" USING btree ("tour_id","start_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tour_media_tour_id_position_unique" ON "tour_media" USING btree ("tour_id","position") WHERE "tour_media"."position" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tour_media_key_prefix_unique" ON "tour_media" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "tour_media_tour_id_state_position_idx" ON "tour_media" USING btree ("tour_id","state","position");