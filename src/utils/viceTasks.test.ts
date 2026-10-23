import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseViceTaskProposals } from "./viceTasks";

describe("parseViceTaskProposals", () => {
  it("有効な候補を読む", () => {
    assert.deepEqual(
      parseViceTaskProposals('[{"title":"請求書を作る","category":"経理","description":"freeeで下書きを作成","scheduledOn":"2026-10-24"}]'),
      [{ title: "請求書を作る", category: "経理", description: "freeeで下書きを作成", scheduledOn: "2026-10-24" }],
    );
  });

  it("不正な JSON・必須項目・日付を拒否する", () => {
    assert.equal(parseViceTaskProposals("["), null);
    assert.equal(parseViceTaskProposals('[{"category":"生活","description":"x"}]'), null);
    assert.equal(parseViceTaskProposals('[{"title":"x","category":"生活","description":"","scheduledOn":"tomorrow"}]'), null);
  });
  it("project and assignee", () => {
    const result = parseViceTaskProposals('[{"title":"task","category":"work","project":"PM Hub","assignee":"ai","description":"next"}]');
    assert.equal(result?.[0].project, "PM Hub");
    assert.equal(result?.[0].assignee, "ai");
    assert.equal(parseViceTaskProposals('[{"title":"task","category":"work","assignee":"other","description":"next"}]'), null);
  });
});
