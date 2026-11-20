/**
 * Masar Cleanroom Inventory Stock Controller
 * Manages 3 Categories: Procured, Good (Tested OK), Faulty
 * Expandable lists, +, row actions (✓, ✗, 🗑), and double-click inline field edit with confirmation modal
 */

const InventoryPage = {
  items: [],
  expandedCategories: {
    procured: true,
    good: true,
    faulty: true
  },
  pendingEdit: null,

  init: async function() {
    this.updateUserHeader();
    await this.loadAllStock();
  },

  updateUserHeader: function() {
    const user = AuthState.getUser();
    const name = (user && user.full_name) || localStorage.getItem('masar_user_full_name') || 'Inventory Admin';
    const isServerAdmin = AuthState.isServerAdmin();
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = isServerAdmin ? '(Server Admin)' : '(Cleanroom Inventory)';
  },

  signOut: function() {
    AuthState.clearSession();
    localStorage.removeItem('masar_auth_token');
    localStorage.removeItem('masar_user_email');
    localStorage.removeItem('masar_user_full_name');
    localStorage.removeItem('masar_user_roles');
    localStorage.removeItem('masar_user_is_server_admin');
    sessionStorage.removeItem('masar_active_tenant_pu_id');
    window.location.href = 'index.html';
  },

  loadAllStock: async function() {
    try {
      const res = await StockAPI.listItems();
      const rawItems = res.data || [];
      this.items = rawItems;

      this.renderCategories();
    } catch (err) {
      console.error('Failed to load inventory stock:', err);
      showToast('Failed to load cleanroom inventory: ' + err.message, 'error');
    }
  },

  renderCategories: function() {
    const procured = [];
    const good = [];
    const faulty = [];

    this.items.forEach(item => {
      const cat = (item.category || '').toUpperCase().trim();
      if (cat === 'GOOD' || cat.includes('TESTED OK')) {
        good.push(item);
      } else if (cat === 'FAULTY' || cat === 'QUARANTINE') {
        faulty.push(item);
      } else {
        procured.push(item);
      }
    });

    // Update quick stats
    const elProcCount = document.getElementById('stat-procured-count');
    const elGoodCount = document.getElementById('stat-good-count');
    const elFaultyCount = document.getElementById('stat-faulty-count');

    if (elProcCount) elProcCount.textContent = procured.length;
    if (elGoodCount) elGoodCount.textContent = good.length;
    if (elFaultyCount) elFaultyCount.textContent = faulty.length;

    // Update category badges
    const bProc = document.getElementById('badge-procured-count');
    const bGood = document.getElementById('badge-good-count');
    const bFaulty = document.getElementById('badge-faulty-count');

    if (bProc) bProc.textContent = `${procured.length} ${procured.length === 1 ? 'Item' : 'Items'}`;
    if (bGood) bGood.textContent = `${good.length} ${good.length === 1 ? 'Item' : 'Items'}`;
    if (bFaulty) bFaulty.textContent = `${faulty.length} ${faulty.length === 1 ? 'Item' : 'Items'}`;

    // Render tables
    this.renderCategoryTable('table-procured-body', procured, 'PROCURED');
    this.renderCategoryTable('table-good-body', good, 'GOOD');
    this.renderCategoryTable('table-faulty-body', faulty, 'FAULTY');
  },

  renderCategoryTable: function(tbodyId, items, categoryKey) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No components in this category. Click '+ Add Item' to register new stock.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const serials = (item.serial_numbers && item.serial_numbers.length > 0)
        ? item.serial_numbers.join(', ')
        : (item.serial_number || '--');

      const isAvailable = item.status === 'AVAILABLE' || item.status === 'TESTED_OK' || item.status === 'GOOD';
      const statusBadge = isAvailable
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">GOOD</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${item.status || 'LOW_STOCK'}</span>`;

      return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-gray-100" data-item-id="${item.id}">
          <td class="py-2.5 px-3 font-mono font-bold text-gray-900 editable-cell"
              title="Double click to edit Item Code"
              ondblclick="InventoryPage.startInlineEdit(this, '${item.id}', 'item_code')">
            ${item.item_code}
          </td>
          <td class="py-2.5 px-3 font-medium text-gray-900 editable-cell"
              title="Double click to edit Name"
              ondblclick="InventoryPage.startInlineEdit(this, '${item.id}', 'name')">
            ${item.name}
          </td>
          <td class="py-2.5 px-3 font-mono text-indigo-700 font-bold editable-cell"
              title="Double click to edit Serial Numbers"
              ondblclick="InventoryPage.startInlineEdit(this, '${item.id}', 'serial_numbers')">
            ${serials}
          </td>
          <td class="py-2.5 px-3 text-gray-600 font-mono text-[11px] editable-cell"
              title="Double click to edit Storage Location"
              ondblclick="InventoryPage.startInlineEdit(this, '${item.id}', 'storage_location')">
            ${item.storage_location || '--'}
          </td>
          <td class="py-2.5 px-3 font-mono text-gray-700 editable-cell"
              title="Double click to edit Batch / Lot Number"
              ondblclick="InventoryPage.startInlineEdit(this, '${item.id}', 'batch_lot_number')">
            ${item.batch_lot_number || '--'}
          </td>
          <td class="py-2.5 px-3 editable-cell"
              title="Double click to edit Status"
              ondblclick="InventoryPage.startInlineEdit(this, '${item.id}', 'status')">
            ${statusBadge}
          </td>
          <td class="py-2.5 px-3 text-right">
            <div class="flex items-center justify-end space-x-1">
              <!-- Move to Good (✓) -->
              <button onclick="InventoryPage.moveCategory('${item.id}', 'GOOD')"
                      class="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 font-bold text-xs transition-colors shadow-sm"
                      title="Move to Good (Tested OK)">
                ✓
              </button>
              <!-- Move to Faulty (✗) -->
              <button onclick="InventoryPage.moveCategory('${item.id}', 'FAULTY')"
                      class="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-300 font-bold text-xs transition-colors shadow-sm"
                      title="Move to Faulty">
                ✗
              </button>
              <!-- Delete (🗑) -->
              <button onclick="InventoryPage.deleteStockItem('${item.id}', '${(item.name || item.item_code).replace(/'/g, "\\'")}')"
                      class="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 font-bold text-xs transition-colors shadow-sm"
                      title="Delete Component">
                🗑
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  toggleCategory: function(catName) {
    const container = document.getElementById(`container-${catName}`);
    const caret = document.getElementById(`caret-${catName}`);
    if (!container) return;

    this.expandedCategories[catName] = !this.expandedCategories[catName];
    if (this.expandedCategories[catName]) {
      container.classList.remove('hidden');
      if (caret) caret.textContent = '▼';
    } else {
      container.classList.add('hidden');
      if (caret) caret.textContent = '▶';
    }
  },

  openAddItemModal: function(categoryKey) {
    const inputCat = document.getElementById('add-item-category');
    const labelCat = document.getElementById('modal-add-category-label');

    if (inputCat) inputCat.value = categoryKey;
    if (labelCat) labelCat.textContent = categoryKey === 'GOOD' ? 'Good (Tested OK)' : categoryKey;

    const modal = document.getElementById('modal-add-stock-item');
    if (modal) modal.classList.remove('hidden');
  },

  submitAddItem: async function(event) {
    if (event) event.preventDefault();
    const cat = document.getElementById('add-item-category')?.value || 'PROCURED';
    const code = document.getElementById('add-item-code')?.value.trim().toUpperCase() || '';
    const name = document.getElementById('add-item-name')?.value.trim() || '';
    const serialsStr = document.getElementById('add-item-serials')?.value.trim() || '';
    const qty = parseFloat(document.getElementById('add-item-qty')?.value || '1');
    const unit = document.getElementById('add-item-unit')?.value.trim() || 'PCS';
    const location = document.getElementById('add-item-location')?.value.trim() || '';
    const batch = document.getElementById('add-item-batch')?.value.trim() || '';

    if (!code || !name) {
      showToast('Item code and name are required', 'error');
      return;
    }

    const serials = serialsStr ? serialsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    const newItem = {
      item_code: code,
      name: name,
      category: cat,
      quantity_on_hand: qty,
      quantity_allocated: 0,
      reorder_point: 2,
      unit: unit,
      batch_lot_number: batch,
      storage_location: location,
      is_serialized: serials.length > 0,
      serial_numbers: serials,
      status: cat === 'FAULTY' ? 'FAULTY' : 'AVAILABLE'
    };

    try {
      await StockAPI.createItem(newItem);
      showToast(`Component '${name}' added to ${cat}!`, 'success');
      this.closeModals();
      await this.loadAllStock();
    } catch (err) {
      showToast('Failed to add component: ' + err.message, 'error');
    }
  },

  // -------------------------------------------------------------------
  // ROW ACTIONS: MOVE TO GOOD (✓), FAULTY (✗), DELETE (🗑)
  // -------------------------------------------------------------------

  moveCategory: async function(itemId, newCategory) {
    try {
      await StockAPI.updateItemCategory(itemId, newCategory);
      showToast(`Item moved to ${newCategory === 'GOOD' ? 'Good (Tested OK)' : 'Faulty'}!`, 'success');
      await this.loadAllStock();
    } catch (err) {
      showToast('Failed to update category: ' + err.message, 'error');
    }
  },

  deleteStockItem: async function(itemId, itemName) {
    if (!confirm(`Are you sure you want to delete component '${itemName}' from cleanroom inventory?`)) return;

    try {
      await StockAPI.deleteItem(itemId);
      showToast(`Component '${itemName}' deleted.`, 'success');
      await this.loadAllStock();
    } catch (err) {
      showToast('Failed to delete component: ' + err.message, 'error');
    }
  },

  // -------------------------------------------------------------------
  // DOUBLE-CLICK INLINE EDITING WITH CONFIRMATION MODAL
  // -------------------------------------------------------------------

  startInlineEdit: function(td, itemId, field) {
    // If already editing this or another cell, don't nest inputs
    if (td.querySelector('input')) return;

    const originalContent = td.innerText.trim();
    const cleanOldValue = originalContent === '--' ? '' : originalContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = cleanOldValue;
    input.className = 'w-full px-1.5 py-0.5 text-xs border border-indigo-500 rounded bg-indigo-50/50 font-inherit focus:outline-none';

    td.innerHTML = '';
    td.appendChild(input);
    input.focus();
    input.select();

    let handled = false;

    const triggerConfirm = () => {
      if (handled) return;
      handled = true;
      const newVal = input.value.trim();
      if (newVal === cleanOldValue) {
        td.innerHTML = originalContent;
        return;
      }

      // Prompt confirmation modal
      InventoryPage.promptFieldUpdateConfirmation(td, itemId, field, cleanOldValue, newVal);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerConfirm();
      } else if (e.key === 'Escape') {
        handled = true;
        td.innerHTML = originalContent;
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        triggerConfirm();
      }, 150);
    });
  },

  promptFieldUpdateConfirmation: function(td, itemId, field, oldValue, newValue) {
    this.pendingEdit = {
      td: td,
      itemId: itemId,
      field: field,
      oldValue: oldValue,
      newValue: newValue
    };

    const labelField = document.getElementById('confirm-field-name');
    const labelOld = document.getElementById('confirm-old-value');
    const labelNew = document.getElementById('confirm-new-value');

    const friendlyField = field.replace(/_/g, ' ').toUpperCase();
    if (labelField) labelField.textContent = friendlyField;
    if (labelOld) labelOld.textContent = oldValue || '(empty)';
    if (labelNew) labelNew.textContent = newValue || '(empty)';

    const modal = document.getElementById('modal-confirm-field-update');
    if (modal) modal.classList.remove('hidden');
  },

  applyInlineEdit: async function() {
    if (!this.pendingEdit) return;
    const { itemId, field, newValue } = this.pendingEdit;

    try {
      await StockAPI.updateItemField(itemId, field, newValue);
      showToast(`Field updated successfully!`, 'success');
      this.closeModals();
      this.pendingEdit = null;
      await this.loadAllStock();
    } catch (err) {
      showToast('Failed to update field: ' + err.message, 'error');
      this.cancelInlineEdit();
    }
  },

  cancelInlineEdit: function() {
    if (this.pendingEdit && this.pendingEdit.td) {
      this.pendingEdit.td.innerHTML = this.pendingEdit.oldValue || '--';
    }
    this.pendingEdit = null;
    this.closeModals();
  },

  closeModals: function() {
    const modals = [
      'modal-add-stock-item',
      'modal-confirm-field-update'
    ];
    modals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  InventoryPage.init();
});
