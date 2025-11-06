// Tab switching
// Small helper to safely fetch JSON and surface HTML-as-JSON errors clearly
async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch {}
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${bodyText.slice(0, 140)}`);
    }
    if (!contentType.includes('application/json')) {
        const bodyText = await res.text();
        throw new Error(`Expected JSON but got '${contentType}'. First bytes: ${bodyText.slice(0, 140)}`);
    }
    return res.json();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load data when switching tabs
        if (tabName === 'products') {
            loadProducts();
        } else if (tabName === 'sales') {
            loadWeeklySales();
        } else if (tabName === 'costs') {
            loadAverageCosts();
        } else if (tabName === 'ask') {
            // no-op; user will submit a question
        }
    });
});

// Load all products
async function loadProducts(filters = {}) {
    const productsList = document.getElementById('products-list');
    productsList.innerHTML = '<div class="loading">Loading products...</div>';
    
    try {
        const params = new URLSearchParams(filters);
        const data = await fetchJSON(`/api/products?${params}`);
        
        if (data.success) {
            if (data.products.length === 0) {
                productsList.innerHTML = '<div class="error">No products found.</div>';
                return;
            }
            
            productsList.innerHTML = data.products.map(product => `
                <div class="product-card">
                    <div class="product-header">
                        <div class="product-name">${product.name}</div>
                        <span class="product-badge badge-${product.type}">${product.type}</span>
                    </div>
                    <div class="product-info">
                        <strong>Category:</strong> ${product.category}
                    </div>
                    <div class="product-info">
                        <strong>Cost:</strong> $${product.cost.toFixed(2)}
                    </div>
                    <div class="product-info">
                        <strong>Sales/Day:</strong> ${product.sales_per_day}
                    </div>
                    <div class="product-info">
                        <strong>Weekly Sales:</strong> ${(product.sales_per_day * 7).toFixed(1)}
                    </div>
                    <div class="product-info">
                        <strong>Weekly Revenue:</strong> $${(product.sales_per_day * 7 * product.cost).toFixed(2)}
                    </div>
                    <div class="product-actions">
                        <button class="btn-edit" onclick="openEditModal(${product.id})">Edit</button>
                        <button class="btn-delete" onclick="deleteProduct(${product.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } else {
            productsList.innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
    } catch (error) {
        productsList.innerHTML = `<div class="error">Error loading products: ${error.message}</div>`;
    }
}

// Filter products
function filterProducts() {
    const name = document.getElementById('filter-name').value;
    const type = document.getElementById('filter-type').value;
    
    const filters = {};
    if (name) filters.name = name;
    if (type) filters.type = type;
    
    loadProducts(filters);
}

function clearFilters() {
    document.getElementById('filter-name').value = '';
    document.getElementById('filter-type').value = '';
    loadProducts();
}

// Load weekly sales
async function loadWeeklySales() {
    const salesList = document.getElementById('sales-list');
    const salesSummary = document.getElementById('sales-summary');
    const type = document.getElementById('sales-filter-type').value;
    
    salesList.innerHTML = '<div class="loading">Loading sales data...</div>';
    salesSummary.innerHTML = '';
    
    try {
        const params = type ? `?type=${type}` : '';
        const data = await fetchJSON(`/api/sales/weekly${params}`);
        
        if (data.success) {
            // Summary cards
            salesSummary.innerHTML = `
                <div class="summary-card">
                    <h3>Total Weekly Sales</h3>
                    <div class="value">${data.total_weekly_sales.toFixed(1)}</div>
                </div>
                <div class="summary-card">
                    <h3>Total Weekly Revenue</h3>
                    <div class="value">$${data.total_weekly_revenue.toFixed(2)}</div>
                </div>
            `;
            
            // Sales table
            if (data.products.length === 0) {
                salesList.innerHTML = '<div class="error">No sales data found.</div>';
                return;
            }
            
            salesList.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Type</th>
                            <th>Category</th>
                            <th>Daily Sales</th>
                            <th>Weekly Sales</th>
                            <th>Cost</th>
                            <th>Weekly Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.products.map(product => `
                            <tr>
                                <td>${product.name}</td>
                                <td><span class="product-badge badge-${product.type}">${product.type}</span></td>
                                <td>${product.category}</td>
                                <td>${product.sales_per_day}</td>
                                <td>${product.weekly_sales.toFixed(1)}</td>
                                <td>$${product.cost.toFixed(2)}</td>
                                <td><strong>$${product.weekly_revenue.toFixed(2)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            salesList.innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
    } catch (error) {
        salesList.innerHTML = `<div class="error">Error loading sales: ${error.message}</div>`;
    }
}

// Load average costs
async function loadAverageCosts() {
    const costsList = document.getElementById('costs-list');
    costsList.innerHTML = '<div class="loading">Loading cost analysis...</div>';
    
    try {
        const data = await fetchJSON('/api/costs/average');
        
        if (data.success) {
            if (data.average_costs_by_type.length === 0) {
                costsList.innerHTML = '<div class="error">No cost data found.</div>';
                return;
            }
            
            costsList.innerHTML = data.average_costs_by_type.map(item => `
                <div class="cost-card">
                    <h3>${item.type} Products</h3>
                    <div class="cost-stats">
                        <div class="cost-stat">
                            <label>Product Count</label>
                            <div class="value">${item.product_count}</div>
                        </div>
                        <div class="cost-stat">
                            <label>Average Cost</label>
                            <div class="value">$${item.avg_cost.toFixed(2)}</div>
                        </div>
                        <div class="cost-stat">
                            <label>Min Cost</label>
                            <div class="value">$${item.min_cost.toFixed(2)}</div>
                        </div>
                        <div class="cost-stat">
                            <label>Max Cost</label>
                            <div class="value">$${item.max_cost.toFixed(2)}</div>
                        </div>
                        <div class="cost-stat" style="grid-column: 1 / -1;">
                            <label>Total Daily Sales</label>
                            <div class="value">${item.total_daily_sales.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            costsList.innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
    } catch (error) {
        costsList.innerHTML = `<div class="error">Error loading costs: ${error.message}</div>`;
    }
}

// Add product form
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const product = {
        name: document.getElementById('add-name').value,
        type: document.getElementById('add-type').value,
        category: document.getElementById('add-category').value,
        cost: parseFloat(document.getElementById('add-cost').value),
        sales_per_day: parseFloat(document.getElementById('add-sales').value)
    };
    
    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(product)
        });
        const data = await response.json(); // on POST we still accept JSON, but keep explicit parse
        
        if (data.success) {
            // Show success message
            const form = document.getElementById('add-product-form');
            form.insertAdjacentHTML('beforebegin', `
                <div class="success">Product added successfully!</div>
            `);
            
            // Reset form
            form.reset();
            
            // Reload products list
            loadProducts();
            
            // Switch to products tab
            document.querySelector('[data-tab="products"]').click();
            
            // Remove success message after 3 seconds
            setTimeout(() => {
                const successMsg = document.querySelector('.success');
                if (successMsg) successMsg.remove();
            }, 3000);
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert(`Error adding product: ${error.message}`);
    }
});

// Open edit modal
async function openEditModal(productId) {
    try {
        const data = await fetchJSON(`/api/products`);
        
        if (data.success) {
            const product = data.products.find(p => p.id === productId);
            
            if (product) {
                document.getElementById('edit-id').value = product.id;
                document.getElementById('edit-name').value = product.name;
                document.getElementById('edit-type').value = product.type;
                document.getElementById('edit-category').value = product.category;
                document.getElementById('edit-cost').value = product.cost;
                document.getElementById('edit-sales').value = product.sales_per_day;
                
                document.getElementById('edit-modal').classList.add('active');
            }
        }
    } catch (error) {
        alert(`Error loading product: ${error.message}`);
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') {
        closeEditModal();
    }
});

// Close modal with X button
document.querySelector('.close').addEventListener('click', closeEditModal);

// Update product form
document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productId = document.getElementById('edit-id').value;
    const updates = {};
    
    const name = document.getElementById('edit-name').value;
    const type = document.getElementById('edit-type').value;
    const category = document.getElementById('edit-category').value;
    const cost = document.getElementById('edit-cost').value;
    const sales = document.getElementById('edit-sales').value;
    
    if (name) updates.name = name;
    if (type) updates.type = type;
    if (category) updates.category = category;
    if (cost) updates.cost = parseFloat(cost);
    if (sales) updates.sales_per_day = parseFloat(sales);
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        
        if (data.success) {
            closeEditModal();
            loadProducts();
            
            // Show success message
            const productsTab = document.getElementById('products-tab');
            productsTab.insertAdjacentHTML('afterbegin', `
                <div class="success">Product updated successfully!</div>
            `);
            
            setTimeout(() => {
                const successMsg = productsTab.querySelector('.success');
                if (successMsg) successMsg.remove();
            }, 3000);
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert(`Error updating product: ${error.message}`);
    }
});

// Delete product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            loadProducts();
            
            // Show success message
            const productsTab = document.getElementById('products-tab');
            productsTab.insertAdjacentHTML('afterbegin', `
                <div class="success">Product deleted successfully!</div>
            `);
            
            setTimeout(() => {
                const successMsg = productsTab.querySelector('.success');
                if (successMsg) successMsg.remove();
            }, 3000);
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (error) {
        alert(`Error deleting product: ${error.message}`);
    }
}

// Load initial data
loadProducts();

// Ask (NLQ) handler
async function submitQuestion() {
    const input = document.getElementById('ask-input');
    const results = document.getElementById('ask-results');
    const question = input.value.trim();
    if (!question) return;

    results.innerHTML = '<div class="loading">Thinking...</div>';
    try {
        const data = await fetchJSON('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        if (!data.success) {
            results.innerHTML = `<div class="error">${data.error}</div>`;
            return;
        }

        const periodLabel = data.interpreted.period === 'week' ? 'Weekly' : 'Per Day';
        const scope = data.interpreted.scope;
        const scopeLabel = scope.name ? `Name contains "${scope.name}"` : scope.category ? `Category: ${scope.category}` : scope.type ? `Type: ${scope.type}` : 'All Products';

        const itemsHtml = data.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td><span class="product-badge badge-${item.type}">${item.type}</span></td>
              <td>${item.category}</td>
              <td>$${item.cost.toFixed(2)}</td>
              <td>${item.sales.toFixed(1)}</td>
              <td><strong>$${item.revenue.toFixed(2)}</strong></td>
            </tr>
        `).join('');

        results.innerHTML = `
          <div class="summary-cards">
            <div class="summary-card">
              <h3>${periodLabel} Sales (${scopeLabel})</h3>
              <div class="value">${data.totals.sales.toFixed(1)}</div>
            </div>
            <div class="summary-card">
              <h3>${periodLabel} Revenue</h3>
              <div class="value">$${data.totals.revenue.toFixed(2)}</div>
            </div>
          </div>
          <div class="sales-table">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Cost</th>
                  <th>${periodLabel} Sales</th>
                  <th>${periodLabel} Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
        `;
    } catch (err) {
        results.innerHTML = `<div class="error">${err.message}</div>`;
    }
}

document.getElementById('ask-submit').addEventListener('click', submitQuestion);
document.getElementById('ask-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitQuestion();
    }
});

