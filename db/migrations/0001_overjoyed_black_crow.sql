CREATE TYPE "public"."sso_provider_type" AS ENUM('ENTRA', 'GITHUB');--> statement-breakpoint
CREATE TABLE "sso_provider" (
	"provider" "sso_provider_type" PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"encryptedSecret" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedById" text
);
