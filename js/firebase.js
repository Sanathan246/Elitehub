/* EliteHub - Firebase Authentication and Firestore account data */
(async function () {
  const SDK_VERSION = '12.19.0';
  const savedFirebaseConfig = window.EH_CONFIG && window.EH_CONFIG.firebase ? window.EH_CONFIG.firebase : {};
  const useFirestoreAssetFallback = savedFirebaseConfig.useFirestoreAssetFallback === true;
  const config = Object.assign({}, savedFirebaseConfig);
  delete config.useFirestoreAssetFallback;
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
    signInWithGoogle() { return Promise.reject(unavailableError()); },
    sendVerification() { return Promise.reject(unavailableError()); },
    reloadUser() { return Promise.resolve(null); },
    saveProfile() { return Promise.reject(unavailableError()); },
    loadProfile() { return Promise.resolve(null); },
    clearProfile() { return Promise.resolve(); },
    saveOrder() { return Promise.reject(unavailableError()); },
    confirmPayment() { return Promise.reject(unavailableError()); },
    listOrders() { return Promise.resolve([]); },
    subscribeOrders() { return () => {}; },
    cancelOrder() { return Promise.reject(unavailableError()); },
    listAllOrders() { return Promise.reject(unavailableError()); },
    subscribeAllOrders() { return () => {}; },
    updateOrder() { return Promise.reject(unavailableError()); },
    saveCustomization() { return Promise.reject(unavailableError()); },
    listCustomizations() { return Promise.resolve([]); },
    getCustomization() { return Promise.resolve(null); },
    deleteCustomization() { return Promise.reject(unavailableError()); },
    downloadCustomizationAsset() { return Promise.reject(unavailableError()); }
  });

  if (missing.length) {
    const api = disabledApi('missing-config');
    api.missing = missing;
    window.EHFirebase = api;
    emit('firebase:ready', { api });
    return;
  }

  try {
    const [appModule, authModule, firestoreModule, storageModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-storage.js`)
    ]);

    const app = appModule.initializeApp(config);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);
    const storage = storageModule.getStorage(app);
    const persistenceReady = authModule.setPersistence(auth, authModule.browserLocalPersistence)
      .catch((error) => console.warn('Firebase browser persistence is unavailable.', error));
    let resolveAuthReady;
    const authReady = new Promise((resolve) => { resolveAuthReady = resolve; });
    const FIRESTORE_ASSET_CHUNK_BYTES = 700 * 1024;
    const FIRESTORE_ASSET_MAX_BYTES = 100 * 1024 * 1024;
    const FIRESTORE_SOURCE_MODEL_MAX_BYTES = 20 * 1024 * 1024;
    const FIRESTORE_ASSET_BATCH_SIZE = 400;
    const FIRESTORE_ASSET_UPLOAD_BATCH_SIZE = 8;

    const firestoreAssetRef = (uid, customizationId, assetName) => firestoreModule.doc(
      db, 'users', uid, 'customizations', customizationId, 'assets', assetName
    );
    const firestoreAssetChunksRef = (uid, customizationId, assetName) => firestoreModule.collection(
      db, 'users', uid, 'customizations', customizationId, 'assets', assetName, 'chunks'
    );
    const firestoreAssetPath = (uid, customizationId, assetName) =>
      `firestore://${uid}/${customizationId}/${assetName}`;
    const parseFirestoreAssetPath = (uid, path) => {
      const match = /^firestore:\/\/([^/]+)\/([A-Za-z0-9_-]{1,120})\/(mockup|details|preview|sourceModel)$/.exec(String(path || ''));
      return match && match[1] === uid ? { customizationId: match[2], assetName: match[3] } : null;
    };

    async function deleteFirestoreAssetChunks(uid, customizationId, assetName, exceptUploadId = '') {
      const snapshot = await firestoreModule.getDocs(firestoreAssetChunksRef(uid, customizationId, assetName));
      const stale = snapshot.docs.filter((item) => item.data().uploadId !== exceptUploadId);
      for (let offset = 0; offset < stale.length; offset += FIRESTORE_ASSET_BATCH_SIZE) {
        const batch = firestoreModule.writeBatch(db);
        stale.slice(offset, offset + FIRESTORE_ASSET_BATCH_SIZE).forEach((item) => batch.delete(item.ref));
        await batch.commit();
      }
    }

    async function uploadFirestoreAsset(uid, customizationId, assetName, blob, contentType, onProgress) {
      if (!(blob instanceof Blob) || !blob.size) throw new Error(`The ${assetName} file could not be prepared.`);
      if (assetName === 'sourceModel' && blob.size > FIRESTORE_SOURCE_MODEL_MAX_BYTES) throw new Error('Uploaded 3D models must be 20 MB or smaller.');
      if (blob.size > FIRESTORE_ASSET_MAX_BYTES) throw new Error('A 3D design file is larger than the 100 MB free-storage fallback limit.');
      const assetRef = firestoreAssetRef(uid, customizationId, assetName);
      const uploadId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const chunkCount = Math.ceil(bytes.byteLength / FIRESTORE_ASSET_CHUNK_BYTES);

      for (let offset = 0; offset < chunkCount; offset += FIRESTORE_ASSET_UPLOAD_BATCH_SIZE) {
        const batch = firestoreModule.writeBatch(db);
        const end = Math.min(chunkCount, offset + FIRESTORE_ASSET_UPLOAD_BATCH_SIZE);
        for (let index = offset; index < end; index += 1) {
          const startByte = index * FIRESTORE_ASSET_CHUNK_BYTES;
          const chunk = bytes.slice(startByte, Math.min(bytes.byteLength, startByte + FIRESTORE_ASSET_CHUNK_BYTES));
          const chunkId = `${uploadId}_${String(index).padStart(4, '0')}`;
          batch.set(firestoreModule.doc(firestoreAssetChunksRef(uid, customizationId, assetName), chunkId), {
            uploadId,
            index,
            chunk: firestoreModule.Bytes.fromUint8Array(chunk),
          });
        }
        await batch.commit();
        if (typeof onProgress === 'function') {
          const uploadedChunks = Math.min(chunkCount, end);
          onProgress({ assetName, loadedBytes: Math.min(bytes.byteLength, uploadedChunks * FIRESTORE_ASSET_CHUNK_BYTES), totalBytes: bytes.byteLength, transport: 'firestore' });
        }
      }

      await firestoreModule.setDoc(assetRef, {
        uploadId,
        chunkCount,
        size: bytes.byteLength,
        contentType,
        updatedAt: firestoreModule.serverTimestamp(),
      });
      await deleteFirestoreAssetChunks(uid, customizationId, assetName, uploadId);
      return firestoreAssetPath(uid, customizationId, assetName);
    }

    async function downloadFirestoreAsset(uid, customizationId, assetName) {
      const assetSnapshot = await firestoreModule.getDoc(firestoreAssetRef(uid, customizationId, assetName));
      if (!assetSnapshot.exists()) throw new Error('The saved 3D file is missing from cloud storage.');
      const metadata = assetSnapshot.data();
      if (!Number.isInteger(metadata.size) || metadata.size < 1 || metadata.size > FIRESTORE_ASSET_MAX_BYTES
        || !Number.isInteger(metadata.chunkCount) || metadata.chunkCount < 1 || metadata.chunkCount > 150
        || typeof metadata.uploadId !== 'string') {
        throw new Error('The saved 3D file record is incomplete. Please contact the store.');
      }
      const snapshot = await firestoreModule.getDocs(firestoreAssetChunksRef(uid, customizationId, assetName));
      const chunks = snapshot.docs.map((item) => item.data())
        .filter((item) => item.uploadId === metadata.uploadId)
        .sort((a, b) => a.index - b.index);
      if (chunks.length !== metadata.chunkCount || chunks.some((item, index) => item.index !== index)) {
        throw new Error('The saved 3D file is incomplete. Please contact the store.');
      }
      const bytes = new Uint8Array(metadata.size);
      chunks.forEach((item, index) => {
        if (!item.chunk || typeof item.chunk.toUint8Array !== 'function') throw new Error('A saved 3D file section could not be read.');
        const data = item.chunk.toUint8Array();
        const start = index * FIRESTORE_ASSET_CHUNK_BYTES;
        if (start + data.byteLength > bytes.byteLength) throw new Error('The saved 3D file has invalid size information.');
        bytes.set(data, start);
      });
      return new Blob([bytes], { type: metadata.contentType || 'application/octet-stream' });
    }

    const cleanOrder = (order = {}) => {
      const items = Array.isArray(order.items) ? order.items.map((item = {}) => {
        /* Images and local-only IDs stay in localStorage/IndexedDB. Keeping them
           out of Firestore prevents large custom previews from hitting the doc limit. */
        const { image, key, lineId, sourceModelKey, ...cloudItem } = item;
        if (cloudItem.customizationFiles && typeof cloudItem.customizationFiles === 'object') {
          cloudItem.customizationFiles = Object.fromEntries(['mockup', 'details', 'preview', 'sourceModel']
            .filter((assetName) => typeof cloudItem.customizationFiles[assetName] === 'string')
            .map((assetName) => [assetName, cloudItem.customizationFiles[assetName]]));
        }
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
      storage,
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
      async signInWithGoogle() {
        const provider = new authModule.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await authModule.signInWithPopup(auth, provider);
        const info = authModule.getAdditionalUserInfo(credential);
        return { user: credential.user, isNewUser: Boolean(info && info.isNewUser) };
      },
      resetPassword(email) {
        return authModule.sendPasswordResetEmail(auth, email);
      },
      sendVerification() {
        if (!auth.currentUser) return Promise.reject(new Error('A signed-in user is required.'));
        return authModule.sendEmailVerification(auth.currentUser);
      },
      /** Refreshes the signed-in user (and their ID token) after they verify their email elsewhere. */
      async reloadUser() {
        const user = auth.currentUser;
        if (!user) return null;
        await user.reload();
        await user.getIdToken(true);
        api.currentUser = auth.currentUser;
        return auth.currentUser;
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
        const validFilesFor = (customizationId, files) => {
          if (!/^[A-Za-z0-9_-]{1,120}$/.test(customizationId) || !files || typeof files !== 'object') return false;
          const allowed = ['mockup', 'details', 'preview', 'sourceModel'];
          if (!['mockup', 'details', 'preview'].every((name) => typeof files[name] === 'string')
            || Object.keys(files).some((name) => !allowed.includes(name))) return false;
          return Object.entries(files).every(([name, path]) => {
            const firestorePath = parseFirestoreAssetPath(uid, path);
            if (firestorePath) return firestorePath.customizationId === customizationId && firestorePath.assetName === name;
            const base = `users/${uid}/customizations/${customizationId}/`;
            const file = path.startsWith(base) ? path.slice(base.length) : '';
            const allowedNames = {
              mockup: ['mockup.glb'], details: ['details.json'], preview: ['preview.png'],
              sourceModel: ['source-model.glb', 'source-model.gltf', 'source-model.obj', 'source-model.stl', 'source-model.fbx']
            };
            return allowedNames[name].includes(file);
          });
        };
        const batch = firestoreModule.writeBatch(db);
        const orderRef = firestoreModule.doc(db, 'users', uid, 'orders', data.id);
        batch.set(orderRef, Object.assign(data, { updatedAt: firestoreModule.serverTimestamp() }));
        const manifestIds = new Set();
        data.items.filter((item) => item.custom3d).forEach((item) => {
          const customizationId = String(item.customId || '');
          if (item.customizationOwnerUid !== uid || !validFilesFor(customizationId, item.customizationFiles)) {
            throw new Error(`The 3D files for ${item.name || 'your custom product'} are not ready to attach to this order.`);
          }
          if (manifestIds.has(customizationId)) return;
          manifestIds.add(customizationId);
          const manifestRef = firestoreModule.doc(db, 'users', uid, 'orders', data.id, 'customizations', customizationId);
          batch.set(manifestRef, {
            id: customizationId,
            orderId: data.id,
            ownerUid: uid,
            name: String(item.name || 'Custom 3D product').slice(0, 120),
            productType: String(item.type || '').slice(0, 40),
            quantity: Math.max(1, Math.min(20, Number(item.qty) || 1)),
            unitPrice: Math.max(0, Number(item.price) || 0),
            color: String(item.color || '').slice(0, 40),
            size: String(item.size || '').slice(0, 40),
            model: String(item.model || '').slice(0, 80),
            summary: String(item.summary || '').slice(0, 1000),
            sourceModelName: String(item.sourceModelName || '').slice(0, 160),
            files: item.customizationFiles,
            createdAt: firestoreModule.serverTimestamp()
          });
        });
        return batch.commit();
      },
      confirmPayment(uid, orderId, paymentId) {
        if (!uid || !orderId || !paymentId) return Promise.reject(new Error('A customer, order ID, and payment reference are required.'));
        return firestoreModule.updateDoc(firestoreModule.doc(db, 'users', uid, 'orders', orderId), {
          status: 'Paid',
          paymentId: String(paymentId),
          updatedAt: firestoreModule.serverTimestamp()
        });
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
      },
      async saveCustomization(uid, id, metadata = {}, assets = {}, options = {}) {
        if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) throw new Error('Sign in to save this 3D mockup to your account.');
        const customizationId = String(id || '');
        if (!/^[A-Za-z0-9_-]{1,120}$/.test(customizationId)) throw new Error('This customization ID is invalid. Save the preview again.');
        const base = `users/${uid}/customizations/${customizationId}`;
        const specs = {
          mockup: ['mockup.glb', 'model/gltf-binary'],
          details: ['details.json', 'application/json'],
          preview: ['preview.png', 'image/png']
        };
        const sourceModelName = String(metadata.sourceModelName || '').trim().slice(0, 160);
        if (sourceModelName) {
          const ext = (sourceModelName.split('.').pop() || '').toLowerCase();
          const sourceSpecs = {
            glb: ['source-model.glb', 'model/gltf-binary'],
            gltf: ['source-model.gltf', 'model/gltf+json'],
            obj: ['source-model.obj', 'application/octet-stream'],
            stl: ['source-model.stl', 'application/octet-stream'],
            fbx: ['source-model.fbx', 'application/octet-stream']
          };
          if (!sourceSpecs[ext]) throw new Error('The original 3D file type is not supported.');
          if (!(assets.sourceModel instanceof Blob) || !assets.sourceModel.size) throw new Error('The original uploaded 3D file could not be prepared.');
          specs.sourceModel = sourceSpecs[ext];
        }
        const paths = {};
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const saveToFirestore = async () => {
          if (onProgress) onProgress({ phase: 'fallback', transport: 'firestore' });
          await Promise.all(Object.entries(specs).map(async ([key, [, contentType]]) => {
            paths[key] = await uploadFirestoreAsset(uid, customizationId, key, assets[key], contentType, onProgress);
          }));
        };
        if (useFirestoreAssetFallback) {
          await saveToFirestore();
        } else {
          let storageBucketMissing = false;
          try {
            await Promise.all(Object.entries(specs).map(async ([key, [filename, contentType]]) => {
              const blob = assets[key];
              if (!(blob instanceof Blob) || !blob.size) throw new Error(`The ${key} file could not be prepared.`);
              if (key === 'sourceModel' && blob.size > FIRESTORE_SOURCE_MODEL_MAX_BYTES) throw new Error('Uploaded 3D models must be 20 MB or smaller.');
              if (blob.size > FIRESTORE_ASSET_MAX_BYTES) throw new Error(`The ${filename} file is larger than the 100 MB upload limit.`);
              const path = `${base}/${filename}`;
              const task = storageModule.uploadBytesResumable(storageModule.ref(storage, path), blob, {
                contentType,
                customMetadata: { ownerUid: uid, customizationId }
              });
              await new Promise((resolve, reject) => {
                task.on('state_changed', (snapshot) => {
                  if (onProgress) onProgress({ assetName: key, loadedBytes: snapshot.bytesTransferred, totalBytes: snapshot.totalBytes, transport: 'storage' });
                }, reject, resolve);
              });
              paths[key] = path;
            }));
          } catch (error) {
            const fallbackCodes = ['storage/bucket-not-found', 'storage/no-default-bucket', 'storage/project-not-found', 'storage/unauthorized', 'storage/unknown'];
            if (!fallbackCodes.includes(String(error?.code || ''))) throw error;
            storageBucketMissing = true;
          }
          if (storageBucketMissing) await saveToFirestore();
        }
        const data = {
          id: customizationId,
          ownerUid: uid,
          name: String(metadata.name || 'Custom 3D product').slice(0, 80),
          product: String(metadata.product || '').slice(0, 120),
          kind: String(metadata.kind || '').slice(0, 40),
          productType: String(metadata.productType || '').slice(0, 40),
          orderType: String(metadata.orderType || '').slice(0, 40),
          orderColor: String(metadata.orderColor || '').slice(0, 40),
          color: String(metadata.color || '').slice(0, 40),
          colorHex: String(metadata.colorHex || '').slice(0, 16),
          finish: String(metadata.finish || '').slice(0, 40),
          size: String(metadata.size || '').slice(0, 40),
          model: String(metadata.model || '').slice(0, 80),
          quantity: Math.max(1, Math.min(20, Number(metadata.quantity) || 1)),
          unitPrice: Math.max(0, Number(metadata.unitPrice) || 0),
          summary: String(metadata.summary || '').slice(0, 1000),
          previewId: String(metadata.previewId || '').slice(0, 120),
          orderId: String(metadata.orderId || '').slice(0, 120),
          sourceModelName,
          assets: paths,
          updatedAt: firestoreModule.serverTimestamp()
        };
        const docRef = firestoreModule.doc(db, 'users', uid, 'customizations', customizationId);
        const previous = await firestoreModule.getDoc(docRef);
        if (!previous.exists()) data.createdAt = firestoreModule.serverTimestamp();
        await firestoreModule.setDoc(docRef, data, { merge: true });
        return paths;
      },
      async getCustomization(uid, id) {
        const current = auth.currentUser;
        const adminEmail = String(window.EH_CONFIG?.adminEmail || '').trim().toLowerCase();
        const isOwner = !!current && current.uid === uid;
        const isAdmin = !!current && current.emailVerified && adminEmail
          && String(current.email || '').trim().toLowerCase() === adminEmail;
        if (!uid || (!isOwner && !isAdmin)) throw new Error('Sign in to open this saved mockup.');
        const snapshot = await firestoreModule.getDoc(firestoreModule.doc(db, 'users', uid, 'customizations', String(id || '')));
        return snapshot.exists() ? Object.assign({ id: snapshot.id }, snapshot.data()) : null;
      },
      async listCustomizations(uid) {
        const current = auth.currentUser;
        const adminEmail = String(window.EH_CONFIG?.adminEmail || '').trim().toLowerCase();
        const isOwner = !!current && current.uid === uid;
        const isAdmin = !!current && current.emailVerified && adminEmail
          && String(current.email || '').trim().toLowerCase() === adminEmail;
        if (!uid || (!isOwner && !isAdmin)) throw new Error('Sign in to view saved 3D previews.');
        const snapshot = await firestoreModule.getDocs(firestoreModule.collection(db, 'users', uid, 'customizations'));
        return snapshot.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
      },
      async deleteCustomization(uid, id) {
        const current = auth.currentUser;
        const isOwner = !!current && current.uid === uid;
        if (!uid || !isOwner) throw new Error('Sign in to delete this saved 3D preview.');
        const customizationId = String(id || '');
        const docRef = firestoreModule.doc(db, 'users', uid, 'customizations', customizationId);
        const snapshot = await firestoreModule.getDoc(docRef);
        if (!snapshot.exists()) return false;
        const record = snapshot.data();
        if (record.orderId) throw new Error('Files already attached to an order cannot be deleted here.');
        await Promise.all(Object.values(record.assets || {}).map(async (path) => {
          const firestoreAsset = parseFirestoreAssetPath(uid, path);
          if (firestoreAsset && firestoreAsset.customizationId === customizationId) {
            await deleteFirestoreAssetChunks(uid, customizationId, firestoreAsset.assetName);
            await firestoreModule.deleteDoc(firestoreAssetRef(uid, customizationId, firestoreAsset.assetName));
            return;
          }
          if (typeof path === 'string' && path.startsWith(`users/${uid}/customizations/`)) {
            try { await storageModule.deleteObject(storageModule.ref(storage, path)); }
            catch (error) { if (error?.code !== 'storage/object-not-found') throw error; }
          }
        }));
        await firestoreModule.deleteDoc(docRef);
        return true;
      },
      async downloadCustomizationAsset(uid, path) {
        const current = auth.currentUser;
        const adminEmail = String(window.EH_CONFIG?.adminEmail || '').trim().toLowerCase();
        const isOwner = !!current && current.uid === uid;
        const isAdmin = !!current && current.emailVerified && adminEmail
          && String(current.email || '').trim().toLowerCase() === adminEmail;
        if (!uid || (!isOwner && !isAdmin)) throw new Error('Sign in to download this 3D mockup.');
        const assetPath = String(path || '');
        const firestoreAsset = parseFirestoreAssetPath(uid, assetPath);
        if (assetPath.startsWith('firestore://')) {
          if (!firestoreAsset) throw new Error('This mockup file does not belong to your account.');
          return downloadFirestoreAsset(uid, firestoreAsset.customizationId, firestoreAsset.assetName);
        }
        if (!assetPath.startsWith(`users/${uid}/customizations/`)) throw new Error('This mockup file does not belong to your account.');
        const bytes = await storageModule.getBytes(storageModule.ref(storage, assetPath), 100 * 1024 * 1024);
        const type = assetPath.endsWith('.glb') ? 'model/gltf-binary'
          : assetPath.endsWith('.gltf') ? 'model/gltf+json'
            : assetPath.endsWith('.json') ? 'application/json'
              : assetPath.endsWith('.png') ? 'image/png' : 'application/octet-stream';
        return new Blob([bytes], { type });
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
