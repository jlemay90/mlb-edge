import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  driver: "mysql2",
  dbCredentials: {
    uri: process.env.DATABASE_URL || "mysql://root@localhost:3306/mlb_edge",
  },
} satisfies Config;
