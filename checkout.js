const BACKEND_URL = 'https://rapyd-backend.vercel.app'; // Your Vercel backend

let selectedProduct = {
  name: "Cool T-Shirt",
  amount: "0.01",
  description: "Cool T-Shirt"
};

let currentEnv = 'sandbox';  // Default environment

// DOM references
const cardForm = document.getElementById("card-form");
const toolkitContainer = document.getElementById("toolkit-container");
const redirectMsg = document.getElementById("redirect-msg");
const defaultMsg = document.getElementById("default-msg");

// Radio toggles for environment
const envRadios = document.querySelectorAll('input[name="env-toggle"]');

// Utility: hide all panels
function hideAllPanels() {
  cardForm.classList.add("hidden");
  toolkitContainer.classList.add("hidden");
  redirectMsg.classList.add("hidden");
  defaultMsg.classList.add("hidden");
}

// Initialize: hide all, show default message
hideAllPanels();
defaultMsg.classList.remove("hidden");

// Listen to environment radio changes
envRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      currentEnv = e.target.value;
      console.log("Environment switched to:", currentEnv);
    }
  });
});

// Product selection logic
const productDivs = document.querySelectorAll('.product');
productDivs.forEach(div => {
  div.addEventListener('click', () => {
    productDivs.forEach(d => d.classList.remove('selected'));
    div.classList.add('selected');
    selectedProduct = JSON.parse(div.getAttribute('data-product'));
  });
});

// Pay with Card (Direct API)
document.getElementById('pay-direct-card').onclick = () => {
  hideAllPanels();
  cardForm.classList.remove("hidden");
};

// Submit Direct Payment via backend
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
        env: currentEnv,  // Pass environment to backend
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

// Helper: create checkout session for hosted / toolkit
async function createCheckoutSession() {
  const payload = {
    amount: selectedProduct.amount,
    currency: 'USD',
    country: 'DE',
    description: selectedProduct.description,
    complete_checkout_url: 'https://rapydtoolkit.com/success',
    cancel_checkout_url: 'https://rapydtoolkit.com/failed',
    env: currentEnv,  // tell backend which environment
  };

  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }
  return await res.json();
}

// Hosted page redirect
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

// Full Toolkit (embedded)
document.getElementById('pay-toolkit').onclick = async () => {
  hideAllPanels();
  toolkitContainer.classList.remove("hidden");
  toolkitContainer.innerHTML = '';

  try {
    const data = await createCheckoutSession();
    if (!data.data || !data.data.id) {
      alert('No checkout_id received');
      return;
    }

    toolkitContainer.innerHTML = `<div id="rapyd-checkout"></div>`;

    const script = document.createElement('script');
    script.src = currentEnv === 'live'
      ? 'https://checkouttoolkit.rapyd.net'
      : 'https://sandboxcheckouttoolkit.rapyd.net';
    script.onload = () => renderToolkit(data.data.id);
    document.body.appendChild(script);
  } catch (err) {
    alert('Toolkit error: ' + err.message);
  }
};

// Toolkit with Apple Pay / Google Pay only
document.getElementById('pay-toolkit-wallets').onclick = async () => {
  hideAllPanels();
  toolkitContainer.classList.remove("hidden");
  toolkitContainer.innerHTML = '';

  try {
    const data = await createCheckoutSession();
    if (!data.data || !data.data.id) {
      alert('No checkout_id received');
      return;
    }

    toolkitContainer.innerHTML = `<div id="rapyd-checkout"></div>`;

    const script = document.createElement('script');
    script.src = currentEnv === 'live'
      ? 'https://checkouttoolkit.rapyd.net'
      : 'https://sandboxcheckouttoolkit.rapyd.net';
    script.onload = () => renderToolkitWallets(data.data.id);
    document.body.appendChild(script);
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

// Render toolkit for wallets only
function renderToolkitWallets(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id: checkoutId,
    pay_button_text: "Click to pay",
    pay_button_color: "blue",
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

  window.addEventListener("onCheckoutPaymentSuccess", () => {
    alert('✅ Payment succeeded!');
  });
  window.addEventListener("onCheckoutPaymentFailure", () => {
    alert('❌ Payment failed.');
  });
}
