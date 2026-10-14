/* EliteHub - account, authentication and saved details */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const C = EH.config;
    const box = document.getElementById('orders');
    const form = document.getElementById('profileForm');
    const profileNote = document.getElementById('profileNote');
    const profileStorageNote = document.getElementById('profileStorageNote');
    const profileFields = ['name', 'phone', 'email', 'address1', 'address2', 'city', 'pincode', 'state'];
    const orderKey = 'eh_orders';
    const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const authForm = document.getElementById('authForm');
    const authTabs = Array.from(document.querySelectorAll('[data-auth-mode]'));
    const authTabsBox = document.querySelector('.auth-tabs');
    const authNameField = document.querySelector('.auth-name-field');
    const authConfirmField = document.querySelector('.auth-confirm-field');
    const authName = document.getElementById('authName');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authConfirm = document.getElementById('authConfirm');
    const authSubmit = document.getElementById('authSubmit');
    const resetPassword = document.getElementById('resetPassword');
    const authNote = document.getElementById('authNote');
    const authDescription = document.getElementById('authDescription');
    const authSession = document.getElementById('authSession');
    const authUserEmail = document.getElementById('authUserEmail');
    const authSignOut = document.getElementById('authSignOut');
    let firebaseApi = null;
    let authUser = null;
    let authMode = 'login';
    let authBusy = false;

    const setNote = (el, message, type = '') => {
      if (!el) return;
      el.textContent = message || '';
      el.className = `form-note${type ? ` ${type}` : ''}`;
    };

    const readProfile = () => {
      const data = {};
      profileFields.forEach((key) => { data[key] = form.elements[key].value.trim(); });
      return data;
    };

    const hasProfile = (profile) => profile && profileFields.some((key) => String(profile[key] || '').trim());

    const fillProfile = (profile = {}) => {
      profileFields.forEach((key) => {
        if (form.elements[key]) form.elements[key].value = typeof profile[key] === 'string' ? profile[key] : '';
      });
    };

    const readOrders = () => {
      const stored = EH.store.get(orderKey, []);
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((order) => order && typeof order === 'object')
        .map((order) => Object.assign({}, order, {
          items: Array.isArray(order.items) ? order.items.filter((item) => item && typeof item === 'object') : [],
          totals: order.totals && typeof order.totals === 'object' ? order.totals : {}
        }))
        .filter((order) => order.items.length);
    };

    const orderItemKey = (item = {}) => item.customId || [item.productId, item.color, item.size || '', item.model || ''].join('|');
    const orderKeyFor = (order = {}) => String(order.id || `${order.date || ''}:${order.customer && order.customer.email || ''}`);
    const mergeOrders = (localOrders, remoteOrders) => {
      const merged = new Map((localOrders || []).map((order) => [orderKeyFor(order), order]));
      (remoteOrders || []).forEach((remote) => {
        const key = orderKeyFor(remote);
        const local = merged.get(key);
        if (!local) {
          merged.set(key, remote);
          return;
        }
        const localItems = new Map((local.items || []).map((item) => [orderItemKey(item), item]));
        const items = (remote.items || []).map((item) => {
          const localItem = localItems.get(orderItemKey(item));
          return Object.assign({}, localItem || {}, item, { image: item.image || (localItem && localItem.image) });
        });
        merged.set(key, Object.assign({}, local, remote, { items }));
      });
      return Array.from(merged.values()).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    };

    const dateLabel = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
    };

    function renderOrders(orders = readOrders()) {
      if (!orders.length) {
        const message = authUser ? 'Your orders will appear here after you place one.' : 'When you place an order on this device, it will appear here.';
        box.innerHTML = `<div class="empty-state">${EH.icon('package')}<h3>No orders yet</h3><p>${message}</p><a class="btn btn-gold btn-sm" href="shop.html">Start Shopping ${EH.icon('arrow', 'ico-arrow')}</a></div>`;
        return;
      }
      box.innerHTML = orders.map((o, i) => {
        const orderId = String(o.id || 'Unavailable');
        const status = String(o.status || 'Placed');
        const statusClass = status.toLowerCase() === 'paid' ? 'paid' : '';
        return `<article class="order">
        <div class="order-head">
          <div>Order<b>#${EH.esc(orderId)}</b></div>
          <div>Placed<b>${dateLabel(o.date)}</b></div>
          <div>Total<b>${EH.money(o.totals.total)}</b></div>
          <span class="status ${statusClass}">${EH.esc(status)}</span>
        </div>
        <div class="order-body">${EH.orderItemsHTML(o.items, true)}
          ${o.carrier || o.trackingNumber || o.trackingUrl ? `<div class="order-tracking" style="margin-top:12px;font-size:13px;color:var(--muted)"><strong style="color:var(--text)">Shipping</strong>${o.carrier ? ` · ${EH.esc(o.carrier)}` : ''}${o.trackingNumber ? ` · Tracking: ${EH.esc(o.trackingNumber)}` : ''}${safeTrackingLink(o.trackingUrl)}</div>` : ''}
        </div>
        <div class="order-actions">
          <button class="btn btn-outline btn-sm" type="button" data-reorder="${i}">${EH.icon('returns')} Order Again</button>
          ${C.whatsappNumber ? `<a class="btn btn-ghost btn-sm" href="${EH.waLink(`Hi ${C.brandName}! Could I get an update on my order #${orderId}?`)}" target="_blank" rel="noopener">${EH.icon('whatsapp')} Ask for an update</a>` : `<a class="btn btn-ghost btn-sm" href="${EH.mailLink('Order ' + orderId, `Hi ${C.brandName}! Could I get an update on my order #${orderId}?`)}">${EH.icon('mail')} Ask for an update</a>`}
        </div>
      </article>`;
      }).join('');
    }

    function safeTrackingLink(value) {
      try {
        const url = new URL(String(value || ''));
        if (url.protocol !== 'https:') return '';
        return ` · <a class="gold" href="${EH.esc(url.href)}" target="_blank" rel="noopener noreferrer">Track shipment</a>`;
      } catch (error) {
        return '';
      }
    }

    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reorder]');
      if (!b) return;
      const o = readOrders()[Number(b.dataset.reorder)];
      if (!o) return;
      const existingCustom = new Set(EH.cart.items().filter((item) => item.custom && item.customId).map((item) => item.customId));
      let added = 0;
      o.items.forEach((it) => {
        const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
        if (it.custom) {
          if (!it.customId || existingCustom.has(it.customId)) return;
          const copy = Object.assign({}, it, { qty });
          delete copy.key;
          delete copy.lineId;
          if (EH.cart.add(copy)) { existingCustom.add(it.customId); added++; }
          return;
        }
        const p = EH.getProduct(it.productId);
        if (!p) return;
        const T = EH.types[p.type];
        const st = EH.defaultOptions(p.type, T.colors.includes(it.color) ? it.color : p.color);
        if (T.sizes) st.size = T.sizes.includes(it.size) ? it.size : T.sizes[0];
        if (T.models) st.model = T.models.includes(it.model) ? it.model : T.models[0];
        if (EH.cart.addProduct(p, st, qty)) added++;
      });
      if (added) EH.toast('Items added to your bag', { action: { label: 'View bag', onClick: EH.openCart } });
      else EH.toast('Those items are already in your bag or no longer available.', { type: 'error' });
    });

    /* saved details */
    const prof = EH.store.get('eh_profile', {}) || {};
    fillProfile(prof);

    const rules = {
      name: (v) => !v || v.length >= 2,
      phone: (v) => !v || EH.validPhone(v),
      email: (v) => !v || EH.validEmail(v),
      address1: (v) => !v || v.length >= 4,
      city: (v) => !v || v.length >= 2,
      pincode: (v) => !v || /^[1-9]\d{5}$/.test(v),
      state: (v) => !v || v.length >= 2
    };

    function validateField(name) {
      const el = form.elements[name];
      const field = el.closest('.field');
      const ok = rules[name](el.value.trim());
      field.classList.toggle('invalid', !ok);
      el.setAttribute('aria-invalid', String(!ok));
      return ok;
    }

    Object.keys(rules).forEach((name) => {
      const el = form.elements[name];
      el.addEventListener('blur', () => { if (el.value.trim()) validateField(name); });
      el.addEventListener('input', () => {
        if (name === 'pincode') el.value = el.value.replace(/\D/g, '').slice(0, 6);
        if (el.closest('.field').classList.contains('invalid')) validateField(name);
        setNote(profileNote, '');
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = readProfile();
      const invalid = Object.keys(rules).filter((name) => !validateField(name));
      if (invalid.length) {
        form.elements[invalid[0]].focus();
        EH.toast('Please check the highlighted fields', { type: 'error' });
        return;
      }
      if (!EH.store.set('eh_profile', data)) {
        setNote(profileNote, 'Could not save details in this browser.', 'err');
        EH.toast('Could not save your details in this browser.', { type: 'error' });
        return;
      }

      if (authUser && firebaseApi && firebaseApi.enabled) {
        setNote(profileNote, 'Saving your details to your account...');
        try {
          await firebaseApi.ready;
          await firebaseApi.saveProfile(authUser.uid, data);
          setNote(profileNote, 'Your details are saved and synced to your account.', 'ok');
          EH.toast('Your details have been synced');
        } catch (error) {
          console.warn('Firebase profile save failed.', error);
          setNote(profileNote, 'Saved on this device, but cloud sync failed. Please try again.', 'err');
          EH.toast('Saved here, but cloud sync failed.', { type: 'error' });
        }
        return;
      }

      setNote(profileNote, 'Your details have been saved on this device.', 'ok');
      EH.toast('Your details have been saved');
    });

    document.getElementById('clearData').addEventListener('click', async () => {
      if (!(await EH.confirm('Clear Saved Data?', 'This removes your saved details and order history from this device.', 'Clear Data'))) return;
      let cloudError = false;
      if (authUser && firebaseApi && firebaseApi.enabled) {
        try {
          await firebaseApi.ready;
          await firebaseApi.clearProfile(authUser.uid);
        } catch (error) {
          cloudError = true;
          console.warn('Firebase profile clear failed.', error);
        }
      }
      EH.store.remove('eh_profile');
      EH.store.remove(orderKey);
      form.reset();
      Object.keys(rules).forEach((name) => validateField(name));
      setNote(profileNote, cloudError ? 'Local data cleared, but the cloud profile could not be cleared.' : '', cloudError ? 'err' : '');
      renderOrders();
      EH.toast(cloudError ? 'Local saved data cleared.' : 'Saved data cleared', cloudError ? { type: 'error' } : undefined);
    });

    /* Firebase account access */
    const authErrorMessage = (error) => {
      const code = String(error && error.code || '');
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
        'auth/operation-not-allowed': 'Email sign-in is not enabled in the Firebase console.',
        'auth/configuration-not-found': 'Firebase Authentication is not configured for this project.',
        'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication settings.',
        'auth/invalid-api-key': 'The Firebase API key in js/config.js is invalid.',
        'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase rejected the API key. Copy the exact Web app config from Firebase Console into js/config.js and check the key restrictions.',
        'auth/app-not-authorized': 'This Firebase app is not authorized to use Authentication. Check the web app config.'
      };
      return messages[code] || (code ? `Firebase sign-in failed (${code}). Check the Firebase Authentication settings.` : 'We could not complete that request. Please try again.');
    };

    const setAuthFieldState = (input, valid) => {
      const field = input.closest('.field');
      if (!field) return;
      field.classList.toggle('invalid', !valid);
      input.setAttribute('aria-invalid', String(!valid));
    };

    const validateAuth = () => {
      const checks = [
        [authEmail, EH.validEmail(authEmail.value.trim())],
        [authPassword, authPassword.value.length >= 6]
      ];
      if (authMode === 'signup') {
        checks.unshift([authName, authName.value.trim().length >= 2]);
        checks.push([authConfirm, authConfirm.value.length >= 6 && authConfirm.value === authPassword.value]);
      }
      checks.forEach(([input, valid]) => setAuthFieldState(input, valid));
      return { valid: checks.every(([, valid]) => valid), first: checks.find(([, valid]) => !valid)?.[0] || null };
    };

    const setAuthMode = (mode) => {
      authMode = mode === 'signup' ? 'signup' : 'login';
      authTabs.forEach((tab) => {
        const active = tab.dataset.authMode === authMode;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      if (authNameField) authNameField.hidden = authMode !== 'signup';
      if (authConfirmField) authConfirmField.hidden = authMode !== 'signup';
      if (resetPassword) resetPassword.hidden = authMode === 'signup';
      if (authSubmit) authSubmit.textContent = authMode === 'signup' ? 'Create account' : 'Sign in';
      if (authPassword) authPassword.autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
      [authName, authConfirm].forEach((input) => {
        if (!input) return;
        input.value = '';
        setAuthFieldState(input, true);
      });
      setNote(authNote, '');
    };

    const setAuthBusy = (busy) => {
      authBusy = busy;
      if (authSubmit) {
        authSubmit.disabled = busy;
        authSubmit.classList.toggle('is-loading', busy);
      }
      if (resetPassword) resetPassword.disabled = busy;
      authTabs.forEach((tab) => { tab.disabled = busy; });
    };

    const setFirebaseAvailability = (api) => {
      const enabled = Boolean(api && api.enabled);
      authForm.querySelectorAll('input, button').forEach((control) => { control.disabled = !enabled; });
      if (enabled) {
        setNote(authNote, '');
        return;
      }
      const message = api && api.reason === 'initialization-failed'
        ? 'Firebase could not load. Check the project configuration and refresh.'
        : 'Add your Firebase web app config in js/config.js to enable account login.';
      setNote(authNote, message);
    };

    const syncRemoteProfile = async (user) => {
      if (!firebaseApi || !firebaseApi.enabled || !user) return;
      try {
        await firebaseApi.ready;
        const remote = await firebaseApi.loadProfile(user.uid);
        if (remote !== null) {
          fillProfile(remote);
          EH.store.set('eh_profile', readProfile());
        } else {
          const local = EH.store.get('eh_profile', {}) || {};
          if (hasProfile(local)) await firebaseApi.saveProfile(user.uid, local);
        }
        setNote(profileNote, 'Your signed-in profile is ready to use.', 'ok');
      } catch (error) {
        console.warn('Firebase profile load failed.', error);
        setNote(profileNote, 'Signed in, but cloud profile sync is unavailable.', 'err');
      }
    };

    const syncRemoteOrders = async (user) => {
      if (!firebaseApi || !firebaseApi.enabled || !user) return;
      try {
        await firebaseApi.ready;
        const remote = await firebaseApi.listOrders(user.uid);
        const merged = mergeOrders(readOrders(), remote);
        EH.store.set(orderKey, merged.slice(0, 30));
        renderOrders(merged);
      } catch (error) {
        console.warn('Firebase order history load failed.', error);
      }
    };

    const renderAuthState = (user) => {
      authUser = user || null;
      const signedIn = Boolean(authUser);
      if (authTabsBox) authTabsBox.hidden = signedIn;
      if (authForm) authForm.hidden = signedIn;
      if (authSession) authSession.hidden = !signedIn;
      if (authUserEmail) authUserEmail.textContent = signedIn ? (authUser.email || 'Signed-in account') : '';
      if (authDescription) authDescription.textContent = signedIn
        ? 'Your account is active. Saved details can sync securely across devices.'
        : 'Create an account to securely sync your saved delivery details across devices.';
      if (profileStorageNote) profileStorageNote.textContent = signedIn
        ? 'Used to fill in checkout faster. Synced securely to your signed-in account.'
        : 'Used to fill in checkout faster. Stored only on this device until you sign in.';
      if (signedIn) setNote(profileNote, 'Your signed-in profile is ready to use.', 'ok');
    };

    const setupFirebase = (api) => {
      if (!api || firebaseApi === api) return;
      firebaseApi = api;
      setFirebaseAvailability(api);
      if (!api.enabled) {
        renderAuthState(null);
        renderOrders();
        return;
      }
      api.subscribeAuth((user) => {
        renderAuthState(user);
        if (user) {
          syncRemoteProfile(user);
          syncRemoteOrders(user);
        } else {
          renderOrders();
        }
      });
    };

    authTabs.forEach((tab) => tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode)));
    authForm.addEventListener('input', (e) => {
      if (e.target.matches('input') && e.target.closest('.field')?.classList.contains('invalid')) validateAuth();
      setNote(authNote, '');
    });
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authBusy) return;
      const result = validateAuth();
      if (!result.valid) {
        result.first?.focus();
        return;
      }
      if (!firebaseApi || !firebaseApi.enabled) {
        setNote(authNote, 'Add your Firebase web app config in js/config.js to enable account login.');
        return;
      }
      setAuthBusy(true);
      const email = authEmail.value.trim().toLowerCase();
      try {
        await firebaseApi.ready;
        if (authMode === 'signup') {
          const credential = await firebaseApi.signUp(email, authPassword.value);
          const name = authName.value.trim();
          if (name) {
            try { await firebaseApi.updateUser(credential.user, { displayName: name }); } catch (error) { console.warn('Firebase display name update failed.', error); }
            if (!form.elements.name.value.trim()) form.elements.name.value = name;
          }
          const data = readProfile();
          if (hasProfile(data)) {
            EH.store.set('eh_profile', data);
            try { await firebaseApi.saveProfile(credential.user.uid, data); } catch (error) { console.warn('Firebase profile save after signup failed.', error); }
          }
          EH.toast('Your EliteHub account is ready');
        } else {
          await firebaseApi.signIn(email, authPassword.value);
          EH.toast('Welcome back to EliteHub');
        }
      } catch (error) {
        setNote(authNote, authErrorMessage(error), 'err');
      } finally {
        setAuthBusy(false);
      }
    });

    resetPassword.addEventListener('click', async () => {
      const email = authEmail.value.trim().toLowerCase();
      if (!EH.validEmail(email)) {
        setAuthFieldState(authEmail, false);
        authEmail.focus();
        return;
      }
      if (!firebaseApi || !firebaseApi.enabled) {
        setNote(authNote, 'Add your Firebase web app config in js/config.js to enable account login.');
        return;
      }
      setAuthBusy(true);
      try {
        await firebaseApi.ready;
        await firebaseApi.resetPassword(email);
        setNote(authNote, 'If an account exists for that email, a password reset link is on its way.', 'ok');
      } catch (error) {
        setNote(authNote, authErrorMessage(error), 'err');
      } finally {
        setAuthBusy(false);
      }
    });

    authSignOut.addEventListener('click', async () => {
      if (!firebaseApi || !firebaseApi.enabled || authBusy) return;
      setAuthBusy(true);
      try {
        await firebaseApi.signOut();
        setAuthMode('login');
        setNote(profileNote, 'Signed out. Your local saved details are still available on this device.', 'ok');
      } catch (error) {
        setNote(authNote, authErrorMessage(error), 'err');
      } finally {
        setAuthBusy(false);
      }
    });

    setAuthMode('login');
    document.addEventListener('firebase:ready', (e) => setupFirebase(e.detail && e.detail.api ? e.detail.api : window.EHFirebase));
    if (window.EHFirebase) setupFirebase(window.EHFirebase);

    window.addEventListener('storage', (e) => { if (e.key === orderKey) renderOrders(); });

    renderOrders();
  });
})();
