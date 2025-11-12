# Next Steps - GTM Revenue Planner Setup

Your Next.js 14 app has been generated! Follow these steps to get it running.

## Step 1: Set Up Supabase Database (5 minutes)

### Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Name it "gtm-revenue-planner"
5. Set a strong database password (save it somewhere safe)
6. Choose region closest to you
7. Click "Create new project"
8. Wait ~2 minutes for provisioning

### Run Database Setup SQL

1. In your Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the `supabase-setup.sql` file from this project
4. Copy ALL the SQL code
5. Paste it into the SQL Editor
6. Click "Run" to execute
7. You should see "Success. No rows returned"

### Get Your API Credentials

1. In Supabase dashboard, go to Settings > API
2. Copy the following values:

```
Project URL: https://xxxxxxxxxxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 2: Configure Environment Variables

Create your `.env.local` file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and paste your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 3: Install Dependencies

```bash
npm install
```

This will install:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Supabase client libraries
- Lucide React icons

## Step 4: Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You should see the login page!

## Step 5: Test the App

### Test Authentication

1. Enter your email address
2. Click "Send Magic Link"
3. Check your email
4. Click the magic link
5. You should be redirected to the scenario list page

### Create Your First Scenario

1. Click "Baseline Plan" (or Stretch/Custom)
2. You'll see the revenue planner interface
3. Click "Add GTM Motion"
4. Name it (e.g., "Sales")
5. Click "Add Segment" → Choose SMB, MM, or ENT
6. Enter monthly merchant launches (e.g., 5 in Jan, 10 in Feb)
7. Watch the calculations update in real-time!

### Test Auto-Save

- Make changes to your data
- Look for the "Saving..." indicator in the top right
- Refresh the page - your changes should persist!

## Step 6: Deploy to Vercel (Optional but Recommended)

### Install Vercel CLI

```bash
npm install -g vercel
```

### Login to Vercel

```bash
vercel login
```

### Deploy

```bash
vercel
```

Follow the prompts:
- "Set up and deploy?" → Yes
- "Which scope?" → Your personal account
- "Link to existing project?" → No
- "What's your project's name?" → gtm-revenue-planner (or whatever you want)
- "In which directory is your code located?" → ./
- "Want to override the settings?" → No

### Add Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add both variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
5. Redeploy: `vercel --prod`

Your app is now live!

## Troubleshooting

### "Failed to load scenarios"
- Check your `.env.local` file has correct Supabase credentials
- Verify the SQL ran successfully in Supabase
- Check browser console for errors

### "Auth not working"
- Make sure you're using a real email address
- Check spam folder for magic link email
- Verify Supabase project is not paused

### TypeScript errors
```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

### Build errors about missing modules
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## What You Built

This is a full-stack production-ready application with:

- **Authentication**: Supabase magic link auth (no passwords!)
- **Database**: PostgreSQL with Row Level Security
- **Auto-save**: Debounced updates (500ms)
- **Optimistic UI**: Instant updates while saving in background
- **Real-time Calculations**: Revenue, shipments, ARR, funnel metrics
- **Export**: CSV download of scenario data
- **Responsive**: Works on mobile, tablet, desktop
- **Type-safe**: Full TypeScript coverage
- **Deploy-ready**: Optimized for Vercel

## File Structure Reference

```
gtm-revenue-planner/
├── app/
│   ├── api/auth/callback/route.ts    # Auth callback handler
│   ├── login/page.tsx                # Login page
│   ├── planner/[id]/page.tsx         # Dynamic planner page
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Home (redirects to scenarios or login)
│   ├── ScenarioList.tsx              # Scenario list component
│   └── globals.css                   # Global styles
├── components/
│   ├── Auth.tsx                      # Auth UI component
│   ├── RevenuePlanner.tsx            # Main planner (3000+ lines!)
│   └── ScenarioCard.tsx              # Scenario card component
├── lib/
│   ├── hooks/
│   │   ├── useAuth.ts                # Auth state management
│   │   └── useScenarios.ts           # Scenario CRUD operations
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   ├── server.ts                 # Server Supabase client
│   │   └── middleware.ts             # Auth middleware
│   ├── types.ts                      # TypeScript type definitions
│   └── utils.ts                      # Calculation utilities
├── supabase-setup.sql                # Database schema
├── .env.local                        # Your environment variables (don't commit!)
└── middleware.ts                     # Next.js middleware for auth
```

## Next Features to Add (Ideas)

1. **Scenario Comparison**: Compare multiple scenarios side-by-side
2. **Custom Conversion Rates**: Let users override default conversion rates
3. **Team Collaboration**: Share scenarios with team members
4. **Charts & Graphs**: Visualize revenue projections over time
5. **What-if Analysis**: Slider controls to model different scenarios
6. **PDF Export**: Generate formatted PDF reports
7. **Email Reports**: Schedule weekly scenario summaries
8. **Mobile App**: React Native version for on-the-go planning

## Resources

- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## Need Help?

Check these files:
- `README.md` - Project overview and features
- `SETUP-GUIDE.md` - Detailed setup instructions
- `QUICK-START.md` - Quick reference commands

---

Congratulations! You now have a production-ready GTM Revenue Planner app. 🎉
