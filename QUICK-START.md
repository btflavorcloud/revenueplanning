# Quick Setup Reference

## You Have These Files:
1. **gtm-revenue-planner-master-groups.jsx** - Your React component
2. **SETUP-GUIDE.md** - Full setup instructions
3. **This file** - Quick commands

---

## Step 1: Create Supabase Project (5 min)

1. Go to https://supabase.com
2. Click "New Project"
3. Copy SQL from SETUP-GUIDE.md into SQL Editor
4. Run it
5. Copy your API credentials from Settings > API

---

## Step 2: Create .env.local

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-key...
```

---

## Step 3: Tell Claude Code in Cursor

```
Create a Next.js 14 production app from the gtm-revenue-planner-master-groups.jsx component.

TECH STACK:
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Supabase (auth + database)
- Lucide React icons

FEATURES NEEDED:
1. Convert React component to Next.js with TypeScript
2. Add Supabase auth (email magic link)
3. CRUD operations for scenarios with 3-level hierarchy:
   - Scenarios (master groups: Baseline, Stretch)
   - GTM Groups (Sales, Marketing, Partnerships)
   - Segments (SMB, MM, ENT, ENT+, Flagship)
4. Optimistic UI with debounced saves (500ms)
5. Loading states, error handling
6. Scenario list page to manage saved scenarios
7. Deploy-ready for Vercel

DATABASE SCHEMA (already created in Supabase):
- scenarios: id, user_id, name, type, target_shipments, rps
- gtm_groups: id, scenario_id, name, type, collapsed, sort_order
- segments: id, gtm_group_id, segment_type, spm, launches (jsonb array)
- conversion_rates: id, user_id, segment_type, opp_to_close_pct, avg_days_to_close

FILE STRUCTURE:
app/
  layout.tsx
  page.tsx (scenario list/dashboard)
  planner/[id]/page.tsx (main planner component)
  login/page.tsx (auth page)
  api/scenarios/route.ts (optional)
components/
  RevenuePlanner.tsx (main planning interface)
  ScenarioCard.tsx (scenario preview cards)
  Auth.tsx (login UI)
lib/
  supabase/
    client.ts (browser client)
    server.ts (server client)
  hooks/
    useScenarios.ts
    useAuth.ts
  types.ts (TypeScript interfaces)
  utils.ts (calculations)

KEY IMPLEMENTATION:
1. Transform gtm-revenue-planner-master-groups.jsx into RevenuePlanner.tsx
2. Keep all existing calculation logic
3. Add Supabase integration:
   - Load scenario on mount
   - Auto-save on changes (debounced)
   - Show "Saving..." indicator
4. Add scenario management:
   - List all user scenarios
   - Create new
   - Duplicate existing
   - Delete
5. Protected routes (redirect to login if not authed)

ENVIRONMENT VARS (in .env.local):
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

Generate the complete project with all files, ready to deploy.
```

---

## Step 4: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Add env vars in Vercel dashboard:
# Settings > Environment Variables
```

---

## That's It!

**No backend server needed** - Supabase IS your backend.

Your app will be live at: `your-app.vercel.app`

---

## Quick Test

```bash
# After Claude Code generates the project:
cd your-new-project
npm install
npm run dev

# Visit http://localhost:3000
```

---

## Common Claude Code Follow-ups

If something doesn't work, tell Claude Code:

**Auth issues:**
```
The auth isn't working. Check the Supabase client setup and make sure we're using magic link auth correctly.
```

**Data not saving:**
```
The data isn't persisting to Supabase. Review the save functions and check RLS policies are correct.
```

**Build errors:**
```
Fix the TypeScript errors in [filename]. Make sure all types are properly defined.
```

**Want to add a feature:**
```
Add a "Duplicate Scenario" button that copies an existing scenario with all its GTM groups and segments.
```

---

## Files You'll Get

After Claude Code finishes, you'll have:

```
your-project/
├── app/
│   ├── layout.tsx (root layout)
│   ├── page.tsx (home/scenario list)
│   ├── planner/[id]/page.tsx (main planner)
│   └── login/page.tsx (auth)
├── components/
│   ├── RevenuePlanner.tsx (converted component)
│   ├── ScenarioCard.tsx
│   └── Auth.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── types.ts
│   └── utils.ts
├── .env.local (you create this)
├── package.json
└── next.config.js
```

---

## Pro Tips

1. **Let Claude Code do the heavy lifting** - it will convert your JSX to TypeScript and add all the Supabase integration
2. **Start simple** - get basic save/load working first, then add features
3. **Use the Supabase dashboard** - you can view/edit data directly there while testing
4. **Deploy early** - get it on Vercel fast, then iterate

---

## Cost: $0

Both Supabase and Vercel have generous free tiers that will handle thousands of users.

Upgrade only when you hit limits:
- Supabase Pro: $25/mo (8GB database)
- Vercel Pro: $20/mo (100GB bandwidth)
