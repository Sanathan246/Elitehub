/* EliteHub - Firebase Authentication and Firestore account data */
(async function () {
  const SDK_VERSION = '12.19.0';
  const config = window.EH_CONFIG && window.EH_CONFIG.firebase ? window.EH_CONFIG.firebase : {};
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !String(config[key] || '').trim());

  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  const unavailableError = () => new Error('Firebase is not configured for this site.');
  const disabledApi = (reason) => ({
    enabled: false,
    reason,
    ready: Promise.resolve(null),
    currentUser: null,
    subscribeAuth() { return () => {}; },
    saveProfile() { return Promise.reject(unavailableError()); },
    loadProfile() { return Promise.resolve(null); },
    clearProfile() { return Promise.resolve(); },
    saveOrder() { return Promise.reject(unavailableError()); },
    listOrders() { return Promise.resolve([]); },
    subscribeOrders() { return () => {}; },
    cancelOrder() { return Promise.reject(unavailableError()); },
    listAllOrders() { return Promise.reject(unavailableError()); },
    subscribeAllOrders() { return () => {}; },
    updateOrder() { return Promise.reject(unavailableError()); }
  });

  if (missing.length) {
    const api = disabledApi('missing-config');
    api.missing = missing;
    window.EHFirebase = api;
    emit('firebase:ready', { api });
    return;
  }

  try {
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`)
    ]);

    const app = appModule.initializeApp(config);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);
    const persistenceReady = authModule.setPersistence(auth, authModule.browserLocalPersistence)
      .catch((error) => console.warn('Firebase browser persistence is unavailable.', error));
    let resolveAuthReady;
    const authReady = new Promise((resolve) => { resolveAuthReady = resolve; });

    const cleanOrder = (order = {}) => {
      const items = Array.isArray(order.items) ? order.items.map((item = {}) => {
        /* Images and local-only IDs stay in localStorage/IndexedDB. Keeping them
           out of Firestore prevents large custom previews from hitting the doc limit. */
        const { image, key, lineId, ...cloudItem } = item;
        return cloudItem;
      }) : [];
      return {
        id: String(order.id || ''),
        date: String(order.date || new Date().toISOString()),
        customer: order.customer && typeof order.customer === 'object' ? order.customer : {},
        items,
        totals: order.totals && typeof order.totals === 'object' ? order.totals : {},
        payment: String(order.payment || ''),
        paymentId: order.paymentId ? String(order.paymentId) : '',
        status: String(order.status || 'Placed'),
        carrier: String(order.carrier || ''),
        trackingNumber: String(order.trackingNumber || ''),
        trackingUrl: String(order.trackingUrl || '')
      };
    };

    const api = {
      enabled: true,
      app,
      auth,
      db,
      ready: Promise.all([persistenceReady, authReady]),
      currentUser: null,
      subscribeAuth(callback) {
        return authModule.onAuthStateChanged(auth, callback);
      },
      signIn(email, password) {
        return authModule.signInWithEmailAndPassword(auth, email, password);
      },
      signUp(email, password) {
        return authModule.createUserWithEmailAndPassword(auth, email, password);
      },
      resetPassword(email) {
        return authModule.sendPasswordResetEmail(auth, email);
      },
      signOut() {
        return authModule.signOut(auth);
      },
      updateUser(user, values) {
        return authModule.updateProfile(user, values);
      },
      saveProfile(uid, profile) {
        if (!uid) return Promise.reject(new Error('A signed-in user is required.'));
        return firestoreModule.setDoc(firestoreModule.doc(db, 'users', uid), {
          email: auth.currentUser && auth.currentUser.email ? auth.currentUser.email : '',
          profile,
          updatedAt: firestoreModule.serverTimestamp()
        }, { merge: true });
      },
      loadProfile(uid) {
        if (!uid) return Promise.resolve(null);
        return firestoreModule.getDoc(firestoreModule.doc(db, 'users', uid)).then((snapshot) => {
          const data = snapshot.exists() ? snapshot.data() : null;
          return data && data.profile && typeof data.profile === 'object' ? data.profile : null;
        });
      },
      clearProfile(uid) {
        return uid ? firestoreModule.setDoc(firestoreModule.doc(db, 'users', uid), {
          profile: {},
          updatedAt: firestoreModule.serverTimestamp()
        }, { merge: true }) : Promise.resolve();
      },
      saveOrder(uid, order) {
        if (!uid) return Promise.reject(new Error('A signed-in user is required.'));
        if (!order || !order.id) return Promise.reject(new Error('An order ID is required.'));
        const data = cleanOrder(order);
        return firestoreModule.setDoc(
          firestoreModule.doc(db, 'users', uid, 'orders', data.id),
          Object.assign(data, { updatedAt: firestoreModule.serverTimestamp() }),
          { merge: true }
        );
      },
      listOrders(uid) {
        if (!uid) return Promise.resolve([]);
        return firestoreModule.getDocs(firestoreModule.collection(db, 'users', uid, 'orders')).then((snapshot) => snapshot.docs
          .map((entry) => Object.assign({ id: entry.id }, entry.data()))
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      },
      subscribeOrders(uid, onOrders, onError) {
        if (!uid) throw new Error('A signed-in user is required.');
        if (typeof onOrders !== 'function') throw new Error('An order update callback is required.');
        return firestoreModule.onSnapshot(
          firestoreModule.collection(db, 'users', uid, 'orders'),
          (snapshot) => {
            const orders = snapshot.docs
              .map((entry) => Object.assign({ id: entry.id }, entry.data()))
              .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            onOrders(orders);
          },
          typeof onError === 'function' ? onError : (error) => console.error('Firebase order subscription failed.', error)
        );
      },
      cancelOrder(uid, orderId) {
        if (!uid || !orderId) return Promise.reject(new Error('A signed-in customer and order ID are required.'));
        return firestoreModule.updateDoc(firestoreModule.doc(db, 'users', uid, 'orders', orderId), {
          status: 'Cancelled',
          cancelledAt: firestoreModule.serverTimestamp(),
          updatedAt: firestoreModule.serverTimestamp()
        });
      },
      listAllOrders() {
        return firestoreModule.getDocs(firestoreModule.collectionGroup(db, 'orders')).then((snapshot) =>
          snapshot.docs.map((entry) => {
            const userRef = entry.ref.parent.parent;
            return Object.assign({ id: entry.id, userId: userRef ? userRef.id : '' }, entry.data());
          })
          .filter((order) => order.userId)
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
      },
      subscribeAllOrders(onOrders, onError) {
        if (typeof onOrders !== 'function') throw new Error('An order update callback is required.');
        return firestoreModule.onSnapshot(
          firestoreModule.collectionGroup(db, 'orders'),
          (snapshot) => {
            const orders = snapshot.docs.map((entry) => {
              const userRef = entry.ref.parent.parent;
              return Object.assign({ id: entry.id, userId: userRef ? userRef.id : '' }, entry.data());
            }).filter((order) => order.userId)
              .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
            onOrders(orders);
          },
          typeof onError === 'function' ? onError : (error) => console.error('Firebase admin order subscription failed.', error)
        );
      },
      updateOrder(uid, orderId, updates) {
        if (!uid || !orderId) return Promise.reject(new Error('A customer and order ID are required.'));
        const allowed = ['status', 'carrier', 'trackingNumber', 'trackingUrl'];
        const data = {};
        allowed.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(updates || {}, key)) data[key] = String(updates[key] || '').trim();
        });
        if (!Object.keys(data).length) return Promise.reject(new Error('At least one order field must be updated.'));
        data.updatedAt = firestoreModule.serverTimestamp();
        return firestoreModule.updateDoc(firestoreModule.doc(db, 'users', uid, 'orders', orderId), data);
      }
    };

    authModule.onAuthStateChanged(auth, (user) => {
      api.currentUser = user;
      resolveAuthReady(user);
      emit('firebase:auth-changed', { user });
    });
    window.EHFirebase = api;
    emit('firebase:ready', { api });
  } catch (error) {
    console.error('Firebase could not be initialized.', error);
    const api = disabledApi('initialization-failed');
    api.error = error;
    window.EHFirebase = api;
    emit('firebase:ready', { api });
  }
})();
