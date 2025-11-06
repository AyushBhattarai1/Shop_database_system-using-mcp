# Quick Setup Guide

## What You Have

A complete MCP server that allows AI assistants (like Claude) to manage your shop database. The server can:

✅ **Fetch Products** - Get products filtered by name, type, or category
✅ **Sales Analytics** - Calculate weekly sales and revenue
✅ **Cost Analysis** - Show average costs by product type
✅ **Add Products** - Insert new products into the database
✅ **Update Products** - Modify existing product information
✅ **Delete Products** - Remove products from the database

## Product Categories

Your shop sells:
- **Hair Products**: shampoo, conditioner
- **Perfumes**: gucci, victoria_secret
- **Skin Products**: body_lotion, moisturizer

## Quick Start

1. **Verify the server syntax:**
   ```bash
   node --check src/server.js
   ```

2. **Test the server (optional):**
   The server will automatically create the database and add sample products on first run.

3. **Connect to Claude Desktop:**
   - Copy the configuration from `claude_desktop_config.example.json`
   - Update the paths to match your system
   - Add it to your Claude Desktop config file:
     - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
     - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

## Example AI Interactions

Once connected, you can ask Claude things like:

- "Show me all hair products"
- "What are the weekly sales for perfumes?"
- "What's the average cost of skin products?"
- "Add a new shampoo called 'Luxury Shampoo' costing $25 with 30 sales per day"
- "Update the cost of Gucci Bloom to $95"
- "Delete product ID 3"
- "Show me products with sales per day greater than 15"

## Database Location

The database file is at: `mcp-shop/shop.db`

You can inspect it directly:
```bash
sqlite3 shop.db "SELECT * FROM products;"
```

## Next Steps

1. **Customize sample data**: Edit the sample products in `server.js` (lines ~540-550)
2. **Add more fields**: Extend the schema if you need additional product information
3. **Export to Google Sheets**: You could add a tool to export data to Google Sheets API
4. **Add more analytics**: Implement additional reporting tools as needed

## Troubleshooting

- **Server won't start**: Make sure all dependencies are installed (`npm install`)
- **Database errors**: Check file permissions on `shop.db`
- **MCP connection issues**: Verify the paths in Claude Desktop config are absolute paths

