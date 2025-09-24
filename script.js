// Replace with your actual backend URL (your rapyd-server deployment URL)
const BACKEND_URL = 'https://rapyd-backend.vercel.app';

// Show the direct card payment form when button clicked
document.getElementById('pay-direct-card').addEventListener('click', () => {
  document.getElementById('card-form').style.display = 'block';
});

// Handle direct card payment form submit
document.getElementById('card-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const number = document.getElementById('number').value;
  const expiration_month = document.getElementById('exp_month').value;
  const expiration_year = document.getElementById('exp_year').value;
  const cvv = document.getElementById('cvv').value;

  try {
    const response = await fetch(`${BACKEND_URL}/api/create-direct-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 19.99,
        currency: 'USD',
        description: 'Cool T-Shirt',
        card: {
          name,
          number,
          expiration_month,
          expiration_year,
          cvv
        }
      }),
    });

    const data = await response.json();

    if (data.status === 'SUCCESS' || data.status === 'SUCCEEDED') {
      alert('✅ Payment successful!');
    } else {
      alert('⚠️ Payment failed: ' + JSON.stringify(data));
    }
  } catch (err) {
    alert('❌ Payment error: ' + err.message);
  }
});

// Hosted Page payment - redirect user
document.getElementById('pay-hosted-page').addEventListener('click', async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 19.99,
        currency: 'USD',
        country: 'DE',
        description: 'Cool T-Shirt',
      }),
    });

    const data = await response.json();

    if (data.redirect_url) {
      window.location.href = data.redirect_url;
    } else {
      alert('⚠️ No redirect URL received');
    }
  } catch (err) {
    alert('❌ Error initiating hosted checkout: ' + err.message);
  }
});

// Toolkit payment - show embedded iframe checkout
document.getElementById('pay-toolkit').addEventListener('click', async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 19.99,
        currency: 'USD',
        description: 'Cool T-Shirt',
      }),
    });

    const data = await response.json();

    if (!data.checkout_id) {
      alert('⚠️ No checkout_id received from backend');
      return;
    }

    // Clear any existing iframe
    const container = document.getElementById('toolkit-container');
    container.innerHTML = '';

    // Load the toolkit script if not loaded
    if (!window.RapydCheckoutToolkit) {
      const script = document.createElement('script');
      script.src = 'https://sandboxcheckouttoolkit.rapyd.net';
      script.onload = () => {
        renderToolkit(data.checkout_id);
      };
      document.body.appendChild(script);
    } else {
      renderToolkit(data.checkout_id);
    }

  } catch (err) {
    alert('❌ Toolkit error: ' + err.message);
  }
});

function renderToolkit(checkoutId) {
  const checkout = new RapydCheckoutToolkit({
    id: checkoutId,
    pay_button_text: "Pay with card",
    pay_button_color: "#373737",
    wait_on_payment_confirmation: false,
    wait_on_payment_redirect: true,
    close_on_complete: false,
    page_type: "collection",
    digital_wallets_buttons_only: false,
    digital_wallets_include_methods: ["google_pay", "apple_pay"],
    digital_wallets_buttons_customization: {
      google_pay: { button_color: "black" },
      apple_pay: { button_color: "black" },
    },
  });

  checkout.displayCheckout();

  window.addEventListener("onCheckoutPaymentSuccess", (event) => {
    console.log("Payment succeeded:", event.detail);
    alert('✅ Payment succeeded!');
  });

  window.addEventListener("onCheckoutPaymentFailure", (event) => {
    console.error("Payment failed:", event.detail.error);
    alert('❌ Payment failed.');
  });
}
