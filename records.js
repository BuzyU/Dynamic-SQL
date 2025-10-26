// Records Management System with Relations
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
  getDocs,
  getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Collections
const recordsCol = collection(db, 'records');
const relationsCol = collection(db, 'relations');
const categoriesCol = collection(db, 'categories');
const systemsCol = collection(db, 'systems');

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const currentSystemId = urlParams.get('systemId');
const currentCategoryId = urlParams.get('categoryId');

// Redirect if missing parameters
if (!currentSystemId || !currentCategoryId) {
  window.location.href = 'systems.html';
}

// DOM elements
const addRecordForm = document.getElementById('addRecordForm');
const recordTitle = document.getElementById('recordTitle');
const recordDescription = document.getElementById('recordDescription');
const recordStatus = document.getElementById('recordStatus');
const customFieldsList = document.getElementById('customFieldsList');
const addCustomFieldBtn = document.getElementById('addCustomField');
const recordsGrid = document.getElementById('recordsGrid');
const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('emptyState');
const recordCount = document.getElementById('recordCount');
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const viewModeBtn = document.getElementById('viewMode');
const lockAfterAdd = document.getElementById('lockAfterAdd');
const unlockAddBtn = document.getElementById('unlockAdd');
const addLockStatus = document.getElementById('addLockStatus');

// Modal elements
const recordDetailModal = document.getElementById('recordDetailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const customFieldModal = document.getElementById('customFieldModal');
const addRelationModal = document.getElementById('addRelationModal');

// State
let unsubscribe = null;
let currentUserId = null;
let currentSystem = null;
let currentCategory = null;
let allRecords = [];
let allRelations = [];
let currentFilter = '';
let statusFilter = '';
let viewMode = 'grid';
let customFields = [];
let currentRecord = null;

// Initialize auth
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUserId = user.uid;
  await loadSystemAndCategory();
  setupRealtimeRecords();
  setupRealtimeRelations();
  loadPreferences();
});

// Load system and category info
async function loadSystemAndCategory() {
  try {
    const systemDoc = await getDoc(doc(db, 'systems', currentSystemId));
    const categoryDoc = await getDoc(doc(db, 'categories', currentCategoryId));
    
    if (!systemDoc.exists() || !categoryDoc.exists()) {
      window.UI?.error('System or category not found');
      setTimeout(() => window.location.href = 'systems.html', 1500);
      return;
    }
    
    currentSystem = { id: systemDoc.id, ...systemDoc.data() };
    currentCategory = { id: categoryDoc.id, ...categoryDoc.data() };
    
    // Update breadcrumb
    const systemLink = document.getElementById('systemLink');
    const categoryLink = document.getElementById('categoryLink');
    
    if (systemLink) {
      systemLink.textContent = currentSystem.icon + ' ' + currentSystem.name;
      systemLink.href = `dashboard.html?systemId=${currentSystemId}`;
    }
    
    if (categoryLink) {
      categoryLink.textContent = currentCategory.name;
      categoryLink.href = `dashboard.html?systemId=${currentSystemId}`;
    }
  } catch (err) {
    console.error('Failed to load system/category:', err);
    window.UI?.error('Failed to load information');
  }
}

// Setup realtime listener for records
function setupRealtimeRecords() {
  if (unsubscribe) unsubscribe();
  
  const q = query(
    recordsCol,
    where('userId', '==', currentUserId),
    where('systemId', '==', currentSystemId),
    where('categoryId', '==', currentCategoryId),
    orderBy('createdAt', 'desc')
  );
  
  unsubscribe = onSnapshot(q, (snap) => {
    allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (loadingEl) loadingEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.toggle('hidden', allRecords.length !== 0);
    
    renderRecords();
    updateRecordCount();
  }, (err) => {
    console.error('Records snapshot error:', err);
    window.UI?.error('Failed to load records: ' + err.message);
  });
}

// Setup realtime listener for relations
function setupRealtimeRelations() {
  const q = query(
    relationsCol,
    where('userId', '==', currentUserId),
    where('systemId', '==', currentSystemId)
  );
  
  onSnapshot(q, (snap) => {
    allRelations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, (err) => {
    console.error('Relations snapshot error:', err);
  });
}

// Update record count
function updateRecordCount() {
  if (recordCount) {
    recordCount.textContent = `${allRecords.length} record${allRecords.length !== 1 ? 's' : ''}`;
  }
}

// Custom Fields Management
let tempCustomFields = [];

addCustomFieldBtn?.addEventListener('click', () => {
  customFieldModal?.classList.remove('hidden');
  document.getElementById('fieldLabel').value = '';
  document.getElementById('fieldValue').value = '';
  document.getElementById('fieldType').value = 'text';
  document.getElementById('fieldRequired').checked = false;
});

document.getElementById('saveFieldBtn')?.addEventListener('click', () => {
  const label = document.getElementById('fieldLabel').value.trim();
  const type = document.getElementById('fieldType').value;
  const value = document.getElementById('fieldValue').value.trim();
  const required = document.getElementById('fieldRequired').checked;
  
  if (!label) {
    window.UI?.error('Field label is required');
    return;
  }
  
  const field = {
    id: 'field_' + Date.now(),
    label,
    type,
    value,
    required,
    order: tempCustomFields.length
  };
  
  tempCustomFields.push(field);
  renderCustomFieldsList();
  customFieldModal?.classList.add('hidden');
});

document.getElementById('cancelFieldBtn')?.addEventListener('click', () => {
  customFieldModal?.classList.add('hidden');
});

function renderCustomFieldsList() {
  if (!customFieldsList) return;
  
  customFieldsList.innerHTML = '';
  
  tempCustomFields.forEach((field, idx) => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded';
    div.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium truncate">${field.label}</div>
        <div class="text-xs text-gray-500">${field.value || '(no value)'}</div>
      </div>
      <button class="text-red-600 hover:text-red-700 text-sm" onclick="removeCustomField(${idx})">×</button>
    `;
    customFieldsList.appendChild(div);
  });
}

window.removeCustomField = (idx) => {
  tempCustomFields.splice(idx, 1);
  renderCustomFieldsList();
};

// Add Record
addRecordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = recordTitle.value.trim();
  const description = recordDescription.value.trim();
  const status = recordStatus.value;
  
  if (!title) {
    window.UI?.error('Title is required');
    return;
  }
  
  const loadingClose = window.UI?.loading('Creating record...');
  
  try {
    await addDoc(recordsCol, {
      userId: currentUserId,
      systemId: currentSystemId,
      categoryId: currentCategoryId,
      title,
      description,
      status,
      customFields: tempCustomFields,
      relations: [],
      tags: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archived: false
    });
    
    addRecordForm.reset();
    tempCustomFields = [];
    renderCustomFieldsList();
    
    if (lockAfterAdd?.checked) {
      setAddLocked(true);
      window.UI?.success('Record created and form locked');
    } else {
      window.UI?.success('Record created successfully');
    }
  } catch (err) {
    console.error('Failed to create record:', err);
    window.UI?.error('Failed to create record: ' + err.message);
  } finally {
    loadingClose?.();
  }
});

// Lock/unlock mechanism
function setAddLocked(locked) {
  if (locked) {
    addRecordForm?.querySelectorAll('input, textarea, select, button[type="submit"]').forEach((el) => {
      el.disabled = true;
      el.classList.add('opacity-60', 'cursor-not-allowed');
    });
    unlockAddBtn?.classList.remove('hidden');
    addLockStatus?.classList.remove('hidden');
    addCustomFieldBtn?.classList.add('pointer-events-none', 'opacity-60');
  } else {
    addRecordForm?.querySelectorAll('input, textarea, select, button[type="submit"]').forEach((el) => {
      el.disabled = false;
      el.classList.remove('opacity-60', 'cursor-not-allowed');
    });
    unlockAddBtn?.classList.add('hidden');
    addLockStatus?.classList.add('hidden');
    addCustomFieldBtn?.classList.remove('pointer-events-none', 'opacity-60');
    if (lockAfterAdd) lockAfterAdd.checked = false;
  }
}

unlockAddBtn?.addEventListener('click', () => setAddLocked(false));

// Render records
function renderRecords() {
  if (!recordsGrid) return;
  
  let filtered = allRecords;
  
  // Filter by search
  if (currentFilter) {
    const query = currentFilter.toLowerCase();
    filtered = filtered.filter(r => 
      r.title.toLowerCase().includes(query) ||
      r.description?.toLowerCase().includes(query) ||
      r.customFields?.some(f => f.value.toLowerCase().includes(query))
    );
  }
  
  // Filter by status
  if (statusFilter) {
    filtered = filtered.filter(r => r.status === statusFilter);
  }
  
  recordsGrid.innerHTML = '';
  recordsGrid.classList.remove('hidden');
  
  if (viewMode === 'list') {
    recordsGrid.className = 'space-y-3';
  } else {
    recordsGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
  }
  
  filtered.forEach(record => {
    const card = renderRecordCard(record);
    recordsGrid.appendChild(card);
  });
  
  if (filtered.length === 0 && (currentFilter || statusFilter)) {
    recordsGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">No records found</div>';
  }
}

// Render record card
function renderRecordCard(record) {
  const template = document.getElementById('recordCardTemplate');
  const el = template.content.firstElementChild.cloneNode(true);
  
  const title = el.querySelector('.record-title');
  const status = el.querySelector('.record-status');
  const description = el.querySelector('.record-description');
  const fields = el.querySelector('.record-fields');
  const relationCount = el.querySelector('.relation-count');
  const fieldsCount = el.querySelector('.fields-count');
  const date = el.querySelector('.record-date');
  
  title.textContent = record.title;
  
  // Status badge
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    archived: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
  };
  status.className = `record-status text-xs px-2 py-0.5 rounded ${statusColors[record.status] || statusColors.draft}`;
  status.textContent = record.status.charAt(0).toUpperCase() + record.status.slice(1);
  
  description.textContent = record.description || 'No description';
  
  // Show first 2 custom fields
  if (record.customFields && record.customFields.length > 0) {
    const displayFields = record.customFields.slice(0, 2);
    fields.innerHTML = displayFields.map(f => 
      `<div class="text-gray-600 dark:text-gray-400"><span class="font-medium">${f.label}:</span> ${f.value}</div>`
    ).join('');
  } else {
    fields.innerHTML = '<div class="text-gray-400">No custom fields</div>';
  }
  
  // Relation count
  const relations = allRelations.filter(r => 
    r.sourceRecordId === record.id || r.targetRecordId === record.id
  );
  relationCount.textContent = relations.length;
  
  fieldsCount.textContent = record.customFields?.length || 0;
  
  if (record.createdAt) {
    const createdDate = record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
    date.textContent = createdDate.toLocaleDateString();
  }
  
  // Click to view details
  el.addEventListener('click', () => openRecordDetail(record));
  
  return el;
}

// Open record detail modal
function openRecordDetail(record) {
  currentRecord = record;
  
  document.getElementById('detailTitle').textContent = record.title;
  document.getElementById('detailDescription').textContent = record.description || 'No description';
  
  const statusEl = document.getElementById('detailStatus');
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-orange-100 text-orange-800'
  };
  statusEl.className = `inline-block px-3 py-1 rounded text-sm ${statusColors[record.status]}`;
  statusEl.textContent = record.status.charAt(0).toUpperCase() + record.status.slice(1);
  
  // Custom fields
  const customFieldsDiv = document.getElementById('detailCustomFields');
  if (record.customFields && record.customFields.length > 0) {
    customFieldsDiv.innerHTML = record.customFields.map(f => `
      <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded">
        <span class="font-medium text-sm">${f.label}</span>
        <span class="text-sm text-gray-600 dark:text-gray-400">${f.value}</span>
      </div>
    `).join('');
  } else {
    customFieldsDiv.innerHTML = '<div class="text-gray-500 text-sm">No custom fields</div>';
  }
  
  // Relations
  renderRelationsList(record);
  
  // Activity timestamps
  if (record.createdAt) {
    const created = record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
    document.getElementById('detailCreatedAt').textContent = created.toLocaleString();
  }
  
  if (record.updatedAt) {
    const updated = record.updatedAt.toDate ? record.updatedAt.toDate() : new Date(record.updatedAt);
    document.getElementById('detailUpdatedAt').textContent = updated.toLocaleString();
  }
  
  recordDetailModal?.classList.remove('hidden');
  
  // Switch to overview tab
  switchTab('overview');
}

// Render relations list
function renderRelationsList(record) {
  const relationsList = document.getElementById('relationsList');
  if (!relationsList) return;
  
  const recordRelations = allRelations.filter(r => 
    r.sourceRecordId === record.id || r.targetRecordId === record.id
  );
  
  if (recordRelations.length === 0) {
    relationsList.innerHTML = '<div class="text-gray-500 text-sm">No relations yet</div>';
    return;
  }
  
  relationsList.innerHTML = '';
  
  recordRelations.forEach(async (relation) => {
    const isSource = relation.sourceRecordId === record.id;
    const targetId = isSource ? relation.targetRecordId : relation.sourceRecordId;
    
    // Get target record
    try {
      const targetDoc = await getDoc(doc(db, 'records', targetId));
      if (!targetDoc.exists()) return;
      
      const targetRecord = targetDoc.data();
      
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer';
      div.innerHTML = `
        <div class="flex items-center gap-3 flex-1">
          <span class="text-2xl">🔗</span>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">${targetRecord.title}</div>
            <div class="text-xs text-gray-500">${relation.relationType.replace(/_/g, ' ')}</div>
            ${relation.description ? `<div class="text-xs text-gray-400 mt-1">${relation.description}</div>` : ''}
          </div>
        </div>
        <button class="text-red-600 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50" data-relation-id="${relation.id}">Remove</button>
      `;
      
      // Click to navigate
      div.addEventListener('click', (e) => {
        if (!e.target.hasAttribute('data-relation-id')) {
          openRecordDetail({ id: targetId, ...targetRecord });
        }
      });
      
      // Remove relation
      div.querySelector('button').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await window.UI?.confirm('Remove this relation?');
        if (confirmed) {
          try {
            await deleteDoc(doc(db, 'relations', relation.id));
            window.UI?.success('Relation removed');
            renderRelationsList(record);
          } catch (err) {
            window.UI?.error('Failed to remove relation');
          }
        }
      });
      
      relationsList.appendChild(div);
    } catch (err) {
      console.error('Failed to load target record:', err);
    }
  });
}

// Tab switching
document.querySelectorAll('.detail-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.detail-tab').forEach(t => {
    t.classList.remove('border-blue-600', 'text-blue-600');
    t.classList.add('border-transparent');
  });
  
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.add('hidden');
  });
  
  const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
  activeTab?.classList.add('border-blue-600', 'text-blue-600');
  activeTab?.classList.remove('border-transparent');
  
  const content = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  content?.classList.remove('hidden');
}

// Close modal
closeDetailModal?.addEventListener('click', () => {
  recordDetailModal?.classList.add('hidden');
  currentRecord = null;
});

// Add relation
document.getElementById('addRelationBtn')?.addEventListener('click', async () => {
  // Load all records for selection
  const allRecordsQuery = query(
    recordsCol,
    where('userId', '==', currentUserId),
    where('systemId', '==', currentSystemId)
  );
  
  try {
    const snapshot = await getDocs(allRecordsQuery);
    const records = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.id !== currentRecord.id); // Exclude current record
    
    const targetSelect = document.getElementById('relationTarget');
    targetSelect.innerHTML = '<option value="">-- Select a record --</option>';
    
    records.forEach(record => {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = `${record.title} (${record.status})`;
      targetSelect.appendChild(option);
    });
    
    addRelationModal?.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load records:', err);
    window.UI?.error('Failed to load records for relation');
  }
});

// Relation type change handler
document.getElementById('relationType')?.addEventListener('change', (e) => {
  const customDiv = document.getElementById('customRelationTypeDiv');
  if (e.target.value === 'custom') {
    customDiv?.classList.remove('hidden');
  } else {
    customDiv?.classList.add('hidden');
  }
});

// Search relations
document.getElementById('relationSearch')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const options = document.getElementById('relationTarget').options;
  
  for (let i = 1; i < options.length; i++) {
    const text = options[i].textContent.toLowerCase();
    options[i].style.display = text.includes(query) ? '' : 'none';
  }
});

// Save relation
document.getElementById('saveRelationBtn')?.addEventListener('click', async () => {
  const targetId = document.getElementById('relationTarget').value;
  let relationType = document.getElementById('relationType').value;
  const relationDesc = document.getElementById('relationDescription').value.trim();
  
  if (!targetId) {
    window.UI?.error('Please select a target record');
    return;
  }
  
  if (relationType === 'custom') {
    const customType = document.getElementById('customRelationType').value.trim();
    if (!customType) {
      window.UI?.error('Please enter a custom relation type');
      return;
    }
    relationType = customType;
  }
  
  const loadingClose = window.UI?.loading('Creating relation...');
  
  try {
    // Create bidirectional relation
    await addDoc(relationsCol, {
      userId: currentUserId,
      systemId: currentSystemId,
      sourceRecordId: currentRecord.id,
      targetRecordId: targetId,
      relationType,
      description: relationDesc,
      createdAt: serverTimestamp()
    });
    
    window.UI?.success('Relation created successfully');
    addRelationModal?.classList.add('hidden');
    renderRelationsList(currentRecord);
    
    // Reset form
    document.getElementById('relationTarget').value = '';
    document.getElementById('relationType').value = 'related_to';
    document.getElementById('relationDescription').value = '';
    document.getElementById('customRelationType').value = '';
    document.getElementById('customRelationTypeDiv')?.classList.add('hidden');
  } catch (err) {
    console.error('Failed to create relation:', err);
    window.UI?.error('Failed to create relation: ' + err.message);
  } finally {
    loadingClose?.();
  }
});

document.getElementById('cancelRelationBtn')?.addEventListener('click', () => {
  addRelationModal?.classList.add('hidden');
});

// Edit record
document.getElementById('editRecordBtn')?.addEventListener('click', async () => {
  if (!currentRecord) return;
  
  const title = await window.UI?.prompt('Edit title:', currentRecord.title, 'Edit Record');
  if (!title) return;
  
  const description = await window.UI?.prompt('Edit description:', currentRecord.description || '', 'Edit Description');
  
  const loadingClose = window.UI?.loading('Updating record...');
  
  try {
    await updateDoc(doc(db, 'records', currentRecord.id), {
      title: title.trim(),
      description: description?.trim() || '',
      updatedAt: serverTimestamp()
    });
    
    window.UI?.success('Record updated successfully');
    recordDetailModal?.classList.add('hidden');
  } catch (err) {
    console.error('Failed to update record:', err);
    window.UI?.error('Failed to update record: ' + err.message);
  } finally {
    loadingClose?.();
  }
});

// Delete record
document.getElementById('deleteRecordBtn')?.addEventListener('click', async () => {
  if (!currentRecord) return;
  
  const confirmed = await window.UI?.confirm(
    `Delete "${currentRecord.title}"? This will also remove all its relations.`,
    {
      title: 'Delete Record',
      okText: 'Delete',
      type: 'danger',
      dangerous: true
    }
  );
  
  if (!confirmed) return;
  
  const loadingClose = window.UI?.loading('Deleting record...');
  
  try {
    // Delete all relations
    const recordRelations = allRelations.filter(r => 
      r.sourceRecordId === currentRecord.id || r.targetRecordId === currentRecord.id
    );
    
    const batch = writeBatch(db);
    recordRelations.forEach(rel => {
      batch.delete(doc(db, 'relations', rel.id));
    });
    
    // Delete record
    batch.delete(doc(db, 'records', currentRecord.id));
    
    await batch.commit();
    
    window.UI?.success('Record deleted successfully');
    recordDetailModal?.classList.add('hidden');
  } catch (err) {
    console.error('Failed to delete record:', err);
    window.UI?.error('Failed to delete record: ' + err.message);
  } finally {
    loadingClose?.();
  }
});

// Search and filter
searchInput?.addEventListener('input', (e) => {
  currentFilter = e.target.value.trim();
  renderRecords();
});

filterStatus?.addEventListener('change', (e) => {
  statusFilter = e.target.value;
  renderRecords();
});

// View mode toggle
viewModeBtn?.addEventListener('click', () => {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  viewModeBtn.textContent = `View: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}`;
  renderRecords();
  savePreferences();
});

// Save preferences
function savePreferences() {
  try {
    const key = `recordPreferences_${currentCategoryId}`;
    localStorage.setItem(key, JSON.stringify({
      viewMode,
      statusFilter
    }));
  } catch (e) {
    console.error('Failed to save preferences', e);
  }
}

// Load preferences
function loadPreferences() {
  try {
    const key = `recordPreferences_${currentCategoryId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const prefs = JSON.parse(saved);
      viewMode = prefs.viewMode || 'grid';
      statusFilter = prefs.statusFilter || '';
      
      if (viewModeBtn) {
        viewModeBtn.textContent = `View: ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}`;
      }
      if (filterStatus) {
        filterStatus.value = statusFilter;
      }
    }
  } catch (e) {
    console.error('Failed to load preferences', e);
  }
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (unsubscribe) unsubscribe();
  savePreferences();
});