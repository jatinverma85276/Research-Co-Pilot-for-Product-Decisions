import "dotenv/config";
import OpenAI from "openai";
// const OpenAI = require("openai");

// 1. Init client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. TypeScript type for our report
type ResearchReport = {
  overview: string;
  target_customers: string[];
  competitors: {
    name: string;
    positioning: string;
    pricing: string;
  }[];
  demand_signals: string[];
  risks: string[];
  action_items: string[];
};

// 3. Build system + user prompts
function buildPrompt(productIdea: string) {
  const system = `
You are a senior market research analyst.

Given a product or business idea, you must create a short, practical research snapshot.

Rules:
- Be realistic but concise.
- If you are unsure about something, say "Unknown" rather than inventing fake data.
- Always respond in valid JSON that matches the required keys.
`;

  const user = `
Product idea:
"${productIdea}"

Create a research snapshot with the following fields:
- overview: short paragraph
- target_customers: array of 3–7 bullet-style strings
- competitors: array of 2–5 items, each with:
    - name
    - positioning
    - pricing (broad: "budget", "mid-range", "premium", or "Unknown")
- demand_signals: array of signals (e.g. trends, search demand, seasonal factors)
- risks: array of realistic risks
- action_items: 5–10 concrete next steps I should take.

Return ONLY JSON, no extra text.
`;

  return { system, user };
}

async function run() {
  // 4. Get product idea from CLI args
  const productIdea =
    process.argv.slice(2).join(" ") ||
    "Launching a cozy winter loungewear set for teens in Europe";

  console.log("🧠 Product idea:", productIdea);
  console.log("⏳ Generating research report...\n");

  const { system, user } = buildPrompt(productIdea);

  // 5. Call OpenAI Responses API with JSON mode
  const response = await client.responses.create({
    model: "gpt-5-mini", // or any current text-capable model
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    // Force JSON object output
    text: {
      format: { type: "json_object" },
    },
  });

  // 6. Get the combined text output and parse JSON
  const outputText = response.output_text;

  let report: ResearchReport;
  try {
    report = JSON.parse(outputText) as ResearchReport;
  } catch (err) {
    console.error("❌ Failed to parse JSON from model:");
    console.error(outputText);
    throw err;
  }

  // 7. Pretty-print the result
  console.log("✅ Raw JSON:");
  console.log(JSON.stringify(report, null, 2));

  console.log("\n📌 Summary:");
  console.log("- Overview:", report.overview);
  console.log("- Target customers:", report.target_customers.length);
  console.log("- Competitors:", report.competitors.length);
  console.log("- Action items:", report.action_items.length);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
