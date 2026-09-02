import { createInterface } from "node:readline";

const SERVER_INFO = { name: "echo-fixture", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "echo",
    description: "Echo back the message argument",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Text to echo" },
      },
      required: ["message"],
    },
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handleRequest(request) {
  const { id, method, params } = request;

  if (method === "initialize") {
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    });
    return;
  }

  if (method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS },
    });
    return;
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};
    if (name !== "echo") {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Unknown tool: ${name}` },
      });
      return;
    }

    send({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: String(args.message ?? "") }],
      },
    });
    return;
  }

  if (id !== undefined) {
    send({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return;
  }

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method !== undefined && message.id !== undefined) {
    handleRequest(message);
  }
});

rl.on("close", () => {
  process.exit(0);
});

process.stdin.on("end", () => {
  rl.close();
});
