/**
 * Masar Procurement & Purchase Orders Controller
 * Manages optical foundry orders, CoC verification, and spend tracking
 */

async function loadProcurement() {
  try {
    const res = await ProcurementAPI.getProcurement();
    if (!res.success) return;
    const orders = res.data.orders || [];

    const elOpenOrders = document.getElementById('proc-open-orders');
    const elSpend = document.getElementById('proc-monthly-spend');
    const elPendingCoC = document.getElementById('proc-pending-coc');

    if (elOpenOrders) elOpenOrders.innerText = res.data.open_orders_count;
    if (elSpend) elSpend.innerText = formatCurrency(res.data.monthly_spend_usd);
    if (elPendingCoC) elPendingCoC.innerText = res.data.pending_coc_inspections;

    renderProcurementTable(orders);
  } catch (err) {
    console.error('Failed to load procurement:', err);
    showToast('Failed to load procurement orders: ' + err.message, 'error');
  }
}

function renderProcurementTable(orders) {
  const tbody = document.getElementById('proc-table-body');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400">No purchase orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(po => {
    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${po.po_number}</td>
        <td class="py-2.5 px-3 font-medium text-gray-800">${po.supplier_name}</td>
        <td class="py-2.5 px-3 text-gray-600 font-mono text-[11px]">${formatDate(po.issued_date)}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${formatCurrency(po.total_amount, po.currency)}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            ${po.status}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadProcurement();
});
