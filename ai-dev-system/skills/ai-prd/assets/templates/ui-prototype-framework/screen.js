
    function setScreenState(screenEl, nextState) {
      Array.prototype.slice.call(screenEl.classList)
        .filter(function (c) { return c.indexOf("state-") === 0; })
        .forEach(function (c) { screenEl.classList.remove(c); });
      if (nextState) screenEl.classList.add(nextState);
    }

    window.setScreenState = setScreenState;

    // 主行动按钮：演示"提交 → 处理中 → 成功"的业务反馈
    document.querySelectorAll("[data-submit]").forEach((submit) => {
      submit.addEventListener("click", () => {
        const screenEl = submit.closest(".screen");
        if (!screenEl) return;
        setScreenState(screenEl, "state-loading");
        window.setTimeout(() => setScreenState(screenEl, "state-success"), 650);
      });
    });

    // Tabs / 开关类控件的原型级交互：点谁谁选中
    document.querySelectorAll('[role="tablist"]').forEach((list) => {
      list.addEventListener("click", (e) => {
        const tab = e.target.closest('[role="tab"]');
        if (!tab) return;
        list.querySelectorAll('[role="tab"]').forEach((t) => {
          if (!t.hasAttribute("data-anno-runtime")) {
            t.setAttribute("data-anno-runtime", "aria-selected");
            t.setAttribute("data-anno-runtime0", t.getAttribute("aria-selected") || "false");
          }
          t.setAttribute("aria-selected", String(t === tab));
        });
      });
    });

    document.querySelectorAll(".switch, .checkbox").forEach((el) => {
      el.addEventListener("click", () => {
        if (!el.hasAttribute("data-anno-runtime")) {
          el.setAttribute("data-anno-runtime", "aria-checked");
          el.setAttribute("data-anno-runtime0", el.getAttribute("aria-checked") || "false");
        }
        el.setAttribute("aria-checked", String(el.getAttribute("aria-checked") !== "true"));
      });
    });
  