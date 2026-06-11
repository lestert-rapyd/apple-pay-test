const BACKEND_URL = 'https://rapyd-backend.vercel.app';

// ─── State ────────────────────────────────────────────────────────────────────
let currentEnv     = 'sandbox';
let currentDisplay = 'modal';   // 'modal' | 'inline'
let current3DS     = true;      // true | false
let currentCheckoutSession = null;

const product = {
  name:        'Developer Test Kit',
  amount:      '0.01',
  currency:    'GBP',
  country:     'GB',
  description: 'A lightweight item for integration testing across payment flows.',
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const modalOverlay   = document.getElementById('modal-overlay');
const modalTag       = document.getElementById('modal-tag');
const modalTitle     = document.getElementById('modal-title');
const modalBody      = document.getElementById('modal-body');
const modalClose     = document.getElementById('modal-close');
const envBanner      = document.getElementById('env-banner');
const envBannerText  = document.getElementById('env-banner-text');
const envToggle      = document.getElementById('env-toggle');
const displayToggle  = document.getElementById('display-toggle');
const tdsToggle      = document.getElementById('tds-toggle');
const tdsHint        = document.getElementById('tds-hint');
const inlinePanel    = document.getElementById('inline-panel');
const inlinePanelTag   = document.getElementById('inline-panel-tag');
const inlinePanelTitle = document.getElementById('inline-panel-title');
const inlinePanelBody  = document.getElementById('inline-panel-body');

// ─── Environment Toggle ───────────────────────────────────────────────────────
envToggle.querySelectorAll('.env-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const env = btn.dataset.env;
    if (env === currentEnv) return;
    currentEnv = env;
    currentCheckoutSession = null;

    envToggle.querySelectorAll('.env-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (env === 'live') {
      envBanner.classList.add('live-mode');
      envBannerText.innerHTML = `Connected to <strong>Live</strong> — real transactions are enabled. Charges will apply.`;
    } else {
      envBanner.classList.remove('live-mode');
      envBannerText.innerHTML = `Connected to <strong>Sandbox</strong> — test transactions only, no real charges.`;
    }

    // Clear inline panel on env switch
    resetInlinePanel();
    console.log('[rapyd-demo] env:', currentEnv);
  });
});

// ─── Display Toggle ───────────────────────────────────────────────────────────
displayToggle.querySelectorAll('.opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const display = btn.dataset.display;
    if (display === currentDisplay) return;
    currentDisplay = display;
    currentCheckoutSession = null;

    displayToggle.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (display === 'inline') {
      inlinePanel.classList.remove('hidden');
    } else {
      inlinePanel.classList.add('hidden');
      resetInlinePanel();
    }

    // Clear active-inline highlight
    document.querySelectorAll('.method-row').forEach(r => r.classList.remove('active-inline'));
    console.log('[rapyd-demo] display:', currentDisplay);
  });
});

// ─── 3DS Toggle ───────────────────────────────────────────────────────────────
tdsToggle.querySelectorAll('.opt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.dataset.tds === 'true';
    if (val === current3DS) return;
    current3DS = val;
    currentCheckoutSession = null; // invalidate — 3DS changes the session payload

    tdsToggle.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    console.log('[rapyd-demo] 3DS:', current3DS);
  });
});

// Update 3DS hint when redirect row is hovered / active
function update3DSHint(methodId) {
  if (methodId === 'pay-hosted-page') {
    tdsHint.textContent = 'Managed by Rapyd on hosted pages';
    tdsHint.classList.add('redirect-note');
  } else {
    tdsHint.textContent = 'Applied to embedded flows';
    tdsHint.classList.remove('redirect-note');
  }
}

document.querySelectorAll('.method-row').forEach(row => {
  row.addEventListener('mouseenter', () => update3DSHint(row.id));
  row.addEventListener('mouseleave', () => update3DSHint(null));
});

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

// ─── Inline Panel ─────────────────────────────────────────────────────────────
function openInlinePanel(tag, title, contentHTML) {
  inlinePanelTag.textContent   = tag;
  inlinePanelTitle.textContent = title;
  inlinePanelBody.innerHTML    = contentHTML;
}

function resetInlinePanel() {
  inlinePanelTag.textContent   = '';
  inlinePanelTitle.textContent = 'Select a payment method';
  inlinePanelBody.innerHTML    = `
    <div class="inline-empty">
      <div class="inline-empty-icon">⬡</div>
      <div class="inline-empty-text">Select a payment method to preview the checkout experience.</div>
    </div>
  `;
}

// ─── Loading State ────────────────────────────────────────────────────────────
function setLoading(btn, isLoading) {
  if (isLoading) {
    btn.classList.add('loading');
  } else {
    btn.classList.remove('loading');
  }
}

// ─── Checkout Session ─────────────────────────────────────────────────────────
async function createCheckoutSession() {
  if (currentCheckoutSession) return currentCheckoutSession;

  const payload = {
    amount:                product.amount,
    currency:              product.currency,
    country:               product.country,
    description:           product.description,
    merchant_reference_id: `demo_${Date.now()}`,
    statement_descriptor:  'Rapyd Demo',
    complete_checkout_url: 'https://www.rapyd.net',
    cancel_checkout_url:   'https://www.rapydtoolkit.com',
    complete_payment_url:  'https://www.rapyd.net',
    error_payment_url:     'https://www.rapyd.net',
    custom_elements: {
      display_description: true,
    },
    payment_method_type_categories: ['card', 'bank_transfer', 'bank_redirect', 'cash'],
    payment_method_options: {
      '3d_required': current3DS,
    },
    env: currentEnv,
  };

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Server error: ${res.status}`);

  const data = await res.json();
  currentCheckoutSession = data;
  return data;
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

// ─── Render Toolkit ───────────────────────────────────────────────────────────
function renderToolkit(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id:                           checkoutId,
    pay_button_text:              'Pay Now',
    pay_button_color:             '#0057FF',
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect:     false,
    close_on_complete:            false,
    page_type:                    'collection',
    digital_wallets_buttons_only: false,
    digital_wallets_include_methods: ['google_pay', 'apple_pay'],
  });

  checkout.displayCheckout();

  window.addEventListener('onCheckoutPaymentSuccess', () => {
    closeModal();
    showToast('✅ Payment succeeded');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentFailure', () => {
    showToast('❌ Payment failed', 'error');
  }, { once: true });
}

// ─── Render Wallets Only ──────────────────────────────────────────────────────
function renderToolkitWallets(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id:                           checkoutId,
    pay_button_text:              'Pay Now',
    pay_button_color:             '#0057FF',
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect:     false,
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

  window.addEventListener('onCheckoutPaymentSuccess', (e) => {
    console.log('[rapyd-demo] success:', e.detail);
    closeModal();
    showToast('✅ Payment succeeded');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentFailure', (e) => {
    console.log('[rapyd-demo] failure:', e.detail?.error);
    showToast('❌ Payment failed', 'error');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentPending',  (e) => { console.log('[rapyd-demo] pending:', e.detail); },  { once: true });
  window.addEventListener('onCheckoutPaymentExpired',  (e) => { console.log('[rapyd-demo] expired:', e.detail); },  { once: true });
  window.addEventListener('onLoading',                 (e) => { console.log('[rapyd-demo] loading:', e.detail?.loading); }, { once: true });
}

// ─── Shared: launch checkout (modal or inline) ────────────────────────────────
async function launchCheckout({ btnId, tag, title, renderFn }) {
  const btn = document.getElementById(btnId);
  setLoading(btn, true);

  const toolkitHTML = `<div id="toolkit-container"><div id="rapyd-checkout"></div></div>`;

  if (currentDisplay === 'modal') {
    openModal(tag, title, toolkitHTML);
  } else {
    document.querySelectorAll('.method-row').forEach(r => r.classList.remove('active-inline'));
    btn.classList.add('active-inline');
    openInlinePanel(tag, title, toolkitHTML);
  }

  try {
    const data = await createCheckoutSession();
    const id   = data?.data?.id;
    if (!id) throw new Error('No checkout ID returned');

    await loadRapydToolkitScript(currentEnv);
    renderFn(id);
  } catch (err) {
    if (currentDisplay === 'modal') closeModal();
    else resetInlinePanel();
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ─── Button: Hosted Redirect ──────────────────────────────────────────────────
document.getElementById('pay-hosted-page').addEventListener('click', async function () {
  const btn = this;
  setLoading(btn, true);

  // Redirect always opens modal with status message — inline doesn't make sense for redirect
  openModal('REDIRECT', 'Hosted Checkout Page', `
    <div class="redirect-state">
      <div class="redirect-spinner"></div>
      <div class="redirect-title">Creating checkout session…</div>
      <div class="redirect-desc">Generating a Rapyd-hosted checkout URL. You'll be redirected to complete the payment.</div>
    </div>
  `);

  try {
    const data = await createCheckoutSession();
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
    setLoading(btn, false);
  }
});

// ─── Button: Embedded Full ────────────────────────────────────────────────────
document.getElementById('pay-toolkit').addEventListener('click', () => {
  launchCheckout({
    btnId:    'pay-toolkit',
    tag:      'IFRAME',
    title:    'Embedded Checkout — Full',
    renderFn: renderToolkit,
  });
});

// ─── Button: Embedded Wallets ─────────────────────────────────────────────────
document.getElementById('pay-toolkit-wallets').addEventListener('click', () => {
  launchCheckout({
    btnId:    'pay-toolkit-wallets',
    tag:      'IFRAME · WALLETS',
    title:    'Embedded Checkout — Digital Wallets',
    renderFn: renderToolkitWallets,
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
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        border-radius: 6px;
        font-family: var(--font-sans);
        font-size: 13px;
        font-weight: 500;
        background: #0F0F0F;
        color: #FAFAFA;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        z-index: 999;
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
