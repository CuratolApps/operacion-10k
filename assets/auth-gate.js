/**
 * ÁREA 501 // AUTH GATE
 * Control Criptográfico de Acceso Militar (SHA-256)
 * Protege el acceso al Portal, Cabina de Sniping y Terminal Cuantitativa.
 */

(function () {
  // Hash SHA-256 criptográfico de la clave del comandante
  const TARGET_HASH = "1ba38f6b6118e6227fd4da3da39a691c960c9a005096e92c442828143549572f";
  const STORAGE_KEY = "area501_commander_token";
  const EXPIRY_HOURS = 48; // Recordar sesión hasta 48 horas si marca la casilla

  async function sha256(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function isAuthenticated() {
    try {
      const sessionToken = sessionStorage.getItem(STORAGE_KEY);
      if (sessionToken === TARGET_HASH) return true;

      const localData = localStorage.getItem(STORAGE_KEY);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.hash === TARGET_HASH && Date.now() < parsed.expiry) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function saveAuth(remember = false) {
    sessionStorage.setItem(STORAGE_KEY, TARGET_HASH);
    if (remember) {
      const expiry = Date.now() + (EXPIRY_HOURS * 60 * 60 * 1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hash: TARGET_HASH, expiry }));
    }
  }

  function lockout() {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  function renderLockScreen() {
    if (document.getElementById("area501-lock-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "area501-lock-overlay";
    overlay.innerHTML = `
      <div class="lock-box">
        <div class="lock-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 class="lock-title">ÁREA 501 // ACCESO PRIVADO</h2>
        <p class="lock-subtitle">Terminal de Mando Cuántico Blindada.<br/>Introduce la clave maestra de autorización:</p>

        <form id="area501-auth-form" style="width: 100%;">
          <div class="lock-input-group">
            <input type="password" id="area501-pwd" class="lock-input" placeholder="Clave del Comandante..." autocomplete="current-password" required />
            <button type="button" id="area501-toggle-pwd" class="lock-eye-btn" title="Mostrar/Ocultar">
              <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>

          <label class="lock-remember-row">
            <input type="checkbox" id="area501-remember" checked />
            <span>Recordar sesión en este dispositivo (48h)</span>
          </label>

          <button type="submit" class="lock-btn">
            <span>DESBLOQUEAR TERMINAL</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </form>

        <div id="area501-lock-msg" class="lock-msg"></div>
      </div>
    `;

    document.body.prepend(overlay);

    const pwdInput = document.getElementById("area501-pwd");
    const toggleBtn = document.getElementById("area501-toggle-pwd");
    const form = document.getElementById("area501-auth-form");
    const msg = document.getElementById("area501-lock-msg");
    const rememberBox = document.getElementById("area501-remember");

    setTimeout(() => pwdInput.focus(), 100);

    toggleBtn.addEventListener("click", () => {
      const isPwd = pwdInput.type === "password";
      pwdInput.type = isPwd ? "text" : "password";
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const val = pwdInput.value;
      if (!val) return;

      msg.className = "lock-msg";
      msg.textContent = "Verificando hash criptográfico...";

      const computed = await sha256(val);
      if (computed === TARGET_HASH) {
        msg.className = "lock-msg success";
        msg.textContent = "✅ ACCESO AUTORIZADO // BIENVENIDO COMANDANTE";
        saveAuth(rememberBox.checked);
        setTimeout(() => {
          overlay.classList.add("hidden");
          setTimeout(() => overlay.remove(), 400);
          renderLockoutButton();
        }, 500);
      } else {
        msg.className = "lock-msg error";
        msg.textContent = "❌ CLAVE INCORRECTA // ACCESO DENEGADO";
        pwdInput.value = "";
        pwdInput.focus();
      }
    });
  }

  function renderLockoutButton() {
    if (document.getElementById("area501-lockout-btn")) return;
    const btn = document.createElement("button");
    btn.id = "area501-lockout-btn";
    btn.className = "area501-lockout-btn";
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;
    btn.title = "ÁREA 501 // Bloquear y Proteger Acceso";
    btn.setAttribute("aria-label", "Bloquear acceso");
    btn.addEventListener("click", lockout);
    document.body.appendChild(btn);
  }

  // Inicialización al cargar la página
  function init() {
    if (isAuthenticated()) {
      renderLockoutButton();
    } else {
      renderLockScreen();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
