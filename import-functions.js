// Import from Excel file - Enhanced version with preview
function importFromExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (!jsonData || jsonData.length === 0) {
                    reject(new Error('No data found in the file'));
                    return;
                }
                
                // Parse the data - try to find the right columns
                const products = [];
                const headerRow = jsonData[0];
                
                // Find column indices
                let serialCol = -1;
                let nameCol = -1;
                let warehouseCol = -1;
                
                // Common column names to search for
                const serialNames = ['serial', 'serialnumber', 'serial number', 'sn', 'رقم المسلسل', 'مسلسل'];
                const nameNames = ['name', 'product', 'productname', 'product name', 'اسم المنتج', 'منتج'];
                const warehouseNames = ['warehouse', 'location', 'store', 'مستودع', 'المستودع'];
                
                headerRow.forEach((header, index) => {
                    if (!header) return;
                    const headerLower = String(header).toLowerCase().trim();
                    
                    if (serialNames.some(n => headerLower.includes(n))) {
                        serialCol = index;
                    } else if (nameNames.some(n => headerLower.includes(n))) {
                        nameCol = index;
                    } else if (warehouseNames.some(n => headerLower.includes(n))) {
                        warehouseCol = index;
                    }
                });
                
                // If columns not found by name, try default positions (A=0, B=1, C=2)
                if (serialCol === -1 && headerRow.length > 0) serialCol = 0;
                if (nameCol === -1 && headerRow.length > 1) nameCol = 1;
                if (warehouseCol === -1 && headerRow.length > 2) warehouseCol = 2;
                
                // Parse data rows
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;
                    
                    let serialNumber = serialCol >= 0 ? row[serialCol] : null;
                    let name = nameCol >= 0 ? row[nameCol] : null;
                    let warehouse = warehouseCol >= 0 ? row[warehouseCol] : null;
                    
                    // Skip empty rows
                    if (!serialNumber && !name) continue;
                    
                    // Convert to string and clean
                    serialNumber = serialNumber ? String(serialNumber).trim() : '';
                    name = name ? String(name).trim() : 'Unknown';
                    warehouse = warehouse ? String(warehouse).trim() : 'فيصل'; // Default warehouse
                    
                    // Map warehouse names to Arabic
                    warehouse = mapWarehouseName(warehouse);
                    
                    if (serialNumber) {
                        products.push({
                            serialNumber: serialNumber,
                            name: name,
                            warehouse: warehouse,
                            quantity: 1,
                            createdAt: new Date().toISOString()
                        });
                    }
                }
                
                resolve(products);
                
            } catch (error) {
                console.error('Error parsing Excel file:', error);
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Map warehouse name to Arabic
function mapWarehouseName(name) {
    if (!name) return 'فيصل';
    
    const nameLower = name.toLowerCase().trim();
    
    // Arabic names
    if (nameLower.includes('فيصل') || nameLower === 'faisal') return 'فيصل';
    if (nameLower.includes('البيني') || nameLower.includes('بني') || nameLower === 'bini' || nameLower === 'beni' || nameLower === 'al-bini') return 'البيني';
    if (nameLower.includes('باب') || nameLower.includes('وق') || nameLower === 'downtown' || nameLower === 'bab' || nameLower === 'bab al-waq') return 'باب الوق';
    
    // Default
    return 'فيصل';
}

// Store parsed products for import
let pendingImportProducts = [];

// Show import preview
async function showImportPreview(file) {
    const previewDiv = document.getElementById('import-preview');
    const previewContent = document.getElementById('preview-content');
    const previewCount = document.getElementById('preview-count');
    
    try {
        pendingImportProducts = await importFromExcel(file);
        
        if (pendingImportProducts.length === 0) {
            previewDiv.style.display = 'block';
            previewContent.innerHTML = '<p style="color: #ff4444; text-align: center;">No valid products found in file</p>';
            previewCount.textContent = '';
            return;
        }
        
        // Show preview
        previewDiv.style.display = 'block';
        
        // Show first 10 products
        let html = '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
        html += '<tr style="background: var(--bg-elevated);"><th style="padding: 8px; text-align: left;">#</th><th style="padding: 8px; text-align: left;">Serial</th><th style="padding: 8px; text-align: left;">Name</th><th style="padding: 8px; text-align: left;">Warehouse</th></tr>';
        
        pendingImportProducts.slice(0, 10).forEach((product, index) => {
            html += `<tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 6px 8px;">${index + 1}</td>
                <td style="padding: 6px 8px;">${product.serialNumber}</td>
                <td style="padding: 6px 8px;">${product.name}</td>
                <td style="padding: 6px 8px;">${product.warehouse}</td>
            </tr>`;
        });
        
        html += '</table>';
        
        if (pendingImportProducts.length > 10) {
            html += `<p style="margin-top: 10px; color: #888;">... and ${pendingImportProducts.length - 10} more products</p>`;
        }
        
        previewContent.innerHTML = html;
        previewCount.textContent = `Total: ${pendingImportProducts.length} products ready to import`;
        
    } catch (error) {
        console.error('Error showing preview:', error);
        previewDiv.style.display = 'block';
        previewContent.innerHTML = `<p style="color: #ff4444; text-align: center;">Error reading file: ${error.message}</p>`;
        previewCount.textContent = '';
        pendingImportProducts = [];
    }
}

// Handle import products
async function handleImportProducts() {
    if (pendingImportProducts.length === 0) {
        alert('Please select a valid Excel file first');
        return;
    }
    
    const importMode = document.querySelector('input[name="import-mode"]:checked').value;
    const userId = auth.currentUser.uid;
    
    if (!userId) {
        alert('Please login first');
        return;
    }
    
    // Confirm replace mode
    if (importMode === 'replace') {
        if (!confirm(`Warning: This will DELETE all existing products (${products.length}) and replace them with ${pendingImportProducts.length} imported products. This action cannot be undone!\n\nAre you sure you want to continue?`)) {
            return;
        }
    }
    
    try {
        const productsRef = database.ref('products/' + userId);
        
        if (importMode === 'replace') {
            // Replace mode: Delete all first, then import
            await productsRef.remove();
            
            // Add imported products
            const updates = {};
            pendingImportProducts.forEach(product => {
                const newKey = productsRef.push().key;
                updates[newKey] = product;
            });
            
            await productsRef.update(updates);
            
            alert(`Successfully replaced all products!\n\nImported ${pendingImportProducts.length} products.`);
            
        } else {
            // Merge mode: Add to existing
            const updates = {};
            let addedCount = 0;
            let duplicateCount = 0;
            
            // Check for duplicates
            const existingSerials = new Set(products.map(p => p.serialNumber));
            
            pendingImportProducts.forEach(product => {
                if (!existingSerials.has(product.serialNumber)) {
                    const newKey = productsRef.push().key;
                    updates[newKey] = product;
                    addedCount++;
                } else {
                    duplicateCount++;
                }
            });
            
            if (Object.keys(updates).length > 0) {
                await productsRef.update(updates);
            }
            
            let message = `Import completed!\n\nAdded: ${addedCount} products`;
            if (duplicateCount > 0) {
                message += `\nSkipped (duplicates): ${duplicateCount} products`;
            }
            
            alert(message);
        }
        
        // Close modal and reset
        closeModal('import-products-modal');
        document.getElementById('import-file').value = '';
        document.getElementById('import-preview').style.display = 'none';
        pendingImportProducts = [];
        
        // Reload products
        loadProducts();
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
        
    } catch (error) {
        console.error('Error importing products:', error);
        alert('Error importing products: ' + error.message);
    }
}

// ==================== JSON DATA RECOVERY ====================

// JSON file input element (will be created dynamically)
let jsonFileInput = null;

// Create JSON recovery button and hidden input
function createJsonRecoveryElements() {
    // Create hidden file input for JSON
    jsonFileInput = document.createElement('input');
    jsonFileInput.type = 'file';
    jsonFileInput.id = 'json-recovery-file';
    jsonFileInput.accept = '.json';
    jsonFileInput.style.display = 'none';
    
    // Add change event listener
    jsonFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await handleJsonRecovery(file);
            // Reset input
            jsonFileInput.value = '';
        }
    });
    
    document.body.appendChild(jsonFileInput);
}

// Initialize JSON recovery elements on load
document.addEventListener('DOMContentLoaded', () => {
    createJsonRecoveryElements();
});

// Open JSON file picker
function openJsonRecovery() {
    if (!jsonFileInput) {
        createJsonRecoveryElements();
    }
    jsonFileInput.click();
}

// Handle JSON data recovery
async function handleJsonRecovery(file) {
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
        alert('Please login first');
        return;
    }
    
    try {
        // Read the JSON file
        const fileContent = await readJsonFile(file);
        
        // Validate JSON structure
        if (!validateJsonBackup(fileContent)) {
            alert('Invalid JSON file format. Please select a valid backup file.');
            return;
        }
        
        // Show recovery options modal
        showJsonRecoveryModal(fileContent);
        
    } catch (error) {
        console.error('Error reading JSON file:', error);
        alert('Error reading JSON file: ' + error.message);
    }
}

// Read JSON file content
function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                resolve(data);
            } catch (error) {
                reject(new Error('Invalid JSON format'));
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        reader.readAsText(file);
    });
}

// Validate JSON backup structure
function validateJsonBackup(data) {
    // Check if it's a valid backup object with data arrays
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    
    // Check for expected data arrays
    const validKeys = ['products', 'transfers', 'sales', 'deletions', 'modifications', 'customers'];
    const hasValidKey = validKeys.some(key => Array.isArray(data[key]) && data[key].length > 0);
    
    // Also accept old format with 'productManagementData' wrapper
    if (data.productManagementData && typeof data.productManagementData === 'object') {
        return true;
    }
    
    return hasValidKey;
}

// Show JSON recovery modal with options
function showJsonRecoveryModal(data) {
    // Check what data is available
    let productsCount = 0;
    let transfersCount = 0;
    let salesCount = 0;
    let deletionsCount = 0;
    let modificationsCount = 0;
    let customersCount = 0;
    
    // Handle both direct format and wrapped format
    const dataToUse = data.productManagementData || data;
    
    if (Array.isArray(dataToUse.products)) productsCount = dataToUse.products.length;
    if (Array.isArray(dataToUse.transfers)) transfersCount = dataToUse.transfers.length;
    if (Array.isArray(dataToUse.sales)) salesCount = dataToUse.sales.length;
    if (Array.isArray(dataToUse.deletions)) deletionsCount = dataToUse.deletions.length;
    if (Array.isArray(dataToUse.modifications)) modificationsCount = dataToUse.modifications.length;
    if (Array.isArray(dataToUse.customers)) customersCount = dataToUse.customers.length;
    // Also check customers as object
    if (dataToUse.customers && typeof dataToUse.customers === 'object' && !Array.isArray(dataToUse.customers)) {
        customersCount = Object.keys(dataToUse.customers).length;
    }
    
    // Create modal HTML
    const modalHtml = `
        <div id="json-recovery-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 550px;">
                <span class="close" onclick="closeJsonRecoveryModal()">&times;</span>
                <h2>Data Recovery from JSON</h2>
                <p style="color: #888; margin-bottom: 20px; font-size: 14px;">
                    The following data was found in the backup file:
                </p>
                
                <div style="background: var(--bg-surface); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <table style="width: 100%; font-size: 14px;">
                        <tr>
                            <td style="padding: 8px 0;">Products</td>
                            <td style="text-align: right; font-weight: bold; color: var(--primary);">${productsCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Transfers</td>
                            <td style="text-align: right; font-weight: bold;">${transfersCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Sales</td>
                            <td style="text-align: right; font-weight: bold;">${salesCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Deletions</td>
                            <td style="text-align: right; font-weight: bold;">${deletionsCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Modifications</td>
                            <td style="text-align: right; font-weight: bold;">${modificationsCount}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0;">Customers</td>
                            <td style="text-align: right; font-weight: bold;">${customersCount}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Recovery Mode</label>
                    <div style="display: flex; gap: 15px; margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border); flex: 1;">
                            <input type="radio" name="json-recovery-mode" value="merge" checked>
                            <span>
                                <strong>Merge</strong>
                                <br><small style="color: #888;">Add to existing data</small>
                            </span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 12px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border); flex: 1;">
                            <input type="radio" name="json-recovery-mode" value="replace">
                            <span>
                                <strong>Replace All</strong>
                                <br><small style="color: #888;">Delete and import new</small>
                            </span>
                        </label>
                    </div>
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button type="button" class="btn btn-primary" style="flex: 1;" onclick="processJsonRecovery('${encodeURIComponent(JSON.stringify(data))}')">
                        Recover Data
                    </button>
                    <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="closeJsonRecoveryModal()">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('json-recovery-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Close JSON recovery modal
function closeJsonRecoveryModal() {
    const modal = document.getElementById('json-recovery-modal');
    if (modal) {
        modal.remove();
    }
}

// Process JSON data recovery
async function processJsonRecovery(encodedData) {
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
        alert('Please login first');
        return;
    }
    
    const data = JSON.parse(decodeURIComponent(encodedData));
    const recoveryMode = document.querySelector('input[name="json-recovery-mode"]:checked').value;
    
    // Handle both direct format and wrapped format
    const dataToUse = data.productManagementData || data;
    
    try {
        // Confirm replace mode
        if (recoveryMode === 'replace') {
            if (!confirm('Warning: This will DELETE all existing data and replace it with the backup. This action cannot be undone!')) {
                return;
            }
        }
        
        // Show loading message
        alert('Starting data recovery... Please wait.');
        
        // Recovery results
        let results = {
            products: 0,
            transfers: 0,
            sales: 0,
            deletions: 0,
            modifications: 0,
            customers: 0
        };
        
        // 1. Recover Products
        if (Array.isArray(dataToUse.products) && dataToUse.products.length > 0) {
            const productsRef = database.ref('products/' + userId);
            
            if (recoveryMode === 'replace') {
                await productsRef.remove();
            }
            
            const updates = {};
            const existingSerials = recoveryMode === 'merge' ? new Set(products.map(p => p.serialNumber)) : new Set();
            
            dataToUse.products.forEach(product => {
                if (recoveryMode === 'merge' && existingSerials.has(product.serialNumber)) {
                    return; // Skip duplicates in merge mode
                }
                const newKey = productsRef.push().key;
                updates[newKey] = {
                    serialNumber: product.serialNumber,
                    name: product.name,
                    warehouse: product.warehouse,
                    quantity: product.quantity || 1,
                    createdAt: product.createdAt || new Date().toISOString()
                };
                results.products++;
            });
            
            if (Object.keys(updates).length > 0) {
                await productsRef.update(updates);
            }
        }
        
        // 2. Recover Transfers
        if (Array.isArray(dataToUse.transfers) && dataToUse.transfers.length > 0) {
            const transfersRef = database.ref('transfers/' + userId);
            
            if (recoveryMode === 'replace') {
                await transfersRef.remove();
            }
            
            const updates = {};
            dataToUse.transfers.forEach(transfer => {
                const newKey = transfersRef.push().key;
                updates[newKey] = transfer;
                results.transfers++;
            });
            
            if (Object.keys(updates).length > 0) {
                await transfersRef.update(updates);
            }
        }
        
        // 3. Recover Sales
        if (Array.isArray(dataToUse.sales) && dataToUse.sales.length > 0) {
            const salesRef = database.ref('sales/' + userId);
            
            if (recoveryMode === 'replace') {
                await salesRef.remove();
            }
            
            const updates = {};
            dataToUse.sales.forEach(sale => {
                const newKey = salesRef.push().key;
                updates[newKey] = sale;
                results.sales++;
            });
            
            if (Object.keys(updates).length > 0) {
                await salesRef.update(updates);
            }
        }
        
        // 4. Recover Deletions
        if (Array.isArray(dataToUse.deletions) && dataToUse.deletions.length > 0) {
            const deletionsRef = database.ref('deletions/' + userId);
            
            if (recoveryMode === 'replace') {
                await deletionsRef.remove();
            }
            
            const updates = {};
            dataToUse.deletions.forEach(deletion => {
                const newKey = deletionsRef.push().key;
                updates[newKey] = deletion;
                results.deletions++;
            });
            
            if (Object.keys(updates).length > 0) {
                await deletionsRef.update(updates);
            }
        }
        
        // 5. Recover Modifications
        if (Array.isArray(dataToUse.modifications) && dataToUse.modifications.length > 0) {
            const modificationsRef = database.ref('modifications/' + userId);
            
            if (recoveryMode === 'replace') {
                await modificationsRef.remove();
            }
            
            const updates = {};
            dataToUse.modifications.forEach(modification => {
                const newKey = modificationsRef.push().key;
                updates[newKey] = modification;
                results.modifications++;
            });
            
            if (Object.keys(updates).length > 0) {
                await modificationsRef.update(updates);
            }
        }
        
        // 6. Recover Customers
        if (dataToUse.customers) {
            const customersRef = database.ref('customers/' + userId);
            
            if (recoveryMode === 'replace') {
                await customersRef.remove();
            }
            
            if (Array.isArray(dataToUse.customers)) {
                // Array format
                const updates = {};
                dataToUse.customers.forEach(customer => {
                    const normalizedName = customer.name ? customer.name.trim().toLowerCase() : 'unknown';
                    if (normalizedName && normalizedName !== 'unknown') {
                        updates[normalizedName] = customer;
                        results.customers++;
                    }
                });
                
                if (Object.keys(updates).length > 0) {
                    await customersRef.update(updates);
                }
            } else if (typeof dataToUse.customers === 'object') {
                // Object format (keyed by name)
                const updates = {};
                Object.keys(dataToUse.customers).forEach(key => {
                    updates[key] = dataToUse.customers[key];
                    results.customers++;
                });
                
                if (Object.keys(updates).length > 0) {
                    await customersRef.update(updates);
                }
            }
        }
        
        // Close modal
        closeJsonRecoveryModal();
        
        // Show success message with results
        let resultMessage = 'Data Recovery Completed!\n\n';
        resultMessage += 'Products: ' + results.products + '\n';
        resultMessage += 'Transfers: ' + results.transfers + '\n';
        resultMessage += 'Sales: ' + results.sales + '\n';
        resultMessage += 'Deletions: ' + results.deletions + '\n';
        resultMessage += 'Modifications: ' + results.modifications + '\n';
        resultMessage += 'Customers: ' + results.customers;
        
        alert(resultMessage);
        
        // Reload data
        loadProducts();
        autoSaveToLocalStorage();
        
    } catch (error) {
        console.error('Error during data recovery:', error);
        alert('Error during data recovery: ' + error.message);
    }
}

// Export data to JSON file
function exportDataToJson() {
    const userId = auth.currentUser?.uid;
    
    if (!userId) {
        alert('Please login first');
        return;
    }
    
    // Show loading
    alert('Preparing JSON backup... Please wait.');
    
    // Get all data from local storage or create current snapshot
    const data = {
        products: products,
        transfers: transfers,
        sales: sales,
        deletions: deletions,
        modifications: modifications,
        customers: customers,
        lastSaved: new Date().toISOString(),
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    
    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(data, null, 2);
    
    // Create and download file
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'backup_' + timestamp + '.json');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    let custCount = Array.isArray(customers) ? customers.length : Object.keys(customers || {}).length;
    alert('Backup exported successfully!\n\nFile: backup_' + timestamp + '.json');
}

