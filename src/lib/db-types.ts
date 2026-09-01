/* ============================================================
 * Luma · Database types
 * Hand-mirrored from supabase/migrations/0001_schema.sql +
 * 0002_rls_and_functions.sql so the client stays typed without a
 * generation step. After any schema change, regenerate with:
 *
 *   supabase gen types typescript --local > src/lib/db-types.ts
 * ============================================================ */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** pragmatic table triple — Insert defaults to Row unless server generates keys */
type T<R, I = R> = { Row: R; Insert: I; Update: Partial<R>; Relationships: [] };

export type PlanDb = "essential" | "celebration" | "luxe";

export interface WeddingRow {
  id: string;
  owner_id: string;
  slug: string;
  partner_a: string;
  partner_b: string;
  names: string;
  date: string;
  venue: string;
  location: string;
  timezone: string;
  plan: PlanDb;
  created_at: string;
}

export interface GuestRow {
  id: string;
  wedding_id: string;
  name: string;
  party: "A" | "B" | "S";
  rsvp: "confirmed" | "pending" | "declined";
  meal: string | null;
  plus_one_of: string | null;
  table_id: string | null;
  seat: number | null;
  dietary: string | null;
  notes: string;
  rsvp_token: string;
  sort: number;
}

export interface TableRow {
  id: string;
  wedding_id: string;
  name: string;
  shape: "round" | "rect" | "head" | "sweetheart";
  capacity: number;
  x: number;
  y: number;
  sort: number;
}

export interface BudgetRow {
  id: string;
  wedding_id: string;
  name: string;
  budget: number;
  committed: number;
  paid: number;
  color: string;
  sort: number;
}

export interface TaskRow {
  id: string;
  wedding_id: string;
  title: string;
  phase: "p12" | "p9" | "p6" | "p3" | "p1" | "fw" | "wd";
  done: boolean;
  assignee: "A" | "T" | "B";
  due: string | null;
  week: boolean;
  sort: number;
}

export interface VendorPaymentRow {
  id: string;
  vendor_id: string;
  label: string;
  amount: number;
  due: string;
  paid: boolean;
  sort: number;
}

export interface VendorRow {
  id: string;
  wedding_id: string;
  category: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  price: number;
  status: "Inquiry" | "Proposal" | "Booked" | "Declined";
  contract: boolean;
  notes: string;
  budget_id: string | null;
  sort: number;
  vendor_payments?: VendorPaymentRow[];
}

export interface RegistryRow {
  id: string;
  wedding_id: string;
  name: string;
  store: string;
  price: number;
  url: string;
  purchased: boolean;
  sort: number;
}

export interface InvitationConfigRow {
  wedding_id: string;
  template_id: string;
  line1: string;
  line2: string;
  venue_line: string;
  collect_rsvp: boolean;
  collect_meal: boolean;
  collect_notes: boolean;
  photo: string | null;
  colors: Json | null;
  font_serif: boolean | null;
  motion: Json;
  music: Json;
  music_url: string | null;
}

export interface WebsiteConfigRow {
  wedding_id: string;
  template: string;
  hero_photo: string;
  bg: string;
  ink: string;
  accent: string;
  serif: boolean;
  animations: boolean;
  sections: Json;
  domain: string;
  published: boolean;
}

export interface CustomTemplateRow {
  id: string;
  wedding_id: string;
  name: string;
  data_url: string | null;
  html: string | null;
  added_at: string;
  sort: number;
}

export interface RsvpRow {
  id: string;
  wedding_id: string;
  guest_id: string | null;
  name: string;
  answer: "yes" | "no";
  meal: string | null;
  note: string | null;
  plus_one: string | null;
  plus_one_meal: string | null;
  source: string;
  at: string;
  synced: boolean;
}

export interface EntitlementRow {
  user_id: string;
  plan: PlanDb;
  granted_at: string;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
}

export interface Database {
  public: {
    Tables: {
      weddings: T<WeddingRow, Omit<WeddingRow, "id" | "created_at">>;
      wedding_members: T<{ wedding_id: string; user_id: string; role: "owner" | "partner" }>;
      wedding_invites: T<{ id: string; wedding_id: string; email: string; invited_by: string; accepted_at: string | null; created_at: string }>;
      tables: T<TableRow>;
      guests: T<GuestRow>;
      budget_categories: T<BudgetRow>;
      tasks: T<TaskRow>;
      vendors: T<VendorRow>;
      vendor_payments: T<VendorPaymentRow>;
      registry_items: T<RegistryRow>;
      invitation_config: T<InvitationConfigRow>;
      website_config: T<WebsiteConfigRow>;
      custom_templates: T<CustomTemplateRow>;
      rsvps: T<RsvpRow>;
      entitlements: T<EntitlementRow>;
    };
    Views: Record<string, never>;
    Functions: {
      get_public_wedding: { Args: { p_slug: string }; Returns: Json | null };
      get_guest_by_token: { Args: { p_token: string }; Returns: Json | null };
      submit_rsvp: {
        Args: {
          p_token: string | null;
          p_slug: string;
          p_name: string;
          p_answer: "yes" | "no";
          p_meal: string | null;
          p_note: string | null;
          p_source: string | null;
        };
        Returns: Json;
      };
      invite_partner: { Args: { p_wedding: string; p_email: string }; Returns: Json };
      accept_pending_invite: { Args: Record<string, never>; Returns: Json };
    };
    Enums: {
      plan_t: PlanDb;
      answer_t: "yes" | "no";
    };
    CompositeTypes: Record<string, never>;
  };
}
