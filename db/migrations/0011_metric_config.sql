CREATE TABLE "metric_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedById" text
);
