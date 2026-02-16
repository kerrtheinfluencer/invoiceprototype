const jsPDFCtor = window.jspdf?.jsPDF || null;

let orders = JSON.parse(localStorage.getItem('jamaicaSalesOrders')) || [];
let businessInfo = JSON.parse(localStorage.getItem('businessInfo')) || {
  name: '',
  email: '',
  social: '',
  socialPlatform: '',
  areaCode: '+1-876-',
  phone: '',
  logoData: '',
  note: 'Thank you for your order!'
};

let editingOrderIndex = null;
let pendingDeleteIndex = null;

const orderForm = document.getElementById('orderForm');
const feedbackEl = document.getElementById('feedback');
const itemsContainer = document.getElementById('items-container');
const deliveryFeeEl = document.getElementById('deliveryFee');
const saveOrderBtn = document.getElementById('saveOrderBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const searchOrdersEl = document.getElementById('searchOrders');
const dateFilterEl = document.getElementById('dateFilter');
const ordersListEl = document.getElementById('orders-list');
const totalRevenueEl = document.getElementById('totalRevenue');

function formatCurrency(value) {
  return `J$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getOrderDate(order) {
  if (order.createdAt) {
    const parsed = new Date(order.createdAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (order.date) {
    const parsed = new Date(order.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function setFeedback(message, type = '') {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback${type ? ` ${type}` : ''}`;
}

function updatePhonePrefixes() {
  const code = businessInfo.areaCode || '+1-876-';
  document.getElementById('customerPhonePrefix').textContent = code;
  document.getElementById('bizPhonePrefix').textContent = code;
}

function formatPhone(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 7) value = value.slice(0, 7);
  input.value = value.length > 3 ? `${value.slice(0, 3)}-${value.slice(3)}` : value;
}

function updateSummary() {
  let subtotal = 0;
  document.querySelectorAll('.item-row').forEach((row) => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    subtotal += qty * price;
  });
  const delivery = parseFloat(deliveryFeeEl.value) || 0;
  const total = subtotal + delivery;
  document.getElementById('summary').textContent = `Subtotal: J$${subtotal.toFixed(2)} · Total: J$${total.toFixed(2)}`;
}

function addItemRow(item = null) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <button type="button" class="remove-btn" aria-label="Remove item">×</button>
    <label>Item name / description</label>
    <input type="text" class="item-name" placeholder="e.g. Product name" value="${item?.name ? item.name.replace(/"/g, '&quot;') : ''}">
    <div class="item-grid">
      <div>
        <label>Qty</label>
        <input type="number" class="item-qty" min="1" value="${item?.qty ?? 1}">
      </div>
      <div>
        <label>Price (JMD)</label>
        <input type="number" class="item-price" min="0" step="0.01" value="${item?.price ?? 0}">
      </div>
    </div>
  `;

  row.querySelector('.remove-btn').addEventListener('click', () => {
    row.remove();
    updateSummary();
  });
  row.querySelector('.item-qty').addEventListener('input', updateSummary);
  row.querySelector('.item-price').addEventListener('input', updateSummary);

  itemsContainer.appendChild(row);
  updateSummary();
}

function saveOrders() {
  localStorage.setItem('jamaicaSalesOrders', JSON.stringify(orders));
  updateDashboard();
  renderOrders();
}

function updateDashboard() {
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  totalRevenueEl.textContent = `Total Revenue: ${formatCurrency(totalRevenue)} · Orders: ${orders.length}`;

  const now = new Date();
  const todayRevenue = orders.reduce((sum, order) => {
    const d = getOrderDate(order);
    return d && isSameDay(d, now) ? sum + order.total : sum;
  }, 0);

  const pending = orders.filter((order) => ['Pending', 'Partial'].includes(order.paymentStatus)).length;

  const platformCount = orders.reduce((acc, order) => {
    const key = order.platform || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  let topPlatform = '—';
  let max = 0;
  Object.entries(platformCount).forEach(([platform, count]) => {
    if (count > max) {
      max = count;
      topPlatform = platform;
    }
  });

  document.getElementById('todayRevenue').textContent = formatCurrency(todayRevenue);
  document.getElementById('pendingPayments').textContent = String(pending);
  document.getElementById('topPlatform').textContent = topPlatform;
}

function getFilteredOrders() {
  const q = searchOrdersEl.value.trim().toLowerCase();
  const dateFilter = dateFilterEl.value;
  const now = new Date();

  return orders.map((order, index) => ({ order, index })).filter(({ order }) => {
    const d = getOrderDate(order);
    if (dateFilter === 'today' && (!d || !isSameDay(d, now))) return false;
    if (dateFilter === 'week') {
      if (!d) return false;
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      if (diff < 0 || diff > 7) return false;
    }
    if (dateFilter === 'month') {
      if (!d) return false;
      const diff = (now - d) / (1000 * 60 * 60 * 24);
      if (diff < 0 || diff > 30) return false;
    }

    if (!q) return true;

    const itemText = (order.items || []).map((i) => i.name).join(' ');
    return [
      order.customerName,
      order.customerPhone,
      order.platform,
      order.paymentStatus,
      order.notes,
      itemText
    ].join(' ').toLowerCase().includes(q);
  });
}

function renderOrders() {
  ordersListEl.innerHTML = '';
  const filtered = getFilteredOrders();

  if (filtered.length === 0) {
    ordersListEl.innerHTML = '<p class="empty-orders">No matching orders found.</p>';
    return;
  }

  filtered.forEach(({ order, index }) => {
    const card = document.createElement('div');
    card.className = 'order-item';
    card.innerHTML = `
      <strong>Order #${index + 1} · ${order.date}</strong><br>
      Customer: ${order.customerName}<br>
      Phone: ${order.customerPhone}<br>
      Platform: ${order.platform} · Status: ${order.paymentStatus}<br>
      Total: ${formatCurrency(order.total)}<br>
      <div class="btn-group">
        <button class="btn download-btn" type="button" data-action="download">Download PDF</button>
        <button class="btn share-btn" type="button" data-action="share">Share Receipt</button>
        <button class="btn edit-btn" type="button" data-action="edit">Edit</button>
        <button class="btn delete-btn" type="button" data-action="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-action="download"]').addEventListener('click', () => generatePDF(index));
    card.querySelector('[data-action="share"]').addEventListener('click', () => shareReceipt(index));
    card.querySelector('[data-action="edit"]').addEventListener('click', () => editOrder(index));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => openDeleteModal(index));

    ordersListEl.appendChild(card);
  });
}

function createReceiptDocument(index) {
  if (!jsPDFCtor) {
    alert('PDF features are unavailable right now. Please check your internet connection and reload.');
    return null;
  }

  const order = orders[index];
  const doc = new jsPDFCtor();
  let y = 20;

  if (businessInfo.logoData) {
    try {
      doc.addImage(businessInfo.logoData, 'PNG', 80, y, 50, 50);
      y += 55;
    } catch (e) { /* ignore */ }
  }

  doc.setFontSize(18);
  doc.setTextColor(0, 100, 0);
  doc.text(businessInfo.name || 'Business Name', 105, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(0);
  if (businessInfo.email) doc.text(`Email: ${businessInfo.email}`, 105, y, { align: 'center' });
  if (businessInfo.phone) doc.text(`WhatsApp: ${businessInfo.phone}`, 105, y += 6, { align: 'center' });
  if (businessInfo.social) {
    const platform = businessInfo.socialPlatform || 'social media';
    doc.text(`Follow us on ${platform}: ${businessInfo.social}`, 105, y += 6, { align: 'center' });
  }
  y += 10;

  doc.setFontSize(16);
  doc.text('Receipt', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(12);
  doc.text(`Order #${index + 1} · ${order.date}`, 20, y);
  y += 10;
  doc.text(`Customer: ${order.customerName}`, 20, y);
  doc.text(`Phone: ${order.customerPhone}`, 20, y += 7);
  doc.text(`Platform: ${order.platform}`, 20, y += 7);
  if (order.notes) doc.text(`Notes: ${order.notes}`, 20, y += 7);
  y += 10;

  doc.text('Items:', 20, y);
  y += 7;
  order.items.forEach((item) => {
    doc.text(`${item.qty} × ${item.name} @ J$${item.price.toFixed(2)} = J$${(item.qty * item.price).toFixed(2)}`, 24, y);
    y += 7;
  });

  y += 7;
  doc.text(`Subtotal: J$${order.subtotal.toFixed(2)}`, 20, y);
  doc.text(`Delivery: J$${order.deliveryFee.toFixed(2)}`, 20, y += 8);
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55);
  doc.text(`TOTAL: J$${order.total.toFixed(2)}`, 20, y += 10);

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(businessInfo.note || 'Thank you for your order!', 105, y += 14, { align: 'center' });
  return doc;
}

function generatePDF(index) {
  const doc = createReceiptDocument(index);
  if (!doc) return;
  doc.save(`receipt_${index + 1}.pdf`);
}

async function shareReceipt(index) {
  const order = orders[index];
  const doc = createReceiptDocument(index);
  if (!doc) return;
  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], `receipt_${index + 1}.pdf`, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `Receipt #${index + 1}`,
        text: `Order receipt for ${order.customerName}`
      });
    } catch {
      doc.save(`receipt_${index + 1}.pdf`);
    }
  } else {
    doc.save(`receipt_${index + 1}.pdf`);
  }
}

function exportCSV() {
  if (orders.length === 0) {
    alert('No orders to export yet.');
    return;
  }

  const headers = [
    'Order #', 'Date', 'Customer Name', 'Customer Phone', 'Platform',
    'Payment Status', 'Notes', 'Items', 'Subtotal', 'Delivery Fee', 'Total'
  ];

  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const rows = orders.map((order, i) => {
    const items = order.items.map((item) => `${item.qty}x ${item.name} @ J$${item.price.toFixed(2)}`).join(' | ');
    return [
      i + 1,
      order.date,
      order.customerName,
      order.customerPhone,
      order.platform,
      order.paymentStatus,
      order.notes || '',
      items,
      order.subtotal.toFixed(2),
      order.deliveryFee.toFixed(2),
      order.total.toFixed(2)
    ].map(csvEscape).join(',');
  });

  const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `seller_tracker_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetOrderForm() {
  orderForm.reset();
  editingOrderIndex = null;
  saveOrderBtn.textContent = 'Save Order';
  cancelEditBtn.classList.add('hidden');
  itemsContainer.innerHTML = '';
  addItemRow();
  setFeedback('');
}

function editOrder(index) {
  const order = orders[index];
  if (!order) return;
  editingOrderIndex = index;

  document.getElementById('customerName').value = order.customerName || '';
  const areaCode = businessInfo.areaCode || '+1-876-';
  document.getElementById('customerPhone').value = (order.customerPhone || '').replace(areaCode, '');
  formatPhone(document.getElementById('customerPhone'));
  document.getElementById('platform').value = order.platform || 'Instagram';
  document.getElementById('paymentStatus').value = order.paymentStatus || 'Pending';
  document.getElementById('notes').value = order.notes || '';
  deliveryFeeEl.value = order.deliveryFee || 0;

  itemsContainer.innerHTML = '';
  (order.items || []).forEach((item) => addItemRow(item));

  saveOrderBtn.textContent = 'Update Order';
  cancelEditBtn.classList.remove('hidden');
  setFeedback('Editing selected order...', 'success');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openDeleteModal(index) {
  pendingDeleteIndex = index;
  document.getElementById('confirmMessage').textContent = `Delete order for ${orders[index]?.customerName || 'this customer'}? This cannot be undone.`;
  const modal = document.getElementById('confirmModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeDeleteModal() {
  pendingDeleteIndex = null;
  const modal = document.getElementById('confirmModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function deleteOrderConfirmed() {
  if (pendingDeleteIndex === null) return;
  orders.splice(pendingDeleteIndex, 1);
  saveOrders();
  closeDeleteModal();
}

function saveBusinessInfo() {
  let social = document.getElementById('bizSocial').value.trim();
  if (social && !social.startsWith('@')) social = `@${social}`;

  const areaCode = document.getElementById('bizAreaCode').value.trim() || '+1-876-';
  const bizPhone = document.getElementById('bizPhone').value.trim();

  businessInfo = {
    name: document.getElementById('bizName').value.trim(),
    email: document.getElementById('bizEmail').value.trim(),
    social,
    socialPlatform: document.getElementById('bizSocialPlatform').value || '',
    areaCode,
    phone: bizPhone ? areaCode + bizPhone : '',
    logoData: businessInfo.logoData || '',
    note: document.getElementById('bizNote').value.trim() || 'Thank you for your order!'
  };

  localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
  updatePhonePrefixes();
  alert('Business information saved!');
  document.getElementById('businessSettings').classList.add('hidden');
}

orderForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const customerName = document.getElementById('customerName').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();
  if (!customerName) return setFeedback('Customer name is required', 'error');

  const items = [];
  document.querySelectorAll('.item-row').forEach((row) => {
    const name = row.querySelector('.item-name').value.trim();
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (name && qty > 0) items.push({ name, qty, price });
  });
  if (items.length === 0) return setFeedback('Add at least one item', 'error');

  const areaCode = businessInfo.areaCode || '+1-876-';
  const deliveryFee = parseFloat(deliveryFeeEl.value) || 0;
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);

  const order = {
    createdAt: new Date().toISOString(),
    date: new Date().toLocaleString('en-JM'),
    customerName,
    customerPhone: areaCode + customerPhone,
    platform: document.getElementById('platform').value,
    notes: document.getElementById('notes').value.trim(),
    paymentStatus: document.getElementById('paymentStatus').value,
    deliveryFee,
    items,
    subtotal,
    total: subtotal + deliveryFee
  };

  if (editingOrderIndex !== null) {
    orders[editingOrderIndex] = { ...orders[editingOrderIndex], ...order };
    setFeedback('Order updated successfully!', 'success');
  } else {
    orders.push(order);
    setFeedback('Order saved successfully!', 'success');
  }

  saveOrders();
  resetOrderForm();
});

// Business settings UI
const bizModal = document.getElementById('businessSettings');
const openBizBtn = document.getElementById('openBusinessSettings');
const closeBizBtn = document.getElementById('closeSettings');

openBizBtn.addEventListener('click', () => {
  bizModal.classList.remove('hidden');
  bizModal.setAttribute('aria-hidden', 'false');
});
closeBizBtn.addEventListener('click', () => {
  bizModal.classList.add('hidden');
  bizModal.setAttribute('aria-hidden', 'true');
});

document.getElementById('saveBusinessBtn').addEventListener('click', saveBusinessInfo);
document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
document.getElementById('addItemBtn').addEventListener('click', () => addItemRow());
cancelEditBtn.addEventListener('click', resetOrderForm);
searchOrdersEl.addEventListener('input', renderOrders);
dateFilterEl.addEventListener('change', renderOrders);
deliveryFeeEl.addEventListener('input', updateSummary);

document.getElementById('confirmDeleteBtn').addEventListener('click', deleteOrderConfirmed);
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);

// init business fields
document.getElementById('bizName').value = businessInfo.name || '';
document.getElementById('bizEmail').value = businessInfo.email || '';
document.getElementById('bizSocial').value = businessInfo.social ? businessInfo.social.replace(/^@/, '') : '';
document.getElementById('bizSocialPlatform').value = businessInfo.socialPlatform || '';
document.getElementById('bizAreaCode').value = businessInfo.areaCode || '+1-876-';
const bizDigits = businessInfo.phone ? businessInfo.phone.replace(/\D/g, '') : '';
const areaDigits = (businessInfo.areaCode || '+1-876-').replace(/\D/g, '');
document.getElementById('bizPhone').value = bizDigits.startsWith(areaDigits) ? bizDigits.slice(areaDigits.length) : '';
document.getElementById('bizNote').value = businessInfo.note || '';

if (businessInfo.logoData) {
  const preview = document.getElementById('logoPreview');
  preview.src = businessInfo.logoData;
  preview.style.display = 'block';
}

document.getElementById('bizLogoUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ({ target }) => {
    businessInfo.logoData = target.result;
    const preview = document.getElementById('logoPreview');
    preview.src = businessInfo.logoData;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

document.getElementById('customerPhone').addEventListener('input', function () { formatPhone(this); });
document.getElementById('bizPhone').addEventListener('input', function () { formatPhone(this); });

updatePhonePrefixes();
addItemRow();
updateDashboard();
renderOrders();
