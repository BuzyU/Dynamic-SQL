// Helper utilities for Dynamic Categories
// Add this file as: helpers.js

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp, includeTime = false) {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return date.toLocaleDateString('en-US', options);
  }
  
  /**
   * Format relative time (e.g., "2 hours ago")
   */
  export function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    
    return formatDate(timestamp);
  }
  
  /**
   * Calculate tree depth
   */
  export function getTreeDepth(node) {
    if (!node.children || node.children.length === 0) return 0;
    return 1 + Math.max(...node.children.map(getTreeDepth));
  }
  
  /**
   * Count total descendants
   */
  export function countDescendants(node) {
    if (!node.children || node.children.length === 0) return 0;
    return node.children.length + node.children.reduce((sum, child) => sum + countDescendants(child), 0);
  }
  
  /**
   * Get all leaf nodes (categories without children)
   */
  export function getLeafNodes(nodes, result = []) {
    for (const node of nodes) {
      if (!node.children || node.children.length === 0) {
        result.push(node);
      } else {
        getLeafNodes(node.children, result);
      }
    }
    return result;
  }
  
  /**
   * Get path to root (breadcrumb trail)
   */
  export function getPathToRoot(nodeId, allDocs) {
    const path = [];
    let currentId = nodeId;
    
    while (currentId) {
      const node = allDocs.find(d => d.id === currentId);
      if (!node) break;
      path.unshift(node);
      currentId = node.parentId;
    }
    
    return path;
  }
  
  /**
   * Validate category name
   */
  export function validateCategoryName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Name is required' };
    }
    
    const trimmed = name.trim();
    
    if (trimmed.length === 0) {
      return { valid: false, error: 'Name cannot be empty' };
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: 'Name is too long (max 100 characters)' };
    }
    
    return { valid: true, value: trimmed };
  }
  
  /**
   * Check for circular dependencies
   */
  export function hasCircularDependency(nodeId, newParentId, allDocs) {
    if (!newParentId) return false;
    if (nodeId === newParentId) return true;
    
    let currentId = newParentId;
    const visited = new Set();
    
    while (currentId) {
      if (currentId === nodeId) return true;
      if (visited.has(currentId)) return true; // Cycle detected
      
      visited.add(currentId);
      const parent = allDocs.find(d => d.id === currentId);
      currentId = parent?.parentId;
    }
    
    return false;
  }
  
  /**
   * Generate unique color for category
   */
  export function getCategoryColor(name) {
    const colors = [
      'bg-red-100 text-red-800',
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-orange-100 text-orange-800'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash = hash & hash;
    }
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  /**
   * Export tree to different formats
   */
  export function exportToFormat(tree, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(tree, null, 2);
      
      case 'csv':
        return exportToCSV(tree);
      
      case 'markdown':
        return exportToMarkdown(tree);
      
      case 'html':
        return exportToHTML(tree);
      
      default:
        return JSON.stringify(tree, null, 2);
    }
  }
  
  function exportToCSV(nodes, depth = 0) {
    let csv = depth === 0 ? 'Name,Note,Depth,Parent\n' : '';
    
    for (const node of nodes) {
      const name = `"${(node.name || '').replace(/"/g, '""')}"`;
      const note = `"${(node.note || '').replace(/"/g, '""')}"`;
      csv += `${name},${note},${depth},"${node.parentId || ''}"\n`;
      
      if (node.children && node.children.length > 0) {
        csv += exportToCSV(node.children, depth + 1);
      }
    }
    
    return csv;
  }
  
  function exportToMarkdown(nodes, depth = 0) {
    let md = '';
    
    for (const node of nodes) {
      const indent = '  '.repeat(depth);
      md += `${indent}- **${node.name}**`;
      if (node.note) md += ` - ${node.note}`;
      md += '\n';
      
      if (node.children && node.children.length > 0) {
        md += exportToMarkdown(node.children, depth + 1);
      }
    }
    
    return md;
  }
  
  function exportToHTML(nodes, depth = 0) {
    if (depth === 0) {
      return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Categories Export</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      ul { list-style-type: none; }
      li { margin: 5px 0; }
      .name { font-weight: bold; }
      .note { color: #666; font-size: 0.9em; margin-left: 10px; }
    </style>
  </head>
  <body>
    <h1>Categories Export</h1>
    <ul>
  ${exportToHTML(nodes, 1)}
    </ul>
  </body>
  </html>`;
    }
    
    let html = '';
    
    for (const node of nodes) {
      html += `${'  '.repeat(depth)}<li>\n`;
      html += `${'  '.repeat(depth + 1)}<span class="name">${escapeHtml(node.name)}</span>\n`;
      if (node.note) {
        html += `${'  '.repeat(depth + 1)}<span class="note">${escapeHtml(node.note)}</span>\n`;
      }
      
      if (node.children && node.children.length > 0) {
        html += `${'  '.repeat(depth + 1)}<ul>\n`;
        html += exportToHTML(node.children, depth + 2);
        html += `${'  '.repeat(depth + 1)}</ul>\n`;
      }
      
      html += `${'  '.repeat(depth)}</li>\n`;
    }
    
    return html;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Search tree with advanced options
   */
  export function searchTree(nodes, query, options = {}) {
    const {
      caseSensitive = false,
      exactMatch = false,
      searchFields = ['name', 'note']
    } = options;
    
    const searchTerm = caseSensitive ? query : query.toLowerCase();
    const results = [];
    
    function search(nodes) {
      for (const node of nodes) {
        let matches = false;
        
        for (const field of searchFields) {
          const value = node[field];
          if (!value) continue;
          
          const fieldValue = caseSensitive ? value : value.toLowerCase();
          
          if (exactMatch) {
            matches = fieldValue === searchTerm;
          } else {
            matches = fieldValue.includes(searchTerm);
          }
          
          if (matches) break;
        }
        
        if (matches) {
          results.push(node);
        }
        
        if (node.children && node.children.length > 0) {
          search(node.children);
        }
      }
    }
    
    search(nodes);
    return results;
  }
  
  /**
   * Sort nodes by multiple criteria
   */
  export function sortNodes(nodes, criteria = []) {
    const sorted = [...nodes];
    
    sorted.sort((a, b) => {
      for (const { field, order = 'asc' } of criteria) {
        let aVal = a[field];
        let bVal = b[field];
        
        // Handle timestamps
        if (aVal && aVal.seconds) aVal = aVal.seconds;
        if (bVal && bVal.seconds) bVal = bVal.seconds;
        
        // Handle nulls
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        let comparison = 0;
        
        if (typeof aVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else {
          comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        }
        
        if (comparison !== 0) {
          return order === 'desc' ? -comparison : comparison;
        }
      }
      
      return 0;
    });
    
    return sorted;
  }
  
  /**
   * Calculate statistics for a tree
   */
  export function calculateStats(nodes) {
    let totalNodes = 0;
    let totalLeaves = 0;
    let maxDepth = 0;
    let totalNotes = 0;
    
    function traverse(nodes, depth = 0) {
      maxDepth = Math.max(maxDepth, depth);
      
      for (const node of nodes) {
        totalNodes++;
        if (node.note) totalNotes++;
        
        if (!node.children || node.children.length === 0) {
          totalLeaves++;
        } else {
          traverse(node.children, depth + 1);
        }
      }
    }
    
    traverse(nodes);
    
    return {
      totalNodes,
      totalLeaves,
      totalBranches: totalNodes - totalLeaves,
      maxDepth,
      totalNotes,
      averageChildrenPerNode: totalNodes > 0 ? (totalNodes - 1) / totalNodes : 0
    };
  }
  
  /**
   * Clone a tree deeply
   */
  export function cloneTree(nodes) {
    return nodes.map(node => ({
      ...node,
      children: node.children ? cloneTree(node.children) : []
    }));
  }
  
  /**
   * Merge two trees
   */
  export function mergeTrees(tree1, tree2) {
    const merged = cloneTree(tree1);
    const idMap = new Map();
    
    function buildMap(nodes) {
      for (const node of nodes) {
        idMap.set(node.id, node);
        if (node.children) buildMap(node.children);
      }
    }
    
    buildMap(merged);
    
    function addNodes(nodes, parent = null) {
      for (const node of nodes) {
        if (!idMap.has(node.id)) {
          const newNode = { ...node, children: [] };
          
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(newNode);
          } else {
            merged.push(newNode);
          }
          
          idMap.set(node.id, newNode);
        }
        
        if (node.children) {
          const existingNode = idMap.get(node.id);
          addNodes(node.children, existingNode);
        }
      }
    }
    
    addNodes(tree2);
    return merged;
  }
  
  /**
   * Compress tree for storage
   */
  export function compressTree(nodes) {
    return nodes.map(node => {
      const compressed = {
        i: node.id,
        n: node.name
      };
      
      if (node.note) compressed.o = node.note;
      if (node.parentId) compressed.p = node.parentId;
      if (node.archived) compressed.a = true;
      if (node.tags && node.tags.length) compressed.t = node.tags;
      if (node.children && node.children.length) {
        compressed.c = compressTree(node.children);
      }
      
      return compressed;
    });
  }
  
  /**
   * Decompress tree from storage
   */
  export function decompressTree(nodes) {
    return nodes.map(node => {
      const decompressed = {
        id: node.i,
        name: node.n,
        note: node.o || '',
        parentId: node.p || null,
        archived: node.a || false,
        tags: node.t || [],
        children: node.c ? decompressTree(node.c) : []
      };
      
      return decompressed;
    });
  }
  
  /**
   * Generate breadcrumb string
   */
  export function generateBreadcrumb(nodeId, allDocs, separator = ' > ') {
    const path = getPathToRoot(nodeId, allDocs);
    return path.map(n => n.name).join(separator);
  }
  
  /**
   * Check if node is ancestor of another
   */
  export function isAncestor(ancestorId, descendantId, allDocs) {
    let currentId = descendantId;
    
    while (currentId) {
      if (currentId === ancestorId) return true;
      const node = allDocs.find(d => d.id === currentId);
      currentId = node?.parentId;
    }
    
    return false;
  }
  
  /**
   * Get siblings of a node
   */
  export function getSiblings(nodeId, allDocs) {
    const node = allDocs.find(d => d.id === nodeId);
    if (!node) return [];
    
    return allDocs.filter(d => 
      d.id !== nodeId && 
      d.parentId === node.parentId
    );
  }
  
  /**
   * Move node to new position
   */
  export function canMoveNode(nodeId, newParentId, allDocs) {
    if (nodeId === newParentId) {
      return { valid: false, error: 'Cannot move to itself' };
    }
    
    if (hasCircularDependency(nodeId, newParentId, allDocs)) {
      return { valid: false, error: 'Would create circular dependency' };
    }
    
    return { valid: true };
  }
  
  /**
   * Generate random category names (for testing)
   */
  export function generateRandomCategory() {
    const adjectives = ['Quick', 'Smart', 'Bright', 'Cool', 'Fresh', 'New', 'Old', 'Big', 'Small', 'Fast'];
    const nouns = ['Project', 'Task', 'Item', 'Category', 'Group', 'Collection', 'Set', 'List', 'Bundle', 'Pack'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adj} ${noun}`;
  }
  
  /**
   * Debounce function for performance
   */
  export function debounce(fn, delay = 300) {
    let timeoutId;
    
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }
  
  /**
   * Throttle function for performance
   */
  export function throttle(fn, limit = 300) {
    let inThrottle;
    
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * Copy text to clipboard
   */
  export async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }
  
  /**
   * Download file
   */
  export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Format file size
   */
  export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
  
  // Export all utilities
  export default {
    formatDate,
    formatRelativeTime,
    getTreeDepth,
    countDescendants,
    getLeafNodes,
    getPathToRoot,
    validateCategoryName,
    hasCircularDependency,
    getCategoryColor,
    exportToFormat,
    searchTree,
    sortNodes,
    calculateStats,
    cloneTree,
    mergeTrees,
    compressTree,
    decompressTree,
    generateBreadcrumb,
    isAncestor,
    getSiblings,
    canMoveNode,
    generateRandomCategory,
    debounce,
    throttle,
    copyToClipboard,
    downloadFile,
    formatFileSize
  };