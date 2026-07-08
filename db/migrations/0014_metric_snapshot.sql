CREATE TABLE "metric_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"metricId" text NOT NULL,
	"teamSlug" text,
	"value" double precision NOT NULL,
	"capturedAt" timestamp DEFAULT now() NOT NULL
);
