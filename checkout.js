const BACKEND_URL = 'https://rapyd-backend.vercel.app';

// ─── State ────────────────────────────────────────────────────────────────────
let currentEnv = 'sandbox';
let currentCheckoutSession = null;

const product = {
  name: 'Developer Test Kit',
  amount: '0.01',
  currency: 'GBP',
  country: 'GB',
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

// ─── Environment Toggle ───────────────────────────────────────────────────────
envToggle.querySelectorAll('.env-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const env = btn.dataset.env;
    if (env === currentEnv) return;

    currentEnv = env;
    currentCheckoutSession = null; // invalidate cache

    // Update button states
    envToggle.querySelectorAll('.env-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update banner
    if (env === 'live') {
      envBanner.classList.add('live-mode');
      envBannerText.innerHTML = `Connected to <strong>Live</strong> — real transactions are enabled. Charges will apply.`;
    } else {
      envBanner.classList.remove('live-mode');
      envBannerText.innerHTML = `Connected to <strong>Sandbox</strong> — test transactions only, no real charges.`;
    }

    console.log('[rapyd-demo] Environment:', currentEnv);
  });
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
  modalBody.innerHTML          = '';
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ─── Loading State ────────────────────────────────────────────────────────────
function setLoading(btn, isLoading) {
  if (isLoading) {
    btn.classList.add('loading');
    btn.dataset.originalArrow = btn.querySelector('.method-arrow').textContent;
    btn.querySelector('.method-arrow').textContent = '·';
  } else {
    btn.classList.remove('loading');
    if (btn.dataset.originalArrow) {
      btn.querySelector('.method-arrow').textContent = btn.dataset.originalArrow;
    }
  }
}

// ─── Checkout Session ─────────────────────────────────────────────────────────
async function createCheckoutSession() {
  if (currentCheckoutSession) return currentCheckoutSession;

  const payload = {
    amount: product.amount,
    currency: product.currency,
    country: product.country,
    description: product.description,
    merchant_reference_id: `demo_${Date.now()}`,
    statement_descriptor: 'Rapyd Demo',
    complete_checkout_url: 'https://www.rapyd.net',
    cancel_checkout_url:   'https://www.rapydtoolkit.com',
    complete_payment_url:  'https://www.rapyd.net',
    error_payment_url:     'https://www.rapyd.net',
    custom_elements: {
      display_description: true,
    },
    payment_method_type_categories: ['card', 'bank_transfer', 'bank_redirect', 'cash'],
    env: currentEnv,
  };

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) { resolve(); return; }

    const script = document.createElement('script');
    script.src    = url;
    script.onload = resolve;
    document.body.appendChild(script);
  });
}

// ─── Render: Full Toolkit ─────────────────────────────────────────────────────
function renderToolkit(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id: checkoutId,
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

// ─── Render: Wallets Only ─────────────────────────────────────────────────────
function renderToolkitWallets(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id: checkoutId,
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
    console.log('[rapyd-demo] Payment success:', e.detail);
    closeModal();
    showToast('✅ Payment succeeded');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentFailure', (e) => {
    console.log('[rapyd-demo] Payment failure:', e.detail?.error);
    showToast('❌ Payment failed', 'error');
  }, { once: true });

  window.addEventListener('onCheckoutPaymentPending', (e) => {
    console.log('[rapyd-demo] Payment pending:', e.detail);
  }, { once: true });

  window.addEventListener('onCheckoutPaymentExpired', (e) => {
    console.log('[rapyd-demo] Payment expired:', e.detail);
  }, { once: true });

  window.addEventListener('onLoading', (e) => {
    console.log('[rapyd-demo] Loading:', e.detail?.loading);
  }, { once: true });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Inject toast styles if not already present
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

// ─── Button: Hosted Redirect ──────────────────────────────────────────────────
document.getElementById('pay-hosted-page').addEventListener('click', async function () {
  const btn = this;
  setLoading(btn, true);

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

    // Update modal to show the destination URL before redirecting
    modalBody.innerHTML = `
      <div class="redirect-state">
        <div class="redirect-spinner"></div>
        <div class="redirect-title">Redirecting to Rapyd Checkout</div>
        <div class="redirect-desc">
          Your hosted checkout session is ready. You're being redirected now to complete the payment securely on Rapyd's platform.
        </div>
        <div class="redirect-url">${url}</div>
      </div>
    `;

    setTimeout(() => {
      window.location.href = url;
    }, 1200);

  } catch (err) {
    closeModal();
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setLoading(btn, false);
  }
});

// ─── Button: Embedded Full ────────────────────────────────────────────────────
document.getElementById('pay-toolkit').addEventListener('click', async function () {
  const btn = this;
  setLoading(btn, true);

  openModal('IFRAME', 'Embedded Checkout — Full', `
    <div id="toolkit-container">
      <div id="rapyd-checkout"></div>
    </div>
  `);

  try {
    const data = await createCheckoutSession();
    const id   = data?.data?.id;
    if (!id) throw new Error('No checkout ID returned');

    await loadRapydToolkitScript(currentEnv);
    renderToolkit(id);
  } catch (err) {
    closeModal();
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setLoading(btn, false);
  }
});

// ─── Button: Embedded Wallets ─────────────────────────────────────────────────
document.getElementById('pay-toolkit-wallets').addEventListener('click', async function () {
  const btn = this;
  setLoading(btn, true);

  openModal('IFRAME · WALLETS', 'Embedded Checkout — Digital Wallets', `
    <div id="toolkit-container">
      <div id="rapyd-checkout"></div>
    </div>
  `);

  try {
    const data = await createCheckoutSession();
    const id   = data?.data?.id;
    if (!id) throw new Error('No checkout ID returned');

    await loadRapydToolkitScript(currentEnv);
    renderToolkitWallets(id);
  } catch (err) {
    closeModal();
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    setLoading(btn, false);
  }
});
