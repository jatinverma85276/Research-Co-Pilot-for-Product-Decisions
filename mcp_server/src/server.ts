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
    inputSchema: z.object({
      title: z.string().min(1),
      content: z.string().min(1),
    }),
    // Optional: describe response shape (useful for some clients)
    outputSchema: z.object({
      saved: z.boolean(),
      filename: z.string(),
      path: z.string(),
    }),
  },
  async ({ title, content }) => {
    const safeTitle = title.replace(/[^a-z0-9\-]+/gi, "_").toLowerCase();
    const filename = `${safeTitle}_${Date.now()}.md`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, `# ${title}\n\n${content}`, "utf8");

    const result = {
      saved: true,
      filename,
      path: filepath,
    };

    // MCP tools return "content" + optional "structuredContent"
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

// ---------- 3. Wire it to HTTP /mcp using Streamable HTTP ----------
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  // One transport per HTTP request (per spec)
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
    // for local dev; in prod you usually also set enableDnsRebindingProtection: true
  });

  res.on("close", () => {
    transport.close();
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = parseInt(process.env.PORT || "4000", 10);
app.listen(PORT, () => {
  console.log(`🚀 MCP server "research-mcp" on http://localhost:${PORT}/mcp`);
});
