// 執行：node --test meihua/tests/
const test = require("node:test");
const assert = require("node:assert");
const C = require("../js/core.js");
const D = require("../js/data-meihua.js");
const Z = require("../js/data-zhouyi.js");

test("取數：卦以八除、爻以六除，除盡取坤／上爻（p.13）", () => {
  assert.equal(C.mod8(8), 8); assert.equal(C.mod8(16), 8); assert.equal(C.mod8(9), 1);
  assert.equal(C.mod6(6), 6); assert.equal(C.mod6(12), 6); assert.equal(C.mod6(7), 1);
});

test("《梅花易數》〈觀梅占〉（p.32）：辰年十二月十七日申時 → 澤火革，初爻動，互乾巽，變咸", () => {
  const r = C.fromYMDH(5, 12, 17, 9);        // 辰=5、十二月、十七日、申=9
  assert.equal(r.upper, 2);                  // 34 ÷ 8 餘 2 → 兌
  assert.equal(r.lower, 3);                  // 43 ÷ 8 餘 3 → 離
  assert.equal(r.dong, 1);                   // 43 ÷ 6 餘 1 → 初爻
  const h = C.buildHexagram(r.upper, r.lower, r.dong);
  assert.equal(h.name.ben, "澤火革");
  assert.equal(h.hu.upper, 1);               // 互見乾
  assert.equal(h.hu.lower, 5);               // 互見巽
  assert.equal(h.name.bian, "澤山咸");       // 初爻變咸
  assert.equal(h.tiId, 2);                   // 動爻在下卦（離）→ 離為用，兌為體
  assert.equal(h.yongId, 3);
  const rel = C.relation(D.TRIGRAMS[h.tiId].elem, D.TRIGRAMS[h.yongId].elem);
  assert.equal(rel.key, "yongKe");           // 書：「兌金為體，離火克之」
});

test("64 卦編號唯一，且名稱與經文資料一致", () => {
  const seen = new Set();
  for (let u = 1; u <= 8; u++) for (let l = 1; l <= 8; l++) {
    const n = Z.HEX_NUM[u - 1][l - 1];
    assert.ok(n >= 1 && n <= 64); seen.add(n);
    assert.ok(Z.HEXAGRAMS[n - 1].full);
  }
  assert.equal(seen.size, 64);
});

test("每卦六爻的爻位名稱與陰陽（九／六）都與卦結構相符", () => {
  const POS = ["初", "二", "三", "四", "五", "上"];
  for (let u = 1; u <= 8; u++) for (let l = 1; l <= 8; l++) {
    const h = C.buildHexagram(u, l, 1);
    const info = Z.HEXAGRAMS[h.num.ben - 1];
    const six = info.yao.filter(y => y.pos !== "用九" && y.pos !== "用六");
    assert.equal(six.length, 6, info.full);
    six.forEach((y, k) => {
      const p = y.pos;
      const isYang = (k === 0 || k === 5) ? p[1] === "九" : p[0] === "九";
      const posOk = (k === 0 || k === 5) ? p[0] === POS[k] : p[1] === POS[k];
      assert.ok(posOk, info.full + " " + p);
      assert.equal(isYang, h.lines[k] === 1, info.full + " " + p);
      assert.ok(y.text && y.xiang, info.full + " " + p);
    });
  }
  assert.equal(Z.HEXAGRAMS.reduce((a, h) => a + h.yao.length, 0), 386); // 384 + 用九 + 用六
});

test("乾為天動上爻 → 澤天夬；乾坤純卦有旗標", () => {
  const h = C.buildHexagram(1, 1, 6);
  assert.equal(h.name.ben, "乾為天"); assert.equal(h.name.bian, "澤天夬"); assert.ok(h.pureQianKun);
  assert.ok(!C.buildHexagram(1, 2, 1).pureQianKun);
});

test("時辰地支：23–1 時子，11–13 時午", () => {
  assert.equal(C.branchOfHour(23), 1); assert.equal(C.branchOfHour(0), 1);
  assert.equal(C.branchOfHour(1), 2); assert.equal(C.branchOfHour(11), 7); assert.equal(C.branchOfHour(12), 7);
  assert.equal(C.branchOfHour(21), 12); assert.equal(C.branchOfHour(22), 12);
});

test("太陽黃經：2024 立春(315°)、春分(0°)、夏至(90°) 誤差 < 0.05°", () => {
  const d = (iso) => new Date(iso);
  const diff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  assert.ok(diff(C.sunLongitude(d("2024-02-04T16:27:00+08:00")), 315) < 0.05);
  assert.ok(diff(C.sunLongitude(d("2024-03-20T11:06:00+08:00")), 0) < 0.05);
  assert.ok(diff(C.sunLongitude(d("2024-06-21T04:51:00+08:00")), 90) < 0.05);
});

test("節氣月令：立春前為丑月、立春後為寅月；2026-11-19 為亥月（冬）", () => {
  assert.equal(C.monthContext(new Date("2024-02-04T16:00:00+08:00"), "solar").branch, "丑");
  assert.equal(C.monthContext(new Date("2024-02-04T17:00:00+08:00"), "solar").branch, "寅");
  const m = C.monthContext(new Date("2026-11-19T10:00:00+08:00"), "solar");
  assert.equal(m.branch, "亥"); assert.equal(m.season, "winter"); assert.equal(m.termName, "立冬");
});

test("農曆換算：2026-11-19 為丙午年十月十一；閏月可辨識", () => {
  const l = C.lunarInfo(new Date("2026-11-19T10:00:00+08:00"));
  assert.equal(l.month, 10); assert.equal(l.day, 11); assert.equal(l.ganzhi, "丙午"); assert.equal(l.yearBranchNum, 7);
  const leap = C.lunarInfo(new Date("2023-04-10T10:00:00+08:00")); // 2023 閏二月
  assert.equal(leap.isLeap, true); assert.equal(leap.month, 2);
});

test("農曆月令模式：正月建寅", () => {
  const m = C.monthContext(new Date("2026-11-19T10:00:00+08:00"), "lunar");
  assert.equal(m.branch, "亥"); // 農曆十月 → 亥
});

test("旺相休囚死表：每季五行各占一態，且旺者為當令", () => {
  Object.keys(D.WANGXIANG).forEach(s => {
    const st = Object.values(D.WANGXIANG[s]).sort().join("");
    assert.equal(st, ["旺", "相", "休", "囚", "死"].sort().join(""));
  });
  assert.equal(C.stateOf("木", "spring"), "旺"); assert.equal(C.stateOf("土", "spring"), "死");
});

test("八卦 × 六爻 × 五季節：分析不報錯，分數有限", () => {
  const when = new Date("2026-11-19T10:00:00+08:00");
  const seasons = Object.keys(D.WANGXIANG);
  for (let u = 1; u <= 8; u++) for (let l = 1; l <= 8; l++) for (let d = 1; d <= 6; d++) {
    const h = C.buildHexagram(u, l, d);
    seasons.forEach(s => {
      const a = C.analyze(h, { season: s, seasonName: D.SEASON_NAMES[s] });
      assert.ok(Number.isFinite(a.total)); assert.ok(a.level);
    });
  }
  assert.ok(when);
});

test("起卦：三數（總和／第三數）、物數占、手動", () => {
  const a = C.fromNumbers(12, 23, 35, "sum");   // 上 12%8=4 震、下 23%8=7 艮、動 70%6=4
  assert.equal(a.upper, 4); assert.equal(a.lower, 7); assert.equal(a.dong, 4);
  const b = C.fromNumbers(12, 23, 35, "third"); // 動 35%6=5
  assert.equal(b.dong, 5);
  const o = C.fromObject(8, new Date("2026-11-19T10:00:00+08:00")); // 巳時=6；上 坤(8)、下 6=坎、動 14%6=2
  assert.equal(o.upper, 8); assert.equal(o.lower, 6); assert.equal(o.dong, 2);
  assert.equal(C.fromManual(1, 2, 3).dong, 3);
});

test("fromDate 與 cast 端到端", () => {
  const when = new Date("2026-11-19T10:00:00+08:00"); // 丙午年(7) 十月十一 巳時(6)
  const r = C.fromDate(when);
  assert.equal(r.input.y, 7); assert.equal(r.input.m, 10); assert.equal(r.input.d, 11); assert.equal(r.input.h, 6);
  assert.equal(r.upper, C.mod8(28)); assert.equal(r.lower, C.mod8(34)); assert.equal(r.dong, C.mod6(34));
  const c = C.cast(r, when, "solar");
  assert.ok(c.analysis.level); assert.equal(c.month.branch, "亥");
});

test("彖傳：64 卦皆有，且校訂已生效（依《周易正義》核對）", () => {
  assert.ok(Z.HEXAGRAMS.every(h => h.tuan && h.tuan.length > 10));
  const byName = n => Z.HEXAGRAMS.find(h => h.name === n);
  assert.ok(byName("離").daxiang.includes("照于四方"));
  assert.ok(!byName("離").daxiang.includes("照四於方"));
  assert.equal(byName("咸").yao[4].xiang, "咸其脢，志末也。");
  assert.ok(byName("小畜").yao[5].text.includes("月幾望") && byName("小畜").yao[5].note);
  assert.ok(byName("中孚").yao[3].text.includes("月幾望"));
  // 與《周易正義》掃描逐字核對過的三則彖傳（離 p.158、咸 p.163-164、小畜 p.69）
  const np = t => t.replace(/[。，、；：？！「」\s]/g, ""); // 標點依維基文庫，故只比對文字
  assert.equal(np(byName("離").tuan), np("離，麗也。日月麗乎天，百穀草木麗乎土。重明以麗乎正，乃化成天下。柔麗乎中正，故亨，是以畜牝牛，吉也。"));
  assert.equal(np(byName("小畜").tuan), np("小畜，柔得位而上下應之，曰小畜。健而巽，剛中而志行，乃亨。密雲不雨，尚往也；自我西郊，施未行也。"));
  assert.ok(np(byName("咸").tuan).startsWith(np("咸，感也。柔上而剛下，二氣感應以相與。止而說，男下女，是以亨利貞取女吉也。")));
});

test("日干支：2000-01-01 戊午、2024-02-10（春節）甲辰", () => {
  assert.equal(C.dayGanzhi(new Date("2000-01-01T12:00:00+08:00")).ganzhi, "戊午");
  assert.equal(C.dayGanzhi(new Date("2024-02-10T12:00:00+08:00")).ganzhi, "甲辰");
  assert.equal(C.dayGanzhi(new Date("2024-02-10T00:30:00+08:00")).ganzhi, "甲辰"); // 臺北 00:00 換日
  assert.equal(C.dayGanzhi(new Date("2024-02-09T23:30:00+08:00")).ganzhi, "癸卯");
});

test("十應：天時應與書中〈復明天時之應〉（p.113）一致 —— 天朗無雲（乾）時", () => {
  // 書：乾、兌為體則比和而吉；坎為體則逢生而大吉；坤、艮為體則洩氣；震、巽為體則見克而不吉
  const when = new Date("2026-11-19T10:00:00+08:00");
  const want = { 1: "bihe", 2: "bihe", 6: "yongSheng", 8: "tiSheng", 7: "tiSheng", 4: "yongKe", 5: "yongKe" };
  Object.keys(want).forEach(tiId => {
    // 造一個體卦為 tiId 的卦：動爻在下卦(1爻)，上卦即為體
    const h = C.buildHexagram(+tiId, 3, 1);
    const y = C.analyzeYing(h, when, { weather: "天朗無雲（乾）" });
    const it = y.items.find(i => i.key === "weather");
    assert.equal(it.rel.key, want[tiId], "體=" + D.TRIGRAMS[tiId].name);
  });
});

test("十應：方應、地理、人事、外應與刻應；內外合斷", () => {
  const when = new Date("2026-11-19T10:00:00+08:00");
  const h = C.buildHexagram(2, 3, 1);                       // 兌上離下，動初爻 → 體兌金、用離火
  const y = C.analyzeYing(h, when, { dir: "南", people: "老人、父、尊長（乾）", object: "坎：水、雨雪、魚鹽酒、黑色之物", omen: "bad" });
  const get = k => y.items.find(i => i.key === k);
  assert.equal(get("dir").rel.key, "yongKe");               // 南=離火 剋 兌金
  assert.equal(get("people").rel.key, "bihe");              // 乾金 比和
  assert.equal(get("object").rel.key, "tiSheng");           // 兌金生坎水 → 洩
  assert.equal(get("omen").score, -1);
  assert.ok(y.items.find(i => i.key === "day"));            // 日應永遠有
  const c = C.combineInnerOuter({ total: -3 }, { outerLevel: "吉" });
  assert.ok(c.text.includes("凶中有解"));
  assert.ok(C.combineInnerOuter({ total: 3 }, { outerLevel: "吉" }).text.includes("斷然吉"));
  assert.ok(C.combineInnerOuter({ total: 3 }, { outerLevel: "凶" }).text.includes("吉事反被破壞"));
  assert.ok(C.combineInnerOuter({ total: -3 }, { outerLevel: "凶" }).text.includes("斷然凶"));
});

test("cast 帶出十應（無輸入時只有日應）", () => {
  const when = new Date("2026-11-19T10:00:00+08:00");
  const c = C.cast(C.fromManual(2, 3, 1), when, "solar");
  assert.equal(c.ying.items.length, 1); assert.equal(c.ying.items[0].key, "day");
  assert.ok(c.ying.combined.text);
});

test("字占：十一字以上依字數（書中 77 字範例，p.21）", () => {
  const r = C.fromCharCount(Array.from({ length: 77 }, (_, i) => "字"));
  assert.equal(r.upper, 6);  // 38 ÷ 8 餘 6 → 坎
  assert.equal(r.lower, 7);  // 39 ÷ 8 餘 7 → 艮
  assert.equal(r.dong, 5);   // 77 ÷ 6 餘 5
  assert.equal(C.buildHexagram(r.upper, r.lower, r.dong).name.ben, "水山蹇");
  assert.equal(C.fromCharCount(Array(11).fill("字")).upper, 5); // 11 字：上 5、下 6
});

test("字占：一字、二字、三字（筆畫）與四至十字（聲調）", () => {
  const one = C.fromOneChar("明", 4, 4); assert.equal(one.upper, 4); assert.equal(one.lower, 4); assert.equal(one.dong, 2);
  const two = C.fromCharStrokes(["天", "地"], [4, 6]);     // 上 4 震、下 6 坎、總 10 → 4
  assert.deepEqual([two.upper, two.lower, two.dong], [4, 6, 4]);
  const three = C.fromCharStrokes(["a", "b", "c"], [3, 4, 5]); // 上 3、下 9→1、總 12→6
  assert.deepEqual([three.upper, three.lower, three.dong], [3, 1, 6]);
  const four = C.fromCharTones(["一", "二", "三", "四"], [1, 2, 3, 4]); // 前二和 3、後二和 7、總 10→4
  assert.deepEqual([four.upper, four.lower, four.dong], [3, 7, 4]);
  const five = C.fromCharTones(Array(5).fill("字"), [1, 1, 2, 2, 2]); // 前二 2、後三 6
  assert.deepEqual([five.upper, five.lower, five.dong], [2, 6, 2]);
  const ten = C.fromCharTones(Array(10).fill("字"), Array(10).fill(1)); // 5 + 5 → 都是 5；總 10→4
  assert.deepEqual([ten.upper, ten.lower, ten.dong], [5, 5, 4]);
});

test("字占：取字與字數分流", () => {
  assert.deepEqual(C.hanChars("你好，World 123！梅花。"), ["你", "好", "梅", "花"]);
  assert.deepEqual([0, 1, 2, 3, 4, 10, 11, 50].map(C.charMethodFor), ["none", "single", "stroke", "stroke", "tone", "tone", "count", "count"]);
});

test("字占資料表：康熙筆畫與古四聲抽樣", () => {
  const Zi = require("../js/data-zi.js");
  const want = { 花: 10, 梅: 11, 湖: 13, 學: 16, 萬: 15, 凶: 4, 乾: 11, 坤: 8, 天: 4, 地: 6 };
  Object.keys(want).forEach(c => assert.equal(Zi.strokes[c], want[c], c));
  const tone = { 天: "1", 地: "3", 人: "1", 吉: "4", 一: "4", 二: "3", 五: "2", 九: "2", 十: "4", 梅: "1", 學: "4" };
  Object.keys(tone).forEach(c => assert.equal(Zi.tones[c], tone[c], c));
  assert.ok(Zi.tones["易"].includes("3") && Zi.tones["易"].includes("4")); // 多音字列出全部可能
});

test("卦應詳細類象：八卦齊全、結構完整、與簡表五行方位一致", () => {
  const G = require("../js/data-guaying.js");
  assert.deepEqual(Object.keys(G).map(Number).sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  Object.keys(G).forEach(id => {
    const g = G[id];
    assert.equal(g.name, D.TRIGRAMS[id].name);
    assert.ok(g.intro.length > 30, g.name);
    assert.ok(g.entries.length >= 18, g.name + " 條目數 " + g.entries.length);
    g.entries.forEach(e => assert.ok(e.length === 2 && e[0] && e[1], g.name + " " + e[0]));
    assert.ok(!/[一-鿿]*[发动门]/.test(g.entries.map(e => e.join("")).join("")), g.name + " 含簡體字"); // 發動門
  });
  const find = (id, cat) => G[id].entries.find(e => e[0] === cat)[1];
  assert.ok(find(1, "穀果").includes("龍眼"));
  assert.ok(find(6, "禽獸").includes("豕"));
  assert.ok(find(3, "方所") === "正南" && find(2, "方所") === "西方" && find(4, "方所") === "正東" && find(6, "方所").startsWith("正北"));
});

test("綜合吉凶：外應只調整一級，並且有上下限；未填外應不調整", () => {
  const mk = (level, outerLevel, answered) => C.combineOverall({ level }, { outerLevel, answered, combined: { text: "x" } });
  assert.equal(mk("吉", "凶", 2).level, "小吉");     // 內吉外凶：吉被破
  assert.equal(mk("小凶", "吉", 1).level, "平");     // 內凶外吉：凶可解
  assert.equal(mk("吉", "吉", 1).level, "大吉");     // 內外皆吉
  assert.equal(mk("凶", "凶", 1).level, "大凶");     // 內外皆凶
  assert.equal(mk("大吉", "吉", 1).level, "大吉");   // 上限
  assert.equal(mk("大凶", "凶", 1).level, "大凶");   // 下限
  assert.equal(mk("吉", "平", 1).level, "吉");       // 外應平：不動
  const none = mk("吉", "凶", 0);                    // 沒填外應（只有日應）：不調整
  assert.equal(none.level, "吉"); assert.equal(none.applied, false); assert.equal(none.shift, 0);
  assert.equal(C.levelTone("大吉"), "good"); assert.equal(C.levelTone("平"), "warn"); assert.equal(C.levelTone("小凶"), "bad");
  assert.deepEqual(["大吉", "平", "凶"].map(C.levelSymbol), ["▲", "●", "▼"]);
});

test("cast 帶出單一綜合結論與白話理由（四條，含體用、變化、月令、外應）", () => {
  const when = new Date("2026-11-19T10:00:00+08:00");
  const c = C.cast(C.fromManual(2, 3, 1), when, "solar");       // 澤火革初爻：體兌金、用離火 → 用剋體
  assert.ok(C.LADDER.includes(c.overall.level));
  assert.equal(c.overall.inner, c.analysis.level);
  assert.equal(c.summary.reasons.length, 4);
  assert.deepEqual(c.summary.reasons.map(r => r.label), ["體用", "變化", "月令", "外應"]);
  assert.ok(c.summary.headline.includes(c.overall.level));
  assert.ok(c.summary.reasons[0].text.includes("用剋體"));
  // 填了外應就可能調整；結論永遠只有一個
  const c2 = C.cast(C.fromManual(2, 3, 1), when, "solar", { people: "老人、父、尊長（乾）", omen: "good" });
  assert.equal(c2.overall.applied, true);
  assert.ok(c2.overall.shift >= 0);
});

test("一句話：評分與月令旺衰相反時會明講", () => {
  const D2 = require("../js/data-meihua.js");
  let good = 0, bad = 0;
  for (let u = 1; u <= 8; u++) for (let l = 1; l <= 8; l++) for (let d = 1; d <= 6; d++)
    ["2026-02-10", "2026-05-10", "2026-08-10", "2026-11-19"].forEach(day => {
      const c = C.cast(C.fromManual(u, l, d), new Date(day + "T10:00:00+08:00"), "solar");
      const st = c.analysis.tiState, li = C.LADDER.indexOf(c.overall.level), hl = c.summary.headline;
      if (li >= 4 && (st === "囚" || st === "死")) { assert.ok(hl.includes("勿躁進"), hl); good++; }
      else if (li <= 2 && (st === "旺" || st === "相")) { assert.ok(hl.includes("凶勢可緩"), hl); bad++; }
      else assert.ok(!hl.includes("勿躁進") && !hl.includes("凶勢可緩"), hl);
    });
  assert.ok(good > 0 && bad > 0, "兩種情形都要實際出現過：" + good + "/" + bad);
});

test("白話資料：64 卦、每卦爻數與原文一致（乾坤各 7 條）、沒有空白也沒有照抄原文", () => {
  const B = require("../js/data-baihua.js");
  assert.equal(B.HEX.length, 64);
  B.HEX.forEach((h, i) => {
    const z = Z.HEXAGRAMS[i];
    assert.ok(h[0] && h[0].length <= 14, z.full + " 主題");
    assert.ok(h[1] && h[1].length >= 4 && h[1] !== z.guaci, z.full + " 卦辭白話");
    assert.equal(h[2].length, z.yao.length, z.full + " 爻數");
    h[2].forEach((y, k) => { assert.ok(y && y.length >= 4, z.full + " 爻" + (k + 1)); assert.notEqual(y, z.yao[k].text, z.full + " 爻" + (k + 1) + " 與原文相同"); });
  });
  assert.equal(B.HEX[0][2].length, 7); assert.equal(B.HEX[1][2].length, 7);
  Object.keys(D.TRIGRAMS).forEach(id => assert.ok(B.TRI[id] && B.TRI[id].trait, "八卦 " + id));
  C.LADDER.forEach(l => { assert.ok(B.LEVEL[l] && B.ADVICE_LEVEL[l], l); });
  ["旺", "相", "休", "囚", "死"].forEach(s => assert.ok(B.MONTH[s], s));
  ["bihe", "yongSheng", "tiKe", "tiSheng", "yongKe"].forEach(k => assert.ok(B.REL[k] && B.REL[k].head && B.ENDING[k] && B.ENDING_SHORT[k], k));
});

test("白話解讀：384 種卦爻 × 四季都能產生完整、不含文言術語堆疊的結果", () => {
  const seasons = ["2026-02-10", "2026-05-10", "2026-08-10", "2026-11-19"];
  const jargon = /用剋體|體生用|體剋用|用生體|比和|生體|剋體/;       // 分析用語不應直接出現在白話結論卡裡
  seasons.forEach(day => {
    for (let u = 1; u <= 8; u++) for (let l = 1; l <= 8; l++) for (let d = 1; d <= 6; d++) {
      const c = C.cast(C.fromManual(u, l, d), new Date(day + "T10:00:00+08:00"), "solar");
      const p = c.plain;
      assert.ok(p.headline.startsWith("整體「" + c.overall.level + "」"), p.headline);
      assert.ok(!jargon.test(p.headline), "一句話含術語：" + p.headline);
      assert.equal(p.reasons.length, 4);
      p.reasons.forEach(r => { assert.ok(r.text.length > 6 && ["good", "warn", "bad"].includes(r.tone)); assert.ok(!jargon.test(r.text), "理由含術語：" + r.text); });
      assert.ok(p.advice.length >= 2 && p.advice.length <= 5);
      assert.ok(p.stage.includes("第 " + d + " 爻"));
      assert.ok(p.path.ben && p.path.hu && p.path.bian);
    }
  });
});

test("白話解讀：與計算結果一致（外應調整、月令提醒、先吉後凶）", () => {
  const w = new Date("2026-11-19T10:00:00+08:00");
  const none = C.cast(C.fromManual(2, 3, 1), w, "solar");
  assert.ok(none.plain.reasons[3].text.includes("沒有填外在情況"));
  const up = C.cast(C.fromManual(2, 3, 1), w, "solar", { people: "老人、父、尊長（乾）", omen: "good" });
  if (up.overall.shift > 0) assert.ok(up.plain.headline.includes("外在情況也在幫你"));
  // 月令提醒：找一個「偏吉但體卦為囚／死」的組合，一句話與建議都要提到
  let found = 0;
  for (let u = 1; u <= 8 && !found; u++) for (let l = 1; l <= 8 && !found; l++) for (let d = 1; d <= 6 && !found; d++) {
    const c = C.cast(C.fromManual(u, l, d), w, "solar");
    if (C.LADDER.indexOf(c.overall.level) >= 4 && (c.analysis.tiState === "囚" || c.analysis.tiState === "死")) {
      found = 1; assert.ok(c.plain.headline.includes("力量偏弱")); assert.ok(c.plain.advice.some(t => t.includes("時機偏弱")));
    }
  }
  assert.ok(found, "應該要存在偏吉但月令弱的組合");
  assert.equal(C.plainHex(49).theme, "變革"); assert.ok(C.plainHex(49).yao.length === 6);
});

test("白話校對：另有一說資料完整、索引有效，且校訂結果保留（抽樣核對自《周易譯注》的關鍵修正）", () => {
  const B = require("../js/data-baihua.js");
  assert.ok(Object.keys(B.ALT).length >= 80);
  Object.keys(B.ALT).forEach(k => {
    const [n, i] = k.split("-").map(Number);
    assert.ok(n >= 1 && n <= 64 && i >= 0 && i <= Z.HEXAGRAMS[n - 1].yao.length, "ALT 索引 " + k);
    assert.ok(B.ALT[k].length >= 6 && !/^另一種/.test(B.ALT[k]), "ALT 內容過短或帶重複前綴 " + k);
  });
  // 已知先前寫反或寫錯、校對後修正的關鍵爻
  assert.ok(B.HEX[9][2][4].includes("鞋子破裂"));            // 履九五
  assert.ok(B.HEX[11][2][4].includes("脆弱"));               // 否九五：苞桑是脆弱，不是牢靠
  assert.ok(B.HEX[13][2][2].includes("宴席"));               // 大有九三：享宴席，不是獻財
  assert.ok(B.HEX[10][2][1].includes("葫蘆"));               // 泰九二
  assert.ok(B.HEX[5][2][1].includes("三百戶"));              // 訟九二
  assert.ok(B.HEX[54][2][0] && B.HEX[54][2][0].length > 4);
  // 另有一說要出現在 plainHex 取用結果
  const p = C.plainHex(12);
  assert.ok(p.altYao[4].includes("牢靠"));                   // 否九五的傳統讀法
  assert.equal(p.altYao.length, 6);
  assert.ok(C.plainHex(6).altGuaci.includes("俘虜"));
  assert.equal(C.plainHex(1).altGuaci, "");                  // 沒有爭議的不憑空加
});
