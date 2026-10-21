import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBeeperDraft, parseGmailDraft } from "./gmailDraft";

describe("parseGmailDraft", () => {
  it("宛先・件名・本文を読む", () => {
    const d = parseGmailDraft("to: a@example.com\nsubject: Re: 打ち合わせ\n---\nお世話になっております。\n\n以上です。\n");
    assert.deepEqual(d, { to: "a@example.com", subject: "Re: 打ち合わせ", body: "お世話になっております。\n\n以上です。" });
  });

  it("全角コロンと CRLF も読める", () => {
    const d = parseGmailDraft("to：a@example.com\r\nsubject：件名\r\n---\r\n本文");
    assert.deepEqual(d, { to: "a@example.com", subject: "件名", body: "本文" });
  });

  it("宛先が空でも読める（画面で入力する）", () => {
    assert.equal(parseGmailDraft("to:\nsubject: x\n---\n本文")?.to, "");
  });

  it("区切りや本文がなければ下書きとして扱わない", () => {
    assert.equal(parseGmailDraft("to: a@example.com\nsubject: x"), null);
    assert.equal(parseGmailDraft("to: a\n---\n  \n"), null);
  });
});

describe("parseBeeperDraft", () => {
  it("チャット名と文面を読む", () => {
    assert.deepEqual(parseBeeperDraft("chat: 岩元大貴\n---\n自分で作ってるアプリ笑\n2行目"), {
      chat: "岩元大貴",
      text: "自分で作ってるアプリ笑\n2行目",
    });
  });

  it("チャット名か文面がなければ null", () => {
    assert.equal(parseBeeperDraft("---\nこんにちは"), null);
    assert.equal(parseBeeperDraft("chat: A\n---\n "), null);
    assert.equal(parseBeeperDraft("chat: A"), null);
  });
});
