import { describe, expect, it, vi } from "vitest";

import {
  handleDeleteConversation,
  handleGetConversation,
  handleListConversations,
} from "./conversations";
import type { Env } from "./shared";

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";

function envWithRows(
  allResults: unknown[],
  firstResult: unknown = null,
  runResult: unknown = { success: true, meta: { changes: 1 } },
): Env {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstResult),
    all: vi.fn().mockResolvedValue({ success: true, results: allResults }),
    run: vi.fn().mockResolvedValue(runResult),
  };
  return {
    DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
    VOTER_HASH_SECRET: "a".repeat(32),
    ALLOWED_ORIGINS: "https://app.example",
  };
}

describe("conversations API", () => {
  it("lists conversations sorted by recency with count and last score", async () => {
    const env = envWithRows([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "先做原创研究",
        created_at: 1,
        updated_at: 3,
        message_count: 3,
        last_score: 6,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "要不要追热点",
        created_at: 1,
        updated_at: 2,
        message_count: 1,
        last_score: null,
      },
    ]);

    const response = await handleListConversations(env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "先做原创研究",
        messageCount: 3,
        lastScore: 6,
        lastStage: "梁圣",
        createdAt: 1,
        updatedAt: 3,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        title: "要不要追热点",
        messageCount: 1,
        lastScore: null,
        lastStage: null,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
  });

  it("returns a conversation with its message history", async () => {
    const env = envWithRows(
      [
        { role: "user", content: "先做原创研究", score: null, stage: null, created_at: 1 },
        { role: "assistant", content: "先看真正的瓶颈。", score: 6, stage: "梁圣", created_at: 2 },
      ],
      { id: CONVERSATION_ID, title: "先做原创研究", created_at: 1, updated_at: 2 },
    );

    const response = await handleGetConversation(CONVERSATION_ID, env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: CONVERSATION_ID,
      title: "先做原创研究",
      createdAt: 1,
      updatedAt: 2,
      messages: [
        { role: "user", content: "先做原创研究", score: null, stage: null, createdAt: 1 },
        { role: "assistant", content: "先看真正的瓶颈。", score: 6, stage: "梁圣", createdAt: 2 },
      ],
    });
  });

  it("rejects malformed conversation ids", async () => {
    const env = envWithRows([]);
    expect((await handleGetConversation("not-a-uuid", env)).status).toBe(400);
    expect((await handleDeleteConversation("not-a-uuid", env)).status).toBe(400);
  });

  it("returns 404 for a missing conversation", async () => {
    const env = envWithRows([], null);
    expect((await handleGetConversation(CONVERSATION_ID, env)).status).toBe(404);
  });

  it("deletes a conversation and reports 404 when already gone", async () => {
    const deleted = envWithRows([], null, { success: true, meta: { changes: 1 } });
    expect((await handleDeleteConversation(CONVERSATION_ID, deleted)).status).toBe(204);

    const missing = envWithRows([], null, { success: true, meta: { changes: 0 } });
    expect((await handleDeleteConversation(CONVERSATION_ID, missing)).status).toBe(404);
  });
});
