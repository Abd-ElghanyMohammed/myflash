// ============================================
// MOBILE SCANNER FUNCTIONS
// ============================================

// Scanner variables
let scannerMode = ''; // 'transfer', 'sale', 'delete'
let scannedProducts = [];
let html5QrcodeScanner = null;
let scannerWarehouse = '';

// Check if device is mobile
function isMobile() {
    return window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Show/hide mobile scanner buttons based on device type
function updateScannerButtonsVisibility() {
    const scannerButtons = document.querySelectorAll('.mobile-scanner-btn');
    scannerButtons.forEach(btn => {
        btn.style.display = isMobile() ? 'block' : 'none';
    });
}

// Open scanner modal
function openScanner(mode) {
    scannerMode = mode;
    scannedProducts = [];
    
    // Get warehouse based on mode
    if (mode === 'transfer') {
        scannerWarehouse = document.getElementById('transfer-from-warehouse').value;
    } else if (mode === 'sale') {
        scannerWarehouse = document.getElementById('sell-warehouse-select').value;
    } else if (mode === 'delete') {
        // For delete, we search all warehouses
        scannerWarehouse = '';
    }
    
    // Update mode text
    const modeText = document.getElementById('scanner-mode-text');
    if (modeText) {
        const modeNames = {
            'transfer': 'Scan products to transfer',
            'sale': 'Scan products to sell',
            'delete': 'Scan products to delete'
        };
        modeText.textContent = modeNames[mode] || 'Scan serial number';
    }
    
    // Clear previous scanned items
    updateScannedItemsDisplay();
    
    // Show modal
    openModal('scanner-modal');
    
    // Start scanner
    setTimeout(() => {
        startScanner();
    }, 300);
}

// Close scanner
function closeScanner() {
    closeModal('scanner-modal');
    stopScanner();
}

// Start QR code scanner
function startScanner() {
    const readerElement = document.getElementById('qr-reader');
    if (!readerElement) return;
    
    // Clear previous content
    readerElement.innerHTML = '';
    
    try {
        // Use Html5Qrcode directly for more control over barcode scanning
        const html5QrCode = new Html5Qrcode("qr-reader");
        
        // Configuration for serial number scanning
        const config = { 
            fps: 10, 
            // Rectangular scan area - wider to capture serial numbers clearly
            qrbox: { width: 300, height: 80 },
            // Use barcode formats that support alphanumeric serials
            formatsToSupport: [
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.ITF
            ]
        };
        
        // Start camera with barcode scanning
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // On successful scan
                console.log('Scanned:', decodedText);
                processScannedSerial(decodedText);
            },
            (errorMessage) => {
                // On error (ignore - this happens frequently when no barcode visible)
            }
        ).catch(err => {
            console.error('Error starting scanner:', err);
            alert('Camera not available. Please use manual search.');
        });
        
        // Store reference for stopping later
        html5QrcodeScanner = html5QrCode;
        
    } catch (error) {
        console.error('Error starting scanner:', error);
        alert('Camera not available. Please use manual search.');
    }
}

// Stop scanner
function stopScanner() {
    if (html5QrcodeScanner) {
        try {
            html5QrcodeScanner.stop().then(() => {
                console.log('Scanner stopped');
            }).catch(err => {
                console.log('Error stopping scanner:', err);
            });
        } catch (e) {
            console.log('Scanner already cleared');
        }
        html5QrcodeScanner = null;
    }
}

// Process scanned serial number
function processScannedSerial(serialNumber) {
    const trimmedSerial = serialNumber.trim().toUpperCase();
    
    // Search for product in the specified warehouse
    let foundProducts = [];
    
    if (scannerMode === 'transfer' || scannerMode === 'sale') {
        // Search in specific warehouse
        foundProducts = products.filter(p => 
            p.serialNumber && 
            p.serialNumber.toUpperCase() === trimmedSerial &&
            p.warehouse === scannerWarehouse
        );
    } else if (scannerMode === 'delete') {
        // Search in all warehouses
        foundProducts = products.filter(p => 
            p.serialNumber && 
            p.serialNumber.toUpperCase() === trimmedSerial
        );
    }
    
    if (foundProducts.length > 0) {
        // Product found
        foundProducts.forEach(product => {
            addScannedProduct(product);
        });
        
        // Show success feedback
        showScanResult(true, 'Found: ' + trimmedSerial);
    } else {
        // Product not found - show closest match
        showClosestMatch(trimmedSerial);
    }
}

// Manual serial search with debounce for auto-search
let manualSearchTimeout = null;

function manualSerialSearch() {
    const input = document.getElementById('manual-serial-input');
    if (!input) return;
    
    const value = input.value.trim();
    
    // Clear previous timeout
    if (manualSearchTimeout) {
        clearTimeout(manualSearchTimeout);
    }
    
    // If input is empty, clear results
    if (!value) {
        const resultsDiv = document.getElementById('qr-reader-results');
        if (resultsDiv) resultsDiv.innerHTML = '';
        return;
    }
    
    // Debounce: wait 300ms after user stops typing before searching
    manualSearchTimeout = setTimeout(() => {
        processScannedSerial(value);
        // Don't clear input - let user see what they searched for
    }, 300);
}

// Add scanned product to list
function addScannedProduct(product) {
    // Check if already scanned
    const existingIndex = scannedProducts.findIndex(p => p.id === product.id);
    if (existingIndex >= 0) {
        alert('Product already scanned!');
        return;
    }
    
    scannedProducts.push(product);
    updateScannedItemsDisplay();
}

// Update scanned items display
function updateScannedItemsDisplay() {
    const container = document.getElementById('scanned-items-container');
    const list = document.getElementById('scanned-items-list');
    const count = document.getElementById('scanned-count');
    const confirmCount = document.getElementById('scanned-confirm-count');
    
    if (!container || !list) return;
    
    if (scannedProducts.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    
    list.innerHTML = scannedProducts.map((product, index) => {
        return '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: ' + (index % 2 === 0 ? '#f9f9f9' : '#fff') + '; border-bottom: 1px solid #eee;">' +
            '<div>' +
                '<strong>' + product.serialNumber + '</strong>' +
                '<br><small style="color: #666;">' + product.name + ' - ' + product.warehouse + '</small>' +
            '</div>' +
            '<button onclick="removeScannedProduct(\'' + product.id + '\')" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✕</button>' +
        '</div>';
    }).join('');
    
    if (count) count.textContent = scannedProducts.length + ' item(s) scanned';
    if (confirmCount) confirmCount.textContent = scannedProducts.length;
}

// Remove scanned product
function removeScannedProduct(productId) {
    scannedProducts = scannedProducts.filter(p => p.id !== productId);
    updateScannedItemsDisplay();
}

// Clear all scanned items
function clearScannedItems() {
    scannedProducts = [];
    updateScannedItemsDisplay();
    
    // Hide closest match
    const closestMatchContainer = document.getElementById('closest-match-container');
    if (closestMatchContainer) {
        closestMatchContainer.style.display = 'none';
    }
}

// Show scan result feedback
function showScanResult(success, message) {
    const resultsDiv = document.getElementById('qr-reader-results');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = '<div style="padding: 10px; border-radius: 8px; ' + (success ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;') + '">' +
        (success ? '✅' : '❌') + ' ' + message +
    '</div>';
    
    // Clear after 3 seconds
    setTimeout(() => {
        resultsDiv.innerHTML = '';
    }, 3000);
}

// Show closest match suggestions
function showClosestMatch(scannedSerial) {
    const container = document.getElementById('closest-match-container');
    const list = document.getElementById('closest-match-list');
    
    if (!container || !list) return;
    
    // Find similar serials
    const similarSerials = findSimilarSerials(scannedSerial);
    
    if (similarSerials.length === 0) {
        container.style.display = 'none';
        showScanResult(false, 'Serial not found');
        return;
    }
    
    list.innerHTML = similarSerials.map(product => {
        return '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #fff; border-radius: 4px; margin-bottom: 5px;">' +
            '<div>' +
                '<strong>' + product.serialNumber + '</strong>' +
                '<br><small style="color: #666;">' + product.name + ' - ' + product.warehouse + '</small>' +
            '</div>' +
            '<button onclick="selectClosestMatch(\'' + product.id + '\')" style="background: #667eea; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Select</button>' +
        '</div>';
    }).join('');
    
    container.style.display = 'block';
    
    showScanResult(false, 'Serial not found. Showing closest matches:');
}

// Find similar serials
function findSimilarSerials(scannedSerial) {
    if (!scannedSerial) return [];
    
    // Filter products based on warehouse
    let searchProducts = products;
    if (scannerWarehouse) {
        searchProducts = products.filter(p => p.warehouse === scannerWarehouse);
    }
    
    // Find similar serials using Levenshtein distance
    return searchProducts
        .map(product => ({
            product: product,
            distance: levenshteinDistance(scannedSerial.toUpperCase(), (product.serialNumber || '').toUpperCase())
        }))
        .filter(item => item.distance <= 5) // Maximum distance threshold
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5) // Take top 5 matches
        .map(item => item.product);
}

// Levenshtein distance calculation
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

// Select closest match
function selectClosestMatch(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        addScannedProduct(product);
        
        // Hide closest match
        const container = document.getElementById('closest-match-container');
        if (container) {
            container.style.display = 'none';
        }
    }
}

// Confirm scanned items
function confirmScannedItems() {
    if (scannedProducts.length === 0) {
        alert('No products scanned');
        return;
    }
    
    if (scannerMode === 'transfer') {
        // For transfer, select products in the checkbox list
        confirmTransferScannedItems();
    } else if (scannerMode === 'sale') {
        // For sale, add to selected serials
        confirmSaleScannedItems();
    } else if (scannerMode === 'delete') {
        // For delete, delete products
        confirmDeleteScannedItems();
    }
    
    closeScanner();
}

// Confirm transfer scanned items
function confirmTransferScannedItems() {
    // Check warehouse matches
    const firstWarehouse = scannedProducts[0].warehouse;
    const allSameWarehouse = scannedProducts.every(p => p.warehouse === firstWarehouse);
    
    if (!allSameWarehouse) {
        alert('All products must be from the same warehouse for transfer');
        return;
    }
    
    // Set the from warehouse
    document.getElementById('transfer-from-warehouse').value = firstWarehouse;
    
    // Populate and select checkboxes
    populateTransferDropdown(firstWarehouse);
    
    setTimeout(() => {
        scannedProducts.forEach(product => {
            const checkbox = document.getElementById('product-' + product.id);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
        updateTransferFromWarehouse();
    }, 500);
    
    alert(scannedProducts.length + ' product(s) selected for transfer');
}

// Confirm sale scanned items
function confirmSaleScannedItems() {
    // Add to selected serial numbers
    scannedProducts.forEach(product => {
        const existingIndex = selectedSerialNumbers.findIndex(s => s.id === product.id);
        if (existingIndex < 0) {
            selectedSerialNumbers.push({
                id: product.id,
                serialNumber: product.serialNumber,
                name: product.name
            });
        }
    });
    
    updateSelectedSerialsDisplay();
    alert(scannedProducts.length + ' product(s) added to sale');
}

// Confirm delete scanned items
function confirmDeleteScannedItems() {
    if (scannedProducts.length === 0) {
        return;
    }
    
    const productNames = [...new Set(scannedProducts.map(p => p.name))];
    const productName = productNames[0];
    
    if (productNames.length > 1) {
        alert('Please scan products of the same name for deletion');
        return;
    }
    
    // Set the product name
    document.getElementById('delete-product-name').value = productName;
    
    // Show count
    document.getElementById('delete-by-name-count').textContent = 
        'Found ' + scannedProducts.length + ' product(s) with this serial';
    
    alert(scannedProducts.length + ' product(s) found for deletion. Click "Delete All" to proceed.');
}

// Initialize scanner visibility on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        updateScannerButtonsVisibility();
    }, 1000);
});

// Also check on resize
window.addEventListener('resize', updateScannerButtonsVisibility);

