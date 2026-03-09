# Contractor Invoicing Feature

## Overview

This feature extends the PayD platform to support contractor-led invoice submission and approval workflows, enabling organizations to manage both salaried employees and contract workers.

## Features Implemented

### 1. RBAC Enhancement
- Added `CONTRACTOR` role to the existing `EMPLOYER` and `EMPLOYEE` roles
- Updated type definitions in `backend/src/types/auth.ts`

### 2. Database Schema
- Created `invoices` table with the following fields:
  - Invoice details (number, hours, rate, total_amount, currency)
  - Status tracking (pending, approved, rejected, paid)
  - Approval workflow (reviewed_by, reviewed_at, rejection_reason)
  - Payment tracking (payment_tx_hash)
- Added `role` column to `employees` table to distinguish between employees and contractors

### 3. Backend API

#### Endpoints

**Contractor Routes:**
- `POST /api/invoices` - Submit a new invoice
- `GET /api/invoices/my-invoices` - Get contractor's invoices

**Employer Routes:**
- `GET /api/invoices` - Get all invoices (with optional status filter)
- `GET /api/invoices/approved` - Get approved invoices ready for payment
- `GET /api/invoices/:id` - Get invoice details
- `PATCH /api/invoices/:id/review` - Approve or reject an invoice
- `GET /api/invoices/:id/pdf` - Download invoice as PDF

#### Services
- `InvoiceService` - CRUD operations for invoices
- `InvoicePDFService` - PDF generation using PDFKit

### 4. Frontend Components

#### Contractor Portal (`/contractor`)
- **InvoiceSubmissionForm** - Form to submit new invoices with:
  - Hours worked
  - Hourly rate
  - Currency selection
  - Description
  - Optional attachment URL
  - Real-time total calculation
- **InvoiceList** - Display contractor's invoices with:
  - Status badges (pending, approved, rejected, paid)
  - Invoice details
  - Rejection reasons (if applicable)
  - PDF download button
- Tab filtering by status (All, Pending, Approved, Paid)

#### Admin Portal (`/invoices`)
- **InvoiceApprovalList** - Review and manage invoices with:
  - Contractor information
  - Invoice details
  - Approve/Reject actions
  - Rejection reason input
  - PDF download
- Tab filtering by status (Pending, Approved, Rejected, Paid, All)

### 5. PDF Generation
- Professional invoice PDF with:
  - Invoice header and number
  - Contractor information
  - Itemized breakdown (hours × rate)
  - Total amount
  - Payment details (if paid)
  - Transaction hash (if paid)

## Usage

### For Contractors

1. Navigate to `/contractor`
2. Click "Submit New Invoice"
3. Fill in the form:
   - Enter hours worked
   - Enter hourly rate
   - Add description of work
   - Optionally add attachment URL
4. Submit the invoice
5. Track invoice status in the list
6. Download PDF for records

### For Employers/Admins

1. Navigate to `/invoices`
2. Review pending invoices
3. For each invoice:
   - Review contractor details
   - Check hours and rate
   - Approve or reject with reason
4. Approved invoices are queued for payment
5. Download PDFs for accounting

### Payment Integration

Approved invoices can be integrated with the existing payroll system:

```typescript
// Get approved invoices
const approvedInvoices = await invoiceService.getApprovedInvoicesForPayment(organizationId);

// Process payments (integrate with existing stellar payment logic)
for (const invoice of approvedInvoices) {
  const txHash = await processPayment(invoice);
  await invoiceService.markInvoiceAsPaid(invoice.id, txHash);
}
```

## Database Migration

Run the migration to create the invoices table:

```bash
cd backend
npm run migrate
```

Or manually execute:
```bash
psql -d your_database -f src/db/migrations/018_create_invoices.sql
```

## Dependencies

### Backend
- `pdfkit` - PDF generation (add to package.json if not present)
- `@types/pdfkit` - TypeScript types

### Frontend
- No new dependencies required (uses existing Stellar Design System)

## API Examples

### Submit Invoice (Contractor)
```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <contractor_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hours": 40,
    "rate": 50,
    "currency": "USDC",
    "description": "Frontend development work for Q1"
  }'
```

### Approve Invoice (Employer)
```bash
curl -X PATCH http://localhost:3001/api/invoices/1/review \
  -H "Authorization: Bearer <employer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

### Reject Invoice (Employer)
```bash
curl -X PATCH http://localhost:3001/api/invoices/1/review \
  -H "Authorization: Bearer <employer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "rejection_reason": "Hours do not match agreed scope"
  }'
```

### Download PDF
```bash
curl -X GET http://localhost:3001/api/invoices/1/pdf \
  -H "Authorization: Bearer <token>" \
  --output invoice.pdf
```

## Security Considerations

- All routes are protected with JWT authentication
- RBAC middleware ensures contractors can only access their own invoices
- Employers can only access invoices within their organization
- Input validation using Zod schemas
- SQL injection protection via parameterized queries

## Future Enhancements

- File upload for attachments (currently URL-based)
- Email notifications on status changes
- Bulk invoice approval
- Invoice templates
- Recurring invoices
- Multi-currency conversion
- Tax calculation integration
- Automated payment scheduling for approved invoices

## Testing

### Manual Testing

1. Create a contractor user with role 'CONTRACTOR'
2. Test invoice submission
3. Switch to employer account
4. Test approval/rejection workflow
5. Verify PDF generation
6. Test status filtering

### Integration with Payroll

Approved invoices should be automatically queued for the next batch payment cycle. Update the payroll scheduler to include approved invoices:

```typescript
// In scheduleExecutor.ts or similar
const approvedInvoices = await invoiceService.getApprovedInvoicesForPayment(orgId);
// Add to payment batch
```

## Files Created/Modified

### Backend
- `src/types/auth.ts` - Added CONTRACTOR role
- `src/types/invoice.ts` - Invoice types
- `src/schemas/invoiceSchema.ts` - Validation schemas
- `src/services/invoiceService.ts` - Invoice business logic
- `src/services/invoicePDFService.ts` - PDF generation
- `src/controllers/invoiceController.ts` - Request handlers
- `src/routes/invoiceRoutes.ts` - Route definitions
- `src/app.ts` - Registered invoice routes
- `src/db/migrations/018_create_invoices.sql` - Database schema

### Frontend
- `src/components/InvoiceSubmissionForm.tsx` - Invoice form
- `src/components/InvoiceList.tsx` - Contractor invoice list
- `src/components/InvoiceApprovalList.tsx` - Admin approval list
- `src/pages/ContractorPortal.tsx` - Contractor portal page
- `src/pages/InvoiceApproval.tsx` - Admin approval page
- `src/App.tsx` - Added routes

## Acceptance Criteria Status

✅ "Contractor" role added to the RBAC system
✅ Invoice submission form (Hours, Rate, Description, Attachment) in the portal
✅ Admin "Approval Workflow" UI to review, reject, or approve submitted invoices
✅ Approved invoices automatically queued for the next batch payment (integration point provided)
✅ PDF generation for submitted invoices for contractor record-keeping
