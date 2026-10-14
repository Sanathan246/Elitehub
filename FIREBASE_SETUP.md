# Firebase setup

The site uses Firebase Authentication and Cloud Firestore for account data. Guest profiles and orders continue to work in browser storage.

## Current Firebase connection

- Project: **Elitehub** (`elitehub-f33fd`)
- Web app: **Elitehub Web App**; its Firebase configuration is in `js/config.js`.
- Authentication: **Email/Password** and **Google** providers are enabled. The current storefront sign-in pages use Email/Password.
- Cloud Firestore: the default database is in **Mumbai** (`asia-south1`), created in production mode.
- Firestore rules: the published rules match `firestore.rules`. Signed-in users can access only their own profile and orders; all other documents are denied.
- Authorized domains: `localhost`, `elitehub-f33fd.firebaseapp.com`, and `elitehub-f33fd.web.app`.

If a custom domain is connected to Firebase Hosting later, add that domain under **Authentication → Settings → Authorized domains**.

## Sign-in troubleshooting

If sign-in reports `auth/api-key-not-valid`, copy the complete web app configuration again from **Project settings → General → Your apps** into `js/config.js`. Check that the API key is active and that its API restrictions allow Firebase Authentication (Identity Toolkit). Do not replace it with a guessed key.

Only the web app configuration belongs in the browser. The Firestore rules in `firestore.rules` restrict profiles and orders to their authenticated owner.

## Deploy with Firebase Hosting

Install the Firebase CLI if it is not already available, then run these commands from this folder to deploy the storefront and Firestore rules:

```powershell
firebase login
firebase use --add
firebase deploy
```

When `firebase use --add` asks for a project, choose the project that owns the Web app configuration. `firebase.json` deploys the static storefront and the Firestore rules together.

## What is synced

- Account sign-up, sign-in, sign-out and password reset use Firebase Authentication.
- Dedicated sign-in and account creation screens are available at `login.html` and `signup.html`.
- Saved delivery details are stored in `users/{uid}`.
- Signed-in orders are stored in `users/{uid}/orders/{orderId}` and loaded into My Orders on another device.
- Guest profiles and orders remain local until the customer signs in.
- Custom preview images and local design files stay in browser storage so large image data is not written into Firestore.
