// Enhanced Dashboard: system-scoped nested categories
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
  writeBatch,
  getDocs,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const categoriesCol = collection(db, 'categories');
const systemsCol = collection(db, 'systems');

// Get systemId from URL
const urlParams = new URLSearchParams(window.location.search);
const currentSystemId = urlParams.get('systemId');

// Redirect if no systemId
if (!currentSystemId) {
  window.location.href = 'systems.html';
}

// DOM elements
const addForm = document.getElementById('addCategoryForm');
const nameInput = document.getElementById('categoryName');
const noteInput = document.getElementById('categoryNote');
const parentSelect = document.getElementById('parentSelect');
const treeEl = document.getElementById('tree');
const countEl = document.getElementById('count');
const searchInput = document.getElementById('searchInput');
const expandAllBtn = document.getElementById('expandAll');
const collapseAllBtn = document.getElementById('collapseAll');
const importInput = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const syncStatusEl = document.getElementById('syncStatus');
const networkStatusEl = document.getElementById('networkStatus');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('emptyState');
const syncErrorEl = document.getElementById('syncError');
const syncErrorTextEl = document.getElementById('syncErrorText');
const retryBtn = document.getElementById('retrySync');
const lockAfterAdd = document.getElementById('lockAfterAdd');
const unlockAddBtn = document.getElementById('unlockAdd');
const addLockStatus = document.getElementById('addLockStatus');
const bulkDeleteBtn = document.getElementById('bulkDelete');
const selectAllBtn = document.getElementById('selectAll');
const deselectAllBtn = document.getElementById('deselectAll');
const sortSelect = document.getElementById('sortSelect');
const viewModeBtn = document.getElementById('viewMode');
const duplicateBtn = document.getElementById('duplicateBtn');
const archiveBtn = document.getElementById('archiveBtn');
const showArchivedBtn = document.getElementById('showArchived');
const systemNameEl = document.getElementById('systemName');
const backToSystemsBtn = document.getElementById('backToSystems');

// State
let unsubscribe = null;
let currentUserId = null;
let currentSystem = null;
let allDocs = [];
let currentFilter = '';
let selectedIds = new Set();
let expandedIds = new Set();
let sortMode = 'createdAt';
let viewMode = 'tree';
let showArchived = false;
let useOrderBy = true;

// Initialize auth
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUserId = user.uid;
  await loadSystemInfo();
  setupRealtime();
  loadUserPreferences();
});

// Load system information
async function loadSystemInfo() {
  try {
    const systemDoc = await getDoc(doc(db, 'systems', currentSystemId));
    if (!systemDoc.exists()) {
      window.UI?.error('System not found');
      setTimeout(() => window.location.href = 'systems.html', 1500);
      return;
    }
    
    currentSystem = { id: systemDoc.id, ...systemDoc.data() };
    
    // Update header with system name
    if (systemNameEl) {
      systemNameEl.textContent = currentSystem.icon + ' ' + currentSystem.name;
    }
    
    // Update empty state
    if (emptyEl) {
      const emptyText = emptyEl.querySelector('p');
      if (emptyText) {
        emptyText.textContent = `No categories in "${currentSystem.name}" yet`;
      }
    }
  } catch (err) {
    console.error('Failed to load system:', err);
    window.UI?.error('Failed to load system information');
  }
}

// Back to systems button
backToSystemsBtn?.addEventListener('click', () => {
  window.location.href = 'systems.html';
});

// Debounced search
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const debouncedFilter = debounce((value) => {
  currentFilter = value || '';
  renderTree(allDocs);
}, 200);

searchInput?.addEventListener('input', (e) => debouncedFilter(e.target.value));

// Network status
function setSync(text) {
  if (syncStatusEl) syncStatusEl.textContent = text;
}

function setNetwork() {
  if (!networkStatusEl) return;
  const online = navigator.onLine;
  networkStatusEl.textContent = online ? '🟢 Online' : '🔴 Offline (changes will sync when online)';
  networkStatusEl.className = online ? 'text-green-600' : 'text-orange-600';
}

setNetwork();
window.addEventListener('online', setNetwork);
window.addEventListener('offline', setNetwork);

function showSyncError(msg) {
  if (!syncErrorEl || !syncErrorTextEl) return;
  syncErrorTextEl.textContent = msg;
  syncErrorEl.classList.remove('hidden');
}

function hideSyncError() {
  if (!syncErrorEl) return;
  syncErrorEl.classList.add('hidden');
}

retryBtn?.addEventListener('click', () => {
  hideSyncError();
  setupRealtime();
});

// Setup realtime listener
function setupRealtime() {
  if (unsubscribe) unsubscribe();
  const base = [categoriesCol, where('userId', '==', currentUserId), where('systemId', '==', currentSystemId)];
  const q = useOrderBy ? query(...base, orderBy('createdAt', 'asc')) : query(...base);
  setSync('Connecting…');
  hideSyncError();
  
  unsubscribe = onSnapshot(q, (snap) => {
    setSync('✓ Synced');
    allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.toggle('hidden', allDocs.length !== 0);
    
    renderParentOptions(allDocs);
    renderTree(allDocs);
    updateStats();
  }, (err) => {
    setSync('✗ Error syncing');
    console.error('Snapshot error', err);
    showSyncError(err.message || 'Realtime sync error');
    
    if (useOrderBy) {
      useOrderBy = false;
      setupRealtime();
    }
  });
}

window.addEventListener('beforeunload', () => {
  if (unsubscribe) unsubscribe();
  saveUserPreferences();
});

// Lock/unlock adding
function setAddLocked(locked) {
  if (locked) {
    addForm?.querySelectorAll('input, textarea, select, button[type="submit"]').forEach((el) => {
      el.disabled = true;
      el.classList.add('opacity-60', 'cursor-not-allowed');
    });
    unlockAddBtn?.classList.remove('hidden');
    addLockStatus?.classList.remove('hidden');
  } else {
    addForm?.querySelectorAll('input, textarea, select, button[type="submit"]').forEach((el) => {
      el.disabled = false;
      el.classList.remove('opacity-60', 'cursor-not-allowed');
    });
    unlockAddBtn?.classList.add('hidden');
    addLockStatus?.classList.add('hidden');
    lockAfterAdd && (lockAfterAdd.checked = false);
  }
}

unlockAddBtn?.addEventListener('click', () => setAddLocked(false));

// Add category
addForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  
  const parentId = parentSelect.value || null;
  const note = noteInput.value.trim() || '';
  
  try {
    await addDoc(categoriesCol, {
      userId: currentUserId,
      systemId: currentSystemId,
      name,
      note,
      parentId,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    addForm.reset();
    
    if (lockAfterAdd?.checked) {
      setAddLocked(true);
      window.UI?.toast('Added and locked further additions', 'success');
    } else {
      window.UI?.toast('Category added successfully', 'success');
    }
  } catch (err) {
    window.UI?.toast('Failed to add category: ' + err.message, 'error');
  }
});

// Parent options
function renderParentOptions(docs) {
  const visibleDocs = showArchived ? docs : docs.filter(d => !d.archived);
  
  parentSelect.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— None (root) —';
  parentSelect.appendChild(none);
  
  for (const d of visibleDocs) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name + (d.archived ? ' [Archived]' : '');
    parentSelect.appendChild(opt);
  }
}

// Build tree structure
function buildTree(docs) {
  const idToNode = new Map();
  const roots = [];
  
  for (const d of docs) {
    idToNode.set(d.id, { ...d, children: [] });
  }
  
  for (const d of docs) {
    const node = idToNode.get(d.id);
    if (d.parentId && idToNode.has(d.parentId)) {
      idToNode.get(d.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  
  const sortFn = getSortFunction();
  sortTree(roots, sortFn);
  
  return roots;
}

function getSortFunction() {
  switch (sortMode) {
    case 'name':
      return (a, b) => (a.name || '').localeCompare(b.name || '');
    case 'updatedAt':
      return (a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    default:
      return (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  }
}

function sortTree(nodes, sortFn) {
  nodes.sort(sortFn);
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortTree(node.children, sortFn);
    }
  }
}

// Render tree
function renderTree(docs) {
  const visibleDocs = showArchived ? docs : docs.filter(d => !d.archived);
  const roots = buildTree(visibleDocs);
  
  countEl.textContent = `${visibleDocs.length} item(s)`;
  treeEl.innerHTML = '';
  
  const filtered = filterTree(roots, currentFilter);
  
  if (filtered.length === 0 && currentFilter) {
    treeEl.innerHTML = '<div class="text-sm text-gray-500 py-4">No matches found</div>';
    return;
  }
  
  if (viewMode === 'list') {
    renderListView(filtered);
  } else if (viewMode === 'grid') {
    renderGridView(filtered);
  } else {
    for (const node of filtered) {
      treeEl.appendChild(renderNode(node));
    }
  }
}

function renderListView(nodes) {
  const flat = flattenTree(nodes);
  treeEl.className = 'space-y-2';
  
  for (const node of flat) {
    const el = renderNode(node, true);
    treeEl.appendChild(el);
  }
}

function renderGridView(nodes) {
  const flat = flattenTree(nodes);
  treeEl.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
  
  for (const node of flat) {
    const el = renderNode(node, true);
    el.classList.add('h-full');
    treeEl.appendChild(el);
  }
}

function flattenTree(nodes, result = []) {
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      flattenTree(node.children, result);
    }
  }
  return result;
}

function filterTree(nodes, query) {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const res = [];
  
  for (const n of nodes) {
    const filteredChildren = filterTree(n.children, q);
    const matches = (n.name || '').toLowerCase().includes(q) || 
                   (n.note || '').toLowerCase().includes(q);
    
    if (matches || filteredChildren.length > 0) {
      res.push({ ...n, children: filteredChildren });
    }
  }
  
  return res;
}

// Render individual node
function renderNode(node, flatView = false) {
  const tpl = document.getElementById('categoryItemTemplate');
  const el = tpl.content.firstElementChild.cloneNode(true);
  
  const checkbox = el.querySelector('.selectCheckbox');
  const nameEl = el.querySelector('.name');
  const noteEl = el.querySelector('.note');
  const childrenEl = el.querySelector('.children');
  const toggleBtn = el.querySelector('.toggleBtn');
  const addChildBtn = el.querySelector('.addChild');
  const editBtn = el.querySelector('.editBtn');
  const moveBtn = el.querySelector('.moveBtn');
  const parentPicker = el.querySelector('.parentPicker');
  const saveBtn = el.querySelector('.saveBtn');
  const cancelBtn = el.querySelector('.cancelBtn');
  const nameInputInline = el.querySelector('.nameInput');
  const deleteBtn = el.querySelector('.deleteBtn');
  const duplicateNodeBtn = el.querySelector('.duplicateNode');
  const archiveNodeBtn = el.querySelector('.archiveNode');
  const viewRecordsBtn = el.querySelector('.viewRecords');
  const tagsEl = el.querySelector('.tags');
  
  // Set up the view records button
  viewRecordsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `records.html?systemId=${currentSystemId}&categoryId=${node.id}`;
  });
  
  checkbox.checked = selectedIds.has(node.id);
  checkbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectedIds.add(node.id);
    } else {
      selectedIds.delete(node.id);
    }
    updateBulkActions();
  });
  
  if (node.archived) {
    el.classList.add('opacity-60', 'bg-gray-50', 'dark:bg-gray-900');
    nameEl.classList.add('line-through');
  }
  
  nameEl.textContent = node.name;
  noteEl.textContent = node.note || '';
  if (!node.note) noteEl.classList.add('hidden');
  
  if (node.tags && node.tags.length > 0) {
    tagsEl.innerHTML = node.tags.map(tag => 
      `<span class="inline-block px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">${tag}</span>`
    ).join(' ');
  } else {
    tagsEl.classList.add('hidden');
  }
  
  if (!flatView && node.children.length > 0) {
    const isExpanded = expandedIds.has(node.id);
    
    if (isExpanded) {
      childrenEl.classList.remove('hidden');
      toggleBtn.textContent = '▾';
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    
    toggleBtn.addEventListener('click', () => {
      const isHidden = childrenEl.classList.contains('hidden');
      childrenEl.classList.toggle('hidden');
      toggleBtn.textContent = isHidden ? '▾' : '▸';
      toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      
      if (isHidden) {
        expandedIds.add(node.id);
      } else {
        expandedIds.delete(node.id);
      }
    });
    
    for (const child of node.children) {
      childrenEl.appendChild(renderNode(child));
    }
  } else if (!flatView) {
    toggleBtn.disabled = true;
    toggleBtn.classList.add('opacity-40');
    toggleBtn.setAttribute('aria-disabled', 'true');
  } else {
    toggleBtn.classList.add('hidden');
  }
  
  el.setAttribute('role', 'treeitem');
  el.setAttribute('aria-label', node.name || 'Category');
  
  addChildBtn.addEventListener('click', async () => {
    const name = await window.UI?.prompt('Enter child category name:', '', 'Add Child Category');
    if (!name) return;
    
    try {
      await addDoc(categoriesCol, {
        userId: currentUserId,
        systemId: currentSystemId,
        name: name.trim(),
        note: '',
        parentId: node.id,
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      expandedIds.add(node.id);
      window.UI?.toast('Child added successfully', 'success');
    } catch (err) {
      window.UI?.toast('Failed to add child: ' + err.message, 'error');
    }
  });
  
  editBtn.addEventListener('click', () => {
    nameInputInline.value = node.name;
    nameEl.classList.add('hidden');
    nameInputInline.classList.remove('hidden');
    saveBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    editBtn.classList.add('hidden');
    moveBtn.classList.add('hidden');
    duplicateNodeBtn?.classList.add('hidden');
    viewRecordsBtn?.classList.add('hidden');
    archiveNodeBtn?.classList.add('hidden');
  });
  
  moveBtn.addEventListener('click', () => {
    const invalid = new Set([node.id, ...collectDescendantIds(node)]);
    parentPicker.innerHTML = '';
    
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '— None (root) —';
    parentPicker.appendChild(optNone);
    
    for (const d of allDocs) {
      if (invalid.has(d.id) || (d.archived && !showArchived)) continue;
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name + (d.archived ? ' [Archived]' : '');
      if (d.id === node.parentId) opt.selected = true;
      parentPicker.appendChild(opt);
    }
    
    parentPicker.classList.remove('hidden');
    saveBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
    editBtn.classList.add('hidden');
    moveBtn.classList.add('hidden');
    duplicateNodeBtn?.classList.add('hidden');
    archiveNodeBtn?.classList.add('hidden');
  });
  
  cancelBtn.addEventListener('click', () => {
    nameEl.classList.remove('hidden');
    nameInputInline.classList.add('hidden');
    parentPicker.classList.add('hidden');
    saveBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');
    editBtn.classList.remove('hidden');
    moveBtn.classList.remove('hidden');
    duplicateNodeBtn?.classList.remove('hidden');
    viewRecordsBtn?.classList.remove('hidden');
    archiveNodeBtn?.classList.remove('hidden');
  });
  
  saveBtn.addEventListener('click', async () => {
    const updates = { updatedAt: serverTimestamp() };
    
    if (!nameInputInline.classList.contains('hidden')) {
      const newName = nameInputInline.value.trim();
      if (!newName) return window.UI?.toast('Name is required', 'error');
      updates.name = newName;
    }
    
    if (!parentPicker.classList.contains('hidden')) {
      const newParent = parentPicker.value || null;
      updates.parentId = newParent;
    }
    
    try {
      await updateDoc(doc(db, 'categories', node.id), updates);
      window.UI?.toast('Saved successfully', 'success');
      cancelBtn.click();
    } catch (err) {
      window.UI?.toast('Failed to save: ' + err.message, 'error');
    }
  });
  
  duplicateNodeBtn?.addEventListener('click', async () => {
    try {
      await duplicateCategory(node);
      window.UI?.toast('Category duplicated', 'success');
    } catch (err) {
      window.UI?.toast('Failed to duplicate: ' + err.message, 'error');
    }
  });
  
  archiveNodeBtn?.addEventListener('click', async () => {
    try {
      await updateDoc(doc(db, 'categories', node.id), {
        archived: !node.archived,
        updatedAt: serverTimestamp()
      });
      window.UI?.toast(node.archived ? 'Unarchived' : 'Archived', 'success');
    } catch (err) {
      window.UI?.toast('Failed to archive: ' + err.message, 'error');
    }
  });
  
  if (archiveNodeBtn) {
    archiveNodeBtn.textContent = node.archived ? 'Unarchive' : 'Archive';
  }
  
  deleteBtn.addEventListener('click', async () => {
    const ok = await (window.UI?.confirm(`Delete "${node.name}" and all its descendants?`) || Promise.resolve(confirm('Delete?')));
    if (!ok) return;
    
    try {
      const idsToDelete = collectDescendantIds(node);
      idsToDelete.push(node.id);
      
      const batch = writeBatch(db);
      for (const id of idsToDelete) {
        batch.delete(doc(db, 'categories', id));
      }
      await batch.commit();
      
      window.UI?.toast('Deleted successfully', 'success');
    } catch (err) {
      window.UI?.toast('Failed to delete: ' + err.message, 'error');
    }
  });
  
  return el;
}

function collectDescendantIds(node) {
  const ids = [];
  for (const child of node.children) {
    ids.push(child.id);
    ids.push(...collectDescendantIds(child));
  }
  return ids;
}

async function duplicateCategory(node, parentId = node.parentId) {
  const newDoc = await addDoc(categoriesCol, {
    userId: currentUserId,
    systemId: currentSystemId,
    name: node.name + ' (Copy)',
    note: node.note || '',
    parentId: parentId,
    archived: false,
    tags: node.tags || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  for (const child of node.children) {
    await duplicateCategory(child, newDoc.id);
  }
  
  return newDoc.id;
}

expandAllBtn?.addEventListener('click', () => {
  allDocs.forEach(doc => expandedIds.add(doc.id));
  treeEl.querySelectorAll('.children').forEach((c) => c.classList.remove('hidden'));
  treeEl.querySelectorAll('.toggleBtn').forEach((b) => {
    b.textContent = '▾';
    b.setAttribute('aria-expanded', 'true');
  });
});

collapseAllBtn?.addEventListener('click', () => {
  expandedIds.clear();
  treeEl.querySelectorAll('.children').forEach((c) => c.classList.add('hidden'));
  treeEl.querySelectorAll('.toggleBtn').forEach((b) => {
    b.textContent = '▸';
    b.setAttribute('aria-expanded', 'false');
  });
});

selectAllBtn?.addEventListener('click', () => {
  selectedIds = new Set(allDocs.map(d => d.id));
  renderTree(allDocs);
  updateBulkActions();
});

deselectAllBtn?.addEventListener('click', () => {
  selectedIds.clear();
  renderTree(allDocs);
  updateBulkActions();
});

function updateBulkActions() {
  const count = selectedIds.size;
  bulkDeleteBtn?.classList.toggle('hidden', count === 0);
  duplicateBtn?.classList.toggle('hidden', count === 0);
  archiveBtn?.classList.toggle('hidden', count === 0);
  
  if (bulkDeleteBtn) bulkDeleteBtn.textContent = `Delete ${count} selected`;
  if (duplicateBtn) duplicateBtn.textContent = `Duplicate ${count} selected`;
  if (archiveBtn) archiveBtn.textContent = `Archive ${count} selected`;
}

bulkDeleteBtn?.addEventListener('click', async () => {
  const ok = await (window.UI?.confirm(`Delete ${selectedIds.size} selected categories?`) || Promise.resolve(confirm('Delete?')));
  if (!ok) return;
  
  try {
    const batch = writeBatch(db);
    for (const id of selectedIds) {
      batch.delete(doc(db, 'categories', id));
    }
    await batch.commit();
    
    selectedIds.clear();
    updateBulkActions();
    window.UI?.toast('Deleted successfully', 'success');
  } catch (err) {
    window.UI?.toast('Failed to delete: ' + err.message, 'error');
  }
});

duplicateBtn?.addEventListener('click', async () => {
  try {
    for (const id of selectedIds) {
      const node = allDocs.find(d => d.id === id);
      if (node) {
        await duplicateCategory({ ...node, children: [] });
      }
    }
    selectedIds.clear();
    updateBulkActions();
    window.UI?.toast('Duplicated successfully', 'success');
  } catch (err) {
    window.UI?.toast('Failed to duplicate: ' + err.message, 'error');
  }
});

archiveBtn?.addEventListener('click', async () => {
  try {
    const batch = writeBatch(db);
    for (const id of selectedIds) {
      batch.update(doc(db, 'categories', id), {
        archived: true,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
    
    selectedIds.clear();
    updateBulkActions();
    window.UI?.toast('Archived successfully', 'success');
  } catch (err) {
    window.UI?.toast('Failed to archive: ' + err.message, 'error');
  }
});

sortSelect?.addEventListener('change', (e) => {
  sortMode = e.target.value;
  renderTree(allDocs);
  saveUserPreferences();
});

viewModeBtn?.addEventListener('click', () => {
  const modes = ['tree', 'list', 'grid'];
  const current = modes.indexOf(viewMode);
  viewMode = modes[(current + 1) % modes.length];
  
  viewModeBtn.textContent = `View: ${viewMode}`;
  treeEl.className = 'text-sm';
  renderTree(allDocs);
  saveUserPreferences();
});

showArchivedBtn?.addEventListener('click', () => {
  showArchived = !showArchived;
  showArchivedBtn.textContent = showArchived ? 'Hide Archived' : 'Show Archived';
  showArchivedBtn.classList.toggle('bg-blue-600', showArchived);
  showArchivedBtn.classList.toggle('text-white', showArchived);
  renderParentOptions(allDocs);
  renderTree(allDocs);
  saveUserPreferences();
});

function updateStats() {
  const statsEl = document.getElementById('stats');
  if (!statsEl) return;
  
  const total = allDocs.length;
  const archived = allDocs.filter(d => d.archived).length;
  const roots = allDocs.filter(d => !d.parentId).length;
  
  statsEl.innerHTML = `
    <div class="text-xs text-gray-500 space-y-1">
      <div>Total: ${total}</div>
      <div>Root: ${roots}</div>
      <div>Archived: ${archived}</div>
    </div>
  `;
}

exportBtn?.addEventListener('click', () => {
  const data = allDocs.map(({ id, userId, systemId, name, note, parentId, archived, tags }) => 
    ({ id, userId, systemId, name, note, parentId, archived: archived || false, tags: tags || [] })
  );
  
  const blob = new Blob([JSON.stringify({ 
    system: currentSystem,
    categories: data, 
    exportDate: new Date().toISOString() 
  }, null, 2)], { type: 'application/json' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentSystem.name}-categories-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  window.UI?.toast('Exported successfully', 'success');
});

importBtn?.addEventListener('click', async () => {
  if (!importInput?.files?.length) return window.UI?.toast('Choose a JSON file first', 'error');
  
  try {
    const text = await importInput.files[0].text();
    const json = JSON.parse(text);
    const items = Array.isArray(json) ? json : Array.isArray(json.categories) ? json.categories : [];
    
    if (!items.length) return window.UI?.toast('No categories found in file', 'error');
    
    const idToItem = new Map(items.map(i => [i.id, i]));
    
    function depth(item) {
      let d = 0;
      let p = item.parentId;
      while (p) {
        d++;
        const pi = idToItem.get(p);
        p = pi ? pi.parentId : null;
        if (d > 1000) break;
      }
      return d;
    }
    
    items.sort((a, b) => depth(a) - depth(b));
    
    const oldToNew = new Map();
    const batch = writeBatch(db);
    let count = 0;
    
    for (const it of items) {
      const newParent = it.parentId ? (oldToNew.get(it.parentId) || null) : null;
      const ref = doc(collection(db, 'categories'));
      
      batch.set(ref, {
        userId: currentUserId,
        systemId: currentSystemId,
        name: it.name || 'Untitled',
        note: it.note || '',
        parentId: newParent,
        archived: it.archived || false,
        tags: it.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      oldToNew.set(it.id, ref.id);
      count++;
      
      if (count % 450 === 0) {
        await batch.commit();
      }
    }
    
    if (count % 450 !== 0) {
      await batch.commit();
    }
    
    window.UI?.toast(`Imported ${items.length} categories`, 'success');
    importInput.value = '';
  } catch (e) {
    window.UI?.toast('Import failed: ' + e.message, 'error');
  }
});

function saveUserPreferences() {
  try {
    const key = `categoryPreferences_${currentSystemId}`;
    localStorage.setItem(key, JSON.stringify({
      sortMode,
      viewMode,
      showArchived,
      expandedIds: Array.from(expandedIds)
    }));
  } catch (e) {
    console.error('Failed to save preferences', e);
  }
}

function loadUserPreferences() {
  try {
    const key = `categoryPreferences_${currentSystemId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const prefs = JSON.parse(saved);
      sortMode = prefs.sortMode || 'createdAt';
      viewMode = prefs.viewMode || 'tree';
      showArchived = prefs.showArchived || false;
      expandedIds = new Set(prefs.expandedIds || []);
      
      if (sortSelect) sortSelect.value = sortMode;
      if (viewModeBtn) viewModeBtn.textContent = `View: ${viewMode}`;
      if (showArchivedBtn) {
        showArchivedBtn.textContent = showArchived ? 'Hide Archived' : 'Show Archived';
        showArchivedBtn.classList.toggle('bg-blue-600', showArchived);
        showArchivedBtn.classList.toggle('text-white', showArchived);
      }
    }
  } catch (e) {
    console.error('Failed to load preferences', e);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'f') {
      e.preventDefault();
      searchInput?.focus();
    } else if (e.key === 'e') {
      e.preventDefault();
      expandAllBtn?.click();
    } else if (e.key === 'c') {
      e.preventDefault();
      collapseAllBtn?.click();
    }
  }
});