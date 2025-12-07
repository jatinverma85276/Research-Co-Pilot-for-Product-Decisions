import express from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// ---------- 1. Create MCP server ----------
const mcpServer = new McpServer({
  name: "research-mcp",
  version: "0.1.0",
});

// Ensure reports folder exists
const reportsDir = path.join(process.cwd(), "reports");
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// ---------- 2. Register a tool: save_research_report ----------
mcpServer.registerTool(
  "save_research_report",
  {
    title: "Save Research Report",
    description: "Save a research report to disk as a markdown file.",
    // NOTE: per MCP TS SDK docs, schemas are plain objects of zod fields
    inputSchema: {
      title: z.string().min(1),
      content: z.string().min(1),
    },
    outputSchema: {
      saved: z.boolean(),
      filename: z.string(),
      path: z.string(),
    },
  },
  async ({ title, content }) => {
    console.log("🛠 save_research_report called with title:", title);

    const safeTitle = title.replace(/[^a-z0-9\-]+/gi, "_").toLowerCase();
    const filename = `${safeTitle}_${Date.now()}.md`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, `# ${title}\n\n${content}`, "utf8");

    const result = {
      saved: true,
      filename,
      path: filepath,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
      structuredContent: result,
    };
  }
);

// ---------- 3. Shared Streamable HTTP transport ----------
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,

  // for local dev; in prod you usually also set enableDnsRebindingProtection: true
});

// Connect MCP server to the transport ONCE
mcpServer.connect(transport).catch((err) => {
  console.error("Error connecting MCP server to transport:", err);
  process.exit(1);
});

// ---------- 4. Express app wiring ----------
const app = express();
app.use(express.json());

// Route ALL HTTP methods for /mcp through the transport
app.all("/mcp", async (req, res) => {
  try {
    console.log(`${req.method} ${req.path}`);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error in /mcp handler:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal MCP server error" });
    }
  }
});

const PORT = parseInt(process.env.PORT || "4000", 10);
app
  .listen(PORT, () => {
    console.log(`🚀 MCP server "research-mcp" on http://localhost:${PORT}/mcp`);
  })
  .on("error", (err) => {
    console.error("HTTP server error:", err);
    process.exit(1);
  });
