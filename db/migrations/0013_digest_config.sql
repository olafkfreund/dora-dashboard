CREATE TABLE "digest_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"channel" text DEFAULT 'webhook' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encryptedSecret" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedById" text
);
