const { jsPDF } = window.jspdf;

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

// Load saved business info into form
const bizNameEl = document.getElementById('bizName');
const bizEmailEl = document.getElementById('bizEmail');
const bizSocialEl = document.getElementById('bizSocial');
const bizSocialPlatformEl = document.getElementById('bizSocialPlatform');
const bizAreaCodeEl = document.getElementById('bizAreaCode');
const bizPhoneEl = document.getElementById('bizPhone');
const bizNoteEl = document.getElementById('bizNote');

bizNameEl.value = businessInfo.name || '';
bizEmailEl.value = businessInfo.email || '';
bizSocialEl.value = businessInfo.social ? businessInfo.social.replace(/^@/, '') : '';
bizSocialPlatformEl.value = businessInfo.socialPlatform || '';
bizAreaCodeEl.value = businessInfo.areaCode || '+1-876-';
bizPhoneEl.value = businessInfo.phone
  ? businessInfo.phone.replace(/\D/g, '').slice(businessInfo.areaCode.replace(/\D/g, '').length)
  : '';
bizNoteEl.value = businessInfo.note || '';

function getOrderDate(order) {
  if (order.createdAt) {
    const d = new Date(order.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }

  if (order.date) {
    const d = new Date(order.date);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatCurrency(value) {
  return `J$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Update prefix displays
function updatePhonePrefixes() {
  const code = businessInfo.areaCode || '+1-876-';
  document.getElementById('customerPhonePrefix').textContent = code;
  document.getElementById('bizPhonePrefix').textContent = code;
}
updatePhonePrefixes();

// Show preview if logo exists
if (businessInfo.logoData) {
  document.getElementById('logoPreview').src = businessInfo.logoData;
  document.getElementById('logoPreview').style.display = 'block';
}

// Auto-format phone inputs
function formatPhone(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 7) value = value.slice(0, 7);

  let formatted = '';
  if (value.length > 0) {
    formatted = value.slice(0, 3);
    if (value.length > 3) formatted += '-' + value.slice(3);
  }

  input.value = formatted;
}

document.getElementById('customerPhone').addEventListener('input', function () {
  formatPhone(this);
});

document.getElementById('bizPhone').addEventListener('input', function () {
  formatPhone(this);
});

// Handle logo upload
document.getElementById('bizLogoUpload').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const dataUrl = event.target.result;
    document.getElementById('logoPreview').src = dataUrl;
    document.getElementById('logoPreview').style.display = 'block';
    businessInfo.logoData = dataUrl;
  };
  reader.readAsDataURL(file);
});

function saveBusinessInfo() {
  let socialHandle = bizSocialEl.value.trim();
  if (socialHandle && !socialHandle.startsWith('@')) {
    socialHandle = '@' + socialHandle;
  }

  const areaCode = bizAreaCodeEl.value.trim() || '+1-876-';

  businessInfo = {
    name: bizNameEl.value.trim() || '',
    email: bizEmailEl.value.trim() || '',
    social: socialHandle,
    socialPlatform: bizSocialPlatformEl.value || '',
    areaCode,
    phone: bizPhoneEl.value.trim() ? areaCode + bizPhoneEl.value.trim() : '',
    logoData: businessInfo.logoData || '',
    note: bizNoteEl.value.trim() || 'Thank you for your order!'
  };

  localStorage.setItem('businessInfo', JSON.stringify(businessInfo));
  updatePhonePrefixes();
  alert('Business information saved!');
  document.getElementById('businessSettings').style.display = 'none';
}

function saveOrders() {
  localStorage.setItem('jamaicaSalesOrders', JSON.stringify(orders));
  updateDashboard();
  renderOrders();
}

function updateDashboard() {
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  document.getElementById('totalRevenue').textContent = `Total Revenue: ${formatCurrency(total)} | Orders: ${orders.length}`;

  const now = new Date();
  const todayRevenue = orders.reduce((sum, order) => {
    const date = getOrderDate(order);
    return date && isSameDay(date, now) ? sum + order.total : sum;
  }, 0);

  const pendingPayments = orders.filter(order => ['Pending', 'Partial'].includes(order.paymentStatus)).length;

  const platformCounts = orders.reduce((acc, order) => {
    const key = order.platform || 'Other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  let topPlatform = '—';
  let topCount = 0;
  Object.entries(platformCounts).forEach(([platform, count]) => {
    if (count > topCount) {
      topCount = count;
      topPlatform = platform;
    }
  });

  document.getElementById('todayRevenue').textContent = formatCurrency(todayRevenue);
  document.getElementById('pendingPayments').textContent = String(pendingPayments);
  document.getElementById('topPlatform').textContent = topPlatform;
}

function getFilteredOrders() {
  const searchTerm = document.getElementById('searchOrders').value.trim().toLowerCase();
  const dateFilter = document.getElementById('dateFilter').value;
  const now = new Date();

  return orders
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => {
      // date filter
      const date = getOrderDate(order);
      if (dateFilter === 'today' && (!date || !isSameDay(date, now))) return false;
      if (dateFilter === 'week') {
        if (!date) return false;
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        if (diffDays > 7 || diffDays < 0) return false;
      }
      if (dateFilter === 'month') {
        if (!date) return false;
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        if (diffDays > 30 || diffDays < 0) return false;
      }

      if (!searchTerm) return true;

      const itemNames = (order.items || []).map(item => item.name).join(' ').toLowerCase();
      const haystack = [
        order.customerName,
        order.customerPhone,
        order.platform,
        order.paymentStatus,
        order.notes,
        itemNames
      ].join(' ').toLowerCase();

      return haystack.includes(searchTerm);
    });
}

function renderOrders() {
  const list = document.getElementById('orders-list');
  list.innerHTML = '';

  const filteredOrders = getFilteredOrders();

  if (filteredOrders.length === 0) {
    list.innerHTML = '<p class="empty-orders">No matching orders found.</p>';
    return;
  }

  filteredOrders.forEach(({ order, index }) => {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
      <strong>Order #${index + 1} - ${order.date}</strong><br>
      Customer: ${order.customerName}<br>
      Phone: ${order.customerPhone}<br>
      Platform: ${order.platform} | Status: ${order.paymentStatus}<br>
      Total: ${formatCurrency(order.total)}<br>
      <div class="btn-group">
        <button class="download-btn" onclick="generatePDF(${index})">Download PDF</button>
        <button class="share-btn" onclick="shareReceipt(${index})">Share Receipt</button>
        <button class="edit-btn" onclick="editOrder(${index})">Edit</button>
        <button class="delete-btn" onclick="confirmDeleteOrder(${index})">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function createReceiptDocument(index) {
  const order = orders[index];
  const doc = new jsPDF();
  let y = 20;

  if (businessInfo.logoData) {
    try {
      doc.addImage(businessInfo.logoData, 'PNG', 80, y, 50, 50);
      y += 55;
    } catch (e) { /* ignore image failures */ }
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
  doc.text(`Order #${index + 1} - ${order.date}`, 20, y);
  y += 10;
  doc.text(`Customer: ${order.customerName}`, 20, y);
  doc.text(`Phone: ${order.customerPhone}`, 20, y += 7);
  doc.text(`Platform: ${order.platform}`, 20, y += 7);
  if (order.notes) doc.text(`Notes: ${order.notes}`, 20, y += 7);
  y += 12;

  doc.text('Items:', 20, y);
  y += 8;
  order.items.forEach(item => {
    doc.text(`${item.qty} × ${item.name} @ J$${item.price.toFixed(2)} = J$${(item.qty * item.price).toFixed(2)}`, 25, y);
    y += 8;
  });

  y += 8;
  doc.text(`Subtotal: J$${order.subtotal.toFixed(2)}`, 20, y);
  doc.text(`Delivery: J$${order.deliveryFee.toFixed(2)}`, 20, y += 8);
  doc.setFontSize(14);
  doc.setTextColor(212, 175, 55);
  doc.text(`TOTAL: J$${order.total.toFixed(2)}`, 20, y += 10);

  doc.setFontSize(10);
  doc.setTextColor(0);
  let receiptNote = businessInfo.note || 'Thank you for your order!';
  if (businessInfo.social) {
    const platform = businessInfo.socialPlatform || 'social media';
    receiptNote = `Thank you! Follow us on ${platform} ${businessInfo.social} for more.`;
  }
  doc.text(receiptNote, 105, y += 15, { align: 'center' });

  return doc;
}

function generatePDF(index) {
  const doc = createReceiptDocument(index);
  doc.save(`receipt_${index + 1}.pdf`);
}

function exportCSV() {
  if (orders.length === 0) {
    alert('No orders to export yet.');
    return;
  }

  const headers = [
    'Order #', 'Date', 'Customer Name', 'Customer Phone', 'Platform', 'Payment Status',
    'Notes', 'Items', 'Subtotal', 'Delivery Fee', 'Total'
  ];

  const csvEscape = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = orders.map((order, index) => {
    const itemsSummary = order.items
      .map(item => `${item.qty}x ${item.name} @ J$${item.price.toFixed(2)}`)
      .join(' | ');

    return [
      index + 1,
      order.date,
      order.customerName,
      order.customerPhone,
      order.platform,
      order.paymentStatus,
      order.notes || '',
      itemsSummary,
      order.subtotal.toFixed(2),
      order.deliveryFee.toFixed(2),
      order.total.toFixed(2)
    ].map(csvEscape).join(',');
  });

  const csvContent = [headers.map(csvEscape).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `seller_tracker_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function shareReceipt(index) {
  const order = orders[index];
  const doc = createReceiptDocument(index);

  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], `receipt_${index + 1}.pdf`, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: `Receipt #${index + 1}`,
        text: `Order receipt for ${order.customerName}`
      });
    } catch (err) {
      doc.save(`receipt_${index + 1}.pdf`);
    }
  } else {
    doc.save(`receipt_${index + 1}.pdf`);
  }
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
  document.getElementById('notes').value = order.notes || '';
  document.getElementById('paymentStatus').value = order.paymentStatus || 'Pending';
  document.getElementById('deliveryFee').value = order.deliveryFee || 0;

  const itemsContainer = document.getElementById('items-container');
  itemsContainer.innerHTML = '';
  (order.items || []).forEach((item) => addItemRow(item));

  document.getElementById('saveOrderBtn').textContent = 'Update Order';
  document.getElementById('cancelEditBtn').style.display = 'block';
  updateSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetOrderForm() {
  const form = document.getElementById('orderForm');
  form.reset();
  document.getElementById('items-container').innerHTML = '';
  addItemRow();
  editingOrderIndex = null;
  document.getElementById('saveOrderBtn').textContent = 'Save Order';
  document.getElementById('cancelEditBtn').style.display = 'none';
  updateSummary();
}

function confirmDeleteOrder(index) {
  pendingDeleteIndex = index;
  const order = orders[index];
  document.getElementById('confirmMessage').textContent = `Delete order for ${order?.customerName || 'this customer'}? This cannot be undone.`;
  document.getElementById('confirmModal').style.display = 'flex';
  document.getElementById('confirmModal').setAttribute('aria-hidden', 'false');
}

function closeDeleteModal() {
  pendingDeleteIndex = null;
  document.getElementById('confirmModal').style.display = 'none';
  document.getElementById('confirmModal').setAttribute('aria-hidden', 'true');
}

function deleteOrderConfirmed() {
  if (pendingDeleteIndex === null) return;
  orders.splice(pendingDeleteIndex, 1);
  saveOrders();
  closeDeleteModal();
}

function addItemRow(item = null) {
  const container = document.getElementById('items-container');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <button type="button" class="remove-btn" onclick="this.parentElement.remove(); updateSummary()">X</button>

    <label>Item name / description</label>
    <input type="text" placeholder="e.g. Product name" class="item-name" value="${item?.name ? item.name.replace(/"/g, '&quot;') : ''}">

    <div class="item-grid">
      <div>
        <label>Qty</label>
        <input type="number" placeholder="1" value="${item?.qty ?? 1}" min="1" class="item-qty">
      </div>
      <div>
        <label>Price (JMD)</label>
        <input type="number" placeholder="0" value="${item?.price ?? 0}" min="0" step="0.01" class="item-price">
      </div>
    </div>
  `;
  container.appendChild(row);

  row.querySelector('.item-qty').addEventListener('input', updateSummary);
  row.querySelector('.item-price').addEventListener('input', updateSummary);

  updateSummary();
}

function updateSummary() {
  let subtotal = 0;
  document.querySelectorAll('.item-row').forEach((row) => {
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    subtotal += qty * price;
  });

  const delivery = parseFloat(document.getElementById('deliveryFee').value) || 0;
  const total = subtotal + delivery;
  document.getElementById('summary').textContent = `Subtotal: J$${subtotal.toFixed(2)} | Total: J$${total.toFixed(2)}`;
}

document.getElementById('orderForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const feedback = document.getElementById('feedback');
  const items = [];

  document.querySelectorAll('.item-row').forEach((row) => {
    const name = row.querySelector('.item-name').value.trim();
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (name && qty > 0) items.push({ name, qty, price });
  });

  if (!document.getElementById('customerName').value.trim()) {
    feedback.textContent = 'Customer name is required';
    feedback.className = 'feedback error';
    return;
  }

  if (items.length === 0) {
    feedback.textContent = 'Add at least one item';
    feedback.className = 'feedback error';
    return;
  }

  const areaCode = businessInfo.areaCode || '+1-876-';
  const customerPhoneFull = areaCode + document.getElementById('customerPhone').value.trim();

  const order = {
    date: new Date().toLocaleString('en-JM'),
    createdAt: new Date().toISOString(),
    customerName: document.getElementById('customerName').value.trim(),
    customerPhone: customerPhoneFull,
    platform: document.getElementById('platform').value,
    notes: document.getElementById('notes').value.trim(),
    paymentStatus: document.getElementById('paymentStatus').value,
    deliveryFee: parseFloat(document.getElementById('deliveryFee').value) || 0,
    items,
    subtotal: items.reduce((sum, item) => sum + item.qty * item.price, 0),
    total: items.reduce((sum, item) => sum + item.qty * item.price, 0)
      + (parseFloat(document.getElementById('deliveryFee').value) || 0)
  };

  if (editingOrderIndex !== null) {
    orders[editingOrderIndex] = { ...orders[editingOrderIndex], ...order };
    feedback.textContent = 'Order updated successfully!';
  } else {
    orders.push(order);
    feedback.textContent = 'Order saved successfully!';
  }

  feedback.className = 'feedback success';
  saveOrders();
  resetOrderForm();
});

// Init
addItemRow();
updateDashboard();
renderOrders();
document.getElementById('deliveryFee').addEventListener('input', updateSummary);
document.getElementById('searchOrders').addEventListener('input', renderOrders);
document.getElementById('dateFilter').addEventListener('change', renderOrders);
document.getElementById('cancelEditBtn').addEventListener('click', resetOrderForm);
document.getElementById('confirmDeleteBtn').addEventListener('click', deleteOrderConfirmed);
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
