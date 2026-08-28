
    function setScreenState(screenEl, nextState) {
      Array.prototype.slice.call(screenEl.classList)
        .filter(function (c) { return c.indexOf("state-") === 0; })
        .forEach(function (c) { screenEl.classList.remove(c); });
      if (nextState) screenEl.classList.add(nextState);
    }

    window.setScreenState = setScreenState;

    // 屏注解区的状态切换按钮：带 data-state="state-xxx" 就能点，行为由本区统一提供。
    // 这是**声明式属性 hook**，与下面三个同构：它不认按钮名、也没有改 setScreenState 的
    // 签名（那条 MUST NOT 仍然成立），只是把"点这个元素 → 把它所在那一屏切到目标态"
    // 这条恒定语义收进容器。此前它不在容器里，产出方得自己写绑定，而按钮属性名（data-act）
    // 与示范选择器（[data-state]）在框架内部两处不一致、骨架又零示范，实测导致零个监听器
    // 绑上：按钮能点、页面零报错、状态永远不切。
    document.querySelectorAll("[data-state]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const wrap = btn.closest(".device-wrap");
        const screenEl = wrap && wrap.querySelector(".screen");
        if (!screenEl) return;
        setScreenState(screenEl, btn.getAttribute("data-state"));
        const group = btn.closest(".screen-notes__acts");
        if (group) {
          group.querySelectorAll("[data-state]").forEach((other) => {
            other.setAttribute("aria-pressed", String(other === btn));
          });
        }
      });
    });

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

    // 开关类控件按 aria-checked 属性认，不认 class：外观层默认不装配后，产出方自己
    // 画的开关不会带 .switch / .checkbox，按 class 认会让这条 hook 在默认路径上恒失效。
    document.querySelectorAll("[aria-checked]").forEach((el) => {
      el.addEventListener("click", () => {
        if (!el.hasAttribute("data-anno-runtime")) {
          el.setAttribute("data-anno-runtime", "aria-checked");
          el.setAttribute("data-anno-runtime0", el.getAttribute("aria-checked") || "false");
        }
        el.setAttribute("aria-checked", String(el.getAttribute("aria-checked") !== "true"));
      });
    });
  