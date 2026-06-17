(function () {
  const app = document.getElementById("app");
  const state = {
    routes: [],
    route: null,
    shareRoute: null,
    editingPointId: null,
    wizard: {
      step: 1,
      category: "real_estate_viewing",
      name: "",
      mainAddress: "",
      assigneeName: "",
      memo: ""
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function clearApp() {
    app.textContent = "";
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function setView(path) {
    history.pushState({}, "", path);
    route();
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) {
      let message = "通信に失敗しました。";
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {}
      throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function formatDateTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function header(title, subtitle) {
    const box = el("header", "top-header");
    const h1 = el("h1", "", title);
    box.appendChild(h1);
    if (subtitle) box.appendChild(el("p", "", subtitle));
    return box;
  }

  function primaryButton(text, className = "btn btn-primary") {
    return el("button", className, text);
  }

  function statusClass(status) {
    if (status === "完了") return "status done";
    if (status === "進行中") return "status active";
    return "status idle";
  }

  function progressText(route) {
    return `${route.donePoints || 0}/${route.pointCount || 0}`;
  }

  function renderRouteCard(routeData) {
    const card = el("article", "route-card");
    const top = el("div", "route-card-top");
    const title = el("h2", "", routeData.name);
    const progress = el("span", "progress-pill", progressText(routeData));
    top.append(title, progress);

    const info = el("div", "route-info-grid");
    info.appendChild(routeInfoItem("担当者", routeData.assigneeName || "未設定"));
    info.appendChild(routeInfoItem("カテゴリ", routeData.category === "real_estate_viewing" ? "不動産の内覧" : "汎用"));
    info.appendChild(routeInfoItem("進捗", progressText(routeData)));
    const statusItem = el("div", "route-info-item");
    statusItem.appendChild(el("small", "", "ステータス"));
    statusItem.appendChild(el("span", statusClass(routeData.status), routeData.status));
    info.appendChild(statusItem);

    const address = el("p", "muted", routeData.mainAddress || "基準住所未設定");
    const actions = el("div", "card-actions");
    const edit = primaryButton("編集", "btn btn-secondary");
    const share = primaryButton("共有画面", "btn btn-map");
    edit.addEventListener("click", () => setView(`/routes/${routeData.id}`));
    share.addEventListener("click", () => setView(`/share/${routeData.shareId}`));
    actions.append(edit, share);
    card.append(top, info, address, actions);
    return card;
  }

  function routeInfoItem(label, value) {
    const item = el("div", "route-info-item");
    item.appendChild(el("small", "", label));
    item.appendChild(el("strong", "", value));
    return item;
  }

  function renderCategorySelector() {
    const wrap = el("div", "category-grid");
    const categories = [
      { id: "real_estate_viewing", title: "不動産の内覧", text: "鍵借り、駐車、物件確認、返却まで" },
      { id: "general", title: "汎用ルート", text: "旅行、お遣い、営業訪問、現場作業など" }
    ];
    categories.forEach((category) => {
      const card = el("button", `category-card ${state.wizard.category === category.id ? "selected" : ""}`);
      card.type = "button";
      card.appendChild(el("strong", "", category.title));
      card.appendChild(el("span", "", category.text));
      card.addEventListener("click", () => {
        state.wizard.category = category.id;
        renderNewRoute();
      });
      wrap.appendChild(card);
    });
    return wrap;
  }

  function renderStepProgress(step) {
    const wrap = el("div", "step-progress");
    [1, 2, 3].forEach((number) => {
      const item = el("div", `step ${number === step ? "current" : ""} ${number < step ? "finished" : ""}`);
      item.appendChild(el("span", "", String(number)));
      item.appendChild(el("small", "", number === 1 ? "用途" : number === 2 ? "基本" : "確認"));
      wrap.appendChild(item);
    });
    return wrap;
  }

  async function renderRouteList() {
    clearApp();
    app.appendChild(header("道案内くん", "寄り道つきルート指示書"));
    const content = el("main", "content");
    try {
      state.routes = await api("/api/routes");
      if (state.routes.length === 0) {
        content.appendChild(el("p", "empty", "ルート案件はまだありません。"));
      } else {
        state.routes.forEach((routeData) => content.appendChild(renderRouteCard(routeData)));
      }
    } catch (error) {
      content.appendChild(el("p", "error", error.message));
    }
    const create = primaryButton("新しいルートを作成", "btn btn-primary btn-fixed");
    create.addEventListener("click", () => {
      state.wizard = { step: 1, category: "real_estate_viewing", name: "", mainAddress: "", assigneeName: "", memo: "" };
      setView("/new");
    });
    content.appendChild(create);
    app.appendChild(content);
  }

  function collectWizardInputs() {
    const name = qs("#route-name");
    const mainAddress = qs("#main-address");
    const assigneeName = qs("#assignee-name");
    const memo = qs("#route-memo");
    if (name) state.wizard.name = name.value;
    if (mainAddress) state.wizard.mainAddress = mainAddress.value;
    if (assigneeName) state.wizard.assigneeName = assigneeName.value;
    if (memo) state.wizard.memo = memo.value;
  }

  function formField(labelText, id, value, placeholder, type = "text") {
    const label = el("label", "field");
    label.appendChild(el("span", "", labelText));
    const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.id = id;
    input.value = value || "";
    input.placeholder = placeholder || "";
    label.appendChild(input);
    return label;
  }

  function renderNewRoute() {
    clearApp();
    app.appendChild(header("新規ルート作成", "3ステップで共有ルートを作ります"));
    const main = el("main", "content");
    main.appendChild(renderStepProgress(state.wizard.step));

    if (state.wizard.step === 1) {
      main.appendChild(el("h2", "section-title", "用途カテゴリ"));
      main.appendChild(renderCategorySelector());
    }
    if (state.wizard.step === 2) {
      const formCard = el("section", "form-card");
      formCard.appendChild(formField("ルート名", "route-name", state.wizard.name, "例：山田様 内覧ルート"));
      formCard.appendChild(formField("基準住所・物件住所", "main-address", state.wizard.mainAddress, "例：東京都..."));
      formCard.appendChild(formField("担当者名", "assignee-name", state.wizard.assigneeName, "例：佐藤"));
      formCard.appendChild(formField("全体メモ", "route-memo", state.wizard.memo, "共有画面や報告に使うメモ", "textarea"));
      main.appendChild(formCard);
    }
    if (state.wizard.step === 3) {
      const summary = el("div", "card");
      summary.innerHTML = `
        <h2>${escapeHtml(state.wizard.name || "未命名ルート")}</h2>
        <p><strong>カテゴリ:</strong> ${escapeHtml(state.wizard.category === "real_estate_viewing" ? "不動産の内覧" : "汎用ルート")}</p>
        <p><strong>基準住所:</strong> ${escapeHtml(state.wizard.mainAddress || "未設定")}</p>
        <p><strong>担当者:</strong> ${escapeHtml(state.wizard.assigneeName || "未設定")}</p>
      `;
      if (state.wizard.category === "real_estate_viewing") {
        summary.appendChild(el("p", "notice-inline", "5つの寄り道ポイントを自動追加します。"));
      }
      main.appendChild(summary);
    }

    const nav = el("div", "wizard-nav");
    const back = primaryButton(state.wizard.step === 1 ? "一覧へ戻る" : "戻る", "btn btn-secondary");
    back.addEventListener("click", () => {
      collectWizardInputs();
      if (state.wizard.step === 1) setView("/");
      else {
        state.wizard.step -= 1;
        renderNewRoute();
      }
    });
    nav.appendChild(back);

    const next = primaryButton(state.wizard.step === 3 ? "作成する" : "次へ", "btn btn-primary");
    next.addEventListener("click", async () => {
      collectWizardInputs();
      if (state.wizard.step < 3) {
        state.wizard.step += 1;
        renderNewRoute();
        return;
      }
      const routeData = await api("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          name: state.wizard.name,
          category: state.wizard.category,
          mainAddress: state.wizard.mainAddress,
          assigneeName: state.wizard.assigneeName,
          memo: state.wizard.memo
        })
      });
      setView(`/routes/${routeData.id}`);
    });
    nav.appendChild(next);
    main.appendChild(nav);
    app.appendChild(main);
  }

  function checklistText(point) {
    return point.checklist.map((item) => item.text).join("\n");
  }

  function renderNoticeBanner(text) {
    const banner = el("div", "notice-banner");
    banner.textContent = text;
    return banner;
  }

  function renderPointListItem(point, index, routeData) {
    const isEditing = state.editingPointId === point.id;
    const card = el("article", `point-card ${isEditing ? "editing" : "collapsed"}`);
    const head = el("div", "point-head");
    head.appendChild(el("span", "point-number", String(index + 1)));
    const title = el("div", "point-title");
    title.appendChild(el("h3", "", point.title));
    const badge = el("small", point.type === "parking" ? "point-badge parking" : "point-badge", point.type === "parking" ? "駐車場ポイント" : "通常ポイント");
    title.appendChild(badge);
    head.appendChild(title);
    card.appendChild(head);

    const summary = el("div", "point-summary");
    const addressLine = el("div", "point-summary-row");
    addressLine.appendChild(el("small", "", "住所"));
    addressLine.appendChild(el("span", "", point.address || "住所未設定"));
    summary.appendChild(addressLine);

    const warningLine = el("div", "point-summary-row");
    warningLine.appendChild(el("small", "", "注意点"));
    warningLine.appendChild(el("span", "warning-summary", point.warning || "なし"));
    summary.appendChild(warningLine);

    const metaLine = el("div", "point-summary-meta");
    metaLine.appendChild(el("span", "point-check-count", `チェック ${point.checklist.length}件`));
    if (point.type === "parking") metaLine.appendChild(el("span", "parking-summary", "住所未設定OK・周辺P検索可"));
    summary.appendChild(metaLine);
    card.appendChild(summary);

    if (point.type === "parking" && !point.address) {
      card.appendChild(renderNoticeBanner("駐車場ポイントは住所未設定でも保存できます。検索には基準住所を使います。"));
    }

    const toggleRow = el("div", "point-toggle-row");
    const toggle = primaryButton(isEditing ? "編集を閉じる" : "編集", isEditing ? "btn btn-secondary point-edit-toggle" : "btn btn-primary point-edit-toggle");
    toggle.addEventListener("click", () => {
      state.editingPointId = isEditing ? null : point.id;
      renderEditRoute(routeData.id);
    });
    toggleRow.appendChild(toggle);
    card.appendChild(toggleRow);

    if (!isEditing) {
      return card;
    }

    const details = el("div", "point-details point-edit-panel");
    details.appendChild(formField("タイトル", `title-${point.id}`, point.title, "例：鍵を借りる"));
    details.appendChild(formField("住所", `address-${point.id}`, point.address, "駐車場ポイントは空でも可"));
    details.appendChild(formField("電話番号", `phone-${point.id}`, point.phone, "例：03-0000-0000"));
    details.appendChild(formField("注意点", `warning-${point.id}`, point.warning, "例：身分証を提示", "textarea"));
    details.appendChild(formField("メモ", `memo-${point.id}`, point.memo, "例：入口は裏側", "textarea"));
    details.appendChild(formField("チェックリスト（1行1項目）", `checks-${point.id}`, checklistText(point), "1行ずつ入力", "textarea"));

    const typeLabel = el("label", "check-row compact");
    const typeInput = document.createElement("input");
    typeInput.type = "checkbox";
    typeInput.checked = point.type === "parking";
    typeInput.id = `type-${point.id}`;
    typeLabel.append(typeInput, el("span", "", "駐車場ポイントにする"));
    details.appendChild(typeLabel);

    const actions = el("div", "point-actions action-row-compact");
    const save = primaryButton("保存", "btn btn-primary");
    save.addEventListener("click", async () => {
      const checks = qs(`#checks-${point.id}`).value
        .split("\n")
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, checkIndex) => ({
          id: point.checklist[checkIndex]?.id,
          text,
          done: point.checklist[checkIndex]?.done || false,
          optional: point.checklist[checkIndex]?.optional || false
        }));
      await api(`/api/routes/${routeData.id}/points/${point.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: qs(`#title-${point.id}`).value,
          address: qs(`#address-${point.id}`).value,
          phone: qs(`#phone-${point.id}`).value,
          warning: qs(`#warning-${point.id}`).value,
          memo: qs(`#memo-${point.id}`).value,
          type: qs(`#type-${point.id}`).checked ? "parking" : "normal",
          checklist: checks
        })
      });
      state.editingPointId = null;
      renderEditRoute(routeData.id);
    });
    const up = primaryButton("上へ", "btn btn-secondary");
    up.disabled = index === 0;
    up.addEventListener("click", () => movePoint(routeData, index, -1));
    const down = primaryButton("下へ", "btn btn-secondary");
    down.disabled = index === routeData.points.length - 1;
    down.addEventListener("click", () => movePoint(routeData, index, 1));
    const remove = primaryButton("削除", "btn btn-danger");
    remove.addEventListener("click", async () => {
      if (!confirm("この寄り道ポイントを削除します。")) return;
      await api(`/api/routes/${routeData.id}/points/${point.id}`, { method: "DELETE" });
      state.editingPointId = null;
      renderEditRoute(routeData.id);
    });
    actions.append(save, up, down, remove);
    details.appendChild(actions);
    card.appendChild(details);
    return card;
  }

  async function movePoint(routeData, index, direction) {
    const ids = routeData.points.map((point) => point.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api(`/api/routes/${routeData.id}/points/reorder`, {
      method: "POST",
      body: JSON.stringify({ pointIds: ids })
    });
    renderEditRoute(routeData.id);
  }

  async function renderEditRoute(id) {
    clearApp();
      try {
      const routeData = await api(`/api/routes/${id}`);
      state.route = routeData;
      if (state.editingPointId && !routeData.points.some((point) => point.id === state.editingPointId)) {
        state.editingPointId = null;
      }
      app.appendChild(header("寄り道ポイント編集", routeData.name));
      const main = el("main", "content");

      const basic = el("section", "card basic-card");
      basic.appendChild(formField("ルート名", "edit-name", routeData.name, ""));
      basic.appendChild(formField("基準住所・物件住所", "edit-main-address", routeData.mainAddress, ""));
      basic.appendChild(formField("担当者名", "edit-assignee", routeData.assigneeName, ""));
      basic.appendChild(formField("全体メモ", "edit-memo", routeData.memo, "", "textarea"));
      const saveBasic = primaryButton("基本情報を保存", "btn btn-primary");
      saveBasic.addEventListener("click", async () => {
        const next = { ...routeData };
        next.name = qs("#edit-name").value;
        next.mainAddress = qs("#edit-main-address").value;
        next.assigneeName = qs("#edit-assignee").value;
        next.memo = qs("#edit-memo").value;
        await api(`/api/routes/${routeData.id}`, { method: "PUT", body: JSON.stringify(next) });
        renderEditRoute(routeData.id);
      });
      basic.appendChild(saveBasic);
      main.appendChild(basic);

      const listTitle = el("div", "list-heading");
      listTitle.appendChild(el("h2", "", "寄り道ポイント"));
      listTitle.appendChild(el("p", "", `${routeData.points.length}件の寄り道を順番に案内します`));
      main.appendChild(listTitle);
      routeData.points.forEach((point, index) => main.appendChild(renderPointListItem(point, index, routeData)));
      const add = primaryButton("寄り道ポイントを追加", "btn btn-secondary btn-wide");
      add.addEventListener("click", async () => {
        await api(`/api/routes/${routeData.id}/points`, {
          method: "POST",
          body: JSON.stringify({
            title: "新しい寄り道",
            type: "normal",
            checklist: [{ text: "完了した", done: false, optional: false }]
          })
        });
        renderEditRoute(routeData.id);
      });
      main.appendChild(add);

      const shareBox = el("section", "share-box");
      shareBox.appendChild(el("h2", "", "共有リンク"));
      const shareUrl = `${location.origin}/share/${routeData.shareId}`;
      const shareInput = document.createElement("input");
      shareInput.value = shareUrl;
      shareInput.readOnly = true;
      shareBox.appendChild(shareInput);
      const openShare = primaryButton("共有リンクを作成", "btn btn-map btn-wide");
      openShare.addEventListener("click", () => setView(`/share/${routeData.shareId}`));
      shareBox.appendChild(openShare);
      main.appendChild(shareBox);

      const back = primaryButton("一覧へ戻る", "btn btn-secondary btn-wide");
      back.addEventListener("click", () => setView("/"));
      main.appendChild(back);
      app.appendChild(main);
    } catch (error) {
      app.appendChild(header("エラー", ""));
      app.appendChild(el("p", "error", error.message));
    }
  }

  function getPropertyAddress(routeData) {
    const property = routeData.points.find((point) => point.title.includes("物件へ行く") && point.address);
    const firstAddress = routeData.points.find((point) => point.address);
    return routeData.mainAddress || property?.address || firstAddress?.address || "";
  }

  function getBaseAddress(routeData, point) {
    return point.address || routeData.mainAddress || getPropertyAddress(routeData);
  }

  function isParkingPoint(point) {
    return point.type === "parking" || point.title.includes("駐車場") || point.title.includes("停める");
  }

  function mapUrl(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  function googleSearchUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function lineReportUrl(routeData) {
    const totalPoints = routeData.points.length;
    const completedPoints = routeData.points.filter((point) => point.checklist.length && point.checklist.every((item) => item.done)).length;
    const incomplete = [];
    routeData.points.forEach((point) => {
      point.checklist.filter((item) => !item.done).forEach((item) => incomplete.push(`${point.title}: ${item.text}`));
    });
    const body = [
      "内覧完了報告",
      `ルート名: ${routeData.name}`,
      `担当者名: ${routeData.assigneeName || "未設定"}`,
      `完了時刻: ${formatDateTime(routeData.completedAt || new Date().toISOString())}`,
      `完了した寄り道数: ${completedPoints}/${totalPoints}`,
      "未完了項目:",
      incomplete.length ? incomplete.map((item) => `- ${item}`).join("\n") : "なし",
      "メモ:",
      routeData.memo || "なし"
    ].join("\n");
    return `https://line.me/R/msg/text/?${encodeURIComponent(body)}`;
  }

  function renderMapButton(routeData, point) {
    const address = getBaseAddress(routeData, point);
    const link = el("a", "btn btn-map btn-wide map-button", "Google Mapsで開く");
    if (!address) {
      link.classList.add("disabled");
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.textContent = "住所が未設定です";
      return link;
    }
    link.href = mapUrl(address);
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  function renderParkingSearchButton(label, href) {
    const link = el("a", "btn btn-secondary btn-wide parking-button", label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  function renderParkingButtons(routeData, point) {
    const baseAddress = getBaseAddress(routeData, point);
    const wrap = el("div", "parking-actions");
    if (!baseAddress) {
      wrap.appendChild(renderNoticeBanner("駐車場検索には基準住所または物件住所が必要です。"));
      return wrap;
    }
    wrap.appendChild(renderParkingSearchButton("周辺PをGoogle Mapsで検索", mapUrl(`${baseAddress} 周辺 駐車場`)));
    wrap.appendChild(renderParkingSearchButton("コインパーキングを検索", mapUrl(`${baseAddress} 周辺 コインパーキング`)));
    wrap.appendChild(renderParkingSearchButton("Googleで駐車場を検索", googleSearchUrl(`${baseAddress} 周辺 コインパーキング`)));
    return wrap;
  }

  function renderCheckItem(item, onToggle) {
    const button = el("button", `check-item ${item.done ? "checked" : ""}`);
    button.type = "button";
    const box = el("span", "check-box", item.done ? "✓" : "");
    const text = el("span", "check-text", item.text);
    button.append(box, text);
    button.addEventListener("click", onToggle);
    return button;
  }

  function renderAddCheckInput(onAdd) {
    const wrap = el("div", "add-check");
    const input = document.createElement("input");
    input.placeholder = "任意チェックを追加";
    const button = primaryButton("追加", "btn btn-secondary");
    button.addEventListener("click", () => {
      const text = input.value.trim();
      if (!text) return;
      onAdd(text);
      input.value = "";
    });
    wrap.append(input, button);
    return wrap;
  }

  async function saveShareProgress(routeData) {
    state.shareRoute = await api(`/api/share/${routeData.shareId}/progress`, {
      method: "PUT",
      body: JSON.stringify({
        currentPointIndex: routeData.currentPointIndex,
        points: routeData.points
      })
    });
  }

  async function renderShare(shareId) {
    clearApp();
    try {
      const routeData = await api(`/api/share/${shareId}`);
      state.shareRoute = routeData;
      const currentIndex = Math.min(routeData.currentPointIndex || 0, Math.max(routeData.points.length - 1, 0));
      const point = routeData.points[currentIndex];
      if (!point) {
        app.appendChild(header("共有ルート", "寄り道ポイントがありません"));
        return;
      }
      app.appendChild(header(routeData.name, routeData.assigneeName ? `担当者: ${routeData.assigneeName}` : "ログイン不要の共有画面"));
      const main = el("main", "content share-content");
      const hero = el("section", "share-hero-card");
      hero.appendChild(el("div", "share-progress", `寄り道 ${currentIndex + 1}/${routeData.points.length}`));
      hero.appendChild(el("p", "share-eyebrow", "今回行く場所"));
      hero.appendChild(el("h2", "share-title", point.title));
      hero.appendChild(el("p", "share-helper", "住所を確認して、地図を開いてください。"));
      main.appendChild(hero);

      const locationCard = el("section", "share-location-card");
      locationCard.appendChild(el("h3", "share-section-title", "行き先"));
      locationCard.appendChild(el("p", "address-box", point.address || getBaseAddress(routeData, point) || "住所未設定"));
      if (point.phone) locationCard.appendChild(el("p", "phone-box", `電話: ${point.phone}`));
      locationCard.appendChild(renderMapButton(routeData, point));
      if (isParkingPoint(point)) locationCard.appendChild(renderParkingButtons(routeData, point));
      main.appendChild(locationCard);

      if (point.warning) main.appendChild(renderNoticeBanner(point.warning));
      if (point.memo) {
        const memoCard = el("section", "share-note-card");
        memoCard.appendChild(el("h3", "share-section-title", "メモ"));
        memoCard.appendChild(el("p", "memo-box", point.memo));
        main.appendChild(memoCard);
      }

      const checks = el("section", "check-section");
      checks.appendChild(el("h3", "", "チェックリスト"));
      point.checklist.forEach((item) => {
        checks.appendChild(renderCheckItem(item, async () => {
          item.done = !item.done;
          await saveShareProgress(routeData);
          renderShare(shareId);
        }));
      });
      checks.appendChild(renderAddCheckInput(async (text) => {
        point.checklist.push({
          id: `local_${Date.now()}`,
          text,
          done: false,
          optional: true
        });
        await saveShareProgress(routeData);
        renderShare(shareId);
      }));
      main.appendChild(checks);

      const next = primaryButton(currentIndex === routeData.points.length - 1 ? "完了確認へ進む" : "次の寄り道へ", "btn btn-map btn-wide bottom-action");
      next.addEventListener("click", async () => {
        if (currentIndex === routeData.points.length - 1) {
          const completed = await api(`/api/share/${shareId}/complete`, { method: "POST", body: JSON.stringify({}) });
          state.shareRoute = completed;
          setView(`/complete/${shareId}`);
          return;
        }
        routeData.currentPointIndex = currentIndex + 1;
        await saveShareProgress(routeData);
        renderShare(shareId);
      });
      main.appendChild(next);
      app.appendChild(main);
    } catch (error) {
      app.appendChild(header("共有ルート", ""));
      app.appendChild(el("p", "error", error.message));
    }
  }

  function durationText(routeData) {
    if (!routeData.startedAt || !routeData.completedAt) return "記録なし";
    const minutes = Math.max(0, Math.round((new Date(routeData.completedAt) - new Date(routeData.startedAt)) / 60000));
    if (minutes < 60) return `${minutes}分`;
    return `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
  }

  function renderCompletionSummary(routeData) {
    const totalChecks = routeData.points.reduce((sum, point) => sum + point.checklist.length, 0);
    const doneChecks = routeData.points.reduce((sum, point) => sum + point.checklist.filter((item) => item.done).length, 0);
    const donePoints = routeData.points.filter((point) => point.checklist.length && point.checklist.every((item) => item.done)).length;
    const box = el("section", "completion-summary");
    box.appendChild(el("div", "complete-mark", "✓"));
    box.appendChild(el("h2", "", "すべて完了しました"));
    const grid = el("div", "summary-grid");
    grid.appendChild(summaryItem("完了数", `${donePoints}/${routeData.points.length}`));
    grid.appendChild(summaryItem("チェック数", `${doneChecks}/${totalChecks}`));
    grid.appendChild(summaryItem("所要時間", durationText(routeData)));
    box.appendChild(grid);
    return box;
  }

  function summaryItem(label, value) {
    const item = el("div", "summary-item");
    item.appendChild(el("strong", "", value));
    item.appendChild(el("span", "", label));
    return item;
  }

  function renderLineReportButton(routeData) {
    const link = el("a", "btn btn-line btn-wide", "LINEで完了を報告");
    link.href = lineReportUrl(routeData);
    link.target = "_blank";
    link.rel = "noopener";
    return link;
  }

  async function renderComplete(shareId) {
    clearApp();
    try {
      let routeData = await api(`/api/share/${shareId}`);
      if (!routeData.completedAt) {
        routeData = await api(`/api/share/${shareId}/complete`, { method: "POST", body: JSON.stringify({}) });
      }
      app.appendChild(header(routeData.name, "完了確認"));
      const main = el("main", "content");
      main.appendChild(renderCompletionSummary(routeData));
      main.appendChild(renderLineReportButton(routeData));
      const back = primaryButton("共有画面へ戻る", "btn btn-secondary btn-wide");
      back.addEventListener("click", () => setView(`/share/${shareId}`));
      main.appendChild(back);
      app.appendChild(main);
    } catch (error) {
      app.appendChild(header("完了確認", ""));
      app.appendChild(el("p", "error", error.message));
    }
  }

  function route() {
    const path = location.pathname;
    if (path === "/new") return renderNewRoute();
    if (path.startsWith("/routes/")) return renderEditRoute(path.split("/")[2]);
    if (path.startsWith("/share/")) return renderShare(path.split("/")[2]);
    if (path.startsWith("/complete/")) return renderComplete(path.split("/")[2]);
    return renderRouteList();
  }

  window.addEventListener("popstate", route);
  route();
})();
