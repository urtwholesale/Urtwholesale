/**
 * Category & Subcategory Hindi Translations Mapping
 * Dynamically maps common mobile accessories catalog categories to clean Hindi terms.
 */

export const HINDI_CATEGORY_MAP: Record<string, string> = {
  all: "सभी उत्पाद",
  "all products": "सभी उत्पाद",
  cables: "केबल्स एवं कॉर्ड्स",
  "cables & cords": "केबल्स एवं कॉर्ड्स",
  cable: "केबल्स",
  chargers: "मोबाइल चार्जर",
  "mobile chargers": "मोबाइल चार्जर",
  "mobile charger": "मोबाइल चार्जर",
  "buds & tws": "बड्स एवं TWS",
  "buds-tws": "बड्स एवं TWS",
  tws: "बड्स एवं TWS",
  neckbands: "नेकबैंड्स",
  neckband: "नेकबैंड्स",
  speakers: "स्पीकर्स एवं ऑडियो",
  speaker: "स्पीकर्स",
  audio: "स्पीकर्स एवं ऑडियो",
  "tempered glass": "टेम्पर्ड ग्लास",
  "tempered glass & uv glass": "टेम्पर्ड ग्लास एवं UV",
  "tempered-glass": "टेम्पर्ड ग्लास",
  "power banks": "पावर बैंक",
  "power-banks": "पावर बैंक",
  "power bank": "पावर बैंक",
  watches: "स्मार्ट वॉच",
  "smart watches": "स्मार्ट वॉच",
  watch: "स्मार्ट वॉच",
  "otg connectors": "OTG कनेक्टर्स",
  "otg-connectors": "OTG कनेक्टर्स",
  otg: "OTG कनेक्टर्स",
  "mobile holders & stand": "मोबाइल होल्डर एवं स्टैंड",
  "mobile-holders-stand": "मोबाइल होल्डर एवं स्टैंड",
  stand: "मोबाइल होल्डर एवं स्टैंड",
  battery: "मोबाइल बैटरी",
  batteries: "मोबाइल बैटरी",
  earphones: "वायर्ड ईयरफ़ोन",
  earphone: "वायर्ड ईयरफ़ोन",
  "single usb charger": "सिंगल USB चार्जर",
  "double usb chargers": "डबल USB चार्जर",
  "3.5 mm jack earphone": "3.5mm जैक ईयरफ़ोन",
  "type c earphones": "टाइप-C ईयरफ़ोन",
  "type-c earphones": "टाइप-C ईयरफ़ोन",
  "mini speakers": "मिनी स्पीकर्स",
  "super x": "सुपर X सीरीज",
  "type-c otg connectors": "टाइप-C OTG",
};

export function translateCategoryName(name: string, isHindi: boolean): string {
  if (!isHindi || !name) return name;
  const key = name.toLowerCase().trim();
  return HINDI_CATEGORY_MAP[key] || name;
}

export function translateSpecHighlight(spec: string, isHindi: boolean): string {
  if (!isHindi || !spec) return spec;
  const s = spec.trim();
  if (s.includes("120W")) return "120W टर्बो चार्ज";
  if (s.includes("100W")) return "100W PD फ़ास्ट";
  if (s.includes("65W")) return "65W GaN फ़ास्ट";
  if (s.includes("45W")) return "45W सुपर फ़ास्ट";
  if (s.includes("33W") || s.includes("30W")) return "33W टर्बो फ़ास्ट";
  if (s.includes("20W")) return "20W PD फ़ास्ट";
  if (s.includes("40 Hours")) return "40 घंटे प्लेबैक";
  if (s.includes("60 Hrs") || s.includes("60 Hours")) return "60 घंटे प्लेबैक";
  if (s.includes("120 Hours")) return "120 घंटे प्लेबैक";
  if (s.includes("10W RMS")) return "10W RMS साउंड";
  if (s.includes("9H Diamond") || s.includes("9H")) return "9H डायमंड हार्डनेस";
  if (s.includes("10000mAh")) return "10000mAh बैटरी";
  if (s.includes("BT Calling")) return "BT कॉलिंग";
  if (s.includes("5Gbps")) return "5Gbps हाई स्पीड";
  if (s.includes("360°")) return "360° मेटल आर्म";
  if (s.includes("Kevlar")) return "केवलर ब्रेडेड";
  if (s.includes("Wholesale Grade")) return "थोक ग्रेड";
  if (s.includes("12M Warranty") || s.includes("12 Months")) return "12 माह वारंटी";
  if (s.includes("6M Warranty") || s.includes("6 Months")) return "6 माह वारंटी";
  if (s.includes("1M Warranty") || s.includes("1 Month")) return "1 माह वारंटी";
  if (s.includes("Warranty")) return s.replace(/(\d+)M\s+Warranty/i, "$1 माह वारंटी");
  return s;
}

export function translateBadgeText(text: string, isHindi: boolean): string {
  if (!isHindi || !text) return text;
  const t = text.trim();
  if (t === "Best Seller") return "बेस्ट सेलर";
  if (t === "New Launch") return "नया लॉन्च";
  if (t === "URT Original") return "URT ओरिजिनल";
  if (t === "1-Yr Warranty") return "1 वर्ष वारंटी";
  if (t === "Express Dispatch") return "फ़ास्ट डिस्पैच";
  if (t.includes("EXTRA") && t.includes("OFF")) {
    return t.replace(/EXTRA\s+(\d+)%\s+OFF/i, "अतिरिक्त $1% छूट");
  }
  return t;
}

