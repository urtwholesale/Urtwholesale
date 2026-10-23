import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Product, CustomerDetails, Address } from "@urbanrat/shared";
import { getUnitPrice, getNextTier } from "@urbanrat/shared";
import {
  Trash2,
  ShoppingBag,
  MessageCircle,
  User,
  Phone,
  MapPin,
  Hash,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { QuantityInput } from "../components/QuantityInput";
import { buildWhatsAppMessage } from "../utils/buildWhatsAppMessage";
import { createVerifiedOrder } from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { EmptyState } from "../components/EmptyState";
import { AddressPicker } from "../components/AddressPicker";

interface CartPageProps {
  cartItems: { product: Product; quantity: number }[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

const CUSTOMER_STORAGE_KEY = "urt_customer_details";

export function CartPage({
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartPageProps) {
  const navigate = useNavigate();
  const { settings, whatsappNumber } = useSettings();

  // Load saved customer details from localStorage
  const [customer, setCustomer] = useState<CustomerDetails>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || "",
          phone: parsed.phone || "",
          address: parsed.address || "",
          pincode: parsed.pincode || "",
        };
      }
    } catch {
      // Fallback
    }
    return { name: "", phone: "", address: "", pincode: "" };
  });

  type FormErrors = Partial<Record<keyof CustomerDetails, string>>;
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  function handleSelectAddress(addr: Address) {
    setSelectedAddressId(addr.id);
    const formattedAddress = [
      addr.line1,
      addr.line2,
      addr.landmark ? `Landmark: ${addr.landmark}` : null,
      `${addr.city}, ${addr.state}`,
    ]
      .filter(Boolean)
      .join(", ");

    setCustomer({
      name: addr.full_name,
      phone: addr.phone,
      address: formattedAddress,
      pincode: addr.pincode,
    });

    try {
      localStorage.setItem(
        CUSTOMER_STORAGE_KEY,
        JSON.stringify({
          name: addr.full_name,
          phone: addr.phone,
          address: formattedAddress,
          pincode: addr.pincode,
        })
      );
    } catch {
      // Ignore
    }

    setErrors({});
  }

  // Per-line calculations
  const lineDetails = cartItems.map(({ product, quantity }) => {
    const tiers = product.price_tiers || [];
    const minQty = product.min_order_qty || 1;
    const step = product.order_qty_step || 1;
    const unitPrice = getUnitPrice(tiers, quantity);
    const lineTotal = unitPrice * quantity;
    const firstTierPrice = tiers[0]?.unit_price ?? product.price;
    const lineFirstTierTotal = firstTierPrice * quantity;
    const lineSavings = Math.max(0, lineFirstTierTotal - lineTotal);
    const nextTier = getNextTier(tiers, quantity);

    return {
      product,
      quantity,
      tiers,
      minQty,
      step,
      unitPrice,
      firstTierPrice,
      lineTotal,
      lineSavings,
      nextTier,
    };
  });

  // Display-only totals calculated on the client
  const displaySubtotal = lineDetails.reduce((sum, item) => sum + item.lineTotal, 0);
  const displayFirstTierTotal = lineDetails.reduce(
    (sum, item) => sum + item.firstTierPrice * item.quantity,
    0
  );
  const displaySavings = Math.max(0, displayFirstTierTotal - displaySubtotal);

  const freeDeliveryMin = settings?.free_delivery_min ?? 999;
  const standardShippingFee = settings?.shipping_fee ?? 49;
  const displayShipping = displaySubtotal >= freeDeliveryMin ? 0 : standardShippingFee;
  const displayTotal = displaySubtotal + displayShipping;

  function handleCustomerChange(field: keyof CustomerDetails, value: string) {
    setCustomer((prev: CustomerDetails) => {
      const updated = { ...prev, [field]: value };
      try {
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write issues
      }
      return updated;
    });

    if (errors[field]) {
      setErrors((prev: FormErrors) => ({ ...prev, [field]: undefined }));
    }
  }

  function validateForm(): boolean {
    const newErrors: FormErrors = {};

    if (!customer.name.trim()) {
      newErrors.name = "Full name is required";
    }

    const cleanPhone = customer.phone.replace(/\D/g, "");
    if (!cleanPhone) {
      newErrors.phone = "Mobile number is required";
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.phone = "Enter a valid 10-digit Indian mobile number (e.g. 9876543210)";
    }

    if (!customer.address.trim()) {
      newErrors.address = "Delivery address is required";
    }

    const cleanPincode = customer.pincode.replace(/\D/g, "");
    if (!cleanPincode) {
      newErrors.pincode = "PIN code is required";
    } else if (!/^\d{6}$/.test(cleanPincode)) {
      newErrors.pincode = "Enter a valid 6-digit PIN code (e.g. 400001)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCheckout() {
    if (isSubmitting) return;

    if (!validateForm()) {
      setErrorToast("Please fill in all required delivery details before proceeding");
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }

    setIsSubmitting(true);
    setErrorToast(null);

    try {
      const cleanPhone = customer.phone.replace(/\D/g, "");
      const verifiedInput = {
        customer: {
          name: customer.name.trim(),
          phone: cleanPhone,
          address: customer.address.trim(),
          pincode: customer.pincode.trim(),
        },
        items: cartItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        whatsapp_message: null,
      };

      // 1. Submit to server-verified order RPC
      const savedOrder = await createVerifiedOrder(verifiedInput);

      // 2. Clear cart after successful creation
      onClearCart();

      // 3. Build WhatsApp message using SERVER-RETURNED totals and items
      const targetPhone =
        whatsappNumber ||
        settings?.whatsapp_number?.trim() ||
        "";

      if (targetPhone) {
        const whatsappMessage = buildWhatsAppMessage({
          orderId: savedOrder.id,
          items: (savedOrder.items || []).map((i: any) => ({
            name: i.name || i.product?.name || "Item",
            price: i.unit_price ?? i.price ?? 0,
            quantity: i.quantity,
          })),
          subtotal: savedOrder.subtotal,
          savings: savedOrder.savings,
          shipping: savedOrder.shipping === 0 ? "FREE" : savedOrder.shipping,
          total: savedOrder.total, // RETURNED by server
          customer: {
            name: savedOrder.customer?.name || customer.name.trim(),
            phone: savedOrder.customer?.phone || cleanPhone,
            address:
              savedOrder.customer?.address ||
              `${customer.address.trim()}, PIN: ${customer.pincode.trim()}`,
          },
          upiId: settings?.upi_id || "7000947033-1@okbizaxis",
          siteUrl: import.meta.env.VITE_PUBLIC_SITE_URL || "",
        });

        const cleanTargetPhone = targetPhone.replace(/\D/g, "");
        const whatsappCheckoutUrl = `https://wa.me/${cleanTargetPhone}?text=${encodeURIComponent(
          whatsappMessage
        )}`;
        window.open(whatsappCheckoutUrl, "_blank");
      }

      // 4. Navigate to order confirmation page showing server total
      navigate(`/order/${savedOrder.id}`);
    } catch (err: unknown) {
      const e = err as Error;
      console.error("[Cart] Checkout order creation failed:", e);
      setErrorToast(
        e?.message || "Failed to save order. Please check item stock and retry."
      );
      setTimeout(() => setErrorToast(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-brand-dark" />}
          title="Your Cart is Empty"
          description="Explore our wholesale catalog of tempered glass, chargers, and premium mobile cables."
          actionText="Start Shopping"
          onAction={() => navigate("/marketplace")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Floating Error Toast */}
      {errorToast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-semibold text-white shadow-lg bg-rose-600 flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Wholesale Cart
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {cartItems.length} {cartItems.length === 1 ? "line item" : "line items"} ready for dispatch
          </p>
        </div>

        <button
          type="button"
          onClick={onClearCart}
          className="text-xs font-bold text-rose-500 hover:text-rose-700 transition cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Cart items list + Customer Details Form */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Cart items list */}
          <div className="space-y-3">
            {lineDetails.map(
              ({
                product,
                quantity,
                minQty,
                step,
                unitPrice,
                firstTierPrice,
                lineTotal,
                lineSavings,
                nextTier,
              }) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-100 shadow-xs flex flex-col space-y-2.5"
                >
                  <div className="flex items-start space-x-3.5 justify-between">
                    {/* Product Thumbnail */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                      <img
                        src={product.images[0] || ""}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Title & Unit Pricing */}
                    <div className="flex-1 min-w-0 pr-2">
                      <Link
                        to={`/product/${product.slug}`}
                        className="block font-bold text-xs sm:text-sm text-slate-800 hover:text-brand-dark transition truncate"
                      >
                        {product.name}
                      </Link>

                      {/* Live Unit Price & Strikethrough First-Tier Price */}
                      <div className="mt-1 flex items-baseline space-x-2">
                        <span className="font-black text-sm sm:text-base text-slate-900">
                          ₹{unitPrice.toLocaleString("en-IN")}
                          <span className="text-[10px] text-slate-400 font-normal">
                            /pc
                          </span>
                        </span>
                        {firstTierPrice > unitPrice && (
                          <span className="text-[11px] text-slate-400 line-through">
                            ₹{firstTierPrice.toLocaleString("en-IN")}
                          </span>
                        )}
                        {lineSavings > 0 && (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Saved ₹{lineSavings.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      {/* Quantity Stepper respecting min_order_qty & order_qty_step */}
                      <div className="mt-2.5 flex items-center space-x-3">
                        <QuantityInput
                          value={quantity}
                          onChange={(newQty) => onUpdateQuantity(product.id, newQty)}
                          onBelowMin={() => onRemoveItem(product.id)}
                          min={minQty}
                          max={product.stock > 0 ? product.stock : undefined}
                          step={step}
                          size="sm"
                          ariaLabel={`Quantity for ${product.name}`}
                        />

                        <span className="text-xs font-black text-slate-900">
                          = ₹{lineTotal.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => onRemoveItem(product.id)}
                      aria-label="Remove item"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nudge: Add N more to save */}
                  {nextTier && (
                    <div className="pt-1.5 border-t border-slate-100/60">
                      <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 text-[11px] font-semibold text-sky-800 flex items-center space-x-1.5">
                        <span className="text-sm">💡</span>
                        <span>
                          Add <strong>{nextTier.piecesNeeded} more</strong> to get{" "}
                          <strong>
                            ₹{nextTier.tier.unit_price.toLocaleString("en-IN")}/pc
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Customer Delivery Details Form */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-brand-dark flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-slate-900">
                  Customer &amp; Delivery Destination
                </h2>
                <p className="text-[11px] text-slate-400">
                  Required for invoice generation &amp; wholesale dispatch verification
                </p>
              </div>
            </div>

            {/* Saved Address Book Selector */}
            <AddressPicker
              selectedAddressId={selectedAddressId}
              onSelectAddress={handleSelectAddress}
              onOpenAuth={() => navigate("/login", { state: { from: "/cart" } })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 transition-colors ${
                    errors.name
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-400"
                      : "border-slate-200 focus-within:border-brand-dark focus-within:bg-white"
                  }`}
                >
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => handleCustomerChange("name", e.target.value)}
                    placeholder="Shop / Business Owner Name"
                    className="w-full text-xs font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
                {errors.name && (
                  <p className="text-rose-500 text-[11px] font-medium flex items-center space-x-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 transition-colors ${
                    errors.phone
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-400"
                      : "border-slate-200 focus-within:border-brand-dark focus-within:bg-white"
                  }`}
                >
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-400 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={customer.phone}
                    maxLength={10}
                    onChange={(e) => handleCustomerChange("phone", e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full text-xs font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
                {errors.phone && (
                  <p className="text-rose-500 text-[11px] font-medium flex items-center space-x-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.phone}</span>
                  </p>
                )}
              </div>

              {/* Delivery Address */}
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Delivery Address <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-start space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 transition-colors ${
                    errors.address
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-400"
                      : "border-slate-200 focus-within:border-brand-dark focus-within:bg-white"
                  }`}
                >
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <textarea
                    rows={2}
                    value={customer.address}
                    onChange={(e) => handleCustomerChange("address", e.target.value)}
                    placeholder="Shop / House No., Market / Area, City, State"
                    className="w-full text-xs font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400 resize-none"
                  />
                </div>
                {errors.address && (
                  <p className="text-rose-500 text-[11px] font-medium flex items-center space-x-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.address}</span>
                  </p>
                )}
              </div>

              {/* PIN Code */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  Postal PIN Code <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 transition-colors ${
                    errors.pincode
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-400"
                      : "border-slate-200 focus-within:border-brand-dark focus-within:bg-white"
                  }`}
                >
                  <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    maxLength={6}
                    value={customer.pincode}
                    onChange={(e) => handleCustomerChange("pincode", e.target.value)}
                    placeholder="6-digit PIN code"
                    className="w-full text-xs font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
                {errors.pincode && (
                  <p className="text-rose-500 text-[11px] font-medium flex items-center space-x-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{errors.pincode}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Order Summary Box (Display-only estimates) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 bg-white rounded-3xl p-5 border border-slate-100 shadow-xs space-y-4">
          <div>
            <h2 className="font-extrabold text-base text-slate-900">
              Estimated Order Summary
            </h2>
            <p className="text-[11px] text-slate-400">
              Display estimate. Official total verified by server upon placement.
            </p>
          </div>

          <div className="space-y-2 text-xs text-slate-600 border-b border-slate-100 pb-3">
            <div className="flex justify-between">
              <span>Items Subtotal</span>
              <span className="font-bold text-slate-900">
                ₹{displaySubtotal.toLocaleString("en-IN")}
              </span>
            </div>

            {displaySavings > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Wholesale Margin Savings</span>
                <span>-₹{displaySavings.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Shipping</span>
              <span className="font-semibold text-emerald-600">
                {displayShipping === 0 ? "FREE" : `₹${displayShipping}`}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <span className="font-black text-sm text-slate-900">
              Estimated Total
            </span>
            <span className="text-xl font-black text-slate-900">
              ₹{displayTotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="pt-2">
            {/* WhatsApp Checkout */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Order with Server...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>Checkout via WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
