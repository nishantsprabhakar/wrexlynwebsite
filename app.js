/**
 * Wrexlyn — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
 *
 * Browser-only chat demo with no authentication or Wrexlyn backend.
 * The API key you enter is kept only in this browser's localStorage and is
 * sent directly from your browser to the provider you pick — it is never
 * seen by any server of ours, because there isn't one.
 *
 * The chrome (theme system, topbar, sidebar) mirrors the real desktop/web app
 * as closely as a static, backend-less page can — same 8 themes, same
 * theme-picker mechanism, same visual language. Anything that genuinely
 * requires a local backend (files, shell, verification, MCP, skills) is
 * called out in the sidebar rather than silently omitted or faked.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "wrexlyn_web_setup";
  const THEME_KEY = "wrexlyn-theme";

  // ---------- Theme system (ported from the real app: same ids, same swatch colors) ----------

  const THEMES = [
    { id: "tactical", name: "Tactical Cockpit", swatch: ["#030303", "#00f0ff", "#ff6b00"] },
    { id: "space", name: "Space", swatch: ["#0a0d12", "#22d3ee", "#a78bfa"] },
    { id: "tech", name: "Tech", swatch: ["#05070a", "#39ff88", "#22d3ee"] },
    { id: "aurora", name: "Aurora", swatch: ["#0a0a14", "#a78bfa", "#2dd4bf"] },
    { id: "sunset", name: "Sunset", swatch: ["#120a0d", "#fb923c", "#f472b6"] },
    { id: "midnight", name: "Midnight", swatch: ["#070a12", "#5b8def", "#7dd3fc"] },
    { id: "daylight", name: "Daylight", swatch: ["#f6f7f9", "#2563eb", "#7c3aed"] },
    { id: "paper", name: "Paper", swatch: ["#ffffff", "#111827", "#64748b"] },
  ];

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "space";
  }

  function applyTheme(id) {
    if (id === "space") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {}
    renderThemeList();
  }

  function renderThemeList() {
    const list = document.getElementById("theme-list");
    const active = currentTheme();
    list.innerHTML = "";
    THEMES.forEach((t) => {
      const row = document.createElement("div");
      row.className = "theme-item" + (t.id === active ? " active" : "");
      row.innerHTML =
        '<span class="theme-swatch">' +
        t.swatch.map((c) => `<span style="background:${c}"></span>`).join("") +
        "</span>" +
        `<span class="theme-item-name">${t.name}</span>` +
        (t.id === active ? '<span class="theme-item-check">&#10003;</span>' : "");
      row.addEventListener("click", () => applyTheme(t.id));
      list.appendChild(row);
    });
  }

  function openOverlay(overlay) {
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("overlay-visible"));
  }
  function closeOverlay(overlay) {
    overlay.classList.remove("overlay-visible");
    setTimeout(() => {
      overlay.hidden = true;
    }, 160);
  }

  const themeOverlay = document.getElementById("theme-overlay");
  document.getElementById("theme-btn").addEventListener("click", () => {
    renderThemeList();
    openOverlay(themeOverlay);
  });
  document.getElementById("theme-close").addEventListener("click", () => closeOverlay(themeOverlay));
  themeOverlay.addEventListener("click", (e) => {
    if (e.target === themeOverlay) closeOverlay(themeOverlay);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !themeOverlay.hidden) closeOverlay(themeOverlay);
  });

  const el = {
    gate: document.getElementById("gate"),
    providerSelect: document.getElementById("provider-select"),
    apiKeyInput: document.getElementById("api-key-input"),
    apiKeyLabel: document.getElementById("api-key-label"),
    providerNote: document.getElementById("provider-note"),
    setupError: document.getElementById("setup-error"),
    startBtn: document.getElementById("start-btn"),
    chatShell: document.getElementById("chat-shell"),
    chatLog: document.getElementById("chat-log"),
    emptyState: document.getElementById("empty-state"),
    composerInput: document.getElementById("composer-input"),
    sendBtn: document.getElementById("send-btn"),
    statusDot: document.getElementById("status-dot"),
    statusText: document.getElementById("status-text"),
    modelBadge: document.getElementById("model-badge"),
    settingsBtn: document.getElementById("settings-btn"),
  };

  let setup = null; // { provider, apiKey } — persisted to localStorage on this device only

  function populateProviderSelect() {
    el.providerSelect.innerHTML = Object.keys(PROVIDER_META)
      .map((id) => `<option value="${id}">${PROVIDER_META[id].label}</option>`)
      .join("");
  }
  populateProviderSelect();

  // ---------- Provider + API key setup ----------

  function renderProviderNote() {
    const meta = PROVIDER_META[el.providerSelect.value];
    el.apiKeyLabel.hidden = !meta.needsKey;
    el.apiKeyInput.hidden = !meta.needsKey;
    el.providerNote.innerHTML = meta.note;
  }

  function loadSetup() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && PROVIDER_META[saved.provider]) {
        el.providerSelect.value = saved.provider;
        el.apiKeyInput.value = saved.apiKey || "";
      }
    } catch {
      // corrupt/absent — start fresh
    }
    renderProviderNote();
  }

  el.providerSelect.addEventListener("change", renderProviderNote);

  el.startBtn.addEventListener("click", async () => {
    const provider = el.providerSelect.value;
    const meta = PROVIDER_META[provider];
    const apiKey = el.apiKeyInput.value.trim();
    if (meta.needsKey && !apiKey) {
      el.setupError.textContent = `${meta.label} needs an API key — paste one in, or switch providers.`;
      return;
    }
    el.setupError.textContent = "";
    el.startBtn.disabled = true;
    el.startBtn.textContent = "Checking available models…";
    const model = await resolveModel(provider, apiKey);
    el.startBtn.disabled = false;
    el.startBtn.textContent = "Start chatting";
    setup = { provider, apiKey, model };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
    startChat();
  });

  el.settingsBtn.addEventListener("click", () => {
    el.chatShell.classList.remove("active");
    el.gate.hidden = false;
    el.settingsBtn.hidden = true;
    el.modelBadge.hidden = true;
    setStatus("not connected", false);
  });

  function setStatus(text, connected, busy) {
    el.statusText.textContent = text;
    el.statusDot.classList.toggle("connected", !!connected);
    el.statusDot.classList.toggle("busy", !!busy);
  }

  function startChat() {
    el.gate.hidden = true;
    el.chatShell.classList.add("active");
    el.modelBadge.hidden = false;
    el.modelBadge.textContent = `${PROVIDER_META[setup.provider].label} · ${setup.model}`;
    el.settingsBtn.hidden = false;
    setStatus("connected", true);
    el.composerInput.focus();
  }

  // ---------- Chat ----------

  const messages = [{ role: "system", content: WREXLYN_SYSTEM_PROMPT }];
  let busy = false;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderMarkdown(raw) {
    const lines = raw.split("\n");
    let html = "";
    let inCode = false;
    let codeBuf = [];
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        if (inCode) {
          html += `<pre>${escapeHtml(codeBuf.join("\n"))}</pre>`;
          codeBuf = [];
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }
      let s = escapeHtml(line);
      s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
      s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html += line.trim() === "" ? "<br>" : `<div>${s}</div>`;
    }
    if (codeBuf.length) html += `<pre>${escapeHtml(codeBuf.join("\n"))}</pre>`;
    return html;
  }

  function appendMessage(role, text) {
    if (el.emptyState) {
      el.emptyState.remove();
      el.emptyState = null;
    }
    const row = document.createElement("div");
    row.className = `msg msg-${role}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    if (role === "assistant") bubble.innerHTML = renderMarkdown(text);
    else bubble.textContent = text;
    row.appendChild(bubble);
    el.chatLog.appendChild(row);
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
    return bubble;
  }

  function showThinking() {
    const row = document.createElement("div");
    row.className = "thinking-dots";
    row.id = "thinking-row";
    row.textContent = "thinking…";
    el.chatLog.appendChild(row);
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
  }
  function hideThinking() {
    const row = document.getElementById("thinking-row");
    if (row) row.remove();
  }

  async function sendMessage() {
    const text = el.composerInput.value.trim();
    if (!text || busy) return;
    el.composerInput.value = "";
    el.composerInput.style.height = "auto";
    appendMessage("user", text);
    messages.push({ role: "user", content: text });

    busy = true;
    el.sendBtn.disabled = true;
    setStatus("thinking…", true, true);
    showThinking();

    let assistantBubble = null;
    let acc = "";
    try {
      const meta = PROVIDER_META[setup.provider];
      await meta.stream(messages, setup.apiKey, setup.model, (chunk) => {
        hideThinking();
        acc += chunk;
        if (!assistantBubble) assistantBubble = appendMessage("assistant", "");
        assistantBubble.innerHTML = renderMarkdown(acc);
        el.chatLog.scrollTop = el.chatLog.scrollHeight;
      });
      hideThinking();
      if (!acc) acc = "(no response)";
      if (!assistantBubble) appendMessage("assistant", acc);
      messages.push({ role: "assistant", content: acc });
    } catch (err) {
      hideThinking();
      appendMessage("error", `⚠ ${err.message || String(err)}`);
    } finally {
      busy = false;
      el.sendBtn.disabled = false;
      setStatus("connected", true, false);
      el.composerInput.focus();
    }
  }

  el.sendBtn.addEventListener("click", sendMessage);
  el.composerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  el.composerInput.addEventListener("input", () => {
    el.composerInput.style.height = "auto";
    el.composerInput.style.height = Math.min(el.composerInput.scrollHeight, 160) + "px";
  });

  renderThemeList();
  loadSetup();
})();
