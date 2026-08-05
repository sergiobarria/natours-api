CREATE INDEX "tour_departures_start_at_is_active_deleted_at_idx" ON "tour_departures" USING btree ("start_at","is_active","deleted_at");--> statement-breakpoint
CREATE INDEX "bookings_status_departure_start_at_tour_id_idx" ON "bookings" USING btree ("status","departure_start_at","tour_id");
