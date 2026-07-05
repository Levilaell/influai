// Schema Drizzle espelhando as migrations SQL (leituras tipadas; escritas do
// ledger usam SQL cru em credits/ledger.ts por causa de advisory locks e
// ON CONFLICT com índices parciais).
import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, integer, jsonb, numeric, primaryKey,
} from "drizzle-orm/pg-core";

export const videoStatus = pgEnum("video_status", [
  "draft", "estimated", "queued", "scripting", "keyframing", "rendering",
  "voicing", "assembling", "ready", "failed", "canceled",
]);

export const personaStatus = pgEnum("persona_status", [
  "draft", "candidates_generating", "candidates_ready",
  "sheet_generating", "ready", "failed",
]);

export const ledgerEntryType = pgEnum("ledger_entry_type", [
  "grant", "purchase", "hold", "hold_release", "adjustment",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  entryType: ledgerEntryType("entry_type").notNull(),
  amount: integer("amount").notNull(),
  videoId: uuid("video_id"),
  personaId: uuid("persona_id"),
  ref: text("ref"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandMemory = pgTable("brand_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique(),
  coveredTopics: jsonb("covered_topics").notNull().default([]),
  learnings: jsonb("learnings").notNull().default([]),
  styleGuide: text("style_guide").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandAssets = pgTable("brand_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull().default("product"),
  label: text("label").notNull().default(""),
  storageKey: text("storage_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  status: personaStatus("status").notNull().default("draft"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  niche: text("niche"),
  voiceId: text("voice_id").notNull().default("matilda"),
  moderation: jsonb("moderation").notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const personaAssets = pgTable("persona_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  personaId: uuid("persona_id").notNull(),
  kind: text("kind").notNull(),
  idx: integer("idx").notNull().default(0),
  storageKey: text("storage_key").notNull(),
  providerUrl: text("provider_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  brandId: uuid("brand_id").notNull(),
  personaId: uuid("persona_id").notNull(),
  status: videoStatus("status").notNull().default("draft"),
  topic: text("topic").notNull(),
  script: jsonb("script"),
  estimatedCredits: integer("estimated_credits"),
  actualCostUsd: numeric("actual_cost_usd", { precision: 8, scale: 4 }),
  finalStorageKey: text("final_storage_key"),
  progress: jsonb("progress").notNull().default({}),
  error: text("error"),
  aiLabel: boolean("ai_label").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandProfiles = pgTable("brand_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique(),
  userId: uuid("user_id").notNull(),
  business: text("business").notNull(),
  audience: text("audience").notNull(),
  valueProposition: text("value_proposition").notNull(),
  tone: text("tone").notNull(),
  niche: text("niche").notNull(),
  contentPillars: jsonb("content_pillars").notNull().default([]),
  products: jsonb("products").notNull().default([]),
  confidence: text("confidence").notNull().default("média"),
  notes: text("notes").notNull().default(""),
  source: text("source").notNull().default("text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobSteps = pgTable(
  "job_steps",
  {
    jobKey: text("job_key").notNull(),
    step: text("step").notNull(),
    output: jsonb("output").notNull().default({}),
    costUsd: numeric("cost_usd", { precision: 8, scale: 4 }).notNull().default("0"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.jobKey, t.step] })]
);
