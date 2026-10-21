import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PANEL_WIDTH, clampWidth } from "./layout";

describe("clampWidth", () => {
  const { min, max, default: def } = PANEL_WIDTH.left;
  it("範囲内の値はそのまま（小数は丸める）", () => {
    assert.equal(clampWidth(300, min, max, def), 300);
    assert.equal(clampWidth(300.6, min, max, def), 301);
  });
  it("範囲外は端に収める", () => {
    assert.equal(clampWidth(10, min, max, def), min);
    assert.equal(clampWidth(99999, min, max, def), max);
    assert.equal(clampWidth(-5, min, max, def), min);
    assert.equal(clampWidth(Infinity, min, max, def), def);
  });
  it("数値でない値は既定値", () => {
    for (const v of ["300", null, undefined, NaN, {}, []]) assert.equal(clampWidth(v, min, max, def), def, String(v));
  });
  it("既定値は範囲に収まっている", () => {
    for (const p of [PANEL_WIDTH.left, PANEL_WIDTH.right]) assert.ok(p.default >= p.min && p.default <= p.max);
  });
});

import { CENTER_MIN_WIDTH, fitPanelWidths } from "./layout";

describe("fitPanelWidths", () => {
  const L = (width: number, visible = true) => ({ width, visible });

  it("ウィンドウが十分に広ければ、指定の幅のまま", () => {
    assert.deepEqual(fitPanelWidths(1600, L(300), L(340)), { left: 300, right: 340 });
  });

  it("狭いときは、中央に最小幅を残すよう左右を縮める", () => {
    const fit = fitPanelWidths(1038, L(300), L(340));
    const center = 1038 - fit.left - fit.right - 2;
    assert.ok(center >= CENTER_MIN_WIDTH, `中央 ${center}px`);
    assert.ok(fit.left >= 240 && fit.right >= 280);
  });

  it("まず左から削り、左が最小幅になったら右を削る", () => {
    const fit = fitPanelWidths(1000, L(480), L(560));
    assert.equal(fit.left, 240);
    assert.ok(fit.right >= 280);
  });

  it("それでも足りなければ、最小幅で止める（中央が最小幅を割ることは許容する）", () => {
    assert.deepEqual(fitPanelWidths(600, L(300), L(340)), { left: 240, right: 280 });
  });

  it("非表示のパネルは幅に数えない（保存された幅はそのまま返す）", () => {
    // 右 340 + 境界 1 + 中央 420 = 761 <= 800 なので、縮める必要はない
    assert.deepEqual(fitPanelWidths(800, L(300, false), L(340)), { left: 300, right: 340 });
  });

  it("非表示のパネルがあっても、残りのパネルは中央の最小幅を守るよう縮む", () => {
    // 右 340 + 境界 1 + 中央 420 = 761 > 700 なので、右を 61px 削って 279 → 最小幅 280 で止まる
    assert.deepEqual(fitPanelWidths(700, L(300, false), L(340)), { left: 300, right: 280 });
  });

  it("元の値は変更しない", () => {
    const left = L(300);
    fitPanelWidths(900, left, L(340));
    assert.equal(left.width, 300);
  });
});

import { maxPanelWidth } from "./layout";

describe("maxPanelWidth", () => {
  it("広い画面では、パネル自身の最大幅まで広げられる", () => {
    assert.equal(maxPanelWidth("left", 2400, { width: 340, visible: true }), 480);
    assert.equal(maxPanelWidth("right", 2400, { width: 300, visible: true }), 560);
  });

  it("狭い画面では、もう片側と中央の最小幅を除いた残りが上限になる", () => {
    // 1038 - (1 + 340 + 1 + 420) = 276
    assert.equal(maxPanelWidth("left", 1038, { width: 340, visible: true }), 276);
    // 1038 - (1 + 300 + 1 + 420) = 316
    assert.equal(maxPanelWidth("right", 1038, { width: 300, visible: true }), 316);
  });

  it("もう片側が非表示なら、そのぶんも使える", () => {
    // 1038 - (1 + 420) = 617 → パネルの最大幅 480 で頭打ち
    assert.equal(maxPanelWidth("left", 1038, { width: 340, visible: false }), 480);
  });

  it("極端に狭くても、最小幅を下回らない", () => {
    assert.equal(maxPanelWidth("left", 500, { width: 340, visible: true }), 240);
    assert.equal(maxPanelWidth("right", 500, { width: 300, visible: true }), 280);
  });
});
