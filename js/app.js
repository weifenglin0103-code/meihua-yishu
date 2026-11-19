/* 梅花易數排盤：介面與資料儲存 */
(function () {
  "use strict";
  var C = window.MeihuaCore, D = window.MeihuaData, Z = window.ZhouyiData;
  var T = D.TRIGRAMS;

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // ---------- 設定（localStorage，可能被瀏覽器禁用，全部 try/catch）----------
  var PREFS_KEY = "meihua.prefs.v1", HIST_KEY = "meihua.history.v1";
  var SHOW_ITEMS = [
    ["steps", "起卦計算過程"], ["text", "本卦卦辭、大象、動爻爻辭與小象"], ["tuan", "彖傳（解釋卦辭）"], ["extra", "互卦、變卦的卦辭"],
    ["tiyong", "體用生剋表"], ["month", "月令旺衰（旺相休囚死）"], ["verdict", "綜合斷語與評分明細"], ["ying", "十應（外應）與內外合斷"],
    ["xiang", "體卦、用卦的類象"], ["sources", "原書依據頁碼"]
  ];
  var DEFAULT_PREFS = {
    monthMode: "solar", dongMode: "sum", autosave: true,
    show: { steps: true, text: true, tuan: true, extra: false, tiyong: true, month: true, verdict: true, ying: true, xiang: false, sources: false }
  };
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function loadPrefs() {
    var p = JSON.parse(JSON.stringify(DEFAULT_PREFS));
    try {
      var s = JSON.parse(lsGet(PREFS_KEY) || "null");
      if (s) { Object.assign(p, s, { show: Object.assign(p.show, s.show || {}) }); }
    } catch (e) { /* 用預設 */ }
    return p;
  }
  var prefs = loadPrefs();
  function savePrefs() { lsSet(PREFS_KEY, JSON.stringify(prefs)); }

  // ---------- 臺北時間輔助 ----------
  function nowLocalInputValue() {
    var p = C.zonedParts(new Date());
    return p.year + "-" + pad(p.month) + "-" + pad(p.day) + "T" + pad(p.hour) + ":" + pad(p.minute);
  }
  function dateFromLocalInput(v) { // 輸入視為臺北時間（UTC+8）
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v || "");
    if (!m) return null;
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5]));
  }

  // ---------- 起卦方式 ----------
  var METHODS = [
    ["number", "數字起卦"], ["time", "時間起卦"], ["char", "字占"], ["object", "物數／聲音"], ["random", "隨機起卦"], ["manual", "手動指定"]
  ];
  var METHOD_LABEL = {}; METHODS.forEach(function (m) { METHOD_LABEL[m[0]] = m[1]; });
  var method = "number";

  function trigramOptions(sel) {
    return Object.keys(T).map(function (id) {
      return '<option value="' + id + '"' + (+id === sel ? " selected" : "") + ">" + T[id].name + "（" + T[id].nature + "·" + id + "）</option>";
    }).join("");
  }

  function renderTabs() {
    $("#method-tabs").innerHTML = METHODS.map(function (m) {
      return '<button type="button" role="tab" data-m="' + m[0] + '" aria-pressed="' + (m[0] === method) + '">' + m[1] + "</button>";
    }).join("");
  }

  function renderForm() {
    var f = $("#method-form"), h = "";
    if (method === "number") {
      h = '<div class="grid3">' +
        '<label>第一數（上卦）<input id="n1" type="number" min="1" step="1" inputmode="numeric" placeholder="如 12"></label>' +
        '<label>第二數（下卦）<input id="n2" type="number" min="1" step="1" inputmode="numeric" placeholder="如 23"></label>' +
        '<label>第三數（動爻）<input id="n3" type="number" min="1" step="1" inputmode="numeric" placeholder="如 35"></label></div>' +
        '<div class="row"><label class="grow">動爻算法<select id="dongMode">' +
        '<option value="sum"' + (prefs.dongMode === "sum" ? " selected" : "") + '>三數總和 ÷ 6 取餘（依原書「以重卦總數除六」）</option>' +
        '<option value="third"' + (prefs.dongMode === "third" ? " selected" : "") + '>只用第三數 ÷ 6 取餘</option></select></label>' +
        '<button type="button" id="fill-random">🎲 隨機填入</button></div>' +
        '<p class="muted">上卦＝第一數÷8，下卦＝第二數÷8，餘 0 取坤（8）。動爻餘 0 取上爻（6）。（p.13）</p>';
    } else if (method === "time") {
      h = '<div class="row"><label class="inline"><input type="radio" name="when" value="now" checked> 現在</label>' +
        '<label class="inline"><input type="radio" name="when" value="custom"> 指定時間（臺北時間）</label>' +
        '<label class="grow"><input id="when-input" type="datetime-local" value="' + nowLocalInputValue() + '" disabled></label></div>' +
        '<p class="muted" id="time-preview"></p>' +
        '<p class="muted">年月日（地支序＋農曆月＋農曆日）為上卦；再加時辰數為下卦；四者總數÷6 取動爻。（p.14）</p>';
    } else if (method === "object") {
      h = '<div class="row"><label class="grow">物數或聲數（例如看到的花瓣數、聽到的敲擊聲數）' +
        '<input id="obj-n" type="number" min="1" step="1" inputmode="numeric" placeholder="如 5"></label></div>' +
        '<p class="muted">所得數字為上卦，起卦當下的時辰數為下卦，兩數相加÷6 取動爻。（p.15）時間以現在的臺北時間為準。</p>';
    } else if (method === "char") {
      h = '<label>起卦用字（例如來問的人寫下的字、名字、或一句話；只取漢字）' +
        '<textarea id="zi-text" rows="2" maxlength="600" placeholder="例如：求職順利"></textarea></label>' +
        '<div class="row"><button type="button" id="zi-from-question">用「占問事由」</button><span class="muted" id="zi-count"></span></div>' +
        '<div id="zi-detail"></div>' +
        '<p class="muted">依《梅花易數》字占（p.15-22）：1 字拆左右畫；2–3 字數筆畫（康熙字典）；4–10 字改用古四聲（平上去入＝1–4）；11 字以上只數字數。</p>';
    } else if (method === "random") {
      h = '<p class="muted">由瀏覽器產生三個 1–999 的隨機數，再依「數字起卦（三數總和）」排盤。</p>';
    } else {
      h = '<div class="grid3">' +
        '<label>上卦<select id="m-upper">' + trigramOptions(1) + "</select></label>" +
        '<label>下卦<select id="m-lower">' + trigramOptions(2) + "</select></label>" +
        '<label>動爻<select id="m-dong">' + [1, 2, 3, 4, 5, 6].map(function (d) { return '<option value="' + d + '">第 ' + d + " 爻</option>"; }).join("") + "</select></label></div>" +
        '<p class="muted">用來重排已知的卦，或練習驗證。月令以現在時間計。</p>';
    }
    f.innerHTML = h;
    if (method === "char") bindCharForm();
    if (method === "time") bindTimeForm();
    if (method === "number") {
      $("#fill-random").addEventListener("click", function () {
        ["n1", "n2", "n3"].forEach(function (id) { $("#" + id).value = C.randomInt(999); });
      });
      $("#dongMode").addEventListener("change", function (e) { prefs.dongMode = e.target.value; savePrefs(); });
    }
  }

  function currentWhen() {
    var picked = $$('input[name="when"]').filter(function (r) { return r.checked; })[0];
    if (!picked || picked.value === "now") return new Date();
    return dateFromLocalInput($("#when-input").value);
  }

  function bindTimeForm() {
    function refresh() {
      var custom = $$('input[name="when"]').filter(function (r) { return r.checked; })[0].value === "custom";
      $("#when-input").disabled = !custom;
      var d = currentWhen();
      if (!d || isNaN(d)) { $("#time-preview").textContent = "請輸入有效的日期時間。"; return; }
      var l = C.lunarInfo(d), hb = C.branchOfHour(C.zonedParts(d).hour), m = C.monthContext(d, prefs.monthMode);
      $("#time-preview").textContent = "農曆" + l.ganzhi + "年" + (l.isLeap ? "閏" : "") + l.month + "月" + l.day + "日 · " +
        D.BRANCHES[hb - 1] + "時 · 月令" + m.branch + "月（" + m.termName + (m.mode === "solar" ? "後 " + m.daysSince.toFixed(1) + " 天" : "") + "）";
    }
    $$('input[name="when"]').forEach(function (r) { r.addEventListener("change", refresh); });
    $("#when-input").addEventListener("input", refresh);
    refresh();
  }

  // ---------- 十應欄位 ----------
  var YING_FIELDS = [
    ["dir", "所在方位（方應）", "dir"], ["weather", "天氣（天時應）", "weather"], ["place", "所處地點（地理應）", "place"],
    ["people", "偶遇之人（人事應）", "people"], ["object", "偶見外物（外應）", "object"]
  ];
  function renderYingFields() {
    var h = YING_FIELDS.map(function (f) {
      var opts = ['<option value="">（不填）</option>'].concat(D.YING_OPTIONS[f[2]].map(function (o) { return '<option value="' + esc(o.v) + '">' + esc(o.v) + "</option>"; }));
      return '<label>' + f[1] + '<select id="y-' + f[0] + '">' + opts.join("") + "</select></label>";
    }).join("");
    h += '<label>當下見聞的徵兆（刻應）<select id="y-omen"><option value="">（不填）</option><option value="good">吉兆（笑語、喜事、好消息）</option><option value="bad">凶兆（哭泣、爭吵、不祥）</option></select></label>';
    $("#ying-fields").innerHTML = h;
  }
  function readYing() {
    var o = {};
    YING_FIELDS.forEach(function (f) { o[f[0]] = $("#y-" + f[0]).value; });
    o.omen = $("#y-omen").value;
    return o;
  }

  // ---------- 字占 ----------
  var ziState = { loaded: false, loading: false, failed: false };
  function ensureZi(cb) {
    if (window.ZiData) { ziState.loaded = true; cb(); return; }
    if (ziState.failed) { cb(); return; }
    if (ziState.loading) return;
    ziState.loading = true;
    var sc = document.createElement("script");
    sc.src = "js/data-zi.js";
    sc.onload = function () { ziState.loaded = true; ziState.loading = false; cb(); };
    sc.onerror = function () { ziState.failed = true; ziState.loading = false; cb(); };
    document.head.appendChild(sc);
  }
  var TONES = [[1, "平"], [2, "上"], [3, "去"], [4, "入"]];

  function renderCharDetail() {
    var chars = C.hanChars($("#zi-text").value), n = chars.length, kind = C.charMethodFor(n), box = $("#zi-detail");
    $("#zi-count").textContent = n ? "共 " + n + " 個漢字" : "";
    if (kind === "none") { box.innerHTML = '<p class="muted">請輸入至少一個漢字。</p>'; return; }
    var ZD = window.ZiData, note = "";
    if (kind === "count") {
      var up = Math.floor(n / 2);
      box.innerHTML = '<p>11 字以上不看筆畫與聲調，只數字數：上卦取前 <strong>' + up + "</strong> 字，下卦取後 <strong>" + (n - up) + "</strong> 字。</p>";
      return;
    }
    if (!ZD && !ziState.failed) { box.innerHTML = '<p class="muted">載入字表中…</p>'; ensureZi(renderCharDetail); return; }
    if (ziState.failed) note = '<p class="warn">字表載入失敗，請手動輸入。</p>';
    var rows = "";
    if (kind === "single") {
      var ch = chars[0], tot = ZD && ZD.strokes[ch];
      box.innerHTML = note + "<p>一字占：楷書把「" + esc(ch) + "」分成左右兩半，左半筆畫為陽畫取上卦，右半筆畫為陰畫取下卦。" +
        (tot ? "（《康熙字典》全字 " + tot + " 畫，供拆分時核對。）" : "") + '</p><div class="grid2">' +
        '<label>左半筆畫<input id="zi-left" type="number" min="1" step="1" inputmode="numeric"></label>' +
        '<label>右半筆畫<input id="zi-right" type="number" min="1" step="1" inputmode="numeric"></label></div>';
      return;
    }
    if (kind === "stroke") {
      rows = chars.map(function (c) {
        var v = ZD && ZD.strokes[c];
        return '<label>' + esc(c) + (v ? "" : ' <span class="warn">（查無，請填）</span>') + '<input class="zi-stroke" type="number" min="1" step="1" inputmode="numeric" value="' + (v || "") + '"></label>';
      }).join("");
      box.innerHTML = note + '<p>各字筆畫（自動帶入《康熙字典》筆畫，可修改）：</p><div class="grid3">' + rows + '</div>' +
        '<p class="muted">康熙筆畫把「氵」算 4 畫、「艹」算 6 畫、「忄」算 4 畫等。簡化字或異體字的資料可能與正體不同，請自行核對。</p>';
      return;
    }
    rows = chars.map(function (c, i) {
      var cand = (ZD && ZD.tones[c]) || "", first = cand ? +cand[0] : 1;
      var btns = TONES.map(function (t) {
        var mark = cand.indexOf(String(t[0])) >= 0 ? "★" : "";
        return '<label class="inline tone"><input type="radio" name="zt' + i + '" value="' + t[0] + '"' + (t[0] === first ? " checked" : "") + "> " + t[1] + mark + "</label>";
      }).join("");
      return '<div class="tone-row"><span class="tone-char">' + esc(c) + "</span>" + btns + (cand ? "" : ' <span class="warn">（查無，請自選）</span>') + "</div>";
    }).join("");
    box.innerHTML = note + '<p>各字古四聲（平上去入＝1–4）。★ 表示《廣韻》有此讀音；多音字預設第一個，請依語意改選：</p>' + rows +
      '<p class="muted">書中用的是古四聲，與現代普通話聲調不同（普通話沒有入聲）。</p>';
  }

  function bindCharForm() {
    $("#zi-text").addEventListener("input", renderCharDetail);
    $("#zi-from-question").addEventListener("click", function () { $("#zi-text").value = $("#question").value; renderCharDetail(); });
    renderCharDetail();
  }

  function collectChar() {
    var chars = C.hanChars($("#zi-text").value), n = chars.length, kind = C.charMethodFor(n);
    if (kind === "none") { showError("請輸入至少一個漢字。"); return null; }
    if (kind === "count") return C.fromCharCount(chars);
    var num = function (el) { var v = (el.value || "").trim(); return /^\d+$/.test(v) && +v >= 1 ? +v : null; };
    if (kind === "single") {
      var l = num($("#zi-left")), r = num($("#zi-right"));
      if (l === null || r === null) { showError("請填入左半與右半的筆畫（大於 0 的整數）。"); return null; }
      return C.fromOneChar(chars[0], l, r);
    }
    if (kind === "stroke") {
      var st = $$(".zi-stroke").map(num);
      if (st.some(function (x) { return x === null; })) { showError("每個字都要有筆畫（大於 0 的整數）。"); return null; }
      return C.fromCharStrokes(chars, st);
    }
    var tn = chars.map(function (_, i) { var el = $('input[name="zt' + i + '"]:checked'); return el ? +el.value : null; });
    if (tn.some(function (x) { return x === null; })) { showError("每個字都要選一個聲調。"); return null; }
    return C.fromCharTones(chars, tn);
  }

  function showError(msg) {
    var e = $("#form-error"); e.textContent = msg || ""; e.hidden = !msg;
  }
  function readPosInt(id) {
    var raw = ($("#" + id).value || "").trim();
    if (!/^\d+$/.test(raw)) return null;
    var n = parseInt(raw, 10);
    return n >= 1 && Number.isSafeInteger(n) ? n : null;
  }

  // 依目前表單產生 { divination, when } 或 null
  function collect() {
    showError("");
    var now = new Date();
    if (method === "number") {
      var a = readPosInt("n1"), b = readPosInt("n2"), c = readPosInt("n3");
      if (a === null || b === null || c === null) { showError("請輸入三個大於 0 的整數，或按「隨機填入」。"); return null; }
      return { divination: C.fromNumbers(a, b, c, $("#dongMode").value), when: now };
    }
    if (method === "time") {
      var d = currentWhen();
      if (!d || isNaN(d)) { showError("請輸入有效的日期時間。"); return null; }
      return { divination: C.fromDate(d), when: d };
    }
    if (method === "char") {
      var cd = collectChar();
      return cd ? { divination: cd, when: now } : null;
    }
    if (method === "object") {
      var n = readPosInt("obj-n");
      if (n === null) { showError("請輸入大於 0 的整數。"); return null; }
      return { divination: C.fromObject(n, now), when: now };
    }
    if (method === "random") {
      var r = C.fromNumbers(C.randomInt(999), C.randomInt(999), C.randomInt(999), "sum");
      r.method = "random";
      return { divination: r, when: now };
    }
    return { divination: C.fromManual(+$("#m-upper").value, +$("#m-lower").value, +$("#m-dong").value), when: now };
  }

  // ---------- 畫面：結果 ----------
  function guaHtml(lines, dong, sm) {
    var rows = "";
    for (var i = 5; i >= 0; i--) {
      var yang = lines[i] === 1, mv = dong === i + 1;
      rows += '<div class="yao' + (mv ? " moving" : "") + '" title="第' + (i + 1) + '爻' + (yang ? "（陽）" : "（陰）") + '">' +
        '<span class="bar"></span>' + (yang ? "" : '<span class="bar"></span>') + (mv ? '<i class="mark">動</i>' : "") + "</div>";
    }
    return '<div class="gua' + (sm ? " sm" : "") + '" role="img" aria-label="' + (dong ? "動爻第" + dong + "爻" : "") + '">' + rows + "</div>";
  }
  function hexCard(label, lines, dong, num, name) {
    return '<div class="hexcard"><div class="lab">' + label + "</div>" + guaHtml(lines, dong) +
      '<div class="nm">' + esc(name) + '</div><div class="no">第 ' + num + " 卦</div></div>";
  }
  function trigName(id) { return T[id].name + "（" + T[id].elem + "）"; }

  function sec(title, body) { return '<section class="card"><h2>' + title + "</h2>" + body + "</section>"; }

  function textBlock(info, dong) {
    var y = info.yao[dong - 1];
    var out = "<blockquote><small>卦辭</small>" + esc(info.title) + "：" + esc(info.guaci) + "</blockquote>";
    if (prefs.show.tuan) out += "<blockquote><small>彖傳</small>" + esc(info.tuan) + "</blockquote>";
    out += "<blockquote><small>大象</small>" + esc(info.daxiang) + "</blockquote>";
    if (y) out += "<blockquote><small>動爻　" + esc(y.pos) + "</small>" + esc(y.text) + "<br>象曰：" + esc(y.xiang) +
      (y.note ? '<small class="suppl">校註：' + esc(y.note) + "</small>" : "") + "</blockquote>";
    return out;
  }

  // ---------- 詳細卦應類象 ----------
  function guaYingBlock(id, role) {
    var g = window.GuaYingData && window.GuaYingData[id];
    if (!g) return "";
    return "<h3>" + (role ? role + "：" : "") + g.name + "（" + T[id].nature + "·" + T[id].elem + "）</h3><p>" + esc(g.intro) + "</p><dl class=\"xdl\">" +
      g.entries.map(function (e) { return "<dt>" + esc(e[0]) + "</dt><dd>" + esc(e[1]) + "</dd>"; }).join("") + "</dl>";
  }

  var xiangSel = 1;
  function hl(text, q) {
    var t = esc(text);
    if (!q) return t;
    var qe = esc(q);
    return t.split(qe).join("<mark>" + qe + "</mark>");
  }
  function renderXiang() {
    var G = window.GuaYingData, q = ($("#xiang-q").value || "").trim();
    if (!G) { $("#xiang-body").textContent = "類象資料載入失敗。"; return; }
    $("#xiang-tabs").innerHTML = Object.keys(G).map(function (id) {
      return '<button type="button" data-x="' + id + '" aria-pressed="' + (!q && +id === xiangSel) + '">' + G[id].name + "</button>";
    }).join("");
    if (!q) { $("#xiang-body").innerHTML = guaYingBlock(xiangSel, ""); return; }
    var hits = [];
    Object.keys(G).forEach(function (id) {
      var g = G[id];
      if (g.intro.indexOf(q) >= 0) hits.push([g.name, "總說", g.intro, id]);
      g.entries.forEach(function (e) { if (e[0].indexOf(q) >= 0 || e[1].indexOf(q) >= 0) hits.push([g.name, e[0], e[1], id]); });
    });
    $("#xiang-body").innerHTML = hits.length
      ? "<p>「" + esc(q) + "」共 " + hits.length + " 處：</p><ul>" + hits.map(function (h) {
          return "<li><strong>" + h[0] + "</strong>（" + T[h[3]].elem + "）・" + esc(h[1]) + "：" + hl(h[2], q) + "</li>";
        }).join("") + "</ul>"
      : '<p class="muted">查無「' + esc(q) + "」。可換同義詞（例如「魚」→「水族」），或清空搜尋直接看各卦全文。</p>";
  }

  function renderResult(res, opts) {
    opts = opts || {};
    var h = res.hexagram, a = res.analysis, m = res.month, show = prefs.show;
    var benInfo = Z.HEXAGRAMS[h.num.ben - 1], huInfo = Z.HEXAGRAMS[h.num.hu - 1], bianInfo = Z.HEXAGRAMS[h.num.bian - 1];
    var levelCls = a.total >= 2 ? "good" : (a.total > -0.5 ? "warn" : "bad");
    var out = "";

    out += '<section class="card"><div class="headline"><span class="big">' + esc(h.name.ben) + '</span>' +
      '<span>第 ' + h.dong + ' 爻動 → 變 ' + esc(h.name.bian) + "</span>" +
      (show.verdict ? '<span class="badge ' + levelCls + '">' + a.level + "</span>" : "") + "</div>" +
      '<p class="muted">' + esc(res.record_question || "") + (res.record_question ? " · " : "") +
      esc(METHOD_LABEL[res.divination.method] || "") + " · " + esc(fmtWhen(res.when)) + "</p>" +
      '<div class="grid3">' + hexCard("本卦", h.lines, h.dong, h.num.ben, h.name.ben) +
      hexCard("互卦", h.hu.lines, 0, h.num.hu, h.name.hu) + hexCard("變卦", h.bian.lines, 0, h.num.bian, h.name.bian) + "</div>" +
      '<p class="muted" style="margin-top:10px">體：' + trigName(h.tiId) + "　用：" + trigName(h.yongId) + "（動爻所在之卦為用）</p></section>";

    if (show.steps) out += sec("起卦計算過程", '<ol class="steps">' + res.divination.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>");

    if (show.text) {
      var body = textBlock(benInfo, h.dong);
      if (res.divination.method === "time") body += "";
      out += sec("本卦：" + esc(h.name.ben) + "　卦辭與爻辭", body + '<p class="muted">梅花易數只有一個動爻，故以本卦動爻之爻辭為主，卦辭、大象為背景。</p>');
    }
    if (show.extra) {
      out += sec("互卦與變卦的卦辭",
        "<h3>互卦：" + esc(h.name.hu) + "（事之中間）</h3><blockquote>" + esc(huInfo.title) + "：" + esc(huInfo.guaci) + "</blockquote>" +
        (show.tuan ? "<blockquote><small>彖傳</small>" + esc(huInfo.tuan) + "</blockquote>" : "") +
        "<h3>變卦：" + esc(h.name.bian) + "（事之終結）</h3><blockquote>" + esc(bianInfo.title) + "：" + esc(bianInfo.guaci) + "</blockquote>" +
        (show.tuan ? "<blockquote><small>彖傳</small>" + esc(bianInfo.tuan) + "</blockquote>" : "") +
        "<blockquote><small>變卦大象</small>" + esc(bianInfo.daxiang) + "</blockquote>");
    }

    if (show.tiyong) {
      var rows = [["體", h.tiId, null], ["用", h.yongId, a.items[0]], ["體互", h.huTiId, a.items[1]], ["用互", h.huYongId, a.items[2]], ["變卦（用位）", h.bianYongId, a.items[3]]];
      var trs = rows.map(function (r, i) {
        var t = T[r[1]], it = r[2];
        var st = C.stateOf(t.elem, m.season);
        return "<tr" + (i === 0 ? ' class="hl"' : "") + "><td>" + r[0] + "</td><td>" + t.name + "（" + t.nature + "）</td><td>" + t.elem + "</td><td>" +
          (it ? '<span class="' + it.rel.tone + '">' + it.rel.label + "</span>" : "—") + "</td><td>" + st + "</td></tr>";
      }).join("");
      out += sec("體用生剋表",
        '<table><thead><tr><th>角色</th><th>卦</th><th>五行</th><th>與體關係</th><th>月令態</th></tr></thead><tbody>' + trs + "</tbody></table>" +
        '<p class="muted">體為己，用為事；互為事之中間，變為事之終（p.74、145）。體互最緊，用互次之。「生體」「剋體」均以體卦為準。</p>');
    }

    if (show.month) {
      var ww = ["木", "火", "土", "金", "水"].map(function (e) {
        var st = C.stateOf(e, m.season);
        return "<tr" + (e === a.ti.elem ? ' class="hl"' : "") + "><td>" + e + "</td><td>" + st + "</td></tr>";
      }).join("");
      var bookTag = a.tiState === "旺" ? "（書：卦氣旺）" : (a.tiState === "死" ? "（書：卦氣衰）" : "");
      out += sec("月令旺衰",
        "<p>月令：<strong>" + m.branch + "月</strong>（" + esc(m.termName) + (m.mode === "solar" ? "後約 " + m.daysSince.toFixed(1) + " 天；距下一節約 " + m.daysUntil.toFixed(1) + " 天" : "") + "），季節：" + esc(m.seasonName) + "。</p>" +
        (m.nearBoundary ? '<p class="warn">⚠ 接近換月交界（誤差約 ±15 分鐘），請對照萬年曆確認節氣時刻。</p>' : "") +
        '<table style="max-width:260px"><thead><tr><th>五行</th><th>當月狀態</th></tr></thead><tbody>' + ww + "</tbody></table>" +
        "<p>體卦 " + trigName(h.tiId) + " 在本月為「" + a.tiState + "」" + bookTag + "。體宜乘旺、克體之卦宜衰（p.127、148）。</p>" +
        '<p class="muted">旺相休囚死：當令者旺，我生者相，生我者休，克我者囚，我克者死（p.285-286）。' +
        (m.mode === "lunar" ? "目前以農曆月份計（正月建寅）。" : "目前以節氣計月令。") + "</p>");
    }

    if (show.verdict) {
      var parts = a.parts.map(function (p) {
        return "<tr><td>" + esc(p.label) + '</td><td class="num ' + (p.score > 0 ? "good" : (p.score < 0 ? "bad" : "")) + '">' + (p.score > 0 ? "+" : "") + p.score + "</td></tr>";
      }).join("");
      var hints = a.hints.length ? "<h3>象意提示</h3><ul>" + a.hints.map(function (x) {
        return "<li><strong>" + x.role + " " + x.trigram.name + " " + x.kind + "</strong>：" + esc(x.text) + "</li>";
      }).join("") + "</ul>" : "";
      out += sec("綜合斷語",
        '<p><span class="badge ' + levelCls + '">' + a.level + "</span> 　總分 " + a.total.toFixed(2) + "</p>" +
        (a.process ? "<p>" + esc(a.process) + "</p>" : "") + hints +
        "<h3>應期參考</h3><p>吉期：" + esc(a.timing.good.join("、")) + "<br>忌期：" + esc(a.timing.bad.join("、")) + '<br><span class="muted">生體、比和之五行當令時易應吉；剋體之五行當令時易應凶（p.148）。</span></p>' +
        (a.note ? '<p class="muted">' + esc(a.note) + "</p>" : "") +
        '<details><summary>評分明細（本程式的簡化規則，非原書給分）</summary><table><tbody>' + parts + "</tbody></table>" +
        '<p class="muted">比和＋2、生體＋2、體剋＋2、體生－1、剋體－3；體互權重 1、用互 0.5、變卦 1；體卦旺相休囚死 ＋1.5／＋0.75／0／－0.75／－1.5；剋體之卦氣旺再 －1、生體之卦氣旺再 ＋0.5。' +
        "分級：≥4 大吉、≥2 吉、≥0.5 小吉、≥－0.5 平、≥－2 小凶、≥－4 凶、其餘大凶。</p></details>");
    }

    if (show.ying) {
      var yg = res.ying;
      var yrows = yg.items.map(function (it) {
        return "<tr><td>" + it.title + "</td><td>" + esc(it.detail) + '</td><td><span class="' + it.rel.tone + '">' + it.rel.label + '</span></td><td class="' + it.rel.tone + '">' + it.verdict + "</td></tr>" +
          (it.note ? '<tr><td></td><td colspan="3" class="muted">' + esc(it.note) + "</td></tr>" : "");
      }).join("");
      out += sec("十應與內外合斷",
        '<p class="muted">正應、互應、變應即上方「體用生剋表」（內卦）；以下為方、日、刻、外、天時、地理、人事等外應（p.176-181）。</p>' +
        '<table><thead><tr><th>應</th><th>所見／所值</th><th>與體關係</th><th>判斷</th></tr></thead><tbody>' + yrows + "</tbody></table>" +
        (yg.answered === 0 ? '<p class="muted">目前只有「日應」。在起卦區展開「十應」填寫起卦當下的方位、天氣、地點等，可得到更完整的外應。</p>' : "") +
        "<p>外應分數 " + yg.outerScore + "（" + yg.outerLevel + "）；內卦（體用互變）" + a.level + "。</p>" +
        '<p><strong class="' + yg.combined.tone + '">' + esc(yg.combined.text) + '</strong></p>' +
        '<p class="muted">依〈十應目論〉（p.112）：內外皆吉斷吉，皆凶斷凶；內吉外凶，吉被破；內凶外吉，凶可解。須詳理，不可膠柱鼓瑟。</p>');
    }

    if (show.xiang) {
      var xi = function (id, role) {
        var t = T[id];
        return "<div><strong>" + role + "：" + t.name + "（" + t.nature + "·" + t.elem + "）</strong><br>" +
          "卦德：" + t.virtue + "　方位：" + t.dir + "<br>人：" + t.family + "<br>身：" + t.body + "　獸：" + t.animal + "<br>物：" + esc(t.items.join("、")) + "</div>";
      };
      out += sec("類象（八卦萬物屬類）", '<div class="xiang-grid">' + xi(h.tiId, "體") + xi(h.yongId, "用") + "</div>" +
        '<p class="muted">節錄自《梅花易數》〈八卦萬物屬類〉（p.29-30），僅列常用項目。</p>' +
        (window.GuaYingData ? "<details><summary>體卦、用卦的詳細類象（卦應，p.183-198）</summary>" +
          guaYingBlock(h.tiId, "體") + guaYingBlock(h.yongId, "用") + "</details>" : ""));
    }

    if (show.sources) {
      out += sec("原書依據", "<ul>" + D.SOURCES.map(function (s) { return "<li>" + esc(s.topic) + "（" + s.ref + "）</li>"; }).join("") + "</ul>");
    }

    var el = $("#result");
    el.innerHTML = out;
    if (!opts.noScroll && el.scrollIntoView) { try { el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* 忽略 */ } }
  }

  function fmtWhen(d) {
    var p = C.zonedParts(d);
    return p.year + "-" + pad(p.month) + "-" + pad(p.day) + " " + pad(p.hour) + ":" + pad(p.minute) + "（臺北）";
  }

  // ---------- 歷史紀錄 ----------
  var cloud = { client: null, user: null, ready: false };

  function makeRecord(res, question, category) {
    var h = res.hexagram;
    return {
      id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ts: new Date().toISOString(), whenISO: res.when.toISOString(),
      question: question, category: category, method: res.divination.method,
      divination: { method: res.divination.method, upper: res.divination.upper, lower: res.divination.lower, dong: res.divination.dong, input: res.divination.input, steps: res.divination.steps },
      monthMode: prefs.monthMode, ying: res.yingInputs || {},
      summary: { ben: h.name.ben, hu: h.name.hu, bian: h.name.bian, level: res.analysis.level, total: res.analysis.total }
    };
  }

  function loadLocalHistory() { try { return JSON.parse(lsGet(HIST_KEY) || "[]"); } catch (e) { return []; } }
  function saveLocalHistory(list) { lsSet(HIST_KEY, JSON.stringify(list.slice(0, 500))); }

  function listHistory() {
    if (cloud.user && cloud.client) {
      return cloud.client.from("divination_logs").select("id, created_at, question, method, record")
        .order("created_at", { ascending: false }).limit(200)
        .then(function (r) {
          if (r.error) throw r.error;
          return r.data.map(function (row) { var rec = row.record || {}; rec.id = row.id; rec.cloud = true; return rec; });
        });
    }
    return Promise.resolve(loadLocalHistory());
  }

  function saveRecord(rec) {
    if (cloud.user && cloud.client) {
      return cloud.client.from("divination_logs").insert([{ question: rec.question, method: rec.method, record: rec }])
        .then(function (r) { if (r.error) throw r.error; });
    }
    var list = loadLocalHistory(); list.unshift(rec); saveLocalHistory(list);
    return Promise.resolve();
  }

  function deleteRecord(id, isCloud) {
    if (isCloud && cloud.client) {
      return cloud.client.from("divination_logs").delete().eq("id", id).then(function (r) { if (r.error) throw r.error; });
    }
    saveLocalHistory(loadLocalHistory().filter(function (x) { return x.id !== id; }));
    return Promise.resolve();
  }

  var historyCache = [];
  function renderHistory() {
    $("#hist-source").textContent = cloud.user ? "資料來源：雲端（" + cloud.user.email + "）" : "資料來源：這個瀏覽器（本機）";
    $("#hist-upload").hidden = !(cloud.user && loadLocalHistory().length);
    listHistory().then(function (list) {
      historyCache = list;
      $("#history-list").innerHTML = list.length ? list.map(function (r) {
        var s = r.summary || {};
        return '<li><div><div>' + esc(r.question || "（未填事由）") + ' <span class="badge">' + esc(s.level || "") + '</span></div>' +
          '<div class="meta">' + esc(fmtWhen(new Date(r.ts || r.whenISO))) + " · " + esc(METHOD_LABEL[r.method] || r.method) + " · " + esc(r.category || "") +
          " · " + esc(s.ben || "") + " → " + esc(s.bian || "") + '</div></div>' +
          '<div><button type="button" data-open="' + esc(r.id) + '">開啟</button> <button type="button" class="danger" data-del="' + esc(r.id) + '">刪除</button></div></li>';
      }).join("") : '<li class="muted">還沒有紀錄。</li>';
    }).catch(function (e) {
      $("#history-list").innerHTML = '<li class="error">讀取歷史失敗：' + esc(e.message || e) + "</li>";
    });
  }

  function openRecord(rec) {
    var d = rec.divination, when = new Date(rec.whenISO || rec.ts);
    var res = C.cast(d, when, rec.monthMode || prefs.monthMode, rec.ying || {});
    res.record_question = rec.question;
    renderResult(res);
  }

  // ---------- 起卦流程 ----------
  var last = null;
  function doCast() {
    var got = collect();
    if (!got) return;
    var question = $("#question").value.trim(), category = $("#category").value;
    var res = C.cast(got.divination, got.when, prefs.monthMode, readYing());
    res.record_question = question;
    last = res;
    renderResult(res);
    if (prefs.autosave) {
      var rec = makeRecord(res, question, category);
      saveRecord(rec).then(function () { if (!$("#panel-history").hidden) renderHistory(); })
        .catch(function (e) { console.error("儲存失敗", e); showError("排盤完成，但儲存歷史失敗：" + (e.message || e)); });
    }
  }

  // ---------- 帳號（Supabase，可選）----------
  function loadSupabase() {
    var cfg = window.MEIHUA_CONFIG || {};
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return;
    $("#btn-account").hidden = false;
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
    s.onload = function () {
      try {
        cloud.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        cloud.client.auth.getSession().then(function (r) { cloud.user = r.data.session ? r.data.session.user : null; cloud.ready = true; renderAccount(); renderHistory(); });
        cloud.client.auth.onAuthStateChange(function (_e, session) { cloud.user = session ? session.user : null; renderAccount(); renderHistory(); });
      } catch (e) { console.error(e); }
    };
    s.onerror = function () { $("#account-body").textContent = "無法載入 Supabase 程式庫（請檢查網路）。"; };
    document.head.appendChild(s);
  }

  function renderAccount() {
    var b = $("#account-body");
    if (!cloud.client) { b.textContent = "正在連線…"; return; }
    if (cloud.user) {
      b.innerHTML = "<p>已登入：<strong>" + esc(cloud.user.email) + '</strong>。歷史紀錄會存到雲端，只有你本人讀得到。</p><button type="button" id="btn-logout">登出</button>';
      $("#btn-logout").addEventListener("click", function () { cloud.client.auth.signOut(); });
    } else {
      b.innerHTML = '<p class="muted">輸入 Email，我們會寄一封信（不需密碼）。信裡有登入連結與驗證碼：電腦可點連結；手機 App 請輸入驗證碼。登入後歷史紀錄會同步到雲端。</p>' +
        '<div class="row"><label class="grow">Email<input id="login-email" type="email" autocomplete="email"></label><button type="button" id="btn-login">寄送登入信</button></div>' +
        '<div class="row" id="code-row" hidden><label class="grow">信中的驗證碼<input id="login-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="例如 123456"></label><button type="button" id="btn-verify">驗證並登入</button></div>' +
        '<p id="login-msg" class="muted" role="status"></p>';
      var sentTo = "";
      $("#btn-login").addEventListener("click", function () {
        var email = $("#login-email").value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) { $("#login-msg").textContent = "請輸入有效的 Email。"; return; }
        $("#login-msg").textContent = "寄送中…";
        cloud.client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href.split("#")[0] } })
          .then(function (r) {
            if (r.error) { $("#login-msg").textContent = "失敗：" + r.error.message; return; }
            sentTo = email; $("#code-row").hidden = false;
            $("#login-msg").textContent = "已寄出。請到信箱查看：點連結，或在上方輸入驗證碼。";
          });
      });
      $("#btn-verify").addEventListener("click", function () {
        var code = $("#login-code").value.replace(/\s/g, "");
        if (!sentTo || !/^\d{6,10}$/.test(code)) { $("#login-msg").textContent = "請輸入信中的 6 至 10 位數驗證碼。"; return; }
        $("#login-msg").textContent = "驗證中…";
        cloud.client.auth.verifyOtp({ email: sentTo, token: code, type: "email" })
          .then(function (r) { if (r.error) $("#login-msg").textContent = "驗證失敗：" + r.error.message; });
        // 成功時由 onAuthStateChange 更新畫面
      });
    }
  }

  // ---------- 事件綁定 ----------
  function togglePanel(id) { var p = $(id); p.hidden = !p.hidden; return !p.hidden; }

  function init() {
    renderTabs(); renderForm(); renderYingFields();

    $("#method-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-m]"); if (!b) return;
      method = b.getAttribute("data-m"); showError(""); renderTabs(); renderForm();
    });
    $("#btn-cast").addEventListener("click", doCast);
    $("#method-form").addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "radio") doCast(); });

    // 顯示項目面板
    $("#prefs-checks").innerHTML = SHOW_ITEMS.map(function (it) {
      return '<label><input type="checkbox" data-show="' + it[0] + '"' + (prefs.show[it[0]] ? " checked" : "") + "> " + it[1] + "</label>";
    }).join("");
    $("#pref-monthMode").value = prefs.monthMode;
    $("#pref-autosave").checked = !!prefs.autosave;
    $("#btn-prefs").addEventListener("click", function () { togglePanel("#panel-prefs"); });
    $("#prefs-checks").addEventListener("change", function (e) {
      var k = e.target.getAttribute("data-show"); if (!k) return;
      prefs.show[k] = e.target.checked; savePrefs(); if (last) renderResult(last, { noScroll: true });
    });
    $("#pref-monthMode").addEventListener("change", function (e) {
      prefs.monthMode = e.target.value; savePrefs();
      if (method === "time") bindTimeForm();
      if (last) { last = C.cast(last.divination, last.when, prefs.monthMode, last.yingInputs); last.record_question = $("#question").value.trim(); renderResult(last, { noScroll: true }); }
    });
    $("#pref-autosave").addEventListener("change", function (e) { prefs.autosave = e.target.checked; savePrefs(); });

    // 類象查詢
    $("#btn-xiang").addEventListener("click", function () { if (togglePanel("#panel-xiang")) renderXiang(); });
    $("#xiang-q").addEventListener("input", renderXiang);
    $("#xiang-tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-x]"); if (!b) return;
      xiangSel = +b.getAttribute("data-x"); $("#xiang-q").value = ""; renderXiang();
    });

    // 歷史
    $("#btn-history").addEventListener("click", function () { if (togglePanel("#panel-history")) renderHistory(); });
    $("#history-list").addEventListener("click", function (e) {
      var o = e.target.getAttribute("data-open"), d = e.target.getAttribute("data-del");
      if (o) { var rec = historyCache.filter(function (r) { return r.id === o; })[0]; if (rec) openRecord(rec); }
      if (d) {
        var rec2 = historyCache.filter(function (r) { return r.id === d; })[0];
        deleteRecord(d, rec2 && rec2.cloud).then(renderHistory).catch(function (err) { showError("刪除失敗：" + (err.message || err)); });
      }
    });
    $("#hist-export").addEventListener("click", function () {
      listHistory().then(function (list) {
        var url = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: "application/json" }));
        var a = document.createElement("a"); a.href = url; a.download = "meihua-history.json"; a.click(); URL.revokeObjectURL(url);
      });
    });
    $("#hist-clear").addEventListener("click", function () {
      if (window.confirm("確定要清空這個瀏覽器裡的所有歷史紀錄嗎？（雲端紀錄不受影響）")) { saveLocalHistory([]); renderHistory(); }
    });
    $("#hist-upload").addEventListener("click", function () {
      var local = loadLocalHistory(); if (!local.length || !cloud.client) return;
      cloud.client.from("divination_logs").insert(local.map(function (r) { return { question: r.question, method: r.method, record: r }; }))
        .then(function (r) { if (r.error) { showError("上傳失敗：" + r.error.message); return; } saveLocalHistory([]); renderHistory(); });
    });

    // 帳號
    $("#btn-account").addEventListener("click", function () { togglePanel("#panel-account"); renderAccount(); });
    loadSupabase();
  }

  // ---------- PWA：離線快取與安裝 ----------
  function initPwa() {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").catch(function (e) { console.warn("Service Worker 註冊失敗", e); });
      });
    }
    var deferred = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault(); deferred = e; $("#btn-install").hidden = false;
    });
    $("#btn-install").addEventListener("click", function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; $("#btn-install").hidden = true; });
    });
    window.addEventListener("appinstalled", function () { $("#btn-install").hidden = true; });
  }

  init();
  initPwa();
})();
