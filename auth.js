// Enhanced authentication with better error handling
import { auth, googleProvider } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Route guards
if (location.pathname.endsWith('index.html') || location.pathname.endsWith('/')) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = 'systems.html';
    }
  });
}

if (location.pathname.endsWith('dashboard.html') || location.pathname.endsWith('profile.html') || location.pathname.endsWith('systems.html')) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'index.html';
    }
  });
}

// Enhanced error messages
function getErrorMessage(errorCode) {
  const messages = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters with a mix of letters and numbers.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': 'No account found with this email. Please check or create a new account.',
    'auth/wrong-password': 'Incorrect password. Please try again or reset your password.',
    'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later or reset your password.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
    'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups for this site.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'auth/requires-recent-login': 'For security, please sign in again to continue.',
    'auth/email-not-verified': 'Please verify your email address before continuing.'
  };
  
  return messages[errorCode] || 'An error occurred. Please try again.';
}

// Google Sign-In
const googleBtn = document.getElementById('googleSignIn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const loadingClose = window.UI?.loading('Signing in with Google...');
    try {
      await signInWithPopup(auth, googleProvider);
      window.UI?.success('Signed in successfully!');
      setTimeout(() => window.location.href = 'systems.html', 500);
    } catch (err) {
      console.error('Google sign-in error:', err);
      showAuthError(getErrorMessage(err.code));
    } finally {
      loadingClose?.();
    }
  });
}

// Email/Password Auth
const form = document.getElementById('emailAuthForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const isRegister = document.getElementById('isRegister').checked;
    
    if (!email || !password) {
      showAuthError('Please enter both email and password.');
      return;
    }
    
    const loadingClose = window.UI?.loading(isRegister ? 'Creating account...' : 'Signing in...');
    
    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Send verification email
        try {
          await sendEmailVerification(userCredential.user);
          window.UI?.info('Verification email sent! Please check your inbox.');
        } catch (verifyErr) {
          console.error('Verification email error:', verifyErr);
        }
        
        window.UI?.success('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        window.UI?.success('Signed in successfully!');
      }
      
      setTimeout(() => window.location.href = 'systems.html', 500);
    } catch (err) {
      console.error('Auth error:', err);
      showAuthError(getErrorMessage(err.code));
    } finally {
      loadingClose?.();
    }
  });
}

// Password Reset
const resetBtn = document.getElementById('resetPassword');
if (resetBtn) {
  resetBtn.addEventListener('click', async () => {
    const email = document.getElementById('email')?.value.trim();
    
    if (!email) {
      showAuthError('Please enter your email address first.');
      return;
    }
    
    const loadingClose = window.UI?.loading('Sending reset email...');
    
    try {
      await sendPasswordResetEmail(auth, email);
      showAuthError('Password reset email sent! Check your inbox.', true);
      window.UI?.success('Reset email sent successfully!');
    } catch (err) {
      console.error('Reset error:', err);
      showAuthError(getErrorMessage(err.code));
    } finally {
      loadingClose?.();
    }
  });
}

// Sign Out
const signOutBtn = document.getElementById('signOutBtn');
if (signOutBtn) {
  signOutBtn.addEventListener('click', async () => {
    const confirm = await window.UI?.confirm('Are you sure you want to sign out?', {
      title: 'Sign Out',
      okText: 'Sign Out',
      type: 'question'
    });
    
    if (!confirm) return;
    
    try {
      await signOut(auth);
      window.UI?.success('Signed out successfully');
      setTimeout(() => window.location.href = 'index.html', 300);
    } catch (err) {
      console.error('Sign out error:', err);
      window.UI?.error('Failed to sign out. Please try again.');
    }
  });
}

// Display auth errors
function showAuthError(message, success = false) {
  const el = document.getElementById('authError');
  
  if (!el) {
    if (success) {
      window.UI?.success(message);
    } else {
      window.UI?.error(message);
    }
    return;
  }
  
  el.textContent = message;
  el.classList.remove('hidden');
  el.className = success 
    ? 'mt-4 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded' 
    : 'mt-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded';
  
  // Auto-hide success messages
  if (success) {
    setTimeout(() => el.classList.add('hidden'), 5000);
  }
}

// Auto-hide error messages on input
['email', 'password'].forEach(id => {
  const input = document.getElementById(id);
  if (input) {
    input.addEventListener('input', () => {
      const errorEl = document.getElementById('authError');
      if (errorEl && !errorEl.classList.contains('hidden')) {
        errorEl.classList.add('hidden');
      }
    });
  }
});

// Show online/offline status
function updateConnectionStatus() {
  const status = navigator.onLine;
  if (!status && window.UI) {
    window.UI.warning('You are offline. Some features may not work.');
  }
}

window.addEventListener('online', () => {
  window.UI?.success('Back online!');
});

window.addEventListener('offline', () => {
  window.UI?.warning('You are offline. Changes will sync when you reconnect.');
});

updateConnectionStatus();