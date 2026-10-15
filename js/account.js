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
    const authPanel = document.getElementById('authPanel');
    const authGoogleWrap = document.getElementById('authGoogleWrap');
    const googleBtn = document.getElementById('googleSignIn');
    const acctSignOut = document.getElementById('acctSignOut');
    const profileHub = document.getElementById('profileHub');
    const profileWelcome = document.getElementById('profileWelcome');
    const profileAccountEmail = document.getElementById('profileAccountEmail');
    const acctAvatar = document.getElementById('acctAvatar');
    const acctMeta = document.getElementById('acctMeta');
    const orderTabs = document.getElementById('orderTabs');
    const orderCount = document.getElementById('orderCount');
    const loginSecurity = document.getElementById('loginSecurity');
    const lsName = document.getElementById('lsName');
    const lsNameEdit = document.getElementById('lsNameEdit');
    const lsNameForm = document.getElementById('lsNameForm');
    const lsNameInput = document.getElementById('lsNameInput');
    const lsNameCancel = document.getElementById('lsNameCancel');
    const lsEmail = document.getElementById('lsEmail');
    const lsEmailTag = document.getElementById('lsEmailTag');
    const lsPassword = document.getElementById('lsPassword');
    const lsPasswordReset = document.getElementById('lsPasswordReset');
    const lsMethods = document.getElementById('lsMethods');
    const lsNote = document.getElementById('lsNote');
    let firebaseApi = null;
    let authUser = null;
    let authMode = 'login';
    let authBusy = false;
    let stopOrderUpdates = null;
    let allOrders = [];
    let visibleOrders = [];
    let orderFilter = 'all';
    let authResolved = false;
    const openOrderDetails = new Set();
    const orderFilters = {
      all: () => true,
      open: (status) => !['Delivered', 'Cancelled'].includes(status),
      delivered: (status) => status === 'Delivered',
      cancelled: (status) => status === 'Cancelled'
    };
    const orderFilterLabels = { open: 'open', delivered: 'delivered', cancelled: 'cancelled' };

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
    const mergeOrders = (localOrders, remoteOrders) => {
      const localById = new Map((localOrders || []).filter((order) => order.id).map((order) => [String(order.id), order]));
      return (remoteOrders || []).map((remote) => {
        const local = localById.get(String(remote.id || ''));
        if (!local) return remote;
        const localItems = new Map((local.items || []).map((item) => [orderItemKey(item), item]));
        const items = (remote.items || []).map((item) => {
          const localItem = localItems.get(orderItemKey(item));
          return Object.assign({}, localItem || {}, item, { image: item.image || (localItem && localItem.image) });
        });
        return Object.assign({}, local, remote, { items });
      })
        .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    };

    const dateLabel = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
    };

    function orderProgressHTML(order) {
      const status = String(order.status || 'Placed');
      const stages = [
        ['Order placed', 'We received your order.'],
        ['Processing', 'Your order is being prepared.'],
        ['Shipped', 'Your order is on the way.'],
        ['Delivered', 'Your order has arrived.']
      ];
      const progress = {
        'Placed': 0,
        'Payment pending': 0,
        'Paid': 1,
        'Processing': 1,
        'Shipped': 2,
        'Delivered': 3
      };
      if (status === 'Cancelled') {
        return `<p class="form-note err">This order was cancelled.${order.paymentId ? ' Any payment refund must be handled separately.' : ''}</p>`;
      }
      const current = Object.prototype.hasOwnProperty.call(progress, status) ? progress[status] : 0;
      return `<ol class="tracking-steps account-order-progress">${stages.map(([title, description], index) => {
        const state = index < current ? 'completed' : index === current ? 'current' : '';
        const text = index === current && status === 'Payment pending' ? 'Complete payment to confirm your order.' : description;
        return `<li class="tracking-step ${state}"><span class="tracking-marker" aria-hidden="true"></span><div><strong>${title}</strong><p>${text}</p></div></li>`;
      }).join('')}</ol>`;
    }

    /* Orders belong to an account: nothing is listed until someone is signed in,
       even though a copy of recent orders is cached in this browser. */
    function renderSignedOutOrders() {
      allOrders = [];
      visibleOrders = [];
      openOrderDetails.clear();
      if (orderTabs) orderTabs.hidden = true;
      if (orderCount) orderCount.textContent = '';
      box.innerHTML = authResolved
        ? `<div class="empty-state">${EH.icon('lock')}<h3>Sign in to view your orders</h3><p>Your order history is private to your account. Sign in to see your orders and track them.</p><a class="btn btn-gold btn-sm" href="#authPanel">Sign in ${EH.icon('arrow', 'ico-arrow')}</a></div>`
        : `<div class="panel">Loading your orders…</div>`;
    }

    function renderOrders(orders = readOrders()) {
      if (!authUser) { renderSignedOutOrders(); return; }
      allOrders = orders;
      const matches = orderFilters[orderFilter] || orderFilters.all;
      visibleOrders = orders.filter((order) => matches(String(order.status || 'Placed')));
      const currentOrderIds = new Set(orders.map((order) => String(order.id || '')));
      openOrderDetails.forEach((id) => { if (!currentOrderIds.has(id)) openOrderDetails.delete(id); });
      if (orderTabs) orderTabs.hidden = !orders.length;
      if (orderCount) orderCount.textContent = orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : '';
      if (!orders.length) {
        const message = authUser ? 'Your orders will appear here after you place one.' : 'When you place an order on this device, it will appear here.';
        box.innerHTML = `<div class="empty-state">${EH.icon('package')}<h3>No orders yet</h3><p>${message}</p><a class="btn btn-gold btn-sm" href="shop.html">Start Shopping ${EH.icon('arrow', 'ico-arrow')}</a></div>`;
        return;
      }
      if (!visibleOrders.length) {
        box.innerHTML = `<div class="empty-state">${EH.icon('package')}<h3>No ${EH.esc(orderFilterLabels[orderFilter] || '')} orders</h3><p>Nothing to show here right now.</p><button class="btn btn-outline btn-sm" type="button" data-order-filter-reset>Show all orders</button></div>`;
        return;
      }
      box.innerHTML = visibleOrders.map((o, i) => {
        const orderId = String(o.id || 'Unavailable');
        const status = String(o.status || 'Placed');
        const statusClass = status.toLowerCase() === 'paid' ? 'paid' : '';
        const canCancel = authUser && ['Placed', 'Payment pending', 'Paid', 'Processing'].includes(status);
        const orderAddress = [o.customer && o.customer.address1, o.customer && o.customer.address2, o.customer && o.customer.city, o.customer && o.customer.state, o.customer && o.customer.pincode].filter(Boolean).join(', ');
        const itemCount = o.items.reduce((count, item) => count + Math.max(0, Number(item.qty) || 0), 0);
        const expanded = openOrderDetails.has(orderId);
        const deliveryNote = ['Shipped', 'Delivered'].includes(status)
          ? `<p class="muted" style="font-size:12px;margin:0 0 14px">Need help with this shipment? <a class="gold" href="contact.html">Contact support</a>.</p>`
          : '';
        return `<article class="order">
        <div class="order-head">
          <div>Order<b>#${EH.esc(orderId)}</b></div>
          <div>Placed<b>${dateLabel(o.date)}</b></div>
          <div>Total<b>${EH.money(o.totals.total)}</b></div>
          <span class="status ${statusClass}">${EH.esc(status)}</span>
        </div>
        <div class="order-body account-order-summary">
          <p class="muted" style="margin:0 0 12px">${itemCount} item${itemCount === 1 ? '' : 's'} · ${EH.esc(o.items.slice(0, 2).map((item) => item.name || 'Item').join(', '))}${o.items.length > 2 ? ` and ${o.items.length - 2} more` : ''}</p>
          <button class="btn btn-ghost btn-sm" type="button" data-order-details="${i}" aria-expanded="${expanded}" aria-controls="order-details-${i}">${expanded ? 'Hide order details' : 'View order details'} <span aria-hidden="true">${expanded ? '−' : '+'}</span></button>
        </div>
        <div class="account-order-details${expanded ? ' is-open' : ''}" id="order-details-${i}" aria-hidden="${!expanded}" ${expanded ? '' : 'inert'}>
          <div class="account-order-details-inner">
            <div class="order-body">
              <p class="eyebrow">Order progress</p>
              ${orderProgressHTML(o)}
              ${o.carrier || o.trackingNumber || o.trackingUrl ? `<div class="order-tracking" style="margin:0 0 18px;font-size:13px;color:var(--muted)"><strong style="color:var(--text)">Shipment</strong>${o.carrier ? ` · ${EH.esc(o.carrier)}` : ''}${o.trackingNumber ? ` · Tracking: ${EH.esc(o.trackingNumber)}` : ''}${safeTrackingLink(o.trackingUrl)}</div>` : ''}
              ${deliveryNote}
              <p class="eyebrow">Items (${itemCount})</p>
              ${EH.orderItemsHTML(o.items, true)}
              <div class="form-grid account-order-info" style="margin-top:18px">
                <div>
                  <p class="eyebrow">Delivery address</p>
                  <p class="muted">${EH.esc(o.customer && o.customer.name || '')}${orderAddress ? `<br>${EH.esc(orderAddress)}` : ''}${o.customer && o.customer.phone ? `<br>${EH.esc(o.customer.phone)}` : ''}</p>
                </div>
                <div>
                  <p class="eyebrow">Payment</p>
                  <p class="muted">${EH.esc(EH.paymentLabel(o.payment))}${o.paymentId ? `<br>Reference: ${EH.esc(o.paymentId)}` : ''}</p>
                </div>
              </div>
              ${EH.totalsHTML(o.totals || {})}
              ${o.customer && o.customer.notes ? `<p class="muted" style="margin-top:14px"><strong>Order notes:</strong> ${EH.esc(o.customer.notes)}</p>` : ''}
              ${status === 'Cancelled' && o.paymentId ? '<p class="form-note">This order is cancelled. Any payment refund must be processed separately; it is not automatic.</p>' : ''}
            </div>
          </div>
        </div>
        <div class="order-actions">
          <button class="btn btn-outline btn-sm" type="button" data-reorder="${i}">${EH.icon('returns')} Order Again</button>
          ${canCancel ? `<button class="btn btn-ghost btn-sm" type="button" data-cancel-order="${i}">Cancel order</button>` : ''}
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

    const setOrderFilter = (filter) => {
      orderFilter = orderFilters[filter] ? filter : 'all';
      if (orderTabs) {
        orderTabs.querySelectorAll('[data-order-filter]').forEach((tab) => {
          const active = tab.dataset.orderFilter === orderFilter;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
        });
      }
      renderOrders(allOrders);
    };

    if (orderTabs) orderTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-order-filter]');
      if (tab) setOrderFilter(tab.dataset.orderFilter);
    });

    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-order-filter-reset]')) { setOrderFilter('all'); return; }
      const detailsButton = e.target.closest('[data-order-details]');
      if (detailsButton) {
        const order = visibleOrders[Number(detailsButton.dataset.orderDetails)];
        if (!order) return;
        const orderId = String(order.id || '');
        const panel = document.getElementById(detailsButton.getAttribute('aria-controls'));
        const open = !openOrderDetails.has(orderId);
        if (open) openOrderDetails.add(orderId);
        else openOrderDetails.delete(orderId);
        detailsButton.setAttribute('aria-expanded', String(open));
        detailsButton.innerHTML = `${open ? 'Hide order details' : 'View order details'} <span aria-hidden="true">${open ? '−' : '+'}</span>`;
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', String(!open));
        panel.inert = !open;
        return;
      }
      const cancelButton = e.target.closest('[data-cancel-order]');
      if (cancelButton) {
        cancelOrder(Number(cancelButton.dataset.cancelOrder), cancelButton);
        return;
      }
      const b = e.target.closest('[data-reorder]');
      if (!b) return;
      const o = visibleOrders[Number(b.dataset.reorder)];
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

    async function cancelOrder(index, button) {
      const order = visibleOrders[index];
      if (!authUser || !firebaseApi || !firebaseApi.enabled) {
        EH.toast('Sign in to cancel an order.', { type: 'error' });
        return;
      }
      if (!order || !['Placed', 'Payment pending', 'Paid', 'Processing'].includes(String(order.status || 'Placed'))) {
        EH.toast('This order can no longer be cancelled online. Contact support for help.', { type: 'error' });
        return;
      }
      const message = order.paymentId
        ? `Cancel order #${EH.esc(order.id)}? The cancellation will be recorded, but payment refunds are not processed automatically and must be handled separately.`
        : `Cancel order #${EH.esc(order.id)}? You can’t undo this action.`;
      if (!(await EH.confirm('Cancel this order?', message, 'Cancel Order'))) return;
      button.disabled = true;
      try {
        await firebaseApi.cancelOrder(authUser.uid, order.id);
        EH.toast(order.paymentId
          ? 'Order cancelled. Any payment refund must be processed separately.'
          : 'Your order has been cancelled.');
      } catch (error) {
        console.error('Order cancellation failed.', error);
        EH.toast(error && error.code === 'permission-denied'
          ? 'This order has already shipped or changed. Refresh your orders and contact support if you need help.'
          : 'We could not cancel this order. Please try again or contact support.', { type: 'error' });
        button.disabled = false;
      }
    }

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
      renderOrders(authUser ? allOrders : []);
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

    /* Returns '' when the person simply closed the Google window (nothing to report). */
    const googleErrorMessage = (error) => {
      const code = String(error && error.code || '');
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
      const messages = {
        'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
        'auth/operation-not-allowed': 'Google sign-in is not enabled yet. Turn on Google under Authentication → Sign-in method in the Firebase console.',
        'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method. Sign in with your email and password instead.'
      };
      return messages[code] || authErrorMessage(error);
    };

    const initialsOf = (user) => {
      const source = String(user && (user.displayName || user.email) || '').trim();
      if (!source) return '?';
      const parts = source.split(/[\s@._-]+/).filter(Boolean);
      return ((parts[0] || '')[0] + (parts.length > 1 ? parts[1][0] : '')).toUpperCase() || '?';
    };

    const providerIds = (user) => (user && Array.isArray(user.providerData) ? user.providerData.map((p) => p && p.providerId).filter(Boolean) : []);

    const renderAvatar = (user) => {
      if (!acctAvatar) return;
      acctAvatar.textContent = initialsOf(user);
      const photo = String(user && user.photoURL || '');
      if (/^https:\/\//i.test(photo)) {
        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => img.remove());
        img.src = photo;
        acctAvatar.appendChild(img);
      }
    };

    const renderLoginSecurity = (user) => {
      if (!loginSecurity) return;
      loginSecurity.hidden = !user;
      if (!user) return;
      const providers = providerIds(user);
      const hasPassword = providers.includes('password');
      const hasGoogle = providers.includes('google.com');
      lsName.textContent = user.displayName || 'Not set';
      lsEmail.textContent = user.email || '';
      lsEmailTag.hidden = !user.emailVerified;
      lsPassword.textContent = hasPassword ? '••••••••' : 'Not set — you sign in with Google';
      lsPasswordReset.hidden = !hasPassword;
      lsMethods.textContent = [hasPassword ? 'Email & password' : '', hasGoogle ? 'Google' : ''].filter(Boolean).join(' · ') || 'Email';
      lsNameForm.hidden = true;
      lsNameEdit.hidden = false;
      setNote(lsNote, '');
    };

    const renderMeta = (user) => {
      if (!acctMeta) return;
      const created = user && user.metadata && user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
      const since = created && !Number.isNaN(created.getTime())
        ? `Member since ${new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(created)}`
        : '';
      acctMeta.textContent = since;
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
      if (googleBtn) {
        googleBtn.disabled = busy;
        googleBtn.classList.toggle('is-loading', busy);
      }
      authTabs.forEach((tab) => { tab.disabled = busy; });
    };

    const setFirebaseAvailability = (api) => {
      const enabled = Boolean(api && api.enabled);
      authForm.querySelectorAll('input, button').forEach((control) => { control.disabled = !enabled; });
      if (googleBtn) googleBtn.disabled = !enabled;
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

    const watchRemoteOrders = async (user) => {
      if (!firebaseApi || !firebaseApi.enabled || !user) return;
      if (stopOrderUpdates) stopOrderUpdates();
      stopOrderUpdates = null;
      try {
        await firebaseApi.ready;
        if (!authUser || authUser.uid !== user.uid) return;
        stopOrderUpdates = firebaseApi.subscribeOrders(user.uid, (remote) => {
          if (!authUser || authUser.uid !== user.uid) return;
          const merged = mergeOrders(readOrders(), remote);
          EH.store.set(orderKey, merged.slice(0, 30));
          renderOrders(merged);
        }, (error) => {
          console.warn('Firebase order updates could not be received.', error);
          setNote(profileNote, 'Live order updates are unavailable. Refresh the page to try again.', 'err');
        });
      } catch (error) {
        console.warn('Firebase order history subscription failed.', error);
        setNote(profileNote, 'Order history could not be synced. Please refresh and try again.', 'err');
      }
    };

    const renderAuthState = (user) => {
      authUser = user || null;
      const signedIn = Boolean(authUser);
      if (profileHub) profileHub.hidden = !signedIn;
      if (authPanel) authPanel.hidden = signedIn;
      if (authTabsBox) authTabsBox.hidden = signedIn;
      if (authForm) authForm.hidden = signedIn;
      if (authGoogleWrap) authGoogleWrap.hidden = signedIn;
      renderAvatar(authUser);
      renderMeta(authUser);
      renderLoginSecurity(authUser);
      if (authDescription) authDescription.textContent = signedIn
        ? 'Your account is active. Saved details can sync securely across devices.'
        : 'Create an account to securely sync your saved delivery details across devices.';
      if (profileStorageNote) profileStorageNote.textContent = signedIn
        ? 'Used to fill in checkout faster. Synced securely to your signed-in account.'
        : 'Used to fill in checkout faster. Stored only on this device until you sign in.';
      if (signedIn) setNote(profileNote, 'Your signed-in profile is ready to use.', 'ok');
      if (profileWelcome) profileWelcome.textContent = signedIn && authUser.displayName ? authUser.displayName : 'Welcome back';
      if (profileAccountEmail) profileAccountEmail.textContent = signedIn ? (authUser.email || '') : '';
      if (signedIn) box.innerHTML = `<div class="panel">Loading your orders…</div>`;
      if (!signedIn && stopOrderUpdates) {
        stopOrderUpdates();
        stopOrderUpdates = null;
      }
    };

    const setupFirebase = (api) => {
      if (!api || firebaseApi === api) return;
      firebaseApi = api;
      setFirebaseAvailability(api);
      if (!api.enabled) {
        authResolved = true;
        renderAuthState(null);
        renderOrders();
        return;
      }
      api.subscribeAuth((user) => {
        authResolved = true;
        renderAuthState(user);
        if (user) {
          syncRemoteProfile(user);
          watchRemoteOrders(user);
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

    if (acctSignOut) acctSignOut.addEventListener('click', async () => {
      if (!firebaseApi || !firebaseApi.enabled || authBusy) return;
      setAuthBusy(true);
      try {
        await firebaseApi.signOut();
        setAuthMode('login');
        setNote(profileNote, 'Signed out. Your local saved details are still available on this device.', 'ok');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        setNote(profileNote, authErrorMessage(error), 'err');
      } finally {
        setAuthBusy(false);
      }
    });

    /* Sign in with Google */
    if (googleBtn) googleBtn.addEventListener('click', async () => {
      if (authBusy) return;
      if (!firebaseApi || !firebaseApi.enabled) {
        setNote(authNote, 'Add your Firebase web app config in js/config.js to enable account login.');
        return;
      }
      setAuthBusy(true);
      setNote(authNote, '');
      try {
        await firebaseApi.ready;
        const result = await firebaseApi.signInWithGoogle();
        if (result.isNewUser) {
          const user = result.user;
          if (user.displayName && !form.elements.name.value.trim()) form.elements.name.value = user.displayName;
          if (user.email && !form.elements.email.value.trim()) form.elements.email.value = user.email;
          const data = readProfile();
          if (hasProfile(data)) {
            EH.store.set('eh_profile', data);
            try { await firebaseApi.saveProfile(user.uid, data); } catch (error) { console.warn('Firebase profile save after Google sign-up failed.', error); }
          }
          EH.toast('Your EliteHub account is ready');
        } else {
          EH.toast('Welcome back to EliteHub');
        }
      } catch (error) {
        setNote(authNote, googleErrorMessage(error), 'err');
      } finally {
        setAuthBusy(false);
      }
    });

    /* Login & Security */
    const closeNameEdit = () => {
      lsNameForm.hidden = true;
      lsNameEdit.hidden = false;
    };

    lsNameEdit.addEventListener('click', () => {
      lsNameInput.value = authUser && authUser.displayName ? authUser.displayName : '';
      lsNameForm.hidden = false;
      lsNameEdit.hidden = true;
      setNote(lsNote, '');
      lsNameInput.focus();
    });

    lsNameCancel.addEventListener('click', closeNameEdit);

    lsNameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = lsNameInput.value.trim();
      if (name.length < 2) {
        setNote(lsNote, 'Please enter at least 2 characters.', 'err');
        lsNameInput.focus();
        return;
      }
      if (!authUser || !firebaseApi || !firebaseApi.enabled) return;
      try {
        await firebaseApi.ready;
        await firebaseApi.updateUser(authUser, { displayName: name });
        lsName.textContent = name;
        if (profileWelcome) profileWelcome.textContent = name;
        renderAvatar(authUser);
        closeNameEdit();
        setNote(lsNote, 'Your name has been updated.', 'ok');
        EH.toast('Your name has been updated');
      } catch (error) {
        console.warn('Firebase display name update failed.', error);
        setNote(lsNote, 'We could not update your name. Please try again.', 'err');
      }
    });

    lsPasswordReset.addEventListener('click', async () => {
      if (!authUser || !authUser.email || !firebaseApi || !firebaseApi.enabled) return;
      lsPasswordReset.disabled = true;
      try {
        await firebaseApi.ready;
        await firebaseApi.resetPassword(authUser.email);
        setNote(lsNote, `A password reset link has been sent to ${authUser.email}.`, 'ok');
      } catch (error) {
        setNote(lsNote, authErrorMessage(error), 'err');
      } finally {
        lsPasswordReset.disabled = false;
      }
    });

    setAuthMode('login');
    document.addEventListener('firebase:ready', (e) => setupFirebase(e.detail && e.detail.api ? e.detail.api : window.EHFirebase));
    if (window.EHFirebase) setupFirebase(window.EHFirebase);

    renderOrders();
  });
})();
