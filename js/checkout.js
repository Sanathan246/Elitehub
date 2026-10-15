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
    let coupon = '';
    try { coupon = sessionStorage.getItem('eh_coupon') || ''; } catch (e) { /* ignore */ }
    let firebaseApi = null;
    let firebaseUser = null;

    const attachFirebase = (api) => {
      if (!api || firebaseApi === api) return;
      firebaseApi = api;
      firebaseUser = api.currentUser || null;
      if (api.enabled) api.subscribeAuth((user) => { firebaseUser = user || null; });
    };
    document.addEventListener('firebase:ready', (e) => attachFirebase(e.detail && e.detail.api ? e.detail.api : window.EHFirebase));
    document.addEventListener('firebase:auth-changed', (e) => { firebaseUser = e.detail && e.detail.user ? e.detail.user : null; });
    if (window.EHFirebase) attachFirebase(window.EHFirebase);

    /* payment methods available from config */
    const methods = [];
    if (C.razorpayKeyId) methods.push({ id: 'online', icon: 'card', title: 'Pay Online', sub: 'UPI, cards, net banking & wallets — secured by Razorpay' });
    if (C.codEnabled !== false) methods.push({ id: 'cod', icon: 'cash', title: 'Cash on Delivery', sub: C.codFee ? `Pay when your order arrives (+${EH.money(C.codFee)} COD fee)` : 'Pay when your order arrives' });
    if (C.whatsappNumber) methods.push({ id: 'whatsapp', icon: 'whatsapp', title: 'Confirm on WhatsApp', sub: 'Send your order to us on WhatsApp — we’ll confirm details & payment there' });
    if (!methods.length) methods.push({ id: 'cod', icon: 'cash', title: 'Place Order', sub: 'We’ll contact you to confirm payment & delivery' });
    let payment = methods[0].id;

    $('#f-state').insertAdjacentHTML('beforeend', STATES.map((s) => `<option>${s}</option>`).join(''));

    /* prefill saved details */
    const prof = EH.store.get('eh_profile', null);
    if (prof) Object.keys(prof).forEach((k) => { const el = form.elements[k]; if (el && prof[k]) el.value = prof[k]; });

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
      if (coupon && !t.coupon) { coupon = ''; }
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

    $('#payOptions').addEventListener('change', (e) => { if (e.target.name === 'payment') { payment = e.target.value; renderPay(); renderSummary(); } });

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

    async function savePurchasedCustomizations(api, user, order) {
      const items = order.items.filter((item) => item.custom3d);
      for (const item of items) {
        const [mockup, detailsFile, preview] = await Promise.all([
          EH.files.get(`mockup:${item.customId}`),
          EH.files.get(`details:${item.customId}`),
          EH.files.get(`previewBlob:${item.customId}`),
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
        const purchasedDetails = new Blob([JSON.stringify({
          ...details,
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
        await api.saveCustomization(user.uid, item.customId, {
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
          previewId: item.previewId || '',
          orderId: order.id,
        }, { mockup, details: purchasedDetails, preview });
      }
    }

    /* place order */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const whatsappWindow = payment === 'whatsapp' ? window.open('about:blank', '_blank') : null;
      try {
        if (!firebaseApi || !firebaseApi.enabled) throw new Error('Order storage is unavailable. Please try again later.');
        await firebaseApi.ready;
      } catch (error) {
        if (whatsappWindow) whatsappWindow.close();
        accountGate.hidden = false;
        accountError.textContent = error.message;
        EH.toast(error.message, { type: 'error', duration: 4500 });
        return;
      }
      const orderUser = firebaseApi.currentUser || firebaseUser;
      if (!orderUser) {
        if (whatsappWindow) whatsappWindow.close();
        accountGate.hidden = false;
        accountError.textContent = 'Sign in or create an account before placing an order.';
        accountGate.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      accountGate.hidden = true;
      accountError.textContent = '';
      const bad = Object.keys(rules).filter((n) => !check(n));
      if (bad.length) {
        if (whatsappWindow) whatsappWindow.close();
        form.elements[bad[0]].focus();
        form.elements[bad[0]].scrollIntoView({ block: 'center', behavior: 'smooth' });
        EH.toast('Please check the highlighted fields', { type: 'error' });
        return;
      }
      const items = EH.cart.items();
      if (!items.length) {
        if (whatsappWindow) whatsappWindow.close();
        return;
      }
      const f = form.elements;
      const customer = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), address1: f.address1.value.trim(), address2: f.address2.value.trim(), city: f.city.value.trim(), state: f.state.value, pincode: f.pincode.value.trim(), notes: f.notes.value.trim() };
      if ($('#f-save').checked) { const p = Object.assign({}, customer); delete p.notes; EH.store.set('eh_profile', p); }
      const order = { id: EH.orderId(), date: new Date().toISOString(), customer, items, totals: EH.totals(items, coupon, payment), payment, status: payment === 'online' ? 'Payment pending' : 'Placed' };

      if (payment === 'online') {
        const btn = $('#placeOrder');
        btn.classList.add('is-loading');
        try {
          await savePurchasedCustomizations(firebaseApi, orderUser, order);
          await firebaseApi.saveOrder(orderUser.uid, order);
          order.paymentId = await payOnline(order);
          order.status = 'Paid';
          try {
            await firebaseApi.saveOrder(orderUser.uid, order);
          } catch (error) {
            console.warn('Paid order status could not be synced to Firebase.', error);
            EH.toast('Payment succeeded, but the order update could not sync. Please contact us with your order number.', { type: 'error', duration: 6000 });
          }
          finalize(order);
        } catch (err) {
          if (err.message !== 'Payment was cancelled — your bag is still saved.') console.warn('Order could not be saved or paid.', err);
          EH.toast(err.message, { type: 'error', duration: 4500 });
        }
        btn.classList.remove('is-loading');
        return;
      }
      try {
        await savePurchasedCustomizations(firebaseApi, orderUser, order);
        await firebaseApi.saveOrder(orderUser.uid, order);
      } catch (error) {
        if (whatsappWindow) whatsappWindow.close();
        console.error('Order could not be saved to Firebase.', error);
        EH.toast('Your order could not be saved. Please try again.', { type: 'error', duration: 4500 });
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
      finalize(order);
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
          <button class="btn-icon modal-close" type="button" data-close-tracking aria-label="Close tracking window">${EH.icon('close')}</button>
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
      const close = () => {
        dialog.classList.remove('open');
        document.removeEventListener('keydown', onKeydown);
        dialog.remove();
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
      const orders = EH.store.get('eh_orders', []);
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
        <p class="muted">Your order has been placed, ${EH.esc(c.name.split(' ')[0])}! ${order.status === 'Paid' ? 'Payment received — we’ll' : 'We’ll'} start working on it right away.</p>
        <div class="order-id">Order #${order.id}</div>
        <p class="form-note ok" id="emailNote" style="min-height:0"></p>
        ${waBtn || mailBtn ? `<p class="muted" style="font-size:13.5px;margin-top:10px">${C2.whatsappNumber ? 'Tap below to send your order to us on WhatsApp' + (hasCustom ? ' — then attach your design file(s).' : ' for the fastest confirmation.') : `Tap below to email your order details to us at <b class="gold">${EH.esc(C2.email)}</b> so we can confirm it.`}</p>` : ''}
        <div class="success-actions"><button class="btn btn-outline" type="button" id="reopenTracking">${EH.icon('package')} Track Order</button>${waBtn}${mailBtn}<a class="btn btn-outline" href="shop.html">Continue Shopping</a></div>
        ${hasCustom ? `<div class="panel order-card" style="margin-bottom:20px"><h2>${EH.icon('download')} Your Design Files</h2><p class="muted" style="font-size:13.5px;margin:-8px 0 12px">Print-ready files for your custom items${C2.whatsappNumber ? ' — please share them with us on WhatsApp' : ''}. They’re also available anytime under <a href="account.html" class="gold">My Orders</a>.</p>${EH.orderItemsHTML(order.items.filter((i) => i.custom), true)}</div>` : ''}
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
