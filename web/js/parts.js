/**
 * InvenTree Parts & BoM Explorer Controller
 */

const PartsPage = {
  parts: [],
  categories: [],
  assemblies: [],
  currentTab: 'catalog',

  async init() {
    await this.loadAll();
  },

  async loadAll() {
    await Promise.all([
      this.loadCategories(),
      this.loadParts(),
      this.loadBuilds()
    ]);
  },

  switchTab(tab) {
    this.currentTab = tab;
    ['catalog', 'bom', 'builds', 'params'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pane = document.getElementById(`tab-pane-${t}`);
      if (btn && pane) {
        if (t === tab) {
          btn.classList.add('active');
          pane.classList.remove('hidden');
        } else {
          btn.classList.remove('active');
          pane.classList.add('hidden');
        }
      }
    });

    if (tab === 'bom') {
      this.loadBoMForSelected();
    }
  },

  async loadCategories() {
    try {
      const res = await apiFetch('/parts/categories');
      if (res && res.success) {
        this.categories = res.data;
        const filter = document.getElementById('part-cat-filter');
        const modalSelect = document.getElementById('new-part-cat');
        if (filter) {
          filter.innerHTML = '<option value="">All Categories</option>' + res.data.map(c => `
            <option value="${c.id}">${c.path || c.name}</option>
          `).join('');
        }
        if (modalSelect) {
          modalSelect.innerHTML = res.data.map(c => `
            <option value="${c.id}">${c.path || c.name}</option>
          `).join('');
        }
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  },

  async loadParts() {
    try {
      const res = await apiFetch('/parts');
      if (res && res.success) {
        this.parts = res.data;
        this.assemblies = res.data.filter(p => p.is_assembly);
        
        // Populate Assembly selector for BOM tab
        const asmSelect = document.getElementById('bom-assembly-select');
        if (asmSelect) {
          asmSelect.innerHTML = this.assemblies.map(a => `
            <option value="${a.id}">${a.ipn} - ${a.name}</option>
          `).join('');
        }

        const countEl = document.getElementById('parts-total-count');
        if (countEl) countEl.innerText = res.data.length;

        this.renderPartsTable(res.data);
      }
    } catch (e) {
      console.error('Failed to load parts:', e);
    }
  },

  filterParts() {
    const search = document.getElementById('part-search-input')?.value.toLowerCase().trim() || '';
    const catId = document.getElementById('part-cat-filter')?.value || '';

    const filtered = this.parts.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search) || p.ipn.toLowerCase().includes(search);
      const matchCat = !catId || (p.category && p.category.id === catId);
      return matchSearch && matchCat;
    });

    this.renderPartsTable(filtered);
  },

  renderPartsTable(items) {
    const tbody = document.getElementById('parts-table-body');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400">No parts found matching criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(p => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${p.ipn}</td>
        <td class="py-2.5 px-3 font-semibold text-gray-800">${p.name}</td>
        <td class="py-2.5 px-3 text-gray-600">${p.category ? p.category.name : '--'}</td>
        <td class="py-2.5 px-3 font-mono text-gray-500">${p.revision}</td>
        <td class="py-2.5 px-3">
          ${p.is_assembly ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">Assembly</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">Component</span>'}
        </td>
        <td class="py-2.5 px-3 text-gray-500">${p.default_location || '--'}</td>
        <td class="py-2.5 px-3 text-right">
          ${p.is_assembly ? `<button onclick="PartsPage.viewAssemblyBoM('${p.id}')" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs">Explore BoM →</button>` : ''}
        </td>
      </tr>
    `).join('');
  },

  viewAssemblyBoM(partId) {
    const select = document.getElementById('bom-assembly-select');
    if (select) select.value = partId;
    this.switchTab('bom');
  },

  async loadBoMForSelected() {
    const select = document.getElementById('bom-assembly-select');
    if (!select || !select.value) return;

    try {
      const res = await apiFetch(`/parts/${select.value}/bom`);
      const tbody = document.getElementById('bom-items-table-body');
      if (tbody && res && res.success && res.data) {
        const items = res.data.items || [];
        if (items.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-400">No Bill of Materials items recorded for this assembly.</td></tr>`;
          return;
        }

        tbody.innerHTML = items.map(item => `
          <tr class="hover:bg-slate-50">
            <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${item.item_code}</td>
            <td class="py-2.5 px-3 font-semibold text-gray-800">${item.name}</td>
            <td class="py-2.5 px-3 font-mono text-indigo-600 font-bold">${item.reference || '--'}</td>
            <td class="py-2.5 px-3 font-bold">${item.quantity} ${item.unit}</td>
            <td class="py-2.5 px-3">
              ${item.is_critical_path ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">Critical</span>' : '<span class="text-gray-400">Standard</span>'}
            </td>
            <td class="py-2.5 px-3 font-mono text-[10px] text-gray-500 truncate max-w-xs" title="${item.checksum_sha256}">
              ${item.checksum_sha256 ? item.checksum_sha256.substring(0, 16) + '...' : '<span class="text-gray-300">Unset</span>'}
            </td>
            <td class="py-2.5 px-3 text-right">
              <button onclick="PartsPage.verifyChecksum('${item.id}', '${item.checksum_sha256}')" class="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-[11px] font-bold text-gray-700">
                Verify
              </button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error('Failed to load BoM items:', e);
    }
  },

  async verifyChecksum(itemId, expectedHash) {
    const candidate = prompt("Enter SHA-256 checksum to verify:", expectedHash);
    if (!candidate) return;

    try {
      const res = await apiFetch(`/bom/items/${itemId}/verify-checksum`, {
        method: 'POST',
        body: { checksum_sha256: candidate }
      });
      if (res && res.success) {
        if (res.data.matched) {
          alert('✅ Cryptographic verification SUCCESSFUL: Component checksum matches engineering specification!');
        } else {
          alert('❌ Checksum MISMATCH! Possible component firmware or revision disparity.');
        }
      }
    } catch (e) {
      alert('Verification error: ' + e.message);
    }
  },

  async loadBuilds() {
    try {
      const res = await apiFetch('/build/orders');
      const container = document.getElementById('build-orders-container');
      if (container && res && res.success) {
        if (res.data.length === 0) {
          container.innerHTML = `
            <div class="p-6 bg-slate-50 border border-gray-200 rounded-xl text-center text-gray-500 col-span-2">
              <span class="text-2xl block mb-2">🏭</span>
              No active build orders. Click "New Build Order" to initiate an assembly build batch.
            </div>
          `;
          return;
        }

        container.innerHTML = res.data.map(b => `
          <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-mono font-bold text-sm text-gray-900">${b.reference}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">${b.status}</span>
            </div>
            <h4 class="font-bold text-gray-800 text-xs">${b.title}</h4>
            <div class="text-[11px] text-gray-500 flex justify-between">
              <span>Qty: <strong>${b.quantity}</strong></span>
              <span>Created: ${new Date(b.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error('Failed to load build orders:', e);
    }
  },

  openCreatePartModal() {
    const modal = document.getElementById('modal-create-part');
    if (modal) modal.classList.remove('hidden');
  },

  closeModals() {
    document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
  },

  async submitCreatePart() {
    const ipn = document.getElementById('new-part-ipn')?.value.trim();
    const name = document.getElementById('new-part-name')?.value.trim();
    const rev = document.getElementById('new-part-rev')?.value.trim() || 'A';
    const catId = document.getElementById('new-part-cat')?.value || null;
    const isAsm = document.getElementById('new-part-is-assembly')?.checked || false;
    const isComp = document.getElementById('new-part-is-component')?.checked || true;

    if (!ipn || !name) {
      alert('Please specify Internal Part Number and Name');
      return;
    }

    try {
      const res = await apiFetch('/parts', {
        method: 'POST',
        body: {
          ipn: ipn,
          name: name,
          revision: rev,
          category_id: catId,
          is_assembly: isAsm,
          is_component: isComp
        }
      });
      if (res && res.success) {
        alert('Part created successfully!');
        this.closeModals();
        await this.loadParts();
      }
    } catch (e) {
      alert('Failed to create part: ' + e.message);
    }
  }
};
