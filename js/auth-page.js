/* EliteHub - dedicated Firebase sign-in and sign-up pages */
(function () {
  const mode = document.body.dataset.authMode === 'signup' ? 'signup' : 'login';
  const form = document.getElementById('authPageForm');
  if (!form) return;

  const nameInput = document.getElementById('authPageName');
  const emailInput = document.getElementById('authPageEmail');
  const passwordInput = document.getElementById('authPagePassword');
  const confirmInput = document.getElementById('authPageConfirm');
  const submitButton = document.getElementById('authPageSubmit');
  const resetButton = document.getElementById('authPageReset');
  const note = document.getElementById('authPageNote');
  const session = document.getElementById('authPageSession');
  const sessionUser = document.getElementById('authPageUser');
  const signOutButton = document.getElementById('authPageSignOut');
  const googleWrap = document.getElementById('authGoogleWrap');
  const googleButton = document.getElementById('googleSignIn');
  let firebaseApi = null;
  let busy = false;

  const setNote = (message, type = '') => {
    note.textContent = message || '';
    note.className = `form-note${type ? ` ${type}` : ''}`;
  };

  const setFieldState = (input, valid) => {
    if (!input) return;
    const field = input.closest('.field');
    field.classList.toggle('invalid', !valid);
    input.setAttribute('aria-invalid', String(!valid));
  };

  const validate = () => {
    const checks = [];
    if (mode === 'signup') checks.push([nameInput, nameInput.value.trim().length >= 2]);
    checks.push([emailInput, EH.validEmail(emailInput.value.trim())]);
    checks.push([passwordInput, passwordInput.value.length >= 6]);
    if (mode === 'signup') checks.push([confirmInput, confirmInput.value.length >= 6 && confirmInput.value === passwordInput.value]);
    checks.forEach(([input, valid]) => setFieldState(input, valid));
    return { valid: checks.every(([, valid]) => valid), first: checks.find(([, valid]) => !valid)?.[0] || null };
  };

  const setBusy = (value) => {
    busy = value;
    submitButton.disabled = value;
    submitButton.classList.toggle('is-loading', value);
    if (resetButton) resetButton.disabled = value;
    if (signOutButton) signOutButton.disabled = value;
    if (googleButton) {
      googleButton.disabled = value;
      googleButton.classList.toggle('is-loading', value);
    }
  };

  const errorMessage = (error) => {
    const messages = {
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/invalid-credential': 'That email or password is not correct.',
      'auth/invalid-login-credentials': 'That email or password is not correct.',
      'auth/user-not-found': 'That email or password is not correct.',
      'auth/wrong-password': 'That email or password is not correct.',
      'auth/email-already-in-use': 'An account already exists with this email.',
      'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
      'auth/password-does-not-meet-requirements': 'Choose a stronger password and try again.',
      'auth/too-many-requests': 'Too many attempts. Please wait a little and try again.',
      'auth/network-request-failed': 'Network error. Check your connection and try again.',
      'auth/operation-not-allowed': 'Email and password sign-in is not enabled in Firebase.',
      'auth/configuration-not-found': 'Firebase Authentication is not configured for this project.',
      'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication settings.',
      'auth/invalid-api-key': 'The Firebase API key in js/config.js is invalid.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase rejected the API key. Copy the exact Web app config from Firebase Console into js/config.js and check the key restrictions.',
      'auth/app-not-authorized': 'This Firebase app is not authorized to use Authentication. Check the web app config.'
    };
    const code = String(error && error.code || '');
    return messages[code] || (code ? `Firebase sign-in failed (${code}). Check the Firebase Authentication settings.` : 'We could not complete that request. Please try again.');
  };

  /* Returns '' when the person simply closed the Google window (nothing to report). */
  const googleErrorMessage = (error) => {
    const code = String(error && error.code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
    const messages = {
      'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
      'auth/operation-not-allowed': 'Google sign-in is not enabled yet. Turn on Google under Authentication → Sign-in method in the Firebase console.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method. Sign in with your email and password instead.'
    };
    return messages[code] || errorMessage(error);
  };

  const setFirebaseAvailability = (api) => {
    firebaseApi = api;
    const enabled = Boolean(api && api.enabled);
    form.querySelectorAll('input').forEach((input) => { input.disabled = !enabled; });
    submitButton.disabled = !enabled;
    if (googleButton) googleButton.disabled = !enabled;
    if (resetButton) resetButton.disabled = !enabled;
    if (enabled) {
      setNote('');
      return;
    }
    setNote(api && api.reason === 'initialization-failed'
      ? 'Firebase could not load. Check your project configuration and refresh.'
      : 'Firebase is not connected yet. Add your Firebase web app values in js/config.js to enable account access.');
  };

  const renderAuthState = (user) => {
    const signedIn = Boolean(user);
    form.hidden = signedIn;
    if (googleWrap) googleWrap.hidden = signedIn;
    session.hidden = !signedIn;
    document.querySelector('.auth-switch').hidden = signedIn;
    sessionUser.textContent = signedIn ? (user.email || 'Signed-in account') : '';
  };

  const setupFirebase = (api) => {
    if (!api || firebaseApi === api) return;
    setFirebaseAvailability(api);
    if (!api.enabled) {
      renderAuthState(null);
      return;
    }
    api.subscribeAuth((user) => renderAuthState(user));
  };

  form.addEventListener('input', (event) => {
    const field = event.target.closest('.field');
    if (field && field.classList.contains('invalid')) validate();
    setNote('');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const result = validate();
    if (!result.valid) {
      result.first.focus();
      return;
    }
    if (!firebaseApi || !firebaseApi.enabled) {
      setNote('Firebase is not connected yet. Add your Firebase web app values in js/config.js to enable account access.');
      return;
    }

    setBusy(true);
    const email = emailInput.value.trim().toLowerCase();
    try {
      await firebaseApi.ready;
      if (mode === 'signup') {
        const name = nameInput.value.trim();
        const credential = await firebaseApi.signUp(email, passwordInput.value);
        try { await firebaseApi.updateUser(credential.user, { displayName: name }); }
        catch (error) { console.warn('Firebase display name update failed.', error); }
        try { await firebaseApi.saveProfile(credential.user.uid, { name, email }); }
        catch (error) { console.warn('Firebase profile save after signup failed.', error); }
        EH.toast('Your EliteHub account is ready');
      } else {
        await firebaseApi.signIn(email, passwordInput.value);
        EH.toast('Welcome back to EliteHub');
      }
    } catch (error) {
      setNote(errorMessage(error), 'err');
    } finally {
      setBusy(false);
    }
  });

  if (googleButton) googleButton.addEventListener('click', async () => {
    if (busy) return;
    if (!firebaseApi || !firebaseApi.enabled) {
      setNote('Firebase is not connected yet. Add your Firebase web app values in js/config.js to enable account access.');
      return;
    }
    setBusy(true);
    setNote('');
    try {
      await firebaseApi.ready;
      const result = await firebaseApi.signInWithGoogle();
      if (result.isNewUser) {
        const user = result.user;
        try { await firebaseApi.saveProfile(user.uid, { name: user.displayName || '', email: user.email || '' }); }
        catch (error) { console.warn('Firebase profile save after Google sign-up failed.', error); }
        EH.toast('Your EliteHub account is ready');
      } else {
        EH.toast('Welcome back to EliteHub');
      }
    } catch (error) {
      setNote(googleErrorMessage(error), 'err');
    } finally {
      setBusy(false);
    }
  });

  if (resetButton) resetButton.addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    if (!EH.validEmail(email)) {
      setFieldState(emailInput, false);
      emailInput.focus();
      return;
    }
    if (!firebaseApi || !firebaseApi.enabled) {
      setNote('Firebase is not connected yet. Add your Firebase web app values in js/config.js to enable account access.');
      return;
    }
    setBusy(true);
    try {
      await firebaseApi.ready;
      await firebaseApi.resetPassword(email);
      setNote('If an account exists for that email, a password reset link is on its way.', 'ok');
    } catch (error) {
      setNote(errorMessage(error), 'err');
    } finally {
      setBusy(false);
    }
  });

  if (signOutButton) signOutButton.addEventListener('click', async () => {
    if (!firebaseApi || !firebaseApi.enabled || busy) return;
    setBusy(true);
    try {
      await firebaseApi.signOut();
      setNote('You’ve been signed out.', 'ok');
    } catch (error) {
      setNote(errorMessage(error), 'err');
    } finally {
      setBusy(false);
    }
  });

  const ready = () => {
    document.addEventListener('firebase:ready', (event) => setupFirebase(event.detail && event.detail.api ? event.detail.api : window.EHFirebase));
    if (window.EHFirebase) setupFirebase(window.EHFirebase);
    renderAuthState(null);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
