/*
 * Masar API Client
 * Manages communication with backend REST APIs and OIDC / Dev Bypass headers
 */

const API_CONFIG = {
  baseUrl: '/api/v1',
  bypassHeader: { 'X-Bypass-Token': 'masar-dev-bypass-secret-token-2026' }
};

const AuthState = {
  getToken: () => localStorage.getItem('masar_token') || localStorage.getItem('qtrace_token'),
  getUser: () => {
    try {
      const u = localStorage.getItem('masar_user') || localStorage.getItem('qtrace_user');
      return JSON.parse(u || 'null');
    } catch (e) {
      return null;
    }
  },
  isServerAdmin: () => (localStorage.getItem('masar_is_server_admin') === 'true' || localStorage.getItem('qtrace_is_server_admin') === 'true'),
  setSession: (token, user, isServerAdmin) => {
    localStorage.setItem('masar_token', token);
    localStorage.setItem('masar_user', JSON.stringify(user));
    localStorage.setItem('masar_is_server_admin', isServerAdmin ? 'true' : 'false');
    localStorage.removeItem('qtrace_token');
    localStorage.removeItem('qtrace_user');
    localStorage.removeItem('qtrace_is_server_admin');
  },
  clearSession: () => {
    localStorage.removeItem('masar_token');
    localStorage.removeItem('masar_user');
    localStorage.removeItem('masar_is_server_admin');
    localStorage.removeItem('qtrace_token');
    localStorage.removeItem('qtrace_user');
    localStorage.removeItem('qtrace_is_server_admin');
  }
};

/* Universal JSON fetch helper with dev bypass & JWT authentication */
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.baseUrl}${endpoint}`;
  
  const token = AuthState.getToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const headers = {
    'Accept': 'application/json',
    ...API_CONFIG.bypassHeader,
    ...authHeaders,
    ...(options.headers || {})
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok || (data.success === false)) {
      const errMsg = data.error || data.message || `HTTP error ${response.status}`;
      throw new Error(errMsg);
    }
    return data;
  } catch (error) {
    console.error(`[MASAR API Error] ${url}:`, error);
    throw error;
  }
}

/* Card APIs */
const CardAPI = {
  getDashboard: () => apiFetch('/cards/dashboard'),
  getProductionStatus: () => apiFetch('/cards/production-status'),
  getStock: () => apiFetch('/cards/stock'),
  getProcurement: () => apiFetch('/cards/procurement'),
  getSettings: () => apiFetch('/cards/settings')
};

/* Production & Traceability APIs */
const ProductionAPI = {
  getStatus: () => apiFetch('/cards/production-status'),
  listUnits: () => apiFetch('/production/units'),
  pairUnits: (senderId, receiverId, systemSetId) => 
    apiFetch('/production/pair', {
      method: 'POST',
      body: {
        sender_id: senderId,
        receiver_id: receiverId,
        system_set_id: systemSetId
      }
    }),
  unpairUnit: (unitId) => 
    apiFetch(`/production/units/${unitId}/unpair`, { method: 'POST' }),
  addRework: (unitId, reworkData) =>
    apiFetch(`/production/units/${unitId}/rework`, {
      method: 'POST',
      body: reworkData
    }),
  addDeviation: (unitId, deviationData) =>
    apiFetch(`/production/units/${unitId}/deviations`, {
      method: 'POST',
      body: deviationData
    })
};

/* Stock & Inventory APIs */
const StockAPI = {
  getStock: () => apiFetch('/cards/stock'),
  listItems: (category) => apiFetch(category ? `/stock/items?category=${encodeURIComponent(category)}` : '/stock/items'),
  createItem: (item) => apiFetch('/stock/items', {
    method: 'POST',
    body: item
  }),
  updateItemCategory: (id, category) => apiFetch(`/stock/items/${id}/category`, {
    method: 'PATCH',
    body: { category }
  }),
  updateItemField: (id, field, value) => apiFetch(`/stock/items/${id}/field`, {
    method: 'PATCH',
    body: { field, value }
  }),
  deleteItem: (id) => apiFetch(`/stock/items/${id}`, {
    method: 'DELETE'
  })
};

/* Procurement APIs */
const ProcurementAPI = {
  getProcurement: () => apiFetch('/cards/procurement'),
  listOrders: () => apiFetch('/procurement/orders')
};

/* Settings APIs */
const SettingsAPI = {
  getSettings: () => apiFetch('/cards/settings'),
  listBaselines: () => apiFetch('/settings/baselines')
};

/* Server Admin APIs */
const AuthAPI = {
  login: (email, password) => apiFetch('/identity/login', {
    method: 'POST',
    body: { email, password }
  }),
  listDedicatedProductionUnits: () => apiFetch('/auth/production-units'),
  createDedicatedProductionUnit: (code, name, description) => apiFetch('/auth/production-units', {
    method: 'POST',
    body: { code, name, description }
  }),
  deleteProductionUnit: (puId) => apiFetch(`/auth/production-units/${puId}`, {
    method: 'DELETE'
  }),
  listPUUsers: (puId) => apiFetch(`/auth/production-units/${puId}/users`),
  createPUAdmin: (puId, email, fullName, password) => apiFetch(`/auth/production-units/${puId}/admin`, {
    method: 'POST',
    body: { email, full_name: fullName, password }
  }),

  // Invitation & Registration
  registerInvite: (email, otp, fullName, newPassword) => apiFetch('/auth/register-invite', {
    method: 'POST',
    body: {
      email: email,
      one_time_password: otp,
      full_name: fullName,
      new_password: newPassword
    }
  }),

  // Multi-PU administration discovery
  getMyProductionUnits: () => apiFetch('/auth/my-production-units'),

  // Production Unit User Invitation & Role Management
  inviteUser: (puId, email, otp, roles) => apiFetch(`/auth/production-units/${puId}/invite-user`, {
    method: 'POST',
    body: {
      email: email,
      one_time_password: otp,
      roles: roles
    }
  }),
  addUserRole: (puId, userId, role) => apiFetch(`/auth/production-units/${puId}/users/${userId}/roles`, {
    method: 'POST',
    body: { role }
  }),
  removeUserRole: (puId, userId, role) => apiFetch(`/auth/production-units/${puId}/users/${userId}/roles/${encodeURIComponent(role)}`, {
    method: 'DELETE'
  }),
  removeUserFromPU: (puId, userId) => apiFetch(`/auth/production-units/${puId}/users/${userId}`, {
    method: 'DELETE'
  }),

  // Pipeline Stages Management & Assembly Filtering
  listPipelineStages: (puId, assemblyType) => apiFetch(assemblyType ? `/auth/production-units/${puId}/stages?assembly_type=${encodeURIComponent(assemblyType)}` : `/auth/production-units/${puId}/stages`),
  listAssemblyStages: (puId, assemblyType) => apiFetch(`/auth/production-units/${puId}/stages?assembly_type=${encodeURIComponent(assemblyType || 'ALL')}`),
  createPipelineStage: (puId, stage) => apiFetch(`/auth/production-units/${puId}/stages`, {
    method: 'POST',
    body: stage
  }),
  updatePipelineStage: (puId, stageId, stage) => apiFetch(`/auth/production-units/${puId}/stages/${stageId}`, {
    method: 'PUT',
    body: stage
  }),
  deletePipelineStage: (puId, stageId) => apiFetch(`/auth/production-units/${puId}/stages/${stageId}`, {
    method: 'DELETE'
  }),

  // Role Definitions (Built-in + Custom)
  listRoles: (puId) => apiFetch(`/auth/production-units/${puId}/roles`),
  createCustomRole: (puId, roleKey, name, description) => apiFetch(`/auth/production-units/${puId}/roles`, {
    method: 'POST',
    body: {
      role_key: roleKey,
      name: name,
      description: description
    }
  }),
  deleteCustomRole: (puId, roleKey) => apiFetch(`/auth/production-units/${puId}/roles/${encodeURIComponent(roleKey)}`, {
    method: 'DELETE'
  }),

  // Stage Operational Configuration
  updateStageConfig: (puId, stageId, config) => apiFetch(`/auth/production-units/${puId}/stages/${stageId}/config`, {
    method: 'PUT',
    body: config
  }),

  // Procurement Requests
  createProcurementRequest: (puId, stageKey, req) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/requests`, {
    method: 'POST',
    body: req
  }),
  listProcurementRequests: (puId, stageKey) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/requests`),
  approveProcurementRequest: (puId, requestId, allocatedSerialNumber, approvedBy) => apiFetch(`/auth/production-units/${puId}/requests/${requestId}/approve`, {
    method: 'POST',
    body: {
      allocated_serial_number: allocatedSerialNumber,
      approved_by: approvedBy
    }
  }),

  // Finished Products & BoM
  createFinishedProduct: (puId, stageKey, product) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/products`, {
    method: 'POST',
    body: product
  }),
  updateProductProperties: (puId, stageKey, productId, properties) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/products/${productId}`, {
    method: 'PUT',
    body: { properties }
  }),
  listFinishedProducts: (puId, stageKey, inspectionStatus) => {
    let url = `/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/products`;
    if (inspectionStatus) {
      url += `?inspection_status=${encodeURIComponent(inspectionStatus)}`;
    }
    return apiFetch(url);
  },
  getFinishedProductBoM: (puId, productId) => apiFetch(`/auth/production-units/${puId}/products/${productId}/bom`),

  // Tracking Parameters
  listTrackingParameters: (puId) => apiFetch(`/auth/production-units/${puId}/parameters`),
  createTrackingParameter: (puId, param) => apiFetch(`/auth/production-units/${puId}/parameters`, {
    method: 'POST',
    body: param
  }),
  updateTrackingParameter: (puId, paramKey, param) => apiFetch(`/auth/production-units/${puId}/parameters/${encodeURIComponent(paramKey)}`, {
    method: 'PUT',
    body: param
  }),
  deleteTrackingParameter: (puId, paramKey) => apiFetch(`/auth/production-units/${puId}/parameters/${encodeURIComponent(paramKey)}`, {
    method: 'DELETE'
  }),

  // Stage Parameters Assignment
  getStageParameters: (puId, stageKey) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/parameters`),
  setStageParameters: (puId, stageKey, parameterKeys) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/parameters`, {
    method: 'POST',
    body: { parameter_keys: parameterKeys }
  }),

  // Procured Components Catalog
  listProcuredComponents: (puId) => apiFetch(`/auth/production-units/${puId}/procured-components`),
  createProcuredComponent: (puId, comp) => apiFetch(`/auth/production-units/${puId}/procured-components`, {
    method: 'POST',
    body: comp
  }),
  deleteProcuredComponent: (puId, itemCode) => apiFetch(`/auth/production-units/${puId}/procured-components/${encodeURIComponent(itemCode)}`, {
    method: 'DELETE'
  }),

  // Build Sub-Assemblies
  listSubAssemblies: (puId) => apiFetch(`/auth/production-units/${puId}/sub-assemblies`),
  createSubAssembly: (puId, subAssembly) => apiFetch(`/auth/production-units/${puId}/sub-assemblies`, {
    method: 'POST',
    body: subAssembly
  }),
  updateSubAssembly: (puId, stageKey, subAssembly) => apiFetch(`/auth/production-units/${puId}/sub-assemblies/${encodeURIComponent(stageKey)}`, {
    method: 'PUT',
    body: subAssembly
  }),
  deleteSubAssembly: (puId, stageKey) => apiFetch(`/auth/production-units/${puId}/sub-assemblies/${encodeURIComponent(stageKey)}`, {
    method: 'DELETE'
  }),

  // Inspect Product Action (OK vs Faulty)
  inspectProduct: (puId, productId, inspectionData) => apiFetch(`/auth/production-units/${puId}/inspect/${productId}`, {
    method: 'POST',
    body: inspectionData
  }),

  // Parameter Carry-Forward Across Stages
  recordStageParameters: (puId, stageKey, recordData) => apiFetch(`/auth/production-units/${puId}/stages/${encodeURIComponent(stageKey)}/record-parameters`, {
    method: 'POST',
    body: recordData
  })
};

