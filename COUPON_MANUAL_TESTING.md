# URT Wholesale - Coupon & Discount System QA Manual Test Checklist

This document provides a comprehensive verification checklist for the promotional coupon and checkout discount engine across `apps/store` and `apps/admin`.

---

## 1. Discount Rules & Calculation Scenarios

- [ ] **Percentage Discount with Cap**
  - **Rule**: 10% off, Maximum Discount ₹500, Minimum Order ₹1,000.
  - **Test Cart ₹3,000**: Discount should equal ₹300.
  - **Test Cart ₹8,000**: Discount should equal ₹500 (capped at max limit).
  - **Expected**: Taxable base and 18% GST (9% CGST + 9% SGST) calculated on the discounted subtotal.

- [ ] **Fixed Discount Exceeding Subtotal**
  - **Rule**: Flat ₹500 off, Minimum Order ₹0.
  - **Test Cart ₹350**: Discount should be capped at ₹350 (never negative total).
  - **Expected**: Payable subtotal becomes ₹0; standard shipping rules apply if applicable.

- [ ] **Minimum Order Value Threshold**
  - **Rule**: Flat ₹200 off, Minimum Order ₹2,500.
  - **Test Cart ₹1,999**: Rejected with safe message `"This coupon code is not valid for your cart."`
  - **Test Cart ₹2,500+**: Successfully applies ₹200 savings.

- [ ] **Expired Coupon**
  - **Rule**: `expires_at` set to yesterday.
  - **Action**: User enters code at checkout.
  - **Expected**: Rejected with generic safe response; no hint revealing whether the code expired or never existed.

- [ ] **Future-Scheduled Coupon**
  - **Rule**: `starts_at` set to tomorrow.
  - **Action**: User enters code at checkout.
  - **Expected**: Rejected with generic safe response.

- [ ] **Category-Restricted Coupon**
  - **Rule**: 15% off restricted to category "Fast Chargers & GaN Adapters".
  - **Cart A (Only Cables ₹1,500)**: Rejected with generic invalid message.
  - **Cart B (Charger ₹1,000 + Cable ₹500 = ₹1,500)**: Discount calculated strictly against the ₹1,000 eligible charger portion (₹150 off), not against the total cart.

- [ ] **First-Order-Only Restriction**
  - **Rule**: `is_first_order_only = true`.
  - **New Customer (0 past orders)**: Coupon applies successfully.
  - **Returning Customer (1+ past completed orders)**: Rejected at server verification step.

---

## 2. Storefront Cart & Checkout State Flow

- [ ] **Cart Mutation After Applying Coupon**
  - Apply valid coupon on ₹2,200 cart.
  - Remove an item so subtotal drops to ₹1,400 (below ₹2,000 min order).
  - **Expected**: The system automatically re-evaluates or prompts customer that minimum order condition is no longer met, clearing or recalculating discount.

- [ ] **Manual Coupon Removal**
  - User taps the "Remove" button on `<AppliedCouponChip />`.
  - **Expected**: Saved state cleared, cart financial summary line removed, coupon input collapsed back to initial "Have a coupon code?" trigger, light haptic feedback triggered.

- [ ] **Guest vs. Logged-in Customer Flow**
  - **Guest Checkout**: Coupon code forwarded to Edge Function (`/functions/v1/checkout-gate`) -> `create_verified_order_guest`. Per-customer usage tracked by SHA-256 phone hash.
  - **Authenticated Checkout**: Coupon code passed to RPC `create_verified_order`. Per-customer usage tracked by auth `user_id`.
  - **Expected**: Both order records contain `coupon_code`, `discount_amount`, and `subtotal_before_discount`.

---

## 3. UI / UX, Localization & Responsive Design

- [ ] **Hindi / English Localization (`LanguageContext`)**
  - Switch language toggle between English and Hindi (`hi`).
  - Verify localized strings:
    - `"Have a coupon code?"` / `"क्या आपके पास कूपन कोड है?"`
    - `"Enter coupon code"` / `"कूपन कोड दर्ज करें"`
    - `"Apply"` / `"लागू करें"`
    - `"You saved ₹X"` / `"आपने ₹X बचाए"`
    - `"Coupon (CODE)"` / `"कूपन (CODE)"`

- [ ] **Dual Theme Support (Light & Dark Mode)**
  - Toggle between Light and Dark mode on `apps/store`.
  - **Primary Tokens**: Solid teal (`#0A82A8` in light / `#2BBFD9` in dark).
  - **Soft Surface**: `bg-primary-soft` with `border-primary-border`.
  - **Success / Danger**: Positive green savings pill (`bg-success-soft text-success`), clear red error message on rejection.
  - **Contrast**: Passes WCAG AA 4.5:1 text contrast on both dark and light surfaces.

- [ ] **390px Mobile Viewport & Tactile Feedback**
  - Test on 390px viewport (iPhone 12/13/14 mobile standard).
  - Touch target sizes for Apply and Remove buttons >= 44px.
  - Bottom navigation dock clearance preserved (no overlap).
  - Haptic feedback fires on apply (`"success"`), error (`"heavy"`), and remove (`"light"`).

---

## 4. Admin Management Flow (`apps/admin`)

- [ ] **Coupon CRUD & Status Filter Pills**
  - Create new coupon with random code generator.
  - Filter coupon table using status pills: `All`, `Active`, `Scheduled`, `Expired`, `Disabled`, `Used up`.
  - Toggle coupon active switch and confirm immediate state change.
  - Attempt delete on a coupon with `used_count > 0`: System blocks hard delete and prompts to Disable.

- [ ] **Analytics & Redemption History Drawer**
  - Open `<CouponDetailDrawer />` for an active coupon.
  - Check KPI cards: Redemptions, Total Discount Given, Revenue Influenced, Last Used.
  - Click on an order in the redemption log: Navigates directly to Order Details modal.

- [ ] **GST Invoice & Order Management**
  - View order in `OrderList`: Monospace badge `🎟️ CODE (-₹X)` visible in Total column.
  - Open `OrderDetailModal`: Financial breakdown displays coupon chip and discount line.
  - Click "Print GST Invoice": Invoice contains `Discount (CODE)` row, and 18% GST is computed on the discounted taxable base.

