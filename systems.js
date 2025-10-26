// Systems Dashboard - Manage multiple systems
import { db, auth } from './firebase-config.js';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const systemsCol = collection(db, 'systems');
const categoriesCol = collection(db, 'categories');

// DOM elements
const addSystemBtn = document.getElementById('addSystemBtn');
const systemsGrid = document.getElementById('systemsGrid');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('emptyState');
const systemCountEl = document.getElementById('systemCount');

// State
let systemsUnsubscribe = null;
let categoriesUnsubscribe = null;
let currentUserId = null;
let allSystems = [];
let categoryCounts = {};

// Emoji options for system icons
const emojiOptions = ['📂', '📁', '🗂️', '📋', '📊', '💼', '🎯', '🏠', '💻', '📚', '🎨', '🔧', '🌟', '🚀', '💡', '🎮', '🏆', '📱', '⚙️', '🔬'];

// Cleanup function to unsubscribe all listeners
function cleanup() {
  if (systemsUnsubscribe) {
    systemsUnsubscribe();
    systemsUnsubscribe = null;
  }
  if (categoriesUnsubscribe) {
    categoriesUnsubscribe();
    categoriesUnsubscribe = null;
  }
}

// Initialize auth
onAuthStateChanged(auth, (user) => {
  cleanup(); // Cleanup existing listeners
  
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUserId = user.uid;
  setupRealtimeSystems();
  setupRealtimeCategories();
});

// Setup realtime listener for systems
function setupRealtimeSystems() {
  const q = query(
    systemsCol,
    where('userId', '==', currentUserId),
    orderBy('createdAt', 'desc')
  );
  
  systemsUnsubscribe = onSnapshot(q, (snap) => {
    allSystems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (loadingEl) loadingEl.classList.add('hidden');
    
    if (allSystems.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (systemsGrid) systemsGrid.classList.add('hidden');
    } else {
      if (emptyEl) emptyEl.classList.add('hidden');
      if (systemsGrid) systemsGrid.classList.remove('hidden');
      renderSystems();
    }
    
    updateSystemCount();
  }, (err) => {
    console.error('Snapshot error:', err);
    window.UI?.error('Failed to load systems: ' + err.message);
  });
}

// Setup realtime listener for categories
function setupRealtimeCategories() {
  const q = query(
    categoriesCol, 
    where('userId', '==', currentUserId)
  );
  
  categoriesUnsubscribe = onSnapshot(q, (snap) => {
    categoryCounts = {};
    snap.docs.forEach(doc => {
      const data = doc.data();
      const systemId = data.systemId || 'default';
      categoryCounts[systemId] = (categoryCounts[systemId] || 0) + 1;
    });
    
    renderSystems(); // Update the display with new category counts
  }, (err) => {
    console.error('Categories snapshot error:', err);
    window.UI?.error('Failed to load categories: ' + err.message);
  });
}

// Update system count display
function updateSystemCount() {
  if (systemCountEl) {
    systemCountEl.textContent = `${allSystems.length} system${allSystems.length !== 1 ? 's' : ''}`;
  }
}

// Cleanup on page unload
window.addEventListener('pagehide', cleanup);


// Render systems grid
function renderSystems() {
  if (!systemsGrid) return;
  
  systemsGrid.innerHTML = '';
  
  for (const system of allSystems) {
    const card = renderSystemCard(system);
    systemsGrid.appendChild(card);
  }
}

// Render individual system card
function renderSystemCard(system) {
  const tpl = document.getElementById('systemCardTemplate');
  const el = tpl.content.firstElementChild.cloneNode(true);
  
  const iconEl = el.querySelector('.system-icon');
  const nameEl = el.querySelector('.system-name');
  const descEl = el.querySelector('.system-description');
  const countEl = el.querySelector('.category-count');
  const dateEl = el.querySelector('.created-date');
  const editBtn = el.querySelector('.edit-system');
  const deleteBtn = el.querySelector('.delete-system');
  
  iconEl.textContent = system.icon || '📂';
  nameEl.textContent = system.name || 'Untitled System';
  descEl.textContent = system.description || 'No description';
  
  const count = categoryCounts[system.id] || 0;
  countEl.textContent = `📊 ${count} categor${count !== 1 ? 'ies' : 'y'}`;
  
  if (system.createdAt) {
    const date = system.createdAt.toDate ? system.createdAt.toDate() : new Date(system.createdAt);
    dateEl.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  // Click to open system
  el.addEventListener('click', () => {
    window.location.href = `dashboard.html?systemId=${system.id}`;
  });
  
  // Edit system
  editBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await editSystem(system);
  });
  
  // Delete system
  deleteBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteSystem(system);
  });
  
  return el;
}

// Add new system
addSystemBtn?.addEventListener('click', async () => {
  const name = await window.UI?.prompt('Enter system name:', '', 'Create New System');
  if (!name) return;
  
  // Show emoji picker
  const emojiGrid = emojiOptions.map(e => `<button class="text-3xl p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" data-emoji="${e}">${e}</button>`).join('');
  const emojiHtml = `
    <div class="mb-4">
      <label class="block text-sm font-medium mb-2">Choose an icon:</label>
      <div class="grid grid-cols-10 gap-2 max-h-40 overflow-y-auto">
        ${emojiGrid}
      </div>
    </div>
  `;
  
  // Create temporary modal for emoji selection
  const modalDiv = document.createElement('div');
  modalDiv.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';
  modalDiv.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
      <h3 class="font-semibold text-lg mb-4">Select Icon</h3>
      ${emojiHtml}
      <textarea id="systemDesc" placeholder="Optional description..." rows="3" class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"></textarea>
      <div class="flex justify-end gap-2">
        <button id="cancelEmoji" class="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
        <button id="confirmEmoji" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Create</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modalDiv);
  
  let selectedEmoji = '📂';
  
  modalDiv.querySelectorAll('[data-emoji]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalDiv.querySelectorAll('[data-emoji]').forEach(b => b.classList.remove('ring-2', 'ring-blue-500'));
      btn.classList.add('ring-2', 'ring-blue-500');
      selectedEmoji = btn.dataset.emoji;
    });
  });
  
  // Set first emoji as default selected
  modalDiv.querySelector('[data-emoji]')?.classList.add('ring-2', 'ring-blue-500');
  
  const confirmBtn = modalDiv.querySelector('#confirmEmoji');
  const cancelBtn = modalDiv.querySelector('#cancelEmoji');
  const descInput = modalDiv.querySelector('#systemDesc');
  
  const cleanup = () => modalDiv.remove();
  
  cancelBtn.addEventListener('click', cleanup);
  modalDiv.addEventListener('click', (e) => {
    if (e.target === modalDiv) cleanup();
  });
  
  confirmBtn.addEventListener('click', async () => {
    const description = descInput.value.trim();
    cleanup();
    
    const loadingClose = window.UI?.loading('Creating system...');
    
    try {
      await addDoc(systemsCol, {
        userId: currentUserId,
        name: name.trim(),
        description,
        icon: selectedEmoji,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      window.UI?.success('System created successfully!');
    } catch (err) {
      console.error('Failed to create system:', err);
      window.UI?.error('Failed to create system: ' + err.message);
    } finally {
      loadingClose?.();
    }
  });
});

// Edit system
async function editSystem(system) {
  const name = await window.UI?.prompt('Edit system name:', system.name, 'Edit System');
  if (!name) return;
  
  const description = await window.UI?.prompt('Edit description (optional):', system.description || '', 'Edit Description');
  
  const loadingClose = window.UI?.loading('Updating system...');
  
  try {
    await updateDoc(doc(db, 'systems', system.id), {
      name: name.trim(),
      description: description?.trim() || '',
      updatedAt: serverTimestamp(),
    });
    
    window.UI?.success('System updated successfully!');
  } catch (err) {
    console.error('Failed to update system:', err);
    window.UI?.error('Failed to update system: ' + err.message);
  } finally {
    loadingClose?.();
  }
}

// Delete system
async function deleteSystem(system) {
  const categoryCount = categoryCounts[system.id] || 0;
  
  let confirmMsg = `Delete "${system.name}"?`;
  if (categoryCount > 0) {
    confirmMsg += ` This will also delete ${categoryCount} categor${categoryCount !== 1 ? 'ies' : 'y'}.`;
  }
  
  const confirmed = await window.UI?.confirm(confirmMsg, {
    title: 'Delete System',
    okText: 'Delete',
    type: 'danger',
    dangerous: true
  });
  
  if (!confirmed) return;
  
  const loadingClose = window.UI?.loading('Deleting system...');
  
  try {
    // Delete all categories in this system
    if (categoryCount > 0) {
      const q = query(categoriesCol, where('userId', '==', currentUserId), where('systemId', '==', system.id));
      const snap = await getDocs(q);
      
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'categories', d.id)));
      await Promise.all(deletePromises);
    }
    
    // Delete the system
    await deleteDoc(doc(db, 'systems', system.id));
    
    window.UI?.success('System deleted successfully!');
    
    // Reload category counts
    await loadCategoryCounts();
  } catch (err) {
    console.error('Failed to delete system:', err);
    window.UI?.error('Failed to delete system: ' + err.message);
  } finally {
    loadingClose?.();
  }
}

// Cleanup on page unload
// Cleanup listeners safely on page unload or navigation
window.addEventListener('pagehide', cleanup);
window.addEventListener('beforeunload', cleanup);
