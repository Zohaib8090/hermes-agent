function storedServerUrl() {
  return localStorage.getItem("hermes_server_url") || "";
}
function storedToken() {
  return localStorage.getItem("hermes_session_token") || "";
}
function apiBase() {
  return storedServerUrl().replace(/\/$/, "");
}
function authHeaders() {
  const tok = storedToken();
  return tok ? { "Authorization": `Bearer ${tok}`, "X-Hermes-Session-Token": tok } : {};
}
async function hermesApiFetch(path, body) {
  const base = apiBase();
  if (!base) throw new Error("Hermes server URL not configured. Open the connection settings.");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6e4)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hermes API ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}
function makeConnectionDescriptor(profile) {
  const base = apiBase();
  const wsBase = base.replace(/^http/, "ws");
  const wsUrl = `${wsBase}/ws/gateway`;
  return {
    id: "android-remote",
    profile: profile || "default",
    baseUrl: base,
    wsUrl,
    type: "remote",
    // Properties the store inspects
    isLocal: false,
    isRemote: true,
    remoteUrl: base
  };
}
function gatewayWsUrl(profile) {
  const base = apiBase().replace(/^http/, "ws");
  return `${base}/ws/gateway`;
}
function maybeShowServerSetupOverlay() {
  if (storedServerUrl()) return;
  const showOverlay = () => {
    if (document.getElementById("hermes-android-setup")) return;
    const overlay = document.createElement("div");
    overlay.id = "hermes-android-setup";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:99999",
      "background:#12111A",
      "color:#E8E6F0",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "justify-content:center",
      "padding:32px",
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      "box-sizing:border-box"
    ].join(";");
    overlay.innerHTML = `
      <div style="width:100%;max-width:400px;display:flex;flex-direction:column;gap:20px;">
        <div style="text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">\u26A1</div>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 6px;letter-spacing:-0.3px;">Connect to Hermes</h1>
          <p style="font-size:14px;color:#8F8AA8;margin:0;line-height:1.5;">
            Enter the local IP of your laptop running <code style="background:#1E1B2E;padding:2px 6px;border-radius:4px;">hermes serve</code>
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#8F8AA8;">Server URL</label>
          <input id="hcap-url" type="url" value="http://192.168.1." autocorrect="off" autocomplete="off" spellcheck="false"
            style="background:#1E1B2E;border:1px solid #332F47;border-radius:8px;padding:12px 14px;color:#E8E6F0;font-size:15px;outline:none;width:100%;box-sizing:border-box;"
            placeholder="http://192.168.x.x:8080" />
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#8F8AA8;">Session Token (optional)</label>
          <input id="hcap-token" type="password" autocomplete="off"
            style="background:#1E1B2E;border:1px solid #332F47;border-radius:8px;padding:12px 14px;color:#E8E6F0;font-size:15px;outline:none;width:100%;box-sizing:border-box;"
            placeholder="Leave blank if not set" />
        </div>

        <button id="hcap-connect"
          style="background:#F5B942;color:#12111A;font-weight:700;font-size:16px;border:none;border-radius:8px;padding:15px;cursor:pointer;width:100%;letter-spacing:0.2px;">
          Connect \u26A1
        </button>

        <p id="hcap-status" style="text-align:center;font-size:13px;color:#8F8AA8;margin:0;min-height:20px;"></p>
      </div>
    `;
    document.body.appendChild(overlay);
    const urlInput = document.getElementById("hcap-url");
    const tokenInput = document.getElementById("hcap-token");
    const btn = document.getElementById("hcap-connect");
    const status = document.getElementById("hcap-status");
    btn.addEventListener("click", async () => {
      const url = urlInput.value.trim().replace(/\/$/, "");
      if (!url) {
        status.textContent = "Please enter a server URL.";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Connecting\u2026";
      status.textContent = "";
      try {
        const res = await fetch(`${url}/api/status`, {
          signal: AbortSignal.timeout(5e3),
          headers: authHeaders()
        });
        if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        if (e instanceof TypeError && String(e).includes("fetch")) {
          btn.disabled = false;
          btn.textContent = "Connect \u26A1";
          status.style.color = "#E5484D";
          status.textContent = `Could not reach ${url}. Check IP and that hermes serve is running.`;
          return;
        }
      }
      localStorage.setItem("hermes_server_url", url);
      if (tokenInput.value.trim()) {
        localStorage.setItem("hermes_session_token", tokenInput.value.trim());
      }
      if (window.Capacitor?.Plugins?.Preferences) {
        const Prefs = window.Capacitor.Plugins.Preferences;
        await Prefs.set({ key: "hermes_server_url", value: url });
        if (tokenInput.value.trim()) {
          await Prefs.set({ key: "hermes_session_token", value: tokenInput.value.trim() });
        }
      }
      status.style.color = "#22c55e";
      status.textContent = "\u2713 Connected! Loading Hermes\u2026";
      setTimeout(() => {
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.4s";
        setTimeout(() => overlay.remove(), 400);
      }, 800);
    });
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btn.click();
    });
    tokenInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btn.click();
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showOverlay);
  } else {
    showOverlay();
  }
}
const _OriginalWebSocket = window.WebSocket;
class HermesProxiedWebSocket extends _OriginalWebSocket {
  constructor(url, protocols) {
    const urlStr = String(url);
    let resolved = urlStr;
    if (urlStr.startsWith("/") || !urlStr.startsWith("ws") && !urlStr.startsWith("http")) {
      const base = apiBase().replace(/^http/, "ws");
      resolved = `${base}${urlStr.startsWith("/") ? "" : "/"}${urlStr}`;
    }
    super(resolved, protocols);
  }
}
if (storedServerUrl()) {
  window.WebSocket = HermesProxiedWebSocket;
}
(async () => {
  if (window.Capacitor?.Plugins?.Preferences) {
    const Prefs = window.Capacitor.Plugins.Preferences;
    try {
      const { value: url } = await Prefs.get({ key: "hermes_server_url" });
      const { value: tok } = await Prefs.get({ key: "hermes_session_token" });
      if (url && !localStorage.getItem("hermes_server_url")) {
        localStorage.setItem("hermes_server_url", url);
      }
      if (tok && !localStorage.getItem("hermes_session_token")) {
        localStorage.setItem("hermes_session_token", tok);
      }
    } catch {
    }
  }
  maybeShowServerSetupOverlay();
})();
window.hermesDesktop = {
  // ── Static capability flags (safe Android defaults) ──
  glassSupported: false,
  translucencySupported: false,
  localModelsEnabled: false,
  guestOnboardingEnabled: false,
  skipIntro: true,
  // skip the intro reveal on mobile
  // ── Connection resolution ─────────────────────────────────────────────────
  getConnection: async (profile) => {
    const base = apiBase();
    if (!base) throw new Error("Server not configured");
    return makeConnectionDescriptor(profile);
  },
  getConnectionFor: async ({ connectionId, profile }) => {
    return makeConnectionDescriptor(profile);
  },
  getGatewayWsUrl: async (profile) => {
    return { wsUrl: gatewayWsUrl(profile), profile: profile || "default" };
  },
  getGatewayWsUrlFor: async ({ connectionId, profile }) => {
    return { wsUrl: gatewayWsUrl(profile), profile };
  },
  revalidateConnection: async () => {
    return makeConnectionDescriptor();
  },
  getProfileRoutes: async () => ({ routes: [] }),
  touchBackend: async () => {
  },
  getPoolLimits: async () => ({ soft: 4, hard: 8 }),
  setPoolLimits: async () => {
  },
  getAgentRoster: async () => ({ agents: [] }),
  // ── REST API bridge ───────────────────────────────────────────────────────
  // All api/X calls from the renderer go through here.
  // The renderer passes { method, path, body, ... }; we forward as POST.
  api: async (request) => {
    const base = apiBase();
    if (!base) throw new Error("Server not configured");
    const { method = "GET", path = "", body, params, ...rest } = request;
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    const url = `${base}/api${path.startsWith("/") ? path : "/" + path}${query}`;
    const res = await fetch(url, {
      method,
      headers: {
        ...body ? { "Content-Type": "application/json" } : {},
        ...authHeaders()
      },
      body: body ? JSON.stringify(body) : void 0,
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`API ${method} ${path} failed: ${res.status}`);
      err.status = res.status;
      err.body = text;
      throw err;
    }
    return res.json();
  },
  // ── Window / session management (no-ops on Android) ──────────────────────
  openSessionWindow: async () => {
  },
  openSessionInTerminal: async () => {
  },
  openWindow: async () => {
  },
  openBrowserWindow: async () => {
  },
  onBrowserPopoutClosed: () => () => {
  },
  // ── Ambient / cue ─────────────────────────────────────────────────────────
  claimAmbientCue: async () => false,
  // ── Wake indicator (no-op on Android) ────────────────────────────────────
  wakeIndicator: {
    getState: async () => null,
    setState: () => {
    },
    onState: () => () => {
    }
  },
  // ── Chat onboarding (no-op on Android — we have our own overlay) ─────────
  chatOnboarding: {
    grow: () => {
    },
    soloBoot: () => {
    }
  },
  // ── Intro reveal (skipped on Android) ────────────────────────────────────
  introReveal: {
    open: async () => {
    },
    close: async () => {
    },
    skip: () => {
    },
    ready: () => {
    },
    onSkip: () => () => {
    },
    onClosed: () => () => {
    }
  },
  // ── UI / appearance ───────────────────────────────────────────────────────
  setTitleBarTheme: () => {
  },
  setNativeTheme: () => {
  },
  setActiveWork: () => {
  },
  setDisableF12: () => {
  },
  // ── Find-in-page (no-op — Android has native) ────────────────────────────
  onFoundInPage: () => () => {
  },
  onOpenFindBarRequested: () => () => {
  },
  // ── External links ────────────────────────────────────────────────────────
  openExternal: async (url) => {
    window.open(url, "_blank");
  },
  // ── Connections registry ──────────────────────────────────────────────────
  // Provides the multi-connection registry surface used by the connections store.
  connections: {
    list: async () => {
      const base = apiBase();
      if (!base) return [];
      return [{
        id: "android-remote",
        label: "Laptop (Android Remote)",
        baseUrl: base,
        wsUrl: gatewayWsUrl(),
        type: "remote"
      }];
    },
    setLastUsed: async () => {
    }
  },
  // ── Connection config ─────────────────────────────────────────────────────
  getConnectionConfig: async () => ({
    baseUrl: apiBase(),
    wsUrl: gatewayWsUrl(),
    type: "remote"
  }),
  // ── Data URL read max (passthrough) ──────────────────────────────────────
  dataUrlReadMax: {
    get: async () => 5 * 1024 * 1024,
    // 5 MB
    set: async () => {
    }
  },
  // ── Theme marketplace ─────────────────────────────────────────────────────
  themes: {
    fetchMarketplace: async () => ({ themes: [] }),
    install: async () => ({ ok: false }),
    uninstall: async () => ({ ok: false })
  },
  // ── Fleet roster (single remote backend on Android) ──────────────────────
  getBootProgress: async () => ({ state: "ready", progress: 1 }),
  onBootstrapEvent: () => () => {
  },
  onWindowStateChanged: () => () => {
  },
  onPreviewFileChanged: () => () => {
  },
  // ── Zoom (handled natively by WebView pinch-to-zoom) ─────────────────────
  setZoomFactor: () => {
  },
  getZoomFactor: async () => 1,
  // ── Translucency (no glass on Android) ───────────────────────────────────
  setTranslucency: () => {
  },
  // ── Filesystem IPC (proxied via REST) ────────────────────────────────────
  fs: {
    readDir: async (path) => {
      return hermesApiFetch("/api/fs/readdir", { path });
    },
    readFile: async (path) => {
      return hermesApiFetch("/api/fs/read", { path });
    },
    writeFile: async (path, content) => {
      return hermesApiFetch("/api/fs/write", { path, content });
    }
  },
  // ── Git IPC (proxied via REST) ────────────────────────────────────────────
  git: {
    repoStatus: async (cwd) => {
      return hermesApiFetch("/api/git/status", { cwd });
    }
  },
  // ── Notifications ─────────────────────────────────────────────────────────
  notification: {
    show: async () => {
    },
    onAction: () => () => {
    }
  },
  // ── Terminal IPC ──────────────────────────────────────────────────────────
  // xterm.js opens WebSocket sessions; we don't need to do anything here
  // since the WS proxy above handles routing to the laptop.
  terminal: {
    // Called when the terminal pane mounts to get the WS endpoint
    getWsUrl: async (sessionId) => {
      const base = apiBase().replace(/^http/, "ws");
      return sessionId ? `${base}/ws/terminal/${sessionId}` : `${base}/ws/terminal`;
    },
    resize: async () => {
    },
    getHistory: async () => ({ output: "" })
  },
  // ── Android-specific extras ───────────────────────────────────────────────
  isAndroid: true,
  platform: "android",
  // Expose server URL management so settings UI can update it
  getServerUrl: () => storedServerUrl(),
  setServerUrl: async (url) => {
    localStorage.setItem("hermes_server_url", url);
    if (window.Capacitor?.Plugins?.Preferences) {
      await window.Capacitor.Plugins.Preferences.set({ key: "hermes_server_url", value: url });
    }
  },
  getSessionToken: () => storedToken(),
  setSessionToken: async (tok) => {
    localStorage.setItem("hermes_session_token", tok);
    if (window.Capacitor?.Plugins?.Preferences) {
      await window.Capacitor.Plugins.Preferences.set({ key: "hermes_session_token", value: tok });
    }
  }
};
console.log("[Hermes Android] hermesDesktop shim installed. Server:", storedServerUrl() || "(not set)");
