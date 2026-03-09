# Contractor Invoicing - Testing Checklist

## Pre-Testing Setup

- [ ] Database migration executed successfully
- [ ] Backend dependencies installed (`pdfkit`, `@types/pdfkit`)
- [ ] Backend server running
- [ ] Frontend server running
- [ ] Test organization created
- [ ] Test contractor user created (role='CONTRACTOR')
- [ ] Test employer user created (role='EMPLOYER')

## Contractor Portal Tests

### Invoice Submission
- [ ] Navigate to `/contractor`
- [ ] Click "Submit New Invoice" button
- [ ] Form displays correctly
- [ ] Enter hours: 40
- [ ] Enter rate: 50
- [ ] Total calculates correctly (2000)
- [ ] Enter description
- [ ] Submit invoice
- [ ] Success message appears
- [ ] Invoice appears in list with "PENDING" status
- [ ] Form resets after submission

### Invoice Validation
- [ ] Try submitting with hours = 0 → Error shown
- [ ] Try submitting with rate = 0 → Error shown
- [ ] Try submitting with negative hours → Error shown
- [ ] Try submitting with negative rate → Error shown

### Invoice List View
- [ ] All submitted invoices display
- [ ] Status badges show correct colors:
  - [ ] Pending = Yellow
  - [ ] Approved = Green
  - [ ] Rejected = Red
  - [ ] Paid = Blue
- [ ] Hours, rate, and total display correctly
- [ ] Description displays if provided
- [ ] Submission date displays correctly

### Tab Filtering
- [ ] "All" tab shows all invoices
- [ ] "Pending" tab shows only pending invoices
- [ ] "Approved" tab shows only approved invoices
- [ ] "Paid" tab shows only paid invoices
- [ ] Tab counts are accurate

### PDF Download (Contractor)
- [ ] Click "Download PDF" button
- [ ] PDF downloads successfully
- [ ] PDF contains invoice number
- [ ] PDF contains contractor name and email
- [ ] PDF contains hours, rate, and total
- [ ] PDF contains description
- [ ] PDF contains submission date

## Admin Portal Tests

### Invoice List View
- [ ] Navigate to `/invoices`
- [ ] All organization invoices display
- [ ] Contractor name and email display
- [ ] Invoice details display correctly
- [ ] Status badges display correctly

### Tab Filtering
- [ ] "Pending" tab shows only pending invoices
- [ ] "Approved" tab shows only approved invoices
- [ ] "Rejected" tab shows only rejected invoices
- [ ] "Paid" tab shows only paid invoices
- [ ] "All" tab shows all invoices

### Approval Workflow
- [ ] Pending invoice shows "Approve" and "Reject" buttons
- [ ] Click "Approve" button
- [ ] Loading state shows
- [ ] Invoice status updates to "APPROVED"
- [ ] Buttons disappear after approval
- [ ] Invoice moves to "Approved" tab

### Rejection Workflow
- [ ] Click "Reject" button on pending invoice
- [ ] Rejection reason textarea appears
- [ ] Try to confirm without reason → Alert shown
- [ ] Enter rejection reason
- [ ] Click "Confirm Reject"
- [ ] Loading state shows
- [ ] Invoice status updates to "REJECTED"
- [ ] Rejection reason displays in invoice card
- [ ] Invoice moves to "Rejected" tab

### Rejection Cancellation
- [ ] Click "Reject" button
- [ ] Rejection form appears
- [ ] Click "Cancel" button
- [ ] Form disappears
- [ ] Invoice remains in pending state

### PDF Download (Admin)
- [ ] Click "Download PDF" button on any invoice
- [ ] PDF downloads successfully
- [ ] PDF contains all invoice details
- [ ] PDF matches contractor's PDF

### Approved/Rejected Invoice Display
- [ ] Approved invoices don't show approve/reject buttons
- [ ] Rejected invoices don't show approve/reject buttons
- [ ] Paid invoices don't show approve/reject buttons
- [ ] All invoices show "Download PDF" button

## API Tests

### Contractor Endpoints
```bash
# Submit invoice
curl -X POST http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <contractor_token>" \
  -H "Content-Type: application/json" \
  -d '{"hours": 40, "rate": 50, "currency": "USDC", "description": "Test work"}'
```
- [ ] Returns 201 Created
- [ ] Returns invoice object with ID
- [ ] Invoice number is generated
- [ ] Status is "pending"

```bash
# Get my invoices
curl -X GET http://localhost:3001/api/invoices/my-invoices \
  -H "Authorization: Bearer <contractor_token>"
```
- [ ] Returns 200 OK
- [ ] Returns array of invoices
- [ ] Only returns contractor's own invoices

### Employer Endpoints
```bash
# Get all invoices
curl -X GET http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <employer_token>"
```
- [ ] Returns 200 OK
- [ ] Returns all organization invoices
- [ ] Includes contractor information

```bash
# Get pending invoices
curl -X GET "http://localhost:3001/api/invoices?status=pending" \
  -H "Authorization: Bearer <employer_token>"
```
- [ ] Returns 200 OK
- [ ] Returns only pending invoices

```bash
# Approve invoice
curl -X PATCH http://localhost:3001/api/invoices/1/review \
  -H "Authorization: Bearer <employer_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```
- [ ] Returns 200 OK
- [ ] Invoice status updated to "approved"
- [ ] reviewed_at timestamp set
- [ ] reviewed_by set to employer ID

```bash
# Reject invoice
curl -X PATCH http://localhost:3001/api/invoices/1/review \
  -H "Authorization: Bearer <employer_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "rejected", "rejection_reason": "Invalid hours"}'
```
- [ ] Returns 200 OK
- [ ] Invoice status updated to "rejected"
- [ ] rejection_reason saved
- [ ] reviewed_at timestamp set

```bash
# Get approved invoices
curl -X GET http://localhost:3001/api/invoices/approved \
  -H "Authorization: Bearer <employer_token>"
```
- [ ] Returns 200 OK
- [ ] Returns only approved invoices
- [ ] Ready for payment processing

### Authorization Tests
```bash
# Contractor tries to access all invoices
curl -X GET http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <contractor_token>"
```
- [ ] Returns 403 Forbidden

```bash
# Contractor tries to approve invoice
curl -X PATCH http://localhost:3001/api/invoices/1/review \
  -H "Authorization: Bearer <contractor_token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```
- [ ] Returns 403 Forbidden

```bash
# Employer tries to submit invoice
curl -X POST http://localhost:3001/api/invoices \
  -H "Authorization: Bearer <employer_token>" \
  -H "Content-Type: application/json" \
  -d '{"hours": 40, "rate": 50}'
```
- [ ] Returns 403 Forbidden

## Database Tests

```sql
-- Check invoice was created
SELECT * FROM invoices WHERE contractor_id = <contractor_id>;
```
- [ ] Invoice exists
- [ ] total_amount computed correctly (hours * rate)
- [ ] invoice_number is unique
- [ ] status is 'pending'

```sql
-- Check approval updated correctly
SELECT * FROM invoices WHERE id = <invoice_id>;
```
- [ ] status is 'approved'
- [ ] reviewed_at is set
- [ ] reviewed_by is set

```sql
-- Check rejection updated correctly
SELECT * FROM invoices WHERE id = <invoice_id>;
```
- [ ] status is 'rejected'
- [ ] rejection_reason is set
- [ ] reviewed_at is set
- [ ] reviewed_by is set

## Integration Tests

### Payment Integration
- [ ] Get approved invoices via API
- [ ] Process payment on Stellar network
- [ ] Call `markInvoiceAsPaid(id, txHash)`
- [ ] Invoice status updates to 'paid'
- [ ] payment_tx_hash is saved
- [ ] Invoice appears in "Paid" tab

## Edge Cases

### Concurrent Access
- [ ] Two employers try to approve same invoice → Only first succeeds
- [ ] Contractor submits while employer reviews → No conflicts

### Data Validation
- [ ] Very large hours (999999) → Accepted
- [ ] Very small rate (0.01) → Accepted
- [ ] Very long description (2000 chars) → Accepted
- [ ] Invalid URL in attachment → Validation error
- [ ] Missing required fields → Validation error

### Organization Isolation
- [ ] Contractor from Org A cannot see invoices from Org B
- [ ] Employer from Org A cannot approve invoices from Org B
- [ ] PDF download respects organization boundaries

## Performance Tests

- [ ] List 100+ invoices → Loads in < 2s
- [ ] PDF generation → Completes in < 1s
- [ ] Pagination works correctly
- [ ] Filtering doesn't cause N+1 queries

## Browser Compatibility

- [ ] Chrome - All features work
- [ ] Firefox - All features work
- [ ] Safari - All features work
- [ ] Edge - All features work
- [ ] Mobile Chrome - Responsive layout
- [ ] Mobile Safari - Responsive layout

## Accessibility

- [ ] All form inputs have labels
- [ ] Buttons have descriptive text
- [ ] Status badges have sufficient contrast
- [ ] Keyboard navigation works
- [ ] Screen reader friendly

## Error Handling

- [ ] Network error during submission → Error message shown
- [ ] Invalid token → Redirects to login
- [ ] Server error → User-friendly error message
- [ ] PDF generation fails → Error message shown

## Summary

Total Tests: ~100
- [ ] All tests passing
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No ESLint warnings

## Sign-off

- [ ] Feature tested by developer
- [ ] Feature tested by QA
- [ ] Feature reviewed by tech lead
- [ ] Documentation complete
- [ ] Ready for production deployment
