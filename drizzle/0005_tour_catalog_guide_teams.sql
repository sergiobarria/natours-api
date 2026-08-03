CREATE TABLE "tour_guide_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tour_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assignment_role" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "tour_guide_assignments_assignment_role_check" CHECK ("tour_guide_assignments"."assignment_role" IN ('lead-guide', 'guide'))
);
--> statement-breakpoint
CREATE TABLE "tours" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"duration_days" integer NOT NULL,
	"maximum_group_size" integer NOT NULL,
	"difficulty" text NOT NULL,
	"price_cents" integer NOT NULL,
	"discount_percentage" numeric(5, 2),
	"rating_average" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"start_location_name" text NOT NULL,
	"start_location_address" text,
	"start_location_latitude" double precision NOT NULL,
	"start_location_longitude" double precision NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "tours_name_check" CHECK (length(btrim("tours"."name")) > 0),
	CONSTRAINT "tours_summary_check" CHECK (length(btrim("tours"."summary")) > 0),
	CONSTRAINT "tours_duration_days_check" CHECK ("tours"."duration_days" > 0),
	CONSTRAINT "tours_maximum_group_size_check" CHECK ("tours"."maximum_group_size" > 0),
	CONSTRAINT "tours_difficulty_check" CHECK ("tours"."difficulty" IN ('easy', 'moderate', 'difficult')),
	CONSTRAINT "tours_price_cents_check" CHECK ("tours"."price_cents" >= 0),
	CONSTRAINT "tours_discount_percentage_check" CHECK ("tours"."discount_percentage" IS NULL OR ("tours"."discount_percentage" > 0 AND "tours"."discount_percentage" < 100)),
	CONSTRAINT "tours_rating_count_check" CHECK ("tours"."rating_count" >= 0),
	CONSTRAINT "tours_rating_aggregate_check" CHECK (("tours"."rating_count" = 0 AND "tours"."rating_average" IS NULL) OR ("tours"."rating_count" > 0 AND "tours"."rating_average" BETWEEN 1 AND 5)),
	CONSTRAINT "tours_start_location_latitude_check" CHECK ("tours"."start_location_latitude" BETWEEN -90 AND 90),
	CONSTRAINT "tours_start_location_longitude_check" CHECK ("tours"."start_location_longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "tour_guide_assignments" ADD CONSTRAINT "tour_guide_assignments_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_guide_assignments" ADD CONSTRAINT "tour_guide_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tour_guide_assignments_tour_id_user_id_unique" ON "tour_guide_assignments" USING btree ("tour_id","user_id") WHERE "tour_guide_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tour_guide_assignments_active_lead_unique" ON "tour_guide_assignments" USING btree ("tour_id") WHERE "tour_guide_assignments"."assignment_role" = 'lead-guide' AND "tour_guide_assignments"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tour_guide_assignments_user_id_deleted_at_idx" ON "tour_guide_assignments" USING btree ("user_id","deleted_at");--> statement-breakpoint
CREATE INDEX "tour_guide_assignments_tour_id_assignment_role_idx" ON "tour_guide_assignments" USING btree ("tour_id","assignment_role");--> statement-breakpoint
CREATE UNIQUE INDEX "tours_slug_unique" ON "tours" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tours_is_active_deleted_at_id_idx" ON "tours" USING btree ("is_active","deleted_at","id");--> statement-breakpoint
CREATE INDEX "tours_price_cents_id_idx" ON "tours" USING btree ("price_cents","id");--> statement-breakpoint
CREATE INDEX "tours_rating_average_id_idx" ON "tours" USING btree ("rating_average","id");