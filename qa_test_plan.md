# Comprehensive QA Test Plan: Tinku Mobiles ERP (Antigravity)

As a Senior QA Engineer, I've designed a comprehensive testing strategy tailored to your Laravel Backend and React Frontend architecture. This plan covers every layer of the application, ensuring data integrity, robust error handling, and a seamless user experience across the Sales, Purchase, Repair, and Entity Ledger modules.

---

## 1. Backend Testing Strategy (Laravel / PHPUnit / Pest)

The backend is the source of truth, especially for financial transactions, inventory, and entity balancing. Tests here must be exhaustive.

### 1.1 Controllers & API Endpoints
*Focus: Request validation, response structure, status codes, and authorization.*

*   **`SaleInvoiceControllerTest`**
    *   `test_can_create_sale_invoice_with_valid_data`: Verify 201 status, proper DB insertion of SaleInvoice and SaleItems, and deduction from Inventory.
    *   `test_cannot_create_sale_invoice_with_insufficient_stock`: Verify 422 status and specific validation error when trying to sell an item not in stock.
    *   `test_sale_invoice_creation_updates_entity_balance`: Ensure that creating an unpaid sale correctly increases the Customer's entity balance (Receivable).
    *   `test_unauthorized_user_cannot_delete_sale_invoice`: Verify 403 status for users lacking admin permissions.
*   **`EntityLedgerControllerTest`**
    *   `test_fetch_entity_ledger_returns_paginated_data`: Verify structure of the ledger response.
    *   `test_entity_ledger_filters_by_date_range_correctly`: Supply `start_date` and `end_date` and assert only relevant transactions are returned.
*   **`AirtelDropControllerTest` / `RechargeControllerTest`**
    *   `test_recharge_creation_deducts_from_wallet`: Verify virtual balances update correctly on successful recharge.
    *   `test_duplicate_recharge_request_is_prevented`: Test idempotency by sending the exact same payload twice quickly.

### 1.2 Models & Observers
*Focus: Relationships, scopes, mutators, and business logic encapsulated in the model layer.*

*   **`TransactionServiceTest` (Service Layer)**
    *   `test_transaction_service_correctly_balances_double_entry`: Verify that every `credit` has a corresponding `debit` across Entities.
    *   `test_transaction_rollback_on_failure`: Simulate a database error mid-transaction and assert no partial records are saved.
*   **`ProductTest` & `InventoryTest`**
    *   `test_product_has_many_inventory_items`: Verify the Eloquent relationship.
    *   `test_inventory_scope_available`: Ensure the `available()` scope filters out sold items.
*   **`ActivityLogTest`**
    *   `test_model_events_trigger_activity_log`: Verify that updating a `RepairRequest` automatically creates a corresponding `ActivityLog` entry with the `old` and `new` states.

### 1.3 Middlewares & Authentication
*   **`JwtMiddlewareTest` / `SanctumTest`**
    *   `test_requests_without_token_are_rejected`: Verify 401 Unauthorized.
    *   `test_expired_token_returns_specific_error`: Verify 401 with a "Token Expired" message.
    *   `test_tenant_or_shop_isolation_middleware`: If users belong to specific shops, verify User A cannot access Shop B's data.

---

## 2. Frontend Testing Strategy (React / Vitest / React Testing Library)

Frontend tests should verify what the user sees and interacts with, without worrying about internal implementation details.

### 2.1 Component Rendering & User Interaction
*   **`SaleForm.test.jsx` (or similar Purchase/Sale component)**
    *   `renders_all_necessary_input_fields`: Verify customer select, product search, quantity, and price inputs are visible.
    *   `calculates_grand_total_correctly`: When adding items, verify the UI updates the total instantly.
    *   `shows_validation_error_on_empty_submission`: Click "Submit" without data -> expect "Customer is required" text.
    *   `removes_item_from_cart_when_delete_clicked`: Add an item, click the trash icon, verify the item is removed and total recalculates.

### 2.2 Hooks & State Management (Zustand/Redux/Context)
*   **`useAuth` Hook**
    *   `logs_user_in_and_sets_token`: Mock API success, call login, verify token is stored and user state is updated.
    *   `clears_state_on_logout`: Call logout, verify state is wiped and token removed from local storage.
*   **`useFetchLedger` Hook (or React Query integration)**
    *   `handles_loading_state`: Verify `isLoading` is true while the mock promise is pending.
    *   `handles_error_state`: Mock a 500 response, verify `error` contains the message.

### 2.3 API Integration Mocking (MSW - Mock Service Worker)
*   **`RepairList.test.jsx`**
    *   `displays_repair_tickets_from_api`: Use MSW to intercept `/api/repairs`, return mock data, and assert the rows render in the table.
    *   `shows_empty_state_graphic_when_no_data`: Return `[]` from API, assert "No Repairs Found" UI is displayed.

---

## 3. End-to-End (E2E) Testing (Cypress / Playwright)

E2E tests trace the critical business paths through the actual browser, talking to a real (test) database.

### 3.1 Key User Journeys
1.  **The Complete Sales Cycle**
    *   *Steps*: Login as Salesman -> Navigate to POS/New Sale -> Search & Select Product -> Select Customer -> Enter Discount -> Select Payment Method (Cash) -> Submit -> Assert redirect to Invoice View -> Assert Success Toast -> (Backend check) Verify Inventory decremented.
2.  **The Repair Lifecycle**
    *   *Steps*: Login -> Create Repair Ticket -> Add initial diagnostic notes -> Update Status to "In Progress" -> Add Parts used (check inventory logic) -> Change Status to "Completed" -> Process Payment -> Print Receipt.
3.  **Financial Auditing (Entity Ledger)**
    *   *Steps*: Login as Admin -> Navigate to Entity Ledger -> Select a Supplier -> Filter by "Last Month" -> Assert the running balance matches expectations -> Export to PDF/CSV -> Verify download triggers.
4.  **Bulk Operations**
    *   *Steps*: Navigate to Opening Stock Entry -> Paste 50 IMEI numbers -> Submit -> Assert 50 rows appear in the Inventory table.

---

## 4. The Senior QA "What-If" Edge Case Checklist

These are the scenarios that break applications in production. Your test suite (both manual and automated) should cover these:

### 4.1 Network & Concurrency Edge Cases
*   [ ] **The Double-Clicker**: What happens if the user aggressively double-clicks the "Complete Sale" or "Submit Recharge" button? (Does it create duplicate invoices/deductions? *Fix: Disable button on submit, use idempotency keys*).
*   [ ] **The Offline User**: What happens if the internet drops exactly after hitting "Submit" but before the response returns? Does the UI hang forever? Is there a timeout?
*   [ ] **Concurrent Stock Reduction**: User A and User B both have the *last* iPhone 15 in their cart. They hit "Checkout" at the exact same millisecond. Does the database prevent inventory from going to -1? (*Fix: DB level constraints, Pessimistic locking `lockForUpdate()`*).

### 4.2 Data Integrity & Security
*   [ ] **The Negative Value Attack**: What if a user intercepts the payload and changes `discount` or `quantity` to `-500`? Does the backend blindly calculate it, potentially crediting the customer?
*   [ ] **Orphaned Data**: If a `Shop` or `Category` is deleted, what happens to the `Products` associated with it? (*Fix: Restrict deletion or cascade soft deletes*).
*   [ ] **IDOR (Insecure Direct Object Reference)**: Can a User belonging to "Shop A" change the URL to `/api/invoices/999` (which belongs to Shop B) and view/edit it?
*   [ ] **SQL Injection / XSS**: Are search inputs (like IMEI search or Customer Name) properly escaping characters? Try entering `<script>alert(1)</script>` as a Customer name.

### 4.3 UI/UX Edge Cases
*   [ ] **The Massive Text Break**: What if a customer name is "John Jacob Jingleheimer Schmidt The Third Of His Name"? Does the table column break the UI or properly truncate with ellipsis?
*   [ ] **The Empty State**: Navigating to a page with zero records. Does it show a broken table header, or a nice "No data available" graphic?
*   [ ] **Token Expiry Mid-Action**: User fills out a massive 50-item purchase invoice over 2 hours. Their token expires at hour 1. They hit submit. Do they lose all 50 items? (*Fix: Silent token refresh, or save draft to local storage*).
*   [ ] **Pagination Limits**: What happens on page 9999 of the ledger? Does the DB query crash due to extreme offset?

### 4.4 Financial Edge Cases
*   [ ] **Zero-Value Invoices**: Can a system process an invoice with a total of ₹0 (e.g., full warranty replacement)? Does it crash the accounting logic?
*   [ ] **Rounding Errors**: If an item is ₹99.99 with 18% GST, does the rounding happen per item or on the subtotal? Does the backend and frontend rounding logic perfectly match?
*   [ ] **Partial Payments**: A customer pays ₹500 on a ₹1000 invoice. Is the status correctly marked "Partial", and is exactly ₹500 added to the Receivable ledger?
