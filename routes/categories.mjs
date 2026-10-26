import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const categoriesRouter = Router();

function asCategory(row) {
  return { id: row.id, name: row.name };
}

categoriesRouter.get("/", async (req, res) => {
  try {
    const { rows } = await connectionPool.query(
      `SELECT id, name FROM categories ORDER BY id`
    );
    return res.status(200).json(rows.map(asCategory));
  } catch {
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

categoriesRouter.get("/:id", async (req, res) => {
  try {
    const { rows } = await connectionPool.query(
      `SELECT id, name FROM categories WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    return res.status(200).json(asCategory(rows[0]));
  } catch {
    return res.status(500).json({ error: "Failed to fetch category" });
  }
});

categoriesRouter.post("/", protectAdmin, async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "Category name is required" });
  }
  try {
    const { rows } = await connectionPool.query(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id, name`,
      [name]
    );
    return res.status(201).json(asCategory(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "This category already exists" });
    }
    return res.status(500).json({ error: "Failed to create category" });
  }
});

categoriesRouter.put("/:id", protectAdmin, async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "Category name is required" });
  }
  try {
    const { rows } = await connectionPool.query(
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name`,
      [name, req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    return res.status(200).json(asCategory(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "This category already exists" });
    }
    return res.status(500).json({ error: "Failed to update category" });
  }
});

categoriesRouter.delete("/:id", protectAdmin, async (req, res) => {
  try {
    const { rows } = await connectionPool.query(
      `DELETE FROM categories WHERE id = $1 RETURNING id, name`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }
    return res.status(200).json(asCategory(rows[0]));
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ error: "Category is in use by posts" });
    }
    return res.status(500).json({ error: "Failed to delete category" });
  }
});

export default categoriesRouter;
