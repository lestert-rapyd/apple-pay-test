// Put your real checkout page ID here
const CHECKOUT_ID = "checkout_53d76c77f5b496f34e6bb55ccc083739";

window.onload = function () {
  // Initialize the toolkit
  let checkout = new RapydCheckoutToolkit({
    id: CHECKOUT_ID,
    pay_button_text: "Pay with card",
    pay_button_color: "#373737",
    //
    wait_on_payment_confirmation: false,
    wait_on_payment_redirect: true,
    close_on_complete: false,
    page_type: "collection",
    //
    digital_wallets_buttons_only: false,
    digital_wallets_include_methods: ["google_pay", "apple_pay"],
    digital_wallets_buttons_customization: {
      google_pay: {
        button_color: "black",
        // button_type: "book"
      },
      apple_pay: {
        button_color: "black",
        // button_type: "book"
      },
    },
  });
  // Display the checkout
  checkout.displayCheckout();

  // Event listeners
  window.addEventListener("onCheckoutPaymentSuccess", function (event) {
    console.log("Payment completed:", event.detail);
    // e.g. show thank you message or redirect
  });
  window.addEventListener("onCheckoutPaymentFailure", function (event) {
    console.error("Payment failure:", event.detail.error);
    // e.g. display error message
  });
  window.addEventListener("onLoading", function (event) {
    console.log("Loading payment method:", event.detail);
  });
  window.addEventListener("onPaymentPending", function (event) {
    console.log("Payment pending:", event.detail);
  });
};
