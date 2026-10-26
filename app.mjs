// app.mjs
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import postRoutes from "./apps/postRoutes.mjs";
import postsRouter from "./routes/posts.mjs";
import assignmentsRouter from "./routes/assignments.mjs";
import authRouter from "./routes/auth.mjs";
import categoriesRouter from "./routes/categories.mjs";
import protectUser from "./middlewares/protectUser.mjs";
import protectAdmin from "./middlewares/protectAdmin.mjs";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.use("/posts", postRoutes);
app.use("/posts", postsRouter);
app.use("/categories", categoriesRouter);
app.use("/assignments", assignmentsRouter);
app.use("/auth", authRouter);

app.get("/protected-route", protectUser, (req, res) => {
  res.json({ message: "This is protected content", user: req.user });
});

app.get("/admin-only", protectAdmin, (req, res) => {
  res.json({ message: "This is admin-only content", admin: req.user });
});

export default app;

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

// Vercel ตั้ง VERCEL=1 — ห้าม listen() ใน serverless ไม่งั้นทุก route จะ FUNCTION_INVOCATION_FAILED
if (isDirectRun && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
