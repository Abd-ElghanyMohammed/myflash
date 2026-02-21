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

