/*
 * Masar Main Hub Card Loader
 * Loads live metrics concurrently for the core dashboard cards
 */

async function loadAllCards() {
  const refreshBtn = document.getElementById('hub-refresh-btn');
  if (refreshBtn) refreshBtn.classList.add('animate-spin');

  try {
    const [dashRes, prodRes, stockRes, procRes, settingsRes] = await Promise.all([
      CardAPI.getDashboard().catch(err => ({ success: false, error: err.message })),
      CardAPI.getProductionStatus().catch(err => ({ success: false, error: err.message })),
      CardAPI.getStock().catch(err => ({ success: false, error: err.message })),
      CardAPI.getProcurement().catch(err => ({ success: false, error: err.message })),
      CardAPI.getSettings().catch(err => ({ success: false, error: err.message }))
    ]);

    /* Dashboard overview card */
    if (dashRes && dashRes.success && dashRes.data) {
      const elUnits = document.getElementById('hub-dash-units');
      const elYield = document.getElementById('hub-dash-yield');
      if (elUnits) elUnits.innerText = dashRes.data.total_units_in_production;
      if (elYield) elYield.innerText = `${dashRes.data.first_pass_yield_pct.toFixed(1)}%`;
    }

    /* Production status and pairing metrics */
    if (prodRes && prodRes.success && prodRes.data) {
      const elSenders = document.getElementById('hub-prod-senders');
      const elReceivers = document.getElementById('hub-prod-receivers');
      const elPairs = document.getElementById('hub-prod-pairs');
      if (elSenders) elSenders.innerText = prodRes.data.total_senders;
      if (elReceivers) elReceivers.innerText = prodRes.data.total_receivers;
      if (elPairs) elPairs.innerText = prodRes.data.total_paired_sets;
    }

    /* Stock and inventory status */
    if (stockRes && stockRes.success && stockRes.data) {
      const elSkus = document.getElementById('hub-stock-skus');
      const elAlerts = document.getElementById('hub-stock-alerts');
      if (elSkus) elSkus.innerText = stockRes.data.total_skus;
      if (elAlerts) elAlerts.innerText = stockRes.data.low_stock_alerts_count;
    }

    /* Procurement and purchase orders */
    if (procRes && procRes.success && procRes.data) {
      const elOrders = document.getElementById('hub-proc-orders');
      const elSpend = document.getElementById('hub-proc-spend');
      if (elOrders) elOrders.innerText = procRes.data.open_orders_count;
      if (elSpend) elSpend.innerText = formatCurrency(procRes.data.monthly_spend_usd);
    }

    /* System settings and authentication status */
    if (settingsRes && settingsRes.success && settingsRes.data) {
      const elOidc = document.getElementById('hub-settings-oidc');
      const elBypass = document.getElementById('hub-settings-bypass');
      if (elOidc) elOidc.innerText = settingsRes.data.auth_config?.oidc_provider || 'Keycloak';
      if (elBypass) {
        elBypass.innerText = settingsRes.data.auth_config?.dev_bypass_active ? 'ACTIVE' : 'DISABLED';
      }
    }
  } catch (err) {
    console.error('Error loading cards:', err);
    showToast('Failed to refresh some card data: ' + err.message, 'error');
  } finally {
    if (refreshBtn) refreshBtn.classList.remove('animate-spin');
  }
}

/* Initial auto-load when document finishes loading (only if authenticated) */
document.addEventListener('DOMContentLoaded', () => {
  const token = typeof AuthState !== 'undefined' ? AuthState.getToken() : null;
  if (!token) return;
  loadAllCards();
});
