# Contractor Invoicing Workflow

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTRACTOR WORKFLOW                           │
└─────────────────────────────────────────────────────────────────────┘

    Contractor                    Backend API                  Database
        │                              │                           │
        │  1. Submit Invoice           │                           │
        ├─────────────────────────────>│                           │
        │  POST /api/invoices          │                           │
        │  {hours, rate, desc}         │   INSERT INTO invoices    │
        │                              ├──────────────────────────>│
        │                              │   status='pending'        │
        │                              │<──────────────────────────┤
        │  201 Created                 │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │
        │  2. View My Invoices         │                           │
        ├─────────────────────────────>│                           │
        │  GET /api/invoices/my-invoices                           │
        │                              │   SELECT * WHERE          │
        │                              │   contractor_id=X         │
        │                              ├──────────────────────────>│
        │                              │<──────────────────────────┤
        │  200 OK [invoices]           │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │
        │  3. Download PDF             │                           │
        ├─────────────────────────────>│                           │
        │  GET /api/invoices/:id/pdf   │                           │
        │                              │   Generate PDF            │
        │  PDF Stream                  │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │


┌─────────────────────────────────────────────────────────────────────┐
│                         EMPLOYER WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────┘

    Employer                      Backend API                  Database
        │                              │                           │
        │  1. View Pending Invoices    │                           │
        ├─────────────────────────────>│                           │
        │  GET /api/invoices?status=pending                        │
        │                              │   SELECT * WHERE          │
        │                              │   status='pending'        │
        │                              ├──────────────────────────>│
        │                              │<──────────────────────────┤
        │  200 OK [invoices]           │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │
        │  2. Approve Invoice          │                           │
        ├─────────────────────────────>│                           │
        │  PATCH /api/invoices/:id/review                          │
        │  {status: 'approved'}        │   UPDATE invoices         │
        │                              │   SET status='approved'   │
        │                              ├──────────────────────────>│
        │                              │<──────────────────────────┤
        │  200 OK                      │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │
        │  3. OR Reject Invoice        │                           │
        ├─────────────────────────────>│                           │
        │  PATCH /api/invoices/:id/review                          │
        │  {status: 'rejected',        │   UPDATE invoices         │
        │   rejection_reason: '...'}   │   SET status='rejected'   │
        │                              ├──────────────────────────>│
        │                              │<──────────────────────────┤
        │  200 OK                      │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │


┌─────────────────────────────────────────────────────────────────────┐
│                      PAYMENT INTEGRATION                             │
└─────────────────────────────────────────────────────────────────────┘

    Payroll Scheduler             Backend API                  Database
        │                              │                           │
        │  1. Get Approved Invoices    │                           │
        ├─────────────────────────────>│                           │
        │  GET /api/invoices/approved  │                           │
        │                              │   SELECT * WHERE          │
        │                              │   status='approved'       │
        │                              ├──────────────────────────>│
        │                              │<──────────────────────────┤
        │  200 OK [invoices]           │                           │
        │<─────────────────────────────┤                           │
        │                              │                           │
        │  2. Process Payments         │                           │
        │  (Stellar Network)           │                           │
        │                              │                           │
        │  3. Mark as Paid             │                           │
        ├─────────────────────────────>│                           │
        │  (Internal call)             │   UPDATE invoices         │
        │  markInvoiceAsPaid(id, hash) │   SET status='paid'       │
        │                              │   payment_tx_hash=X       │
        │                              ├──────────────────────────>│
        │                              │<──────────────────────────┤
        │                              │                           │
```

## Status State Machine

```
    ┌─────────┐
    │ PENDING │ ◄─── Initial state when contractor submits
    └────┬────┘
         │
         ├──────────┐
         │          │
         ▼          ▼
    ┌─────────┐  ┌──────────┐
    │APPROVED │  │ REJECTED │ ◄─── Terminal state (can resubmit new invoice)
    └────┬────┘  └──────────┘
         │
         ▼
    ┌──────┐
    │ PAID │ ◄─── Terminal state (payment completed)
    └──────┘
```

## Component Architecture

```
Frontend Components:
├── ContractorPortal (/contractor)
│   ├── InvoiceSubmissionForm
│   │   ├── Hours input
│   │   ├── Rate input
│   │   ├── Currency selector
│   │   ├── Description textarea
│   │   ├── Attachment URL input
│   │   └── Total calculation
│   └── InvoiceList
│       ├── Status badges
│       ├── Invoice details
│       ├── Rejection reasons
│       └── PDF download button
│
└── InvoiceApproval (/invoices)
    └── InvoiceApprovalList
        ├── Contractor info display
        ├── Invoice details
        ├── Approve button
        ├── Reject button + reason input
        └── PDF download button

Backend Services:
├── InvoiceService
│   ├── createInvoice()
│   ├── getInvoiceById()
│   ├── getInvoicesByContractor()
│   ├── getInvoicesByOrganization()
│   ├── reviewInvoice()
│   ├── getApprovedInvoicesForPayment()
│   └── markInvoiceAsPaid()
│
└── InvoicePDFService
    └── generateInvoicePDF()
```

## Database Schema

```sql
invoices
├── id (PK)
├── organization_id (FK → organizations)
├── contractor_id (FK → employees)
├── invoice_number (UNIQUE)
├── hours (DECIMAL)
├── rate (DECIMAL)
├── total_amount (COMPUTED: hours * rate)
├── currency (VARCHAR)
├── description (TEXT)
├── attachment_url (VARCHAR)
├── status (ENUM: pending, approved, rejected, paid)
├── submitted_at (TIMESTAMP)
├── reviewed_at (TIMESTAMP)
├── reviewed_by (FK → employees)
├── rejection_reason (TEXT)
├── payment_tx_hash (VARCHAR)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

employees (extended)
└── role (ENUM: EMPLOYEE, CONTRACTOR) ← NEW COLUMN
```

## Security Model

```
RBAC Authorization:
├── CONTRACTOR
│   ├── POST /api/invoices ✓
│   ├── GET /api/invoices/my-invoices ✓
│   └── GET /api/invoices/:id/pdf ✓ (own invoices only)
│
├── EMPLOYER
│   ├── GET /api/invoices ✓
│   ├── GET /api/invoices/approved ✓
│   ├── GET /api/invoices/:id ✓
│   ├── PATCH /api/invoices/:id/review ✓
│   └── GET /api/invoices/:id/pdf ✓
│
└── Organization Isolation
    └── All queries filtered by organization_id
```
