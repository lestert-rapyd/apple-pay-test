const BACKEND_URL = 'https://rapyd-backend.vercel.app';

// ─── State ────────────────────────────────────────────────────────────────────
let currentEnv = 'sandbox';
let currentReference = null;     // merchant_reference_id of the active session
let currentPaymentId = null;     // payment_xxx of the active payment (from pending event)
let paymentPollTimer = null;
let lastPolledStatus = null;

const product = {
  name:        'Developer Test Kit',
  amount:      '0.01',
  currency:    'GBP',
  country:     'GB',
  description: 'A lightweight item for integration testing across payment flows.',
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const modalOverlay     = document.getElementById('modal-overlay');
const modalTag         = document.getElementById('modal-tag');
const modalTitle       = document.getElementById('modal-title');
const modalBody        = document.getElementById('modal-body');
const modalClose       = document.getElementById('modal-close');
const envBanner        = document.getElementById('env-banner');
const envBannerText    = document.getElementById('env-banner-text');
const envToggle        = document.getElementById('env-toggle');
const inlinePanelTag   = document.getElementById('inline-panel-tag');
const inlinePanelTitle = document.getElementById('inline-panel-title');
const inlinePanelBody  = document.getElementById('inline-panel-body');
const eventConsole     = document.getElementById('event-console');
const consoleClear     = document.getElementById('console-clear');
const statusPollToggle = document.getElementById('status-poll-toggle');

// ─── Event Console ────────────────────────────────────────────────────────────
// sources: app | api | toolkit | webhook | error | system
function logEvent(source, message, data = null) {
  const placeholder = document.getElementById('console-placeholder');
  if (placeholder) placeholder.remove();

  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `
    <span class="console-time">${time}</span>
    <span class="console-source src-${source}">${source.toUpperCase()}</span>
    <span class="console-msg">${escapeHTML(message)}${
      data ? `<span class="console-data">${escapeHTML(typeof data === 'string' ? data : JSON.stringify(data))}</span>` : ''
    }</span>
  `;
  eventConsole.appendChild(line);
  eventConsole.scrollTop = eventConsole.scrollHeight;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

consoleClear.addEventListener('click', () => {
  eventConsole.innerHTML = '';
  logEvent('system', 'Console cleared.');
});

// ─── Payment Status Polling ───────────────────────────────────────────────────
// Pull-based replacement for webhooks: poll Retrieve Payment until the payment
// reaches a terminal status. Demo-only pattern — in production, webhooks remain
// the canonical way to learn payment outcomes (a closed tab can't poll).
const TERMINAL_STATUSES = ['CLO', 'ERR', 'EXP', 'CAN'];

async function pollPaymentStatus() {
  if (!currentPaymentId) return;

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/retrieve-payment?id=${encodeURIComponent(currentPaymentId)}&env=${currentEnv}`
    );
    if (!res.ok) return;
    const data = await res.json();
    const p = data?.data;
    if (!p) return;

    // Log only on change to keep the console readable
    if (p.status !== lastPolledStatus) {
      lastPolledStatus = p.status;
      logEvent('poll', `Retrieve Payment → status: ${p.status}`, {
        payment_id: p.id, paid: p.paid, next_action: p.next_action,
      });
    }

    if (TERMINAL_STATUSES.includes(p.status)) {
      stopPaymentPolling();
      if (p.status === 'CLO' && p.paid) {
        showToast('✅ Payment confirmed (status CLO, paid true)');
        logEvent('system', 'Active payment resolved: PAID.');
      } else {
        showToast(`❌ Payment ended: ${p.status}`, 'error');
        logEvent('system', `Active payment resolved: ${p.status}.`);
      }
    }
  } catch (err) {
    console.warn('[rapyd-demo] status poll error:', err.message);
  }
}

function startPaymentPolling() {
  if (paymentPollTimer || !currentPaymentId) return;
  statusPollToggle.checked = true;
  lastPolledStatus = null;
  logEvent('system', `Status polling started (every 3s) → GET /api/retrieve-payment?id=${currentPaymentId}`);
  logEvent('system', 'Note: polling is a demo pattern. In production, use webhooks for reconciliation.');
  pollPaymentStatus();
  paymentPollTimer = setInterval(pollPaymentStatus, 3000);
}

function stopPaymentPolling() {
  clearInterval(paymentPollTimer);
  paymentPollTimer = null;
  statusPollToggle.checked = false;
}

statusPollToggle.addEventListener('change', () => {
  if (statusPollToggle.checked) {
    if (!currentPaymentId) {
      statusPollToggle.checked = false;
      logEvent('system', 'No active payment to poll yet — launch a payment first.');
      return;
    }
    startPaymentPolling();
  } else {
    stopPaymentPolling();
    logEvent('system', 'Status polling stopped.');
  }
});

// ─── Environment Toggle ───────────────────────────────────────────────────────
envToggle.querySelectorAll('.env-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const env = btn.dataset.env;
    if (env === currentEnv) return;
    currentEnv = env;

    envToggle.querySelectorAll('.env-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (env === 'live') {
      envBanner.classList.add('live-mode');
      envBannerText.innerHTML = `Connected to <strong>Live</strong> — real transactions are enabled. Charges will apply.`;
    } else {
      envBanner.classList.remove('live-mode');
      envBannerText.innerHTML = `Connected to <strong>Sandbox</strong> — test transactions only, no real charges.`;
    }

    resetInlinePanel();
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active-inline'));
    logEvent('app', `Environment switched → ${currentEnv.toUpperCase()}`);
  });
});

// ─── Per-method config toggles (Display / 3DS / 3DS Handling) ─────────────────
document.querySelectorAll('.method-card').forEach(card => {
  card.querySelectorAll('.mini-toggle').forEach(toggle => {
    const key = toggle.dataset.config; // 'display' | 'tds' | 'tdsmode'
    toggle.querySelectorAll('.mini-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.mini-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        card.dataset[key] = btn.dataset.val;
        logEvent('app', `${card.dataset.method} config: ${key} = ${btn.dataset.val}`);
      });
    });
  });
});

function getCardConfig(method) {
  const card = document.querySelector(`.method-card[data-method="${method}"]`);
  return {
    card,
    display: card.dataset.display,
    tds:     card.dataset.tds === 'true',
    tdsMode: card.dataset.tdsmode || 'toolkit', // 'toolkit' | 'manual'
  };
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(tag, title, contentHTML) {
  modalTag.textContent   = tag;
  modalTitle.textContent = title;
  modalBody.innerHTML    = contentHTML;
  modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalBody.innerHTML = '';
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── Inline Preview Panel ─────────────────────────────────────────────────────
function openInlinePanel(tag, title, contentHTML) {
  inlinePanelTag.textContent   = tag;
  inlinePanelTitle.textContent = title;
  inlinePanelBody.style.backgroundImage = 'none';
  inlinePanelBody.innerHTML    = contentHTML;
}

function resetInlinePanel() {
  inlinePanelTag.textContent   = 'IDLE';
  inlinePanelTitle.textContent = 'No active session';
  inlinePanelBody.style.backgroundImage = '';
  inlinePanelBody.innerHTML = `
    <div class="inline-empty">
      <div class="inline-empty-icon">⬡</div>
      <div class="inline-empty-text">Set a method to <strong>Inline</strong> and launch it to preview the embedded checkout here.</div>
      <div class="inline-empty-sub">Methods set to <strong>Modal</strong> open in an overlay instead.</div>
    </div>
  `;
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function setCardLoading(card, isLoading) {
  card.classList.toggle('loading', isLoading);
}

// ─── Checkout Session ─────────────────────────────────────────────────────────
async function createCheckoutSession(tds) {
  currentReference = `demo_${Date.now()}`;
  currentPaymentId = null;
  stopPaymentPolling();

  const payload = {
    amount:                product.amount,
    capture:               true,
    currency:              product.currency,
    country:               product.country,
    description:           product.description,
    merchant_reference_id: currentReference,
    statement_descriptor:  'RapydToolkit',
    complete_checkout_url: 'https://www.example.com/complete_checkout_url',
    cancel_checkout_url:   'https://www.example.com/cancel_checkout_url',
    complete_payment_url:  'https://www.example.com/complete_payment_url',
    error_payment_url:     'https://www.example.com/error_checkout_url',
    custom_elements: { display_description: true },
    payment_method_type_categories: ['card'],
    payment_method_options: { '3d_required': tds },
    env: currentEnv,
  };

  logEvent('api', `POST /api/create-checkout-session`, {
    ref: currentReference, '3d_required': tds, env: currentEnv,
  });

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const data = await res.json();

  logEvent('api', `Checkout session created`, {
    checkout_id: data?.data?.id, status: data?.status?.status,
  });

  return data;
}

// ─── Load Toolkit Script ──────────────────────────────────────────────────────
function loadRapydToolkitScript(env) {
  return new Promise((resolve) => {
    const url = env === 'live'
      ? 'https://checkouttoolkit.rapyd.net'
      : 'https://sandboxcheckouttoolkit.rapyd.net';

    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }

    logEvent('app', `Loading toolkit script → ${url}`);
    const script = document.createElement('script');
    script.src    = url;
    script.onload = () => { logEvent('app', 'Toolkit script loaded.'); resolve(); };
    document.body.appendChild(script);
  });
}

// ─── Render Toolkit (full) ────────────────────────────────────────────────────
function renderToolkit(checkoutId, display, tdsMode) {
  // Toolkit-managed: the toolkit drives the 3DS redirect and re-fires
  // success/failure events afterwards (wait_on_payment_redirect: true).
  // Manual: we keep the flag false and handle redirect_url ourselves via
  // onCheckoutPaymentPending — opened in a NEW TAB so this page (and its
  // event listeners) survive. Resolution then arrives via webhook polling.
  const toolkitManaged = tdsMode === 'toolkit';

  const config = {
    id:                           checkoutId,
    pay_button_text:              'Pay Now',
    pay_button_color:             '#0057FF',
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect:     toolkitManaged,
    close_on_complete:            true,
    page_type:                    'collection',
    digital_wallets_buttons_only: false,
    digital_wallets_include_methods: ['google_pay', 'apple_pay'],
  };

  logEvent('toolkit', `RapydCheckoutToolkit init`, {
    wait_on_payment_confirmation: config.wait_on_payment_confirmation,
    wait_on_payment_redirect:     config.wait_on_payment_redirect,
    mode: toolkitManaged ? '3DS toolkit-managed' : '3DS manual',
  });

  const checkout = new RapydCheckoutToolkit(config);
  checkout.displayCheckout();
  logEvent('toolkit', 'displayCheckout() called — iframe rendering.');

  bindCheckoutEvents(display);

  if (!toolkitManaged) {
    // Manual mode: catch the pending event carrying redirect_url
    window.addEventListener('onCheckoutPaymentPending', (e) => {
      const payment = e.detail || {};
      currentPaymentId = payment.id || null;
      logEvent('toolkit', 'onCheckoutPaymentPending', {
        payment_id: payment.id, status: payment.status,
        next_action: payment.next_action, redirect_url: payment.redirect_url,
      });

      if (payment.next_action === '3d_verification' && payment.redirect_url) {
        showManual3DSPrompt(payment.redirect_url, display);
      }
    }, { once: true });
  }
}

// Manual-mode UI: surface the 3DS link rather than destroying the page
function showManual3DSPrompt(url, display) {
  logEvent('app', '3DS required — manual mode. Opening challenge in a new tab keeps this page (and its listeners) alive.');

  const promptHTML = `
    <div class="redirect-state">
      <div class="redirect-title">3DS Authentication Required</div>
      <div class="redirect-desc">
        The payment is <strong>ACT / paid:false / next_action: 3d_verification</strong>.
        Complete the challenge in a new tab — this page polls the payment status until it resolves.
      </div>
      <button class="launch-btn" id="open-3ds-btn" style="margin:0;">Open 3DS Challenge ↗</button>
      <div class="redirect-url">${url}</div>
    </div>
  `;

  if (display === 'modal') {
    modalBody.innerHTML = promptHTML;
  } else {
    inlinePanelBody.innerHTML = promptHTML;
  }

  // Start polling Retrieve Payment so the outcome is visible without webhooks
  startPaymentPolling();

  document.getElementById('open-3ds-btn').addEventListener('click', () => {
    logEvent('app', `Opening 3DS challenge in new tab → ${url}`);
    window.open(url, '_blank', 'noopener');
  });
}

// ─── Render Toolkit (wallets only) ────────────────────────────────────────────
function renderToolkitWallets(checkoutId, display) {
  const config = {
    id:                           checkoutId,
    pay_button_text:              'Pay Now',
    pay_button_color:             '#0057FF',
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect:     true,
    close_on_complete:            true,
    page_type:                    'collection',
    digital_wallets_buttons_only: true,
    digital_wallets_include_methods: ['google_pay', 'apple_pay'],
    digital_wallets_buttons_customization: {
      google_pay: { button_color: 'black', button_type: 'buy' },
      apple_pay:  { button_color: 'black', button_type: 'buy' },
    },
  };

  logEvent('toolkit', `RapydCheckoutToolkit init (wallets only)`, {
    wait_on_payment_confirmation: config.wait_on_payment_confirmation,
    wait_on_payment_redirect:     config.wait_on_payment_redirect,
  });

  const checkout = new RapydCheckoutToolkit(config);
  checkout.displayCheckout();
  logEvent('toolkit', 'displayCheckout() called — iframe rendering.');

  bindCheckoutEvents(display);

  window.addEventListener('onCheckoutPaymentPending', (e) => {
    currentPaymentId = e.detail?.id || currentPaymentId;
    logEvent('toolkit', 'onCheckoutPaymentPending', {
      payment_id: e.detail?.id, next_action: e.detail?.next_action,
    });
  }, { once: true });

  window.addEventListener('onCheckoutPaymentExpired', (e) => {
    logEvent('toolkit', 'onCheckoutPaymentExpired', e.detail || null);
  }, { once: true });

  window.addEventListener('onLoading', (e) => {
    logEvent('toolkit', `onLoading: ${e.detail?.loading}`);
  }, { once: true });
}

// ─── Shared checkout event binding ────────────────────────────────────────────
function bindCheckoutEvents(display) {
  window.addEventListener('onCheckoutPaymentSuccess', (e) => {
    currentPaymentId = e.detail?.id || currentPaymentId;
    stopPaymentPolling();
    logEvent('toolkit', 'onCheckoutPaymentSuccess', {
      payment_id: e.detail?.id, status: e.detail?.status, paid: e.detail?.paid,
    });
    if (display === 'modal') closeModal();
    else resetInlinePanel();
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active-inline'));
    showToast('✅ Payment succeeded');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentFailure', (e) => {
    stopPaymentPolling();
    logEvent('error', 'onCheckoutPaymentFailure', e.detail?.error || null);
    showToast('❌ Payment failed', 'error');
  }, { once: true });
}

// ─── Launch: embedded methods ─────────────────────────────────────────────────
async function launchEmbedded(method) {
  const { card, display, tds, tdsMode } = getCardConfig(method);
  const isWallets = method === 'wallets';
  const tag      = isWallets ? 'IFRAME · WALLETS' : 'IFRAME';
  const title    = isWallets ? 'Embedded Checkout — Digital Wallets' : 'Embedded Checkout — Full';

  logEvent('app', `Launch: ${title}`, { display, '3d_required': tds, ...(isWallets ? {} : { tdsMode }) });

  setCardLoading(card, true);
  const toolkitHTML = `<div id="toolkit-container"><div id="rapyd-checkout"></div></div>`;

  if (display === 'modal') {
    openModal(tag, title, toolkitHTML);
  } else {
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active-inline'));
    card.classList.add('active-inline');
    openInlinePanel(tag, title, toolkitHTML);
  }

  try {
    const data = await createCheckoutSession(tds);
    const id   = data?.data?.id;
    if (!id) throw new Error('No checkout ID returned');

    await loadRapydToolkitScript(currentEnv);
    if (isWallets) renderToolkitWallets(id, display);
    else           renderToolkit(id, display, tdsMode);
  } catch (err) {
    logEvent('error', err.message);
    if (display === 'modal') closeModal();
    else { resetInlinePanel(); card.classList.remove('active-inline'); }
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setCardLoading(card, false);
  }
}

// ─── Launch: hosted redirect ──────────────────────────────────────────────────
async function launchHosted() {
  const { card, tds } = getCardConfig('hosted');
  logEvent('app', 'Launch: Hosted Checkout Page (full redirect)', { '3d_required': tds });
  setCardLoading(card, true);

  openModal('REDIRECT', 'Hosted Checkout Page', `
    <div class="redirect-state">
      <div class="redirect-spinner"></div>
      <div class="redirect-title">Creating checkout session…</div>
      <div class="redirect-desc">Generating a Rapyd-hosted checkout URL. You'll be redirected to complete the payment.</div>
    </div>
  `);

  try {
    const data = await createCheckoutSession(tds);
    const url  = data?.data?.redirect_url;
    if (!url) throw new Error('No redirect URL returned');

    logEvent('app', `Redirecting to hosted checkout → ${url}`);

    modalBody.innerHTML = `
      <div class="redirect-state">
        <div class="redirect-spinner"></div>
        <div class="redirect-title">Redirecting to Rapyd Checkout</div>
        <div class="redirect-desc">
          Your session is ready. You're being redirected to complete the payment securely on Rapyd's hosted page.
          <br><br>
          <em>Note: 3D Secure is managed automatically by Rapyd on hosted checkout pages.</em>
        </div>
        <div class="redirect-url">${url}</div>
      </div>
    `;

    setTimeout(() => { window.location.href = url; }, 1400);
  } catch (err) {
    logEvent('error', err.message);
    closeModal();
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setCardLoading(card, false);
  }
}

// ─── Launch button wiring ─────────────────────────────────────────────────────
document.querySelectorAll('.launch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const method = btn.dataset.launch;
    if (method === 'hosted') launchHosted();
    else launchEmbedded(method);
  });
});

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        padding: 10px 20px; border-radius: 6px;
        font-family: var(--font-sans); font-size: 13px; font-weight: 500;
        background: #0F0F0F; color: #FAFAFA;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2); z-index: 999;
        animation: toastIn 0.2s ease;
      }
      .toast-error { background: #DC2626; }
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => toast.remove(), 3500);
}
