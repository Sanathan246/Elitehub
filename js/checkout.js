/* EliteHub — checkout & order confirmation */
(function () {
  const EH = window.EH;
  const STATES = ['Andaman & Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

  EH.ready(() => {
    const C = EH.config;
    const $ = (s) => document.querySelector(s);
    const form = $('#checkoutForm');
    const accountGate = $('#checkoutAccountGate');
    const accountError = $('#checkoutAccountError');
    const orderStatus = $('#checkoutOrderStatus');
    let coupon = '';
    let placingOrder = false;
    try { coupon = sessionStorage.getItem('eh_coupon') || ''; } catch (e) { /* ignore */ }
    let firebaseApi = null;
    let firebaseUser = null;
    let pendingOnline = null;   // an online order already saved as "Payment pending", reused if payment is retried

    /* Sign-in links come back to checkout afterwards. */
    if (accountGate) {
      const login = accountGate.querySelector('a[href="login.html"]');
      const signup = accountGate.querySelector('a[href="signup.html"]');
      if (login) login.href = EH.authLink('login.html', 'checkout.html');
      if (signup) signup.href = EH.authLink('signup.html', 'checkout.html');
    }
    const onAuth = (user) => {
      firebaseUser = user || null;
      if (accountGate && document.getElementById('checkoutForm')) accountGate.hidden = !!firebaseUser;
      if (firebaseUser) {
        if (accountError) accountError.textContent = '';
        prefillFor(firebaseUser);
      }
    };
    const attachFirebase = (api) => {
      if (!api || firebaseApi === api) return;
      firebaseApi = api;
      firebaseUser = api.currentUser || null;
      if (api.enabled) api.subscribeAuth(onAuth);
    };
    document.addEventListener('firebase:ready', (e) => attachFirebase(e.detail && e.detail.api ? e.detail.api : window.EHFirebase));
    document.addEventListener('firebase:auth-changed', (e) => onAuth(e.detail && e.detail.user ? e.detail.user : null));

    /* payment methods available from config */
    const methods = [];
    if (C.razorpayKeyId) methods.push({ id: 'online', icon: 'card', title: 'Pay Online', sub: 'UPI, cards, net banking & wallets — secured by Razorpay' });
    if (C.codEnabled !== false) methods.push({ id: 'cod', icon: 'cash', title: 'Cash on Delivery', sub: C.codFee ? `Pay when your order arrives (+${EH.money(C.codFee)} COD fee)` : 'Pay when your order arrives' });
    if (C.whatsappNumber) methods.push({ id: 'whatsapp', icon: 'whatsapp', title: 'Confirm on WhatsApp', sub: 'Send your order to us on WhatsApp — we’ll confirm details & payment there' });
    if (!methods.length) methods.push({ id: 'cod', icon: 'cash', title: 'Place Order', sub: 'We’ll contact you to confirm payment & delivery' });
    let payment = methods[0].id;

    $('#f-state').insertAdjacentHTML('beforeend', STATES.map((s) => `<option>${s}</option>`).join(''));

    /* prefill saved details: only empty fields, and only details that belong to this person */
    const fillEmpty = (profile) => {
      if (!profile || typeof profile !== 'object' || !document.getElementById('checkoutForm')) return;
      Object.keys(profile).forEach((k) => {
        const el = form.elements[k];
        if (el && k !== 'notes' && typeof profile[k] === 'string' && profile[k] && !el.value) el.value = profile[k];
      });
    };
    let prefilledFor = null;
    async function prefillFor(user) {
      if (!user || prefilledFor === user.uid) return;
      prefilledFor = user.uid;
      const local = EH.localProfile.read(user.uid);
      if (local) { fillEmpty(local); return; }
      try {
        if (firebaseApi && firebaseApi.enabled) fillEmpty(await firebaseApi.loadProfile(user.uid));
      } catch (error) { console.warn('Saved details could not be loaded.', error); }
    }
    fillEmpty(EH.localProfile.read(''));

    if (window.EHFirebase) attachFirebase(window.EHFirebase);

    function renderPay() {
      $('#payOptions').innerHTML = methods.map((m) => `<label class="pay-opt ${m.id === payment ? 'active' : ''}"><input type="radio" name="payment" value="${m.id}" ${m.id === payment ? 'checked' : ''}><div><strong>${m.title}</strong><span>${m.sub}</span></div>${EH.icon(m.icon)}</label>`).join('');
    }
    function renderSummary() {
      const items = EH.cart.items();
      if (!items.length) {
        $('#checkoutRoot').innerHTML = `<div class="success-wrap"><div class="empty-state">${EH.icon('bag')}<h3>Your bag is empty</h3><p>Add something you love before checking out.</p><a class="btn btn-gold btn-sm" href="shop.html">Shop Now ${EH.icon('arrow', 'ico-arrow')}</a></div></div>`;
        return;
      }
      const t = EH.totals(items, coupon, payment);
      if (coupon && !t.coupon) {
        const check = EH.coupon(coupon, t.subtotal);
        const note = $('#couponNote');
        if (note) { note.textContent = check && check.error ? `“${coupon}” was removed: ${check.error}` : `“${coupon}” was removed.`; note.className = 'form-note err'; }
        coupon = '';
        try { sessionStorage.removeItem('eh_coupon'); } catch (e) { /* ignore */ }
      }
      $('#sumItems').innerHTML = EH.orderItemsHTML(items);
      $('#sumTotals').innerHTML = EH.totalsHTML(t);
      const btn = $('#placeOrder');
      btn.innerHTML = payment === 'online' ? `${EH.icon('lock')} Pay ${EH.money(t.total)}` : payment === 'whatsapp' ? `${EH.icon('whatsapp')} Place Order on WhatsApp` : `Place Order · ${EH.money(t.total)}`;
      $('#couponInput').value = coupon;
    }

    renderPay();
    renderSummary();
    document.addEventListener('cart:change', () => { if (document.getElementById('checkoutForm')) renderSummary(); });
    if (!document.getElementById('checkoutForm')) return;   // bag was empty: the empty state is showing

    $('#payOptions').addEventListener('change', (e) => {
      if (e.target.name !== 'payment') return;
      payment = e.target.value;
      EH.$$('.pay-opt', $('#payOptions')).forEach((label) => label.classList.toggle('active', label.querySelector('input').value === payment));
      renderSummary();
    });

    /* coupons */
    $('#couponBtn').addEventListener('click', () => {
      const code = $('#couponInput').value.trim().toUpperCase();
      const note = $('#couponNote');
      if (!code) { coupon = ''; note.textContent = ''; renderSummary(); return; }
      const r = EH.coupon(code, EH.cart.subtotal());
      if (r.error) { note.textContent = r.error; note.className = 'form-note err'; return; }
      coupon = r.code;
      try { sessionStorage.setItem('eh_coupon', coupon); } catch (e) { /* ignore */ }
      note.textContent = `“${r.code}” applied — ${r.label || 'you save ' + EH.money(r.amount)}.`;
      note.className = 'form-note ok';
      renderSummary();
    });
    $('#couponInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#couponBtn').click(); } });

    /* validation */
    const rules = {
      name: (v) => v.trim().length >= 2,
      phone: (v) => EH.validPhone(v),
      email: (v) => EH.validEmail(v),
      address1: (v) => v.trim().length >= 4,
      city: (v) => v.trim().length >= 2,
      pincode: (v) => /^[1-9]\d{5}$/.test(v.trim()),
      state: (v) => !!v
    };
    const check = (name) => {
      const el = form.elements[name];
      const ok = rules[name](el.value);
      el.closest('.field').classList.toggle('invalid', !ok);
      return ok;
    };
    Object.keys(rules).forEach((n) => form.elements[n].addEventListener('blur', () => { if (form.elements[n].value) check(n); }));
    Object.keys(rules).forEach((n) => form.elements[n].addEventListener('input', () => { if (form.elements[n].closest('.field').classList.contains('invalid')) check(n); }));

    /* payment gateway */
    function loadRazorpay() {
      return new Promise((res, rej) => {
        if (window.Razorpay) return res();
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = res;
        s.onerror = () => rej(new Error('Could not load the payment gateway. Please check your connection.'));
        document.head.appendChild(s);
      });
    }
    async function payOnline(order) {
      await loadRazorpay();
      return new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: C.razorpayKeyId,
          amount: Math.round(order.totals.total * 100),
          currency: 'INR',
          name: C.brandName,
          description: `Order ${order.id}`,
          image: new URL('assets/apple-touch-icon.png', location.href).href,
          prefill: { name: order.customer.name, email: order.customer.email, contact: order.customer.phone },
          notes: { order_id: order.id },
          theme: { color: '#e6bf86' },
          handler: (resp) => resolve(resp.razorpay_payment_id),
          modal: { ondismiss: () => reject(new Error('Payment was cancelled — your bag is still saved.')) }
        });
        rzp.on('payment.failed', (r) => reject(new Error((r.error && r.error.description) || 'Payment failed. Please try again.')));
        rzp.open();
      });
    }

    async function preparePurchasedCustomizations(user, order) {
      const purchased = [];
      for (const item of order.items.filter((entry) => entry.custom3d)) {
        item.customizationOwnerUid = user.uid;
        const sourceCustomizationId = String(item.customId || '');
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(sourceCustomizationId)) {
          throw new Error(`The 3D design ID for ${item.name || 'your custom product'} is invalid. Reopen the 3D studio and add it to your bag again.`);
        }
        const [mockup, detailsFile, preview, sourceModel] = await Promise.all([
          EH.files.get(`mockup:${sourceCustomizationId}`),
          EH.files.get(`details:${sourceCustomizationId}`),
          EH.files.get(`previewBlob:${sourceCustomizationId}`),
          item.sourceModelName ? EH.files.get(item.sourceModelKey || `sourceModel:${sourceCustomizationId}`) : Promise.resolve(null),
        ]);
        if (!(mockup instanceof Blob) || !(detailsFile instanceof Blob) || !(preview instanceof Blob)) {
          throw new Error(`The 3D mockup files for ${item.name || 'your custom product'} are missing from this browser. Reopen the 3D studio and add the design to your bag again.`);
        }
        let details;
        try {
          details = JSON.parse(await detailsFile.text());
        } catch (error) {
          throw new Error(`The design details for ${item.name || 'your custom product'} could not be read. Reopen the 3D studio and add it to your bag again.`);
        }
        if (item.sourceModelName && !(sourceModel instanceof Blob)) {
          throw new Error('The original 3D file for ' + (item.name || 'your custom product') + ' is missing from this browser. Return to the 3D studio, upload the model again, and add it to your bag.');
        }
        // Keep each order's files immutable and separate from any earlier order
        // made from the same studio design.
        const orderSuffix = String(order.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
        if (!orderSuffix) throw new Error('The order ID is invalid. Refresh checkout and try again.');
        const orderCustomizationId = `${sourceCustomizationId.slice(0, 120 - orderSuffix.length - 1)}_${orderSuffix}`;
        item.customId = orderCustomizationId;
        const purchasedDetails = new Blob([JSON.stringify({
          ...details,
          id: orderCustomizationId,
          order: {
            id: order.id,
            date: order.date,
            quantity: item.qty,
            unitPrice: item.price,
            productType: item.type,
            color: item.color,
            size: item.size || '',
            model: item.model || '',
            summary: item.summary || '',
          },
        }, null, 2)], { type: 'application/json' });
        const metadata = {
          name: item.name,
          product: item.name,
          kind: details.kind,
          productType: item.type,
          color: EH.colors[item.color] ? EH.colors[item.color].name : 'Custom',
          colorHex: details.colorHex || '',
          finish: details.finish || '',
          size: item.size || '',
          model: item.model || '',
          quantity: item.qty,
          unitPrice: item.price,
          summary: item.summary || '',
          orderId: order.id,
          sourceModelName: item.sourceModelName || '',
        };
        const assets = { mockup, details: purchasedDetails, preview, sourceModel };
        purchased.push({ item, metadata, assets, size: Object.values(assets).reduce((sum, asset) => sum + (asset instanceof Blob ? asset.size : 0), 0) });
      }
      const totalBytes = purchased.reduce((sum, entry) => sum + entry.size, 0);
      return {
        totalBytes,
        async save(api, onProgress) {
          let completedBytes = 0;
          for (const entry of purchased) {
            const uploadedByAsset = new Map();
            const paths = await api.saveCustomization(user.uid, entry.item.customId, entry.metadata, entry.assets, {
              onProgress(event) {
                const prior = uploadedByAsset.get(event.assetName) || 0;
                const loaded = Math.min(Number(event.totalBytes) || Number(event.loadedBytes) || prior, Math.max(prior, Number(event.loadedBytes) || 0));
                uploadedByAsset.set(event.assetName, loaded);
                const itemBytes = Array.from(uploadedByAsset.values()).reduce((sum, bytes) => sum + bytes, 0);
                onProgress(totalBytes ? Math.min(1, (completedBytes + itemBytes) / totalBytes) : 1, 'Saving your GLB and design files to Firestore…');
              }
            });
            entry.item.customizationFiles = paths;
            completedBytes += entry.size;
            onProgress(totalBytes ? completedBytes / totalBytes : 1, 'Your design files are saved.');
          }
        }
      };
    }

    /* place order */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (placingOrder) return;
      placingOrder = true;
      const btn = $('#placeOrder');
      const progress = $('#checkoutProgress');
      const progressFill = $('#checkoutProgressFill');
      const progressPercent = $('#checkoutProgressPercent');
      const progressMessage = $('#checkoutProgressMessage');
      const progressTrack = $('#checkoutProgressTrack');
      let progressHighWater = 0;
      let orderSaved = false;
      let failureStage = 'order';
      const setProgress = (value, message, isError = false) => {
        if (!progress) return;
        progress.hidden = false;
        progressHighWater = Math.max(progressHighWater, Math.min(100, Math.max(0, Math.round(value))));
        if (progressFill) progressFill.style.width = `${progressHighWater}%`;
        if (progressPercent) progressPercent.textContent = isError ? `Paused · ${progressHighWater}%` : `${progressHighWater}%`;
        if (progressMessage && message) progressMessage.textContent = message;
        if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(progressHighWater));
        progress.classList.toggle('is-error', isError);
      };
      const clearProgress = () => {
        if (!progress) return;
        progress.hidden = true;
        progress.classList.remove('is-error');
      };
      const whatsappWindow = payment === 'whatsapp' ? window.open('about:blank', '_blank') : null;
      const setStatus = (message, kind = '') => {
        if (!orderStatus) return;
        orderStatus.textContent = message;
        orderStatus.className = `form-note${kind ? ` ${kind}` : ''}`;
      };
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('is-loading');
      btn.textContent = 'Connecting…';
      setStatus('Connecting to secure order storage. Please wait.');
      setProgress(3, 'Connecting to secure order storage…');
      try {
        if (!firebaseApi) attachFirebase(await EH.whenFirebase(15000));
        if (!firebaseApi || !firebaseApi.enabled) throw new Error('Order storage could not load. Check your connection and refresh the page.');
        await firebaseApi.ready;
        const orderUser = firebaseApi.currentUser || firebaseUser;
        if (!orderUser) {
          accountGate.hidden = false;
          accountError.textContent = 'Sign in or create an account before placing an order.';
          accountGate.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setStatus('Please sign in, then return here to place your order.', 'err');
          clearProgress();
          if (whatsappWindow) whatsappWindow.close();
          return;
        }
        accountGate.hidden = true;
        accountError.textContent = '';
        const bad = Object.keys(rules).filter((n) => !check(n));
        if (bad.length) {
          form.elements[bad[0]].focus();
          form.elements[bad[0]].scrollIntoView({ block: 'center', behavior: 'smooth' });
          setStatus('Complete the highlighted required fields to continue.', 'err');
          clearProgress();
          EH.toast('Please check the highlighted fields', { type: 'error' });
          if (whatsappWindow) whatsappWindow.close();
          return;
        }
        const items = EH.cart.items();
        if (!items.length) {
          setStatus('Your bag is empty. Add an item before placing an order.', 'err');
          clearProgress();
          if (whatsappWindow) whatsappWindow.close();
          renderSummary();
          return;
        }
        const f = form.elements;
        const customer = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), address1: f.address1.value.trim(), address2: f.address2.value.trim(), city: f.city.value.trim(), state: f.state.value, pincode: f.pincode.value.trim(), notes: f.notes.value.trim() };
        if ($('#f-save').checked) {
          const p = Object.assign({}, customer);
          delete p.notes;
          EH.localProfile.write(p, orderUser.uid);
          firebaseApi.saveProfile(orderUser.uid, p).catch((error) => console.warn('Saved details could not sync to the account.', error));
        }
        const totals = EH.totals(items, coupon, payment);
        /* A cancelled or failed online payment leaves its order saved as "Payment pending".
           Retrying with the same bag and details pays for that order instead of creating another. */
        const signature = payment === 'online' ? JSON.stringify([orderUser.uid, customer, totals, items.map((it) => [it.key, it.qty, it.price])]) : '';
        const reuse = !!signature && !!pendingOnline && pendingOnline.signature === signature;
        orderSaved = reuse;
        const order = reuse ? pendingOnline.order
          : { id: EH.orderId(), date: new Date().toISOString(), customer, items, totals, payment, status: payment === 'online' ? 'Payment pending' : 'Placed' };

        if (!reuse) {
          const hasCustom3d = items.some((item) => item.custom3d);
          btn.textContent = hasCustom3d ? 'Saving design and order…' : 'Saving your order…';
          setProgress(7, hasCustom3d ? 'Preparing your design files…' : 'Saving your order…');
          setStatus(hasCustom3d
            ? 'Preparing your custom 3D files and order details. Keep this page open.'
            : 'Saving your order. Please keep this page open.');
          failureStage = hasCustom3d ? 'design-files' : 'order';
          const filePlan = await preparePurchasedCustomizations(orderUser, order);
          if (filePlan.totalBytes) {
            await filePlan.save(firebaseApi, (fraction, message) => {
              setProgress(8 + fraction * 77, message);
            });
          }
          failureStage = 'order';
          setProgress(88, 'Saving your order and organizing its design files…');
          setStatus('Saving your order and attaching its GLB, design details, and preview.');
          await firebaseApi.saveOrder(orderUser.uid, order);
          orderSaved = true;
          setProgress(94, 'Order and design files saved.');
          if (payment === 'online') pendingOnline = { signature, order };
        }
        if (payment === 'online') {
          btn.textContent = 'Opening secure payment…';
          setProgress(orderSaved ? 96 : 94, 'Order saved. Opening secure payment…');
          setStatus(reuse
            ? 'Your order is already saved. Complete payment in the secure window.'
            : 'Your order and design files are saved. Complete payment in the secure window.');
          order.paymentId = await payOnline(order);
          let referenceSaved = true;
          try {
            await firebaseApi.recordPaymentReference(orderUser.uid, order.id, order.paymentId);
          } catch (error) {
            referenceSaved = false;
            order.paymentReferenceSyncFailed = true;
            console.warn('Payment reference could not be synced to Firebase.', error);
            EH.toast('Payment succeeded, but its reference could not be saved. Contact the store with your order number and payment reference.', { type: 'error', duration: 7000 });
          }
          pendingOnline = null;
          setProgress(100, referenceSaved ? 'Payment submitted for verification.' : 'Payment succeeded; contact the store with your reference.');
          finalize(order);
          return;
        }

        if (payment === 'whatsapp') {
          if (whatsappWindow) {
            whatsappWindow.opener = null;
            whatsappWindow.location.href = EH.waLink(EH.orderText(order));
          } else {
            EH.toast('Order saved. Allow pop-ups to open WhatsApp and send the order details.', { type: 'error', duration: 5000 });
          }
        }
        setProgress(100, 'Your order is placed.');
        finalize(order);
      } catch (error) {
        if (whatsappWindow) whatsappWindow.close();
        if (error.message !== 'Payment was cancelled — your bag is still saved.') console.error('Order could not be placed.', error);
        const deniedFile = ({ mockup: 'generated GLB', details: 'design details', preview: 'preview image', sourceModel: 'uploaded original model' })[error?.assetName] || '3D design files';
        const message = ['resource-exhausted', 'firestore/resource-exhausted'].includes(String(error?.code || ''))
          ? 'Firestore could not save the order files because its storage or write quota was reached. The order was not placed.'
          : ['permission-denied', 'firestore/permission-denied'].includes(error?.code)
            ? failureStage === 'design-files'
              ? `Firestore refused access to the ${deniedFile}, so the order was not placed. The deployed Firestore rules must allow signed-in customers to save their own order files.`
              : 'Firestore refused to save your order. Please contact the store so the order rules can be checked.'
            : (error?.message || 'Your order could not be saved. Please try again.');
        setStatus(message, 'err');
        setProgress(progressHighWater, orderSaved ? 'Order saved; payment needs attention.' : 'Order not placed. Please try again.', true);
        EH.toast(message, { type: 'error', duration: 6500 });
      } finally {
        placingOrder = false;
        if (btn.isConnected) {
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          btn.classList.remove('is-loading');
          if (document.getElementById('checkoutForm')) renderSummary();
        }
      }
    });

    function showTrackingDialog(order) {
      const dialog = document.createElement('div');
      dialog.className = 'modal tracking-modal';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'trackingTitle');
      dialog.setAttribute('tabindex', '-1');
      dialog.innerHTML = `<button class="modal-backdrop" type="button" data-close-tracking aria-label="Close tracking window"></button>
        <section class="modal-box tracking-box">
          <button class="icon-btn modal-close" type="button" data-close-tracking aria-label="Close tracking window">${EH.icon('x')}</button>
          <p class="eyebrow">Order #${EH.esc(order.id)}</p>
          <h3 id="trackingTitle">Order tracking</h3>
          <p class="muted tracking-current">Current status: <strong>${EH.esc(order.status)}</strong></p>
          <ol class="tracking-steps">
            <li class="tracking-step current"><span class="tracking-marker" aria-hidden="true"></span><div><strong>Order placed</strong><p>Your order is confirmed and saved.</p></div></li>
            <li class="tracking-step"><span class="tracking-marker" aria-hidden="true"></span><div><strong>In production</strong><p>We’ll update this when processing begins.</p></div></li>
            <li class="tracking-step"><span class="tracking-marker" aria-hidden="true"></span><div><strong>Shipped</strong><p>Shipment details will appear when available.</p></div></li>
            <li class="tracking-step"><span class="tracking-marker" aria-hidden="true"></span><div><strong>Delivered</strong><p>Final delivery confirmation.</p></div></li>
          </ol>
          <p class="tracking-disclaimer">Shipping status and tracking details will appear under My Orders after the store updates your order. For help, use the contact option on your order confirmation.</p>
          <button class="btn btn-gold btn-block" type="button" data-close-tracking>Done</button>
        </section>`;
      const opener = document.activeElement;
      const close = () => {
        dialog.classList.remove('open');
        document.removeEventListener('keydown', onKeydown);
        dialog.remove();
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
      };
      const onKeydown = (event) => {
        if (event.key === 'Escape') close();
      };
      dialog.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-tracking]')) close();
      });
      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(dialog);
      requestAnimationFrame(() => {
        dialog.classList.add('open');
        dialog.querySelector('[data-close-tracking]:not(.modal-backdrop)').focus();
      });
    }

    function finalize(order) {
      const stored = EH.store.get('eh_orders', []);
      const orders = Array.isArray(stored) ? stored : [];
      orders.unshift(order);
      if (!EH.store.set('eh_orders', orders.slice(0, 30))) {
        // storage full — keep the order without custom thumbnails
        EH.store.set('eh_orders', orders.slice(0, 30).map((o) => Object.assign({}, o, { items: o.items.map((i) => Object.assign({}, i, { image: null })) })));
      }
      EH.cart.clear();
      try { sessionStorage.removeItem('eh_coupon'); } catch (e) { /* ignore */ }
      renderSuccess(order);
      showTrackingDialog(order);
      window.scrollTo({ top: 0 });
      const plain = EH.orderText(order).replace(/\*/g, '');
      EH.sendForm(`New order ${order.id} — ${EH.money(order.totals.total)}`, { name: order.customer.name, email: order.customer.email, phone: order.customer.phone, order_id: order.id, message: plain })
        .then((r) => { const n = document.getElementById('emailNote'); if (n && r.ok) n.innerHTML = `${EH.icon('checkCircle', 'ico-sm')} Order details sent to the ${EH.esc(C.brandName)} team.`; });
    }

    function renderSuccess(order) {
      const C2 = C;
      const hasCustom = order.items.some((i) => i.custom);
      const text = EH.orderText(order);
      const waBtn = C2.whatsappNumber ? `<a class="btn btn-gold" href="${EH.waLink(text)}" target="_blank" rel="noopener">${EH.icon('whatsapp')} ${order.payment === 'whatsapp' ? 'Open WhatsApp Again' : 'Send Order on WhatsApp'}</a>` : '';
      const mailBtn = !C2.whatsappNumber && !C2.web3formsKey ? `<a class="btn btn-gold" href="${EH.mailLink('Order ' + order.id, text.replace(/\*/g, ''))}">${EH.icon('mail')} Email Order Details</a>` : '';
      const c = order.customer;
      document.getElementById('checkoutRoot').innerHTML = `<div class="success-wrap">
        <div class="success-ico">${EH.icon('check')}</div>
        <h1>Thank <span class="gold-text">You!</span></h1>
        <p class="muted">Your order has been placed, ${EH.esc(c.name.split(' ')[0])}! ${order.payment === 'online' && order.status === 'Payment pending' ? (order.paymentReferenceSyncFailed ? 'Your payment reference could not be saved. Contact us with your order number and reference so we can verify it.' : 'Your payment reference is awaiting verification. We’ll begin preparing your order once it is confirmed.') : order.status === 'Paid' ? 'Payment confirmed — we’ll begin preparing your order.' : 'We’ll be in touch to confirm your order and begin preparing it.'}</p>
        <div class="order-id">Order #${order.id}</div>
        <p class="form-note ok" id="emailNote" style="min-height:0"></p>
        ${waBtn || mailBtn ? `<p class="muted" style="font-size:13.5px;margin-top:10px">${C2.whatsappNumber ? 'Tap below to send your order to us on WhatsApp' + (hasCustom && !order.items.some((item) => item.custom3d) ? ' — then attach your design file(s).' : ' for the fastest confirmation.') : `Tap below to email your order details to us at <b class="gold">${EH.esc(C2.email)}</b> so we can confirm it.`}</p>` : ''}
        <div class="success-actions"><button class="btn btn-outline" type="button" id="reopenTracking">${EH.icon('package')} Track Order</button>${waBtn}${mailBtn}<a class="btn btn-outline" href="shop.html">Continue Shopping</a></div>
        ${hasCustom ? `<div class="panel order-card" style="margin-bottom:20px"><h2>${EH.icon('download')} Your Design Files</h2><p class="muted" style="font-size:13.5px;margin:-8px 0 12px">${order.items.some((item) => item.custom3d) ? 'Your 3D mockup, design details, and uploaded original file (if provided) are saved with this order. Download them here or anytime under ' : 'Print-ready files for your custom items are available here and anytime under ' }<a href="account.html" class="gold">My Orders</a>.</p>${EH.orderItemsHTML(order.items.filter((i) => i.custom), true)}</div>` : ''}
        <div class="panel order-card"><h2>Order Summary</h2>${EH.orderItemsHTML(order.items)}<div style="margin-top:14px">${EH.totalsHTML(order.totals)}</div>
          <div class="form-grid" style="margin-top:20px;font-size:13px;color:var(--muted)">
            <div><b style="color:var(--text);display:block;margin-bottom:4px">Delivering to</b>${EH.esc(c.name)}<br>${EH.esc(c.address1)}${c.address2 ? ', ' + EH.esc(c.address2) : ''}<br>${EH.esc(c.city)}, ${EH.esc(c.state)} – ${EH.esc(c.pincode)}<br>${EH.esc(c.phone)}</div>
            <div><b style="color:var(--text);display:block;margin-bottom:4px">Payment</b>${EH.esc(EH.paymentLabel(order.payment))}${order.paymentId ? `<br><span style="font-size:12px">Ref: ${EH.esc(order.paymentId)}</span>` : ''}</div>
          </div>
        </div>
      </div>`;
      document.getElementById('reopenTracking').addEventListener('click', () => showTrackingDialog(order));
    }
  });
})();
