/*
 * Masar Admin
 * Handles Login Gate, 3-Tier Drilldown (Orgs -> PUs -> PU Users), and PU Admin Provisioning
 */

const AdminPortal = {
  selectedPU: null,
  productionUnits: [],

  _getStoredPU: function() {
    try {
      return JSON.parse(
        sessionStorage.getItem('masar_selected_pu') || 
        sessionStorage.getItem('masar_selected_bu') || 
        sessionStorage.getItem('qtrace_selected_bu')
      );
    } catch (e) { return null; }
  },
  _setStoredPU: function(pu) {
    if (pu) {
      sessionStorage.setItem('masar_selected_pu', JSON.stringify(pu));
    } else {
      sessionStorage.removeItem('masar_selected_pu');
      sessionStorage.removeItem('masar_selected_bu');
    }
    sessionStorage.removeItem('qtrace_selected_bu');
  },

  pendingDelete: null,

  init: function() {
    this.bindEvents();
    this.render();
  },

  bindEvents: function() {
    // Global delegated click listeners for modal closers
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllModals();
    });
  },

  render: function() {
    const token = AuthState.getToken();
    const isServerAdmin = AuthState.isServerAdmin();
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isLanding = currentPath === 'index.html' || currentPath === '';

    const loginSection = document.getElementById('section-login');
    const adminSection = document.getElementById('section-admin-portal');
    const tenantSection = document.getElementById('section-tenant-hub');
    const puSelectionSection = document.getElementById('section-pu-selection');
    const tenantNavBar = document.getElementById('tenant-nav-bar');
    const headerEl = document.querySelector('header');
    const footerEl = document.querySelector('footer');
    const sidebar = document.getElementById('masar-sidebar');

    if (!token) {
      if (isLanding) {
        document.documentElement.classList.add('auth-guest');
        if (headerEl) headerEl.style.display = 'none';
        if (footerEl) footerEl.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
      }
      if (tenantNavBar) tenantNavBar.classList.add('hidden');
      if (loginSection) loginSection.classList.remove('hidden');
      if (adminSection) adminSection.classList.add('hidden');
      if (tenantSection) tenantSection.classList.add('hidden');
      if (puSelectionSection) puSelectionSection.classList.add('hidden');
      this.updateHeaderAuthStatus(null);
      return;
    }

    // Authenticated state: restore normal header, footer, and sidebar
    document.documentElement.classList.remove('auth-guest');
    if (headerEl) headerEl.style.display = '';
    if (footerEl) footerEl.style.display = '';
    if (sidebar) sidebar.style.display = '';

    if (window.MasarLayout && !document.getElementById('masar-sidebar')) {
      MasarLayout.injectSidebar();
      MasarLayout.injectCustomizerModal();
      MasarLayout.loadCustomization();
      MasarLayout.loadTrees();
    }

    if (tenantNavBar) {
      tenantNavBar.classList.remove('hidden');
    }

    if (loginSection) loginSection.classList.add('hidden');

    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');

    if (isServerAdmin && viewParam !== 'hub') {
      if (adminSection) adminSection.classList.remove('hidden');
      if (tenantSection) tenantSection.classList.add('hidden');
      if (puSelectionSection) puSelectionSection.classList.add('hidden');
      this.updateHeaderAuthStatus('admin');

      if (!this.selectedPU) {
        this.selectedPU = this._getStoredPU();
      }

      if (!this.selectedPU) {
        this.loadProductionUnits();
      } else {
        this.loadPUUsers(this.selectedPU);
      }
    } else {
      if (adminSection) adminSection.classList.add('hidden');
      this.updateHeaderAuthStatus(isServerAdmin ? 'admin-hub' : 'tenant');
      this.loadTenantPUsAndGovernance();
    }
  },

  updateHeaderAuthStatus: function(mode) {
    const user = AuthState.getUser();
    const userDisplay = document.getElementById('header-user-display');
    const authStatusBadge = document.getElementById('header-auth-badge');
    const signOutBtn = document.getElementById('header-signout-btn');
    const puSwitcher = document.getElementById('header-pu-switcher');

    if (!mode) {
      if (userDisplay) userDisplay.innerHTML = `<span class="text-gray-400">Not Signed In</span>`;
      if (authStatusBadge) authStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>Authentication Required</span>`;
      if (signOutBtn) signOutBtn.classList.add('hidden');
      if (puSwitcher) puSwitcher.classList.add('hidden');
      return;
    }

    if (signOutBtn) signOutBtn.classList.remove('hidden');

    if (mode === 'admin') {
      if (puSwitcher) puSwitcher.classList.add('hidden');
      if (userDisplay) {
        userDisplay.innerHTML = `Admin: <strong class="text-indigo-300">${user ? user.full_name || user.email : 'Server Admin'}</strong> <a href="index.html?view=hub" class="ml-2 text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700 hover:bg-indigo-800 transition-colors">🏭 View Hub</a>`;
      }
      if (authStatusBadge) {
        authStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span><span>Control Plane: <strong class="text-indigo-200">Masar Admin</strong></span>`;
      }
    } else if (mode === 'admin-hub') {
      if (puSwitcher) puSwitcher.classList.remove('hidden');
      if (userDisplay) {
        userDisplay.innerHTML = `Admin: <strong class="text-indigo-300">${user ? user.full_name || user.email : 'Server Admin'}</strong> <a href="index.html?view=admin" class="ml-2 text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 transition-colors">🛡️ Admin Console</a>`;
      }
      if (authStatusBadge) {
        authStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Workspace: <strong class="text-emerald-300">Manufacturing Hub</strong></span>`;
      }
    } else {
      if (userDisplay) {
        const firstRole = user && user.roles && user.roles.length > 0 ? (typeof user.roles[0] === 'string' ? user.roles[0] : (user.roles[0].role || 'Staff')) : 'Staff';
        userDisplay.innerHTML = `User: <strong class="text-white">${user ? user.full_name : 'Operator'}</strong> <span class="text-gray-400">(${firstRole})</span>`;
      }
      if (authStatusBadge) {
        authStatusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Tenant Mode: <strong class="text-emerald-300">${user ? user.organization_name || 'TII' : 'Active'}</strong></span>`;
      }
    }
  },


  switchLoginTab: function(tab) {
    const tabSignin = document.getElementById('tab-login-signin');
    const tabRegister = document.getElementById('tab-login-register');
    const formSignin = document.getElementById('form-login-signin');
    const formRegister = document.getElementById('form-login-register');
    const errEl = document.getElementById('login-error-msg');
    const successEl = document.getElementById('login-success-msg');

    if (errEl) errEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    if (tab === 'register') {
      if (tabSignin) {
        tabSignin.classList.remove('border-indigo-600', 'text-indigo-600');
        tabSignin.classList.add('border-transparent', 'text-gray-400');
      }
      if (tabRegister) {
        tabRegister.classList.remove('border-transparent', 'text-gray-400');
        tabRegister.classList.add('border-indigo-600', 'text-indigo-600');
      }
      if (formSignin) formSignin.classList.add('hidden');
      if (formRegister) formRegister.classList.remove('hidden');
      const emailInput = document.getElementById('invite-reg-email');
      if (emailInput) emailInput.focus();
    } else {
      if (tabRegister) {
        tabRegister.classList.remove('border-indigo-600', 'text-indigo-600');
        tabRegister.classList.add('border-transparent', 'text-gray-400');
      }
      if (tabSignin) {
        tabSignin.classList.remove('border-transparent', 'text-gray-400');
        tabSignin.classList.add('border-indigo-600', 'text-indigo-600');
      }
      if (formRegister) formRegister.classList.add('hidden');
      if (formSignin) formSignin.classList.remove('hidden');
      const emailInput = document.getElementById('login-email');
      if (emailInput) emailInput.focus();
    }
  },

  handleInvitationRegisterSubmit: async function(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('invite-reg-email').value.trim().toLowerCase();
    const otp = document.getElementById('invite-reg-otp').value;
    const fullName = document.getElementById('invite-reg-name').value.trim();
    const newPass = document.getElementById('invite-reg-newpass').value;
    const confirmPass = document.getElementById('invite-reg-confirmpass').value;
    const errEl = document.getElementById('login-error-msg');
    const successEl = document.getElementById('login-success-msg');
    const submitBtn = document.getElementById('invite-reg-submit-btn');

    if (errEl) errEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    if (!email || !otp || !fullName || !newPass || !confirmPass) {
      if (errEl) {
        errEl.textContent = 'Please fill out all registration fields.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (newPass !== confirmPass) {
      if (errEl) {
        errEl.textContent = 'New passwords do not match. Please verify.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (newPass.length < 8) {
      if (errEl) {
        errEl.textContent = 'New password must be at least 8 characters in length.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (newPass === otp) {
      if (errEl) {
        errEl.textContent = 'For security, your new password must be different from your one-time password.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Activating Account...</span>`;
    }

    try {
      const resp = await AuthAPI.registerInvite(email, otp, fullName, newPass);
      AuthState.setSession(resp.token, resp.user, false);
      sessionStorage.removeItem('masar_active_tenant_pu_id');
      document.documentElement.classList.remove('auth-guest');
      showToast(`Welcome to Masar, ${resp.user.full_name}! Registration activated successfully.`, 'success');
      this.render();
      window.location.href = 'index.html';
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Invitation registration failed. Please check your credentials.';
        errEl.classList.remove('hidden');
      }
      showToast('Registration failed', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Activate Account & Sign In</span><span class="text-xs">→</span>`;
      }
    }
  },

  handleLoginSubmit: async function(e) {

    if (e) e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      if (errorEl) {
        errorEl.textContent = 'Please enter both email and password.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (errorEl) errorEl.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Authenticating...</span>`;
    }

    try {
      const resp = await AuthAPI.login(email, password);
      const isServerAdmin = resp.is_server_admin === true;
      const userObj = isServerAdmin ? resp.admin : resp.user;

      AuthState.setSession(resp.token, userObj, isServerAdmin);
      sessionStorage.removeItem('masar_active_tenant_pu_id');
      document.documentElement.classList.remove('auth-guest');
      showToast(`Welcome back, ${userObj.full_name || userObj.email}!`, 'success');

      this.selectedPU = null;
      this.render();
      window.location.href = 'index.html';
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || 'Invalid email or password.';
        errorEl.classList.remove('hidden');
      }
      showToast('Authentication failed', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In</span><span class="text-xs">→</span>`;
      }
    }
  },

  quickFillLogin: function(email, password) {
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    if (emailEl) emailEl.value = email;
    if (passEl) passEl.value = password;
    this.handleLoginSubmit();
  },

  signOut: function() {
    AuthState.clearSession();
    this.selectedPU = null;
    this.myProductionUnits = [];
    sessionStorage.removeItem('masar_active_tenant_pu_id');
    this._setStoredPU(null);
    document.documentElement.classList.add('auth-guest');
    const headerEl = document.querySelector('header');
    if (headerEl) headerEl.style.display = 'none';
    const footerEl = document.querySelector('footer');
    if (footerEl) footerEl.style.display = 'none';
    const sidebar = document.getElementById('masar-sidebar');
    if (sidebar) sidebar.style.display = 'none';
    showToast('Signed out of session', 'info');
    this.render();
  },

  /* -------------------------------------------------------------
   * TENANT PRODUCTION UNIT GOVERNANCE & MULTI-PU SWITCHER
   * ------------------------------------------------------------- */
  myProductionUnits: [],

  loadTenantPUsAndGovernance: async function() {
    try {
      const resp = await AuthAPI.getMyProductionUnits();
      this.myProductionUnits = Array.isArray(resp) ? resp : (resp.production_units || resp.business_units || resp.data || []);

      // Fallback: If empty, extract PUs from user roles
      if (this.myProductionUnits.length === 0) {
        const user = AuthState.getUser();
        if (user && user.roles && user.roles.length > 0) {
          user.roles.forEach(r => {
            if (r.production_unit_id && !this.myProductionUnits.some(p => p.id === r.production_unit_id)) {
              this.myProductionUnits.push({
                id: r.production_unit_id,
                code: r.production_unit_code || 'PU',
                name: r.production_unit_name || 'Production Line'
              });
            }
          });
        }
      }

      const puSwitcher = document.getElementById('header-pu-switcher');
      const puSelect = document.getElementById('header-pu-select');
      const puSelectionSection = document.getElementById('section-pu-selection');
      const tenantSection = document.getElementById('section-tenant-hub');

      if (this.myProductionUnits.length > 1) {
        if (puSwitcher) puSwitcher.classList.remove('hidden');

        // Check if user has already selected a specific PU in this active view session
        let activePUId = sessionStorage.getItem('masar_active_tenant_pu_id');
        const exists = this.myProductionUnits.find(p => p.id === activePUId);

        if (!exists) {
          // Show PU selection cards view (One card for each PU)
          if (tenantSection) tenantSection.classList.add('hidden');
          if (puSelectionSection) puSelectionSection.classList.remove('hidden');
          this.renderPUSelectionCards();
          return;
        }

        // Active PU is selected
        if (puSelect) {
          puSelect.innerHTML = this.myProductionUnits.map(p => `
            <option value="${p.id}" ${p.id === activePUId ? 'selected' : ''}>${p.code} - ${p.name}</option>
          `).join('');
        }

        if (puSelectionSection) puSelectionSection.classList.add('hidden');
        if (tenantSection) tenantSection.classList.remove('hidden');

        const breadcrumbSep = document.getElementById('tenant-breadcrumb-pu-sep');
        const breadcrumbLink = document.getElementById('tenant-breadcrumb-pu-link');
        if (breadcrumbSep) breadcrumbSep.classList.remove('hidden');
        if (breadcrumbLink) breadcrumbLink.classList.remove('hidden');

        await this.renderTenantPUGovernance();
        if (typeof window.loadAllCards === 'function') {
          window.loadAllCards();
        }
      } else if (this.myProductionUnits.length === 1) {
        // Directly jump to the PU page
        const singlePU = this.myProductionUnits[0];
        sessionStorage.setItem('masar_active_tenant_pu_id', singlePU.id);

        if (puSelect) {
          puSelect.innerHTML = `<option value="${singlePU.id}" selected>${singlePU.code} - ${singlePU.name}</option>`;
        }
        if (puSwitcher) puSwitcher.classList.remove('hidden');

        if (puSelectionSection) puSelectionSection.classList.add('hidden');
        if (tenantSection) tenantSection.classList.remove('hidden');

        const breadcrumbSep = document.getElementById('tenant-breadcrumb-pu-sep');
        const breadcrumbLink = document.getElementById('tenant-breadcrumb-pu-link');
        if (breadcrumbSep) breadcrumbSep.classList.add('hidden');
        if (breadcrumbLink) breadcrumbLink.classList.add('hidden');

        await this.renderTenantPUGovernance();
        if (typeof window.loadAllCards === 'function') {
          window.loadAllCards();
        }
      } else {
        if (puSwitcher) puSwitcher.classList.add('hidden');
        if (puSelectionSection) puSelectionSection.classList.add('hidden');
        if (tenantSection) tenantSection.classList.remove('hidden');
        await this.renderTenantPUGovernance();
      }
    } catch (err) {
      console.warn('Failed to load user production units:', err);
      await this.renderTenantPUGovernance();
    }
  },

  showPUSelection: function() {
    sessionStorage.removeItem('masar_active_tenant_pu_id');
    const puSelectionSection = document.getElementById('section-pu-selection');
    const tenantSection = document.getElementById('section-tenant-hub');
    const adminSection = document.getElementById('section-admin-portal');
    if (adminSection) adminSection.classList.add('hidden');
    if (tenantSection) tenantSection.classList.add('hidden');
    if (puSelectionSection) puSelectionSection.classList.remove('hidden');
    this.renderPUSelectionCards();
  },

  openProductionUnitWorkspace: function(puId) {
    this.switchProductionUnit(puId);
  },

  renderPUSelectionCards: function() {
    const container = document.getElementById('pu-selection-cards-grid');
    const badge = document.getElementById('pu-selection-count-badge');
    if (badge) {
      badge.textContent = `${this.myProductionUnits.length} Production Lines Assigned`;
    }
    if (!container) return;

    if (this.myProductionUnits.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white border border-gray-200 rounded-xl p-8 text-center text-xs text-gray-500">
          No Production Units are currently assigned to your account. Please contact your Server Administrator.
        </div>
      `;
      return;
    }

    const user = AuthState.getUser();
    const isServerAdmin = AuthState.isServerAdmin();

    container.innerHTML = this.myProductionUnits.map(pu => {
      return `
        <div class="bg-white border-2 border-gray-200 hover:border-indigo-500 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group">
          <div>
            <div class="flex items-center justify-between mb-4">
              <span class="font-mono text-xs font-black bg-slate-900 text-emerald-300 px-3 py-1 rounded-lg border border-slate-700">
                ${pu.code}
              </span>
              ${isServerAdmin ? `
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1 font-mono">
                  <span>👑</span><span>Server Admin</span>
                </span>
              ` : `
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Operator
                </span>
              `}
            </div>

            <h2 class="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
              ${pu.name}
            </h2>
            <p class="text-xs text-gray-500 mt-2 leading-relaxed">
              ${pu.description || 'Dedicated manufacturing facility, cleanroom optical assembly, characterization, and hardware verification.'}
            </p>

            <div class="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <div class="flex items-center space-x-1.5">
                <span>🏭</span>
                <span class="font-medium">${pu.user_count || 1} Enrolled ${pu.user_count === 1 ? 'User' : 'Users'}</span>
              </div>
              <div class="flex items-center space-x-1.5 text-emerald-600 font-bold">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Operational</span>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-gray-100">
            <button onclick="AdminPortal.openProductionUnitWorkspace('${pu.id}')"
                    class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-2 group-hover:shadow">
              <span>Open Production Line Workspace</span>
              <span class="transform group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  switchProductionUnit: function(puId) {
    sessionStorage.setItem('masar_active_tenant_pu_id', puId);
    const puSelect = document.getElementById('header-pu-select');
    if (puSelect && puSelect.value !== puId) {
      puSelect.value = puId;
    }
    const found = this.myProductionUnits.find(p => p.id === puId);
    if (found) {
      showToast(`Switched active line to ${found.name}`, 'info');
    }

    const puSelectionSection = document.getElementById('section-pu-selection');
    const tenantSection = document.getElementById('section-tenant-hub');
    if (puSelectionSection) puSelectionSection.classList.add('hidden');
    if (tenantSection) tenantSection.classList.remove('hidden');

    const breadcrumbSep = document.getElementById('tenant-breadcrumb-pu-sep');
    const breadcrumbLink = document.getElementById('tenant-breadcrumb-pu-link');
    const breadcrumbActive = document.getElementById('tenant-breadcrumb-active-pu');

    if (this.myProductionUnits.length > 1) {
      if (breadcrumbSep) breadcrumbSep.classList.remove('hidden');
      if (breadcrumbLink) breadcrumbLink.classList.remove('hidden');
    } else {
      if (breadcrumbSep) breadcrumbSep.classList.add('hidden');
      if (breadcrumbLink) breadcrumbLink.classList.add('hidden');
    }

    if (breadcrumbActive && found) {
      breadcrumbActive.textContent = `${found.code} - ${found.name}`;
    }

    this.renderTenantPUGovernance();
    if (typeof window.loadAllCards === 'function') {
      window.loadAllCards();
    }
  },

  getActiveTenantPU: function() {
    if (!this.myProductionUnits || this.myProductionUnits.length === 0) return null;
    const storedId = sessionStorage.getItem('masar_active_tenant_pu_id');
    const found = this.myProductionUnits.find(p => p.id === storedId);
    return found || this.myProductionUnits[0];
  },

  renderTenantPUGovernance: async function() {
    const activePU = this.getActiveTenantPU();
    const adminCard = document.getElementById('hub-admin-card');
    const container = document.getElementById('tenant-pu-governance-container');

    // Clean up container if present in DOM so no admin options are displayed on this page
    if (container) {
      container.innerHTML = '';
      container.classList.add('hidden');
    }

    if (!activePU) {
      if (adminCard) adminCard.classList.add('hidden');
      return;
    }

    const isServerAdmin = AuthState.isServerAdmin();

    // Update breadcrumb active PU title
    const breadcrumbActive = document.getElementById('tenant-breadcrumb-active-pu');
    if (breadcrumbActive && activePU) {
      breadcrumbActive.textContent = `${activePU.code} - ${activePU.name}`;
    }

    if (!isServerAdmin) {
      if (adminCard) adminCard.classList.add('hidden');
      return;
    }

    // Configure Admin Authority card for Server Admin
    if (adminCard) {
      adminCard.classList.remove('hidden');
      const targetUrl = `pipeline.html?pu=${encodeURIComponent(activePU.id)}`;
      adminCard.href = targetUrl;
      adminCard.onclick = (e) => {
        e.preventDefault();
        window.location.href = targetUrl;
      };
    }

    try {
      const [usersResp, stagesResp] = await Promise.all([
        AuthAPI.listPUUsers(activePU.id).catch(() => ({ users: [] })),
        AuthAPI.listPipelineStages(activePU.id).catch(() => ({ stages: [] }))
      ]);

      const users = usersResp.users || [];
      const stages = stagesResp.stages || [];

      const stagesCountEl = document.getElementById('hub-admin-stages-count');
      const usersCountEl = document.getElementById('hub-admin-users-count');
      if (stagesCountEl) stagesCountEl.textContent = `${stages.length} Stages`;
      if (usersCountEl) usersCountEl.textContent = `${users.length} Members`;
    } catch (err) {
      console.warn('Failed to load PU Admin card metrics:', err);
    }
  },


  /* -------------------------------------------------------------
   * LEVEL 2: Production Units View
   * ------------------------------------------------------------- */
  loadProductionUnits: async function() {
    this.selectedPU = null;
    this._setStoredPU(null);

    const container = document.getElementById('admin-content-area');
    if (!container) return;

    this.renderAdminBreadcrumbs([
      { title: 'Production Units', active: true }
    ]);

    container.innerHTML = `
      <div class="flex items-center justify-center p-12 text-gray-400">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
        <span>Loading Production Units...</span>
      </div>
    `;

    try {
      const resp = await AuthAPI.listDedicatedProductionUnits();
      const pus = Array.isArray(resp) ? resp : (resp.production_units || resp.business_units || resp.data || []);
      this.productionUnits = pus;

      let cardsHtml = '';
      if (pus.length === 0) {
        cardsHtml = `
          <div class="col-span-full bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-2xl font-bold">🏭</div>
            <h3 class="text-base font-bold text-gray-800">No Production Units Configured</h3>
            <p class="text-xs text-gray-500 mt-1 max-w-md mx-auto">Use the '+ Add Production Unit' button above to create a new manufacturing facility or cleanroom line.</p>
          </div>
        `;
      } else {
        cardsHtml = pus.map(pu => {
          return `
            <div class="group bg-white border border-gray-200 hover:border-emerald-500 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between relative">
              
              <div>
                <div class="flex items-center justify-between mb-4">
                  <span class="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-emerald-300 tracking-wider">
                    ${pu.code}
                  </span>
                  <!-- User Count Badge and Delete Button -->
                  <div class="flex items-center space-x-1.5">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      👥 ${pu.user_count || 0} ${pu.user_count === 1 ? 'User' : 'Users'}
                    </span>
                    <button type="button"
                            onclick="event.stopPropagation(); AdminPortal.openDeletePUModal('${pu.id}')"
                            class="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Production Unit">
                      🗑️
                    </button>
                  </div>
                </div>

                <h3 class="text-base font-extrabold text-gray-900 group-hover:text-emerald-600 transition-colors">
                  ${pu.name}
                </h3>
                <p class="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                  ${pu.description || 'Quantum Hardware Assembly & Traceability Unit.'}
                </p>
              </div>

              <!-- Actions on Card -->
              <div class="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <a href="pipeline.html?pu=${encodeURIComponent(pu.id)}" 
                   class="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center space-x-1">
                  <span>⚡</span><span>Traceability Chain</span>
                </a>
                <button onclick="AdminPortal.selectPU('${pu.id}')"
                        class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1">
                  <span>👥</span><span>Manage Team</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Top Bar: Action Buttons & PU Header -->
          <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center space-x-4">
              <!-- Plus Sign at Top Left Corner to Add PU -->
              <button onclick="AdminPortal.openAddPUModal()" 
                      class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-sm transition-all hover:shadow">
                <span class="text-base leading-none font-bold">+</span>
                <span>Add Production Unit</span>
              </button>

              <div class="border-l border-gray-200 pl-4">
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-bold text-gray-900">Production Units</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-emerald-400">Dedicated Portal</span>
                </div>
                <p class="text-[11px] text-gray-500">Dedicated manufacturing facilities, cleanroom assembly lines, and user rosters.</p>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <span class="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md font-semibold text-[11px]">
                Total Facilities: <strong>${pus.length}</strong>
              </span>
              <button onclick="AdminPortal.loadProductionUnits()" class="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded text-gray-600 text-xs font-medium">
                🔄 Refresh
              </button>
            </div>
          </div>

          <!-- Production Units Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${cardsHtml}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl text-xs">
          <strong>Failed to load production units:</strong> ${err.message}
          <div class="mt-3">
            <button onclick="AdminPortal.loadProductionUnits()" class="px-3 py-1 bg-rose-600 text-white rounded font-medium">Retry</button>
          </div>
        </div>
      `;
    }
  },

  selectPU: function(id) {
    const pu = (this.productionUnits || []).find(b => b.id === id);
    if (!pu) return;
    this.selectedPU = pu;
    this._setStoredPU(pu);
    this.loadPUUsers(this.selectedPU);
  },

  /* -------------------------------------------------------------
   * LEVEL 3: Production Unit Users View (PU Admin at Top)
   * ------------------------------------------------------------- */
  loadPUUsers: async function(pu) {
    const container = document.getElementById('admin-content-area');
    if (!container) return;

    if (!pu) {
      pu = this._getStoredPU();
    }
    if (!pu) {
      this.loadProductionUnits();
      return;
    }

    this.selectedPU = pu;
    this._setStoredPU(pu);

    const orgName = 'TII Industrial';

    const breadcrumbs = [
      { title: 'Production Units', click: 'AdminPortal.loadProductionUnits()', active: false },
      { title: pu.name, active: true }
    ];
    this.renderAdminBreadcrumbs(breadcrumbs);

    container.innerHTML = `
      <div class="flex items-center justify-center p-12 text-gray-400">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
        <span>Loading User Roster for ${pu.name}...</span>
      </div>
    `;

    try {
      const resp = await AuthAPI.listPUUsers(pu.id);
      const users = Array.isArray(resp) ? resp : (resp.users || resp.data || []);

      // Render Operator Users Table
      let allUsersHtml = '';
      if (users.length === 0) {
        allUsersHtml = `
          <tr>
            <td colspan="5" class="py-12 text-center text-xs text-gray-400">
              <div class="text-2xl mb-2">👥</div>
              <p class="font-bold text-gray-700">No team members currently enrolled in this production unit.</p>
              <p class="mt-1 text-gray-500">Invite new cleanroom personnel and assign their operational unit roles.</p>
              <button onclick="AdminPortal.openInvitePUUserModal()"
                      class="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition-all">
                <span>+</span><span>Invite Team Member</span>
              </button>
            </td>
          </tr>
        `;
      } else {
        const sortedUsers = [...users].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        allUsersHtml = sortedUsers.map(u => {
          const roleBadges = (u.roles || []).map(r => {
            let rawRole = typeof r === 'string' ? r : (r && r.role ? r.role : '');
            let displayRole = rawRole;
            let stageScope = '';
            if (rawRole.includes(':')) {
              const parts = rawRole.split(':');
              displayRole = parts[0];
              stageScope = parts.slice(1).join(':');
            }

            let icon = '🏷️';
            let color = 'bg-slate-100 text-slate-700 border-slate-200';
            if (displayRole === 'InventoryAdmin') {
              icon = '📦';
              color = 'bg-teal-100 text-teal-900 border-teal-300';
            } else if (displayRole === 'PipelineAdmin') {
              icon = '⚡';
              color = 'bg-purple-100 text-purple-900 border-purple-300';
            } else if (displayRole === 'OpticalEngineer') {
              icon = '🔬';
              color = 'bg-indigo-100 text-indigo-900 border-indigo-200';
            } else if (displayRole === 'QAInspector') {
              icon = '🛡️';
              color = 'bg-rose-100 text-rose-900 border-rose-200';
            } else if (displayRole === 'AssemblyOperator') {
              icon = '🔧';
              color = 'bg-blue-100 text-blue-900 border-blue-200';
            }

            const stageBadge = stageScope ? `
              <span class="ml-1 px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-900 text-amber-300 border border-slate-800">
                📍 ${stageScope}
              </span>
            ` : '';

            return `
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${color} border mr-1 mb-1">
                <span class="mr-1">${icon}</span>
                <span>${displayRole}</span>
                ${stageBadge}
                <button onclick="AdminPortal.removeUserRole('${pu.id}', '${u.id}', '${rawRole}')"
                        class="ml-1.5 text-gray-400 hover:text-rose-600 font-bold transition-colors" title="Remove role">✕</button>
              </span>
            `;
          }).join('') || '<span class="text-gray-400 italic text-[11px]">No roles assigned</span>';

          const statusBadge = u.is_active
            ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">🟢 Active</span>`
            : `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">🟡 Inactive (Invited)</span>`;

          return `
            <tr class="hover:bg-gray-50/80 transition-colors border-b border-gray-100 text-xs">
              <td class="py-3 px-4 text-gray-900">
                <div class="flex items-center space-x-2">
                  <span>👤</span>
                  <span class="font-bold">${u.full_name || 'Invited Operator'}</span>
                </div>
              </td>
              <td class="py-3 px-4 text-gray-600 font-mono">${u.email}</td>
              <td class="py-3 px-4">${roleBadges}</td>
              <td class="py-3 px-4">${statusBadge}</td>
              <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                <button onclick="AdminPortal.openAddUserRoleModal('${u.id}', '${(u.full_name || u.email).replace(/'/g, "\\'")}')"
                        class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-bold transition-all inline-flex items-center space-x-1">
                  <span>➕</span><span>Assign Role</span>
                </button>
                <button onclick="AdminPortal.removeUserFromPU('${pu.id}', '${u.id}', '${(u.full_name || u.email).replace(/'/g, "\\'")}')"
                        class="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded text-[11px] font-bold shadow-sm transition-all inline-flex items-center space-x-1">
                  <span>🗑️</span><span>Remove</span>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Top Bar: PU Header & Quick Links -->
          <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-mono text-xs font-bold bg-slate-900 text-emerald-300 px-2 py-0.5 rounded">${pu.code}</span>
                <h1 class="text-base font-bold text-gray-900">${pu.name} — Team Management</h1>
              </div>
              <p class="text-[11px] text-gray-500 mt-0.5">Facility Team & Member Roles · ${users.length} ${users.length === 1 ? 'Member' : 'Members'}</p>
            </div>

            <div class="flex items-center space-x-2">
              <button onclick="AdminPortal.openInvitePUUserModal()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all">
                <span>+</span><span>Invite Team Member</span>
              </button>
              <a href="pipeline.html?pu=${encodeURIComponent(pu.id)}" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all">
                <span>⚡</span><span>Traceability Chain</span>
              </a>
              <button onclick="AdminPortal.loadProductionUnits()" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-xs font-semibold flex items-center space-x-1">
                <span>←</span><span>Back to Production Units</span>
              </button>
            </div>
          </div>

          <!-- Server Admin Policy Banner -->
          <div class="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 flex items-start space-x-3">
            <span class="text-base leading-none mt-0.5">ℹ️</span>
            <div>
              <strong class="font-bold">Server Administrator Global Governance:</strong>
              <span class="text-indigo-800">
                As global server administrator, you configure products and their properties, define stage Bill of Materials (BoM), and assign invited cleanroom operators to dedicated units. Products are immutable once created; only properties can be modified.
              </span>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-gray-700">Team Members & Role Assignments</h3>
                <p class="text-[11px] text-gray-400">Invite new team members, manage assignments, and define operational unit scopes</p>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                  ${users.length} ${users.length === 1 ? 'Member' : 'Members'}
                </span>
                <button onclick="AdminPortal.openInvitePUUserModal()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold flex items-center space-x-1 shadow-sm transition-all">
                  <span>+</span><span>Invite Team Member</span>
                </button>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider font-extrabold text-gray-500">
                    <th class="py-3 px-4">Full Name</th>
                    <th class="py-3 px-4">Email Address</th>
                    <th class="py-3 px-4">Assigned Roles</th>
                    <th class="py-3 px-4">Status</th>
                    <th class="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${allUsersHtml}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-xl text-xs">
          <strong>Failed to load PU users:</strong> ${err.message}
          <div class="mt-3">
            <button onclick="AdminPortal.loadPUUsers(AdminPortal.selectedPU)" class="px-3 py-1 bg-rose-600 text-white rounded font-medium">Retry</button>
          </div>
        </div>
      `;
    }
  },

  backToProductionUnits: function() {
    this.loadProductionUnits();
  },

  renderAdminBreadcrumbs: function(crumbs) {
    const el = document.getElementById('admin-breadcrumbs');
    if (!el) return;

    el.innerHTML = crumbs.map((crumb, idx) => {
      const isLast = idx === crumbs.length - 1;
      if (isLast) {
        return `<span class="font-extrabold text-gray-800 uppercase tracking-wider text-[11px]">${crumb.title}</span>`;
      }
      return `
        <button onclick="${crumb.click}" class="hover:text-indigo-600 font-medium">
          ${crumb.title}
        </button>
        <span class="text-gray-400">/</span>
      `;
    }).join(' ');
  },

  /* -------------------------------------------------------------
   * MODALS: Add PU, Add PU Admin
   * ------------------------------------------------------------- */
  openAddPUModal: function() {
    const modal = document.getElementById('modal-add-pu') || document.getElementById('modal-add-bu');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('new-pu-code') || document.getElementById('new-bu-code');
    if (input) input.focus();
  },

  submitAddPU: async function(e) {
    if (e) e.preventDefault();
    const codeEl = document.getElementById('new-pu-code') || document.getElementById('new-bu-code');
    const nameEl = document.getElementById('new-pu-name') || document.getElementById('new-bu-name');
    const descEl = document.getElementById('new-pu-desc') || document.getElementById('new-bu-desc');
    const errEl = document.getElementById('new-pu-error') || document.getElementById('new-bu-error');

    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
    const name = nameEl ? nameEl.value.trim() : '';
    const desc = descEl ? descEl.value.trim() : '';

    if (!code || !name) {
      if (errEl) {
        errEl.textContent = 'Please specify both production unit code and name.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    try {
      await AuthAPI.createDedicatedProductionUnit(code, name, desc);
      showToast(`Production unit '${name}' created successfully!`, 'success');
      this.closeAllModals();
      this.loadProductionUnits();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    }
  },

  /* -------------------------------------------------------------
   * MODAL: Confirm Deletion (PU)
   * ------------------------------------------------------------- */
  openDeletePUModal: function(id) {
    const pu = (this.productionUnits || []).find(b => b.id === id);
    const name = pu ? pu.name : 'Production Unit';
    const code = pu ? pu.code : '';
    this.pendingDelete = { type: 'pu', id: id, name: name, code: code };
    const modal = document.getElementById('modal-confirm-delete');
    const titleEl = document.getElementById('confirm-delete-title');
    const msgEl = document.getElementById('confirm-delete-message');
    const subtextEl = document.getElementById('confirm-delete-subtext');
    const errEl = document.getElementById('confirm-delete-error');

    if (titleEl) titleEl.innerHTML = `<span class="text-rose-500">🗑️</span><span>Delete Production Unit</span>`;
    if (msgEl) msgEl.innerHTML = `Are you sure you want to delete production unit <strong>${code} - ${name}</strong>?`;
    if (subtextEl) subtextEl.innerHTML = `<strong>Account Update Policy:</strong> PU Administrator and user memberships in this production unit will be unlinked. If users hold roles in other production units, their accounts and other assignments will remain intact.`;
    if (errEl) errEl.classList.add('hidden');

    if (modal) modal.classList.remove('hidden');
  },

  submitConfirmDelete: async function() {
    if (!this.pendingDelete) return;
    const btn = document.getElementById('confirm-delete-btn');
    const errEl = document.getElementById('confirm-delete-error');
    if (errEl) errEl.classList.add('hidden');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Deleting...';
    }

    try {
      await AuthAPI.deleteProductionUnit(this.pendingDelete.id);
      showToast(`Production Unit '${this.pendingDelete.name}' deleted successfully.`, 'success');
      this.closeAllModals();
      this.pendingDelete = null;
      this.loadProductionUnits();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
      showToast('Deletion failed: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Delete Permanently';
      }
    }
  },

  togglePasswordVisibility: function(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
  },

  getCurrentPU: function() {
    const adminSection = document.getElementById('section-admin');
    if (adminSection && !adminSection.classList.contains('hidden') && this.selectedPU && this.selectedPU.id) {
      return this.selectedPU;
    }
    const active = this.getActiveTenantPU();
    if (active && active.id) return active;
    if (this.selectedPU && this.selectedPU.id) return this.selectedPU;
    return null;
  },

  refreshCurrentViews: async function() {
    if (this.selectedPU) {
      const adminSection = document.getElementById('section-admin');
      if (adminSection && !adminSection.classList.contains('hidden')) {
        await this.loadPUUsers(this.selectedPU);
      }
    }
    const tenantSection = document.getElementById('section-tenant-hub');
    if (tenantSection && !tenantSection.classList.contains('hidden')) {
      await this.renderTenantPUGovernance();
    }
  },

  generateRandomOTP: function(inputId) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let otp = '';
    const randomVals = new Uint8Array(12);
    window.crypto.getRandomValues(randomVals);
    for (let i = 0; i < 12; i++) {
      otp += charset[randomVals[i] % charset.length];
    }
    const input = document.getElementById(inputId);
    if (input) {
      input.value = otp;
      input.type = 'text';
    }
  },

  openInvitePUUserModal: async function() {
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const titleEl = document.getElementById('invite-pu-name-modal');
    if (titleEl) titleEl.textContent = `${pu.code} - ${pu.name}`;

    const emailInput = document.getElementById('invite-user-email');
    if (emailInput) emailInput.value = '';

    const errEl = document.getElementById('invite-pu-error');
    if (errEl) errEl.classList.add('hidden');

    this.generateRandomOTP('invite-user-otp');

    const rolesContainer = document.getElementById('invite-roles-checkboxes');
    if (rolesContainer) {
      rolesContainer.innerHTML = `
        <div class="flex items-center space-x-2 text-gray-400 p-2 text-xs">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
          <span>Loading available roles...</span>
        </div>
      `;
    }

    const stageSelect = document.getElementById('invite-stage-scope');
    if (stageSelect) {
      stageSelect.innerHTML = `<option value="">🏢 Facility-Wide (All Pipeline Stages)</option>`;
    }

    const modal = document.getElementById('modal-invite-pu-user');
    if (modal) modal.classList.remove('hidden');

    try {
      const [respRoles, respStages] = await Promise.all([
        AuthAPI.listRoles(pu.id),
        AuthAPI.listPipelineStages(pu.id).catch(() => ({ stages: [] }))
      ]);

      const roles = (respRoles.roles || []).filter(r => r.role_key !== 'PUAdmin' && r.role_key !== 'puadmin' && r.role_key !== 'BUAdmin');
      const stages = respStages.stages || [];

      if (rolesContainer) {
        if (roles.length === 0) {
          rolesContainer.innerHTML = `<p class="text-xs text-gray-400 italic">No roles configured for this PU.</p>`;
        } else {
          rolesContainer.innerHTML = roles.map(r => {
            const roleName = r.role_key;
            let icon = '🏷️';
            if (roleName === 'PUAdmin') icon = '👑';
            else if (roleName === 'InventoryAdmin') icon = '📦';
            else if (roleName === 'PipelineAdmin') icon = '⚡';
            else if (roleName === 'OpticalEngineer') icon = '🔬';
            else if (roleName === 'QAInspector') icon = '🛡️';
            else if (roleName === 'AssemblyOperator') icon = '🔧';

            const isChecked = roleName === 'AssemblyOperator' || roleName === 'OpticalEngineer';

            return `
              <label class="flex items-start space-x-2.5 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-gray-200">
                <input type="checkbox" name="invite-pu-role-checkbox" value="${r.role_key}" ${isChecked ? 'checked' : ''}
                       class="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500">
                <div class="flex-1 text-xs">
                  <div class="flex items-center space-x-1.5 font-bold text-gray-800">
                    <span>${icon}</span>
                    <span>${r.name}</span>
                    <span class="text-[10px] text-gray-400 font-mono">(${r.role_key})</span>
                    ${r.is_custom ? '<span class="text-[9px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-semibold">Custom</span>' : ''}
                  </div>
                  <div class="text-[11px] text-gray-500 mt-0.5">${r.description || 'Standard line operation responsibility'}</div>
                </div>
              </label>
            `;
          }).join('');
        }
      }

      if (stageSelect) {
        stageSelect.innerHTML = `
          <option value="">🏢 Facility-Wide (All Pipeline Stages)</option>
          ${stages.map(st => `<option value="${st.stage_key}">Stage ${st.sequence_num}: ${st.name} (${st.stage_key})</option>`).join('')}
        `;
      }
    } catch (err) {
      if (rolesContainer) {
        rolesContainer.innerHTML = `<p class="text-xs text-rose-500">Failed to load roles: ${err.message}</p>`;
      }
    }
  },

  submitInvitePUUser: async function(event) {
    if (event) event.preventDefault();
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const email = (document.getElementById('invite-user-email')?.value || '').trim();
    const otp = (document.getElementById('invite-user-otp')?.value || '').trim();
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="invite-pu-role-checkbox"]:checked'));
    const selectedRoles = checkedBoxes.map(cb => cb.value);
    const stageScope = (document.getElementById('invite-stage-scope')?.value || '').trim();

    const errEl = document.getElementById('invite-pu-error');
    if (errEl) errEl.classList.add('hidden');

    if (!email) {
      if (errEl) {
        errEl.textContent = 'Please enter a valid member email address.';
        errEl.classList.remove('hidden');
      }
      return;
    }
    if (!otp || otp.length < 8) {
      if (errEl) {
        errEl.textContent = 'One-time password must be at least 8 characters long.';
        errEl.classList.remove('hidden');
      }
      return;
    }
    if (selectedRoles.length === 0) {
      if (errEl) {
        errEl.textContent = 'Please assign at least one initial role to the user.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    const finalRoles = stageScope
      ? selectedRoles.map(r => `${r}:${stageScope}`)
      : selectedRoles;

    const submitBtn = event?.target?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending Invitation...';
    }

    try {
      await AuthAPI.inviteUser(pu.id, email, otp, finalRoles);
      const scopeNote = stageScope ? ` (scoped to stage ${stageScope})` : '';
      showToast(`Invited ${email} with ${finalRoles.length} role(s)${scopeNote}. Share OTP: ${otp}`, 'success');
      this.closeAllModals();
      await this.refreshCurrentViews();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
      showToast('Invitation failed: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Invitation';
      }
    }
  },

  openAddUserRoleModal: async function(userId, userName) {
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const targetUserIdInput = document.getElementById('target-user-role-id');
    const targetUserNameEl = document.getElementById('target-user-role-name');
    const roleSelect = document.getElementById('select-role-to-add');
    const stageSelect = document.getElementById('add-role-stage-scope');
    const errEl = document.getElementById('add-role-error');

    if (targetUserIdInput) targetUserIdInput.value = userId;
    if (targetUserNameEl) targetUserNameEl.textContent = userName || 'User';
    if (errEl) errEl.classList.add('hidden');

    if (roleSelect) {
      roleSelect.innerHTML = `<option value="">Loading available roles...</option>`;
    }
    if (stageSelect) {
      stageSelect.innerHTML = `<option value="">🏢 Facility-Wide (All Pipeline Stages)</option>`;
    }

    const modal = document.getElementById('modal-add-user-role');
    if (modal) modal.classList.remove('hidden');

    try {
      const [respRoles, respStages] = await Promise.all([
        AuthAPI.listRoles(pu.id),
        AuthAPI.listPipelineStages(pu.id).catch(() => ({ stages: [] }))
      ]);

      const roles = (respRoles.roles || []).filter(r => r.role_key !== 'PUAdmin' && r.role_key !== 'puadmin' && r.role_key !== 'BUAdmin');
      const stages = respStages.stages || [];

      if (roleSelect) {
        roleSelect.innerHTML = roles.map(r => `
          <option value="${r.role_key}">${r.name} (${r.role_key}) ${r.is_custom ? '— Custom' : ''}</option>
        `).join('');
      }

      if (stageSelect) {
        stageSelect.innerHTML = `
          <option value="">🏢 Facility-Wide (All Pipeline Stages)</option>
          ${stages.map(st => `<option value="${st.stage_key}">Stage ${st.sequence_num}: ${st.name} (${st.stage_key})</option>`).join('')}
        `;
      }
    } catch (err) {
      if (roleSelect) {
        roleSelect.innerHTML = `<option value="">Failed to load roles</option>`;
      }
    }
  },

  submitAddUserRole: async function(event) {
    if (event) event.preventDefault();
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const userId = document.getElementById('target-user-role-id')?.value;
    const role = document.getElementById('select-role-to-add')?.value;
    const stageScope = (document.getElementById('add-role-stage-scope')?.value || '').trim();
    const errEl = document.getElementById('add-role-error');
    if (errEl) errEl.classList.add('hidden');

    if (!userId || !role) {
      if (errEl) {
        errEl.textContent = 'Please select a role to assign.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    const finalRole = stageScope ? `${role}:${stageScope}` : role;

    const submitBtn = event?.target?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Granting...';
    }

    try {
      await AuthAPI.addUserRole(pu.id, userId, finalRole);
      const scopeNote = stageScope ? ` (scoped to stage ${stageScope})` : '';
      showToast(`Role '${finalRole}' assigned successfully${scopeNote}.`, 'success');
      this.closeAllModals();
      await this.refreshCurrentViews();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
      showToast('Failed to assign role: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Grant Role';
      }
    }
  },

  removeUserRole: async function(puId, userId, role) {
    if (!puId) {
      const pu = this.getCurrentPU();
      puId = pu ? pu.id : null;
    }
    if (!puId) {
      showToast('No active Production Unit specified.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to remove role '${role}' from this user in this Production Unit?`)) {
      return;
    }

    try {
      await AuthAPI.removeUserRole(puId, userId, role);
      showToast(`Role '${role}' removed successfully.`, 'success');
      await this.refreshCurrentViews();
    } catch (err) {
      showToast('Failed to remove role: ' + err.message, 'error');
    }
  },

  removeUserFromPU: async function(puId, userId, userName) {
    if (!puId) {
      const pu = this.getCurrentPU() || this.selectedPU;
      puId = pu ? pu.id : null;
    }
    if (!puId) {
      showToast('No active Production Unit specified.', 'error');
      return;
    }

    const displayName = userName || 'this user';
    if (!confirm(`Are you sure you want to remove ${displayName} from this Production Unit? All associated roles in this unit will be removed.`)) {
      return;
    }

    try {
      await AuthAPI.removeUserFromPU(puId, userId);
      showToast(`${displayName} was successfully removed from this Production Unit.`, 'success');
      if (this.selectedPU) {
        await this.loadPUUsers(this.selectedPU);
      } else {
        await this.refreshCurrentViews();
      }
    } catch (err) {
      showToast('Failed to remove user: ' + err.message, 'error');
    }
  },

  openManageStagesModal: async function() {
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const titleEl = document.getElementById('stages-pu-name-modal');
    if (titleEl) titleEl.textContent = `${pu.code} - ${pu.name}`;

    const errEl = document.getElementById('stages-error');
    if (errEl) errEl.classList.add('hidden');

    const keyInp = document.getElementById('new-stage-key');
    const nameInp = document.getElementById('new-stage-name');
    const seqInp = document.getElementById('new-stage-seq');
    const descInp = document.getElementById('new-stage-desc');
    if (keyInp) keyInp.value = '';
    if (nameInp) nameInp.value = '';
    if (seqInp) seqInp.value = '10';
    if (descInp) descInp.value = '';

    const modal = document.getElementById('modal-manage-stages');
    if (modal) modal.classList.remove('hidden');

    await this.refreshStagesList(pu.id);
  },

  refreshStagesList: async function(puId) {
    const listContainer = document.getElementById('stages-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="flex items-center space-x-2 text-gray-400 p-3 text-xs">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
        <span>Loading pipeline stages...</span>
      </div>
    `;

    try {
      const resp = await AuthAPI.listPipelineStages(puId);
      const stages = Array.isArray(resp) ? resp : (resp.stages || resp.data || []);

      if (stages.length === 0) {
        listContainer.innerHTML = `
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
            No pipeline stages defined. Add a stage using the form below.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = stages.map(st => `
        <div class="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors">
          <div class="flex items-center space-x-3">
            <span class="w-6 h-6 rounded-full bg-slate-900 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center">
              ${st.sequence_num}
            </span>
            <div>
              <div class="flex items-center space-x-2 font-bold text-gray-800 text-xs">
                <span>${st.name}</span>
                <span class="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">${st.stage_key}</span>
              </div>
              <div class="text-[11px] text-gray-500">${st.description || 'Quality gate sequence stage'}</div>
            </div>
          </div>
          <div class="flex items-center space-x-1">
            <button onclick="AdminPortal.openEditStageModal('${st.id}', '${(st.stage_key || '').replace(/'/g, "\\'")}', '${(st.name || '').replace(/'/g, "\\'")}', ${st.sequence_num || 1}, '${(st.description || '').replace(/'/g, "\\'")}')"
                    class="px-2 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded text-xs font-semibold transition-colors flex items-center space-x-1" title="Modify Stage">
              <span>✏️</span><span>Edit</span>
            </button>
            <button onclick="AdminPortal.deletePipelineStage('${st.id}')"
                    class="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-xs font-semibold transition-colors flex items-center space-x-1" title="Delete Stage">
              <span>🗑️</span><span>Delete</span>
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      listContainer.innerHTML = `
        <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
          Failed to load pipeline stages: ${err.message}
        </div>
      `;
    }
  },

  openEditStageModal: function(stageId, stageKey, name, seq, desc) {
    const idInput = document.getElementById('edit-stage-id');
    const keyBadge = document.getElementById('edit-stage-key-badge');
    const nameInput = document.getElementById('edit-stage-name');
    const seqInput = document.getElementById('edit-stage-seq');
    const descInput = document.getElementById('edit-stage-desc');
    const errEl = document.getElementById('edit-stage-error');

    if (idInput) idInput.value = stageId;
    if (keyBadge) keyBadge.textContent = stageKey;
    if (nameInput) nameInput.value = name || '';
    if (seqInput) seqInput.value = seq || 10;
    if (descInput) descInput.value = desc || '';
    if (errEl) errEl.classList.add('hidden');

    const modal = document.getElementById('modal-edit-stage');
    if (modal) modal.classList.remove('hidden');
  },

  submitUpdatePipelineStage: async function(event) {
    if (event) event.preventDefault();
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const stageId = document.getElementById('edit-stage-id')?.value;
    const name = (document.getElementById('edit-stage-name')?.value || '').trim();
    const seq = parseInt(document.getElementById('edit-stage-seq')?.value || '1', 10);
    const desc = (document.getElementById('edit-stage-desc')?.value || '').trim();

    const errEl = document.getElementById('edit-stage-error');
    if (errEl) errEl.classList.add('hidden');

    if (!stageId || !name) {
      if (errEl) {
        errEl.textContent = 'Please provide a valid stage display name.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    const submitBtn = event?.target?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    try {
      await AuthAPI.updatePipelineStage(pu.id, stageId, {
        name: name,
        sequence_num: seq,
        description: desc
      });
      showToast(`Pipeline stage '${name}' updated successfully.`, 'success');

      const editModal = document.getElementById('modal-edit-stage');
      if (editModal) editModal.classList.add('hidden');

      await this.refreshStagesList(pu.id);
      await this.refreshCurrentViews();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
      showToast('Failed to update stage: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
      }
    }
  },

  scrollToGovernance: function() {
    const target = document.getElementById('tenant-pu-governance-container') || document.getElementById('section-tenant-hub');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('ring-4', 'ring-amber-400', 'ring-opacity-70', 'transition-all', 'duration-500');
      setTimeout(() => {
        target.classList.remove('ring-4', 'ring-amber-400', 'ring-opacity-70');
      }, 1500);
    }
  },

  submitCreatePipelineStage: async function(event) {
    if (event) event.preventDefault();
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const key = (document.getElementById('new-stage-key')?.value || '').trim();
    const name = (document.getElementById('new-stage-name')?.value || '').trim();
    const seq = parseInt(document.getElementById('new-stage-seq')?.value || '1', 10);
    const desc = (document.getElementById('new-stage-desc')?.value || '').trim();

    const errEl = document.getElementById('stages-error');
    if (errEl) errEl.classList.add('hidden');

    if (!key || !name) {
      if (errEl) {
        errEl.textContent = 'Please specify both Stage Key and Display Name.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    const submitBtn = event?.target?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';
    }

    try {
      await AuthAPI.createPipelineStage(pu.id, {
        stage_key: key,
        name: name,
        sequence_num: seq,
        description: desc
      });
      showToast(`Pipeline stage '${name}' defined successfully.`, 'success');

      document.getElementById('new-stage-key').value = '';
      document.getElementById('new-stage-name').value = '';
      document.getElementById('new-stage-desc').value = '';
      document.getElementById('new-stage-seq').value = (seq + 10).toString();

      await this.refreshStagesList(pu.id);
      await this.refreshCurrentViews();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
      showToast('Failed to define stage: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '+ Add Pipeline Stage';
      }
    }
  },

  deletePipelineStage: async function(stageId) {
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    if (!confirm('Are you sure you want to remove this pipeline stage?')) {
      return;
    }

    try {
      await AuthAPI.deletePipelineStage(pu.id, stageId);
      showToast('Pipeline stage removed.', 'success');
      await this.refreshStagesList(pu.id);
      await this.refreshCurrentViews();
    } catch (err) {
      showToast('Failed to delete stage: ' + err.message, 'error');
    }
  },

  openManageCustomRolesModal: async function() {
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const titleEl = document.getElementById('custom-roles-pu-name-modal');
    if (titleEl) titleEl.textContent = `${pu.code} - ${pu.name}`;

    const errEl = document.getElementById('custom-roles-error');
    if (errEl) errEl.classList.add('hidden');

    const keyInp = document.getElementById('new-role-key');
    const nameInp = document.getElementById('new-role-name');
    const descInp = document.getElementById('new-role-desc');
    if (keyInp) keyInp.value = '';
    if (nameInp) nameInp.value = '';
    if (descInp) descInp.value = '';

    const modal = document.getElementById('modal-manage-custom-roles');
    if (modal) modal.classList.remove('hidden');

    await this.refreshCustomRolesList(pu.id);
  },

  refreshCustomRolesList: async function(puId) {
    const listContainer = document.getElementById('custom-roles-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="flex items-center space-x-2 text-gray-400 p-3 text-xs">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
        <span>Loading custom roles...</span>
      </div>
    `;

    try {
      const resp = await AuthAPI.listRoles(puId);
      const roles = (resp.roles || []).filter(r => r.is_custom);

      if (roles.length === 0) {
        listContainer.innerHTML = `
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 text-center">
            No custom roles created yet. Built-in roles (PUAdmin, InventoryAdmin, PipelineAdmin, OpticalEngineer, QAInspector, AssemblyOperator) are active by default.
          </div>
        `;
        return;
      }

      listContainer.innerHTML = roles.map(r => `
        <div class="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors">
          <div class="flex items-center space-x-3">
            <span class="text-base">🏷️</span>
            <div>
              <div class="flex items-center space-x-2 font-bold text-gray-800 text-xs">
                <span>${r.name}</span>
                <span class="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">${r.role_key}</span>
              </div>
              <div class="text-[11px] text-gray-500">${r.description || 'Specialized line role'}</div>
            </div>
          </div>
          <button onclick="AdminPortal.deleteCustomRole('${r.role_key}')"
                  class="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded text-xs font-semibold transition-colors flex items-center space-x-1">
            <span>🗑️</span><span>Delete</span>
          </button>
        </div>
      `).join('');
    } catch (err) {
      listContainer.innerHTML = `
        <div class="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
          Failed to load custom roles: ${err.message}
        </div>
      `;
    }
  },

  submitCreateCustomRole: async function(event) {
    if (event) event.preventDefault();
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    const key = (document.getElementById('new-role-key')?.value || '').trim();
    const name = (document.getElementById('new-role-name')?.value || '').trim();
    const desc = (document.getElementById('new-role-desc')?.value || '').trim();

    const errEl = document.getElementById('custom-roles-error');
    if (errEl) errEl.classList.add('hidden');

    if (!key || !name) {
      if (errEl) {
        errEl.textContent = 'Please specify both Role Key and Role Display Name.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    const submitBtn = event?.target?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Defining...';
    }

    try {
      await AuthAPI.createCustomRole(pu.id, key, name, desc);
      showToast(`Custom role '${name}' defined successfully.`, 'success');

      document.getElementById('new-role-key').value = '';
      document.getElementById('new-role-name').value = '';
      document.getElementById('new-role-desc').value = '';

      await this.refreshCustomRolesList(pu.id);
      await this.refreshCurrentViews();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
      showToast('Failed to create role: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '+ Define Custom Role';
      }
    }
  },

  deleteCustomRole: async function(roleKey) {
    const pu = this.getCurrentPU();
    if (!pu) {
      showToast('No active Production Unit selected.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to delete custom role '${roleKey}'?`)) {
      return;
    }

    try {
      await AuthAPI.deleteCustomRole(pu.id, roleKey);
      showToast(`Custom role '${roleKey}' deleted.`, 'success');
      await this.refreshCustomRolesList(pu.id);
      await this.refreshCurrentViews();
    } catch (err) {
      showToast('Failed to delete role: ' + err.message, 'error');
    }
  },

  closeAllModals: function() {
    [
      'modal-add-org', 'modal-add-pu', 'modal-add-bu', 'modal-add-pu-admin', 'modal-add-bu-admin',
      'modal-confirm-delete', 'modal-invite-pu-user', 'modal-add-user-role', 'modal-manage-stages', 'modal-edit-stage', 'modal-manage-custom-roles'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    // Reset error messages and fields
    [
      'new-org-error', 'new-pu-error', 'new-bu-error', 'new-admin-error', 'confirm-delete-error',
      'invite-pu-error', 'add-role-error', 'stages-error', 'edit-stage-error', 'custom-roles-error'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    this.pendingDelete = null;
  }
};

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AdminPortal.init();
});
