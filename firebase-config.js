import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import config from './config.js';

// Initialize Firebase with config from separate file
export const app = initializeApp(config.firebase);
export const auth = getAuth(app);

try {
  await setPersistence(auth, browserLocalPersistence);
  console.log("✅ Auth persistence: browserLocalPersistence");
} catch (err) {
  console.warn("⚠️ Persistence failed, using memory:", err.code);
  await setPersistence(auth, inMemoryPersistence);
}

// ✅ Modern Firestore persistence setup
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// ✅ Google Sign-In provider
export const googleProvider = new GoogleAuthProvider();
