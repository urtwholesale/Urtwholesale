import { useState, useEffect } from "react";
import { Link } from "react-router";
import type { Product, CustomerDetails } from "@urbanrat/shared";
import {
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  MessageCircle,
  User,
  Phone,
  MapPin,
  Hash,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { buildWhatsAppMessage } from "../utils/buildWhatsAppMessage";
import {
  generateUniqueOrderId,
  createVerifiedOrder,
  fetchStoreSettings,
} from "../services/storeService";

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

  const [whatsappNumber, setWhatsappNumber] = useState("917000947033");

  // Load dynamic WhatsApp number from store_settings
  useEffect(() => {
    fetchStoreSettings().then((s) => {
      if (s.whatsapp_number) setWhatsappNumber(s.whatsapp_number);
    });
  }, []);

  type FormErrors = Partial<Record<keyof CustomerDetails, string>>;

  const [errors, setErrors] = useState<FormErrors>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const totalMRP = cartItems.reduce(
    (sum, item) => sum + (item.product.mrp || item.product.price) * item.quantity,
    0
  );

  const totalDiscount = Math.max(0, totalMRP - subtotal);

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
    const newErrors: {
      name?: string;
      phone?: string;
      address?: string;
      pincode?: string;
    } = {};

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

  async function handleWhatsAppCheckout() {
    if (isSubmitting) return;

    if (!validateForm()) {
      setErrorToast("Please fill in all required delivery details before proceeding");
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }

    setIsSubmitting(true);
    setErrorToast(null);

    try {
      // 1. Generate unique collision-checked order ID
      const orderId = await generateUniqueOrderId();
      const cleanPhone = customer.phone.replace(/\D/g, "");

      // 2. Build verified order input with product_id & quantity (server calculates true price)
      const verifiedInput = {
        id: orderId,
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

      // 3. Save order to database with server-verified prices via RPC
      const savedOrder = await createVerifiedOrder(verifiedInput);

      // 4. Build WhatsApp message with real orderId and orderUrl
      const origin = window.location.origin;
      const orderUrl = `${origin}/order/${savedOrder.id}`;

      const whatsappMessage = buildWhatsAppMessage({
        orderId: savedOrder.id,
        items: (savedOrder.items && savedOrder.items.length > 0) ? savedOrder.items : cartItems,
        subtotal: savedOrder.subtotal ?? subtotal,
        savings: savedOrder.savings ?? totalDiscount,
        shipping: savedOrder.shipping === 0 ? "FREE" : savedOrder.shipping,
        total: savedOrder.total ?? subtotal,
        customer: {
          name: customer.name.trim(),
          phone: cleanPhone,
          address: `${customer.address.trim()}, PIN: ${customer.pincode.trim()}`,
        },
        orderUrl,
      });

      // 5. Open WhatsApp with properly formatted message
      const whatsappCheckoutUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        whatsappMessage
      )}`;

      window.open(whatsappCheckoutUrl, "_blank");

      // 6. Clear cart after successful checkout
      onClearCart();
    } catch (err: unknown) {
      const e = err as Error;
      console.error("[Cart] Checkout order creation failed:", e);
      setErrorToast(e?.message || "Failed to save order. Please check your network and try again.");
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm max-w-md mx-auto my-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Your Cart is Empty</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Explore our wholesale catalog of tempered glass, chargers, and cables.
        </p>
        <Link
          to="/marketplace"
          className="mt-5 inline-flex items-center space-x-2 py-2.5 px-6 rounded-2xl text-white font-semibold text-xs shadow-md transition active:scale-95"
          style={{
            background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
          }}
        >
          <span>Start Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Floating Error Toast */}
      {errorToast && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-semibold text-white shadow-lg bg-rose-600 flex items-center space-x-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {cartItems.length} {cartItems.length === 1 ? "item" : "items"} ready for dispatch
          </p>
        </div>

        <button
          onClick={onClearCart}
          className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition cursor-pointer"
        >
          Clear All
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Cart items list + Customer Details Form */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-5">
          {/* Cart items list */}
          <div className="space-y-3">
            {cartItems.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 border border-slate-100 shadow-xs flex items-center space-x-3.5 justify-between"
              >
                {/* Product Thumbnail */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                  <img
                    src={product.images[0] || ""}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Title & Price */}
                <div className="flex-1 min-w-0 pr-2">
                  <Link
                    to={`/product/${product.slug}`}
                    className="block font-semibold text-xs sm:text-sm text-slate-800 hover:text-[#0A82A8] transition truncate"
                  >
                    {product.name}
                  </Link>

                  <div className="mt-1 flex items-baseline space-x-2">
                    <span className="font-bold text-sm sm:text-base text-slate-900">
                      ₹{product.price.toLocaleString("en-IN")}
                    </span>
                    {product.mrp && product.mrp > product.price && (
                      <span className="text-[11px] text-slate-400 line-through">
                        ₹{product.mrp.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  {/* Quantity Stepper */}
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                      <button
                        onClick={() => onUpdateQuantity(product.id, quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-slate-800">
                        {quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(product.id, quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-[11px] font-semibold text-slate-600">
                      = ₹{(product.price * quantity).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => onRemoveItem(product.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Customer Delivery Details Form */}
          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-[#0A82A8] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Customer &amp; Delivery Details
                </h2>
                <p className="text-[11px] text-slate-400">
                  Required for WhatsApp order confirmation &amp; wholesale dispatch
                </p>
              </div>
            </div>

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
                      : "border-slate-200 focus-within:border-[#0A82A8] focus-within:bg-white"
                  }`}
                >
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(e) => handleCustomerChange("name", e.target.value)}
                    placeholder="Enter your name"
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
                      : "border-slate-200 focus-within:border-[#0A82A8] focus-within:bg-white"
                  }`}
                >
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-400 select-none">+91</span>
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
                      : "border-slate-200 focus-within:border-[#0A82A8] focus-within:bg-white"
                  }`}
                >
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <textarea
                    rows={2}
                    value={customer.address}
                    onChange={(e) => handleCustomerChange("address", e.target.value)}
                    placeholder="Shop / House No., Street, Market / Landmark, City, State"
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
                  PIN Code <span className="text-rose-500">*</span>
                </label>
                <div
                  className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl border bg-slate-50/70 transition-colors ${
                    errors.pincode
                      ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-400"
                      : "border-slate-200 focus-within:border-[#0A82A8] focus-within:bg-white"
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

        {/* Right: Order Summary Box */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
          <h2 className="font-bold text-base text-slate-900">Order Summary</h2>

          <div className="space-y-2 text-xs text-slate-600 border-b border-slate-100 pb-3">
            <div className="flex justify-between">
              <span>Item Subtotal</span>
              <span className="font-semibold text-slate-800">
                ₹{subtotal.toLocaleString("en-IN")}
              </span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Wholesale Margin Savings</span>
                <span className="font-semibold">
                  -₹{totalDiscount.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Standard Shipping</span>
              <span className="font-semibold text-emerald-600">FREE</span>
            </div>
          </div>

          <div className="flex justify-between items-baseline pt-1">
            <span className="font-bold text-sm text-slate-900">Total Payable</span>
            <span className="text-xl font-black text-slate-900">
              ₹{subtotal.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleWhatsAppCheckout}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Order...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-4.5 h-4.5" />
                  <span>Checkout via WhatsApp</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="w-full py-3 px-4 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-md transition active:scale-[0.99] cursor-pointer"
              style={{
                background: "linear-gradient(to bottom, #5ADBE5, #0A82A8)",
              }}
            >
              Proceed to Direct Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
