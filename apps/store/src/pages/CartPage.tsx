import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Product, CustomerDetails, Address } from "@urbanrat/shared";
import { getUnitPrice, getNextTier, getColorHex } from "@urbanrat/shared";
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
  Lightbulb,
} from "lucide-react";
import { QuantityInput } from "../components/QuantityInput";
import { buildWhatsAppMessage } from "../utils/buildWhatsAppMessage";
import { createVerifiedOrder } from "../services/storeService";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { EmptyState } from "../components/EmptyState";
import { AddressPicker } from "../components/AddressPicker";
import { useCoupon } from "../hooks/useCoupon";
import { CouponInput, CouponSavingsRow } from "../components/coupon";

interface CartPageProps {
  cartItems: { product: Product; quantity: number; selectedColor?: string }[];
  onUpdateQuantity: (productId: string, quantity: number, selectedColor?: string) => void;
  onRemoveItem: (productId: string, selectedColor?: string) => void;
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
  const { user } = useAuth();
  const { t, isHindi } = useLanguage();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

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
  const [honeypot, setHoneypot] = useState("");

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
  const lineDetails = cartItems.map(({ product, quantity, selectedColor }) => {
    const tiers = product.price_tiers || [];
    const firstTierMin = tiers[0]?.min_qty;
    const minQty = Math.max(1, product.min_order_qty || firstTierMin || 1);
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
      selectedColor,
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

  // Coupon validation hook
  const couponItems = cartItems.map((item) => ({
    product_id: item.product.id,
    quantity: item.quantity,
  }));

  const coupon = useCoupon({
    items: couponItems,
    phone: customer.phone,
  });

  const freeDeliveryMin = settings?.free_delivery_min ?? 999;
  const standardShippingFee = settings?.shipping_fee ?? 49;
  const displayShipping = displaySubtotal >= freeDeliveryMin ? 0 : standardShippingFee;
  const couponDiscount = coupon.discountAmount || 0;
  const discountedSubtotal = Math.max(0, displaySubtotal - couponDiscount);
  const displayTotal = displaySubtotal + displayShipping;
  const finalEstimatedTotal = Math.max(0, discountedSubtotal + displayShipping);

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

    if (!user && !turnstileToken) {
      setErrorToast("Please complete the security verification challenge below");
      setTimeout(() => setErrorToast(null), 4000);
      setErrors(newErrors);
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCheckout() {
    if (isSubmitting) return;

    if (!validateForm()) {
      if (user || turnstileToken) {
        setErrorToast("Please fill in all required delivery details before proceeding");
        setTimeout(() => setErrorToast(null), 3500);
      }
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
        honeypot: honeypot.trim() ? honeypot.trim() : null,
        turnstile_token: user ? null : turnstileToken,
        couponCode: coupon.isApplied && coupon.code ? coupon.code : null,
      };

      // 1. Submit to server-verified order RPC
      const savedOrder = await createVerifiedOrder(verifiedInput);

      // 2. Clear cart after successful creation
      onClearCart();
      coupon.remove();

      // 3. Build WhatsApp message using SERVER-RETURNED totals, items and tracking token
      const targetPhone =
        whatsappNumber ||
        settings?.whatsapp_number?.trim() ||
        "";

      const orderPublicToken = (savedOrder as any).public_token || undefined;

      if (targetPhone) {
        const whatsappMessage = buildWhatsAppMessage({
          orderId: savedOrder.id,
          publicToken: orderPublicToken,
          items: (savedOrder.items || []).map((i: any, idx: number) => ({
            name: i.name || i.product?.name || cartItems[idx]?.product.name || "Item",
            price: i.unit_price ?? i.price ?? 0,
            quantity: i.quantity,
            selectedColor: cartItems[idx]?.selectedColor,
          })),
          subtotal: savedOrder.subtotal,
          savings: savedOrder.savings,
          shipping: savedOrder.shipping === 0 ? "FREE" : savedOrder.shipping,
          couponCode: (savedOrder as any).coupon_code || (savedOrder as any).couponCode || (coupon.isApplied ? coupon.code : null),
          discountAmount: (savedOrder as any).discount_amount ?? (savedOrder as any).discountAmount ?? (coupon.isApplied ? coupon.discountAmount : 0),
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
        window.open(whatsappCheckoutUrl, "_blank", "noopener,noreferrer");
      }

      // 4. Save to device guest orders history for seamless retrieval
      try {
        const existingRaw = localStorage.getItem("urt_guest_orders");
        const existingList: Array<{ id: string; token?: string; createdAt: string }> = existingRaw
          ? JSON.parse(existingRaw)
          : [];
        const updatedList = [
          { id: savedOrder.id, token: orderPublicToken, createdAt: new Date().toISOString() },
          ...existingList.filter((item) => item.id !== savedOrder.id),
        ].slice(0, 10);
        localStorage.setItem("urt_guest_orders", JSON.stringify(updatedList));
      } catch (storageErr) {
        console.warn("[Cart] Failed to cache guest order to localStorage:", storageErr);
      }

      // 5. Navigate to order confirmation page showing server total with tracking token
      const tokenParam = orderPublicToken ? `?t=${encodeURIComponent(orderPublicToken)}` : "";
      navigate(`/order/${savedOrder.id}${tokenParam}`);
    } catch (err: unknown) {
      const e = err as any;
      console.error("[Cart] Checkout order creation failed:", e);

      const isCouponInvalid =
        e?.code === "COUPON_INVALID" ||
        (typeof e?.message === "string" && e.message.includes("COUPON_INVALID"));

      if (isCouponInvalid) {
        // Drop coupon from state and sessionStorage so totals auto-recalculate
        coupon.remove();
        const displayMsg = e?.message
          ? e.message.replace(/^COUPON_INVALID:\s*/i, "")
          : "The applied coupon is invalid or has expired. Cart totals have been updated.";
        setErrorToast(displayMsg);
        setTimeout(() => setErrorToast(null), 6000);
      } else {
        setErrorToast(
          e?.message || "Failed to save order. Please check item stock and retry."
        );
        setTimeout(() => setErrorToast(null), 5000);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<ShoppingBag className="w-8 h-8 text-brand-dark" />}
          title={t("cart.empty_title")}
          description={t("cart.empty_desc")}
          actionText={t("cart.start_shopping")}
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {t("cart.title")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {cartItems.length}{" "}
            {cartItems.length === 1 ? t("cart.item_ready") : t("cart.items_ready")}
          </p>
        </div>

        <button
          type="button"
          onClick={onClearCart}
          className="text-xs font-bold text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition cursor-pointer"
        >
          {t("cart.clear_all")}
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
                selectedColor,
                minQty,
                step,
                unitPrice,
                firstTierPrice,
                lineTotal,
                lineSavings,
                nextTier,
              }) => (
                <div
                  key={`${product.id}-${selectedColor || "default"}`}
                  className="bg-white dark:bg-slate-900/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col space-y-2.5 transition-colors"
                >
                  <div className="flex items-start space-x-3.5 justify-between">
                    {/* Product Thumbnail */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 dark:bg-slate-800/80 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-700/80">
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
                        className="block font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 hover:text-brand-dark dark:hover:text-brand transition truncate"
                      >
                        {product.name}
                      </Link>

                      {selectedColor && (
                        <div className="mt-1 inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: getColorHex(selectedColor) }}
                          />
                          <span>{t("cart.color")}: {selectedColor}</span>
                        </div>
                      )}

                      {/* Live Unit Price & Strikethrough First-Tier Price */}
                      <div className="mt-1 flex items-baseline space-x-2">
                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                          ₹{unitPrice.toLocaleString("en-IN")}
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-normal">
                            /{t("product.per_pc")}
                          </span>
                        </span>
                        {firstTierPrice > unitPrice && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through">
                            ₹{firstTierPrice.toLocaleString("en-IN")}
                          </span>
                        )}
                        {lineSavings > 0 && (
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            {t("cart.saved")} ₹{lineSavings.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      {/* Quantity Stepper respecting min_order_qty & order_qty_step */}
                      <div className="mt-2.5 flex items-center space-x-3">
                        <QuantityInput
                          value={quantity}
                          onChange={(newQty) => onUpdateQuantity(product.id, newQty, selectedColor)}
                          onBelowMin={() => onRemoveItem(product.id, selectedColor)}
                          min={minQty}
                          max={settings?.max_order_qty || 500}
                          step={step}
                          size="sm"
                          ariaLabel={`Quantity for ${product.name}`}
                        />

                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          = ₹{lineTotal.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => onRemoveItem(product.id, selectedColor)}
                      aria-label="Remove item"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Nudge: Add N more to save */}
                  {nextTier && (
                    <div className="pt-1.5 border-t border-slate-100/60 dark:border-slate-800/60">
                      <div className="p-2 rounded-xl bg-sky-50 dark:bg-orange-950/30 border border-sky-100 dark:border-orange-500/30 text-[11px] font-semibold text-sky-800 dark:text-orange-200 flex items-center space-x-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                          {isHindi ? (
                            <>
                              ₹{nextTier.tier.unit_price.toLocaleString("en-IN")}/पीस दर के लिए{" "}
                              <strong>{nextTier.piecesNeeded} और</strong> जोड़ें
                            </>
                          ) : (
                            <>
                              Add <strong>{nextTier.piecesNeeded} more</strong> to get{" "}
                              <strong>
                                ₹{nextTier.tier.unit_price.toLocaleString("en-IN")}/pc
                              </strong>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Customer Delivery Details Form */}
          <div className="bg-white dark:bg-slate-900/90 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-orange-950/40 text-brand-dark dark:text-orange-400 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {t("cart.customer_title")}
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-400">
                  {t("cart.customer_sub")}
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
              {/* Bot Honeypot */}
              <input
                type="text"
                name="company_tax_id_ref"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden pointer-events-none select-none opacity-0 absolute left-[-9999px]"
              />

              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t("cart.full_name")} <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 dark:bg-slate-800/60 transition-colors ${
                    errors.name
                      ? "border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-950/30 ring-1 ring-rose-400 dark:ring-rose-500"
                      : "border-slate-200 dark:border-slate-700 focus-within:border-brand-dark dark:focus-within:border-brand focus-within:bg-white dark:focus-within:bg-slate-800"
                  }`}
                >
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => handleCustomerChange("name", e.target.value)}
                    placeholder={t("cart.full_name_placeholder")}
                    className="w-full text-xs font-medium text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t("cart.phone")} <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 dark:bg-slate-800/60 transition-colors ${
                    errors.phone
                      ? "border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-950/30 ring-1 ring-rose-400 dark:ring-rose-500"
                      : "border-slate-200 dark:border-slate-700 focus-within:border-brand-dark dark:focus-within:border-brand focus-within:bg-white dark:focus-within:bg-slate-800"
                  }`}
                >
                  <Phone className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={customer.phone}
                    maxLength={10}
                    onChange={(e) => handleCustomerChange("phone", e.target.value)}
                    placeholder={t("cart.phone_placeholder")}
                    className="w-full text-xs font-medium text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t("cart.address")} <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-start space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 dark:bg-slate-800/60 transition-colors ${
                    errors.address
                      ? "border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-950/30 ring-1 ring-rose-400 dark:ring-rose-500"
                      : "border-slate-200 dark:border-slate-700 focus-within:border-brand-dark dark:focus-within:border-brand focus-within:bg-white dark:focus-within:bg-slate-800"
                  }`}
                >
                  <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0 mt-0.5" />
                  <textarea
                    rows={2}
                    value={customer.address}
                    onChange={(e) => handleCustomerChange("address", e.target.value)}
                    placeholder={t("cart.address_placeholder")}
                    className="w-full text-xs font-medium text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
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
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {t("cart.pincode")} <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 dark:bg-slate-800/60 transition-colors ${
                    errors.pincode
                      ? "border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-950/30 ring-1 ring-rose-400 dark:ring-rose-500"
                      : "border-slate-200 dark:border-slate-700 focus-within:border-brand-dark dark:focus-within:border-brand focus-within:bg-white dark:focus-within:bg-slate-800"
                  }`}
                >
                  <Hash className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0" />
                  <input
                    type="text"
                    maxLength={6}
                    value={customer.pincode}
                    onChange={(e) => handleCustomerChange("pincode", e.target.value)}
                    placeholder={t("cart.pincode_placeholder")}
                    className="w-full text-xs font-medium text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
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

            {/* Coupon Code in Checkout / Customer Details Section */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <CouponInput
                onApply={coupon.apply}
                isLoading={coupon.isLoading}
                error={coupon.error}
                appliedCode={coupon.code}
                savedAmount={coupon.discountAmount}
                onRemove={coupon.remove}
              />
            </div>
          </div>
        </div>

        {/* Right: Order Summary Box (Display-only estimates) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 bg-white dark:bg-slate-900/90 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
          <div>
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
              {t("cart.order_summary")}
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">
              {t("cart.order_summary_sub")}
            </p>
          </div>

          {/* Coupon Input in Order Summary */}
          <CouponInput
            onApply={coupon.apply}
            isLoading={coupon.isLoading}
            error={coupon.error}
            appliedCode={coupon.code}
            savedAmount={coupon.discountAmount}
            onRemove={coupon.remove}
          />

          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex justify-between">
              <span>{t("cart.items_subtotal")}</span>
              <span className="font-bold text-slate-900 dark:text-white">
                ₹{displaySubtotal.toLocaleString("en-IN")}
              </span>
            </div>

            {displaySavings > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>{t("cart.margin_savings")}</span>
                <span>-₹{displaySavings.toLocaleString("en-IN")}</span>
              </div>
            )}

            {coupon.isApplied && coupon.discountAmount > 0 && (
              <CouponSavingsRow
                code={coupon.code}
                discountAmount={coupon.discountAmount}
              />
            )}

            <div className="flex justify-between">
              <span>{t("cart.shipping")}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {displayShipping === 0 ? t("cart.free") : `₹${displayShipping}`}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <span className="font-black text-sm text-slate-900 dark:text-white">
              {t("cart.estimated_total")}
            </span>
            <div className="flex items-baseline space-x-2 text-right">
              {coupon.isApplied && coupon.discountAmount > 0 && (
                <span className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 line-through decoration-danger/60 font-semibold">
                  ₹{displayTotal.toLocaleString("en-IN")}
                </span>
              )}
              <span className="text-xl font-black text-slate-900 dark:text-white">
                ₹{finalEstimatedTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            {/* Cloudflare Turnstile Verification for Guest Checkout */}
            {!user && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col items-center">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 self-start">
                  {t("cart.security_check")} <span className="text-rose-500">*</span>
                </p>
                <TurnstileWidget
                  onVerify={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            {/* WhatsApp Checkout (Keeps WhatsApp green as intentional exception) */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] active:bg-[#1da851] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm sm:text-base shadow-xs focus-visible:ring-2 ring-emerald-500 ring-offset-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("cart.verifying")}</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>{t("cart.checkout_whatsapp")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
