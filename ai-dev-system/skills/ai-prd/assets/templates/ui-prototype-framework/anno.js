
  (function () {
    "use strict";

    var VOID = /^(input|img|br|hr|select|textarea|area|base|col|embed|link|meta|param|source|track|wbr)$/i;
    var SLOT = document.getElementById("anno-data");
    var CANVAS = document.querySelector("[data-anno-canvas]") || document.querySelector(".devices") || document.body;
    var FILE = decodeURIComponent((location.pathname.split("/").pop() || "prototype.html"));
    var KEY = "prd-anno:" + location.pathname;
    var CAN_FS = typeof window.showOpenFilePicker === "function";
    // 由 scripts/preview.mjs 以 http 打开时，批注直接 POST 回去由它写回原文件，
    // 全程零操作。直接双击 html（file://）打开则降级到下面的手动授权/下载。
    var SERVED = location.protocol === "http:" || location.protocol === "https:";

    var store = load();
    var handle = null;
    var granted = false;
    var dirty = false;
    var picking = false;
    var timer = 0;
    var servedOk = true;   // 预览服务是否还在（写回失败即转 false）
    var docVersion = null;

    /* ---------- 数据 ---------- */

    function blank() {
      return { schema: "prd-annotations@1", updatedAt: "", global: [], items: [], replies: [] };
    }

    function parse(text) {
      try {
        var d = JSON.parse(text);
        if (!d || typeof d !== "object") return null;
        d.global = Array.isArray(d.global) ? d.global : [];
        d.items = Array.isArray(d.items) ? d.items : [];
        d.replies = Array.isArray(d.replies) ? d.replies : [];
        d.updatedAt = d.updatedAt || "";
        d.schema = d.schema || "prd-annotations@1";
        return d;
      } catch (e) {
        return null;
      }
    }

    // 文件内的批注是基线；本机改过但还没写回文件时，以更新时间更晚的一方为准。
    function load() {
      var fromFile = (SLOT && parse(SLOT.textContent)) || blank();
      var cached = null;
      try {
        var raw = window.localStorage.getItem(KEY);
        if (raw) cached = parse(raw);
      } catch (e) { /* 隐私模式等：忽略 */ }
      if (cached && (cached.updatedAt || "") > (fromFile.updatedAt || "")) return cached;
      return fromFile;
    }

    function nextId(list, prefix) {
      var max = 0;
      list.forEach(function (it) {
        var n = parseInt(String(it.id || "").replace(prefix, ""), 10);
        if (n > max) max = n;
      });
      return prefix + (max + 1);
    }

    function persist() {
      store.updatedAt = new Date().toISOString();
      var text = JSON.stringify(store, null, 2);
      // 写进数据块前必须转义 "<" + "/"：批注文本里出现脚本结束标签会把数据块提前闭合，
      // 整份文件的批注就此报废。JSON 里 \/ 是合法转义，解析回来仍是 /。
      // （本行刻意不写出那个标签的字面形态——写出来同样会闭合这段脚本。）
      if (SLOT) SLOT.textContent = "\n" + text.replace(/<\//g, "<\\/") + "\n";
      try { window.localStorage.setItem(KEY, text); } catch (e) { /* 忽略 */ }
      dirty = true;
      render();
      autosave();
      explainOnce();
    }

    // 浏览器不能擅自写硬盘，所以第一次写批注时讲清楚"为什么还要点一下保存"，
    // 否则用户写完一堆意见，文件里一条都没有，而他以为已经存好了。
    function explainOnce() {
      if (SERVED) return;   // 自动写回，没有需要解释的动作
      if (handle && granted) return;
      try {
        if (window.localStorage.getItem(KEY + ":explained")) return;
        window.localStorage.setItem(KEY + ":explained", "1");
      } catch (e) { /* 隐私模式：讲一次总比不讲好 */ }
      var act = CAN_FS ? "保存到文件" : "下载副本";
      var how = CAN_FS
        ? "点下面的「" + act + "」，在弹窗里<b>选中这个原型文件本身</b>并允许保存——之后每次增删改都会自动写回它，不用再点第二次。"
        : "这个浏览器不能直接写文件：点「" + act + "」拿到一份带批注的文件，覆盖原文件即可（用 Chrome 或 Edge 打开可以自动写回）。";
      pop.innerHTML =
        '<div class="anno-pop__head">批注要存进文件，AI 才读得到</div>' +
        "<p style=\"margin:0 0 4px\">你写的批注现在只在这台电脑的浏览器里。" + how + "</p>" +
        '<div class="anno-pop__row"><button type="button" class="anno-btn anno-btn--outline" data-role="later">以后再说</button>' +
        '<button type="button" class="anno-btn" data-role="now">' + ico("i-save") + act + "</button></div>";
      pop.querySelector('[data-role="later"]').onclick = function () { pop.hidden = true; };
      pop.querySelector('[data-role="now"]').onclick = function () { pop.hidden = true; connect(); };
      place(pop, bar.querySelector('[data-act="save"]'));
    }

    /* ---------- 回写文件 ---------- */

    // 序列化时剥掉所有运行时节点与运行时属性，产出的就是这份原型的干净源文件。
    function serialize() {
      var clone = document.documentElement.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("[data-anno-rt]"), function (n) { n.remove(); });
      Array.prototype.forEach.call(clone.querySelectorAll("[data-anno-host]"), function (n) { n.removeAttribute("data-anno-host"); });
      Array.prototype.forEach.call(clone.querySelectorAll("[data-anno-hit]"), function (n) { n.removeAttribute("data-anno-hit"); });
      // 运行时点过的状态不能烘进文件：否则这份原型以后每次打开都停在错误态。
      Array.prototype.forEach.call(clone.querySelectorAll(".screen"), function (el) {
        Array.prototype.slice.call(el.classList).forEach(function (c) {
          if (c.indexOf("state-") === 0) el.classList.remove(c);
        });
      });
      Array.prototype.forEach.call(clone.querySelectorAll("[data-state]"), function (el) {
        el.setAttribute("aria-pressed", String(!el.getAttribute("data-state")));
      });
      Array.prototype.forEach.call(clone.querySelectorAll("[data-anno-runtime]"), function (el) {
        el.setAttribute(el.getAttribute("data-anno-runtime"), el.getAttribute("data-anno-runtime0") || "false");
        el.removeAttribute("data-anno-runtime");
        el.removeAttribute("data-anno-runtime0");
      });
      var notesPanel = clone.querySelector("#proto-notes-panel");
      if (notesPanel) notesPanel.setAttribute("hidden", "");
      clone.removeAttribute("data-anno-picking");
      clone.removeAttribute("data-anno-hidden");
      return "<!doctype html>\n" + clone.outerHTML + "\n";
    }

    function idb(op, value) {
      return new Promise(function (resolve) {
        var req;
        try { req = window.indexedDB.open("prd-anno", 1); } catch (e) { return resolve(null); }
        req.onupgradeneeded = function () { req.result.createObjectStore("kv"); };
        req.onerror = function () { resolve(null); };
        req.onsuccess = function () {
          var db = req.result;
          var tx = db.transaction("kv", op === "get" ? "readonly" : "readwrite");
          var st = tx.objectStore("kv");
          var r = op === "get" ? st.get(KEY) : st.put(value, KEY);
          r.onsuccess = function () { resolve(op === "get" ? r.result : true); };
          r.onerror = function () { resolve(null); };
        };
      });
    }

    function write() {
      if (SERVED) {
        return fetch("save", {
          method: "POST",
          headers: { "Content-Type": "text/html; charset=utf-8", "If-Match": docVersion || "" },
          body: serialize()
        }).then(function (r) {
          if (r.status === 409) return r.json().then(function (d) { return adoptLatest(d.html, d.version); });
          if (!r.ok) return false;
          return r.json().then(function (d) { docVersion = d.version || docVersion; return true; }, function () { return true; });
        }).catch(function () { return false; });
      }
      if (!handle) return Promise.resolve(false);
      return handle.createWritable()
        .then(function (w) { return w.write(serialize()).then(function () { return w.close(); }); })
        .then(function () { return true; })
        .catch(function () { return false; });
    }

    function serializeWith(data, html) {
      var text = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
      var s = html.indexOf('<script type="application/json" id="anno-data">');
      if (s < 0) return html;
      var from = html.indexOf(">", s) + 1;
      var to = html.indexOf("</scr" + "ipt>", from);
      return to < 0 ? html : html.slice(0, from) + "\n" + text + "\n  " + html.slice(to);
    }

    // 版本号一律用服务端给的那个（409 响应体里的 version）。
    // MUST NOT 在这里自己重算：服务端算的是磁盘文件的字节，页面能拿到的只有 HTTP
    // 返回的字符串，两者要逐字节一致才对得上——那是一条没有任何东西守着的隐性契约，
    // 而服务端明明已经算好了。少一处重复实现，也少一个对 crypto.subtle 的依赖。
    function adoptLatest(latestHtml, latestVersion) {
      var doc = new DOMParser().parseFromString(latestHtml, "text/html");
      var slot = doc.getElementById("anno-data");
      var disk = (slot && parse(slot.textContent)) || blank();
      function mergeById(diskList, mineList) {
        var by = {};
        (diskList || []).forEach(function (x) { by[x.id] = x; });
        (mineList || []).forEach(function (x) { by[x.id] = x; });
        return Object.keys(by).map(function (k) { return by[k]; });
      }
      var merged = {
        schema: disk.schema || "prd-annotations@1",
        global: mergeById(disk.global, store.global),
        items: mergeById(disk.items, store.items),
        replies: mergeById(disk.replies, store.replies),
        updatedAt: new Date().toISOString()
      };
      try { window.localStorage.setItem(KEY, JSON.stringify(merged)); } catch (e) { /* 隐私模式 */ }
      store = merged;
      docVersion = latestVersion || docVersion;
      return fetch("save", {
        method: "POST",
        headers: { "Content-Type": "text/html; charset=utf-8", "If-Match": docVersion || "" },
        body: serializeWith(merged, latestHtml)
      }).then(function (response) {
        if (!response.ok) return false;
        return response.json().then(function (data) {
          if (!data || !data.version) return false;
          docVersion = data.version;
          window.location.reload();
          return true;
        }, function () { return false; });
      }, function () { return false; });
    }

    window.addEventListener("beforeunload", function () {
      if (!dirty || !SERVED) return;
      try {
        var blob = new Blob([serialize()], { type: "text/html; charset=utf-8" });
        navigator.sendBeacon("save?v=" + encodeURIComponent(docVersion || ""), blob);
      } catch (e) { /* 忽略 */ }
    });

    function autosave() {
      if (!SERVED && (!handle || !granted)) { paint(); return; }
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        write().then(function (ok) {
          dirty = !ok;
          if (!SERVED) granted = ok;
          else {
            servedOk = ok;
            if (!ok && !retryTimer) retryTimer = window.setTimeout(retry, 4000);
          }
          paint();
        });
      }, 400);
    }

    // 用户手势内调用：首次选文件、或权限过期后重新授权，然后立即写一次。
    function connect() {
      if (!CAN_FS) { download(); return; }
      var step = handle
        ? Promise.resolve(handle)
        : window.showOpenFilePicker({
            multiple: false,
            types: [{ description: "原型 HTML", accept: { "text/html": [".html", ".htm"] } }]
          }).then(function (list) { return list[0]; });

      step.then(function (h) {
        handle = h;
        return h.requestPermission({ mode: "readwrite" });
      }).then(function (p) {
        granted = p === "granted";
        if (!granted) { paint(); return null; }
        idb("put", handle);
        return write().then(function (ok) { dirty = !ok; paint(); });
      }).catch(function () { paint(); });
    }

    function download() {
      var blob = new Blob([serialize()], { type: "text/html" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = FILE;
      a.click();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function copyJson() {
      var text = JSON.stringify({ file: FILE, global: store.global, items: store.items }, null, 2);
      var done = function () { flash("批注 JSON 已复制，可直接粘贴给 AI"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
      } else {
        legacyCopy(text, done);
      }
    }

    function legacyCopy(text, done) {
      var ta = document.createElement("textarea");
      ta.setAttribute("data-anno-rt", "");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* 忽略 */ }
      ta.remove();
    }

    function ico(id, cls) {
      return '<svg class="icon' + (cls ? " " + cls : "") + '"><use href="#' + id + '"/></svg>';
    }

    /* ---------- 工具栏 ---------- */

    var bar = document.createElement("div");
    bar.className = "anno-bar";
    bar.setAttribute("data-anno-rt", "");
    bar.innerHTML =
      '<span class="anno-bar__title">' + ico("i-message", "icon-sm") + "原型批注</span>" +
      '<button type="button" class="anno-btn anno-btn--outline" data-act="pick" aria-pressed="false">' + ico("i-plus") + "加注释</button>" +
      '<button type="button" class="anno-btn anno-btn--outline" data-act="global">' + ico("i-message") + "全局反馈</button>" +
      '<button type="button" class="anno-btn anno-btn--ghost" data-act="toggle" aria-pressed="false">' + ico("i-eye") + "隐藏批注</button>" +
      '<span class="anno-count"></span>' +
      '<span class="anno-bar__spacer"></span>' +
      '<button type="button" class="anno-btn anno-btn--outline" data-act="notes" aria-pressed="false"><svg class="icon"><use href="#i-file"/></svg>设计说明</button>' +
      '<button type="button" class="anno-btn" data-act="save"></button>' +
      '<button type="button" class="anno-btn anno-btn--ghost" data-act="copy">' + ico("i-copy") + "复制 JSON</button>" +
      '<span class="anno-state"><span class="anno-state__dot"></span><span class="anno-state__text"></span></span>';
    document.body.insertBefore(bar, document.body.firstChild);

    var tip = mkPop("anno-pop anno-pop--tip");
    var pop = mkPop("anno-pop");
    var cursor = document.createElement("div");
    cursor.className = "anno-cursor";
    cursor.setAttribute("data-anno-rt", "");
    cursor.innerHTML = ico("i-plus");
    cursor.hidden = true;
    document.body.appendChild(cursor);

    function mkPop(cls) {
      var el = document.createElement("div");
      el.className = cls;
      el.setAttribute("data-anno-rt", "");
      el.hidden = true;
      document.body.appendChild(el);
      return el;
    }

    function paint() {
      var live = store.items.filter(function (it) { return !!findEl(it.id); }).length;
      var lost = store.items.length - live;
      bar.querySelector(".anno-count").textContent =
        "元素批注 " + live + (lost ? "（另有 " + lost + " 条已失联）" : "") + " · 全局 " + store.global.length;

      var save = bar.querySelector('[data-act="save"]');
      var copy = bar.querySelector('[data-act="copy"]');
      var state = bar.querySelector(".anno-state");
      var text = bar.querySelector(".anno-state__text");
      state.className = "anno-state";
      save.hidden = false;
      copy.hidden = SERVED && servedOk;
      if (SERVED) {
        // 预览服务模式：批注直接写回原文件，用户什么都不用点
        save.hidden = servedOk && !dirty;
        save.className = "btn btn-outline btn-sm";
        save.innerHTML = ico("i-save") + "重试写回";
        save.title = "预览服务暂时写不进文件时，点一下重试";
        if (servedOk && !dirty) {
          state.className = "anno-state anno-state--saved";
          text.textContent = "批注自动写回文件，无需操作";
        } else if (servedOk) {
          state.className = "anno-state anno-state--dirty";
          text.textContent = "正在写回…";
        } else {
          text.textContent = "预览服务没响应——批注暂存本机，恢复后会补写";
        }
      } else if (!CAN_FS) {
        save.className = "btn btn-sm";
        save.innerHTML = ico("i-download") + "下载副本";
        save.title = "本浏览器不能直接写文件：下载后覆盖原文件，AI 才读得到这些批注";
        text.textContent = "批注还没进文件——下载后覆盖原文件";
      } else if (handle && granted && !dirty) {
        save.className = "btn btn-sm";
        save.innerHTML = ico("i-check") + "已保存到文件";
        save.title = "每次增删改都会自动写回 " + FILE + "，不用再点";
        state.className = "anno-state anno-state--saved";
        text.textContent = "批注已在文件里，AI 读得到";
      } else if (handle && dirty) {
        save.className = "btn btn-sm";
        save.innerHTML = ico("i-save") + "保存到文件";
        save.title = "有改动还没写回文件，点一下补写";
        state.className = "anno-state anno-state--dirty";
        text.textContent = "有改动还没写回文件";
      } else {
        save.className = "btn btn-sm";
        save.innerHTML = ico("i-save") + "保存到文件";
        save.title = "点一下，在弹窗里选中这个原型文件本身；之后每次批注都会自动写回它";
        text.textContent = "批注只在本机浏览器里，AI 读不到";
      }
    }

    // 预览服务写回失败后自动退避重试——状态栏承诺了"恢复后会补写"，就得真的补。
    var retryTimer = 0;

    function retry() {
      window.clearTimeout(retryTimer);
      retryTimer = 0;
      write().then(function (ok) {
        servedOk = ok;
        dirty = !ok;
        paint();
        if (!ok) retryTimer = window.setTimeout(retry, 4000);
      });
    }

    function flash(msg) {
      bar.querySelector(".anno-state__text").textContent = msg;
      window.setTimeout(paint, 2200);
    }


    bar.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var act = btn.getAttribute("data-act");
      if (act === "pick") setPicking(!picking);
      else if (act === "global") openGlobal();
      else if (act === "toggle") {
        var on = document.documentElement.hasAttribute("data-anno-hidden");
        if (on) document.documentElement.removeAttribute("data-anno-hidden");
        else document.documentElement.setAttribute("data-anno-hidden", "");
        btn.setAttribute("aria-pressed", String(!on));
        btn.innerHTML = ico("i-eye") + (on ? "隐藏批注" : "显示批注");
      } else if (act === "save") {
        if (SERVED) retry();
        else connect();
      }
      else if (act === "notes") {
        var panel = document.getElementById("proto-notes-panel");
        if (!panel) return;
        panel.hidden = !panel.hidden;
        btn.setAttribute("aria-pressed", String(!panel.hidden));
      }
      else if (act === "copy") copyJson();
    });

    /* ---------- 渲染批注气泡 ---------- */

    function findEl(id) { return document.querySelector('[data-anno-user="' + id + '"]'); }
    function hostOf(el) { return VOID.test(el.tagName) && el.parentElement ? el.parentElement : el; }

    function mkPin(kind, label, title) {
      var pin = document.createElement("button");
      pin.type = "button";
      pin.className = "anno-pin anno-pin--" + kind;
      pin.setAttribute("data-anno-rt", "");
      pin.setAttribute("aria-label", title ? title.slice(0, 80) : "批注");
      if (label) pin.textContent = label;
      else pin.innerHTML = ico(kind === "ask" ? "i-alert" : "i-message");
      return pin;
    }

    function attach(el, pin) {
      var host = hostOf(el);
      // 属性恒加（点图钉时靠它 closest 回宿主），但只有本来是 static 的才取值 "rel" 提升为
      // relative——图钉是 absolute 的，需要一个定位祖先。元素自己已是 absolute / relative /
      // fixed / sticky 时 MUST NOT 提升：[data-anno-host="rel"] { position: relative } 与作者的
      // 单 class 规则同权重且排在后面，提升了就会把绝对定位元素打回文档流、当场错位。
      // 同一元素挂多枚图钉时只在第一枚判定：此刻 host 可能已被上一枚提升成 relative，
      // 再判一次就会读到提升后的值、误判成"本来就不是 static"而把提升撤掉。
      if (host.getAttribute("data-anno-host") === null) {
        var pos = "static";
        try { pos = window.getComputedStyle(host).position || "static"; } catch (err) { pos = "static"; }
        host.setAttribute("data-anno-host", pos === "static" ? "rel" : "");
      }
      var n = host.querySelectorAll(":scope > .anno-pin").length;
      // 贴内侧，理由同 .anno-pin 的 top：外侧偏移会被 overflow 祖先裁掉。
      pin.style.right = (2 + n * 21) + "px";
      host.appendChild(pin);
    }

    function render() {
      Array.prototype.forEach.call(document.querySelectorAll(".anno-pin"), function (n) { n.remove(); });
      Array.prototype.forEach.call(document.querySelectorAll("[data-anno-host]"), function (n) { n.removeAttribute("data-anno-host"); });

      Array.prototype.forEach.call(document.querySelectorAll("[data-anno]"), function (el) {
        var text = el.getAttribute("data-anno");
        if (!text) return;
            var kind = el.getAttribute("data-anno-kind") === "question" ? "ask" : "note";
            var pin = mkPin(kind, "", text);
            pin.setAttribute("data-anno-text", text);
            var nid = el.getAttribute("data-anno-id");
            if (nid) pin.setAttribute("data-anno-note-id", nid);
            attach(el, pin);
      });

      store.items.forEach(function (it, i) {
        var el = findEl(it.id);
        if (!el) return;
        var pin = mkPin("user", String(i + 1), it.text);
        pin.setAttribute("data-anno-ref", it.id);
        pin.setAttribute("data-anno-text", it.text || "");
        attach(el, pin);
      });

      paint();
    }

    /* ---------- 浮层 ---------- */

    function place(el, anchor) {
      el.hidden = false;
      var r = anchor.getBoundingClientRect();
      var w = el.offsetWidth;
      var h = el.offsetHeight;
      var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), Math.max(8, window.innerWidth - w - 8));
      var top = r.bottom + 8;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
      el.style.left = left + "px";
      el.style.top = top + "px";
    }

    document.addEventListener("mouseover", function (e) {
      var pin = e.target.closest && e.target.closest(".anno-pin");
      if (!pin) return;
      tip.textContent = pin.getAttribute("data-anno-text") || "";
      if (!tip.textContent) { tip.hidden = true; return; }
      place(tip, pin);
    });

    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(".anno-pin")) tip.hidden = true;
    });

    document.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var pin = e.target.closest(".anno-pin");
      if (pin) {
        var ref = pin.getAttribute("data-anno-ref");
            if (ref) { e.preventDefault(); e.stopPropagation(); openEditor(ref, pin); }
            else {
              var host = pin.closest("[data-anno-host]");
              var want = pin.getAttribute("data-anno-text") || "";
              var noteEl = null;
              if (host) {
                var cands = Array.prototype.slice.call(host.querySelectorAll("[data-anno]"));
                if (host.hasAttribute("data-anno")) cands.unshift(host);
                noteEl = cands.filter(function (n) { return n.getAttribute("data-anno") === want; })[0] || null;
              }
              if (noteEl) { e.preventDefault(); e.stopPropagation(); openNote(noteEl, pin); }
              else { tip.textContent = want; place(tip, pin); }
            }
        return;
      }
      if (!e.target.closest(".anno-pop") && !e.target.closest(".anno-bar")) pop.hidden = true;
    }, true);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (picking) setPicking(false);
      pop.hidden = true;
      tip.hidden = true;
    });

    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }

    function openEditor(id, anchor) {
      var it = store.items.filter(function (x) { return x.id === id; })[0];
      if (!it) return;
      pop.innerHTML =
        '<div class="anno-pop__head">' + esc(it.screen || "本页") + " · " + esc(it.label || it.tag || "元素") + "</div>" +
        '<textarea data-role="text"></textarea>' +
        '<div class="anno-pop__row anno-pop__row--split">' +
        '<button type="button" class="anno-btn anno-btn--ghost" data-role="del">' + ico("i-trash") + "删除</button>" +
        '<span class="row"><button type="button" class="anno-btn anno-btn--outline" data-role="close">关闭</button>' +
        '<button type="button" class="anno-btn" data-role="ok">保存</button></span></div>';
      var ta = pop.querySelector('[data-role="text"]');
      ta.value = it.text || "";
      pop.querySelector('[data-role="ok"]').onclick = function () {
        it.text = ta.value.trim();
        it.at = new Date().toISOString();
        pop.hidden = true;
        persist();
      };
      pop.querySelector('[data-role="close"]').onclick = function () { pop.hidden = true; };
      pop.querySelector('[data-role="del"]').onclick = function () {
        var el = findEl(id);
        if (el) el.removeAttribute("data-anno-user");
        store.items = store.items.filter(function (x) { return x.id !== id; });
        pop.hidden = true;
        persist();
      };
      place(pop, anchor);
      ta.focus();
    }

    // 发号 MUST 同时看两处：DOM 里已挂的 data-anno-id，**以及已被回复引用过的 noteId**。
    // 只看 DOM 会在改稿后重新从 a1 发号——新片段没把 data-anno-id 抄过来时 DOM 里一个都
    // 没有，而 store.replies 里旧回复还引用着 a1，于是那条旧回复被挂到一条毫不相干的新
    // 说明上，页面照常打开、零报错，用户只会觉得"这条回复我没写过"。
    function nextAnnoId() {
      var used = [];
      Array.prototype.forEach.call(document.querySelectorAll("[data-anno-id]"), function (el) {
        used.push({ id: el.getAttribute("data-anno-id") });
      });
      store.replies.forEach(function (r) { used.push({ id: r.noteId }); });
      return nextId(used, "a");
    }

    function openNote(el, pin) {
      var noteText = el.getAttribute("data-anno") || "";
      var isQuestion = el.getAttribute("data-anno-kind") === "question";
      var nid = el.getAttribute("data-anno-id");
      var mine = nid ? store.replies.filter(function (r) { return r.noteId === nid; }) : [];
      var rows = mine.map(function (r) {
        return '<li data-rid="' + esc(r.id) + '"><p>' + esc(r.text) + '</p><span class="row">' +
          '<button type="button" class="anno-btn anno-btn--ghost anno-btn--icon" data-redit="' + esc(r.id) + '" aria-label="修改">' + ico("i-edit") + '</button>' +
          '<button type="button" class="anno-btn anno-btn--ghost anno-btn--icon" data-rdel="' + esc(r.id) + '" aria-label="删除">' + ico("i-x") + '</button></span></li>';
      }).join("");
      pop.innerHTML =
        '<div class="anno-pop__head">' + esc(screenOf(el) || "本页") + " · " + esc(labelOf(el) || el.tagName.toLowerCase()) + (isQuestion ? " · 待你拍板" : "") + "</div>" +
        '<p class="anno-note__text">' + esc(noteText) + "</p>" +
        (rows ? '<ul class="anno-list">' + rows + "</ul>" : "") +
        '<p class="anno-editing" data-role="editing-hint" hidden>' + ico("i-edit") + '正在修改上面高亮的那条回复</p>' +
        '<textarea data-role="text" placeholder="' + (isQuestion ? "写下你的答复" : "对这条说明的意见") + '"></textarea>' +
        '<div class="anno-pop__row"><button type="button" class="anno-btn anno-btn--outline" data-role="close">关闭</button>' +
        '<button type="button" class="anno-btn anno-btn--outline" data-role="cancel-edit" hidden>放弃修改</button>' +
        '<button type="button" class="anno-btn" data-role="reply">' + ico("i-message") + "回复</button></div>";
      var ta = pop.querySelector('[data-role="text"]');
      var editing = null;
      // 进出编辑态 MUST 走这一个函数。此前编辑只改了提交按钮的文案，被编辑的那条仍原样
      // 列在上面、也没有退出的出口，于是"改第几条"和"是不是在改"都看不出来，用户以为
      // 自己在新增第二条回复。
      function setEditing(rid) {
        editing = rid;
        var hint = pop.querySelector('[data-role="editing-hint"]');
        var cancel = pop.querySelector('[data-role="cancel-edit"]');
        var submit = pop.querySelector('[data-role="reply"]');
        Array.prototype.forEach.call(pop.querySelectorAll(".anno-list li"), function (li) {
          li.classList.toggle("is-editing", !!rid && li.getAttribute("data-rid") === rid);
        });
        if (hint) hint.hidden = !rid;
        if (cancel) cancel.hidden = !rid;
        submit.innerHTML = rid ? ico("i-check") + "保存修改" : ico("i-message") + "回复";
        ta.placeholder = rid ? "修改这条回复" : (isQuestion ? "写下你的答复" : "对这条说明的意见");
        if (!rid) ta.value = "";
      }
      pop.querySelector('[data-role="reply"]').onclick = function () {
        var v = ta.value.trim();
        pop.hidden = true;
        if (!v) return;
        if (editing) {
          store.replies.forEach(function (r) {
            if (r.id === editing) { r.text = v; r.at = new Date().toISOString(); }
          });
          persist();
          return;
        }
        if (!nid) {
          nid = nextAnnoId();
          el.setAttribute("data-anno-id", nid);
          pin.setAttribute("data-anno-note-id", nid);
        }
        store.replies.push({
          id: nextId(store.replies, "r"), noteId: nid, noteText: noteText,
          noteKind: isQuestion ? "question" : "note", screen: screenOf(el),
          label: labelOf(el), tag: el.tagName.toLowerCase(), text: v,
          at: new Date().toISOString()
        });
        persist();
      };
      pop.querySelector('[data-role="close"]').onclick = function () { pop.hidden = true; };
      pop.querySelector('[data-role="cancel-edit"]').onclick = function () { setEditing(null); ta.focus(); };
      Array.prototype.forEach.call(pop.querySelectorAll("[data-rdel]"), function (b) {
        b.onclick = function () {
          store.replies = store.replies.filter(function (r) { return r.id !== b.getAttribute("data-rdel"); });
          pop.hidden = true;
          persist();
        };
      });
      Array.prototype.forEach.call(pop.querySelectorAll("[data-redit]"), function (b) {
        b.onclick = function () {
          var rid = b.getAttribute("data-redit");
          var cur = store.replies.filter(function (r) { return r.id === rid; })[0];
          if (!cur) return;
          ta.value = cur.text;
          setEditing(rid);
          ta.focus();
        };
      });
      place(pop, pin);
      ta.focus();
    }

    function openGlobal() {
      var lost = store.items.filter(function (it) { return !findEl(it.id); });
      var rows = store.global.map(function (g) {
        return "<li><p>" + esc(g.text) + '</p><button type="button" class="anno-btn anno-btn--ghost anno-btn--icon" data-del="' + esc(g.id) + '" aria-label="删除">' + ico("i-x") + "</button></li>";
      }).join("");
      var lostRows = lost.map(function (it) {
        return "<li><p><small>失联 · " + esc(it.screen || "") + " · " + esc(it.label || "") + "</small><br />" + esc(it.text) +
          '</p><button type="button" class="anno-btn anno-btn--ghost anno-btn--icon" data-drop="' + esc(it.id) + '" aria-label="删除">' + ico("i-x") + "</button></li>";
      }).join("");
      pop.innerHTML =
        '<div class="anno-pop__head">全局反馈（针对整份原型）</div>' +
        (rows ? '<ul class="anno-list">' + rows + "</ul>" : "") +
        '<textarea data-role="text" placeholder="写下对整份原型的意见"></textarea>' +
        '<div class="anno-pop__row"><button type="button" class="anno-btn anno-btn--outline" data-role="close">关闭</button>' +
        '<button type="button" class="anno-btn" data-role="add">' + ico("i-plus") + "添加</button></div>" +
        (lostRows
          ? '<div class="anno-pop__head" style="margin-top:14px">已失联的元素批注（界面被改掉了）</div><ul class="anno-list">' + lostRows + "</ul>"
          : "");
      var ta = pop.querySelector('[data-role="text"]');
      pop.querySelector('[data-role="add"]').onclick = function () {
        var v = ta.value.trim();
        if (!v) return;
        store.global.push({ id: nextId(store.global, "g"), text: v, at: new Date().toISOString() });
        pop.hidden = true;
        persist();
      };
      pop.querySelector('[data-role="close"]').onclick = function () { pop.hidden = true; };
      Array.prototype.forEach.call(pop.querySelectorAll("[data-del]"), function (b) {
        b.onclick = function () {
          store.global = store.global.filter(function (g) { return g.id !== b.getAttribute("data-del"); });
          pop.hidden = true;
          persist();
        };
      });
      Array.prototype.forEach.call(pop.querySelectorAll("[data-drop]"), function (b) {
        b.onclick = function () {
          store.items = store.items.filter(function (x) { return x.id !== b.getAttribute("data-drop"); });
          pop.hidden = true;
          persist();
        };
      });
      place(pop, bar.querySelector('[data-act="global"]'));
      ta.focus();
    }

    /* ---------- 拾取模式 ---------- */

    function setPicking(on) {
      picking = on;
      var btn = bar.querySelector('[data-act="pick"]');
      btn.setAttribute("aria-pressed", String(on));
      btn.innerHTML = on ? ico("i-x") + "点选元素…（Esc 退出）" : ico("i-plus") + "加注释";
      if (on) moveCursor();
      cursor.hidden = !on;
      if (on) document.documentElement.setAttribute("data-anno-picking", "");
      else {
        document.documentElement.removeAttribute("data-anno-picking");
        clearHit();
      }
    }

    function clearHit() {
      Array.prototype.forEach.call(document.querySelectorAll("[data-anno-hit]"), function (n) { n.removeAttribute("data-anno-hit"); });
    }

    // 始终记录指针位置：进入拾取模式时鼠标往往停在刚点过的按钮上，不会立刻产生
    // mousemove，光标气泡就会停在上一次的位置直到鼠标移动——所以要拿它先摆正。
    var ptrX = 0;
    var ptrY = 0;

    document.addEventListener("mousemove", function (e) {
      ptrX = e.clientX;
      ptrY = e.clientY;
      if (!picking) return;
      moveCursor();
    });

    function moveCursor() {
      cursor.style.left = ptrX + "px";
      cursor.style.top = ptrY + "px";
    }

    CANVAS.addEventListener("mouseover", function (e) {
      if (!picking) return;
      clearHit();
      var el = e.target;
      if (el && el.nodeType === 1 && !el.closest(".anno-pin")) el.setAttribute("data-anno-hit", "");
    });

    CANVAS.addEventListener("click", function (e) {
      if (!picking) return;
      e.preventDefault();
      e.stopPropagation();
      var el = e.target;
      if (!el || el.nodeType !== 1 || el.closest(".anno-pin")) return;
      setPicking(false);
      newNote(el);
    }, true);

    function screenOf(el) {
      var wrap = el.closest(".device-wrap");
      var name = wrap && wrap.querySelector(".device-name");
      return name ? name.textContent.trim() : "";
    }

    function labelOf(el) {
      var t = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t && el.value) t = String(el.value);
      if (!t) t = el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
      return t.slice(0, 60);
    }

    // 结构路径只作辅助线索；定位以元素上的 data-anno-user 为准。
    function pathOf(el) {
      var parts = [];
      var node = el;
      while (node && node.nodeType === 1 && node !== CANVAS && parts.length < 6) {
        var seg = node.tagName.toLowerCase();
        if (node.id) { parts.unshift("#" + node.id); break; }
        var cls = String(node.className || "").trim().split(/\s+/).filter(function (c) {
          return c && c.indexOf("anno-") !== 0;
        })[0];
        if (cls) seg += "." + cls;
        var p = node.parentElement;
        if (p) {
          var same = Array.prototype.filter.call(p.children, function (n) { return n.tagName === node.tagName; });
          if (same.length > 1) seg += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
        }
        parts.unshift(seg);
        node = node.parentElement;
      }
      return parts.join(" > ");
    }

    function newNote(el) {
      var existing = el.getAttribute("data-anno-user");
      if (existing) {
        var oldPin = document.querySelector('[data-anno-ref="' + existing + '"]');
        if (oldPin) { openEditor(existing, oldPin); return; }
      }
      var id = nextId(store.items, "u");
      pop.innerHTML =
        '<div class="anno-pop__head">' + esc(screenOf(el) || "本页") + " · " + esc(labelOf(el) || el.tagName.toLowerCase()) + "</div>" +
        '<textarea data-role="text" placeholder="对这个元素的意见"></textarea>' +
        '<div class="anno-pop__row"><button type="button" class="anno-btn anno-btn--outline" data-role="close">取消</button>' +
        '<button type="button" class="anno-btn" data-role="ok">保存</button></div>';
      var ta = pop.querySelector('[data-role="text"]');
      pop.querySelector('[data-role="ok"]').onclick = function () {
        var v = ta.value.trim();
        pop.hidden = true;
        if (!v) return;
        el.setAttribute("data-anno-user", id);
        store.items.push({
          id: id,
          screen: screenOf(el),
          tag: el.tagName.toLowerCase(),
          label: labelOf(el),
          path: pathOf(el),
          text: v,
          at: new Date().toISOString()
        });
        persist();
      };
      pop.querySelector('[data-role="close"]').onclick = function () { pop.hidden = true; };
      place(pop, el);
      ta.focus();
    }

    /* ---------- 启动 ---------- */

    render();
    if (SERVED) {
      fetch("", { method: "HEAD" }).then(function (r) {
        docVersion = r.headers.get("x-proto-version");
      }).catch(function () { /* 忽略 */ });
    }
    if (CAN_FS) {
      idb("get").then(function (h) {
        if (!h) return;
        handle = h;
        return h.queryPermission({ mode: "readwrite" }).then(function (p) {
          granted = p === "granted";
          paint();
        });
      }).catch(function () { /* 忽略 */ });
    }
  })();
  