/**
 * Masar Manufacturing Platform - Stage Team Governance & Production Console
 * Dual-Mode: Stage Manager (Admin Mode) & Stage User (Execution Mode)
 */

const StagePage = {
  currentPU: null,
  currentStageKey: null,
  currentStage: null,
  stages: [],
  users: [],
  availableRoles: [],
  procurementRequests: [],
  finishedProducts: [],
  procuredComponents: [],
  assignedParameters: [],
  currentInspectionFilter: 'ALL',
  currentMode: 'manager', // 'manager' | 'user'

  init: async function() {
    const token = localStorage.getItem('masar_token') || localStorage.getItem('masar_auth_token');
    if (!token) {
      window.location.href = 'index.html';
      return;
    }

    this.updateUserHeader();

    const urlParams = new URLSearchParams(window.location.search);
    this.currentStageKey = urlParams.get('stage');

    if (!this.currentStageKey) {
      showToast('No pipeline stage specified. Returning to pipeline flow...', 'error');
      setTimeout(() => { window.location.href = 'pipeline.html'; }, 1500);
      return;
    }

    const modeParam = urlParams.get('mode');
    if (modeParam === 'user') {
      this.currentMode = 'user';
    }

    try {
      await this.resolveContext();
      await this.loadStageData();
      this.switchMode(this.currentMode);
    } catch (err) {
      console.error('Stage page error:', err);
      this.showAlert('Failed to load stage console: ' + err.message, 'error');
    }
  },

  updateUserHeader: function() {
    const user = AuthState.getUser();
    const name = (user && user.full_name) || localStorage.getItem('masar_user_full_name') || 'Operator';
    const isServerAdmin = localStorage.getItem('masar_user_is_server_admin') === 'true' || 
                          localStorage.getItem('masar_is_server_admin') === 'true' ||
                          (typeof AuthState !== 'undefined' && AuthState.isServerAdmin && AuthState.isServerAdmin());
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = isServerAdmin ? '(Server Admin)' : '(Operator)';
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

  resolveContext: async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const puIdParam = urlParams.get('pu');
    const storedPuId = sessionStorage.getItem('masar_active_tenant_pu_id');

    const resp = await AuthAPI.getMyProductionUnits();
    const pus = resp.production_units || [];

    if (pus.length === 0) {
      throw new Error('You do not belong to any Production Unit.');
    }

    const targetId = puIdParam || storedPuId;
    if (targetId) {
      this.currentPU = pus.find(p => p.id === targetId) || pus[0];
    } else {
      this.currentPU = pus[0];
    }

    sessionStorage.setItem('masar_active_tenant_pu_id', this.currentPU.id);

    const breadcrumbPu = document.getElementById('breadcrumb-pu-name');
    if (breadcrumbPu) breadcrumbPu.textContent = `${this.currentPU.code} - ${this.currentPU.name}`;

    const isSubAssembly = this.currentStageKey && (this.currentStageKey.startsWith('RCV_') || this.currentStageKey.startsWith('SRC_'));
    const sysType = this.currentStageKey && this.currentStageKey.startsWith('RCV_') ? 'RECEIVER' : (this.currentStageKey && this.currentStageKey.startsWith('SRC_') ? 'SOURCE' : '');
    const parentLink = isSubAssembly ? `assembly.html?pu=${encodeURIComponent(this.currentPU.id)}&type=${encodeURIComponent(sysType)}` : `pipeline.html?pu=${encodeURIComponent(this.currentPU.id)}`;
    const parentTitle = isSubAssembly ? `${sysType === 'RECEIVER' ? 'Receiver' : 'Source'} Assembly` : 'Traceability Chain';

    const pipelineLink = document.getElementById('breadcrumb-pipeline-link');
    if (pipelineLink) {
      pipelineLink.href = parentLink;
      pipelineLink.textContent = parentTitle;
    }

    const backBtn = document.getElementById('back-to-pipeline-btn');
    if (backBtn) {
      backBtn.href = parentLink;
      backBtn.innerHTML = `<span>←</span><span>Back to ${parentTitle}</span>`;
    }
  },

  isAdmin: function() {
    return localStorage.getItem('masar_user_is_server_admin') === 'true' || 
           localStorage.getItem('masar_is_server_admin') === 'true' ||
           (typeof AuthState !== 'undefined' && AuthState.isServerAdmin && AuthState.isServerAdmin());
  },

  switchMode: function(mode) {
    const isAdmin = this.isAdmin();
    const btnEditStage = document.getElementById('btn-edit-stage');
    if (btnEditStage) {
      if (isAdmin) btnEditStage.classList.remove('hidden');
      else btnEditStage.classList.add('hidden');
    }

    const btnMgr = document.getElementById('tab-btn-manager');
    const btnUsr = document.getElementById('tab-btn-user');
    const secMgr = document.getElementById('section-stage-manager');
    const secUsr = document.getElementById('section-stage-user');

    if (!isAdmin) {
      // Non-admins cannot define BoM or access manager mode
      mode = 'user';
      if (btnMgr) {
        btnMgr.classList.add('hidden');
      }
    } else {
      if (btnMgr) {
        btnMgr.classList.remove('hidden');
      }
    }

    this.currentMode = mode;
    if (mode === 'manager') {
      if (btnMgr) {
        btnMgr.className = 'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all bg-indigo-600 text-white shadow-sm';
      }
      if (btnUsr) {
        btnUsr.className = 'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all bg-white text-gray-700 hover:bg-gray-50 border border-gray-200';
      }
      if (secMgr) secMgr.classList.remove('hidden');
      if (secUsr) secUsr.classList.add('hidden');
    } else {
      if (btnUsr) {
        btnUsr.className = 'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all bg-emerald-600 text-white shadow-sm';
      }
      if (btnMgr) {
        btnMgr.className = 'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all bg-white text-gray-700 hover:bg-gray-50 border border-gray-200';
      }
      if (secUsr) secUsr.classList.remove('hidden');
      if (secMgr) secMgr.classList.add('hidden');
    }
  },

  loadStageData: async function() {
    try {
      const [stagesResp, usersResp, rolesResp, reqsResp, prodsResp, procResp, paramsResp] = await Promise.all([
        AuthAPI.listAssemblyStages(this.currentPU.id, "ALL"),
        AuthAPI.listPUUsers(this.currentPU.id).catch(() => ({ users: [] })),
        AuthAPI.listRoles(this.currentPU.id).catch(() => ({ roles: [] })),
        AuthAPI.listProcurementRequests(this.currentPU.id, this.currentStageKey).catch(() => ({ requests: [] })),
        AuthAPI.listFinishedProducts(this.currentPU.id, this.currentStageKey).catch(() => ({ products: [] })),
        AuthAPI.listProcuredComponents(this.currentPU.id).catch(() => ({ components: [] })),
        AuthAPI.getStageParameters(this.currentPU.id, this.currentStageKey).catch(() => ({ parameters: [] }))
      ]);

      this.stages = (stagesResp.stages || []).sort((a, b) => (a.sequence_num || 0) - (b.sequence_num || 0));
      this.users = usersResp.users || [];
      this.availableRoles = rolesResp.roles || [];
      this.procurementRequests = reqsResp.requests || [];
      this.finishedProducts = prodsResp.products || [];
      this.procuredComponents = procResp.components || [];
      this.assignedParameters = paramsResp.parameters || [];

      this.currentStage = this.stages.find(s => s.stage_key === this.currentStageKey);
      if (!this.currentStage) {
        throw new Error(`Pipeline stage '${this.currentStageKey}' does not exist in this Production Unit.`);
      }

      this.currentStage.input_items = this.currentStage.input_items || [];
      this.currentStage.intermediate_statuses = this.currentStage.intermediate_statuses || ['PENDING', 'IN_PROGRESS', 'CALIBRATING', 'QUALITY_CHECK', 'DONE'];

      this.renderHero();
      this.renderManagerConfig();
      this.renderAdminsSection();
      this.renderPersonnelSection();
      this.renderProcurementRequests();
      this.renderUserExecutionStation();
      this.renderFinishedProducts();
      this.renderProcuredComponents();
      this.renderProductsRegistry();

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab') === 'procured') {
        this.toggleProcuredPanel(true);
      }
    } catch (err) {
      this.showAlert(err.message, 'error');
    }
  },

  renderHero: function() {
    const st = this.currentStage;
    if (!st) return;

    const heroSeq = document.getElementById('stage-hero-seq');
    if (heroSeq) heroSeq.textContent = st.sequence_num || '1';

    const heroName = document.getElementById('stage-hero-name');
    if (heroName) heroName.textContent = st.name;

    const heroKey = document.getElementById('stage-hero-key');
    if (heroKey) heroKey.textContent = st.stage_key;

    const heroDesc = document.getElementById('stage-hero-desc');
    if (heroDesc) heroDesc.textContent = st.description || 'Quality gate checklist, component integrity testing, and cleanroom procedure verification.';

    const breadcrumbStage = document.getElementById('breadcrumb-stage-name');
    if (breadcrumbStage) breadcrumbStage.textContent = `${st.name} (${st.stage_key})`;

    const currentIndex = this.stages.findIndex(s => s.stage_key === st.stage_key);
    const prevStage = currentIndex > 0 ? this.stages[currentIndex - 1] : null;
    const nextStage = currentIndex < this.stages.length - 1 ? this.stages[currentIndex + 1] : null;

    const navPrev = document.getElementById('nav-prev-stage');
    if (navPrev) {
      if (prevStage) {
        navPrev.innerHTML = `
          <a href="stage.html?stage=${encodeURIComponent(prevStage.stage_key)}&pu=${encodeURIComponent(this.currentPU.id)}"
             class="hover:text-white flex items-center space-x-1.5 transition-colors font-medium">
            <span>←</span>
            <span>Stage ${prevStage.sequence_num}: ${prevStage.name}</span>
          </a>
        `;
      } else {
        navPrev.innerHTML = `<span class="text-gray-500 italic">● Initial Pipeline Stage</span>`;
      }
    }

    const navNext = document.getElementById('nav-next-stage');
    if (navNext) {
      if (nextStage) {
        navNext.innerHTML = `
          <a href="stage.html?stage=${encodeURIComponent(nextStage.stage_key)}&pu=${encodeURIComponent(this.currentPU.id)}"
             class="hover:text-white flex items-center space-x-1.5 transition-colors font-medium">
            <span>Stage ${nextStage.sequence_num}: ${nextStage.name}</span>
            <span>→</span>
          </a>
        `;
      } else {
        navNext.innerHTML = `<span class="text-emerald-400 font-bold">🏁 Terminal Stage</span>`;
      }
    }
  },

  renderManagerConfig: function() {
    const st = this.currentStage;
    if (!st) return;

    // Output product
    const outNameEl = document.getElementById('mgr-output-name');
    const outCodeEl = document.getElementById('mgr-output-code');
    if (outNameEl) outNameEl.value = st.output_product_name || '';
    if (outCodeEl) outCodeEl.value = st.output_product_code || '';

    // Intermediate statuses tags
    const statusContainer = document.getElementById('mgr-statuses-container');
    if (statusContainer) {
      statusContainer.innerHTML = (st.intermediate_statuses || []).map((status, idx) => `
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
          <span>${idx + 1}. ${status}</span>
          <button onclick="StagePage.removeIntermediateStatusTag('${status}')"
                  class="ml-1.5 text-indigo-400 hover:text-rose-600 font-black text-xs transition-colors" title="Remove status">✕</button>
        </span>
      `).join('');
    }

    // Input items table
    const tbody = document.getElementById('mgr-input-items-table-body');
    if (tbody) {
      const items = st.input_items || [];
      if (items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="py-6 text-center text-gray-400">
              No input items defined for this stage yet. Click '+ Add Input Item' to specify cleanroom parts or upstream stage outputs.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = items.map(item => {
          const sourceBadge = item.source_type === 'PREVIOUS_STAGE'
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Stage: ${item.source_stage_key || 'PREV'}</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">Inventory</span>`;

          const immutables = (item.immutable_fields || []).map(f => `
            <span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] border border-gray-200 mr-1">${f}</span>
          `).join('') || '<span class="text-gray-400 italic">None</span>';

          return `
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${item.item_code}</td>
              <td class="py-2.5 px-3 font-medium text-gray-900">${item.name}</td>
              <td class="py-2.5 px-3">${sourceBadge}</td>
              <td class="py-2.5 px-3">${immutables}</td>
              <td class="py-2.5 px-3 text-right">
                <button onclick="StagePage.deleteInputItem('${item.item_code}')"
                        class="px-2.5 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded text-xs font-semibold transition-all">
                  Delete
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  addIntermediateStatusTag: function() {
    const input = document.getElementById('mgr-new-status-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase().replace(/\s+/g, '_');
    if (!val) return;

    if (!this.currentStage.intermediate_statuses) {
      this.currentStage.intermediate_statuses = [];
    }
    if (!this.currentStage.intermediate_statuses.includes(val)) {
      this.currentStage.intermediate_statuses.push(val);
      input.value = '';
      this.renderManagerConfig();
      this.renderUserExecutionStation();
    }
  },

  removeIntermediateStatusTag: function(status) {
    if (!this.currentStage.intermediate_statuses) return;
    this.currentStage.intermediate_statuses = this.currentStage.intermediate_statuses.filter(s => s !== status);
    this.renderManagerConfig();
    this.renderUserExecutionStation();
  },

  saveStageConfig: async function() {
    if (!this.currentPU || !this.currentStage) return;

    const outName = document.getElementById('mgr-output-name')?.value.trim() || '';
    const outCode = document.getElementById('mgr-output-code')?.value.trim().toUpperCase() || '';

    this.currentStage.output_product_name = outName;
    this.currentStage.output_product_code = outCode;

    try {
      await AuthAPI.updateStageConfig(this.currentPU.id, this.currentStage.id, {
        output_product_name: outName,
        output_product_code: outCode,
        input_items: this.currentStage.input_items || [],
        intermediate_statuses: this.currentStage.intermediate_statuses || []
      });
      showToast('Stage configuration saved successfully!', 'success');
      this.renderHero();
      this.renderUserExecutionStation();
    } catch (err) {
      showToast('Failed to save stage configuration: ' + err.message, 'error');
    }
  },

  openAddInputItemModal: function() {
    const srcSelect = document.getElementById('input-item-source');
    if (srcSelect) srcSelect.value = 'INVENTORY';

    const stageSelect = document.getElementById('input-source-stage-select');
    if (stageSelect) {
      const earlierStages = this.stages.filter(s => (s.sequence_num || 0) < (this.currentStage.sequence_num || 99));
      if (earlierStages.length === 0) {
        stageSelect.innerHTML = `<option value="">No preceding stages available</option>`;
      } else {
        stageSelect.innerHTML = earlierStages.map(s => `
          <option value="${s.stage_key}">Stage ${s.sequence_num}: ${s.name} (${s.output_product_code || s.stage_key})</option>
        `).join('');
      }
    }

    this.onInputSourceChange();
    const modal = document.getElementById('modal-add-input-item');
    if (modal) modal.classList.remove('hidden');
  },

  onInputSourceChange: function() {
    const src = document.getElementById('input-item-source')?.value;
    const stageGroup = document.getElementById('input-source-stage-group');
    if (stageGroup) {
      if (src === 'PREVIOUS_STAGE') {
        stageGroup.classList.remove('hidden');
      } else {
        stageGroup.classList.add('hidden');
      }
    }
  },

  submitAddInputItem: async function(event) {
    if (event) event.preventDefault();
    const src = document.getElementById('input-item-source')?.value || 'INVENTORY';
    const srcStage = document.getElementById('input-source-stage-select')?.value || '';
    const code = document.getElementById('input-item-code')?.value.trim().toUpperCase() || '';
    const name = document.getElementById('input-item-name')?.value.trim() || '';
    const immStr = document.getElementById('input-item-immutables')?.value.trim() || '';

    if (!code || !name) {
      showToast('Component code and name are required', 'error');
      return;
    }

    const immutables = immStr ? immStr.split(',').map(s => s.trim()).filter(Boolean) : ['Serial Number'];

    if (!this.currentStage.input_items) this.currentStage.input_items = [];
    // remove existing item with same code if any
    this.currentStage.input_items = this.currentStage.input_items.filter(i => i.item_code !== code);
    this.currentStage.input_items.push({
      item_code: code,
      name: name,
      source_type: src,
      source_stage_key: src === 'PREVIOUS_STAGE' ? srcStage : '',
      immutable_fields: immutables
    });

    this.closeModals();
    await this.saveStageConfig();
    this.renderManagerConfig();
    this.renderUserExecutionStation();
  },

  deleteInputItem: async function(code) {
    if (!confirm(`Are you sure you want to remove input item '${code}'?`)) return;
    this.currentStage.input_items = (this.currentStage.input_items || []).filter(i => i.item_code !== code);
    await this.saveStageConfig();
    this.renderManagerConfig();
    this.renderUserExecutionStation();
  },

  // -------------------------------------------------------------------
  // PROCUREMENT REQUESTS & APPROVALS
  // -------------------------------------------------------------------

  loadProcurementRequests: async function() {
    try {
      const resp = await AuthAPI.listProcurementRequests(this.currentPU.id, this.currentStageKey);
      this.procurementRequests = resp.requests || [];
      this.renderProcurementRequests();
    } catch (err) {
      console.error('Failed to load procurement requests:', err);
    }
  },

  renderProcurementRequests: function() {
    const requests = this.procurementRequests || [];
    const stageKey = this.currentStageKey;

    // 1. Manager approvals table: Requests where this stage is the source OR inventory (if user is manager)
    const mgrTable = document.getElementById('mgr-requests-table-body');
    const badge = document.getElementById('mgr-requests-badge');
    const pendingRequests = requests.filter(r => r.status === 'PENDING' && (r.source_stage_key === stageKey || r.target_source === 'INVENTORY'));
    if (badge) badge.textContent = `${pendingRequests.length} Pending`;

    if (mgrTable) {
      if (requests.length === 0) {
        mgrTable.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No procurement requests currently active.</td></tr>`;
      } else {
        mgrTable.innerHTML = requests.map(req => {
          const isPending = req.status === 'PENDING';
          const statusBadge = isPending
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">PENDING</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">APPROVED</span>`;

          const dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString() : '--';
          const allocSerial = req.allocated_serial_number ? `<code class="font-mono text-indigo-700 font-bold">${req.allocated_serial_number}</code>` : '<span class="text-gray-400 italic">None</span>';

          const actionBtn = isPending
            ? `<button onclick="StagePage.openApproveRequestModal('${req.id}', '${req.item_name || req.item_code}')"
                       class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm transition-all">
                 Approve & Allocate
               </button>`
            : `<span class="text-emerald-700 text-xs font-bold">✓ Approved</span>`;

          return `
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="py-2.5 px-3 font-mono text-gray-500 text-[11px]">${req.id.substring(0, 8)}...</td>
              <td class="py-2.5 px-3">
                <span class="font-bold text-gray-900">${req.item_name}</span>
                <span class="font-mono text-gray-500 block text-[10px]">${req.item_code}</span>
              </td>
              <td class="py-2.5 px-3 text-gray-700">${req.requested_by || 'Operator'} <span class="text-gray-400">(${req.stage_key})</span></td>
              <td class="py-2.5 px-3 text-gray-500">${dateStr}</td>
              <td class="py-2.5 px-3">${statusBadge}</td>
              <td class="py-2.5 px-3">${allocSerial}</td>
              <td class="py-2.5 px-3 text-right">${actionBtn}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. User requests table: Requests made by this stage
    const userTable = document.getElementById('user-requests-table-body');
    if (userTable) {
      const myRequests = requests.filter(r => r.stage_key === stageKey);
      if (myRequests.length === 0) {
        userTable.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-400">No requests raised yet. Use '+ Raise Procurement Request' to order materials.</td></tr>`;
      } else {
        userTable.innerHTML = myRequests.map(req => {
          const isApproved = req.status === 'APPROVED';
          const statusBadge = isApproved
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">APPROVED</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">PENDING</span>`;

          const allocSerial = req.allocated_serial_number ? `<code class="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">${req.allocated_serial_number}</code>` : '<span class="text-gray-400 italic">Awaiting allocation</span>';

          return `
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${req.item_code}</td>
              <td class="py-2.5 px-3 font-medium text-gray-900">${req.item_name}</td>
              <td class="py-2.5 px-3 text-gray-700 text-xs">${req.target_source === 'PREVIOUS_STAGE' ? `Stage: ${req.source_stage_key}` : 'Inventory'}</td>
              <td class="py-2.5 px-3">${statusBadge}</td>
              <td class="py-2.5 px-3">${allocSerial}</td>
              <td class="py-2.5 px-3 text-gray-600 text-xs">${req.approved_by || '--'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  openApproveRequestModal: function(reqId, itemName) {
    const inputReqId = document.getElementById('approve-request-id');
    const labelItem = document.getElementById('modal-approve-item-name');
    const inputSerial = document.getElementById('approve-allocated-serial');
    const suggestionsEl = document.getElementById('approve-serial-suggestions');

    if (inputReqId) inputReqId.value = reqId;
    if (labelItem) labelItem.textContent = itemName;
    if (inputSerial) inputSerial.value = '';

    if (suggestionsEl) {
      if (this.finishedProducts.length > 0) {
        suggestionsEl.innerHTML = `
          <div class="text-[11px] text-gray-500 font-bold mb-1">Click a finished product serial from this stage to auto-fill:</div>
          <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            ${this.finishedProducts.map(p => `
              <button type="button" onclick="document.getElementById('approve-allocated-serial').value='${p.serial_number}'"
                      class="px-2 py-1 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-900 text-gray-800 text-[11px] font-mono rounded border border-gray-300">
                ${p.serial_number}
              </button>
            `).join('')}
          </div>
        `;
      } else {
        suggestionsEl.innerHTML = `<span class="text-[11px] text-gray-400 italic">No completed stage products logged yet; enter serial manually or from inventory.</span>`;
      }
    }

    const modal = document.getElementById('modal-approve-request');
    if (modal) modal.classList.remove('hidden');
  },

  submitApproveRequest: async function(event) {
    if (event) event.preventDefault();
    const reqId = document.getElementById('approve-request-id')?.value;
    const serial = document.getElementById('approve-allocated-serial')?.value.trim();
    const user = AuthState.getUser();
    const approvedBy = (user && user.full_name) || 'Stage Manager';

    if (!serial) {
      showToast('Allocated serial number cannot be empty', 'error');
      return;
    }

    try {
      await AuthAPI.approveProcurementRequest(this.currentPU.id, reqId, serial, approvedBy);
      showToast('Procurement request approved and serial allocated!', 'success');
      this.closeModals();
      await this.loadProcurementRequests();
    } catch (err) {
      showToast('Failed to approve request: ' + err.message, 'error');
    }
  },

  openRaiseProcurementModal: function() {
    const stageSelect = document.getElementById('raise-req-source-stage');
    if (stageSelect) {
      const earlierStages = this.stages.filter(s => (s.sequence_num || 0) < (this.currentStage.sequence_num || 99));
      if (earlierStages.length === 0) {
        stageSelect.innerHTML = `<option value="">No preceding stages available</option>`;
      } else {
        stageSelect.innerHTML = earlierStages.map(s => `
          <option value="${s.stage_key}">Stage ${s.sequence_num}: ${s.name} (${s.output_product_code || s.stage_key})</option>
        `).join('');
      }
    }

    this.onRaiseSourceChange();
    const modal = document.getElementById('modal-raise-request');
    if (modal) modal.classList.remove('hidden');
  },

  onRaiseSourceChange: function() {
    const src = document.getElementById('raise-req-source')?.value;
    const stageGroup = document.getElementById('raise-req-source-stage-group');
    if (stageGroup) {
      if (src === 'PREVIOUS_STAGE') {
        stageGroup.classList.remove('hidden');
      } else {
        stageGroup.classList.add('hidden');
      }
    }
  },

  submitRaiseProcurementRequest: async function(event) {
    if (event) event.preventDefault();
    const src = document.getElementById('raise-req-source')?.value || 'INVENTORY';
    const srcStage = document.getElementById('raise-req-source-stage')?.value || '';
    const itemCode = document.getElementById('raise-req-item-code')?.value.trim().toUpperCase() || '';
    const itemName = document.getElementById('raise-req-item-name')?.value.trim() || '';
    const user = AuthState.getUser();
    const requestedBy = (user && user.full_name) || 'Stage User';

    if (!itemCode || !itemName) {
      showToast('Item code and name are required', 'error');
      return;
    }

    try {
      await AuthAPI.createProcurementRequest(this.currentPU.id, this.currentStageKey, {
        target_source: src,
        source_stage_key: src === 'PREVIOUS_STAGE' ? srcStage : '',
        item_code: itemCode,
        item_name: itemName,
        requested_by: requestedBy
      });
      showToast('Procurement request submitted to Stage Manager!', 'success');
      this.closeModals();
      await this.loadProcurementRequests();
    } catch (err) {
      showToast('Failed to raise procurement request: ' + err.message, 'error');
    }
  },

  // -------------------------------------------------------------------
  // STAGE USER EXECUTION STATION & PRODUCT FINISHING
  // -------------------------------------------------------------------

  renderUserExecutionStation: function() {
    const st = this.currentStage;
    if (!st) return;

    // Status dropdown
    const select = document.getElementById('user-current-status-select');
    if (select) {
      const statuses = st.intermediate_statuses || ['PENDING', 'IN_PROGRESS', 'CALIBRATING', 'QUALITY_CHECK', 'DONE'];
      select.innerHTML = statuses.map(s => `
        <option value="${s}">${s}</option>
      `).join('');
    }

    // Output summary
    const outSummary = document.getElementById('user-output-product-summary');
    if (outSummary) {
      outSummary.textContent = `${st.output_product_name || st.name} (${st.output_product_code || st.stage_key})`;
    }

    // Assembly Inputs Checklist
    const container = document.getElementById('user-assembly-inputs-container');
    if (container) {
      const inputs = st.input_items || [];
      if (inputs.length === 0) {
        container.innerHTML = `
          <div class="text-xs text-gray-500 italic py-2">
            No mandatory stage input items configured by the stage manager. You can proceed directly to complete this stage.
          </div>
        `;
      } else {
        container.innerHTML = inputs.map((item, idx) => {
          // Check if there is an approved procurement request for this item
          const approved = this.procurementRequests.find(r => r.item_code === item.item_code && r.status === 'APPROVED');
          const defaultSerial = approved ? approved.allocated_serial_number : '';

          const immFields = (item.immutable_fields || ['Serial Number']).map(f => `
            <div class="flex-1 min-w-[140px]">
              <label class="block text-[10px] font-bold text-gray-600 mb-0.5">${f}:</label>
              <input type="text" data-item-code="${item.item_code}" data-field="${f}"
                     value="${f.toLowerCase().includes('serial') ? defaultSerial : ''}"
                     placeholder="Enter ${f}"
                     class="user-bom-field w-full px-2.5 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500">
            </div>
          `).join('');

          return `
            <div class="p-3 bg-white border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span class="font-bold text-gray-900">${item.name}</span>
                <span class="font-mono text-indigo-600 ml-1">(${item.item_code})</span>
                <span class="text-[10px] text-gray-400 block">${item.source_type === 'PREVIOUS_STAGE' ? `From Stage: ${item.source_stage_key}` : 'From Cleanroom Inventory'}</span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                ${immFields}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  updateActiveStatus: function() {
    const sel = document.getElementById('user-current-status-select');
    if (sel) {
      showToast(`Milestone updated to: ${sel.value}`, 'info');
    }
  },

  completeStageAndProduce: async function() {
    if (!this.currentPU || !this.currentStage) return;

    const st = this.currentStage;
    const user = AuthState.getUser();
    const createdBy = (user && user.full_name) || 'Stage Operator';

    // Gather BoM items and immutable fields from form
    const bomItems = [];
    const immutableFields = {};

    const inputs = st.input_items || [];
    for (const item of inputs) {
      let serial = '';
      const fieldInputs = document.querySelectorAll(`input.user-bom-field[data-item-code="${item.item_code}"]`);
      fieldInputs.forEach(inp => {
        const fieldName = inp.getAttribute('data-field');
        const val = inp.value.trim();
        if (fieldName.toLowerCase().includes('serial')) {
          serial = val;
        }
        if (val) {
          immutableFields[`${item.item_code}_${fieldName}`] = val;
        }
      });

      bomItems.push({
        item_code: item.item_code,
        component_name: item.name,
        source_stage_key: item.source_type === 'PREVIOUS_STAGE' ? item.source_stage_key : 'INVENTORY',
        allocated_serial_number: serial
      });
    }

    try {
      const prodCode = st.output_product_code || st.stage_key;
      const prodName = st.output_product_name || st.name;

      const res = await AuthAPI.createFinishedProduct(this.currentPU.id, this.currentStageKey, {
        product_code: prodCode,
        product_name: prodName,
        created_by: createdBy,
        immutable_fields: immutableFields,
        bom_components: bomItems
      });

      // Show sticker label modal with generated serial number!
      const stickerModal = document.getElementById('modal-sticker-prompt');
      const stickerSerial = document.getElementById('sticker-serial-number');
      const stickerProd = document.getElementById('sticker-prod-name');

      if (stickerSerial) stickerSerial.textContent = res.serial_number;
      if (stickerProd) stickerProd.textContent = res.product_name;
      if (stickerModal) stickerModal.classList.remove('hidden');

      showToast(`Product ${res.serial_number} created successfully!`, 'success');
      await this.loadFinishedProducts();
    } catch (err) {
      showToast('Failed to complete stage: ' + err.message, 'error');
    }
  },

  loadFinishedProducts: async function() {
    try {
      const resp = await AuthAPI.listFinishedProducts(this.currentPU.id, this.currentStageKey);
      this.finishedProducts = resp.products || [];
      this.renderFinishedProducts();
      this.renderProductsRegistry();
    } catch (err) {
      console.error('Failed to load finished products:', err);
    }
  },

  renderFinishedProducts: function() {
    const tbody = document.getElementById('user-finished-products-table-body');
    if (!tbody) return;

    const products = this.finishedProducts || [];
    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No finished products produced in this stage yet. Mark a unit as DONE above to create one.</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleString() : '--';
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 font-mono font-extrabold text-indigo-700 bg-indigo-50/50 rounded">${p.serial_number}</td>
          <td class="py-2.5 px-3 font-medium text-gray-900">${p.product_name}</td>
          <td class="py-2.5 px-3 font-mono text-gray-600 text-xs">${p.product_code}</td>
          <td class="py-2.5 px-3 text-gray-700 text-xs">${p.created_by || 'Operator'}</td>
          <td class="py-2.5 px-3 text-gray-500 text-xs">${dateStr}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">COMPLETED</span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="StagePage.openBoMModal('${p.id}')"
                    class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold transition-all flex items-center space-x-1 ml-auto">
              <span>🧬</span><span>View BoM</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openBoMModal: async function(productId) {
    try {
      const resp = await AuthAPI.getFinishedProductBoM(this.currentPU.id, productId);
      const prod = resp.product;
      const bom = resp.bom || [];

      const modalTitle = document.getElementById('bom-modal-title');
      const modalSerial = document.getElementById('bom-modal-serial');
      const immContainer = document.getElementById('bom-modal-immutable-fields');
      const compContainer = document.getElementById('bom-modal-components-list');

      if (modalTitle) modalTitle.textContent = `${prod.product_name} (${prod.product_code})`;
      if (modalSerial) modalSerial.textContent = `SERIAL: ${prod.serial_number}`;

      // Immutable Fields
      if (immContainer) {
        const imm = prod.immutable_fields || {};
        const entries = Object.entries(imm);
        if (entries.length === 0) {
          immContainer.innerHTML = `<span class="col-span-2 text-gray-400 italic">No custom immutable attributes recorded.</span>`;
        } else {
          immContainer.innerHTML = entries.map(([k, v]) => `
            <div class="p-2 bg-white rounded border border-gray-200">
              <span class="text-gray-500 font-bold block text-[10px]">${k.replace(/_/g, ' ')}:</span>
              <span class="font-mono text-gray-900 font-bold text-xs">${v}</span>
            </div>
          `).join('');
        }
      }

      // BoM Component list
      if (compContainer) {
        if (bom.length === 0) {
          compContainer.innerHTML = `<div class="p-4 text-center text-gray-400 italic">No sub-components assembled into this finished product.</div>`;
        } else {
          compContainer.innerHTML = bom.map((item, idx) => `
            <div class="p-3 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-7 h-7 bg-indigo-50 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center rounded border border-indigo-200">
                  ${idx + 1}
                </div>
                <div>
                  <span class="font-bold text-gray-900 text-xs">${item.component_name}</span>
                  <span class="font-mono text-gray-500 block text-[10px]">Code: ${item.item_code} | Source: ${item.source_stage_key || 'Inventory'}</span>
                </div>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-gray-500 uppercase font-bold block">Allocated Serial</span>
                <span class="font-mono font-bold text-xs ${item.allocated_serial_number ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200' : 'text-gray-400 italic'}">
                  ${item.allocated_serial_number || 'Unserialized'}
                </span>
              </div>
            </div>
          `).join('');
        }
      }

      const modal = document.getElementById('modal-interactive-bom');
      if (modal) modal.classList.remove('hidden');
    } catch (err) {
      showToast('Failed to load Bill of Materials: ' + err.message, 'error');
    }
  },

  // -------------------------------------------------------------------
  // STAGE TEAM & GOVERNANCE MODALS
  // -------------------------------------------------------------------

  renderAdminsSection: function() {
    const stageKey = this.currentStageKey;
    const stageAdmins = this.users.filter(u =>
      (u.roles || []).some(r => {
        const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
        return roleStr === `StageManager:${stageKey}` || roleStr === `PipelineAdmin:${stageKey}`;
      })
    );

    const badge = document.getElementById('stage-admins-count-badge');
    if (badge) {
      badge.textContent = `${stageAdmins.length} ${stageAdmins.length === 1 ? 'Manager' : 'Managers'}`;
    }

    const grid = document.getElementById('stage-admins-grid');
    if (!grid) return;

    if (stageAdmins.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-6 text-center text-gray-400 border border-dashed border-gray-300 rounded-xl bg-gray-50/50 text-xs">
          No Stage Manager designated yet. Click 'Assign Stage Manager' above.
        </div>
      `;
      return;
    }

    grid.innerHTML = stageAdmins.map(u => `
      <div class="p-3.5 bg-gradient-to-br from-amber-50/60 to-white border border-amber-200 rounded-xl shadow-sm flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-base">
            👑
          </div>
          <div>
            <span class="font-bold text-gray-900 text-xs">${u.full_name || 'User'}</span>
            <span class="text-[11px] text-gray-500 font-mono block">${u.email}</span>
          </div>
        </div>
        <button onclick="StagePage.removeAdmin('${u.id}', '${(u.full_name || u.email).replace(/'/g, "\\'")}')"
                class="px-2 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded text-xs font-semibold transition-all">
          Remove
        </button>
      </div>
    `).join('');
  },

  renderPersonnelSection: function() {
    const stageKey = this.currentStageKey;
    const tbody = document.getElementById('stage-users-table-body');
    if (!tbody) return;

    const stagePersonnel = this.users.filter(u =>
      (u.roles || []).some(r => {
        const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
        return roleStr.includes(`:${stageKey}`);
      })
    );

    const badge = document.getElementById('stage-users-count-badge');
    if (badge) {
      badge.textContent = `${stagePersonnel.length} ${stagePersonnel.length === 1 ? 'Member' : 'Members'}`;
    }

    if (stagePersonnel.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-xs text-gray-400">No personnel authorized for this stage yet. Click '+ Authorize User' or 'Invite New Member'.</td></tr>`;
      return;
    }

    tbody.innerHTML = stagePersonnel.map(u => {
      const stageRoles = (u.roles || []).filter(r => {
        const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
        return roleStr.includes(`:${stageKey}`);
      });
      const roleBadges = stageRoles.map(r => {
        const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
        const baseRole = roleStr.split(':')[0];
        let color = 'bg-slate-100 text-slate-700 border-slate-200';
        if (baseRole === 'StageManager' || baseRole === 'PipelineAdmin') color = 'bg-amber-100 text-amber-900 border-amber-300';
        else if (baseRole === 'OpticalEngineer') color = 'bg-indigo-100 text-indigo-900 border-indigo-200';
        else if (baseRole === 'QAInspector') color = 'bg-rose-100 text-rose-900 border-rose-200';
        else if (baseRole === 'AssemblyOperator') color = 'bg-blue-100 text-blue-900 border-blue-200';

        return `
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${color} border mr-1 mb-1">
            <span>${baseRole}</span>
            <button onclick="StagePage.removeRoleFromUser('${u.id}', '${roleStr}')"
                    class="ml-1.5 text-gray-400 hover:text-rose-600 font-black text-xs transition-colors" title="Remove role">✕</button>
          </span>
        `;
      }).join('');

      return `
        <tr class="hover:bg-gray-50/80 transition-colors border-b border-gray-100 text-xs">
          <td class="py-3 px-4 text-gray-900 font-bold">${u.full_name || 'Invited User'}</td>
          <td class="py-3 px-4 text-gray-600 font-mono">${u.email}</td>
          <td class="py-3 px-4"><div class="flex flex-wrap items-center">${roleBadges}</div></td>
          <td class="py-3 px-4">${u.is_active ? '<span class="text-emerald-700 font-bold">🟢 Active</span>' : '<span class="text-amber-700 font-bold">🟡 Invited</span>'}</td>
          <td class="py-3 px-4 text-right">
            <button onclick="StagePage.openAddSingleRoleModal('${u.id}', '${(u.full_name || u.email).replace(/'/g, "\\'")}')"
                    class="px-2.5 py-1 bg-white hover:bg-gray-50 text-indigo-700 border border-indigo-300 rounded text-[11px] font-bold shadow-sm mr-1">
              + Role
            </button>
            <button onclick="StagePage.removeUserFromStage('${u.id}', '${(u.full_name || u.email).replace(/'/g, "\\'")}')"
                    class="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded text-[11px] font-bold shadow-sm">
              Remove
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  openAssignAdminModal: function() {
    const stageKey = this.currentStageKey;
    const select = document.getElementById('select-admin-user');
    const titleEl = document.getElementById('modal-assign-admin-st-name');

    if (titleEl && this.currentStage) titleEl.textContent = `${this.currentStage.name} (${stageKey})`;

    if (select) {
      select.innerHTML = this.users.map(u => `
        <option value="${u.id}">${u.full_name || 'User'} (${u.email})</option>
      `).join('');
    }

    const modal = document.getElementById('modal-assign-stage-admin');
    if (modal) modal.classList.remove('hidden');
  },

  submitAssignAdmin: async function(event) {
    if (event) event.preventDefault();
    const userId = document.getElementById('select-admin-user')?.value;
    if (!userId) return;

    try {
      await AuthAPI.addUserRole(this.currentPU.id, userId, `StageManager:${this.currentStageKey}`);
      showToast('Stage Manager role assigned successfully!', 'success');
      this.closeModals();
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to assign manager: ' + err.message, 'error');
    }
  },

  removeAdmin: async function(userId, userName) {
    if (!confirm(`Are you sure you want to revoke Stage Manager authority from '${userName}'?`)) return;
    try {
      await AuthAPI.removeUserRole(this.currentPU.id, userId, `StageManager:${this.currentStageKey}`).catch(() => {});
      await AuthAPI.removeUserRole(this.currentPU.id, userId, `PipelineAdmin:${this.currentStageKey}`).catch(() => {});
      showToast('Manager authority revoked.', 'success');
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to revoke manager authority: ' + err.message, 'error');
    }
  },

  openAssignUserModal: function() {
    const stageKey = this.currentStageKey;
    const select = document.getElementById('select-existing-user');
    if (select) {
      select.innerHTML = this.users.map(u => `
        <option value="${u.id}">${u.full_name || 'User'} (${u.email})</option>
      `).join('');
    }

    const box = document.getElementById('assign-user-roles-checkboxes');
    if (box) {
      box.innerHTML = this.availableRoles.map(r => `
        <label class="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-100">
          <input type="checkbox" name="assign-roles" value="${r.role_key}" class="rounded text-indigo-600 focus:ring-indigo-500">
          <span class="font-bold text-gray-800">${r.name}</span>
          <span class="text-gray-400 font-mono text-[10px]">(${r.role_key})</span>
        </label>
      `).join('');
    }

    const modal = document.getElementById('modal-assign-user-role');
    if (modal) modal.classList.remove('hidden');
  },

  submitAssignUserWithRoles: async function(event) {
    if (event) event.preventDefault();
    const userId = document.getElementById('select-existing-user')?.value;
    const checkboxes = document.querySelectorAll('input[name="assign-roles"]:checked');
    const roles = Array.from(checkboxes).map(cb => cb.value);

    if (!userId || roles.length === 0) {
      showToast('Please select at least one role to grant', 'error');
      return;
    }

    try {
      for (const r of roles) {
        await AuthAPI.addUserRole(this.currentPU.id, userId, `${r}:${this.currentStageKey}`);
      }
      showToast('User authorized with stage roles!', 'success');
      this.closeModals();
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to assign roles: ' + err.message, 'error');
    }
  },

  openInviteUserModal: function() {
    const box = document.getElementById('invite-stage-roles-checkboxes');
    if (box) {
      box.innerHTML = this.availableRoles.map(r => `
        <label class="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-100">
          <input type="checkbox" name="invite-roles" value="${r.role_key}" class="rounded text-indigo-600 focus:ring-indigo-500">
          <span class="font-bold text-gray-800">${r.name}</span>
          <span class="text-gray-400 font-mono text-[10px]">(${r.role_key})</span>
        </label>
      `).join('');
    }

    this.generateRandomOTP('invite-stage-otp');
    const modal = document.getElementById('modal-invite-stage-user');
    if (modal) modal.classList.remove('hidden');
  },

  generateRandomOTP: function(inputId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
    let otp = '';
    for (let i = 0; i < 10; i++) {
      otp += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById(inputId);
    if (input) input.value = otp;
  },

  submitInviteNewUserToStage: async function(event) {
    if (event) event.preventDefault();
    const email = document.getElementById('invite-stage-email')?.value.trim();
    const otp = document.getElementById('invite-stage-otp')?.value.trim();
    const checkboxes = document.querySelectorAll('input[name="invite-roles"]:checked');
    const baseRoles = Array.from(checkboxes).map(cb => cb.value);

    if (!email || !otp || baseRoles.length === 0) {
      showToast('Email, OTP, and at least one role are required', 'error');
      return;
    }

    const scopedRoles = baseRoles.map(r => `${r}:${this.currentStageKey}`);

    try {
      await AuthAPI.inviteUser(this.currentPU.id, email, otp, scopedRoles);
      showToast(`Invitation created for ${email}!`, 'success');
      this.closeModals();
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to invite user: ' + err.message, 'error');
    }
  },

  openAddSingleRoleModal: function(userId, userName) {
    const inputUserId = document.getElementById('single-role-user-id');
    const select = document.getElementById('select-single-role');

    if (inputUserId) inputUserId.value = userId;
    if (select) {
      select.innerHTML = this.availableRoles.map(r => `
        <option value="${r.role_key}">${r.name} (${r.role_key})</option>
      `).join('');
    }

    const modal = document.getElementById('modal-add-single-role');
    if (modal) modal.classList.remove('hidden');
  },

  submitAddSingleRole: async function(event) {
    if (event) event.preventDefault();
    const userId = document.getElementById('single-role-user-id')?.value;
    const roleKey = document.getElementById('select-single-role')?.value;

    if (!userId || !roleKey) return;

    try {
      await AuthAPI.addUserRole(this.currentPU.id, userId, `${roleKey}:${this.currentStageKey}`);
      showToast('Role granted successfully!', 'success');
      this.closeModals();
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to add role: ' + err.message, 'error');
    }
  },

  removeRoleFromUser: async function(userId, fullRole) {
    if (!confirm(`Are you sure you want to remove role '${fullRole}'?`)) return;
    try {
      await AuthAPI.removeUserRole(this.currentPU.id, userId, fullRole);
      showToast('Role revoked.', 'success');
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to remove role: ' + err.message, 'error');
    }
  },

  removeUserFromStage: async function(userId, userName) {
    if (!confirm(`Are you sure you want to remove '${userName}' and all their roles from this stage?`)) return;
    try {
      const u = this.users.find(x => x.id === userId);
      if (u) {
        const stageRoles = (u.roles || []).filter(r => {
          const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
          return roleStr.includes(`:${this.currentStageKey}`);
        });
        for (const r of stageRoles) {
          const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
          await AuthAPI.removeUserRole(this.currentPU.id, userId, roleStr);
        }
      }
      showToast('User removed from this stage.', 'success');
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to remove user: ' + err.message, 'error');
    }
  },

  openEditStageModal: function() {
    if (!this.currentStage) return;
    const nameEl = document.getElementById('edit-stage-name');
    const seqEl = document.getElementById('edit-stage-seq');
    const descEl = document.getElementById('edit-stage-desc');

    if (nameEl) nameEl.value = this.currentStage.name;
    if (seqEl) seqEl.value = this.currentStage.sequence_num;
    if (descEl) descEl.value = this.currentStage.description || '';

    const modal = document.getElementById('modal-edit-stage');
    if (modal) modal.classList.remove('hidden');
  },

  submitUpdateStage: async function(event) {
    if (event) event.preventDefault();
    const name = document.getElementById('edit-stage-name')?.value.trim();
    const seq = parseInt(document.getElementById('edit-stage-seq')?.value, 10);
    const desc = document.getElementById('edit-stage-desc')?.value.trim();

    if (!name || isNaN(seq)) return;

    try {
      await AuthAPI.updatePipelineStage(this.currentPU.id, this.currentStage.id, {
        name: name,
        sequence_num: seq,
        description: desc
      });
      showToast('Pipeline stage updated successfully!', 'success');
      this.closeModals();
      await this.loadStageData();
    } catch (err) {
      showToast('Failed to update stage: ' + err.message, 'error');
    }
  },

  closeModals: function() {
    const modals = [
      'modal-assign-stage-admin',
      'modal-assign-user-role',
      'modal-invite-stage-user',
      'modal-add-single-role',
      'modal-edit-stage',
      'modal-add-input-item',
      'modal-approve-request',
      'modal-raise-request',
      'modal-sticker-prompt',
      'modal-interactive-bom',
      'modal-add-stage-product',
      'modal-add-stage-field'
    ];
    modals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  },

  filterByInspection: function(status) {
    this.currentInspectionFilter = status;
    this.renderProductsRegistry();
  },

  toggleProcuredPanel: function(forceOpen) {
    const panel = document.getElementById('section-procured-catalog-panel');
    if (!panel) return;
    if (typeof forceOpen === 'boolean') {
      if (forceOpen) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    } else {
      panel.classList.toggle('hidden');
    }
  },

  renderProcuredComponents: function() {
    const tbody = document.getElementById('procured-components-table-body');
    const btnAdd = document.getElementById('btn-add-procured-component');
    const isAdmin = this.isAdmin();

    if (btnAdd) {
      if (isAdmin) btnAdd.classList.remove('hidden');
      else btnAdd.classList.add('hidden');
    }

    if (!tbody) return;

    const components = this.procuredComponents || [];
    if (components.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-6 text-center text-teal-800/60 italic text-xs">
            No externally procured components registered yet. Click '+ Add Procured Part' above to add parts from vendor catalogs.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = components.map(c => `
      <tr class="hover:bg-teal-50/50 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-teal-950">${c.item_code}</td>
        <td class="py-2.5 px-3 font-bold text-gray-900">${c.name}</td>
        <td class="py-2.5 px-3 text-gray-600">${c.category || '—'}</td>
        <td class="py-2.5 px-3 font-medium text-gray-800">${c.supplier || 'Vendor'}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-gray-600">${JSON.stringify(c.specifications || {})}</td>
        <td class="py-2.5 px-3 text-center font-mono font-bold text-teal-900">${c.unit || 'PCS'}</td>
        <td class="py-2.5 px-3 text-right">
          ${isAdmin ? `
            <button onclick="StagePage.deleteProcuredPart('${c.item_code}')"
                    class="px-2 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded text-xs font-semibold transition-all">
              Delete
            </button>
          ` : '<span class="text-gray-400 italic text-[11px]">Read-only</span>'}
        </td>
      </tr>
    `).join('');
  },

  openAddProcuredModal: function() {
    if (!this.isAdmin()) return;
    document.getElementById('proc-code').value = '';
    document.getElementById('proc-name').value = '';
    document.getElementById('proc-category').value = '';
    document.getElementById('proc-supplier').value = '';
    document.getElementById('proc-unit').value = 'PCS';
    document.getElementById('proc-spec').value = '';
    const modal = document.getElementById('modal-add-procured-part');
    if (modal) modal.classList.remove('hidden');
  },

  submitAddProcuredPart: async function(event) {
    if (event) event.preventDefault();
    const code = document.getElementById('proc-code')?.value.trim().toUpperCase();
    const name = document.getElementById('proc-name')?.value.trim();
    const category = document.getElementById('proc-category')?.value.trim();
    const supplier = document.getElementById('proc-supplier')?.value.trim();
    const unit = document.getElementById('proc-unit')?.value.trim().toUpperCase() || 'PCS';
    const spec = document.getElementById('proc-spec')?.value.trim();

    if (!code || !name) {
      showToast('Item code and part name are required.', 'error');
      return;
    }

    try {
      await AuthAPI.createProcuredComponent(this.currentPU.id, {
        item_code: code,
        name: name,
        category: category,
        supplier: supplier,
        unit: unit,
        specifications: spec ? { key_spec: spec } : {}
      });
      showToast(`Procured component '${name}' added to catalog!`, 'success');
      this.closeModals();
      const resp = await AuthAPI.listProcuredComponents(this.currentPU.id);
      this.procuredComponents = resp.components || [];
      this.renderProcuredComponents();
    } catch (err) {
      console.error('Error adding procured part:', err);
      showToast('Failed to add procured part: ' + err.message, 'error');
    }
  },

  deleteProcuredPart: async function(itemCode) {
    if (!confirm(`Delete procured component '${itemCode}' from the catalog?`)) return;
    try {
      await AuthAPI.deleteProcuredComponent(this.currentPU.id, itemCode);
      showToast('Procured component removed.', 'info');
      const resp = await AuthAPI.listProcuredComponents(this.currentPU.id);
      this.procuredComponents = resp.components || [];
      this.renderProcuredComponents();
    } catch (err) {
      showToast('Failed to delete component: ' + err.message, 'error');
    }
  },

  renderProductsRegistry: function() {
    const tbody = document.getElementById('stage-registry-tbody');
    const thead = document.getElementById('stage-registry-thead');
    const titleEl = document.getElementById('stage-registry-title');
    const subtitleEl = document.getElementById('stage-registry-subtitle');
    const badgeEl = document.getElementById('stage-registry-count-badge');
    const chipsEl = document.getElementById('stage-registry-fields-chips');
    const btnAddProd = document.getElementById('btn-registry-add-product');
    const btnAddField = document.getElementById('btn-registry-add-field');

    if (!tbody || !thead) return;

    const st = this.currentStage;
    const products = this.finishedProducts || [];
    const isAdmin = this.isAdmin();

    // Permissions: only admins can add products or fields
    if (btnAddProd) {
      if (isAdmin) btnAddProd.classList.remove('hidden');
      else btnAddProd.classList.add('hidden');
    }
    if (btnAddField) {
      if (isAdmin) btnAddField.classList.remove('hidden');
      else btnAddField.classList.add('hidden');
    }

    // Custom titles for stages
    if (st) {
      if (titleEl) {
        if (st.stage_key === 'RECEIVE') {
          titleEl.textContent = 'Receive Unit • Incoming Material & Vendor Lots Registry';
        } else if (st.stage_key === 'INSPECT') {
          titleEl.textContent = 'Inspect Unit • Quality Assurance & Defect Verification';
        } else if (st.stage_key === 'STORE_KIT') {
          titleEl.textContent = 'Store & Kit Unit • Conforming Inventory & Kit Preparation';
        } else {
          titleEl.textContent = `${st.name} • Products & Traceability Registry`;
        }
      }
      if (subtitleEl) {
        if (st.stage_key === 'RECEIVE') {
          subtitleEl.textContent = 'Intake registry of externally procured parts and raw materials from vendors. Admin defines the catalog of components procured from outside.';
        } else if (st.stage_key === 'INSPECT') {
          subtitleEl.textContent = 'Quality gate verification separating conforming OK products from Faulty items. Record inspection tracking parameters and failure root causes.';
        } else if (st.stage_key === 'STORE_KIT') {
          subtitleEl.textContent = 'Cleanroom stocking of inspected conforming products ready for assembly and modular kit allocation.';
        } else {
          subtitleEl.textContent = 'Registered product lots with serial numbers, carried-forward tracking parameters, storage locations, and BoM components.';
        }
      }
    }

    // Update Inspection Filter Tab Counts & Active Styles
    const allCount = products.length;
    const okCount = products.filter(p => (p.inspection_status || 'OK') === 'OK').length;
    const faultyCount = products.filter(p => p.inspection_status === 'FAULTY').length;

    const cAll = document.getElementById('filter-count-all');
    const cOk = document.getElementById('filter-count-ok');
    const cFlt = document.getElementById('filter-count-faulty');
    if (cAll) cAll.textContent = allCount;
    if (cOk) cOk.textContent = okCount;
    if (cFlt) cFlt.textContent = faultyCount;

    const btnFilterAll = document.getElementById('filter-btn-all');
    const btnFilterOk = document.getElementById('filter-btn-ok');
    const btnFilterFaulty = document.getElementById('filter-btn-faulty');
    const currentFilter = this.currentInspectionFilter || 'ALL';

    if (btnFilterAll) {
      btnFilterAll.className = currentFilter === 'ALL'
        ? 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow-sm transition-all flex items-center space-x-1'
        : 'px-3 py-1.5 rounded-lg font-bold bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 transition-all flex items-center space-x-1';
    }
    if (btnFilterOk) {
      btnFilterOk.className = currentFilter === 'OK'
        ? 'px-3 py-1.5 rounded-lg font-bold bg-emerald-600 text-white shadow-sm transition-all flex items-center space-x-1'
        : 'px-3 py-1.5 rounded-lg font-bold bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300 transition-all flex items-center space-x-1';
    }
    if (btnFilterFaulty) {
      btnFilterFaulty.className = currentFilter === 'FAULTY'
        ? 'px-3 py-1.5 rounded-lg font-bold bg-rose-600 text-white shadow-sm transition-all flex items-center space-x-1'
        : 'px-3 py-1.5 rounded-lg font-bold bg-white text-rose-700 hover:bg-rose-50 border border-rose-300 transition-all flex items-center space-x-1';
    }

    // Apply Filter
    let displayProducts = products;
    if (currentFilter === 'OK') {
      displayProducts = products.filter(p => (p.inspection_status || 'OK') === 'OK');
    } else if (currentFilter === 'FAULTY') {
      displayProducts = products.filter(p => p.inspection_status === 'FAULTY');
    }

    if (badgeEl) badgeEl.textContent = `${displayProducts.length} of ${products.length} Products`;

    // Dynamic custom fields defined on this stage
    const customFields = (st && st.custom_fields && Array.isArray(st.custom_fields)) ? st.custom_fields : [];
    const standardKeys = ['quantity', 'storage location', 'storage', 'manufacturer', 'manufacture'];
    const dynamicFields = customFields.filter(f => !standardKeys.includes(f.toLowerCase().trim()));

    // Render chips
    if (chipsEl) {
      const allActiveFields = ['Serial Number', 'QA Verdict', 'Quantity', 'Storage Location', 'Manufacturer', ...dynamicFields];
      chipsEl.innerHTML = allActiveFields.map(f => `
        <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <span>✓</span><span>${f}</span>
        </span>
      `).join('');
    }

    // Dynamic thead
    thead.innerHTML = `
      <tr>
        <th class="py-2.5 px-3">Serial Number</th>
        <th class="py-2.5 px-3">Product Name & Code</th>
        <th class="py-2.5 px-3 text-center">QA Status</th>
        <th class="py-2.5 px-3">Defect / QA Notes</th>
        <th class="py-2.5 px-2 text-center">Quantity</th>
        <th class="py-2.5 px-3">Storage Location</th>
        <th class="py-2.5 px-3">Manufacturer</th>
        ${dynamicFields.map(f => `<th class="py-2.5 px-3">${f}</th>`).join('')}
        <th class="py-2.5 px-3 text-center">Parameters</th>
        <th class="py-2.5 px-3">Registered By / Date</th>
        <th class="py-2.5 px-3 text-right">Actions</th>
      </tr>
    `;

    // Dynamic tbody
    if (displayProducts.length === 0) {
      const colSpan = 10 + dynamicFields.length;
      tbody.innerHTML = `
        <tr>
          <td colspan="${colSpan}" class="py-12 text-center text-gray-400">
            <div class="text-2xl mb-1">${currentFilter === 'FAULTY' ? '🛡️' : '📦'}</div>
            <p class="font-medium text-xs text-gray-600">
              ${currentFilter === 'FAULTY' ? 'No faulty/rejected products recorded in this stage.' : (currentFilter === 'OK' ? 'No conforming OK products found.' : 'No products registered in this stage yet.')}
            </p>
            ${isAdmin ? `<p class="text-[11px] text-gray-400 mt-1">Click <strong class="text-indigo-600">+ Add Product</strong> above to register incoming items with serial numbers and specifications.</p>` : ''}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = displayProducts.map(p => {
      const imm = p.immutable_fields || {};
      const qty = imm['Quantity'] || imm['quantity'] || '1';
      const storage = imm['Storage Location'] || imm['storage'] || imm['Storage'] || '—';
      const manufacturer = imm['Manufacturer'] || imm['manufacturer'] || imm['Manufacture'] || '—';
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : '--';
      const createdBy = p.created_by || 'Admin';

      const isFaulty = p.inspection_status === 'FAULTY';
      const statusBadge = isFaulty
        ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">❌ FAULTY</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ OK</span>`;

      const defectNote = isFaulty
        ? `<span class="text-rose-700 font-bold text-xs leading-snug line-clamp-2" title="${p.defect_reason || 'Out of spec'}">${p.defect_reason || 'Out of spec'}</span>`
        : `<span class="text-gray-400 italic text-[11px]">Conforming</span>`;

      const recordedParamsCount = Object.keys(p.parameter_values || {}).length;

      const dynamicCells = dynamicFields.map(f => {
        const val = imm[f] || '—';
        return `<td class="py-2.5 px-3 font-medium text-gray-700">${val}</td>`;
      }).join('');

      return `
        <tr class="hover:bg-slate-50 transition-colors ${isFaulty ? 'bg-rose-50/20' : ''}">
          <td class="py-2.5 px-3">
            <div class="flex items-center space-x-1.5">
              <span class="font-mono font-extrabold text-indigo-700 bg-indigo-50/70 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                ${p.serial_number}
              </span>
            </div>
          </td>
          <td class="py-2.5 px-3">
            <div class="font-bold text-gray-900">${p.product_name}</div>
            <div class="font-mono text-[10px] text-gray-500">${p.product_code}</div>
          </td>
          <td class="py-2.5 px-3 text-center">
            ${statusBadge}
          </td>
          <td class="py-2.5 px-3 max-w-xs">
            ${defectNote}
          </td>
          <td class="py-2.5 px-2 text-center font-bold text-emerald-700 bg-emerald-50/30 rounded">
            ${qty}
          </td>
          <td class="py-2.5 px-3 text-gray-700 font-medium">
            <span class="inline-flex items-center space-x-1">
              <span>📍</span><span>${storage}</span>
            </span>
          </td>
          <td class="py-2.5 px-3 text-gray-700 font-medium">
            <span class="inline-flex items-center space-x-1">
              <span>🏭</span><span>${manufacturer}</span>
            </span>
          </td>
          ${dynamicCells}
          <td class="py-2.5 px-3 text-center">
            <button onclick="StagePage.openParametersLedgerModal('${p.id}')"
                    class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all inline-flex items-center space-x-1"
                    title="View Carried-Forward Parameters Ledger">
              <span>📊</span><span>${recordedParamsCount} Params</span>
            </button>
          </td>
          <td class="py-2.5 px-3 text-gray-500 text-[11px]">
            <div>${createdBy}</div>
            <div class="text-[10px] text-gray-400">${dateStr}</div>
          </td>
          <td class="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
            <button onclick="StagePage.openInspectActionModal('${p.id}')"
                    class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold transition-all inline-flex items-center space-x-1"
                    title="Perform Quality Inspection & Parameter Entry">
              <span>🔍</span><span>Inspect</span>
            </button>
            ${isAdmin ? `
              <button onclick="StagePage.openEditProductPropertiesModal('${p.id}')"
                      class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-bold transition-all inline-flex items-center space-x-1"
                      title="Edit mutable properties">
                <span>✏️</span><span>Edit</span>
              </button>
            ` : ''}
            <button onclick="StagePage.openBoMModal('${p.id}')"
                    class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold transition-all inline-flex items-center space-x-1">
              <span>🧬</span><span>BoM</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ==========================================
  // QA INSPECTION ACTION MODAL (OK vs FAULTY + PARAMETERS)
  // ==========================================
  openInspectActionModal: function(productId) {
    const prod = this.finishedProducts.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById('inspect-product-id').value = prod.id;
    document.getElementById('inspect-prod-name').textContent = prod.product_name;
    document.getElementById('inspect-prod-serial').textContent = prod.serial_number;

    const currentStatus = prod.inspection_status || 'OK';
    const radios = document.getElementsByName('inspect-verdict');
    radios.forEach(r => {
      r.checked = (r.value === currentStatus);
    });

    document.getElementById('inspect-defect-reason').value = prod.defect_reason || '';
    this.onInspectVerdictChange();

    // Render assigned parameters input fields for this stage
    const paramGrid = document.getElementById('inspect-parameters-input-grid');
    const badge = document.getElementById('inspect-params-count-badge');
    if (paramGrid) {
      const stageParams = this.assignedParameters || [];
      if (badge) badge.textContent = `Assigned: ${stageParams.length}`;

      if (stageParams.length === 0) {
        paramGrid.innerHTML = `
          <div class="col-span-full text-xs text-gray-500 italic py-2">
            No specific parameters assigned to this stage. You can define stage parameters in the Build Explorer or stage settings.
          </div>
        `;
      } else {
        const recorded = prod.parameter_values || {};
        paramGrid.innerHTML = stageParams.map(param => {
          const rec = recorded[param.param_key];
          const currentVal = rec ? rec.value : (param.default_value || '');
          const unit = param.unit || (rec ? rec.unit : '');

          return `
            <div class="p-2 bg-white rounded-lg border border-gray-200">
              <label class="block text-[11px] font-bold text-gray-800 mb-1 flex items-center justify-between">
                <span>${param.name}</span>
                ${unit ? `<span class="text-[10px] text-gray-400 font-mono">(${unit})</span>` : ''}
              </label>
              <input type="text" data-param-key="${param.param_key}" data-param-unit="${unit}"
                     value="${currentVal}"
                     placeholder="Enter ${param.name}"
                     class="inspect-param-input w-full px-2.5 py-1 text-xs border border-gray-300 rounded font-mono focus:ring-1 focus:ring-indigo-500">
            </div>
          `;
        }).join('');
      }
    }

    const modal = document.getElementById('modal-inspect-action');
    if (modal) modal.classList.remove('hidden');
  },

  onInspectVerdictChange: function() {
    const radios = document.getElementsByName('inspect-verdict');
    let verdict = 'OK';
    radios.forEach(r => { if (r.checked) verdict = r.value; });

    const defectGroup = document.getElementById('inspect-defect-reason-group');
    if (defectGroup) {
      if (verdict === 'FAULTY') {
        defectGroup.classList.remove('hidden');
      } else {
        defectGroup.classList.add('hidden');
      }
    }
  },

  submitInspectAction: async function(event) {
    if (event) event.preventDefault();
    const prodId = document.getElementById('inspect-product-id').value;
    if (!prodId) return;

    const radios = document.getElementsByName('inspect-verdict');
    let verdict = 'OK';
    radios.forEach(r => { if (r.checked) verdict = r.value; });

    const defectReason = document.getElementById('inspect-defect-reason').value.trim();
    if (verdict === 'FAULTY' && !defectReason) {
      showToast('Please provide a defect reason for rejected items.', 'error');
      return;
    }

    // Gather parameter readings
    const paramInputs = document.querySelectorAll('.inspect-param-input');
    const paramValues = {};
    const paramUnits = {};
    paramInputs.forEach(inp => {
      const key = inp.getAttribute('data-param-key');
      const unit = inp.getAttribute('data-param-unit');
      const val = inp.value.trim();
      if (val) {
        paramValues[key] = val;
        paramUnits[key] = unit;
      }
    });

    const user = AuthState.getUser();
    const inspector = (user && user.full_name) || 'QA Inspector';

    try {
      await AuthAPI.inspectProduct(this.currentPU.id, prodId, {
        inspection_status: verdict,
        defect_reason: verdict === 'FAULTY' ? defectReason : '',
        parameters: paramValues,
        units: paramUnits,
        recorded_by: inspector
      });

      showToast(`Inspection recorded: Item marked as ${verdict}!`, 'success');
      this.closeModals();
      await this.loadFinishedProducts();
    } catch (err) {
      console.error('Inspection submit error:', err);
      showToast('Failed to record inspection: ' + err.message, 'error');
    }
  },

  // ==========================================
  // VIEW CARRIED-FORWARD PARAMETERS LEDGER
  // ==========================================
  openParametersLedgerModal: function(productId) {
    const prod = this.finishedProducts.find(p => p.id === productId);
    if (!prod) return;

    const subtitle = document.getElementById('ledger-modal-subtitle');
    if (subtitle) {
      subtitle.textContent = `Historical audit ledger for: ${prod.product_name} (Serial: ${prod.serial_number})`;
    }

    const tbody = document.getElementById('ledger-params-table-body');
    if (!tbody) return;

    const values = prod.parameter_values || {};
    const entries = Object.entries(values);

    if (entries.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 text-center text-gray-400 italic text-xs">
            No parameter values recorded for this serialized unit yet. Use '🔍 Inspect' to record measurements.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = entries.map(([key, data]) => {
        const valStr = typeof data === 'object' ? data.value : data;
        const unit = typeof data === 'object' ? (data.unit || '') : '';
        const stage = typeof data === 'object' ? (data.stage_key || '—') : '—';
        const by = typeof data === 'object' ? (data.recorded_by || 'Operator') : 'Operator';
        const timeStr = typeof data === 'object' && data.recorded_at ? new Date(data.recorded_at).toLocaleString() : '—';

        const paramDef = this.assignedParameters.find(p => p.param_key === key);
        const displayName = paramDef ? paramDef.name : key.replace(/_/g, ' ').toUpperCase();

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="py-2.5 px-3 font-bold text-gray-900">${displayName}</td>
            <td class="py-2.5 px-3 font-mono text-indigo-700">${key}</td>
            <td class="py-2.5 px-3 font-mono font-bold text-gray-900 bg-indigo-50/50 rounded">${valStr} ${unit}</td>
            <td class="py-2.5 px-3 font-bold text-amber-800">
              <span class="px-2 py-0.5 rounded text-[10px] bg-amber-50 border border-amber-200">${stage}</span>
            </td>
            <td class="py-2.5 px-3 text-gray-700">${by}</td>
            <td class="py-2.5 px-3 text-gray-400 text-[11px]">${timeStr}</td>
          </tr>
        `;
      }).join('');
    }

    const modal = document.getElementById('modal-params-ledger');
    if (modal) modal.classList.remove('hidden');
  },

  openAddProductModal: function() {
    if (!this.isAdmin()) {
      showToast('Admin privilege required to add products', 'error');
      return;
    }
    const nameEl = document.getElementById('modal-product-stage-name');
    if (nameEl && this.currentStage) nameEl.textContent = this.currentStage.name;

    // Reset base inputs
    const pName = document.getElementById('newprod-name');
    const pCode = document.getElementById('newprod-code');
    const pSerial = document.getElementById('newprod-serial');
    const pQty = document.getElementById('newprod-quantity');
    const pStorage = document.getElementById('newprod-storage');
    const pMfg = document.getElementById('newprod-manufacturer');

    if (pName) pName.value = this.currentStage ? (this.currentStage.output_product_name || '') : '';
    if (pCode) pCode.value = this.currentStage ? (this.currentStage.output_product_code || '') : '';
    if (pSerial) pSerial.value = '';
    if (pQty) pQty.value = '1';
    if (pStorage) pStorage.value = '';
    if (pMfg) pMfg.value = '';

    // Render dynamic custom fields inputs
    const dynSection = document.getElementById('newprod-dynamic-fields-section');
    const dynContainer = document.getElementById('newprod-dynamic-fields-container');
    const customFields = (this.currentStage && this.currentStage.custom_fields && Array.isArray(this.currentStage.custom_fields)) ? this.currentStage.custom_fields : [];
    const standardKeys = ['quantity', 'storage location', 'storage', 'manufacturer', 'manufacture'];
    const dynamicFields = customFields.filter(f => !standardKeys.includes(f.toLowerCase().trim()));

    if (dynSection && dynContainer) {
      if (dynamicFields.length > 0) {
        dynSection.classList.remove('hidden');
        dynContainer.innerHTML = dynamicFields.map((f, i) => `
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1" for="dynfield-${i}">${f}</label>
            <input type="text" id="dynfield-${i}" data-field-name="${f}" placeholder="Enter ${f}"
                   class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>
        `).join('');
      } else {
        dynSection.classList.add('hidden');
        dynContainer.innerHTML = '';
      }
    }

    const modal = document.getElementById('modal-add-stage-product');
    if (modal) modal.classList.remove('hidden');
  },

  submitAddProduct: async function(event) {
    if (event) event.preventDefault();
    if (!this.isAdmin()) {
      showToast('Admin privilege required to add products', 'error');
      return;
    }

    const name = document.getElementById('newprod-name').value.trim();
    const code = document.getElementById('newprod-code').value.trim().toUpperCase();
    const serial = document.getElementById('newprod-serial').value.trim();
    const qty = document.getElementById('newprod-quantity').value.trim() || '1';
    const storage = document.getElementById('newprod-storage').value.trim();
    const mfg = document.getElementById('newprod-manufacturer').value.trim();

    if (!name || !code) {
      showToast('Product name and code are required', 'error');
      return;
    }

    const immutable = {
      'Quantity': qty,
      'Storage Location': storage || 'Cleanroom Storage Bay',
      'Manufacturer': mfg || 'TII Certified Supplier'
    };

    // Gather dynamic custom fields
    const dynContainer = document.getElementById('newprod-dynamic-fields-container');
    if (dynContainer) {
      const inputs = dynContainer.querySelectorAll('input[data-field-name]');
      inputs.forEach(inp => {
        const fName = inp.getAttribute('data-field-name');
        const fVal = inp.value.trim();
        if (fName && fVal) {
          immutable[fName] = fVal;
        }
      });
    }

    const createdBy = localStorage.getItem('masar_user_full_name') || localStorage.getItem('masar_user_email') || 'Admin';

    try {
      const payload = {
        product_name: name,
        product_code: code,
        created_by: createdBy,
        immutable_fields: immutable,
        bom_components: []
      };
      if (serial) {
        payload.serial_number = serial;
      }

      await AuthAPI.createFinishedProduct(this.currentPU.id, this.currentStageKey, payload);
      this.closeModals();
      showToast('Product added to stage registry successfully', 'success');
      await this.loadFinishedProducts();
    } catch (err) {
      console.error('Failed to add product:', err);
      showToast('Failed to add product: ' + err.message, 'error');
    }
  },

  openAddFieldModal: function() {
    if (!this.isAdmin()) {
      showToast('Admin privilege required to add custom fields', 'error');
      return;
    }
    const nameEl = document.getElementById('modal-field-stage-name');
    if (nameEl && this.currentStage) nameEl.textContent = this.currentStage.name;

    const input = document.getElementById('newfield-name');
    if (input) input.value = '';

    const modal = document.getElementById('modal-add-stage-field');
    if (modal) modal.classList.remove('hidden');
  },

  submitAddField: async function(event) {
    if (event) event.preventDefault();
    if (!this.isAdmin()) {
      showToast('Admin privilege required to add custom fields', 'error');
      return;
    }

    const input = document.getElementById('newfield-name');
    const fieldName = input ? input.value.trim() : '';
    if (!fieldName) {
      showToast('Field name is required', 'error');
      return;
    }

    const currentFields = (this.currentStage && Array.isArray(this.currentStage.custom_fields)) ? [...this.currentStage.custom_fields] : [];
    if (currentFields.some(f => f.toLowerCase() === fieldName.toLowerCase())) {
      showToast(`Field '${fieldName}' already exists on this stage`, 'error');
      return;
    }

    currentFields.push(fieldName);

    try {
      await AuthAPI.updateStageConfig(this.currentPU.id, this.currentStage.id, {
        output_product_name: this.currentStage.output_product_name || '',
        output_product_code: this.currentStage.output_product_code || '',
        input_items: this.currentStage.input_items || [],
        intermediate_statuses: this.currentStage.intermediate_statuses || [],
        custom_fields: currentFields
      });

      this.currentStage.custom_fields = currentFields;
      this.closeModals();
      showToast(`Dynamic field '${fieldName}' added successfully`, 'success');
      this.renderProductsRegistry();
    } catch (err) {
      console.error('Failed to add custom field:', err);
      showToast('Failed to save field: ' + err.message, 'error');
    }
  },

  openEditProductPropertiesModal: function(productId) {
    if (!this.isAdmin()) {
      showToast('Only Server Administrator can modify product properties', 'error');
      return;
    }

    const prod = (this.finishedProducts || []).find(p => p.id === productId);
    if (!prod) {
      showToast('Product not found in registry', 'error');
      return;
    }

    const idInput = document.getElementById('editprod-id');
    const nameInput = document.getElementById('editprod-name');
    const codeInput = document.getElementById('editprod-code');
    const serialInput = document.getElementById('editprod-serial');
    const qtyInput = document.getElementById('editprod-quantity');
    const storageInput = document.getElementById('editprod-storage');
    const mfrInput = document.getElementById('editprod-manufacturer');
    const dynContainer = document.getElementById('editprod-dynamic-fields-container');

    const imm = prod.immutable_fields || {};

    if (idInput) idInput.value = prod.id;
    if (nameInput) nameInput.value = prod.product_name;
    if (codeInput) codeInput.value = prod.product_code;
    if (serialInput) serialInput.value = prod.serial_number;
    if (qtyInput) qtyInput.value = imm['Quantity'] || imm['quantity'] || '1';
    if (storageInput) storageInput.value = imm['Storage Location'] || imm['storage'] || imm['Storage'] || '';
    if (mfrInput) mfrInput.value = imm['Manufacturer'] || imm['manufacturer'] || imm['Manufacture'] || '';

    // Render dynamic custom fields
    if (dynContainer) {
      const customFields = (this.currentStage && Array.isArray(this.currentStage.custom_fields)) ? this.currentStage.custom_fields : [];
      const standardKeys = ['quantity', 'storage location', 'storage', 'manufacturer', 'manufacture'];
      const dynamicFields = customFields.filter(f => !standardKeys.includes(f.toLowerCase().trim()));

      if (dynamicFields.length === 0) {
        dynContainer.innerHTML = `<p class="col-span-2 text-[11px] text-gray-400 italic">No additional dynamic fields configured for this stage.</p>`;
      } else {
        dynContainer.innerHTML = dynamicFields.map(field => {
          const fieldId = `editprod-field-${field.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
          const currentVal = imm[field] || '';
          return `
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1" for="${fieldId}">${field}</label>
              <input type="text" id="${fieldId}" data-field-name="${field}" value="${currentVal}"
                     placeholder="Enter ${field} value"
                     class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium">
            </div>
          `;
        }).join('');
      }
    }

    const modal = document.getElementById('modal-edit-product-properties');
    if (modal) modal.classList.remove('hidden');
  },

  submitEditProductProperties: async function(event) {
    if (event) event.preventDefault();
    if (!this.isAdmin()) {
      showToast('Only Server Administrator can modify product properties', 'error');
      return;
    }

    const idInput = document.getElementById('editprod-id');
    const prodId = idInput ? idInput.value : '';
    if (!prodId) {
      showToast('Missing product ID', 'error');
      return;
    }

    const prod = (this.finishedProducts || []).find(p => p.id === prodId);
    if (!prod) {
      showToast('Product not found in local registry', 'error');
      return;
    }

    const qty = (document.getElementById('editprod-quantity')?.value || '1').trim();
    const storage = (document.getElementById('editprod-storage')?.value || '').trim();
    const manufacturer = (document.getElementById('editprod-manufacturer')?.value || '').trim();

    // Start with existing immutable fields to preserve any extra properties
    const properties = Object.assign({}, prod.immutable_fields || {});
    properties['Quantity'] = qty;
    properties['Storage Location'] = storage;
    properties['Manufacturer'] = manufacturer;

    // Read dynamic fields
    const dynContainer = document.getElementById('editprod-dynamic-fields-container');
    if (dynContainer) {
      const inputs = dynContainer.querySelectorAll('input[data-field-name]');
      inputs.forEach(inp => {
        const fieldName = inp.getAttribute('data-field-name');
        if (fieldName) {
          properties[fieldName] = inp.value.trim();
        }
      });
    }

    const submitBtn = document.getElementById('btn-save-editprod');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      const resp = await AuthAPI.updateProductProperties(this.currentPU.id, this.currentStageKey, prodId, properties);
      const updatedProduct = resp.product || resp;

      // Update in local array
      const idx = this.finishedProducts.findIndex(p => p.id === prodId);
      if (idx !== -1) {
        this.finishedProducts[idx].immutable_fields = properties;
        if (updatedProduct.immutable_fields) {
          this.finishedProducts[idx].immutable_fields = updatedProduct.immutable_fields;
        }
      }

      this.closeModals();
      showToast('Product properties updated successfully (Product identity remains immutable).', 'success');
      this.renderProductsRegistry();
    } catch (err) {
      console.error('Failed to update product properties:', err);
      showToast('Failed to update product properties: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾</span><span>Save Properties</span>';
      }
    }
  },

  showAlert: function(msg, type) {
    const el = document.getElementById('stage-alert');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden', 'bg-rose-50', 'text-rose-800', 'border-rose-200', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200');
    if (type === 'error') {
      el.classList.add('bg-rose-50', 'text-rose-800', 'border-rose-200');
    } else {
      el.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-200');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  StagePage.init();
});
