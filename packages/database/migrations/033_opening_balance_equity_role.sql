-- Migration 033: Add opening_balance_equity to accounting_default_accounts role check
--
-- The opening stock feature uses a new accounting default role
-- 'opening_balance_equity' (account code 3200) as the credit side of the
-- journal entry when initial stock is entered.  The existing DB check
-- constraint must be extended to accept this value.

ALTER TABLE accounting_default_accounts
  DROP CONSTRAINT IF EXISTS accounting_default_accounts_role_check;

ALTER TABLE accounting_default_accounts
  ADD CONSTRAINT accounting_default_accounts_role_check
    CHECK (role IN (
      'cash_in_hand',
      'accounts_receivable',
      'accounts_payable',
      'sales_revenue',
      'sales_tax_payable',
      'inventory_asset',
      'cogs',
      'discount_allowed',
      'discount_received',
      'salary_expense',
      'salary_payable',
      'general_expense',
      'service_purchase_expense',
      'opening_balance_equity'
    ));
