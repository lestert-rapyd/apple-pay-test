const BACKEND_URL = 'https://rapyd-backend.vercel.app';

let selectedProduct = {
  name: "Cool T-Shirt",
  amount: "19.99",
  description: "Cool T-Shirt"
};

// Handle product selection
const productDivs = document.querySelectorAll('.product');
productDivs.forEach(div => {
  div.addEventListener('click', () => {
    productDivs.forEach(d => d.classList.remove('selected'));
    div.classList.add('selected');
    selectedProduct = JSON.parse(div.getAttribute('data-product'));
  });
});

// Show card form
document.getElementById('pay-direct-card').onclick = () => {
  document.getElementById('card-form').style.display = 'block';
  document.getElementById('toolkit-container').innerHTML = '';
};

// Handle Direct API card form submit
document.getElementById('card-form').onsubmit = async (e) => {
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

// Hosted Page - redirect to Rapyd-hosted checkout
document.getElementById('pay-hosted-page').onclick = async () => {
  document.getElementById('card-form').style.display = 'none';
  document.getElementById('toolkit-container').innerHTML = '';

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        country: 'DE',
        description: selectedProduct.description,
        complete_checkout_url: 'https://example.com/success',
        cancel_checkout_url: 'https://example.com/cancel',
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

// Checkout Toolkit (iframe)
document.getElementById('pay-toolkit').onclick = async () => {
  document.getElementById('card-form').style.display = 'none';
  const container = document.getElementById('toolkit-container');
  container.innerHTML = '';

  try {
    const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: selectedProduct.amount,
        currency: 'USD',
        country: 'DE',
        description: selectedProduct.description,
        complete_checkout_url: 'https://example.com/success',
        cancel_checkout_url: 'https://example.com/cancel',
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const data = await res.json();
    if (!data.data || !data.data.id) {
      alert('No checkout_id received');
      return;
    }

    // Add the container div required by Rapyd Checkout Toolkit
    container.innerHTML = `<div id="rapyd-checkout"></div>`;

    // Load Rapyd Toolkit script if not already loaded
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

// Render Rapyd Checkout Toolkit
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
    console.log("Payment succeeded:", event.detail);
    alert('✅ Payment succeeded!');
  });

  window.addEventListener("onCheckoutPaymentFailure", (event) => {
    console.error("Payment failed:", event.detail.error);
    alert('❌ Payment failed.');
  });
}
