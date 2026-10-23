import type { Order, StoreSettings } from "@urbanrat/shared";

/**
 * Generates and triggers browser print/PDF download for a professional GST Wholesale Tax Invoice
 */
export function printOrderInvoice(order: Order, settings?: StoreSettings | null): void {
  const invoiceWindow = window.open("", "_blank");
  if (!invoiceWindow) {
    alert("Please allow popups to view and download the invoice.");
    return;
  }

  const invoiceNumber = `INV-${order.id}`;
  const invoiceDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const storeName = settings?.store_name || settings?.store_info?.name || "URT Wholesale (Urbanrat Technologies)";
  const storePhone = settings?.whatsapp_number ? `+${settings.whatsapp_number}` : "+91 99999 99999";
  const storeEmail = "support@urtwholesale.com";
  const storeGstin = "27AAPFU0939F1ZV"; // Urbanrat primary wholesale GSTIN

  const customerName = order.customer?.name || "Valued Wholesale Customer";
  const customerPhone = order.customer?.phone || "N/A";
  const customerAddress = order.customer?.address || "Address on file";
  const customerPincode = order.customer?.pincode ? `PIN: ${order.customer.pincode}` : "";
  const customerBusiness = order.customer?.business_name ? `<b>${order.customer.business_name}</b><br/>` : "";
  const customerGstin = order.customer?.gstin ? `GSTIN: <b>${order.customer.gstin}</b><br/>` : "";

  const subtotal = order.subtotal || order.total;
  const savings = order.savings || 0;
  const shipping = order.shipping || 0;
  const total = order.total;

  // Approximate GST (Wholesale items: 18% GST included / broken down: 9% CGST + 9% SGST)
  const taxableBase = Math.round((subtotal / 1.18) * 100) / 100;
  const gstAmount = Math.round((subtotal - taxableBase) * 100) / 100;
  const cgst = Math.round((gstAmount / 2) * 100) / 100;
  const sgst = Math.round((gstAmount / 2) * 100) / 100;

  const itemsHtml = order.items
    .map((item, index) => {
      const unitPrice = item.unit_price || item.price || 0;
      const lineTotal = item.line_total || unitPrice * item.quantity;
      const tierBadge = item.tier_min_qty
        ? `<span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Tier (${item.tier_min_qty}+ pcs)</span>`
        : "";

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 8px; text-align: center; color: #64748b; font-size: 12px;">${index + 1}</td>
          <td style="padding: 10px 8px;">
            <div style="font-weight: 600; font-size: 13px; color: #1e293b;">${item.name}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              ${item.sku ? `SKU: <b>${item.sku}</b> &bull; ` : ""}${tierBadge}
            </div>
          </td>
          <td style="padding: 10px 8px; text-align: center; font-weight: 600; font-size: 13px;">${item.quantity}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 13px;">₹${unitPrice.toLocaleString("en-IN")}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">₹${lineTotal.toLocaleString("en-IN")}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Tax Invoice - ${order.id}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 24px;
          background: #ffffff;
        }
        .invoice-card {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        @media print {
          body { padding: 0; }
          .invoice-card { border: none; box-shadow: none; padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="max-width: 800px; margin: 0 auto 16px; text-align: right;">
        <button onclick="window.print()" style="background: #0A82A8; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 13px;">
          Print / Save as PDF
        </button>
      </div>

      <div class="invoice-card">
        <!-- Header -->
        <table style="width: 100%; border-bottom: 2px solid #0A82A8; padding-bottom: 20px;">
          <tr>
            <td style="vertical-align: top;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0A82A8; letter-spacing: -0.5px;">${storeName}</h1>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Wholesale Mobile Accessories &amp; Bulk Hardware Supply</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: #475569;">
                GSTIN: <b>${storeGstin}</b><br/>
                Email: ${storeEmail} &bull; Helpdesk: ${storePhone}
              </p>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div style="display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 12px; font-weight: 800; padding: 4px 12px; border-radius: 6px; text-transform: uppercase;">
                TAX INVOICE
              </div>
              <div style="margin-top: 8px; font-size: 13px; font-weight: 700; color: #1e293b;">
                Invoice #: ${invoiceNumber}
              </div>
              <div style="font-size: 12px; color: #64748b;">
                Order ID: #${order.id}
              </div>
              <div style="font-size: 12px; color: #64748b;">
                Date: ${invoiceDate}
              </div>
            </td>
          </tr>
        </table>

        <!-- Billed & Shipped To -->
        <table style="width: 100%; margin-top: 24px; font-size: 12px; line-height: 1.5;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 16px;">
              <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px;">
                Billed &amp; Shipped To:
              </div>
              <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${customerName}</div>
              ${customerBusiness}
              ${customerGstin}
              <div style="color: #475569; margin-top: 2px;">
                Phone: <b>+91 ${customerPhone}</b><br/>
                ${customerAddress}<br/>
                <b>${customerPincode}</b>
              </div>
            </td>
            <td style="width: 50%; vertical-align: top; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px;">
                Order Information:
              </div>
              <div style="font-size: 12px; color: #334155;">
                Order Status: <b style="text-transform: capitalize; color: #0A82A8;">${order.status}</b><br/>
                Dispatch Mode: <b>Tier-1 Cargo / SafeXpress / Delhivery</b><br/>
                Payment Status: <b>Wholesale Verified (COD / Net Terms)</b>
              </div>
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 28px;">
          <thead>
            <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569;">#</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569;">Item Description</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569;">Qty</th>
              <th style="padding: 10px 8px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569;">Tier Unit Price</th>
              <th style="padding: 10px 8px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Summary -->
        <table style="width: 100%; margin-top: 20px;">
          <tr>
            <td style="width: 55%; vertical-align: top; font-size: 11px; color: #64748b; padding-right: 20px;">
              <div style="font-weight: 700; color: #334155; margin-bottom: 4px;">Terms &amp; Declarations:</div>
              <p style="margin: 0; line-height: 1.4;">
                1. Goods once sold are covered under the Urbanrat 1-Year Wholesale Replacement Warranty against manufacturing defects.<br/>
                2. Immediate replacement for DOA (Dead On Arrival) items reported within 48 hours of delivery.<br/>
                3. This is an electronically generated GST tax invoice.
              </p>
            </td>
            <td style="width: 45%; vertical-align: top;">
              <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Taxable Base:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${taxableBase.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">CGST (9%):</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${cgst.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">SGST (9%):</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${sgst.toLocaleString("en-IN")}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Subtotal (Incl. GST):</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600;">₹${subtotal.toLocaleString("en-IN")}</td>
                </tr>
                ${
                  savings > 0
                    ? `<tr>
                        <td style="padding: 4px 0; color: #16a34a; font-weight: 600;">Wholesale Tier Savings:</td>
                        <td style="padding: 4px 0; text-align: right; color: #16a34a; font-weight: 700;">-₹${savings.toLocaleString("en-IN")}</td>
                      </tr>`
                    : ""
                }
                <tr>
                  <td style="padding: 4px 0; color: #64748b;">Shipping / Freight:</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600;">
                    ${shipping === 0 ? '<span style="color: #16a34a;">FREE (Bulk Order)</span>' : `₹${shipping.toLocaleString("en-IN")}`}
                  </td>
                </tr>
                <tr style="border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                  <td style="padding: 8px 0; font-size: 15px; font-weight: 900; color: #0f172a;">Total Invoice Value:</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 16px; font-weight: 900; color: #0A82A8;">
                    ₹${total.toLocaleString("en-IN")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Signatory Footer -->
        <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #64748b;">
          <div>
            Thank you for ordering with <b>${storeName}</b>!
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 30px;">For ${storeName}</div>
            <div style="border-top: 1px solid #94a3b8; width: 140px; display: inline-block;">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  invoiceWindow.document.open();
  invoiceWindow.document.write(html);
  invoiceWindow.document.close();
}
