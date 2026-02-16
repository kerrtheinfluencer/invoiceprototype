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
  // Load saved business info into form
  document.getElementById('bizName').value = businessInfo.name || '';
  document.getElementById('bizEmail').value = businessInfo.email || '';
  document.getElementById('bizSocial').value = businessInfo.social ? businessInfo.social.replace(/^@/, '') : '';
  document.getElementById('bizSocialPlatform').value = businessInfo.socialPlatform || '';
  document.getElementById('bizAreaCode').value = businessInfo.areaCode || '+1-876-';
  document.getElementById('bizPhone').value = businessInfo.phone ? businessInfo.phone.replace(/\D/g, '').slice(businessInfo.areaCode.replace(/\D/g, '').length) : '';
  document.getElementById('bizNote').value = businessInfo.note || '';
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
  document.getElementById('customerPhone').addEventListener('input', function() {
    formatPhone(this);
  });
  document.getElementById('bizPhone').addEventListener('input', function() {
    formatPhone(this);
  });
  // Handle logo upload
  document.getElementById('bizLogoUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
      const dataUrl = event.target.result;
      document.getElementById('logoPreview').src = dataUrl;
      document.getElementById('logoPreview').style.display = 'block';
      businessInfo.logoData = dataUrl;
    };
    reader.readAsDataURL(file);
  });
  function saveBusinessInfo() {
    let socialHandle = document.getElementById('bizSocial').value.trim();
    if (socialHandle && !socialHandle.startsWith('@')) {
      socialHandle = '@' + socialHandle;
    }
    const areaCode = document.getElementById('bizAreaCode').value.trim() || '+1-876-';
    businessInfo = {
      name: document.getElementById('bizName').value.trim() || '',
      email: document.getElementById('bizEmail').value.trim() || '',
      social: socialHandle,
      socialPlatform: document.getElementById('bizSocialPlatform').value || '',
      areaCode: areaCode,
      phone: document.getElementById('bizPhone').value.trim() ? areaCode + document.getElementById('bizPhone').value.trim() : '',
      logoData: businessInfo.logoData || '',
      note: document.getElementById('bizNote').value.trim() || 'Thank you for your order!'
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
    let total = orders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('totalRevenue').textContent = 
      `Total Revenue: J$${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} | Orders: ${orders.length}`;
  }
  function renderOrders() {
    const list = document.getElementById('orders-list');
    list.innerHTML = '';
    orders.forEach((order, index) => {
      const div = document.createElement('div');
      div.className = 'order-item';
      div.innerHTML = `
        <strong>Order #${index+1} - ${order.date}</strong><br>
        Customer: ${order.customerName}<br>
        Phone: ${order.customerPhone}<br>
        Platform: ${order.platform} | Status: ${order.paymentStatus}<br>
        Total: J$${order.total.toFixed(2)}<br>
        <div class="btn-group">
          <button class="download-btn" onclick="generatePDF(${index})">Download PDF</button>
          <button class="share-btn" onclick="shareReceipt(${index})">Share Receipt</button>
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
      } catch (e) {}
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
    const pdfFile = new File([pdfBlob], `receipt_${index+1}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Receipt #${index+1}`,
          text: `Order receipt for ${order.customerName}`
        });
      } catch (err) {
        // Fallback to download if share fails/cancelled
        doc.save(`receipt_${index+1}.pdf`);
      }
    } else {
      // Fallback for browsers without share API
      doc.save(`receipt_${index+1}.pdf`);
    }
  }
  function addItemRow() {
    const container = document.getElementById('items-container');
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <button type="button" class="remove-btn" onclick="this.parentElement.remove(); updateSummary()">X</button>
      <label>Item name / description</label>
      <input type="text" placeholder="e.g. Product name" class="item-name">
      <div class="item-grid">
        <div>
          <label>Qty</label>
          <input type="number" placeholder="1" value="1" min="1" class="item-qty">
        </div>
        <div>
          <label>Price (JMD)</label>
          <input type="number" placeholder="0" value="0" min="0" step="0.01" class="item-price">
        </div>
      </div>
    `;
    container.appendChild(row);
    updateSummary();
  }
  function updateSummary() {
    let subtotal = 0;
    document.querySelectorAll('.item-row').forEach(row => {
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      subtotal += qty * price;
    });
    const delivery = parseFloat(document.getElementById('deliveryFee').value) || 0;
    const total = subtotal + delivery;
    document.getElementById('summary').textContent = `Subtotal: J$${subtotal.toFixed(2)} | Total: J$${total.toFixed(2)}`;
  }
  document.getElementById('orderForm').addEventListener('submit', e => {
    e.preventDefault();
    const feedback = document.getElementById('feedback');
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
      const name = row.querySelector('.item-name').value.trim();
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      if (name && qty > 0) items.push({name, qty, price});
    });
    if (!document.getElementById('customerName').value.trim()) {
      feedback.textContent = "Customer name is required";
      feedback.className = "feedback error";
      return;
    }
    if (items.length === 0) {
      feedback.textContent = "Add at least one item";
      feedback.className = "feedback error";
      return;
    }
    const areaCode = businessInfo.areaCode || '+1-876-';
    const customerPhoneFull = areaCode + document.getElementById('customerPhone').value.trim();
    const order = {
      date: new Date().toLocaleString('en-JM'),
      customerName: document.getElementById('customerName').value.trim(),
      customerPhone: customerPhoneFull,
      platform: document.getElementById('platform').value,
      notes: document.getElementById('notes').value.trim(),
      paymentStatus: document.getElementById('paymentStatus').value,
      deliveryFee: parseFloat(document.getElementById('deliveryFee').value) || 0,
      items,
      subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
      total: items.reduce((s, i) => s + i.qty * i.price, 0) + (parseFloat(document.getElementById('deliveryFee').value) || 0)
    };
    orders.push(order);
    saveOrders();
    e.target.reset();
    document.getElementById('items-container').innerHTML = '';
    addItemRow();
    feedback.textContent = 'Order saved successfully!';
    feedback.className = 'feedback success';
  });
  // Init
  addItemRow();
  updateDashboard();
  renderOrders();
  document.querySelectorAll('input[type=number]').forEach(el => el.addEventListener('input', updateSummary));
