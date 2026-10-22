import assert from "node:assert/strict";
import fs from "node:fs";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { BeeperRecipientInput } from "../../../shared/types";
import { resolveChatRecipient, sendChatMessage, setChatDraft } from "./beeper";

const chat = { id: "!real:beeper.local", title: "相手", network: "LINE" };
const recipient = { chat: chat.title, chatID: chat.id, network: chat.network };
let calls: { path: string; method: string; body?: unknown }[];
let reply: (path: string) => unknown;

beforeEach(() => {
  calls = [];
  reply = () => chat;
  // 実ユーザーのトークンは読まず、外部サービスへも接続しない。
  mock.method(fs, "readFileSync", () => JSON.stringify({ token: "test-token" }));
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? "GET";
    calls.push({ path, method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    return Response.json(method === "GET" ? reply(path) : { chatID: chat.id, pendingMessageID: "test-message" });
  });
});

afterEach(() => mock.restoreAll());

describe("Beeper の送信先照合", () => {
  for (const operation of [sendChatMessage, setChatDraft]) {
    it(`${operation.name}: 表示名と ID が別の相手なら書き込まない`, async () => {
      await assert.rejects(() => operation({ ...recipient, chat: "別の相手" }, "非公開の本文"), /一致/);
      assert.ok(calls.every((c) => c.method === "GET"));
    });

    it(`${operation.name}: サービス名が変わっていたら書き込まない`, async () => {
      await assert.rejects(() => operation({ ...recipient, network: "別のサービス" }, "本文"), /一致/);
      assert.ok(calls.every((c) => c.method === "GET"));
    });

    it(`${operation.name}: ID のみ・空 ID・不正な型を受け付けない`, async () => {
      for (const input of [{ chatID: chat.id }, { chat: " ", chatID: chat.id },
        { chat: chat.title, chatID: " " }, { chat: chat.title, chatID: 12 },
        { ...recipient, network: null }]) {
        await assert.rejects(() => operation(input as BeeperRecipientInput, "本文"), /送信先/);
      }
      assert.deepEqual(calls, []);
    });

    it(`${operation.name}: 異なる ID や不正な応答を信用しない`, async () => {
      for (const response of [{ ...chat, id: "別のID" }, { ...chat, network: null }, null]) {
        reply = () => response;
        await assert.rejects(() => operation(recipient, "本文"), /一致/);
      }
      assert.ok(calls.every((c) => c.method === "GET"));
    });

    it(`${operation.name}: 解決失敗時はフォールバックして書き込まない`, async () => {
      reply = () => { throw new Error("接続できない"); };
      await assert.rejects(() => operation(recipient, "本文"), /接続/);
      assert.ok(calls.every((c) => c.method === "GET"));
    });

    it(`${operation.name}: 名前が一致する明示 ID への操作を維持する`, async () => {
      assert.deepEqual(await operation(recipient, "本文"), { chatTitle: chat.title, network: chat.network });
      assert.deepEqual(calls, [
        { path: `/v1/chats/${encodeURIComponent(chat.id)}`, method: "GET" },
        { path: `/v1/chats/${encodeURIComponent(chat.id)}${operation === sendChatMessage ? "/messages" : ""}`,
          method: operation === sendChatMessage ? "POST" : "PATCH",
          body: operation === sendChatMessage ? { text: "本文" } : { draft: { text: "本文" } } },
      ]);
    });

    it(`${operation.name}: ID のない既存の返信案も一意な相手なら使える`, async () => {
      reply = (path) => path === "/v1/chats" ? { items: [chat] } : chat;
      assert.deepEqual(await operation({ chat: chat.title }, "本文"), { chatTitle: chat.title, network: chat.network });
      assert.equal(calls[0].path, "/v1/chats");
      assert.equal(calls[1].path, `/v1/chats/${encodeURIComponent(chat.id)}`);
      assert.equal(calls.length, 3);
    });

    it(`${operation.name}: 名前だけで複数の相手に一致したら拒否する`, async () => {
      reply = () => ({ items: [chat, { ...chat, id: "another-id" }] });
      await assert.rejects(() => operation({ chat: chat.title }, "本文"), /複数/);
      assert.ok(calls.every((c) => c.method === "GET"));
    });

    it(`${operation.name}: 事前確認後の名前変更も操作直前に検出する`, async () => {
      await resolveChatRecipient(recipient);
      reply = () => ({ ...chat, title: "変更された相手" });
      await assert.rejects(() => operation(recipient, "本文"), /一致/);
      assert.ok(calls.every((c) => c.method === "GET"));
    });
  }

  it("表示用の名前・サービス名・ID は Beeper の応答から返す", async () => {
    assert.deepEqual(await resolveChatRecipient(recipient), chat);
    assert.ok(calls.every((c) => c.method === "GET"));
  });

  it("同名の別チャットがあっても明示 ID は名前検索に置き換えない", async () => {
    reply = (path) => {
      assert.notEqual(path, "/v1/chats");
      return chat;
    };
    await sendChatMessage(recipient, "本文");
    assert.equal(calls.at(-1)?.method, "POST");
  });

  it("特殊文字を含む ID は URL パスとしてエンコードする", async () => {
    const special = { ...chat, id: "!a/b?x#y%:beeper.local" };
    reply = () => special;
    await sendChatMessage({ ...recipient, chatID: special.id }, "本文");
    assert.equal(calls[0].path, `/v1/chats/${encodeURIComponent(special.id)}`);
    assert.equal(calls[1].path, `${calls[0].path}/messages`);
  });

  it("既存の下書きは上書きしない", async () => {
    reply = () => ({ ...chat, draft: { text: "書きかけ" } });
    await assert.rejects(() => setChatDraft(recipient, "本文"), /すでに下書き/);
    assert.ok(calls.every((c) => c.method === "GET"));
  });

  it("名前検索で不正な ID が返っても書き込まない", async () => {
    reply = () => ({ items: [{ ...chat, id: undefined }] });
    await assert.rejects(() => sendChatMessage({ chat: chat.title }, "本文"), /ID が不正/);
    assert.equal(calls.length, 1);
  });
});
