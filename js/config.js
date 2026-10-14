/* =====================================================================
   EliteHub — Store settings
   Edit the values below to connect the website to your business.
   Everything else on the site reads from this one file.
   ===================================================================== */
   // For Firebase JS SDK v7.20.0 and later, measurementId is optional


window.EH_CONFIG = {
  brandName: "EliteHub",
  tagline: "Luxury Customizations",
  currency: "₹",

  /* --- Contact details (shown on the Contact page & footer) --- */
  email: "hello@elitehub.in",            // TODO: your business email
  phone: "+91 00000 00000",              // TODO: your phone number (display format)
  address: "India",                      // TODO: city / studio address
  hours: "Mon – Sat, 10:00 AM – 7:00 PM",

  /* --- WhatsApp orders ---
     Country code + number, digits only. Example: "919876543210".
     When set, customers can send their order & enquiries straight to your WhatsApp,
     and a floating chat button appears on every page. */
  whatsappNumber: "",

  /* --- Firebase account storage ---
     Keep these values in sync with the EliteHub Web app in Firebase Console.
     Firebase Authentication stores passwords securely; this site never stores them. */
  firebase: {
    apiKey:"AIzaSyD8KIvL---5jhf8Xlpon6RPlVCPB50gnyk",
    authDomain: "elitehub-f33fd.firebaseapp.com",
    projectId: "elitehub-f33fd",
    storageBucket: "elitehub-f33fd.firebasestorage.app",
    messagingSenderId: "46946688789",
    appId: "1:46946688789:web:5d93a71294514c6675d31c",
    measurementId: "G-05GPQ5ZGQC"
  },
  adminEmail: "devildosti246@gmail.com",

  /* --- Email notifications (free) ---
     Get a free access key at https://web3forms.com (enter your email, copy the key).
     When set, every order, contact message and newsletter sign-up is emailed to you. */
  web3formsKey: "",

  /* --- Online payments (optional) ---
     Your Razorpay Key ID (starts with rzp_live_ or rzp_test_). When set,
     "Pay Online (UPI / Cards / Netbanking)" appears at checkout. */
  razorpayKeyId: "",

  /* --- Shipping & offers --- */
  freeShippingThreshold: 999,   // orders at or above this get free shipping
  shippingFee: 79,              // shipping charged below the threshold
  codEnabled: true,             // allow Cash on Delivery
  codFee: 0,                    // extra charge for COD (0 = none)
  coupons: {
    ELITE10:    { type: "percent", value: 10,  label: "10% off your order" },
    WELCOME100: { type: "flat",    value: 100, minOrder: 799, label: "₹100 off on orders above ₹799" }
  },

  /* --- Policies (shown on product pages & FAQ) --- */
  shippingInfo: "Every order is printed fresh for you within 2–4 business days and delivered in 4–7 business days. Free shipping on orders of ₹999 and above.",
  returnsInfo: "Not happy? Ready-made designs can be returned or exchanged within 7 days of delivery. Custom-designed products are made just for you, so they can be replaced only if they arrive damaged or misprinted.",

  /* --- Hero image (optional) ---
     Put a photo in the assets folder and enter its path, e.g. "assets/hero.jpg".
     Leave "" to show the built-in EliteHub tee artwork. */
  heroImage: "",

  /* --- Social links (leave "" to hide an icon) --- */
  social: {
    instagram: "https://instagram.com/",
    youtube: "https://youtube.com/",
    pinterest: "https://pinterest.com/",
    x: "https://x.com/"
  }
};
