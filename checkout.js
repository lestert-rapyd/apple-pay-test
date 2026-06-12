const BACKEND_URL = 'https://rapyd-backend.vercel.app';

// ─── State ────────────────────────────────────────────────────────────────────
// Env is global; display + 3DS are per-method (read from each card at launch).
let currentEnv = 'sandbox';

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
    console.log('[rapyd-demo] env:', currentEnv);
  });
});

// ─── Per-method config toggles (Display / 3DS) ────────────────────────────────
document.querySelectorAll('.method-card').forEach(card => {
  card.querySelectorAll('.mini-toggle').forEach(toggle => {
    const key = toggle.dataset.config; // 'display' | 'tds'
    toggle.querySelectorAll('.mini-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.mini-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        card.dataset[key] = btn.dataset.val;
        console.log(`[rapyd-demo] ${card.dataset.method} ${key}:`, btn.dataset.val);
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
  inlinePanelBody.style.backgroundImage = 'none'; // drop dot grid when content is live
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
// Always creates a fresh session — per-method 3DS means no safe shared cache.
async function createCheckoutSession(tds) {
  const payload = {
    amount:                product.amount,
    capture:               true,
    currency:              product.currency,
    country:               product.country,
    description:           product.description,
    merchant_reference_id: 'RapydToolkit',
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

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
}

// ─── Load Toolkit Script ──────────────────────────────────────────────────────
function loadRapydToolkitScript(env) {
  return new Promise((resolve) => {
    const url = env === 'live'
      ? 'https://checkouttoolkit.rapyd.net'
      : 'https://sandboxcheckouttoolkit.rapyd.net';

    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }

    const script = document.createElement('script');
    script.src    = url;
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

// ─── Render Toolkit (full) ────────────────────────────────────────────────────
function renderToolkit(checkoutId, display) {
  const checkout = new RapydCheckoutToolkit({
    id:                           checkoutId,
    pay_button_text:              'Pay Now',
    pay_button_color:             '#0057FF',
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect:     true,
    close_on_complete:            true,
    page_type:                    'collection',
    digital_wallets_buttons_only: false,
    digital_wallets_include_methods: ['google_pay', 'apple_pay'],
  });

  checkout.displayCheckout();
  bindCheckoutEvents(display);
}

// ─── Render Toolkit (wallets only) ────────────────────────────────────────────
function renderToolkitWallets(checkoutId, display) {
  const checkout = new RapydCheckoutToolkit({
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
  });

  checkout.displayCheckout();
  bindCheckoutEvents(display);

  window.addEventListener('onCheckoutPaymentPending', (e) => { console.log('[rapyd-demo] pending:', e.detail); }, { once: true });
  window.addEventListener('onCheckoutPaymentExpired', (e) => { console.log('[rapyd-demo] expired:', e.detail); }, { once: true });
  window.addEventListener('onLoading',                (e) => { console.log('[rapyd-demo] loading:', e.detail?.loading); }, { once: true });
}

// ─── Shared checkout event binding ────────────────────────────────────────────
function bindCheckoutEvents(display) {
  window.addEventListener('onCheckoutPaymentSuccess', () => {
    if (display === 'modal') closeModal();
    else resetInlinePanel();
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active-inline'));
    showToast('✅ Payment succeeded');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentFailure', () => {
    showToast('❌ Payment failed', 'error');
  }, { once: true });
}

// ─── Launch: embedded methods ─────────────────────────────────────────────────
async function launchEmbedded(method) {
  const { card, display, tds } = getCardConfig(method);
  const isWallets = method === 'wallets';
  const tag      = isWallets ? 'IFRAME · WALLETS' : 'IFRAME';
  const title    = isWallets ? 'Embedded Checkout — Digital Wallets' : 'Embedded Checkout — Full';
  const renderFn = isWallets ? renderToolkitWallets : renderToolkit;

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
    renderFn(id, display);
  } catch (err) {
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
