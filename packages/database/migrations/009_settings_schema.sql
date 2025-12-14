-- Migration 009: Settings Schema (Currencies, Exchange Rates)
-- Purpose: System configuration for multi-currency support
-- Dependencies: 001_core_schema.sql (tenants table)

-- Currency table
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT currencies_code_check CHECK (length(code) >= 2 AND length(code) <= 5),
  CONSTRAINT currencies_name_check CHECK (length(name) >= 1 AND length(name) <= 255),
  CONSTRAINT currencies_tenant_code_unique UNIQUE (tenant_id, code)
);

-- Exchange rate types
CREATE TYPE rate_type AS ENUM ('formal', 'black_market');

-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL DEFAULT 'USD',
  rate_type rate_type NOT NULL DEFAULT 'formal',
  rate DECIMAL(15,6) NOT NULL CHECK (rate > 0),
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT exchange_rates_currencies_check CHECK (from_currency != to_currency),
  CONSTRAINT exchange_rates_unique UNIQUE (tenant_id, from_currency, to_currency, rate_type, effective_date)
);

-- Indexes for performance
CREATE INDEX idx_currencies_tenant ON currencies(tenant_id);
CREATE INDEX idx_currencies_code ON currencies(tenant_id, code);
CREATE INDEX idx_currencies_default ON currencies(tenant_id, is_default) WHERE is_default = true;

CREATE INDEX idx_exchange_rates_tenant ON exchange_rates(tenant_id);
CREATE INDEX idx_exchange_rates_lookup ON exchange_rates(tenant_id, from_currency, to_currency, rate_type, effective_date);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(tenant_id, effective_date DESC);

-- Trigger to ensure only one default currency per tenant
CREATE OR REPLACE FUNCTION ensure_single_default_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE currencies
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER currencies_default_trigger
  BEFORE INSERT OR UPDATE ON currencies
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION ensure_single_default_currency();

-- Updated at trigger for currencies
CREATE TRIGGER currencies_updated_at
  BEFORE UPDATE ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated at trigger for exchange_rates
CREATE TRIGGER exchange_rates_updated_at
  BEFORE UPDATE ON exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant isolation
CREATE POLICY tenant_isolation_currencies ON currencies
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_exchange_rates ON exchange_rates
  FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role bypass
CREATE POLICY service_role_bypass_currencies ON currencies
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY service_role_bypass_exchange_rates ON exchange_rates
  FOR ALL
  TO service_role
  USING (true);

-- Comments
COMMENT ON TABLE currencies IS 'Tenant-specific currencies for multi-currency support';
COMMENT ON TABLE exchange_rates IS 'Historical exchange rates (formal and black market) for currency conversion';
COMMENT ON COLUMN currencies.is_default IS 'Only one currency can be default per tenant (enforced by trigger)';
COMMENT ON COLUMN exchange_rates.rate_type IS 'Formal rate (bank/official) or black market rate';
