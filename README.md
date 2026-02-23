# SN Vision Subscription Portal

A Next.js subscription management portal with Google OAuth, Stripe payments, and TradingView script access integration.

## Features

- **Google Sign-In** - OAuth 2.0 authentication
- **TradingView Username Validation** - Validates usernames via TradingView Access Management API
- **Stripe Checkout** - Subscription payments with Stripe
- **Subscription Dashboard** - View, cancel, and manage billing
- **Automatic Access Management** - Grants/revokes TradingView indicator access based on subscription status

## Setup

### 1. Prerequisites

- Node.js 18+
- Stripe account (test mode is fine)
- Google Cloud Console project with OAuth 2.0 credentials
- TradingView Access Management API (see below)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret to `.env.local`

#### Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your **Secret Key** and **Publishable Key** from Developers > API Keys
3. Create a Product and Price:
   ```bash
   # Using Stripe CLI or Dashboard, create a monthly subscription product
   # Copy the Price ID (starts with price_)
   ```
4. Set up webhook endpoint:
   - Go to Developers > Webhooks
   - Add endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy Webhook Secret to `.env.local`

#### TradingView Access Management API

This project includes a local version of the [TradingView Access Management API](https://github.com/trendoscope-algorithms/Tradingview-Access-Management).

**Run locally (recommended):**

```bash
# Navigate to the API directory
cd tradingview-api

# Create .env file with your TradingView credentials
cp .env.example .env
# Edit .env and add your TradingView username/password

# Install dependencies (first time only)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start the API server
./start.sh
```

The API will run at `http://localhost:5000`. Set `TRADINGVIEW_API_URL=http://localhost:5000` in your `.env.local`.

**Alternative - Deploy to Replit:**

1. Fork the repo on Replit: https://replit.com/@trendoscope/Tradingview-Access-Management
2. Set environment variables in Replit:
   - `username`: Your TradingView username
   - `password`: Your TradingView password
3. Run the repl
4. Copy the URL to `TRADINGVIEW_API_URL` in `.env.local`

**Pine Script ID:**

The `PINE_IDS` environment variable should contain your indicator's publication ID.
You can find this in browser dev tools when managing indicator access on TradingView.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Test the Flow

1. Sign in with Google
2. Enter your TradingView username
3. Complete Stripe checkout (use test card `4242 4242 4242 4242`)
4. Access is granted to your TradingView indicator

## Environment Variables Reference

| Variable                 | Description                                                                    |
| ------------------------ | ------------------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`       | Google OAuth Client ID                                                         |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth Client Secret                                                     |
| `NEXTAUTH_SECRET`        | Random string for session encryption (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL`           | Your app URL (e.g., `http://localhost:3000`)                                   |
| `STRIPE_SECRET_KEY`      | Stripe Secret Key                                                              |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key                                                         |
| `STRIPE_WEBHOOK_SECRET`  | Stripe Webhook Signing Secret                                                  |
| `STRIPE_PRICE_ID`        | Stripe Price ID for subscription                                               |
| `TRADINGVIEW_API_URL`    | URL of TradingView Access Management API                                       |
| `PINE_IDS`               | Comma-separated Pine Script publication IDs                                    |

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

**Important:** Update `NEXTAUTH_URL` to your production URL and add the production callback URL to Google OAuth credentials.

### Stripe Webhook

For production, update your Stripe webhook endpoint to your production URL.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth.js handlers
│   │   ├── billing-portal/        # Stripe billing portal
│   │   ├── checkout/              # Create checkout session
│   │   ├── subscription/          # Status & cancel endpoints
│   │   ├── tradingview/           # Username validation
│   │   └── webhooks/stripe/       # Stripe webhook handler
│   ├── checkout/                  # Checkout page
│   ├── dashboard/                 # Subscription management
│   ├── onboarding/                # TradingView username form
│   ├── signin/                    # Google sign-in page
│   └── success/                   # Post-checkout success
├── components/
│   ├── providers.tsx              # Session provider
│   └── ui/                        # UI components
└── lib/
    ├── auth.ts                    # NextAuth config
    ├── stripe.ts                  # Stripe utilities
    ├── tradingview.ts             # TradingView API client
    └── utils.ts                   # Utility functions
```

## License

MIT
