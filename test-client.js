#!/usr/bin/env node

/**
 * Simple MCP client to test the shop manager server
 * This demonstrates how to interact with the MCP server
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, "src", "server.js");

// Start the MCP server
const server = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

let requestId = 1;

function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params,
  };

  const message = JSON.stringify(request) + "\n";
  console.log("📤 Sending:", JSON.stringify(request, null, 2));
  server.stdin.write(message);
}

function sendToolCall(toolName, args = {}) {
  sendRequest("tools/call", {
    name: toolName,
    arguments: args,
  });
}

// Handle responses
server.stdout.on("data", (data) => {
  const lines = data.toString().split("\n").filter((line) => line.trim());
  for (const line of lines) {
    try {
      const response = JSON.parse(line);
      console.log("\n📥 Received:", JSON.stringify(response, null, 2));
    } catch (e) {
      console.log("📥 Raw output:", line);
    }
  }
});

server.stderr.on("data", (data) => {
  console.error("Server log:", data.toString());
});

// Initialize: List available tools
console.log("=".repeat(60));
console.log("Testing MCP Shop Manager Server");
console.log("=".repeat(60));
console.log("\n1. Listing available tools...\n");
sendRequest("tools/list");

// Wait a bit, then test some tools
setTimeout(() => {
  console.log("\n2. Getting all products...\n");
  sendToolCall("get_products");
}, 1000);

setTimeout(() => {
  console.log("\n3. Getting weekly sales for hair products...\n");
  sendToolCall("get_weekly_sales", { type: "hair" });
}, 2000);

setTimeout(() => {
  console.log("\n4. Getting average costs by type...\n");
  sendToolCall("get_avg_cost_by_type");
}, 3000);

setTimeout(() => {
  console.log("\n5. Adding a new product...\n");
  sendToolCall("add_product", {
    name: "Premium Conditioner",
    type: "hair",
    category: "conditioner",
    cost: 19.99,
    sales_per_day: 25,
  });
}, 4000);

setTimeout(() => {
  console.log("\n6. Getting all products again to see the new one...\n");
  sendToolCall("get_products");
}, 5000);

// Exit after tests
setTimeout(() => {
  console.log("\n✅ Tests completed!");
  server.kill();
  process.exit(0);
}, 6000);

