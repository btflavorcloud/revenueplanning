# GTM Revenue Planner

A Next.js 14 application for planning and tracking go-to-market revenue scenarios with Supabase backend.

## Features

- Create and manage multiple revenue planning scenarios (Baseline, Stretch, Custom)
- 3-level hierarchy: Scenarios → GTM Groups (Sales, Marketing, Partnerships) → Segments (SMB, MM, ENT, ENT+, Flagship)
- Monthly launch planning with automatic revenue calculations
- Real-time calculations for shipments, realized revenue, and ARR
- Funnel planning with opportunity-to-close metrics
- Auto-save with optimistic UI updates
- Supabase authentication (magic link)
- Export scenarios to CSV
- Fully responsive design

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Icons:** Lucide React

## Getting Started

### 1. Set up Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Once your project is created, go to the SQL Editor
3. Copy and paste the contents of `supabase-setup.sql` into the SQL Editor
4. Run the SQL to create all tables, RLS policies, and indexes
5. Go to Settings > API and copy your project URL and anon key

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
npm start
```

## Deploy to Vercel

The easiest way to deploy this app is with Vercel:

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard (Settings > Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## Project Structure

```
gtm-revenue-planner/
├── app/
│   ├── api/auth/callback/    # Auth callback handler
│   ├── login/                # Login page
│   ├── planner/[id]/         # Dynamic planner page
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page (scenario list)
│   ├── ScenarioList.tsx      # Scenario list component
│   └── globals.css           # Global styles
├── components/
│   ├── Auth.tsx              # Authentication component
│   ├── RevenuePlanner.tsx    # Main planner interface
│   └── ScenarioCard.tsx      # Scenario preview card
├── lib/
│   ├── hooks/
│   │   ├── useAuth.ts        # Auth hook
│   │   └── useScenarios.ts   # Scenarios CRUD hook
│   ├── supabase/
│   │   ├── client.ts         # Browser Supabase client
│   │   ├── server.ts         # Server Supabase client
│   │   └── middleware.ts     # Auth middleware
│   ├── types.ts              # TypeScript types
│   └── utils.ts              # Utility functions
├── supabase-setup.sql        # Database schema
└── middleware.ts             # Next.js middleware
```

## Database Schema

### Tables

- **scenarios**: Main scenarios (Baseline, Stretch, Custom)
- **gtm_groups**: GTM motions (Sales, Marketing, Partnerships)
- **segments**: Segment types (SMB, MM, ENT, ENT+, Flagship)
- **conversion_rates**: Opportunity-to-close conversion metrics

### Row Level Security (RLS)

All tables have RLS enabled. Users can only access their own data.

## Usage

### Creating a Scenario

1. Log in with your email (magic link)
2. Click one of the "Create New Scenario" buttons (Baseline, Stretch, or Custom)
3. You'll be redirected to the planner

### Planning Revenue

1. Add GTM Groups (Sales, Marketing, Partnerships)
2. Add Segments to each GTM Group (SMB, MM, ENT, etc.)
3. Set SPM (Shipments Per Merchant) for each segment
4. Enter monthly merchant launches (Jan-Dec)
5. View real-time calculations for shipments and revenue

### Switching Views

- **Output View**: See shipment and revenue calculations
- **Funnel View**: See opportunity creation requirements

### Auto-Save

All changes are automatically saved to Supabase with a 500ms debounce. You'll see a "Saving..." indicator when updates are in progress.

### Exporting Data

Click "Export CSV" to download your scenario data.

## Key Features Explained

### Calculations

- **Total Shipments**: Sum of all launches × SPM × months remaining in year
- **Realized Revenue**: Total shipments × RPS (for remaining months in year)
- **ARR (Annualized Run Rate)**: Full year revenue potential if all launches run for 12 months

### Funnel Metrics

Based on segment-specific conversion rates:
- Calculate opportunities needed to close target merchants
- Account for sales cycle length (avg days to close)
- Backdate opportunity creation to appropriate month

## Troubleshooting

### Can't connect to Supabase
- Verify `.env.local` has correct credentials
- Check that your Supabase project is not paused

### Data not saving
- Check browser console for errors
- Verify RLS policies in Supabase (SQL Editor > RLS)
- Ensure you're logged in with the correct user

### Auth not working
- Verify callback URL is set correctly in Supabase dashboard
- Check that email redirects are configured properly

## License

MIT

## Support

For issues and questions, please refer to:
- SETUP-GUIDE.md for detailed setup instructions
- QUICK-START.md for quick reference
