#!/usr/bin/env node

import express from "express";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize database
const dbPath = path.join(__dirname, "shop.db");
const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// API Routes

// Simple NLQ parsing helper
function parseSalesQuery(query) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return { error: "Empty query" };

  // Determine time window
  let period = "day"; // default per-day
  if (q.includes("week") || q.includes("weekly") || q.includes("this week")) period = "week";
  if (q.includes("today")) period = "day";
  if (q.includes("per day") || q.includes("daily")) period = "day";

  // Determine product scope
  // Try matching type keywords first
  if (q.includes("hair")) return { period, scope: { type: "hair" } };
  if (q.includes("perfume")) return { period, scope: { type: "perfume" } };
  if (q.includes("skin")) return { period, scope: { type: "skin" } };

  // Category keywords
  const categoryMap = [
    "shampoo",
    "conditioner",
    "gucci",
    "victoria secret",
    "victoria_secret",
    "body lotion",
    "body_lotion",
    "moisturizer",
  ];
  for (const cat of categoryMap) {
    if (q.includes(cat)) {
      // normalize to db category format (underscores)
      const category = cat.replace(/\s+/g, "_");
      return { period, scope: { category } };
    }
  }

  // Otherwise, use any remaining word as name contains
  // Extract likely product name token(s)
  const nameHint = q
    .replace(/sales|sale|revenue|for|of|what|show|get|how\s+many|how\s+much|today|weekly|this\s+week|per\s+day/gi, "")
    .trim();
  if (nameHint) return { period, scope: { name: nameHint } };

  return { period, scope: {} };
}

// Natural language sales query
app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body || {};
    const parsed = parseSalesQuery(question);
    if (parsed.error) return res.status(400).json({ success: false, error: parsed.error });

    const { period, scope } = parsed;

    let where = "WHERE 1=1";
    const params = [];
    if (scope.type) {
      where += " AND type = ?";
      params.push(scope.type);
    }
    if (scope.category) {
      where += " AND category = ?";
      params.push(scope.category);
    }
    if (scope.name) {
      where += " AND name LIKE ?";
      params.push(`%${scope.name}%`);
    }

    // Base select
    let select = `
      SELECT id, name, type, category, cost, sales_per_day
      FROM products
      ${where}
      ORDER BY name
    `;

    const products = await dbAll(select, params);

    // Compute metrics based on period
    const results = products.map(p => {
      const daily = p.sales_per_day;
      const weekly = daily * 7;
      const sales = period === "week" ? weekly : daily;
      const revenue = sales * p.cost;
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        category: p.category,
        cost: p.cost,
        sales,
        revenue,
        period,
      };
    });

    const totalSales = results.reduce((s, r) => s + r.sales, 0);
    const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);

    res.json({
      success: true,
      interpreted: { period, scope },
      totals: { sales: totalSales, revenue: totalRevenue },
      items: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const { name, type, category } = req.query;
    let query = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (name) {
      query += " AND name LIKE ?";
      params.push(`%${name}%`);
    }
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    query += " ORDER BY name";

    const products = await dbAll(query, params);
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get weekly sales
app.get("/api/sales/weekly", async (req, res) => {
  try {
    const { type, product_id } = req.query;
    let query;
    let params = [];

    if (product_id) {
      query = `
        SELECT 
          id, name, type, category, sales_per_day,
          (sales_per_day * 7) as weekly_sales,
          cost,
          (sales_per_day * 7 * cost) as weekly_revenue
        FROM products 
        WHERE id = ?
      `;
      params = [product_id];
    } else if (type) {
      query = `
        SELECT 
          id, name, type, category, sales_per_day,
          (sales_per_day * 7) as weekly_sales,
          cost,
          (sales_per_day * 7 * cost) as weekly_revenue
        FROM products 
        WHERE type = ?
        ORDER BY weekly_sales DESC
      `;
      params = [type];
    } else {
      query = `
        SELECT 
          id, name, type, category, sales_per_day,
          (sales_per_day * 7) as weekly_sales,
          cost,
          (sales_per_day * 7 * cost) as weekly_revenue
        FROM products 
        ORDER BY weekly_sales DESC
      `;
    }

    const sales = await dbAll(query, params);
    const totalWeeklySales = sales.reduce((sum, item) => sum + item.weekly_sales, 0);
    const totalWeeklyRevenue = sales.reduce((sum, item) => sum + item.weekly_revenue, 0);

    res.json({
      success: true,
      total_weekly_sales: totalWeeklySales,
      total_weekly_revenue: totalWeeklyRevenue,
      products: sales,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get average costs by type
app.get("/api/costs/average", async (req, res) => {
  try {
    const query = `
      SELECT 
        type,
        COUNT(*) as product_count,
        AVG(cost) as avg_cost,
        MIN(cost) as min_cost,
        MAX(cost) as max_cost,
        SUM(sales_per_day) as total_daily_sales
      FROM products
      GROUP BY type
      ORDER BY type
    `;

    const results = await dbAll(query);
    res.json({ success: true, average_costs_by_type: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add product
app.post("/api/products", async (req, res) => {
  try {
    const { name, type, category, cost, sales_per_day } = req.body;

    if (!name || !type || !category || cost === undefined || sales_per_day === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, type, category, cost, sales_per_day",
      });
    }

    await dbRun(
      `INSERT INTO products (name, type, category, cost, sales_per_day)
       VALUES (?, ?, ?, ?, ?)`,
      [name, type, category, cost, sales_per_day]
    );

    const newProduct = await dbGet(
      "SELECT * FROM products WHERE id = last_insert_rowid()"
    );

    res.json({ success: true, message: "Product added successfully", product: newProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.type !== undefined) {
      fields.push("type = ?");
      values.push(updates.type);
    }
    if (updates.category !== undefined) {
      fields.push("category = ?");
      values.push(updates.category);
    }
    if (updates.cost !== undefined) {
      fields.push("cost = ?");
      values.push(updates.cost);
    }
    if (updates.sales_per_day !== undefined) {
      fields.push("sales_per_day = ?");
      values.push(updates.sales_per_day);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    await dbRun(
      `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    const updatedProduct = await dbGet("SELECT * FROM products WHERE id = ?", [id]);

    if (!updatedProduct) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    res.json({ success: true, message: "Product updated successfully", product: updatedProduct });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await dbGet("SELECT * FROM products WHERE id = ?", [id]);

    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    await dbRun("DELETE FROM products WHERE id = ?", [id]);

    res.json({ success: true, message: "Product deleted successfully", deleted_product: product });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Shop Manager UI running at http://localhost:${PORT}`);
  console.log(`📊 Open your browser and navigate to http://localhost:${PORT}`);
});

