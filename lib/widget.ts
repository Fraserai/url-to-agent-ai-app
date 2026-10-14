import type { BusinessRecord } from "@/lib/types";

function greetingForBusiness(business: BusinessRecord) {
  return `Hey! Welcome to ${business.businessName}. How can I help you today?`;
}

export function buildWidgetSource(business: BusinessRecord, origin: string) {
  const config = {
    id: business.id,
    businessName: business.businessName,
    accentColor: business.accentColor || "#1a6b4a"
  };

  return `(function () {
    if (window.__agentdropWidgets && window.__agentdropWidgets[${JSON.stringify(business.id)}]) return;
    window.__agentdropWidgets = window.__agentdropWidgets || {};
    window.__agentdropWidgets[${JSON.stringify(business.id)}] = true;

    var BUSINESS = ${JSON.stringify(config)};
    var GREETING = ${JSON.stringify(greetingForBusiness(business))};
    var script = document.currentScript;
    var scriptUrl = script && script.src ? new URL(script.src) : null;
    var API_BASE = scriptUrl ? scriptUrl.origin : ${JSON.stringify(origin)};
    var visitorKey = "agentdrop:" + BUSINESS.id + ":visitor";
    var visitorId;

    try {
      visitorId = localStorage.getItem(visitorKey);
      if (!visitorId) {
        visitorId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        localStorage.setItem(visitorKey, visitorId);
      }
    } catch (error) {
      visitorId = "visitor-" + Date.now();
    }

    var host = document.createElement("div");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483000";
    host.style.right = "16px";
    host.style.bottom = "16px";
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = '<style>\
      :host{all:initial}\
      *{box-sizing:border-box;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}\
      .bubble{width:52px;height:52px;border:none;border-radius:999px;background:' + BUSINESS.accentColor + ';color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);cursor:pointer}\
      .wrap{position:relative}\
      .panel{position:absolute;right:0;bottom:64px;width:min(360px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));background:#f7f6f3;border-radius:18px;overflow:hidden;border:1px solid rgba(0,0,0,0.06);box-shadow:0 18px 48px rgba(0,0,0,0.18);display:flex;flex-direction:column;opacity:0;transform:translateY(10px) scale(0.98);pointer-events:none;transition:opacity .22s ease,transform .22s ease}\
      .panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}\
      .header{padding:13px 16px;background:' + BUSINESS.accentColor + ';color:#fff;display:flex;align-items:center;justify-content:space-between}\
      .brand{display:flex;align-items:center;gap:10px}\
      .avatar{width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}\
      .name{font-size:13.5px;font-weight:700}\
      .status{font-size:10.5px;color:rgba(255,255,255,0.7)}\
      .dot{display:inline-block;width:5px;height:5px;border-radius:999px;background:#4ade80;margin-right:4px;vertical-align:middle}\
      .close{border:none;background:transparent;color:rgba(255,255,255,0.75);cursor:pointer;font-size:18px}\
      .messages{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}\
      .row{display:flex}\
      .row.user{justify-content:flex-end}\
      .msg{max-width:85%;padding:9px 13px;font-size:13.5px;line-height:1.5}\
      .msg.assistant{background:#fff;color:#1a1a1a;border-radius:14px 14px 14px 3px;box-shadow:0 1px 2px rgba(0,0,0,0.06)}\
      .msg.user{background:' + BUSINESS.accentColor + ';color:#fff;border-radius:14px 14px 3px 14px}\
      .typing{display:flex;gap:4px}\
      .typing span{width:7px;height:7px;background:#c7c7c7;border-radius:999px;animation:bounce 1.2s ease-in-out infinite}\
      .typing span:nth-child(2){animation-delay:.15s}\
      .typing span:nth-child(3){animation-delay:.3s}\
      .inputbar{display:flex;gap:6px;padding:8px 10px;background:#fff;border-top:1px solid #eee}\
      input{flex:1;padding:10px 14px;border-radius:22px;border:1px solid #ddd;outline:none;font-size:14px}\
      .send{width:38px;height:38px;border:none;border-radius:999px;background:' + BUSINESS.accentColor + ';color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}\
      .send[disabled]{background:#ddd;cursor:default}\
      .note{position:absolute;right:2px;bottom:64px;transform:translateY(-12px);background:#fff;border-radius:12px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.12);font-size:12.5px;font-weight:500;color:#1a1a1a;max-width:200px;opacity:0;pointer-events:none;transition:opacity .24s ease,transform .24s ease}\
      .note.show{opacity:1;transform:translateY(0)}\
      @media (max-width:640px){.panel{width:calc(100vw - 16px);height:min(72vh,560px)}}\
      @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}\
    </style>\
    <div class="wrap">\
      <div class="panel" id="panel">\
        <div class="header">\
          <div class="brand">\
            <div class="avatar">' + BUSINESS.businessName.charAt(0) + '</div>\
            <div><div class="name">' + BUSINESS.businessName + '</div><div class="status"><span class="dot"></span>Online now</div></div>\
          </div>\
          <button class="close" id="close" aria-label="Close">×</button>\
        </div>\
        <div class="messages" id="messages"></div>\
        <form class="inputbar" id="form">\
          <input id="input" placeholder="Type a message..." />\
          <button class="send" id="send" type="submit" aria-label="Send">\
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>\
          </button>\
        </form>\
      </div>\
      <div class="note" id="note">Hey! Need help? 👋</div>\
      <button class="bubble" id="bubble" aria-label="Open chat">\
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"></path></svg>\
      </button>\
    </div>';

    var panel = shadow.getElementById("panel");
    var bubble = shadow.getElementById("bubble");
    var close = shadow.getElementById("close");
    var note = shadow.getElementById("note");
    var form = shadow.getElementById("form");
    var input = shadow.getElementById("input");
    var messagesEl = shadow.getElementById("messages");
    var send = shadow.getElementById("send");
    var state = { open: false, loading: false, messages: [{ role: "assistant", content: GREETING }] };

    function render() {
      panel.classList.toggle("open", state.open);
      send.disabled = state.loading || !input.value.trim();
      messagesEl.innerHTML = "";
      state.messages.forEach(function (message) {
        var row = document.createElement("div");
        row.className = "row " + message.role;
        var bubbleEl = document.createElement("div");
        bubbleEl.className = "msg " + message.role;
        bubbleEl.textContent = message.content;
        row.appendChild(bubbleEl);
        messagesEl.appendChild(row);
      });
      if (state.loading) {
        var row = document.createElement("div");
        row.className = "row assistant";
        var typing = document.createElement("div");
        typing.className = "msg assistant";
        typing.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
        row.appendChild(typing);
        messagesEl.appendChild(row);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function openPanel() {
      state.open = true;
      note.classList.remove("show");
      render();
      setTimeout(function () { input.focus(); }, 20);
    }

    async function sendMessage() {
      var value = input.value.trim();
      if (!value || state.loading) return;
      state.messages.push({ role: "user", content: value });
      input.value = "";
      state.loading = true;
      render();
      try {
        var response = await fetch(API_BASE + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: BUSINESS.id,
            visitorId: visitorId,
            messages: state.messages
          })
        });
        var payload = await response.json();
        state.messages.push({
          role: "assistant",
          content: payload.reply || "Sorry, I’m having trouble right now. Please try again."
        });
      } catch (error) {
        state.messages.push({
          role: "assistant",
          content: "Sorry, I’m having trouble right now. Please try again."
        });
      }
      state.loading = false;
      render();
    }

    bubble.addEventListener("click", function () {
      state.open ? (state.open = false, render()) : openPanel();
    });
    close.addEventListener("click", function () {
      state.open = false;
      render();
    });
    input.addEventListener("input", render);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      sendMessage();
    });

    render();
    setTimeout(function () {
      if (!state.open) note.classList.add("show");
    }, 3000);
  })();`;
}

