import { describeScore } from "../score-domain";
import { jsonResponse, type Env } from "./shared";

const CONVERSATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface ConversationRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface ConversationSummaryRow extends ConversationRow {
  message_count: number;
  last_score: number | null;
}

interface MessageRow {
  role: "user" | "assistant";
  content: string;
  score: number | null;
  stage: string | null;
  created_at: number;
}

export function isValidConversationId(value: string): boolean {
  return CONVERSATION_ID_PATTERN.test(value);
}

export async function handleListConversations(env: Env): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT c.id, c.title, c.created_at, c.updated_at,
           COUNT(m.id) AS message_count,
           (SELECT score FROM chat_messages
             WHERE conversation_id = c.id AND role = 'assistant'
             ORDER BY id DESC LIMIT 1) AS last_score
    FROM chat_conversations c
    LEFT JOIN chat_messages m ON m.conversation_id = c.id
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 100
  `).all<ConversationSummaryRow>();
  const conversations = (result.results ?? []).map((row) => {
    const lastScore = row.last_score ?? null;
    return {
      id: row.id,
      title: row.title,
      messageCount: Number(row.message_count),
      lastScore,
      lastStage: lastScore === null ? null : describeScore(lastScore).stage,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  });
  return jsonResponse(conversations, { headers: { "Cache-Control": "no-store" } });
}

export async function handleGetConversation(id: string, env: Env): Promise<Response> {
  if (!isValidConversationId(id)) {
    return jsonResponse({ error: "invalid_conversation_id" }, { status: 400 });
  }
  const conversation = await env.DB
    .prepare("SELECT id, title, created_at, updated_at FROM chat_conversations WHERE id = ?")
    .bind(id)
    .first<ConversationRow>();
  if (!conversation) {
    return jsonResponse({ error: "conversation_not_found" }, { status: 404 });
  }
  const messages = await env.DB
    .prepare(
      "SELECT role, content, score, stage, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC",
    )
    .bind(id)
    .all<MessageRow>();
  return jsonResponse({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages: (messages.results ?? []).map((row) => ({
      role: row.role,
      content: row.content,
      score: row.score ?? null,
      stage: row.stage ?? null,
      createdAt: row.created_at,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function handleDeleteConversation(id: string, env: Env): Promise<Response> {
  if (!isValidConversationId(id)) {
    return jsonResponse({ error: "invalid_conversation_id" }, { status: 400 });
  }
  const result = await env.DB
    .prepare("DELETE FROM chat_conversations WHERE id = ?")
    .bind(id)
    .run();
  if ((result.meta?.changes ?? 0) === 0) {
    return jsonResponse({ error: "conversation_not_found" }, { status: 404 });
  }
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
