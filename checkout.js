const BACKEND_URL = 'https://rapyd-backend.vercel.app';

let selectedProduct = {
  name: "Cool T-Shirt",
  amount: "0.01",
  description: "Cool T-Shirt"
};

let currentEnv = 'sandbox';
let currentCheckoutSession = null; // cache full checkout session response

// DOM references
const cardForm = document.getElementById("card-form");
const toolkitContainer = document.getElementById("toolkit-container");
const redirectMsg = document.getElementById("redirect-msg");
const defaultMsg = document.getElementById("default-msg");

// Utility
function hideAllPanels() {
  cardForm.classList.add("hidden");
  toolkitContainer.classList.add("hidden");
  redirectMsg.classList.add("hidden");
  defaultMsg.classList.add("hidden");
}

// Init
hideAllPanels();
defaultMsg.classList.remove("hidden");

// Env toggle
const envRadios = document.querySelectorAll('input[name="env-toggle"]');
envRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      currentEnv = e.target.value;
      currentCheckoutSession = null; // invalidate
      console.log("Environment switched to:", currentEnv);
    }
  });
});

// Product selection
const productDivs = document.querySelectorAll('.product');
productDivs.forEach(div => {
  div.addEventListener('click', () => {
    productDivs.forEach(d => d.classList.remove('selected'));
    div.classList.add('selected');
    selectedProduct = JSON.parse(div.getAttribute('data-product'));
    currentCheckoutSession = null; // invalidate
  });
});

// Card form
document.getElementById('pay-direct-card').onclick = () => {
  hideAllPanels();
  cardForm.classList.remove("hidden");
};

cardForm.onsubmit = async (e) => {
  e.preventDefault();
  const cardData = {
    name: document.getElementById('name').value,
    number: document.getElementById('number').value,
    expiration_month: document.getElementById('exp_month').value,
    expiration_year: document.getElementById('exp_year').value,
    cvv: document.getElementById('cvv').value,
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-direct-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        capture: true,
        description: selectedProduct.description,
        env: currentEnv,
        payment_method: {
          type: "de_visa_card",
          fields: cardData
        }
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    alert(`Payment Status: ${data.status || JSON.stringify(data)}`);
  } catch (err) {
    alert('Payment failed: ' + err.message);
  }
};

// Reuse full checkout session if available
async function createCheckoutSession() {
  if (currentCheckoutSession) {
    return currentCheckoutSession;
  }

  const payload = {
    amount: selectedProduct.amount,
    currency: 'SGD',
    country: 'SG',
    description: selectedProduct.description,
    merchant_reference_id: 'Rapyd_Txn_000XXX',
    statement_descriptor: 'Rapyd Test',
    complete_checkout_url: 'http://example.com/success',
    cancel_checkout_url: 'http://example.com/cancel',
    complete_payment_url: 'http://example.com/complete',
    error_payment_url: 'http://example.com/error',
    custom_elements: {
      display_description: true
    },
    payment_method_type_categories: [
      'card',
      'bank_transfer',
      'bank_redirect',
      'cash'
    ],
    env: currentEnv,
  };

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  const data = await res.json();
  currentCheckoutSession = data; // cache full response
  return data;
}

// Hosted page
document.getElementById('pay-hosted-page').onclick = async () => {
  hideAllPanels();
  redirectMsg.classList.remove("hidden");

  try {
    const data = await createCheckoutSession();
    if (data.data && data.data.redirect_url) {
      window.location.href = data.data.redirect_url;
    } else {
      alert('No redirect URL received');
    }
  } catch (err) {
    alert('Error creating checkout session: ' + err.message);
  }
};

// Embed Rapyd Toolkit script safely once per env
async function loadRapydToolkitScript(callback) {
  const url = currentEnv === 'live'
    ? 'https://checkouttoolkit.rapyd.net'
    : 'https://sandboxcheckouttoolkit.rapyd.net';

  if (document.querySelector(`script[src="${url}"]`)) {
    callback();
    return;
  }

  const script = document.createElement('script');
  script.src = url;
  script.onload = callback;
  document.body.appendChild(script);
}

// Full toolkit
document.getElementById('pay-toolkit').onclick = async () => {
  hideAllPanels();
  toolkitContainer.classList.remove("hidden");
  toolkitContainer.innerHTML = `<div id="rapyd-checkout"></div>`;

  try {
    const data = await createCheckoutSession();
    loadRapydToolkitScript(() => renderToolkit(data.data.id));
  } catch (err) {
    alert('Toolkit error: ' + err.message);
  }
};

// Toolkit - Wallets Only
document.getElementById('pay-toolkit-wallets').onclick = async () => {
  hideAllPanels();
  toolkitContainer.classList.remove("hidden");
  toolkitContainer.innerHTML = `<div id="rapyd-checkout"></div>`;

  try {
    const data = await createCheckoutSession();
    loadRapydToolkitScript(() => renderToolkitWallets(data.data.id));
  } catch (err) {
    alert('Toolkit Wallets error: ' + err.message);
  }
};

// Render full toolkit
function renderToolkit(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id: checkoutId,
    pay_button_text: "Pay Now",
    pay_button_color: "#373737",
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect: true,
    close_on_complete: false,
    page_type: "collection",
    digital_wallets_buttons_only: false,
    digital_wallets_include_methods: ["google_pay", "apple_pay"],
  });

  checkout.displayCheckout();

  window.addEventListener("onCheckoutPaymentSuccess", () => {
    alert('✅ Payment succeeded!');
  });
  window.addEventListener("onCheckoutPaymentFailure", () => {
    alert('❌ Payment failed.');
  });
}

// Render wallets only
function renderToolkitWallets(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id: checkoutId,
    pay_button_text: "Click to pay",
    pay_button_color: "blue",
    wait_on_payment_confirmation: true,
    wait_on_payment_redirect: true,
    close_on_complete: true,
    page_type: "collection",
    digital_wallets_buttons_only: true,
    digital_wallets_include_methods: ["google_pay", "apple_pay"],
    digital_wallets_buttons_customization: {
      google_pay: {
        button_color: "black",
        button_type: "buy"
      },
      apple_pay: {
        button_color: "black",
        button_type: "buy"
      }
    }
  });

  checkout.displayCheckout();

  window.addEventListener("onCheckoutPaymentSuccess", (event) => {
    console.log(event.detail);
    alert('✅ Payment succeeded!');
  });

  window.addEventListener("onCheckoutPaymentFailure", (event) => {
    console.log(event.detail.error);
    alert('❌ Payment failed.');
  });

  window.addEventListener("onCheckoutPaymentPending", (event) => {
    console.log(event.detail);
  });

  window.addEventListener("onCheckoutPaymentExpired", (event) => {
    console.log(event.detail);
  });

  window.addEventListener("onLoading", (event) => {
    console.log(event.detail.loading);
  });
}
