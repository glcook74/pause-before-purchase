/**
 * Dopamine Delay — Stripe Checkout
 *
 * Uses Stripe Payment Links (no backend required).
 * Replace PLACEHOLDER with your actual Stripe Payment Link URL
 * from dashboard.stripe.com → Payment Links.
 */

(function () {
  'use strict';

  // Replace STRIPE_PAYMENT_LINK with your actual Stripe Payment Link URL
  const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/PLACEHOLDER';

  document.querySelectorAll('[data-stripe-checkout]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      if (STRIPE_PAYMENT_LINK.includes('PLACEHOLDER')) {
        alert(
          'Stripe Payment Link not yet configured.\n\n' +
          'To set up payments:\n' +
          '1. Go to dashboard.stripe.com\n' +
          '2. Create a Payment Link\n' +
          '3. Replace the PLACEHOLDER URL in js/stripe.js'
        );
        return;
      }

      window.location.href = STRIPE_PAYMENT_LINK;
    });
  });
})();
