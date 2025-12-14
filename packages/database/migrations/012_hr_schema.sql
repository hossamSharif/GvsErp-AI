-- Migration 012: HR Module Schema
-- Purpose: Optional HR module with employee management, attendance, and payroll
-- Dependencies: 001_core_schema.sql (tenants table)

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id), -- Optional link to system user
  employee_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  hire_date DATE,
  salary DECIMAL(15,2),
  salary_currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT employees_tenant_number_unique UNIQUE (tenant_id, employee_number),
  CONSTRAINT employees_full_name_check CHECK (length(full_name) >= 1 AND length(full_name) <= 255),
  CONSTRAINT employees_salary_check CHECK (salary IS NULL OR salary >= 0)
);

-- Attendance status enum
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave', 'holiday');

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status attendance_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT attendance_unique_employee_date UNIQUE (tenant_id, employee_id, date),
  CONSTRAINT attendance_check_out_after_check_in CHECK (check_out IS NULL OR check_out > check_in)
);

-- Payroll run status enum
CREATE TYPE payroll_status AS ENUM ('draft', 'processing', 'completed');

-- Payroll runs table
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status payroll_status DEFAULT 'draft',
  total_gross DECIMAL(15,2),
  total_deductions DECIMAL(15,2),
  total_net DECIMAL(15,2),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT payroll_runs_period_check CHECK (period_end >= period_start)
);

-- Payroll line items (individual employee payroll for a run)
CREATE TABLE IF NOT EXISTS payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  gross_salary DECIMAL(15,2) NOT NULL CHECK (gross_salary >= 0),
  deductions DECIMAL(15,2) DEFAULT 0 CHECK (deductions >= 0),
  net_salary DECIMAL(15,2) NOT NULL CHECK (net_salary >= 0),
  currency TEXT DEFAULT 'USD',
  days_worked INTEGER CHECK (days_worked >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT payroll_items_unique_employee_run UNIQUE (payroll_run_id, employee_id),
  CONSTRAINT payroll_items_net_calculation CHECK (net_salary = gross_salary - deductions)
);

-- Indexes for performance
CREATE INDEX idx_employees_tenant ON employees(tenant_id);
CREATE INDEX idx_employees_number ON employees(tenant_id, employee_number);
CREATE INDEX idx_employees_active ON employees(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_employees_user ON employees(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX idx_attendance_tenant ON attendance(tenant_id);
CREATE INDEX idx_attendance_employee ON attendance(tenant_id, employee_id);
CREATE INDEX idx_attendance_date ON attendance(tenant_id, date);
CREATE INDEX idx_attendance_status ON attendance(tenant_id, status);

CREATE INDEX idx_payroll_runs_tenant ON payroll_runs(tenant_id);
CREATE INDEX idx_payroll_runs_period ON payroll_runs(tenant_id, period_start, period_end);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(tenant_id, status);

CREATE INDEX idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX idx_payroll_items_employee ON payroll_items(tenant_id, employee_id);

-- Function to update payroll run totals when items change
CREATE OR REPLACE FUNCTION update_payroll_run_totals()
RETURNS TRIGGER AS $$
DECLARE
  run_id UUID;
BEGIN
  -- Get the payroll run ID
  IF TG_OP = 'DELETE' THEN
    run_id := OLD.payroll_run_id;
  ELSE
    run_id := NEW.payroll_run_id;
  END IF;

  -- Recalculate totals
  UPDATE payroll_runs
  SET
    total_gross = (SELECT COALESCE(SUM(gross_salary), 0) FROM payroll_items WHERE payroll_run_id = run_id),
    total_deductions = (SELECT COALESCE(SUM(deductions), 0) FROM payroll_items WHERE payroll_run_id = run_id),
    total_net = (SELECT COALESCE(SUM(net_salary), 0) FROM payroll_items WHERE payroll_run_id = run_id)
  WHERE id = run_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update payroll run totals
CREATE TRIGGER payroll_items_update_totals
  AFTER INSERT OR UPDATE OR DELETE ON payroll_items
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_run_totals();

-- Function to auto-generate employee number
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TRIGGER AS $$
DECLARE
  year TEXT;
  sequence_num INTEGER;
BEGIN
  IF NEW.employee_number IS NULL THEN
    -- Format: EMP-YYYY-XXXX
    year := TO_CHAR(NEW.created_at, 'YYYY');

    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(employee_number FROM 'EMP-[0-9]{4}-([0-9]{4})') AS INTEGER
      )
    ), 0) + 1
    INTO sequence_num
    FROM employees
    WHERE tenant_id = NEW.tenant_id
      AND employee_number LIKE 'EMP-' || year || '-%';

    NEW.employee_number := 'EMP-' || year || '-' || LPAD(sequence_num::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate employee number
CREATE TRIGGER employees_number_trigger
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION generate_employee_number();

-- Updated at triggers
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant isolation
CREATE POLICY tenant_isolation_employees ON employees
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_attendance ON attendance
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_payroll_runs ON payroll_runs
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_payroll_items ON payroll_items
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role bypass
CREATE POLICY service_role_bypass_employees ON employees
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY service_role_bypass_attendance ON attendance
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY service_role_bypass_payroll_runs ON payroll_runs
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY service_role_bypass_payroll_items ON payroll_items
  FOR ALL
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE employees IS 'Employee records for HR module';
COMMENT ON TABLE attendance IS 'Daily attendance tracking';
COMMENT ON TABLE payroll_runs IS 'Payroll processing batches';
COMMENT ON TABLE payroll_items IS 'Individual employee payroll within a run';
COMMENT ON COLUMN employees.user_id IS 'Optional link to system user for employees who have login access';
COMMENT ON COLUMN employees.employee_number IS 'Auto-generated format: EMP-YYYY-XXXX';
COMMENT ON COLUMN payroll_runs.status IS 'Draft = editable, Processing = calculating, Completed = final and posted';
COMMENT ON COLUMN payroll_items.net_salary IS 'Calculated as gross_salary - deductions';
