const BACKEND_URL = 'https://rapyd-backend.vercel.app';

let selectedProduct = {
  name: "Cool T-Shirt",
  amount: "0.01",
  description: "Cool T-Shirt"
};

// DOM references
const cardForm = document.getElementById("card-form");
const toolkitContainer = document.getElementById("toolkit-container");
const redirectMsg = document.getElementById("redirect-msg");
const defaultMsg = document.getElementById("default-msg");

// Utility to hide all panels
function hideAllPanels() {
  cardForm.classList.add("hidden");
  toolkitContainer.classList.add("hidden");
  redirectMsg.classList.add("hidden");
  defaultMsg.classList.add("hidden");
}

// Init: Hide everything except default message
hideAllPanels();
defaultMsg.classList.remove("hidden");

// Handle product selection
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
  cardForm.classList.remove('hidden');
};

// Submit Direct Payment
cardForm.onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const number = document.getElementById('number').value;
  const exp_month = document.getElementById('exp_month').value;
  const exp_year = document.getElementById('exp_year').value;
  const cvv = document.getElementById('cvv').value;

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-direct-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        capture: true,
        description: selectedProduct.description,
        card: { name, number, expiration_month: exp_month, expiration_year: exp_year, cvv }
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    alert(`Payment Status: ${data.status || JSON.stringify(data)}`);
  } catch (err) {
    alert('Payment failed: ' + err.message);
  }
};

// Hosted Checkout
document.getElementById('pay-hosted-page').onclick = async () => {
  hideAllPanels();
  redirectMsg.classList.remove("hidden");

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        country: 'DE',
        description: selectedProduct.description,
        complete_checkout_url: 'https://rapydtoolkit.com/success',
        cancel_checkout_url: 'https://rapydtoolkit.com/failed',
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    if (data.data && data.data.redirect_url) {
      window.location.href = data.data.redirect_url;
    } else {
      alert('No redirect URL received');
    }
  } catch (err) {
    alert('Error creating checkout session: ' + err.message);
  }
};

// Toolkit (Embedded)
document.getElementById('pay-toolkit').onclick = async () => {
  hideAllPanels();
  toolkitContainer.classList.remove("hidden");
  toolkitContainer.innerHTML = '';

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        country: 'DE',
        description: selectedProduct.description,
        complete_checkout_url: 'https://rapydtoolkit.com/success',
        cancel_checkout_url: 'https://rapydtoolkit.com/failed',
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    if (!data.data || !data.data.id) {
      alert('No checkout_id received');
      return;
    }

    toolkitContainer.innerHTML = `<div id="rapyd-checkout"></div>`;

    if (!window.RapydCheckoutToolkit) {
      const script = document.createElement('script');
      script.src = 'https://sandboxcheckouttoolkit.rapyd.net';
      script.onload = () => renderToolkit(data.data.id);
      document.body.appendChild(script);
    } else {
      renderToolkit(data.data.id);
    }
  } catch (err) {
    alert('Toolkit error: ' + err.message);
  }
};

// AP GP only
document.getElementById('pay-toolkit-wallets').onclick = async () => {
  hideAllPanels();
  toolkitContainer.classList.remove("hidden");
  toolkitContainer.innerHTML = '';

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        country: 'DE',
        description: selectedProduct.description,
        complete_checkout_url: 'https://rapydtoolkit.com/success',
        cancel_checkout_url: 'https://rapydtoolkit.com/failed',
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    if (!data.data || !data.data.id) {
      alert('No checkout_id received');
      return;
    }

    toolkitContainer.innerHTML = `<div id="rapyd-checkout"></div>`;

    if (!window.RapydCheckoutToolkit) {
      const script = document.createElement('script');
      script.src = 'https://sandboxcheckouttoolkit.rapyd.net';
      script.onload = () => renderToolkitWallets(data.data.id);
      document.body.appendChild(script);
    } else {
      renderToolkitWallets(data.data.id);
    }
  } catch (err) {
    alert('Toolkit Wallets error: ' + err.message);
  }
};


// Render Full Rapyd Toolkit
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

  window.addEventListener("onCheckoutPaymentSuccess", (event) => {
    alert('✅ Payment succeeded!');
  });

  window.addEventListener("onCheckoutPaymentFailure", (event) => {
    alert('❌ Payment failed.');
  });
}

// Render AP/GP Toolkit
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
        button_type: "pay"
      },
      apple_pay: {
        button_color: "black",
        button_type: "pay"
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
