# Shop Manager MCP Server

An MCP (Model Context Protocol) server for managing a shop database with hair products, perfumes, and skin products. This server allows AI assistants to interact with your product database, fetch sales data, and manage inventory.

## Features

- **Product Management**: Add, update, and delete products
- **Product Queries**: Filter and search products by name, type, or category
- **Sales Analytics**: Get weekly sales reports and revenue calculations
- **Cost Analysis**: Calculate average costs by product type
- **SQLite Database**: Lightweight, file-based database storage

## Database Schema

Products are stored with the following fields:
- `id`: Unique identifier (auto-incremented)
- `name`: Product name (e.g., "Shampoo Pro")
- `type`: Product type - one of: `hair`, `perfume`, `skin`
- `category`: Specific category (e.g., `shampoo`, `gucci`, `body_lotion`)
- `cost`: Product cost in dollars
- `sales_per_day`: Average sales per day
- `created_at`: Timestamp when product was added
- `updated_at`: Timestamp when product was last updated

## Available Tools

### 1. `get_products`
Fetch products from the database with optional filters.

**Parameters:**
- `name` (optional): Filter by product name (partial match)
- `type` (optional): Filter by type (`hair`, `perfume`, `skin`)
- `category` (optional): Filter by specific category

**Example:**
```json
{
  "name": "get_products",
  "arguments": {
    "type": "hair"
  }
}
```

### 2. `get_weekly_sales`
Get weekly sales data with revenue calculations.

**Parameters:**
- `type` (optional): Filter by product type
- `product_id` (optional): Get sales for a specific product

**Returns:** Weekly sales count, weekly revenue, and product details

### 3. `get_avg_cost_by_type`
Get average cost statistics grouped by product type.

**Parameters:** None

**Returns:** Average, min, max costs and total daily sales per type

### 4. `add_product`
Add a new product to the database.

**Parameters (all required):**
- `name`: Product name
- `type`: `hair`, `perfume`, or `skin`
- `category`: Product category
- `cost`: Cost in dollars
- `sales_per_day`: Average sales per day

**Example:**
```json
{
  "name": "add_product",
  "arguments": {
    "name": "Premium Shampoo",
    "type": "hair",
    "category": "shampoo",
    "cost": 19.99,
    "sales_per_day": 25
  }
}
```

### 5. `update_product`
Update an existing product. Only provide fields you want to update.

**Parameters:**
- `id` (required): Product ID
- `name`, `type`, `category`, `cost`, `sales_per_day` (optional): Fields to update

**Example:**
```json
{
  "name": "update_product",
  "arguments": {
    "id": 1,
    "cost": 15.99,
    "sales_per_day": 20
  }
}
```

### 6. `delete_product`
Delete a product from the database.

**Parameters:**
- `id` (required): Product ID to delete

**Example:**
```json
{
  "name": "delete_product",
  "arguments": {
    "id": 1
  }
}
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. The database will be automatically initialized when the server starts.

## Running the Server

```bash
npm start
```

The server runs on stdio and communicates via the MCP protocol. It will automatically:
- Create the database if it doesn't exist
- Initialize the schema
- Add sample products if the database is empty

## Connecting to Claude Desktop

To use this MCP server with Claude Desktop, add the following to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "shop-manager": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-shop/src/server.js"
      ],
      "cwd": "/absolute/path/to/mcp-shop"
    }
  }
}
```

Replace `/absolute/path/to/mcp-shop` with the actual path to your project directory.

## Sample Data

The server automatically adds sample products when first initialized:
- Hair products: Shampoo Pro, Conditioner Plus
- Perfumes: Gucci Bloom, Victoria Secret Angel
- Skin products: Body Lotion Smooth, Moisturizer Daily

## Example Use Cases

1. **"Show me all hair products"**
   - Uses `get_products` with `type: "hair"`

2. **"What are the weekly sales for perfumes?"**
   - Uses `get_weekly_sales` with `type: "perfume"`

3. **"What's the average cost of each product type?"**
   - Uses `get_avg_cost_by_type`

4. **"Add a new shampoo called 'Luxury Shampoo' costing $25 with 30 sales per day"**
   - Uses `add_product` with all required fields

5. **"Update the cost of product ID 1 to $18.99"**
   - Uses `update_product` with `id` and `cost`

6. **"Delete product ID 3"**
   - Uses `delete_product` with `id`

## Database Location

The SQLite database is stored at: `mcp-shop/shop.db`

You can backup or inspect the database using any SQLite tool:
```bash
sqlite3 shop.db "SELECT * FROM products;"
```

