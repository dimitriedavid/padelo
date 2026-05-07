CREATE TYPE "public"."tournament_status" AS ENUM('active', 'finished');--> statement-breakpoint
CREATE TABLE "tournament_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text NOT NULL,
	"name" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"state_json" jsonb NOT NULL,
	"state_version" integer DEFAULT 1 NOT NULL,
	"status" "tournament_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "tournaments_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint
ALTER TABLE "tournament_logs" ADD CONSTRAINT "tournament_logs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_logs_tournament_created_at_idx" ON "tournament_logs" USING btree ("tournament_id","created_at");--> statement-breakpoint
CREATE INDEX "tournaments_room_code_idx" ON "tournaments" USING btree ("room_code");--> statement-breakpoint
CREATE INDEX "tournaments_status_idx" ON "tournaments" USING btree ("status");