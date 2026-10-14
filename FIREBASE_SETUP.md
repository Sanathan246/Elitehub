# Firebase setup

The site uses Firebase Authentication and Cloud Firestore for account data. Customers must sign in before checkout so every order is saved to Firestore and can be managed by the store administrator.

## Current Firebase connection

- Project: **Elitehub** (`elitehub-f33fd`)
- Web app: **Elitehub Web App**; its Firebase configuration is in `js/config.js`.
- Authentication: **Email/Password** and **Google** providers are enabled. The current storefront sign-in pages use Email/Password.
- Cloud Firestore: the default database is in **Mumbai** (`asia-south1`), created in production mode.
- Firestore rules: deploy the rules in `firestore.rules`. Customers can access their own profile and orders. The verified administrator email configured in `js/config.js` can list all orders and update only fulfillment and tracking fields.
- Authorized domains: `localhost`, `elitehub-f33fd.firebaseapp.com`, and `elitehub-f33fd.web.app`.

If a custom domain is connected to Firebase Hosting later, add that domain under **Authentication → Settings → Authorized domains**.

## Sign-in troubleshooting

If sign-in reports `auth/api-key-not-valid`, copy the complete web app configuration again from **Project settings → General → Your apps** into `js/config.js`. Check that the API key is active and that its API restrictions allow Firebase Authentication (Identity Toolkit). Do not replace it with a guessed key.

Only the Firebase web app configuration belongs in the browser. The administrator email is not a secret; access is enforced by Firestore rules and requires a verified Firebase Authentication account. Keep the email in `js/config.js` and the `isAdmin()` rule in `firestore.rules` in sync.

## Order management

- Open `/admin.html` to sign in with the configured administrator account, review customer details and order items, and update order status, carrier, tracking number and HTTPS tracking link.
- Customers must use an account before checkout. Create one with the configured administrator email if needed, then verify that email in **Firebase Console → Authentication → Users** before accessing the admin page.
- Customers see saved fulfillment and tracking changes in **My Orders** after refreshing their account page.
- The account page subscribes to the signed-in customer's Firestore orders, so administrator changes to status or tracking details appear there automatically while the page is open.
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
- Saved guest profiles remain local to the browser; checkout requires a signed-in account.
- Custom preview images and local design files stay in browser storage so large image data is not written into Firestore.
