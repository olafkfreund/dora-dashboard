CREATE TABLE "gitlab_coverage" (
	"projectId" integer PRIMARY KEY NOT NULL,
	"projectPath" text,
	"coverage" double precision,
	"ref" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
