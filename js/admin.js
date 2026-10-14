/* EliteHub - restricted order management */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const apiLogin = document.getElementById('adminLogin');
    const loginForm = document.getElementById('adminLoginForm');
    const emailInput = document.getElementById('adminEmail');
    const passwordInput = document.getElementById('adminPassword');
    const signInButton = document.getElementById('adminLoginSubmit');
    const signOutButton = document.getElementById('adminSignOut');
    const orderBox = document.getElementById('adminOrders');
    const note = document.getElementById('adminNote');
    const adminEmail = String(EH.config.adminEmail || '').trim().toLowerCase();
    const statuses = ['Placed', 'Payment pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    const dateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    let api = null;
    let signedInUser = null;
    let orders = [];

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

    function showLogin(message = 'Sign in with the authorized administrator account to continue.') {
      apiLogin.hidden = false;
      orderBox.hidden = true;
      signOutButton.hidden = !signedInUser;
      setNote(message, signedInUser ? 'err' : '');
    }

    function renderOrders() {
      if (!orders.length) {
        orderBox.innerHTML = `<div class="empty-state">${EH.icon('package')}<h3>No orders found</h3><p>Orders placed by signed-in customers will appear here.</p></div>`;
        return;
      }
      orderBox.innerHTML = orders.map((order, index) => {
        const customer = order.customer && typeof order.customer === 'object' ? order.customer : {};
        const knownStatuses = statuses.includes(String(order.status || 'Placed')) ? statuses : [String(order.status), ...statuses];
        const statusOptions = knownStatuses.map((status) => `<option value="${escape(status)}" ${status === order.status ? 'selected' : ''}>${escape(status)}</option>`).join('');
        const address = [customer.address1, customer.address2, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ');
        return `<article class="order admin-order" data-order-index="${index}">
          <div class="order-head">
            <div>Order<b>#${escape(order.id)}</b></div>
            <div>Placed<b>${dateLabel(order.date)}</b></div>
            <div>Total<b>${EH.money(order.totals && order.totals.total)}</b></div>
            <span class="status">${escape(order.status || 'Placed')}</span>
          </div>
          <div class="order-body">
            <h3 style="margin:8px 0">${escape(customer.name || 'Customer')}</h3>
            <p class="muted" style="margin:0 0 8px">${escape(customer.email)}${customer.phone ? ` · ${escape(customer.phone)}` : ''}</p>
            ${address ? `<p class="muted" style="margin:0 0 14px">${escape(address)}</p>` : ''}
            ${EH.orderItemsHTML(Array.isArray(order.items) ? order.items : [], true)}
            <p class="muted" style="margin:14px 0 0">Payment: ${escape(order.payment || 'Not specified')}${order.paymentId ? ` · Reference: ${escape(order.paymentId)}` : ''}</p>
          </div>
          <form class="admin-order-form" data-order-index="${index}" style="padding:0 22px 20px">
            <div class="form-grid">
              <div class="field">
                <label for="order-status-${index}">Status</label>
                <select class="select" id="order-status-${index}" name="status">${statusOptions}</select>
              </div>
              <div class="field">
                <label for="order-carrier-${index}">Carrier</label>
                <input class="input" id="order-carrier-${index}" name="carrier" maxlength="80" value="${escape(order.carrier)}" placeholder="e.g. Delhivery">
              </div>
              <div class="field">
                <label for="order-tracking-${index}">Tracking number</label>
                <input class="input" id="order-tracking-${index}" name="trackingNumber" maxlength="120" value="${escape(order.trackingNumber)}">
              </div>
              <div class="field">
                <label for="order-tracking-url-${index}">Tracking URL (HTTPS)</label>
                <input class="input" id="order-tracking-url-${index}" name="trackingUrl" type="url" maxlength="500" value="${escape(order.trackingUrl)}" placeholder="https://">
              </div>
            </div>
            <button class="btn btn-gold btn-sm" type="submit" style="margin-top:14px">Save order update</button>
            <span class="form-note" data-order-note style="display:inline-block;margin-left:10px"></span>
          </form>
        </article>`;
      }).join('');
    }

    async function loadOrders() {
      apiLogin.hidden = true;
      orderBox.hidden = false;
      signOutButton.hidden = false;
      orderBox.innerHTML = '<div class="panel">Loading customer orders…</div>';
      try {
        orders = await api.listAllOrders();
        renderOrders();
        setNote(`${orders.length} order${orders.length === 1 ? '' : 's'} loaded.`, 'ok');
      } catch (error) {
        console.error('Admin order list failed.', error);
        orderBox.hidden = true;
        showLogin('Could not load orders. Check that Firebase rules are deployed and this account has verified administrator access.');
      }
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
        signedInUser = credential.user;
        passwordInput.value = '';
        if (!credential.user.emailVerified) {
          setNote('Verify this email address in Firebase Authentication before using order management.', 'err');
          return;
        }
        await loadOrders();
      } catch (error) {
        console.warn('Admin sign-in failed.', error);
        setNote(error.code ? `Sign-in failed (${error.code}). Check the email and password.` : 'Could not sign in. Please try again.', 'err');
      } finally {
        signInButton.disabled = false;
      }
    });

    orderBox.addEventListener('submit', async (event) => {
      const form = event.target.closest('.admin-order-form');
      if (!form) return;
      event.preventDefault();
      const order = orders[Number(form.dataset.orderIndex)];
      if (!order) return;
      const formData = new FormData(form);
      const trackingUrl = String(formData.get('trackingUrl') || '').trim();
      if (trackingUrl) {
        try {
          if (new URL(trackingUrl).protocol !== 'https:') throw new Error('Tracking links must use HTTPS.');
        } catch (error) {
          form.querySelector('[name="trackingUrl"]').focus();
          form.querySelector('[data-order-note]').textContent = 'Enter a valid HTTPS tracking URL.';
          form.querySelector('[data-order-note]').className = 'form-note err';
          return;
        }
      }
      const button = form.querySelector('button[type="submit"]');
      const formNote = form.querySelector('[data-order-note]');
      button.disabled = true;
      formNote.textContent = 'Saving…';
      formNote.className = 'form-note';
      try {
        await api.updateOrder(order.userId, order.id, {
          status: formData.get('status'),
          carrier: formData.get('carrier'),
          trackingNumber: formData.get('trackingNumber'),
          trackingUrl
        });
        order.status = String(formData.get('status'));
        order.carrier = String(formData.get('carrier') || '').trim();
        order.trackingNumber = String(formData.get('trackingNumber') || '').trim();
        order.trackingUrl = trackingUrl;
        formNote.textContent = 'Saved. The customer will see this in My Orders.';
        formNote.className = 'form-note ok';
      } catch (error) {
        console.error('Admin order update failed.', error);
        formNote.textContent = 'Could not save this update. Check Firebase rules and try again.';
        formNote.className = 'form-note err';
      } finally {
        button.disabled = false;
      }
    });

    signOutButton.addEventListener('click', async () => {
      if (!api || !api.enabled) return;
      try {
        await api.signOut();
        signedInUser = null;
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
      api.subscribeAuth((user) => {
        signedInUser = user || null;
        if (user && String(user.email || '').toLowerCase() === adminEmail && user.emailVerified) {
          loadOrders();
        } else {
          showLogin(user ? 'This signed-in account is not the verified administrator account.' : 'Sign in with the authorized administrator account to continue.');
        }
      });
    };
    document.addEventListener('firebase:ready', (event) => setupFirebase(event.detail && event.detail.api ? event.detail.api : window.EHFirebase));
    if (window.EHFirebase) setupFirebase(window.EHFirebase);
  });
})();
