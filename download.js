/* Wrexlyn website — the download, on every page · © Nishant Prabhakar */
(function () {
  "use strict";
  var URL = "https://wrexlyn.pages.dev/download/";
  var ua = navigator.userAgent || "", plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  var phone = /Android|iPhone|iPod|Mobile/i.test(ua);
  var os = phone ? "" : /Win/i.test(plat + ua) ? "Windows" : /Mac/i.test(plat + ua) ? "macOS" : /Linux|X11/i.test(plat + ua) ? "Linux" : "";
  var css = ".wx-dl{position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;align-items:center;gap:10px;padding:12px 18px 12px 14px;border-radius:999px;color:#fff;text-decoration:none;font:600 14px/1.2 Inter,system-ui,sans-serif;background:linear-gradient(135deg,#7c5cff,#00d9ff);box-shadow:0 14px 34px -12px rgba(0,217,255,.8);transition:transform .15s}" +
    ".wx-dl:hover{transform:translateY(-2px)}.wx-dl i{font-style:normal;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.2)}.wx-dl small{display:block;font-weight:500;opacity:.85;font-size:11.5px}" +
    "@media (max-width:640px){.wx-dl{left:12px;right:12px;bottom:12px;justify-content:center;border-radius:14px}}@media print{.wx-dl{display:none}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var a = document.createElement("a"); a.className = "wx-dl"; a.href = URL;
  a.innerHTML = "<i aria-hidden=\"true\">⬇</i><span>" + (phone ? "Get Wrexlyn for your PC" : "Download for " + (os || "your PC")) + "<small>Wrexlyn Workspace · free</small></span>";
  document.body.appendChild(a);
})();
