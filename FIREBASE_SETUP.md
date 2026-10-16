# Firebase setup

The site uses Firebase Authentication and Cloud Firestore for account data. Customers must sign in before checkout so every order is saved to Firestore and can be managed by the store administrator.

## Current Firebase connection

- Project: **Elitehub** (`elitehub-f33fd`)
- Web app: **Elitehub Web App**; its Firebase configuration is in `js/config.js`.
- Authentication: **Email/Password** and **Google** providers are enabled. The current storefront sign-in pages use Email/Password.
- Cloud Firestore: the default database is in **Mumbai** (`asia-south1`), created in production mode.
- Orders and per-customization Storage paths are saved in Firestore, whose live subscriptions keep the admin and account views updated. Uploaded GLB files stay as binary objects in Firebase Storage, where resumable uploads preserve the original bytes. Realtime Database is not used for this flow because it stores JSON data rather than file objects.
- Firestore rules: deploy the rules in `firestore.rules`. Customers can access their own profile and orders. The verified administrator email configured in `js/config.js` can list all orders and update only fulfillment and tracking fields.
- Authorized domains: `localhost`, `elitehub-f33fd.firebaseapp.com`, and `elitehub-f33fd.web.app`.

If a custom domain is connected to Firebase Hosting later, add that domain under **Authentication → Settings → Authorized domains**.

- Firebase Storage rules are defined in storage.rules. Apply them with firebase deploy --only storage before accepting original uploaded model files.

## Sign-in troubleshooting

If sign-in reports `auth/api-key-not-valid`, copy the complete web app configuration again from **Project settings → General → Your apps** into `js/config.js`. Check that the API key is active and that its API restrictions allow Firebase Authentication (Identity Toolkit). Do not replace it with a guessed key.

Only the Firebase web app configuration belongs in the browser. The administrator email is not a secret; access is enforced by Firestore rules and requires a verified Firebase Authentication account. Keep the email in `js/config.js` and the `isAdmin()` rule in `firestore.rules` in sync.

## Order management

- Open `/admin.html` to sign in with the configured administrator account, review customer details and order items, and update order status, carrier, tracking number and HTTPS tracking link.
- Customers must use an account before checkout. Create one with the configured administrator email if needed, then verify that email in **Firebase Console → Authentication → Users** before accessing the admin page.
- Customers see saved fulfillment and tracking changes in **My Orders** after refreshing their account page.
- The account page subscribes to the signed-in customer's Firestore orders, so administrator changes to status or tracking details appear there automatically while the page is open.
- Customers can cancel their own orders while the status is **Placed**, **Payment pending**, **Paid**, or **Processing**. Once an order is **Shipped** or **Delivered**, the customer must contact support instead. Cancellation is terminal and cannot be undone.
- Cancellation does not automatically refund online payments. Paid-order refunds must be handled separately by the store.
- Orders placed before this change by guests exist only in that guest's browser and cannot be recovered into Firestore by the admin page.
- Netlify publishes the static website but does not deploy Firestore security rules. Publish `firestore.rules` separately from the Firebase Console (**Firestore Database → Rules**) or with the Firebase CLI.

## Deploy with Firebase Hosting

Install the Firebase CLI if it is not already available, then run these commands from this folder to deploy the storefront and Firestore rules:

```powershell
firebase login
firebase use --add
firebase deploy
```

When `firebase use --add` asks for a project, choose the project that owns the Web app configuration. `firebase.json` deploys the static storefront and Firestore rules together when using Firebase Hosting. For a Netlify-hosted site, deploy only the rules with:

```powershell
firebase deploy --only firestore:rules
```

## What is synced

- Account sign-up, sign-in, sign-out and password reset use Firebase Authentication.
- Dedicated sign-in and account creation screens are available at `login.html` and `signup.html`.
- Saved delivery details are stored in `users/{uid}`.
- Orders are stored in `users/{uid}/orders/{orderId}` and loaded into My Orders on another device.
- Signed-in 3D previews and purchased customizations are stored in each account. Firebase Storage keeps the generated mockup, the original uploaded 3D file, design/order details and preview; Firestore keeps product choices, the original filename and asset paths.
- My Orders and the administrator order page provide download links for the original uploaded model, generated mockup and design details. If a local copy is unavailable, the account downloads files from Firebase Storage.
- Saved guest profiles remain local to the browser; checkout requires a signed-in account.
- Unsynced guest previews and working design files stay in browser storage. Large mockup assets are stored in Firebase Storage rather than embedded in Firestore documents.
