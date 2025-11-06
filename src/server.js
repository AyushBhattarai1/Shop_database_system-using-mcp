#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const dbPath = path.join(__dirname, "..", "shop.db");
const db = new sqlite3.Database(dbPath);

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize database schema
async function initializeDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      cost REAL NOT NULL,
      sales_per_day REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for faster queries
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_type ON products(type)`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_category ON products(category)`);
}

// Initialize the server
const server = new Server(
  {
    name: "shop-manager",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_products",
      description: "Fetch products from the database. Can filter by name, type, or category.",
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Filter by product name (partial match)",
          },
          type: {
            type: "string",
            description: "Filter by product type (e.g., 'hair', 'perfume', 'skin')",
            enum: ["hair", "perfume", "skin"],
          },
          category: {
            type: "string",
            description: "Filter by specific category (e.g., 'shampoo', 'gucci', 'body_lotion')",
          },
        },
      },
    },
    {
      name: "get_weekly_sales",
      description: "Get weekly sales data. Can filter by product type or show all products.",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "Filter by product type (e.g., 'hair', 'perfume', 'skin'). Leave empty for all products.",
            enum: ["hair", "perfume", "skin", ""],
          },
          product_id: {
            type: "number",
            description: "Get weekly sales for a specific product by ID",
          },
        },
      },
    },
    {
      name: "get_avg_cost_by_type",
      description: "Get average cost grouped by product type.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "add_product",
      description: "Add a new product to the database.",
      inputSchema: {
        type: "object",
        required: ["name", "type", "category", "cost", "sales_per_day"],
        properties: {
          name: {
            type: "string",
            description: "Product name (e.g., 'Shampoo Pro', 'Gucci Bloom')",
          },
          type: {
            type: "string",
            description: "Product type",
            enum: ["hair", "perfume", "skin"],
          },
          category: {
            type: "string",
            description: "Product category (e.g., 'shampoo', 'gucci', 'body_lotion')",
          },
          cost: {
            type: "number",
            description: "Product cost in dollars",
          },
          sales_per_day: {
            type: "number",
            description: "Average sales per day",
          },
        },
      },
    },
    {
      name: "update_product",
      description: "Update an existing product. Only provide fields you want to update.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "number",
            description: "Product ID to update",
          },
          name: {
            type: "string",
            description: "New product name",
          },
          type: {
            type: "string",
            description: "New product type",
            enum: ["hair", "perfume", "skin"],
          },
          category: {
            type: "string",
            description: "New product category",
          },
          cost: {
            type: "number",
            description: "New product cost",
          },
          sales_per_day: {
            type: "number",
            description: "New sales per day value",
          },
        },
      },
    },
    {
      name: "delete_product",
      description: "Delete a product from the database.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "number",
            description: "Product ID to delete",
          },
        },
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_products": {
        let query = "SELECT * FROM products WHERE 1=1";
        const params = [];

        if (args.name) {
          query += " AND name LIKE ?";
          params.push(`%${args.name}%`);
        }
        if (args.type) {
          query += " AND type = ?";
          params.push(args.type);
        }
        if (args.category) {
          query += " AND category = ?";
          params.push(args.category);
        }

        query += " ORDER BY name";

        const products = await dbAll(query, params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: products.length,
                  products: products,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_weekly_sales": {
        let query;
        let params = [];

        if (args.product_id) {
          query = `
            SELECT 
              id,
              name,
              type,
              category,
              sales_per_day,
              (sales_per_day * 7) as weekly_sales,
              cost,
              (sales_per_day * 7 * cost) as weekly_revenue
            FROM products 
            WHERE id = ?
          `;
          params = [args.product_id];
        } else if (args.type) {
          query = `
            SELECT 
              id,
              name,
              type,
              category,
              sales_per_day,
              (sales_per_day * 7) as weekly_sales,
              cost,
              (sales_per_day * 7 * cost) as weekly_revenue
            FROM products 
            WHERE type = ?
            ORDER BY weekly_sales DESC
          `;
          params = [args.type];
        } else {
          query = `
            SELECT 
              id,
              name,
              type,
              category,
              sales_per_day,
              (sales_per_day * 7) as weekly_sales,
              cost,
              (sales_per_day * 7 * cost) as weekly_revenue
            FROM products 
            ORDER BY weekly_sales DESC
          `;
        }

        const sales = await dbAll(query, params);
        
        // Calculate totals
        const totalWeeklySales = sales.reduce((sum, item) => sum + item.weekly_sales, 0);
        const totalWeeklyRevenue = sales.reduce((sum, item) => sum + item.weekly_revenue, 0);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total_weekly_sales: totalWeeklySales,
                  total_weekly_revenue: totalWeeklyRevenue,
                  products: sales,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_avg_cost_by_type": {
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
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  average_costs_by_type: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "add_product": {
        const { name, type, category, cost, sales_per_day } = args;

        await dbRun(
          `INSERT INTO products (name, type, category, cost, sales_per_day)
           VALUES (?, ?, ?, ?, ?)`,
          [name, type, category, cost, sales_per_day]
        );

        // Get the last inserted row using SQLite's last_insert_rowid()
        const newProduct = await dbGet(
          "SELECT * FROM products WHERE id = last_insert_rowid()"
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Product added successfully",
                  product: newProduct,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "update_product": {
        const { id, ...updates } = args;

        // Build dynamic update query
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
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "No fields to update",
                }),
              },
            ],
            isError: true,
          };
        }

        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);

        await dbRun(
          `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
          values
        );

        const updatedProduct = await dbGet(
          "SELECT * FROM products WHERE id = ?",
          [id]
        );

        if (!updatedProduct) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Product not found",
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Product updated successfully",
                  product: updatedProduct,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "delete_product": {
        const { id } = args;

        // Check if product exists
        const product = await dbGet("SELECT * FROM products WHERE id = ?", [id]);

        if (!product) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Product not found",
                }),
              },
            ],
            isError: true,
          };
        }

        await dbRun("DELETE FROM products WHERE id = ?", [id]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Product deleted successfully",
                  deleted_product: product,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: `Unknown tool: ${name}`,
              }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  await initializeDatabase();
  
  // Add some sample data if database is empty
  const existingProducts = await dbAll("SELECT COUNT(*) as count FROM products");
  if (existingProducts[0].count === 0) {
    const sampleProducts = [
      { name: "Shampoo Pro", type: "hair", category: "shampoo", cost: 12.99, sales_per_day: 15 },
      { name: "Conditioner Plus", type: "hair", category: "conditioner", cost: 14.99, sales_per_day: 12 },
      { name: "Gucci Bloom", type: "perfume", category: "gucci", cost: 89.99, sales_per_day: 8 },
      { name: "Victoria Secret Angel", type: "perfume", category: "victoria_secret", cost: 65.99, sales_per_day: 10 },
      { name: "Body Lotion Smooth", type: "skin", category: "body_lotion", cost: 18.99, sales_per_day: 20 },
      { name: "Moisturizer Daily", type: "skin", category: "moisturizer", cost: 24.99, sales_per_day: 18 },
    ];

    for (const product of sampleProducts) {
      await dbRun(
        `INSERT INTO products (name, type, category, cost, sales_per_day)
         VALUES (?, ?, ?, ?, ?)`,
        [product.name, product.type, product.category, product.cost, product.sales_per_day]
      );
    }
    console.error("Sample products added to database");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Shop Manager MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

