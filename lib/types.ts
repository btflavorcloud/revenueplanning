// Database types matching Supabase schema
export interface Database {
  public: {
    Tables: {
      scenarios: {
        Row: Scenario;
        Insert: Omit<Scenario, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Scenario, 'id' | 'created_at' | 'updated_at'>>;
      };
      plans: {
        Row: Plan;
        Insert: Omit<Plan, 'id' | 'created_at'>;
        Update: Partial<Omit<Plan, 'id' | 'created_at'>>;
      };
      gtm_groups: {
        Row: GtmGroup;
        Insert: Omit<GtmGroup, 'id' | 'created_at'>;
        Update: Partial<Omit<GtmGroup, 'id' | 'created_at'>>;
      };
      segments: {
        Row: Segment;
        Insert: Omit<Segment, 'id' | 'created_at'>;
        Update: Partial<Omit<Segment, 'id' | 'created_at'>>;
      };
      conversion_rates: {
        Row: ConversionRate;
        Insert: Omit<ConversionRate, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ConversionRate, 'id' | 'created_at' | 'updated_at'>>;
      };
      gtm_execution_plans: {
        Row: ExecutionPlan;
        Insert: Omit<ExecutionPlan, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ExecutionPlan, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

export interface Scenario {
  id: string;
  user_id: string;
  name: string;
  type: 'Baseline' | 'Stretch' | 'Custom';
  target_shipments: number;
  rps: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  scenario_id: string;
  type: 'Baseline' | 'Stretch';
  collapsed: boolean;
  created_at: string;
}

export interface GtmGroup {
  id: string;
  plan_id: string;
  scenario_id?: string; // Keep for backwards compatibility
  name: string;
  type: 'Sales' | 'Marketing' | 'Partnerships' | 'Custom';
  collapsed: boolean;
  sort_order: number;
  created_at: string;
}

export interface Segment {
  id: string;
  gtm_group_id: string;
  segment_type: 'SMB' | 'MM' | 'ENT' | 'ENT+' | 'Flagship';
  spm: number;
  launches: number[]; // Array of 12 months
  created_at: string;
}

export interface ConversionRate {
  id: string;
  user_id: string | null;
  segment_type: 'SMB' | 'MM' | 'ENT' | 'ENT+' | 'Flagship';
  opp_to_close_pct: number;
  avg_days_to_close: number;
  created_at: string;
  updated_at: string;
}

export interface HeadcountRole {
  role: string;
  count: number;
}

export interface ExecutionPlan {
  id: string;
  gtm_group_id: string;
  reach: 1 | 10 | 100 | 1000 | null;
  confidence: 20 | 50 | 80 | null;
  budget_usd: number;
  headcount_needed: HeadcountRole[];
  partner_dependencies: string | null;
  product_requirements: string | null;
  carrier_requirements: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types for UI with nested data
export interface ScenarioWithData extends Scenario {
  plans: PlanWithGtmGroups[];
  // Keep for backwards compatibility during migration
  gtm_groups?: GtmGroupWithSegments[];
}

export interface PlanWithGtmGroups extends Plan {
  gtm_groups: GtmGroupWithSegments[];
}

export interface GtmGroupWithSegments extends GtmGroup {
  segments: Segment[];
  execution_plan?: ExecutionPlan;
}

// UI State types
export type SegmentType = 'SMB' | 'MM' | 'ENT' | 'ENT+' | 'Flagship';
export type GtmType = 'Sales' | 'Marketing' | 'Partnerships' | 'Custom';
export type ScenarioType = 'Baseline' | 'Stretch' | 'Custom';

export interface SegmentConfig {
  label: string;
  defaultSPM: number;
  color: string;
  borderColor: string;
  textColor: string;
}

export interface ColorConfig {
  bg: string;
  border: string;
  text: string;
  accent?: string;
}

// Calculation results
export interface Calculations {
  totalShipments: number;
  realizedRevenue: number;
  annualizedRunRate: number;
  monthlyShipments: number[];
  quarterlyBreakdown: { Q1: number; Q2: number; Q3: number; Q4: number };
  masterGroupTotals: Record<string, number>;
  masterGroupRevenueBreakdown: Record<string, { realized: number; arr: number }>;
  gtmGroupTotals: Record<string, number>;
  gtmGroupRevenueBreakdown: Record<string, { realized: number; arr: number }>;
  segmentTotals: Record<string, number>;
  segmentRevenueBreakdown: Record<string, { realized: number; arr: number }>;
  percentageToGoal: number;
  shortfall: number;
}

export interface FunnelData {
  monthlyOpps: number[];
  totalOpps: number;
  totalMerchants: number;
}

export interface FunnelCalculations {
  masterGroupFunnelData: Record<string, FunnelData>;
  gtmGroupFunnelData: Record<string, FunnelData>;
  segmentFunnelData: Record<string, FunnelData>;
  monthlyOppsTotal: number[];
  totalOpps: number;
  totalMerchants: number;
}

// Constants as types for better type safety
export const SEGMENT_CONFIGS: Record<SegmentType, SegmentConfig> = {
  SMB: { label: 'SMB', defaultSPM: 100, color: 'bg-yellow-400', borderColor: 'border-yellow-500', textColor: 'text-yellow-700' },
  MM: { label: 'MM', defaultSPM: 500, color: 'bg-blue-400', borderColor: 'border-blue-500', textColor: 'text-blue-700' },
  ENT: { label: 'ENT', defaultSPM: 1000, color: 'bg-purple-400', borderColor: 'border-purple-500', textColor: 'text-purple-700' },
  'ENT+': { label: 'ENT+', defaultSPM: 3000, color: 'bg-pink-400', borderColor: 'border-pink-500', textColor: 'text-pink-700' },
  Flagship: { label: 'Flagship', defaultSPM: 5000, color: 'bg-red-400', borderColor: 'border-red-500', textColor: 'text-red-700' },
};

export const GTM_COLORS: Record<GtmType, ColorConfig> = {
  Marketing: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800' },
  Sales: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-800' },
  Partnerships: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800' },
  Custom: { bg: 'bg-gray-100', border: 'border-gray-400', text: 'text-gray-800' },
};

export const MASTER_GROUP_COLORS: Record<ScenarioType, ColorConfig> = {
  Baseline: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-900', accent: 'bg-slate-500' },
  Stretch: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', accent: 'bg-orange-500' },
  Custom: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-900', accent: 'bg-gray-500' },
};

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const QUARTERS = {
  Q1: [0, 1, 2],
  Q2: [3, 4, 5],
  Q3: [6, 7, 8],
  Q4: [9, 10, 11]
} as const;
