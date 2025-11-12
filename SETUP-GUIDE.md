# GTM Revenue Planner - Setup Guide

## Quick Answer: You DON'T need Render!

**Stack:**
- **Frontend:** Vercel (Next.js app)
- **Backend:** Supabase (database + auth + API)
- **No separate backend server needed!**

Supabase IS your backend. It provides:
- PostgreSQL database
- Built-in REST API
- Authentication
- Real-time subscriptions

---

## Setup Steps

### 1. Create Supabase Project

```bash
# Go to https://supabase.com
# Click "New Project"
# Choose organization, name it "gtm-revenue-planner"
# Set a strong database password
# Choose region closest to you
# Wait ~2 minutes for provisioning
```

### 2. Create Database Schema

Run this SQL in Supabase SQL Editor:

```sql
-- Scenarios table (master groups)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Baseline', 'Stretch', 'Custom'
  target_shipments INTEGER DEFAULT 400000,
  rps DECIMAL(10,2) DEFAULT 40.00,
  collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GTM Groups table (sales, marketing, partnerships)
CREATE TABLE gtm_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Sales', 'Marketing', 'Partnerships', 'Custom'
  collapsed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segments table (SMB, MM, ENT, etc.)
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gtm_group_id UUID REFERENCES gtm_groups(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL, -- 'SMB', 'MM', 'ENT', 'ENT+', 'Flagship'
  spm INTEGER NOT NULL,
  launches JSONB DEFAULT '[]'::jsonb, -- Array of 12 months
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion rates table (per segment type)
CREATE TABLE conversion_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_type TEXT UNIQUE NOT NULL,
  opp_to_close_pct DECIMAL(5,2) NOT NULL,
  avg_days_to_close INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default conversion rates
INSERT INTO conversion_rates (user_id, segment_type, opp_to_close_pct, avg_days_to_close) VALUES
  (NULL, 'SMB', 25, 60),
  (NULL, 'MM', 20, 90),
  (NULL, 'ENT', 20, 120),
  (NULL, 'ENT+', 10, 180),
  (NULL, 'Flagship', 10, 180);

-- Row Level Security (RLS)
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_rates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own scenarios"
  ON scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios"
  ON scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON scenarios FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their GTM groups"
  ON gtm_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert GTM groups"
  ON gtm_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update GTM groups"
  ON gtm_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete GTM groups"
  ON gtm_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their segments"
  ON segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert segments"
  ON segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update segments"
  ON segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete segments"
  ON segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Conversion rates policies
CREATE POLICY "Users can view default conversion rates"
  ON conversion_rates FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert their own conversion rates"
  ON conversion_rates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversion rates"
  ON conversion_rates FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX idx_gtm_groups_scenario_id ON gtm_groups(scenario_id);
CREATE INDEX idx_segments_gtm_group_id ON segments(gtm_group_id);
CREATE INDEX idx_conversion_rates_user_id ON conversion_rates(user_id);
```

### 3. Get Supabase Credentials

```bash
# In Supabase Dashboard > Project Settings > API
# Copy these values:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...your-key...
```

### 4. Use Claude Code in Cursor

Open Cursor and tell Claude Code:

```
Create a Next.js 14 app for the GTM Revenue Planner using:
- App Router
- TypeScript
- Tailwind CSS
- Supabase client for database
- Lucide React for icons

The component is in gtm-revenue-planner-master-groups.jsx.
Convert it to Next.js with:
1. Supabase integration for persistence
2. Auth using Supabase Auth
3. Save/load scenarios from database
4. Deploy-ready for Vercel

Environment variables:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

Database schema is in the setup guide SQL.
```

### 5. Deploy to Vercel

```bash
# In Cursor terminal:
npm install -g vercel
vercel login
vercel

# Add environment variables in Vercel dashboard:
# Settings > Environment Variables
# Add both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│                                         │
│         User Browser (React)            │
│                                         │
└─────────────┬───────────────────────────┘
              │
              │ HTTPS
              │
┌─────────────▼───────────────────────────┐
│                                         │
│      Vercel (Next.js Frontend)          │
│                                         │
└─────────────┬───────────────────────────┘
              │
              │ REST API / Realtime
              │
┌─────────────▼───────────────────────────┐
│                                         │
│       Supabase (Backend)                │
│   ┌───────────────────────────────┐     │
│   │  PostgreSQL Database          │     │
│   │  - scenarios table            │     │
│   │  - gtm_groups table           │     │
│   │  - segments table             │     │
│   │  - conversion_rates table     │     │
│   └───────────────────────────────┘     │
│   ┌───────────────────────────────┐     │
│   │  Auth (Magic Links/OAuth)     │     │
│   └───────────────────────────────┘     │
│   ┌───────────────────────────────┐     │
│   │  Auto-generated REST API      │     │
│   └───────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Key Implementation Notes

### Data Flow

1. **Load Scenarios:**
```typescript
// Fetch user's scenarios with all nested data
const { data: scenarios } = await supabase
  .from('scenarios')
  .select(`
    *,
    gtm_groups (
      *,
      segments (*)
    )
  `)
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

2. **Save Scenario:**
```typescript
// Insert scenario
const { data: scenario } = await supabase
  .from('scenarios')
  .insert({ name, type, user_id })
  .select()
  .single();

// Insert GTM groups
for (const gtmGroup of masterGroup.gtmGroups) {
  const { data: insertedGtm } = await supabase
    .from('gtm_groups')
    .insert({ scenario_id: scenario.id, ...gtmGroup })
    .select()
    .single();
  
  // Insert segments
  for (const segment of gtmGroup.segments) {
    await supabase
      .from('segments')
      .insert({ gtm_group_id: insertedGtm.id, ...segment });
  }
}
```

3. **Update Monthly Launches:**
```typescript
// Optimistic update in UI, then sync to DB
await supabase
  .from('segments')
  .update({ launches: updatedLaunches })
  .eq('id', segmentId);
```

### Auth Setup

Use Supabase Magic Links (email-based, no password):

```typescript
// Sign in
await supabase.auth.signInWithOtp({
  email: 'user@example.com',
});

// Check session
const { data: { session } } = await supabase.auth.getSession();
```

### Caching Strategy

- Keep local state in React for fast UI updates
- Debounce DB writes (500ms after user stops typing)
- Show "Saving..." indicator
- Handle offline gracefully

---

## File Structure

```
gtm-revenue-planner/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Main planner page
│   ├── login/
│   │   └── page.tsx             # Auth page
│   └── api/
│       └── scenarios/
│           └── route.ts         # Optional API routes
├── components/
│   ├── RevenuePlanner.tsx       # Main component
│   ├── ScenarioList.tsx         # Scenario management
│   └── Auth.tsx                 # Auth UI
├── lib/
│   ├── supabase.ts              # Supabase client
│   └── types.ts                 # TypeScript types
├── .env.local
└── package.json
```

---

## Cost Breakdown (Free Tier)

**Supabase Free:**
- 500MB database
- 2GB bandwidth
- 50,000 monthly active users
- Unlimited API requests

**Vercel Free:**
- 100GB bandwidth
- Unlimited deployments
- Automatic HTTPS

**Total: $0/month** for starting out!

---

## Next Steps After Setup

1. **Add features:**
   - Export to PDF
   - Share scenarios via link
   - Duplicate scenarios
   - Scenario versioning

2. **Integrate with RIFF:**
   - Use same Supabase instance
   - Shared auth
   - Cross-link scenarios

3. **Advanced features:**
   - Team collaboration
   - Comments/notes
   - Forecast comparison charts

---

## Prompt for Claude Code in Cursor

Copy this into Cursor with Claude Code:

```
I need to convert the GTM Revenue Planner React component (gtm-revenue-planner-master-groups.jsx) into a production Next.js 14 app with:

STACK:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase for database + auth
- Lucide React for icons

REQUIREMENTS:
1. Auth with Supabase (magic link email login)
2. Save/load scenarios from Supabase
3. Optimistic UI updates with debounced DB writes
4. Loading states and error handling
5. Deploy-ready for Vercel

DATABASE SCHEMA:
- scenarios table (master groups)
- gtm_groups table (sales, marketing, partnerships)
- segments table (SMB, MM, ENT, etc.)
- conversion_rates table

The full schema SQL is in SETUP-GUIDE.md.

FILE STRUCTURE:
app/
  layout.tsx
  page.tsx (main planner)
  login/page.tsx (auth)
components/
  RevenuePlanner.tsx (converted from JSX)
  ScenarioList.tsx (manage scenarios)
lib/
  supabase.ts (client setup)
  types.ts (TS interfaces)

Environment variables:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

Please create the full Next.js project structure with all files.
```

---

## Testing Locally

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## Troubleshooting

**Issue:** Can't connect to Supabase
- Check .env.local has correct URL and key
- Verify project is not paused (Supabase dashboard)

**Issue:** RLS policies blocking queries
- Check auth.uid() matches user_id in scenarios table
- Test policies in Supabase SQL editor

**Issue:** Slow performance
- Add database indexes (already in schema)
- Implement pagination for large scenario lists
- Use Supabase real-time only for multi-user features

---

## Security Notes

✅ **Row Level Security (RLS)** enabled on all tables
✅ **User can only see their own data**
✅ **API keys are public-safe** (anon key only)
✅ **Auth required** for all operations

---

That's it! No Render, no separate backend. Supabase IS your backend.
