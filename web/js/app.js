/*
 * Masar App Utilities and Global UI State
 */

/* Format currency */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
}

/* Format date */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/* Format time */
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* Toast notification helper */
function showToast(message, type = 'info') {
  const toastId = 'masar-toast';
  let toast = document.getElementById(toastId);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded shadow-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-300 transform translate-y-10 opacity-0';
    document.body.appendChild(toast);
  }

  const bgColors = {
    info: 'bg-indigo-600 text-white',
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white'
  };

  toast.className = `fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded shadow-lg text-xs font-semibold flex items-center space-x-2 transition-all duration-300 transform translate-y-0 opacity-100 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `<span>${message}</span>`;

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-10 opacity-0');
  }, 3500);
}
