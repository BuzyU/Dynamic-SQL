// Import Firebase modules
import { auth } from './firebase-config.js';
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Get DOM elements
const profileForm = document.getElementById('profileForm');
const uidInput = document.getElementById('uid');
const emailInput = document.getElementById('email');
const displayNameInput = document.getElementById('displayName');
const photoURLInput = document.getElementById('photoURL');
const providersDiv = document.getElementById('providers');
const resetBtn = document.getElementById('resetBtn');

// Initialize profile data
function initializeProfile() {
    const user = auth.currentUser;
    if (!user) return;

    // Set user information
    uidInput.value = user.uid;
    emailInput.value = user.email;
    displayNameInput.value = user.displayName || '';
    photoURLInput.value = user.photoURL || '';

    // Display user photo if available
    updatePhotoPreview(user.photoURL);

    // Show authentication providers
    const providers = user.providerData.map(p => p.providerId);
    providersDiv.innerHTML = providers.map(p => 
        `<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
            ${p.replace('.com', '')}
        </span>`
    ).join('');
}

// Create photo preview element
const photoPreview = document.createElement('div');
photoPreview.className = 'mt-2 flex items-center gap-4';
photoPreview.innerHTML = `
    <img id="profilePhoto" class="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700" 
         src="" alt="Profile photo preview" style="display: none;">
    <p id="noPhotoText" class="text-sm text-gray-500">No photo uploaded</p>
`;
photoURLInput.parentNode.insertBefore(photoPreview, photoURLInput.nextSibling);

// Update photo preview
function updatePhotoPreview(url) {
    const profilePhoto = document.getElementById('profilePhoto');
    const noPhotoText = document.getElementById('noPhotoText');
    
    if (url) {
        profilePhoto.src = url;
        profilePhoto.style.display = 'block';
        noPhotoText.style.display = 'none';

        // Verify image loads correctly
        profilePhoto.onerror = () => {
            profilePhoto.style.display = 'none';
            noPhotoText.style.display = 'block';
            noPhotoText.textContent = 'Invalid image URL';
            if (photoURLInput.value === url) {
                photoURLInput.setCustomValidity('Please enter a valid image URL');
            }
        };
        profilePhoto.onload = () => {
            photoURLInput.setCustomValidity('');
        };
    } else {
        profilePhoto.style.display = 'none';
        noPhotoText.style.display = 'block';
        noPhotoText.textContent = 'No photo uploaded';
    }
}

// Handle photo URL input changes
photoURLInput.addEventListener('input', (e) => {
    updatePhotoPreview(e.target.value);
});

// Handle form submission
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const loadingClose = window.UI?.loading('Updating profile...');
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user logged in');

        await updateProfile(user, {
            displayName: displayNameInput.value.trim() || null,
            photoURL: photoURLInput.value.trim() || null
        });

        window.UI?.success('Profile updated successfully!');
        initializeProfile(); // Refresh the display
    } catch (error) {
        console.error('Profile update error:', error);
        window.UI?.error('Failed to update profile. Please try again.');
    } finally {
        loadingClose?.();
    }
});

// Handle password reset
resetBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    const loadingClose = window.UI?.loading('Sending password reset email...');
    
    try {
        await auth.sendPasswordResetEmail(user.email);
        window.UI?.success('Password reset email sent!');
    } catch (error) {
        console.error('Password reset error:', error);
        window.UI?.error('Failed to send reset email. Please try again.');
    } finally {
        loadingClose?.();
    }
});

// Initialize when auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        initializeProfile();
    }
});