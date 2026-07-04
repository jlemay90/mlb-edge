import "dotenv/config";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "2.0.0" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MLB Edge API on port ${PORT}`));
