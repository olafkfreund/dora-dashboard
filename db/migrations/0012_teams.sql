CREATE TABLE "team" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedById" text
);
