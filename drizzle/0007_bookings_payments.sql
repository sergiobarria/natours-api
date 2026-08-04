CREATE TABLE "booking_idempotency" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"request_hash" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"provider_idempotency_key" text NOT NULL,
	"provider_checkout_id" text,
	"provider_payment_id" text,
	"provider_refund_id" text,
	"checkout_url" text,
	"last_error_code" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_payments_status_check" CHECK ("booking_payments"."status" IN ('checkout_pending','checkout_open','paid','refund_pending','refund_failed','refunded')),
	CONSTRAINT "booking_payments_amount_cents_check" CHECK ("booking_payments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_travelers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_travelers_position_check" CHECK ("booking_travelers"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tour_id" uuid NOT NULL,
	"departure_id" uuid NOT NULL,
	"status" text NOT NULL,
	"purchaser_name" text NOT NULL,
	"purchaser_email" text NOT NULL,
	"tour_name" text NOT NULL,
	"departure_start_at" timestamp (3) with time zone NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"discount_percentage" text,
	"discount_cents" integer NOT NULL,
	"discounted_unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"hold_expires_at" timestamp (3) with time zone,
	"cancellation_requested_at" timestamp (3) with time zone,
	"confirmed_at" timestamp (3) with time zone,
	"cancelled_at" timestamp (3) with time zone,
	"inventory_released_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" IN ('pending_payment','confirmed','cancellation_pending','cancellation_failed','cancelled','expired')),
	CONSTRAINT "bookings_quantity_check" CHECK ("bookings"."quantity" > 0),
	CONSTRAINT "bookings_currency_check" CHECK ("bookings"."currency" = 'usd'),
	CONSTRAINT "bookings_unit_price_cents_check" CHECK ("bookings"."unit_price_cents" >= 0),
	CONSTRAINT "bookings_discount_cents_check" CHECK ("bookings"."discount_cents" >= 0),
	CONSTRAINT "bookings_discounted_unit_price_cents_check" CHECK ("bookings"."discounted_unit_price_cents" >= 0),
	CONSTRAINT "bookings_subtotal_cents_check" CHECK ("bookings"."subtotal_cents" >= 0),
	CONSTRAINT "bookings_total_cents_check" CHECK ("bookings"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_provider_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"booking_id" uuid,
	"processed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_idempotency" ADD CONSTRAINT "booking_idempotency_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_idempotency" ADD CONSTRAINT "booking_idempotency_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_payments" ADD CONSTRAINT "booking_payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_travelers" ADD CONSTRAINT "booking_travelers_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tour_id_tours_id_fk" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departure_id_tour_departures_id_fk" FOREIGN KEY ("departure_id") REFERENCES "public"."tour_departures"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_idempotency_user_id_key_hash_unique" ON "booking_idempotency" USING btree ("user_id","key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_booking_id_unique" ON "booking_payments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_provider_idempotency_key_unique" ON "booking_payments" USING btree ("provider_idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_provider_checkout_id_unique" ON "booking_payments" USING btree ("provider_checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_provider_payment_id_unique" ON "booking_payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_payments_provider_refund_id_unique" ON "booking_payments" USING btree ("provider_refund_id");--> statement-breakpoint
CREATE INDEX "booking_payments_status_updated_at_idx" ON "booking_payments" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_travelers_booking_id_position_unique" ON "booking_travelers" USING btree ("booking_id","position");--> statement-breakpoint
CREATE INDEX "bookings_user_id_created_at_idx" ON "bookings" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings" USING btree ("status","hold_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_provider_provider_event_id_unique" ON "payment_provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_provider_events_booking_id_idx" ON "payment_provider_events" USING btree ("booking_id");