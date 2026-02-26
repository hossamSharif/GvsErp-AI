# Payments Feature Specification

Generated from code analysis on 2026-01-11

## Overview

The Payments module handles recording and tracking payments between the business and its parties (customers and suppliers).

## Routes

- `/[locale]/payments` - List all payments with filtering and search
- `/[locale]/payments/new` - Record new payment (received from customer or made to supplier)
- `/[locale]/payments/report` - Generate and download payment reports as PDF

## Features

### Payments List (`/payments`)

- Paginated data table with sortable columns
- Filter by payment type (received/made/all)
- Search by reference or notes
- Quick actions: View, Delete
- Delete with confirmation dialog

### New Payment (`/payments/new`)

- Tabbed interface for Received vs Made payments
- For "Received": Select customer, enter amount
- For "Made": Select supplier, enter amount
- Fields:
  - Party (required) - Customer or Supplier
  - Amount (required) - Positive number
  - Currency (default USD) - 3-letter code
  - Exchange Rate (default 1)
  - Payment Method - cash, bank_transfer, check, credit_card, other
  - Reference - Optional check number/transaction ID
  - Notes - Optional additional notes
  - Payment Date (default today)

### Payments Report (`/payments/report`)

- Filter options:
  - Payment Type (All/Received/Made)
  - Party filter
  - Payment Method filter
  - Date range (from/to)
- Preview PDF in browser
- Download PDF file
- Summary includes totals and net cash flow

## Database Schema

Table: `payments`
- id: UUID (PK)
- tenant_id: UUID (FK to tenants)
- party_id: UUID (FK to parties)
- type: payment_type ENUM ('received', 'made')
- amount: DECIMAL(15,2) - must be positive
- currency: TEXT (3 chars)
- exchange_rate: DECIMAL(15,6) - must be positive
- payment_method: TEXT
- reference: TEXT
- invoice_id: UUID (FK to invoices, optional)
- notes: TEXT
- payment_date: DATE
- created_by: UUID (FK to users)
- created_at: TIMESTAMPTZ

## Triggers

- On payment INSERT: Updates party balance (decreases)
- On payment DELETE: Reverses party balance (increases)

## API Endpoints

- GET /payments - List payments with filtering
- GET /payments/:id - Get single payment
- POST /payments - Create new payment
- PUT /payments/:id - Update payment
- DELETE /payments/:id - Delete payment

## i18n

Translations in `locales/{en,ar}/parties.json` under `payments` namespace:
- title, description
- fields (party, type, amount, currency, etc.)
- types (received, made)
- methods (cash, bank, check, card)
- form labels and messages
- report labels
