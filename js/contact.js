/* EliteHub — contact page */
(function () {
  const EH = window.EH;

  EH.ready(() => {
    const C = EH.config;
    const card = (href, icon, title, text, ext) => `<${href ? `a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}` : 'div'} class="contact-card"><span class="feat-ico">${EH.icon(icon)}</span><div><strong>${title}</strong><span>${EH.esc(text)}</span></div></${href ? 'a' : 'div'}>`;
    const cards = [];
    if (C.whatsappNumber) cards.push(card(EH.waLink(`Hi ${C.brandName}!`), 'whatsapp', 'WhatsApp', 'Chat with us — fastest reply', true));
    if (C.email) cards.push(card('mailto:' + C.email, 'mail', 'Email', C.email));
    // Hidden until a real number is set in js/config.js (the template ships with +91 00000 00000).
    const phoneDigits = String(C.phone || '').replace(/\D/g, '').replace(/^91/, '');
    if (phoneDigits.length >= 8 && !/^0+$/.test(phoneDigits)) cards.push(card('tel:' + C.phone.replace(/[^\d+]/g, ''), 'phone', 'Call', C.phone));
    if (C.social && C.social.instagram) cards.push(card(C.social.instagram, 'instagram', 'Instagram', 'See our latest drops & customer prints', true));
    cards.push(card('', 'clock', 'Working hours', C.hours || ''));
    if (C.address) cards.push(card('', 'pin', 'Studio', C.address));
    document.getElementById('contactCards').innerHTML = cards.join('');

    const pays = [C.razorpayKeyId && 'UPI, credit/debit cards, net banking and wallets (via Razorpay)', C.codEnabled !== false && 'Cash on Delivery', C.whatsappNumber && 'confirming your order on WhatsApp'].filter(Boolean);
    const faqs = [
      ['How long will my order take?', C.shippingInfo],
      ['Can I return or exchange a product?', C.returnsInfo],
      ['What kind of image should I upload for a custom design?', 'High-resolution images give the sharpest prints — ideally 1500 px wide or more. PNG files with a transparent background look best on clothing. In the design studio you can preview your product and download a print file before ordering.'],
      ['Do you take bulk or corporate orders?', 'Yes! We print team tees, event merchandise, corporate gifts and more. Send us a message with the product, quantity and your design, and we’ll share a quote.'],
      ['Which payment methods do you accept?', pays.length ? `We accept ${pays.join(', ')}.` : 'We’ll contact you to confirm payment after you place your order.'],
      ['How do I track my order?', `Sign in and open My Orders to see your order’s progress, carrier and tracking number on any device. Your order ID is also on the confirmation screen; message us${C.whatsappNumber ? ' on WhatsApp' : ''} with it any time for an update.`]
    ];
    document.getElementById('faq').innerHTML = faqs.map(([q, a], i) => `<div class="acc-item ${i === 0 ? 'open' : ''}"><button class="acc-head" type="button" aria-expanded="${i === 0}">${EH.esc(q)} ${EH.icon('plus')}</button><div class="acc-body"><div><p>${EH.esc(a)}</p></div></div></div>`).join('');

    /* form */
    const form = document.getElementById('contactForm');
    const note = document.getElementById('contactNote');
    const rules = { name: (v) => v.trim().length >= 2, email: EH.validEmail, message: (v) => v.trim().length >= 10 };
    const check = (n) => { const ok = rules[n](form.elements[n].value); form.elements[n].closest('.field').classList.toggle('invalid', !ok); return ok; };
    Object.keys(rules).forEach((n) => form.elements[n].addEventListener('input', () => { if (form.elements[n].closest('.field').classList.contains('invalid')) check(n); }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = Object.keys(rules).filter((n) => !check(n));
      if (bad.length) { form.elements[bad[0]].focus(); return; }
      const f = form.elements;
      const data = { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), topic: f.topic.value, message: f.message.value.trim() };
      const text = `Hi ${C.brandName}! I'm ${data.name}.\nTopic: ${data.topic}\n\n${data.message}\n\nEmail: ${data.email}${data.phone ? '\nPhone: ' + data.phone : ''}`;
      const btn = document.getElementById('contactBtn');

      if (C.web3formsKey) {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('is-loading');
        const r = await EH.sendForm(`Website enquiry: ${data.topic}`, data);
        btn.classList.remove('is-loading');
        btn.disabled = false;
        if (r.ok) { form.reset(); note.className = 'form-note ok'; note.textContent = 'Thank you! Your message has been sent — we’ll get back to you soon.'; return; }
        note.className = 'form-note err';
        note.textContent = 'Sorry, your message could not be sent right now. Please try again or reach us directly using the details on this page.';
        return;
      }
      if (C.whatsappNumber) {
        window.open(EH.waLink(text), '_blank', 'noopener');
        note.className = 'form-note ok';
        note.textContent = 'WhatsApp has opened with your message — just tap send.';
        return;
      }
      location.href = EH.mailLink(`Website enquiry: ${data.topic}`, text);
      note.className = 'form-note';
      note.textContent = `Opening your email app with your message. If nothing opens, email us at ${C.email}.`;
    });

    EH.reveal();
  });
})();
