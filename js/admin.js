/* EliteHub - restricted order management */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const apiLogin = document.getElementById('adminLogin');
    const loginForm = document.getElementById('adminLoginForm');
    const emailInput = document.getElementById('adminEmail');
    const passwordInput = document.getElementById('adminPassword');
    const signInButton = document.getElementById('adminLoginSubmit');
    const googleButton = document.getElementById('adminGoogle');
    const verifyPanel = document.getElementById('adminVerify');
    const verifySend = document.getElementById('adminVerifySend');
    const verifyDone = document.getElementById('adminVerifyDone');
    const signOutButton = document.getElementById('adminSignOut');
    const orderBox = document.getElementById('adminOrders');
    const note = document.getElementById('adminNote');
    const adminEmail = String(EH.config.adminEmail || '').trim().toLowerCase();
    const statuses = ['Placed', 'Payment pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const editable = ['status', 'carrier', 'trackingNumber', 'trackingUrl'];
    const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    let api = null;
    let signedInUser = null;
    let orders = [];
    let stopOrderUpdates = null;
    /* Unsaved edits per order. Live updates re-render the list, so typed-in values are kept here. */
    const drafts = new Map();

    emailInput.value = adminEmail;

    const setNote = (message, type = '') => {
      note.textContent = message;
      note.className = `form-note${type ? ` ${type}` : ''}`;
    };
    const escape = (value) => EH.esc(String(value || ''));
    const dateLabel = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
    };
    const orderKey = (order) => `${order.userId}/${order.id}`;
    const isAdminUser = (user) => !!user && String(user.email || '').toLowerCase() === adminEmail;

    function stopUpdates() {
      if (stopOrderUpdates) {
        stopOrderUpdates();
        stopOrderUpdates = null;
      }
    }

    function showLogin(message = 'Sign in with the authorized administrator account to continue.') {
      apiLogin.hidden = false;
      orderBox.hidden = true;
      if (verifyPanel) verifyPanel.hidden = true;
      signOutButton.hidden = !signedInUser;
      stopUpdates();
      setNote(message, signedInUser ? 'err' : '');
    }

    /* The Firestore rules only trust a verified administrator email. */
    function showVerify(user) {
      apiLogin.hidden = true;
      orderBox.hidden = true;
      signOutButton.hidden = false;
      stopUpdates();
      if (verifyPanel) verifyPanel.hidden = false;
      setNote(`${user.email} is signed in but not verified yet. Send a verification email, open the link in it, then continue.`, 'err');
    }

    function draftValue(order, field) {
      const draft = drafts.get(orderKey(order));
      return draft && Object.prototype.hasOwnProperty.call(draft, field) ? draft[field] : order[field];
    }

    function renderOrders() {
      if (!orders.length) {
        orderBox.innerHTML = `<div class="empty-state">${EH.icon('package')}<h3>No orders found</h3><p>Orders placed by signed-in customers will appear here.</p></div>`;
        return;
      }
      /* Keep focus and caret in the field being edited across live re-renders. */
      const active = document.activeElement;
      const focusId = active && orderBox.contains(active) ? active.id : '';
      const caret = focusId && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;

      orderBox.innerHTML = orders.map((order, index) => {
        const customer = order.customer && typeof order.customer === 'object' ? order.customer : {};
        const status = String(order.status || 'Placed');
        const cancelled = status === 'Cancelled';
        const selected = String(draftValue(order, 'status') || status);
        const knownStatuses = statuses.includes(status) ? statuses : [status, ...statuses];
        const statusOptions = knownStatuses.map((value) => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(value)}</option>`).join('');
        const address = [customer.address1, customer.address2, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ');
        const dirty = drafts.has(orderKey(order));
        const items = Array.isArray(order.items) ? order.items.map((item) => Object.assign({}, item, { customizationOwnerUid: item.customizationOwnerUid || order.userId })) : [];
        return `<article class="order admin-order" data-order-index="${index}">
          <div class="order-head">
            <div>Order<b>#${escape(order.id)}</b></div>
            <div>Placed<b>${dateLabel(order.date)}</b></div>
            <div>Total<b>${EH.money(order.totals && order.totals.total)}</b></div>
            <span class="status ${status.toLowerCase() === 'paid' ? 'paid' : ''}">${escape(status)}</span>
          </div>
          <div class="order-body">
            <h3 style="margin:8px 0">${escape(customer.name || 'Customer')}</h3>
            <p class="muted" style="margin:0 0 8px">${escape(customer.email)}${customer.phone ? ` · ${escape(customer.phone)}` : ''}</p>
            ${address ? `<p class="muted" style="margin:0 0 14px">${escape(address)}</p>` : ''}
            ${customer.notes ? `<p class="admin-order-notes" style="margin:0 0 14px;padding:10px 12px;border:1px solid var(--line);border-radius:10px"><strong>Customer notes:</strong> ${escape(customer.notes)}</p>` : ''}
            ${EH.orderItemsHTML(items, true)}
            <div style="margin-top:14px;max-width:420px">${EH.totalsHTML(order.totals || {})}</div>
            <p class="muted" style="margin:14px 0 0">Payment: ${escape(EH.paymentLabel(order.payment) || 'Not specified')}${order.paymentId ? ` · Reference: ${escape(order.paymentId)}` : ''}</p>
            ${order.payment === 'online' && order.paymentId ? '<p class="form-note" style="margin:6px 0 0">Verify this customer-submitted reference in Razorpay before marking the order Paid or starting fulfillment.</p>' : ''}
          </div>
          <form class="admin-order-form" data-order-index="${index}" style="padding:0 22px 20px">
            <div class="form-grid">
              <div class="field">
                <label for="order-status-${index}">Status</label>
                <select class="select" id="order-status-${index}" name="status" ${cancelled ? 'disabled' : ''}>${statusOptions}</select>
                ${cancelled ? '<span class="muted" style="font-size:12px">Cancelled orders can’t be reopened.</span>' : ''}
              </div>
              <div class="field">
                <label for="order-carrier-${index}">Carrier</label>
                <input class="input" id="order-carrier-${index}" name="carrier" maxlength="80" value="${escape(draftValue(order, 'carrier'))}" placeholder="e.g. Delhivery">
              </div>
              <div class="field">
                <label for="order-tracking-${index}">Tracking number</label>
                <input class="input" id="order-tracking-${index}" name="trackingNumber" maxlength="120" value="${escape(draftValue(order, 'trackingNumber'))}">
              </div>
              <div class="field">
                <label for="order-tracking-url-${index}">Tracking URL (HTTPS)</label>
                <input class="input" id="order-tracking-url-${index}" name="trackingUrl" type="url" maxlength="500" value="${escape(draftValue(order, 'trackingUrl'))}" placeholder="https://">
              </div>
            </div>
            <button class="btn btn-gold btn-sm" type="submit" style="margin-top:14px">Save order update</button>
            <span class="form-note" data-order-note style="display:inline-block;margin-left:10px">${dirty ? 'Unsaved changes' : ''}</span>
          </form>
        </article>`;
      }).join('');

      if (focusId) {
        const again = document.getElementById(focusId);
        if (again) {
          again.focus({ preventScroll: true });
          if (caret && typeof again.setSelectionRange === 'function') {
            try { again.setSelectionRange(caret[0], caret[1]); } catch (error) { /* not a text field */ }
          }
        }
      }
    }

    async function loadOrders() {
      apiLogin.hidden = true;
      if (verifyPanel) verifyPanel.hidden = true;
      orderBox.hidden = false;
      signOutButton.hidden = false;
      orderBox.innerHTML = '<div class="panel">Loading customer orders…</div>';
      try {
        stopUpdates();
        stopOrderUpdates = api.subscribeAllOrders((currentOrders) => {
          orders = currentOrders;
          const current = new Set(orders.map(orderKey));
          drafts.forEach((value, key) => { if (!current.has(key)) drafts.delete(key); });
          renderOrders();
          setNote(`${orders.length} order${orders.length === 1 ? '' : 's'} loaded.`, 'ok');
        }, (error) => {
          console.error('Admin order subscription failed.', error);
          orderBox.hidden = true;
          showLogin('Could not receive order updates. Check that Firebase rules are deployed and this account has verified administrator access.');
        });
      } catch (error) {
        console.error('Admin order list failed.', error);
        orderBox.hidden = true;
        showLogin('Could not load orders. Check that Firebase rules are deployed and this account has verified administrator access.');
      }
    }

    function routeUser(user) {
      signedInUser = user || null;
      if (!user) { showLogin(); return; }
      if (!isAdminUser(user)) { showLogin('This signed-in account is not the administrator account. Sign out and sign in with the administrator email.'); return; }
      if (!user.emailVerified) { showVerify(user); return; }
      loadOrders();
    }

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const enteredEmail = emailInput.value.trim().toLowerCase();
      if (!adminEmail || enteredEmail !== adminEmail) {
        setNote('This email is not authorized for order management.', 'err');
        return;
      }
      if (!api || !api.enabled) {
        setNote('Firebase is not configured or available. Check js/config.js and try again.', 'err');
        return;
      }
      signInButton.disabled = true;
      setNote('Signing in…');
      try {
        await api.ready;
        const credential = await api.signIn(enteredEmail, passwordInput.value);
        passwordInput.value = '';
        routeUser(credential.user);
      } catch (error) {
        console.warn('Admin sign-in failed.', error);
        setNote(error.code ? `Sign-in failed (${error.code}). Check the email and password, or use Google sign-in.` : 'Could not sign in. Please try again.', 'err');
      } finally {
        signInButton.disabled = false;
      }
    });

    if (googleButton) googleButton.addEventListener('click', async () => {
      if (!api || !api.enabled) {
        setNote('Firebase is not configured or available. Check js/config.js and try again.', 'err');
        return;
      }
      googleButton.disabled = true;
      try {
        await api.ready;
        const result = await api.signInWithGoogle();
        routeUser(result.user);
      } catch (error) {
        const code = String(error && error.code || '');
        if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          console.warn('Admin Google sign-in failed.', error);
          setNote(code === 'auth/popup-blocked' ? 'Allow pop-ups for this site, then try Google sign-in again.' : `Google sign-in failed${code ? ` (${code})` : ''}.`, 'err');
        }
      } finally {
        googleButton.disabled = false;
      }
    });

    if (verifySend) verifySend.addEventListener('click', async () => {
      verifySend.disabled = true;
      try {
        await api.sendVerification();
        setNote(`Verification email sent to ${signedInUser && signedInUser.email}. Open the link in it, then choose “I’ve verified my email”.`, 'ok');
      } catch (error) {
        console.warn('Verification email failed.', error);
        setNote(error && error.code === 'auth/too-many-requests' ? 'A verification email was sent recently. Check your inbox and spam folder.' : 'The verification email could not be sent. Please try again.', 'err');
      } finally {
        verifySend.disabled = false;
      }
    });

    if (verifyDone) verifyDone.addEventListener('click', async () => {
      verifyDone.disabled = true;
      try {
        const user = await api.reloadUser();
        if (user && user.emailVerified) routeUser(user);
        else setNote('This email still isn’t verified. Open the link in the verification email first.', 'err');
      } catch (error) {
        console.warn('Account refresh failed.', error);
        setNote('Could not refresh the account. Please sign out and sign in again.', 'err');
      } finally {
        verifyDone.disabled = false;
      }
    });

    orderBox.addEventListener('input', (event) => {
      const form = event.target.closest('.admin-order-form');
      const field = event.target.name;
      if (!form || !editable.includes(field)) return;
      const order = orders[Number(form.dataset.orderIndex)];
      if (!order) return;
      const draft = drafts.get(orderKey(order)) || {};
      draft[field] = event.target.value;
      drafts.set(orderKey(order), draft);
      const formNote = form.querySelector('[data-order-note]');
      if (formNote && !formNote.textContent) { formNote.textContent = 'Unsaved changes'; formNote.className = 'form-note'; }
    });
    orderBox.addEventListener('change', (event) => {
      if (!event.target.matches('select[name="status"]')) return;
      const form = event.target.closest('.admin-order-form');
      const order = form && orders[Number(form.dataset.orderIndex)];
      if (!order) return;
      const draft = drafts.get(orderKey(order)) || {};
      draft.status = event.target.value;
      drafts.set(orderKey(order), draft);
    });

    orderBox.addEventListener('submit', async (event) => {
      const form = event.target.closest('.admin-order-form');
      if (!form) return;
      event.preventDefault();
      const order = orders[Number(form.dataset.orderIndex)];
      if (!order) return;
      const key = orderKey(order);
      const formData = new FormData(form);
      const formNote = form.querySelector('[data-order-note]');
      const trackingUrl = String(formData.get('trackingUrl') || '').trim();
      if (trackingUrl) {
        try {
          if (new URL(trackingUrl).protocol !== 'https:') throw new Error('Tracking links must use HTTPS.');
        } catch (error) {
          form.querySelector('[name="trackingUrl"]').focus();
          formNote.textContent = 'Enter a valid HTTPS tracking URL.';
          formNote.className = 'form-note err';
          return;
        }
      }
      const updates = {
        carrier: formData.get('carrier'),
        trackingNumber: formData.get('trackingNumber'),
        trackingUrl
      };
      /* A disabled select (cancelled order) is left out of FormData; never blank the status. */
      if (formData.has('status')) updates.status = formData.get('status');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      formNote.textContent = 'Saving…';
      formNote.className = 'form-note';
      try {
        await api.updateOrder(order.userId, order.id, updates);
        drafts.delete(key);
        Object.keys(updates).forEach((field) => { order[field] = String(updates[field] || '').trim(); });
        const fresh = orderBox.querySelector(`.admin-order-form[data-order-index="${orders.indexOf(order)}"] [data-order-note]`) || formNote;
        fresh.textContent = 'Saved. The customer will see this in My Orders.';
        fresh.className = 'form-note ok';
      } catch (error) {
        console.error('Admin order update failed.', error);
        const fresh = orderBox.querySelector(`.admin-order-form[data-order-index="${orders.indexOf(order)}"] [data-order-note]`) || formNote;
        fresh.textContent = error && error.code === 'permission-denied'
          ? 'Not allowed: cancelled orders can’t be changed, and the Firebase rules must be deployed.'
          : 'Could not save this update. Check Firebase rules and try again.';
        fresh.className = 'form-note err';
      } finally {
        button.disabled = false;
      }
    });

    signOutButton.addEventListener('click', async () => {
      if (!api || !api.enabled) return;
      try {
        await api.signOut();
        signedInUser = null;
        drafts.clear();
        showLogin('You have signed out.');
      } catch (error) {
        console.error('Admin sign-out failed.', error);
        setNote('Could not sign out. Please try again.', 'err');
      }
    });

    const setupFirebase = (firebaseApi) => {
      if (!firebaseApi || api === firebaseApi) return;
      api = firebaseApi;
      if (!api.enabled) {
        showLogin('Firebase is not configured or could not be initialized.');
        return;
      }
      api.subscribeAuth((user) => routeUser(user));
    };
    document.addEventListener('firebase:ready', (event) => setupFirebase(event.detail && event.detail.api ? event.detail.api : window.EHFirebase));
    if (window.EHFirebase) setupFirebase(window.EHFirebase);
    EH.whenFirebase(15000).then((firebaseApi) => { if (!firebaseApi && !api) showLogin('Firebase could not load. Check your connection and refresh the page.'); });
  });
})();
