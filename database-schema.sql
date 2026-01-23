-- Membership Management System Database Schema
-- Groton Sportsmen's Club

-- Settings table for configurable values
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, description) VALUES
  ('regular_dues', '300', 'Annual dues for Regular members'),
  ('absentee_dues', '50', 'Annual dues for Absentee members'),
  ('work_hours_required', '10', 'Annual work hours required for Regular members'),
  ('buyout_rate', '20', 'Dollar rate per work hour buyout'),
  ('assessment_amount', '50', 'Annual assessment for first 5 years'),
  ('cabaret_tax_rate', '0.10', 'State cabaret tax rate'),
  ('min_age_regular', '21', 'Minimum age for Regular membership'),
  ('fiscal_year_start_month', '7', 'Fiscal year start month (1-12)'),
  ('work_hour_year_start_month', '3', 'Work hour year start month (1-12)'),
  ('timeclock_integration', 'false', 'Enable timeclock integration');

-- Members table
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  email TEXT,
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  original_join_date DATE NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Regular', 'Absentee', 'Life', 'Honorary')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Deceased', 'Resigned', 'Expelled')),
  assessment_years_completed INTEGER DEFAULT 0 CHECK (assessment_years_completed >= 0 AND assessment_years_completed <= 5),
  life_eligibility_override BOOLEAN DEFAULT FALSE,
  life_override_reason TEXT,
  life_override_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expelled members additional info
CREATE TABLE expulsion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expulsion_date DATE NOT NULL,
  cause TEXT NOT NULL,
  article_xii_reference TEXT,
  financial_obligations_met TEXT NOT NULL CHECK (financial_obligations_met IN ('Yes', 'No', 'Partial')),
  amount_outstanding DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encumbrances table (Article XII)
CREATE TABLE encumbrances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date_applied DATE NOT NULL,
  reason TEXT NOT NULL,
  date_removed DATE,
  removed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tier change history
CREATE TABLE tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  old_tier TEXT,
  new_tier TEXT NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status change history
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  change_date DATE NOT NULL,
  changed_by TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Life eligibility review queue
CREATE TABLE life_eligibility_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date_flagged DATE NOT NULL,
  qualifying_rule TEXT,
  action_taken TEXT CHECK (action_taken IN ('Converted', 'Deferred', 'Ineligible', 'Pending')),
  action_date DATE,
  admin_notes TEXT,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membership years (tracks dues/hours per fiscal year)
CREATE TABLE membership_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  fiscal_year TEXT NOT NULL, -- e.g., '2024-2025'
  dues_owed DECIMAL(10,2) DEFAULT 0,
  dues_paid DECIMAL(10,2) DEFAULT 0,
  assessment_owed DECIMAL(10,2) DEFAULT 0,
  assessment_paid DECIMAL(10,2) DEFAULT 0,
  work_hours_required DECIMAL(5,2) DEFAULT 0,
  work_hours_completed DECIMAL(5,2) DEFAULT 0,
  work_hours_bought_out DECIMAL(5,2) DEFAULT 0,
  buyout_owed DECIMAL(10,2) DEFAULT 0,
  buyout_paid DECIMAL(10,2) DEFAULT 0,
  tax_owed DECIMAL(10,2) DEFAULT 0,
  tax_paid DECIMAL(10,2) DEFAULT 0,
  total_owed DECIMAL(10,2) DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, fiscal_year)
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_year_id UUID REFERENCES membership_years(id) ON DELETE SET NULL,
  fiscal_year TEXT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Check', 'Credit Card')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Dues', 'Assessment', 'Buyout', 'Tax', 'Combined')),
  check_number TEXT,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work hours (manual entry when timeclock not integrated)
CREATE TABLE work_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  work_year TEXT NOT NULL, -- e.g., '2024-2025' (Mar 1 - Feb 28)
  hours_date DATE NOT NULL,
  hours_worked DECIMAL(5,2) NOT NULL,
  description TEXT,
  approved BOOLEAN DEFAULT FALSE,
  approved_by TEXT,
  approved_date DATE,
  source TEXT DEFAULT 'Manual' CHECK (source IN ('Manual', 'Timeclock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Waitlist table
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_position INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  street_address TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  sponsor_1 TEXT,
  sponsor_2 TEXT,
  date_application_received DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admins table
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Admin' CHECK (role IN ('Admin', 'Super Admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_tier ON members(tier);
CREATE INDEX idx_members_member_number ON members(member_number);
CREATE INDEX idx_encumbrances_member ON encumbrances(member_id);
CREATE INDEX idx_encumbrances_active ON encumbrances(member_id) WHERE date_removed IS NULL;
CREATE INDEX idx_membership_years_member ON membership_years(member_id);
CREATE INDEX idx_membership_years_fiscal ON membership_years(fiscal_year);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_work_hours_member ON work_hours(member_id);
CREATE INDEX idx_work_hours_year ON work_hours(work_year);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE encumbrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_eligibility_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE expulsion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies (authenticated users only)
CREATE POLICY "Authenticated users can view members" ON members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert members" ON members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update members" ON members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete members" ON members FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update settings" ON settings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage encumbrances" ON encumbrances FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage tier_history" ON tier_history FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage status_history" ON status_history FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage life_eligibility_log" ON life_eligibility_log FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage membership_years" ON membership_years FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage payments" ON payments FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage work_hours" ON work_hours FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage expulsion_records" ON expulsion_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can view admins" ON admins FOR SELECT TO authenticated USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_encumbrances_updated_at BEFORE UPDATE ON encumbrances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_membership_years_updated_at BEFORE UPDATE ON membership_years FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_hours_updated_at BEFORE UPDATE ON work_hours FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_life_eligibility_updated_at BEFORE UPDATE ON life_eligibility_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
