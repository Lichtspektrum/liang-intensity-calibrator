import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 8787;
const PAGE_ORIGIN = "http://127.0.0.1:5173";
const MAX_LOG_ENTRIES = 200;
const logs = [];
const connectionStates = new WeakMap();
let nextConnectionId = 1;
let nextLogId = 1;

const corsHeaders = {
  "Access-Control-Allow-Origin": PAGE_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Test-Log-Id",
  Vary: "Origin",
};

const score = {
  score: 2.5,
  stage: "梁圣",
  voterCount: 4,
  positiveCount: 2,
  negativeCount: 1,
  neutralCount: 1,
  positivePoints: 12,
  negativePoints: -2,
};

function stageFor(position) {
  if (position >= 15) return "梁祖";
  if (position >= 9) return "梁神";
  if (position >= 3) return "梁圣";
  if (position >= -3) return "梁子";
  if (position >= -9) return "牢梁";
  return "小难梁";
}

function sendJson(response, body, { status = 200, cors = false, headers = {} } = {}) {
  response.writeHead(status, {
    ...(cors ? corsHeaders : {}),
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function connectionState(socket) {
  let state = connectionStates.get(socket);
  if (!state) {
    state = { id: nextConnectionId++, pendingVotePreflights: [] };
    connectionStates.set(socket, state);
  }
  return state;
}

function appendLog(entry) {
  logs.push(entry);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/__test/health") {
    sendJson(response, { ok: true });
    return;
  }
  if (url.pathname === "/__test/log") {
    sendJson(response, logs);
    return;
  }
  if (url.pathname.startsWith("/__test/log/")) {
    const id = Number(url.pathname.slice("/__test/log/".length));
    const entry = logs.find((candidate) => candidate.id === id);
    sendJson(response, entry ?? { error: "log not found" }, {
      status: entry ? 200 : 404,
    });
    return;
  }

  const rawBody = await readBody(request);
  const connection = connectionState(request.socket);
  let entry;
  if (url.pathname.startsWith("/api/")) {
    entry = {
      id: nextLogId++,
      connectionId: connection.id,
      timestamp: Date.now(),
      method: request.method,
      url: `${url.origin}${url.pathname}`,
      pathname: url.pathname,
      headers: request.headers,
      body: rawBody,
      preflightIds: [],
    };
    if (request.method === "POST" && url.pathname === "/api/vote") {
      entry.preflightIds = connection.pendingVotePreflights.splice(0);
    }
    appendLog(entry);
  }

  if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/vote") {
      connection.pendingVotePreflights.push(entry.id);
    }
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/score") {
    sendJson(response, score, { cors: true });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/timeline") {
    sendJson(response, [], { cors: true });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/conversations") {
    sendJson(response, [], { cors: true });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/opencode-models") {
    sendJson(response, {
      models: ["opencode/deepseek-v4-flash-free", "opencode-go/deepseek-v4-flash"],
      active: "opencode/deepseek-v4-flash-free",
      activeInList: true,
    }, { cors: true });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/vote") {
    const { position } = JSON.parse(rawBody);
    sendJson(response, {
      accepted: true,
      userPosition: position,
      nextVoteAt: 0,
      score: position,
      stage: stageFor(position),
      voterCount: 1,
      positiveCount: position > 0 ? 1 : 0,
      negativeCount: position < 0 ? 1 : 0,
      neutralCount: position === 0 ? 1 : 0,
      positivePoints: position > 0 ? position : 0,
      negativePoints: position < 0 ? position : 0,
    }, {
      cors: true,
      headers: { "X-Test-Log-Id": String(entry.id) },
    });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/mode-positions") {
    sendJson(response, { news: null, chat: null }, { cors: true });
    return;
  }
  if (request.method === "PUT" && url.pathname === "/api/mode-positions") {
    sendJson(response, JSON.parse(rawBody), { cors: true });
    return;
  }

  sendJson(response, { error: "not found" }, { status: 404 });
}).listen(PORT, HOST);
