# Dopamine Delay — Marketing Website

Customer-facing website for [dopaminedelay.com](https://dopaminedelay.com).

## Pages

| Page | File | Description |
|------|------|-------------|
| Homepage | `index.html` | Landing page with hero, stats, features, pricing, CTA |
| How It Works | `how-it-works.html` | Science and research behind every feature |
| Pricing | `pricing.html` | Free vs Pro comparison + Stripe checkout |
| About | `about.html` | Team, mission, advisors |
| Mobile Waitlist | `waitlist.html` | Mobile app waitlist signup |
| Privacy Policy | `privacy.html` | GDPR-compliant privacy policy |
| Terms of Service | `terms.html` | Terms of service |

## Deployment to GitHub Pages

1. Go to [github.com/glcook74/pause-before-purchase](https://github.com/glcook74/pause-before-purchase)
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Set **Branch**: `main` and **Folder**: `/website`
5. Click **Save**

The site will be live at `glcook74.github.io/pause-before-purchase` within a few minutes.

### Custom domain (dopaminedelay.com)

1. In your domain registrar (e.g. Cloudflare, Namecheap), add a **CNAME record**:
   - Name: `www`
   - Value: `glcook74.github.io`
2. For the apex domain (`dopaminedelay.com`), add **A records** pointing to GitHub Pages IPs:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. In GitHub Pages settings, enter `dopaminedelay.com` as the custom domain
4. Enable **Enforce HTTPS**

## Before Going Live — 3 Placeholders to Replace

Search the codebase for these placeholders and replace them:

### 1. Chrome Web Store URL
- **Search for:** `#chrome-store`
- **Replace with:** Your Chrome Web Store listing URL
- **Files:** All HTML pages (nav and footer links)

### 2. Stripe Payment Link
- **Search for:** `https://buy.stripe.com/PLACEHOLDER`
- **Replace with:** Your Stripe Payment Link URL
- **Create at:** [dashboard.stripe.com](https://dashboard.stripe.com) → Payment Links
- **Files:** `pricing.html`, `js/stripe.js`

### 3. Formspree Form ID
- **Search for:** `formspree.io/f/PLACEHOLDER`
- **Replace with:** Your Formspree form ID
- **Create at:** [formspree.io](https://formspree.io) (free tier available)
- **Files:** `index.html`, `waitlist.html`

## Tech Stack

- Pure HTML, CSS, vanilla JavaScript — no frameworks
- Google Fonts (Inter) loaded via CDN
- Stripe.js loaded via CDN for payment handling
- Formspree for waitlist form submissions
- No server-side code required
- Deploy-ready for GitHub Pages

## Folder Structure

```
website/
├── index.html
├── how-it-works.html
├── pricing.html
├── about.html
├── waitlist.html
├── privacy.html
├── terms.html
├── .nojekyll
├── README.md
├── css/
│   ├── style.css        # Global styles + design system
│   └── nav.css          # Navigation styles
├── js/
│   ├── main.js          # Nav toggle, smooth scroll, FAQ accordion
│   └── stripe.js        # Stripe Payment Link handler
└── images/
    ├── favicon.png      # Gold pause symbol favicon
    └── og-image.jpg     # Open Graph social sharing image
```
