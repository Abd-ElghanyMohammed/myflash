// Global variables
let currentUser = null;
let products = [];
let availableSerialNumbers = [];
let selectedSerialNumbers = [];
let currentSellWarehouse = null;
let transfers = [];
let sales = [];
let deletions = [];
let modifications = [];
let customers = []; // Changed from {} to [] to avoid forEach error

// Connection state management to prevent reconnection loops
let isConnectionAttemptInProgress = false;
let connectionRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 5;
let connectionRetryTimeout = null;

// WhatsApp Settings
let whatsappSettings = {
    token: '',
    phoneId: '',
    groupId: '',
    enableTransfers: true,
    enableSales: true
};

// Load WhatsApp settings from local storage
function loadWhatsAppSettings() {
    try {
        const saved = localStorage.getItem('whatsappSettings');
        if (saved) {
            whatsappSettings = JSON.parse(saved);
            // Populate form fields if they exist
            document.getElementById('whatsapp-token').value = whatsappSettings.token || '';
            document.getElementById('whatsapp-phone-id').value = whatsappSettings.phoneId || '';
            document.getElementById('whatsapp-group-id').value = whatsappSettings.groupId || '';
            document.getElementById('whatsapp-enable-transfers').checked = whatsappSettings.enableTransfers !== false;
            document.getElementById('whatsapp-enable-sales').checked = whatsappSettings.enableSales !== false;
        }
    } catch (error) {
        console.error('Error loading WhatsApp settings:', error);
    }
}

// Save WhatsApp settings
function saveWhatsAppSettings() {
    try {
        whatsappSettings.token = document.getElementById('whatsapp-token').value;
        whatsappSettings.phoneId = document.getElementById('whatsapp-phone-id').value;
        whatsappSettings.groupId = document.getElementById('whatsapp-group-id').value;
        whatsappSettings.enableTransfers = document.getElementById('whatsapp-enable-transfers').checked;
        whatsappSettings.enableSales = document.getElementById('whatsapp-enable-sales').checked;
        
        localStorage.setItem('whatsappSettings', JSON.stringify(whatsappSettings));
        alert('WhatsApp settings saved successfully!');
    } catch (error) {
        console.error('Error saving WhatsApp settings:', error);
        alert('Error saving settings');
    }
}

// Send WhatsApp notification
async function sendWhatsAppNotification(message, recipientPhone = null) {
    if (!whatsappSettings.token || !whatsappSettings.phoneId) {
        console.log('WhatsApp not configured, skipping notification');
        return false;
    }
    
    const recipient = recipientPhone || whatsappSettings.groupId || whatsappSettings.phoneId;
    
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${whatsappSettings.phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whatsappSettings.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: recipient,
                type: "text",
                text: { body: message }
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('WhatsApp notification sent successfully');
            return true;
        } else {
            console.error('WhatsApp notification failed:', result);
            return false;
        }
    } catch (error) {
        console.error('Error sending WhatsApp notification:', error);
        return false;
    }
}

// Test WhatsApp notification
function testWhatsAppNotification() {
    const testMessage = '🧪 *Test Notification*\n\nThis is a test message from your Product Management System.\n\n✅ If you receive this, WhatsApp integration is working correctly!';
    
    sendWhatsAppNotification(testMessage).then(success => {
        if (success) {
            alert('✅ Test notification sent! Check your WhatsApp.');
        } else {
            alert('❌ Failed to send notification. Please check your WhatsApp settings.');
        }
    });
}

// Send transfer notification to WhatsApp
async function sendTransferWhatsAppNotification(transfer) {
    if (!whatsappSettings.enableTransfers || !whatsappSettings.token) {
        return;
    }
    
    const date = new Date(transfer.transferredAt).toLocaleDateString('ar-SA');
    const time = new Date(transfer.transferredAt).toLocaleTimeString('ar-SA');
    
    let message = '🔄 *تقرير تحويل جديد / New Transfer*\n\n';
    message += `📅 التاريخ: ${date}\n`;
    message += `⏰ الوقت: ${time}\n`;
    message += `📦 عدد المنتجات: ${transfer.itemCount}\n`;
    message += `🏭 من مستودع: ${getArabicWarehouseName(transfer.fromWarehouse)}\n`;
    message += `➡️ إلى مستودع: ${getArabicWarehouseName(transfer.toWarehouse)}\n\n`;
    message += `🔢 أرقام المسلسلات:\n`;
    
    if (transfer.items && transfer.items.length > 0) {
        // Show first 10 serials
        const serialsToShow = transfer.items.slice(0, 10).map(i => i.serialNumber).join('\n');
        message += serialsToShow;
        
        if (transfer.items.length > 10) {
            message += `\n... و ${transfer.items.length - 10} أخرى`;
        }
    }
    
    await sendWhatsAppNotification(message);
}

// Send sale notification to WhatsApp
async function sendSaleWhatsAppNotification(sale) {
    if (!whatsappSettings.enableSales || !whatsappSettings.token) {
        return;
    }
    
    const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
    
    let message = '💰 *تقرير بيع جديد / New Sale*\n\n';
    message += `👤 العميل: ${sale.customerName}\n`;
    message += `📅 التاريخ: ${date}\n`;
    message += `📦 عدد المنتجات: ${sale.itemCount}\n`;
    message += `🏭 المستودع: ${getArabicWarehouseName(sale.warehouse)}\n`;
    
    if (sale.price) {
        message += `💵 السعر: ${sale.price}\n`;
    }
    
    if (sale.description) {
        message += `📝 الوصف: ${sale.description}\n`;
    }
    
    message += `\n🔢 أرقام المسلسلات:\n`;
    
    if (sale.items && sale.items.length > 0) {
        // Show first 10 serials
        const serialsToShow = sale.items.slice(0, 10).map(i => i.serialNumber).join('\n');
        message += serialsToShow;
        
        if (sale.items.length > 10) {
            message += `\n... و ${sale.items.length - 10} أخرى`;
        }
    }
    
    await sendWhatsAppNotification(message);
}

// Internet Connection Status
let wasOnline = true;

// Check internet connection status
function checkInternetConnection() {
    const isOnline = navigator.onLine;
    
    if (!isOnline && wasOnline) {
        // Internet disconnected - show warning and download
        showOfflineWarning();
        downloadDataOnDisconnect();
    } else if (isOnline && !wasOnline) {
        // Internet reconnected - hide warning
        hideOfflineWarning();
    }
    
    wasOnline = isOnline;
}

// Show offline warning overlay
function showOfflineWarning() {
    const warning = document.getElementById('offline-warning');
    if (warning) {
        warning.style.display = 'flex';
    }
}

// Hide offline warning overlay
function hideOfflineWarning() {
    const warning = document.getElementById('offline-warning');
    if (warning) {
        warning.style.display = 'none';
    }
}

// Download data when internet disconnects
function downloadDataOnDisconnect() {
    const statusEl = document.getElementById('offline-status');
    if (statusEl) {
        statusEl.textContent = 'Saving your data...';
    }
    
    // Save current data to local storage
    setTimeout(() => {
        try {
            const data = {
                products: products,
                transfers: transfers,
                sales: sales,
                deletions: deletions,
                modifications: modifications,
                customers: customers,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem('offlineBackup', JSON.stringify(data));
            
            if (statusEl) {
                statusEl.textContent = 'Data saved successfully!';
            }
            
            // Trigger download as Excel file
            setTimeout(() => {
                exportDataToExcel(products, transfers, sales, deletions, modifications, customers);
                
                if (statusEl) {
                    statusEl.textContent = 'Download complete!';
                }
            }, 1000);
            
        } catch (error) {
            console.error('Error saving offline data:', error);
            if (statusEl) {
                statusEl.textContent = 'Error saving data: ' + error.message;
            }
        }
    }, 500);
}

// Initialize internet connection monitoring
function initInternetMonitoring() {
    // Check connection status
    checkInternetConnection();
    
    // Listen for online/offline events
    window.addEventListener('online', checkInternetConnection);
    window.addEventListener('offline', checkInternetConnection);
    
    // Check periodically
    setInterval(checkInternetConnection, 5000);
}

// Auto-save to local storage
function autoSaveToLocalStorage() {
    try {
        const data = {
            products: products,
            transfers: transfers,
            sales: sales,
            deletions: deletions,
            modifications: modifications,
            customers: customers,
            lastSaved: new Date().toISOString()
        };
        localStorage.setItem('productManagementData', JSON.stringify(data));
        console.log('Data auto-saved to local storage');
    } catch (error) {
        console.error('Error auto-saving to local storage:', error);
    }
}

// Load data from local storage
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('productManagementData');
        if (savedData) {
            const data = JSON.parse(savedData);
            products = data.products || [];
            transfers = data.transfers || [];
            sales = data.sales || [];
            deletions = data.deletions || [];
            modifications = data.modifications || [];
            // Convert customers object to array if needed
            const customersData = data.customers;
            if (customersData) {
                if (Array.isArray(customersData)) {
                    customers = customersData;
                } else if (typeof customersData === 'object') {
                    // Convert object to array
                    customers = Object.values(customersData);
                } else {
                    customers = [];
                }
            } else {
                customers = [];
            }
            console.log('Data loaded from local storage');
            return true;
        }
    } catch (error) {
        console.error('Error loading from local storage:', error);
    }
    return false;
}

// DOM Elements - initialized inside DOMContentLoaded
let loginSection, dashboardSection, loginForm, registerForm, productsTableBody, noProductsMessage;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements after DOM is ready
    loginSection = document.getElementById('login-section');
    dashboardSection = document.getElementById('dashboard-section');
    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    productsTableBody = document.getElementById('products-tbody');
    noProductsMessage = document.getElementById('no-products-message');
    
    // Initialize internet connection monitoring
    initInternetMonitoring();
    
    initAuth();
    initEventListeners();
    checkAuthState();
});

// Check authentication state
function checkAuthState() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            showDashboard();
            loadProducts();
        } else {
            showLogin();
        }
    });
}

// Initialize authentication
function initAuth() {
    // Login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorElement = document.getElementById('login-error');

            try {
                errorElement.textContent = '';
                await auth.signInWithEmailAndPassword(email, password);
                loginForm.reset();
            } catch (error) {
                errorElement.textContent = getErrorMessage(error.code);
            }
        });
    }

    // Register form submission - only if registerForm exists
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            const errorElement = document.getElementById('register-error');

            if (password !== confirmPassword) {
                errorElement.textContent = 'Passwords do not match!';
                return;
            }

            if (password.length < 6) {
                errorElement.textContent = 'Password must be at least 6 characters!';
                return;
            }

            try {
                errorElement.textContent = '';
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                
                // Save user to database
                await database.ref('users/' + userCredential.user.uid).set({
                    email: email,
                    createdAt: new Date().toISOString()
                });
                
                registerForm.reset();
                const registerBox = document.getElementById('register-box');
                if (registerBox) registerBox.style.display = 'none';
                const loginBox = document.getElementById('login-section')?.querySelector('.login-box');
                if (loginBox) loginBox.style.display = 'block';
            } catch (error) {
                errorElement.textContent = getErrorMessage(error.code);
            }
        });
    }

    // Logout button - check if element exists
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                products = [];
                showLogin();
            } catch (error) {
                console.error('Logout error:', error);
            }
        });
    }
}

// Initialize event listeners
function initEventListeners() {
    // Toggle between login and register - only if elements exist
    const showRegister = document.getElementById('show-register');
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            const loginSectionEl = document.getElementById('login-section');
            const loginBox = loginSectionEl?.querySelector('.login-box');
            const registerBox = document.getElementById('register-box');
            if (loginBox) loginBox.style.display = 'none';
            if (registerBox) registerBox.style.display = 'block';
        });
    }

    const showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            const registerBox = document.getElementById('register-box');
            const loginSectionEl = document.getElementById('login-section');
            const loginBox = loginSectionEl?.querySelector('.login-box');
            if (registerBox) registerBox.style.display = 'none';
            if (loginBox) loginBox.style.display = 'block';
        });
    }

    // Add Product button
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            openModal('add-product-modal');
        });
    }

    // Sell Product button
    const sellProductBtn = document.getElementById('sell-product-btn');
    if (sellProductBtn) {
        sellProductBtn.addEventListener('click', () => {
            sellProduct();
        });
    }

    // Delete All Products button
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            if (products.length === 0) {
                alert('No products to delete');
                return;
            }
            if (confirm(`Are you sure you want to delete all ${products.length} products? This action cannot be undone.`)) {
                deleteAllProducts();
            }
        });
    }

    // Delete by Name button
    const deleteByNameBtn = document.getElementById('delete-by-name-btn');
    if (deleteByNameBtn) {
        deleteByNameBtn.addEventListener('click', () => {
            openDeleteByNameModal();
        });
    }

    // Print Total Inventory button
    const printTotalBtn = document.getElementById('print-total-btn');
    if (printTotalBtn) {
        printTotalBtn.addEventListener('click', () => {
            printTotalInventory();
        });
    }

    // Print البيني (Bini) Inventory button
    const printBiniBtn = document.getElementById('print-bini-btn');
    if (printBiniBtn) {
        printBiniBtn.addEventListener('click', () => {
            printWarehouseInventory('البيني', 'Al-Bini');
        });
    }

    // Print فيصل (Faisal) Inventory button
    const printFaisalBtn = document.getElementById('print-faisal-btn');
    if (printFaisalBtn) {
        printFaisalBtn.addEventListener('click', () => {
            printWarehouseInventory('فيصل', 'Faisal');
        });
    }

    // Print باب الوق (Downtown) Inventory button
    const printDowntownBtn = document.getElementById('print-downtown-btn');
    if (printDowntownBtn) {
        printDowntownBtn.addEventListener('click', () => {
            printWarehouseInventory('باب الوق', 'Bab Al-Waq');
        });
    }

    // Activities button
    const activitiesBtn = document.getElementById('activities-btn');
    if (activitiesBtn) {
        activitiesBtn.addEventListener('click', () => {
            openActivitiesModal();
        });
    }

    // Print Products button
    const printProductsBtn = document.getElementById('print-products-btn');
    if (printProductsBtn) {
        printProductsBtn.addEventListener('click', () => {
            printProducts();
        });
    }

    // WhatsApp Settings button
    const whatsappSettingsBtn = document.getElementById('whatsapp-settings-btn');
    if (whatsappSettingsBtn) {
        whatsappSettingsBtn.addEventListener('click', () => {
            loadWhatsAppSettings();
            openModal('whatsapp-settings-modal');
        });
    }

    // WhatsApp Settings form submission
    const whatsappSettingsForm = document.getElementById('whatsapp-settings-form');
    if (whatsappSettingsForm) {
        whatsappSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveWhatsAppSettings();
        });
    }

    // Load WhatsApp settings on startup
    loadWhatsAppSettings();

    // Close Activities modal
    const closeActivitiesBtn = document.getElementById('close-activities-btn');
    if (closeActivitiesBtn) {
        closeActivitiesBtn.addEventListener('click', () => {
            closeModal('activities-modal');
        });
    }

    // Tab switching in Activities
    const tabTransfers = document.getElementById('tab-transfers');
    if (tabTransfers) {
        tabTransfers.addEventListener('click', () => {
            switchActivityTab('transfers');
        });
    }

    const tabSales = document.getElementById('tab-sales');
    if (tabSales) {
        tabSales.addEventListener('click', () => {
            switchActivityTab('sales');
        });
    }

    const tabDeletions = document.getElementById('tab-deletions');
    if (tabDeletions) {
        tabDeletions.addEventListener('click', () => {
            switchActivityTab('deletions');
        });
    }

    const tabModifications = document.getElementById('tab-modifications');
    if (tabModifications) {
        tabModifications.addEventListener('click', () => {
            switchActivityTab('modifications');
        });
    }

    // Add Product form submission
    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addProduct();
        });
    }

    // Edit Product form submission
    const editProductForm = document.getElementById('edit-product-form');
    if (editProductForm) {
        editProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateProduct();
        });
    }

    // Transfer Product form submission
    const transferProductForm = document.getElementById('transfer-product-form');
    if (transferProductForm) {
        transferProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await transferProduct();
        });
    }

    // Sell Product form submission
    const sellProductForm = document.getElementById('sell-product-form');
    if (sellProductForm) {
        sellProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await confirmSale();
        });
    }

    // Delete confirmation
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            const productId = document.getElementById('delete-product-id').value;
            await deleteProduct(productId);
            closeModal('delete-modal');
        });
    }

    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            closeModal('delete-modal');
        });
    }

    // Close modal buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            closeModal(modal.id);
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

// Load products from database
function loadProducts() {
    if (!auth.currentUser) {
        console.error('No user logged in');
        alert('No user logged in! Please login first.');
        return;
    }
    
    const userId = auth.currentUser.uid;
    console.log('Loading products for user:', userId);
    console.log('User email:', auth.currentUser.email);
    
    // Show loading status to user
    const productsTableBody = document.getElementById('products-tbody');
    if (productsTableBody) {
        productsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading products...</td></tr>';
    }
    
    database.ref('products/' + userId).on('value', (snapshot) => {
        console.log('Firebase snapshot exists:', snapshot.exists());
        console.log('Products snapshot:', snapshot.val());
        console.log('Number of children:', snapshot.numChildren());
        
        products = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const product = childSnapshot.val();
                product.id = childSnapshot.key;
                products.push(product);
            });
        }
        console.log('Total products loaded:', products.length);
        console.log('Products array:', products);
        
        // Show alert with debug info
        if (products.length === 0) {
            alert(`Debug Info:\n- User ID: ${userId}\n- Email: ${auth.currentUser.email}\n- Products found: 0\n\nNo products found for this user. Check if data exists in Firebase Console under this user's path.`);
        } else {
            alert(`Debug Info:\n- User ID: ${userId}\n- Email: ${auth.currentUser.email}\n- Products found: ${products.length}`);
        }
        
        renderProducts();
        // Run migration for old format products
        migrateOldFormatProducts();
    }, (error) => {
        console.error('Error loading products:', error);
        alert('Error loading products: ' + error.message);
    });
}

// Migrate old format products (range format) to new individual format
async function migrateOldFormatProducts() {
    const userId = auth.currentUser.uid;
    const productsToMigrate = products.filter(p => 
        p.name === '12/100' && 
        p.serialNumber && 
        p.serialNumber.includes(' to ')
    );
    
    if (productsToMigrate.length === 0) return;
    
    console.log(`Migrating ${productsToMigrate.length} products from old format...`);
    
    for (const oldProduct of productsToMigrate) {
        try {
            // Parse the old format: "PCD0401TR25100001 to PCD0401TR25100015"
            const parts = oldProduct.serialNumber.split(' to ');
            if (parts.length !== 2) continue;
            
            // Extract serial numbers
            const firstSerial = parts[0];
            const lastSerial = parts[1];
            
            // Extract the numeric part (e.g., 100001, 100015)
            const firstNum = parseInt(firstSerial.slice(-5), 10);
            const lastNum = parseInt(lastSerial.slice(-5), 10);
            
            if (isNaN(firstNum) || isNaN(lastNum)) continue;
            
            // Get the prefix (e.g., PCD0401TR2510)
            const prefix = firstSerial.slice(0, -5);
            
            // Delete old product
            await database.ref('products/' + userId + '/' + oldProduct.id).remove();
            
            // Create new individual products
            const productsRef = database.ref('products/' + userId);
            
            for (let i = firstNum; i <= lastNum; i++) {
                const newSerial = prefix + i.toString();
                await productsRef.push().set({
                    serialNumber: newSerial,
                    name: oldProduct.name,
                    warehouse: oldProduct.warehouse,
                    fromSerial: i - 100000,
                    toSerial: i - 100000,
                    quantity: 1,
                    createdAt: oldProduct.createdAt,
                    migratedAt: new Date().toISOString()
                });
            }
            
            console.log(`Migrated product ${oldProduct.id} to ${lastNum - firstNum + 1} individual products`);
        } catch (error) {
            console.error('Error migrating product:', error);
        }
    }
}

// Render products in table - grouped by product name and warehouse
function renderProducts() {
    if (!productsTableBody) return;
    
    productsTableBody.innerHTML = '';
    
    if (products.length === 0) {
        if (noProductsMessage) noProductsMessage.style.display = 'block';
        return;
    }
    
    if (noProductsMessage) noProductsMessage.style.display = 'none';
    
    // Get search query
    const searchQuery = document.getElementById('product-search')?.value?.toLowerCase() || '';
    
    // Filter products based on search
    let filteredProducts = products;
    if (searchQuery) {
        filteredProducts = products.filter(p => 
            (p.serialNumber && p.serialNumber.toLowerCase().includes(searchQuery)) ||
            (p.name && p.name.toLowerCase().includes(searchQuery)) ||
            (p.warehouse && p.warehouse.toLowerCase().includes(searchQuery))
        );
    }
    
    if (filteredProducts.length === 0) {
        productsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No products match your search</td></tr>';
        return;
    }
    

    // Group products by name and warehouse
    const groupedProducts = {};
    
    filteredProducts.forEach(product => {
        const key = `${product.name}|${product.warehouse}`;
        if (!groupedProducts[key]) {
            groupedProducts[key] = {
                name: product.name,
                warehouse: product.warehouse,
                items: []
            };
        }
        groupedProducts[key].items.push(product);
    });
    
    // Render grouped products with expand/collapse
    Object.keys(groupedProducts).forEach((key, groupIndex) => {
        const group = groupedProducts[key];
        const groupId = `group-${groupIndex}`;
        
        // Create main row (group header)
        const groupRow = document.createElement('tr');
        groupRow.className = 'group-header';
        
        // Calculate total items in group
        let totalItems = 0;
        let displaySerial = '';
        group.items.forEach(item => {
            totalItems += item.quantity || 1;
            if (!displaySerial && item.serialNumber) {
                displaySerial = item.serialNumber;
            }
        });
        
        groupRow.innerHTML = `
            <td colspan="3">
                <div class="group-toggle" onclick="toggleGroup('${groupId}')">
                    <span class="toggle-arrow" id="arrow-${groupId}">&#9658;</span>
                    <span class="group-info">${group.name} - ${group.warehouse} (${totalItems} items)</span>
                    <span class="group-serial">${displaySerial}</span>
                </div>
            </td>
        `;
        productsTableBody.appendChild(groupRow);
        
        // Create child rows for each product in the group (hidden by default)
        const childContainer = document.createElement('tr');
        childContainer.id = groupId;
        childContainer.style.display = 'none';
        
        const childCell = document.createElement('td');
        childCell.colSpan = 3;
        childCell.style.padding = '0';
        
        const childTable = document.createElement('table');
        childTable.className = 'group-items-table';
        childTable.style.width = '100%';
        
        group.items.forEach(product => {
            const childRow = document.createElement('tr');
            childRow.innerHTML = `
                <td style="padding-left: 40px;">${product.serialNumber}</td>
                <td>${product.name}</td>
                <td>${product.warehouse}</td>
                <td class="action-buttons-cell">
                    <button class="action-btn expand" onclick="toggleGroup('${groupId}')">📂</button>
                    <button class="action-btn transfer" onclick="openTransferModal('${product.id}')">Transfer</button>
                    <button class="action-btn edit" onclick="openEditModal('${product.id}')">Edit</button>
                    <button class="action-btn delete" onclick="confirmDelete('${product.id}')">Delete</button>
                </td>
            `;
            childTable.appendChild(childRow);
        });
        
        childCell.appendChild(childTable);
        childContainer.appendChild(childCell);
        productsTableBody.appendChild(childContainer);
    });
}

// Toggle group expand/collapse
function toggleGroup(groupId) {
    const group = document.getElementById(groupId);
    const arrow = document.getElementById(`arrow-${groupId}`);
    
    if (group.style.display === 'none') {
        group.style.display = 'table-row';
        arrow.innerHTML = '&#9660;'; // Down arrow
    } else {
        group.style.display = 'none';
        arrow.innerHTML = '&#9658;'; // Right arrow
    }
}

// Add new product
async function addProduct() {
    const serialPrefix = document.getElementById('product-serial').value;
    const name = document.getElementById('product-name').value;
    const warehouse = document.getElementById('product-warehouse').value;
    const fromSerial = parseInt(document.getElementById('product-from-serial').value, 10);
    const toSerial = parseInt(document.getElementById('product-to-serial').value, 10);
    
    const userId = auth.currentUser.uid;
    
    // Validate serial range
    if (isNaN(fromSerial) || isNaN(toSerial) || fromSerial < 1 || toSerial > 99999) {
        alert('Invalid serial range. Please enter values between 1 and 99999');
        return;
    }
    
    if (fromSerial > toSerial) {
        alert('From Serial cannot be greater than To Serial');
        return;
    }
    
    const quantity = toSerial - fromSerial + 1;
    
    if (quantity > 1000) {
        alert('Maximum 1000 products allowed at once');
        return;
    }
    
    try {
        // Show loading indicator
        const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;
        
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        
        // Check if product name is "12/100" - use individual serial numbers
        if (name === '12/100') {
            // Format: PREFIX + 10 + 5-digit serial starting from 00001
            // Example: PCD0401TR25100001, PCD0401TR25100002, etc.
            for (let i = fromSerial; i <= toSerial; i++) {
                const serialNum = (100000 + i).toString();
                const uniqueSerial = `${serialPrefix}10${serialNum}`;
                const newKey = productsRef.push().key;
                
                updates[newKey] = {
                    serialNumber: uniqueSerial,
                    name,
                    warehouse,
                    fromSerial: i,
                    toSerial: i,
                    quantity: 1,
                    createdAt: new Date().toISOString()
                };
            }
        } else {
            // For other product names, create individual entries
            for (let i = fromSerial; i <= toSerial; i++) {
                const uniqueSerial = `${serialPrefix}${toSerial.toString().padStart(2, '0')}${i.toString().padStart(5, '0')}`;
                const newKey = productsRef.push().key;
                
                updates[newKey] = {
                    serialNumber: uniqueSerial,
                    name,
                    warehouse,
                    fromSerial: i,
                    toSerial: i,
                    quantity: 1,
                    createdAt: new Date().toISOString()
                };
            }
        }
        
        // Add all products at once using batch update
        await productsRef.update(updates);
        
        // Reset button state
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        closeModal('add-product-modal');
        document.getElementById('add-product-form').reset();
        // Reset default values
        document.getElementById('product-serial').value = 'PCD0401TR25';
        document.getElementById('product-from-serial').value = '1';
        document.getElementById('product-to-serial').value = '10';
        
        alert(`Successfully added ${quantity} products`);
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
    } catch (error) {
        console.error('Error adding products:', error);
        alert('Error adding products: ' + error.message);
    }
}

// Open edit modal
function openEditModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    document.getElementById('edit-product-id').value = productId;
    document.getElementById('edit-product-name').value = product.name;
    document.getElementById('edit-product-warehouse').value = product.warehouse;
    
    openModal('edit-product-modal');
}

// Update product
async function updateProduct() {
    const productId = document.getElementById('edit-product-id').value;
    const name = document.getElementById('edit-product-name').value;
    const warehouse = document.getElementById('edit-product-warehouse').value;
    
    const userId = auth.currentUser.uid;
    
    try {
        // Find the product before updating to record the modification
        const product = products.find(p => p.id === productId);
        const oldWarehouse = product ? product.warehouse : null;
        
        await database.ref('products/' + userId + '/' + productId).update({
            name,
            warehouse,
            updatedAt: new Date().toISOString()
        });
        
        // Record the modification if warehouse changed
        if (product && oldWarehouse && oldWarehouse !== warehouse) {
            const modificationRef = database.ref('modifications/' + userId).push();
            await modificationRef.set({
                serialNumber: product.serialNumber,
                productName: product.name,
                oldWarehouse: oldWarehouse,
                newWarehouse: warehouse,
                modifiedAt: new Date().toISOString()
            });
        }
        
        closeModal('edit-product-modal');
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Error updating product: ' + error.message);
    }
}

// Confirm delete
function confirmDelete(productId) {
    document.getElementById('delete-product-id').value = productId;
    openModal('delete-modal');
}

// Delete product
async function deleteProduct(productId) {
    const userId = auth.currentUser.uid;
    
    try {
        // Find the product before deleting to record the deletion
        const product = products.find(p => p.id === productId);
        
        if (product) {
            // Record the deletion
            const deletionRef = database.ref('deletions/' + userId).push();
            await deletionRef.set({
                serialNumber: product.serialNumber,
                productName: product.name,
                warehouse: product.warehouse,
                deletedAt: new Date().toISOString()
            });
        }
        
        await database.ref('products/' + userId + '/' + productId).remove();
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product: ' + error.message);
    }
}

// Delete all products
async function deleteAllProducts() {
    const userId = auth.currentUser.uid;
    
    try {
        await database.ref('products/' + userId).remove();
        products = [];
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
        alert('All products have been deleted');
    } catch (error) {
        console.error('Error deleting all products:', error);
        alert('Error deleting all products: ' + error.message);
    }
}

// Open Delete by Name Modal
function openDeleteByNameModal() {
    openModal('delete-by-name-modal');
    
    // Clear previous input
    document.getElementById('delete-product-name').value = '';
    document.getElementById('delete-by-name-count').textContent = '';
    
    // Add input event listener to show matching products count
    const nameInput = document.getElementById('delete-product-name');
    nameInput.addEventListener('input', function() {
        const searchName = this.value.toLowerCase().trim();
        if (searchName) {
            const matchingProducts = products.filter(p => p.name.toLowerCase() === searchName);
            document.getElementById('delete-by-name-count').textContent = 
                `Found ${matchingProducts.length} product(s) with name "${this.value.trim()}"`;
        } else {
            document.getElementById('delete-by-name-count').textContent = '';
        }
    });
    
    // Add form submit handler
    document.getElementById('delete-by-name-form').onsubmit = async function(e) {
        e.preventDefault();
        await deleteProductsByName();
    };
}

// Delete Products by Name (Batch deletion for better performance)
async function deleteProductsByName() {
    const productName = document.getElementById('delete-product-name').value.trim();
    
    if (!productName) {
        alert('Please enter a product name');
        return;
    }
    
    const matchingProducts = products.filter(p => p.name.toLowerCase() === productName.toLowerCase());
    
    if (matchingProducts.length === 0) {
        alert('No products found with that name');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${matchingProducts.length} product(s) named "${productName}"? This action cannot be undone.`)) {
        return;
    }
    
    const userId = auth.currentUser.uid;
    
    try {
        // Use batch deletion - delete all matching products at once
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        
        // Add all products to be deleted in a single batch update
        for (const product of matchingProducts) {
            updates[product.id] = null;
        }
        
        // Perform batch delete
        await productsRef.update(updates);
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
        
        closeModal('delete-by-name-modal');
        alert(`Successfully deleted ${matchingProducts.length} product(s) named "${productName}"`);
    } catch (error) {
        console.error('Error deleting products by name:', error);
        alert('Error deleting products: ' + error.message);
    }
}

// Exit product (placeholder for exit functionality)
function exitProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        alert(`Exiting product: ${product.name}\nSerial Number: ${product.serialNumber}\nWarehouse: ${product.warehouse}`);
    }
}

// Populate transfer dropdown - show each product individually
function populateTransferDropdown(warehouseFilter = null) {
    const container = document.getElementById('transfer-product-list');
    container.innerHTML = '';
    
    // Filter products by warehouse if specified
    const filteredProducts = warehouseFilter 
        ? products.filter(p => p.warehouse === warehouseFilter)
        : products;
    
    // Add "Select All" checkbox at the top
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'checkbox-item select-all';
    selectAllDiv.style.fontWeight = 'bold';
    selectAllDiv.style.borderBottom = '1px solid #ddd';
    selectAllDiv.style.marginBottom = '10px';
    selectAllDiv.style.padding = '8px';
    selectAllDiv.style.background = '#f5f5f5';
    
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.id = 'select-all-transfer';
    selectAllCheckbox.addEventListener('change', function() {
        // Only select visible (non-hidden) checkboxes
        const checkboxes = document.querySelectorAll('.transfer-checkbox');
        checkboxes.forEach(cb => {
            const label = cb.closest('.checkbox-item');
            if (label && label.style.display !== 'none') {
                cb.checked = this.checked;
            }
        });
        updateTransferFromWarehouse();
    });
    
    const selectAllLabel = document.createElement('label');
    selectAllLabel.htmlFor = 'select-all-transfer';
    selectAllLabel.textContent = 'Select All Visible';
    selectAllLabel.style.cursor = 'pointer';
    selectAllLabel.style.marginLeft = '8px';
    
    selectAllDiv.appendChild(selectAllCheckbox);
    selectAllDiv.appendChild(selectAllLabel);
    container.appendChild(selectAllDiv);
    
    // Create checkbox for each product
    filteredProducts.forEach(product => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `product-${product.id}`;
        checkbox.value = product.id;
        checkbox.className = 'transfer-checkbox';
        
        // Add change event listener
        checkbox.addEventListener('change', updateTransferFromWarehouse);
        
        const label = document.createElement('label');
        label.htmlFor = `product-${product.id}`;
        label.textContent = `${product.serialNumber} | ${product.name} | ${product.warehouse}`;
        
        checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(label);
        container.appendChild(checkboxDiv);
    });
    
    document.getElementById('transfer-from-warehouse').value = warehouseFilter || '';
}

// Filter transfer products by search
function filterTransferProducts() {
    const searchTerm = document.getElementById('transfer-search-input').value.toLowerCase();
    const checkboxes = document.querySelectorAll('.transfer-checkbox');
    
    checkboxes.forEach(checkbox => {
        const label = checkbox.closest('.checkbox-item');
        if (label) {
            const labelText = label.textContent.toLowerCase();
            if (!searchTerm || labelText.includes(searchTerm)) {
                label.style.display = 'flex';
            } else {
                label.style.display = 'none';
            }
        }
    });
}

// Update from warehouse based on selected checkboxes
function updateTransferFromWarehouse() {
    const checkboxes = document.querySelectorAll('.transfer-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedIds.length > 0) {
        const firstProduct = products.find(p => p.id === selectedIds[0]);
        
        if (firstProduct) {
            document.getElementById('transfer-from-warehouse').value = firstProduct.warehouse;
        }
    } else {
        document.getElementById('transfer-from-warehouse').value = '';
    }
}

// Get selected product IDs from checkboxes
function getSelectedProductIds() {
    const checkboxes = document.querySelectorAll('.transfer-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Open transfer modal for a specific product
function openTransferModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Clear search input
    document.getElementById('transfer-search-input').value = '';
    
    // Populate dropdown with products from the same warehouse only
    populateTransferDropdown(product.warehouse);
    
    // Select the specific product checkbox
    const checkbox = document.getElementById(`product-${productId}`);
    if (checkbox) {
        checkbox.checked = true;
    }
    document.getElementById('transfer-from-warehouse').value = product.warehouse;
    
    openModal('transfer-product-modal');
}

// Transfer product (Batch transfer for better performance)
async function transferProduct() {
    const toWarehouse = document.getElementById('transfer-to-warehouse').value;
    
    // Get all selected product IDs
    const productIdsToTransfer = getSelectedProductIds();
    
    if (!toWarehouse) {
        alert('Please select a destination warehouse');
        return;
    }
    
    if (productIdsToTransfer.length === 0) {
        alert('Please select at least one product to transfer');
        return;
    }
    
    // Get the products to transfer
    const productsToTransfer = products.filter(p => productIdsToTransfer.includes(p.id));
    
    if (productsToTransfer.length === 0) {
        alert('Products not found');
        return;
    }
    
    // Get the source warehouse from the first product
    const fromWarehouse = productsToTransfer[0].warehouse;
    
    if (fromWarehouse === toWarehouse) {
        alert('Products are already in this warehouse');
        return;
    }
    
    const userId = auth.currentUser.uid;
    const transferDate = new Date().toISOString();
    
    try {
        // First, create the transfer record
        const transferRef = database.ref('transfers/' + userId).push();
        await transferRef.set({
            fromWarehouse: fromWarehouse,
            toWarehouse: toWarehouse,
            items: productsToTransfer.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name,
                fromWarehouse: fromWarehouse,
                toWarehouse: toWarehouse
            })),
            itemCount: productsToTransfer.length,
            transferredAt: transferDate
        });
        
        // Use batch update - transfer all selected products at once
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        
        // Add all products to be updated in a single batch update
        for (const product of productsToTransfer) {
            updates[product.id + '/warehouse'] = toWarehouse;
            updates[product.id + '/transferredAt'] = transferDate;
        }
        
        // Perform batch update
        await productsRef.update(updates);
        
        closeModal('transfer-product-modal');
        document.getElementById('transfer-product-form').reset();
        
        // Show success message
        alert(`Successfully transferred ${productsToTransfer.length} product(s) from ${fromWarehouse} to ${toWarehouse}`);
        
        // Send WhatsApp notification for transfer
        sendTransferWhatsAppNotification({
            fromWarehouse: fromWarehouse,
            toWarehouse: toWarehouse,
            itemCount: productsToTransfer.length,
            items: productsToTransfer.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name
            })),
            transferredAt: transferDate
        });
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
    } catch (error) {
        console.error('Error transferring products:', error);
        alert('Error transferring products: ' + error.message);
    }
}



// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Search products function
function searchProducts() {
    const searchTerm = document.getElementById('product-search').value.toLowerCase().trim();
    
    // Get the products table body
    const productsTableBody = document.getElementById('products-tbody');
    if (!productsTableBody) return;
    
    // Get all rows in the table
    const rows = productsTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        // Skip the no products message row
        if (row.id === 'no-products-message') return;
        
        // Get all text content in the row
        const rowText = row.textContent.toLowerCase();
        
        // Check if row matches search term
        if (searchTerm === '' || rowText.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
    
    // Show/hide "no products found" message based on visible rows
    const visibleRows = Array.from(rows).filter(row => {
        return row.style.display !== 'none' && !row.classList.contains('group-header');
    });
    
    const noProductsMsg = document.getElementById('no-products-message');
    if (noProductsMsg) {
        // Check if there are any visible product rows (not group headers)
        const hasVisibleProducts = Array.from(rows).some(row => {
            return row.style.display !== 'none' && !row.classList.contains('group-header');
        });
        
        if (searchTerm && !hasVisibleProducts) {
            noProductsMsg.textContent = 'No products match your search';
            noProductsMsg.style.display = 'block';
        } else {
            noProductsMsg.style.display = 'none';
        }
    }
}

// Show login section
function showLogin() {
    if (loginSection) loginSection.style.display = 'flex';
    if (dashboardSection) dashboardSection.style.display = 'none';
}

// Show dashboard
function showDashboard() {
    if (loginSection) loginSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    const userEmailEl = document.getElementById('user-email');
    if (userEmailEl && currentUser) userEmailEl.textContent = currentUser.email;
}

// Get error message
function getErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/u    ser-disabled':
            return 'This user account has been disabled';
        case 'auth/user-not-found':
            return 'No user found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'This email is already registered';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters';
        default:
            return 'An error occurred. Please try again';
    }
}

// Warehouse name mapping (English to Arabic)
const warehouseNames = {
    'فيصل': 'فيصل',
    'البيني': 'البيني',
    'باب الوق': 'باب الوق',
    'Central': 'المركزي',
    'Downtown': 'داون تاون',
    'Faisal': 'فيصل'
};

// Get Arabic warehouse name
function getArabicWarehouseName(englishName) {
    return warehouseNames[englishName] || englishName;
}

// Get warehouse code (F for Faisal, B for Beni, W for Downtown)
function getWarehouseCode(warehouseName) {
    if (warehouseName === 'فيصل') return 'F';
    if (warehouseName === 'البيني') return 'B';
    if (warehouseName === 'باب الوق') return 'W';
    return '';
}

// Print Products with warehouse codes (Export to Excel)
function printProducts() {
    if (products.length === 0) {
        alert('No products to print');
        return;
    }
    
    // Sort products by serial number
    const sortedProducts = [...products].sort((a, b) => {
        return a.serialNumber.localeCompare(b.serialNumber);
    });
    
    // Create CSV content for Excel export
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += 'م,رقم المسلسل,اسم المنتج,كود المستودع\n';
    
    sortedProducts.forEach((product, index) => {
        const warehouseCode = getWarehouseCode(product.warehouse);
        const row = [
            index + 1,
            product.serialNumber,
            product.name,
            warehouseCode
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Print Total Inventory
function printTotalInventory() {
    if (products.length === 0) {
        alert('No products to print');
        return;
    }
    
    // Group products by warehouse
    const groupedByWarehouse = {};
    products.forEach(product => {
        const warehouse = product.warehouse;
        if (!groupedByWarehouse[warehouse]) {
            groupedByWarehouse[warehouse] = [];
        }
        groupedByWarehouse[warehouse].push(product);
    });
    
    // Build print content
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير المخزون الإجمالي</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                h2 { color: #555; margin-top: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; background-color: #e7f3ff; }
                .print-date { text-align: center; color: #666; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>تقرير المخزون الإجمالي</h1>
            <p class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
    `;
    
    // Add products grouped by warehouse
    Object.keys(groupedByWarehouse).forEach(warehouse => {
        const warehouseProducts = groupedByWarehouse[warehouse];
        const arabicWarehouse = getArabicWarehouseName(warehouse);
        
        printContent += `<h2>المستودع: ${arabicWarehouse} (${warehouseProducts.length} صنف)</h2>`;
        printContent += '<table>';
        printContent += '<tr><th>م</th><th>رقم المسلسل</th><th>اسم المنتج</th><th>المستودع</th></tr>';
        
        warehouseProducts.forEach((product, index) => {
            printContent += `<tr>
                <td>${index + 1}</td>
                <td>${product.serialNumber}</td>
                <td>${product.name}</td>
                <td>${arabicWarehouse}</td>
            </tr>`;
        });
        
        printContent += '</table>';
    });
    
    // Add total summary
    printContent += `
        <h2>ملخص المخزون</h2>
        <table>
            <tr class="total">
                <td>إجمالي عدد المنتجات</td>
                <td>${products.length}</td>
            </tr>
        </table>
    `;
    
    printContent += '</body></html>';
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Print Warehouse Inventory (current user's warehouse)
function printWarehouseInventory() {
    if (products.length === 0) {
        alert('No products to print');
        return;
    }
    
    // Group products by warehouse
    const groupedByWarehouse = {};
    products.forEach(product => {
        const warehouse = product.warehouse;
        if (!groupedByWarehouse[warehouse]) {
            groupedByWarehouse[warehouse] = [];
        }
        groupedByWarehouse[warehouse].push(product);
    });
    
    // Build print content
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير مخزون المستودعات</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                h2 { color: #555; margin-top: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background-color: #f2f2f2; }
                .total-row { font-weight: bold; background-color: #e7f3ff; }
                .print-date { text-align: center; color: #666; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>تقرير مخزون المستودعات</h1>
            <p class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
    `;
    
    // Add summary table
    printContent += '<h2>ملخص المخزون حسب المستودع</h2>';
    printContent += '<table>';
    printContent += '<tr><th>المستودع</th><th>عدد المنتجات</th></tr>';
    
    let grandTotal = 0;
    Object.keys(groupedByWarehouse).forEach(warehouse => {
        const count = groupedByWarehouse[warehouse].length;
        const arabicWarehouse = getArabicWarehouseName(warehouse);
        grandTotal += count;
        printContent += `<tr><td>${arabicWarehouse}</td><td>${count}</td></tr>`;
    });
    
    printContent += `<tr class="total-row"><td>الإجمالي</td><td>${grandTotal}</td></tr>`;
    printContent += '</table>';
    
    // Add detailed breakdown for each warehouse
    Object.keys(groupedByWarehouse).forEach(warehouse => {
        const warehouseProducts = groupedByWarehouse[warehouse];
        const arabicWarehouse = getArabicWarehouseName(warehouse);
        
        // Group by product name within warehouse
        const groupedByName = {};
        warehouseProducts.forEach(product => {
            const name = product.name;
            if (!groupedByName[name]) {
                groupedByName[name] = { count: 0, serials: [] };
            }
            groupedByName[name].count++;
            groupedByName[name].serials.push(product.serialNumber);
        });
        
        printContent += `<h2>${arabicWarehouse} - تفاصيل المنتجات</h2>`;
        printContent += '<table>';
        printContent += '<tr><th>م</th><th>اسم المنتج</th><th>الكمية</th><th>أرقام المسلسلات</th></tr>';
        
        let index = 1;
        Object.keys(groupedByName).forEach(name => {
            const data = groupedByName[name];
            const serials = data.serials.join('، ');
            printContent += `<tr>
                <td>${index}</td>
                <td>${name}</td>
                <td>${data.count}</td>
                <td>${serials}</td>
            </tr>`;
            index++;
        });
        
        printContent += '</table>';
    });
    
    printContent += '</body></html>';
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Print Warehouse Inventory - Generic function for specific warehouse
function printWarehouseInventory(warehouseName, warehouseTitle) {
    if (products.length === 0) {
        alert('No products to print');
        return;
    }
    
    // Filter products for specific warehouse
    const warehouseProducts = products.filter(p => p.warehouse === warehouseName);
    
    if (warehouseProducts.length === 0) {
        alert(`No products found in ${warehouseTitle} warehouse`);
        return;
    }
    
    // Group by product name
    const groupedByName = {};
    warehouseProducts.forEach(product => {
        const name = product.name;
        if (!groupedByName[name]) {
            groupedByName[name] = { count: 0, serials: [] };
        }
        groupedByName[name].count++;
        groupedByName[name].serials.push(product.serialNumber);
    });
    
    // Build print content
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير مخزون ${warehouseName}</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                h2 { color: #555; margin-top: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background-color: #f2f2f2; }
                .total { font-weight: bold; background-color: #e7f3ff; }
                .print-date { text-align: center; color: #666; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <h1>تقرير مخزون ${warehouseName}</h1>
            <p class="print-date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
    `;
    
    // Add summary
    printContent += '<h2>ملخص المخزون</h2>';
    printContent += '<table>';
    printContent += '<tr><th>اسم المنتج</th><th>الكمية</th></tr>';
    
    let totalCount = 0;
    Object.keys(groupedByName).forEach(name => {
        const data = groupedByName[name];
        totalCount += data.count;
        printContent += `<tr><td>${name}</td><td>${data.count}</td></tr>`;
    });
    
    printContent += `<tr class="total"><td>الإجمالي</td><td>${totalCount}</td></tr>`;
    printContent += '</table>';
    
    // Add detailed breakdown
    printContent += '<h2>تفاصيل المنتجات</h2>';
    printContent += '<table>';
    printContent += '<tr><th>م</th><th>اسم المنتج</th><th>الكمية</th><th>أرقام المسلسلات</th></tr>';
    
    let index = 1;
    Object.keys(groupedByName).forEach(name => {
        const data = groupedByName[name];
        const serials = data.serials.join('، ');
        printContent += `<tr>
            <td>${index}</td>
            <td>${name}</td>
            <td>${data.count}</td>
            <td>${serials}</td>
        </tr>`;
        index++;
    });
    
    printContent += '</table>';
    printContent += '</body></html>';
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Open sell modal - opens the modal with warehouse selection
function sellProduct(productId) {
    // Reset the form
    document.getElementById('sell-warehouse-select').value = '';
    
    // Reset serial selection
    selectedSerialNumbers = [];
    availableSerialNumbers = [];
    currentSellWarehouse = null;
    updateSelectedSerialsDisplay();
    
    document.getElementById('sell-product-ids').value = '';
    document.getElementById('sell-warehouse').value = '';
    
    // Set default release date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sell-release-date').value = today;
    
    // Clear optional fields
    document.getElementById('sell-description').value = '';
    document.getElementById('sell-price').value = '';
    document.getElementById('sell-customer-name').value = '';

    openModal('sell-product-modal');
}

// Load products for selling based on selected warehouse
function loadSellProducts() {
    const warehouse = document.getElementById('sell-warehouse-select').value;
    
    // Reset serial selection when warehouse changes
    if (warehouse !== currentSellWarehouse) {
        selectedSerialNumbers = [];
        currentSellWarehouse = warehouse;
        updateSelectedSerialsDisplay();
    }
    
    if (!warehouse) {
        availableSerialNumbers = [];
        document.getElementById('sell-warehouse').value = '';
        document.getElementById('sell-product-ids').value = '';
        return;
    }
    
    // Filter products by selected warehouse
    const warehouseProducts = products.filter(p => p.warehouse === warehouse);
    
    if (warehouseProducts.length === 0) {
        availableSerialNumbers = [];
        document.getElementById('sell-warehouse').value = warehouse;
        document.getElementById('sell-product-ids').value = '';
        return;
    }
    
    // Set the warehouse value
    document.getElementById('sell-warehouse').value = warehouse;
    
    // Get all products as available serial numbers
    availableSerialNumbers = warehouseProducts.map(p => ({
        id: p.id,
        serialNumber: p.serialNumber,
        name: p.name
    }));
    
    // Sort by serial number
    availableSerialNumbers.sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));
    
    // Reset selected products
    document.getElementById('sell-product-ids').value = '';
}

// Open Serial Selector Modal
function openSerialSelector() {
    const warehouse = document.getElementById('sell-warehouse-select').value;
    
    if (!warehouse) {
        alert('Please select a warehouse first');
        return;
    }
    
    if (availableSerialNumbers.length === 0) {
        // Reload products for the selected warehouse
        loadSellProducts();
    }
    
    // Render serial numbers list
    renderSerialNumbersList(availableSerialNumbers);
    
    // Show modal
    document.getElementById('serial-selector-modal').style.display = 'block';
}

// Close Serial Selector Modal
function closeSerialSelector() {
    document.getElementById('serial-selector-modal').style.display = 'none';
    document.getElementById('serial-search-input').value = '';
}

// Render serial numbers list in the modal
function renderSerialNumbersList(serialNumbers) {
    const container = document.getElementById('serial-numbers-list');
    const countSpan = document.getElementById('serial-selection-count');
    
    // Update count
    countSpan.textContent = `(${selectedSerialNumbers.length} selected)`;
    
    if (!serialNumbers || serialNumbers.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No serial numbers available</div>';
        return;
    }
    
    container.innerHTML = serialNumbers.map(serial => {
        const isSelected = selectedSerialNumbers.some(s => s.id === serial.id);
        return `
            <div class="checkbox-item" style="${isSelected ? 'background: #e7f3ff;' : ''}">
                <input type="checkbox" 
                       id="serial-${serial.id}" 
                       value="${serial.id}" 
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleSerialSelection('${serial.id}', '${escapeHtml(serial.serialNumber)}', '${escapeHtml(serial.name)}')">
                <label for="serial-${serial.id}" style="flex: 1;">
                    <span style="font-weight: 500;">${serial.serialNumber}</span>
                    <span style="color: #666; margin-left: 10px;">- ${serial.name}</span>
                </label>
            </div>
        `;
    }).join('');
}

// Toggle serial number selection
function toggleSerialSelection(id, serialNumber, name) {
    const existingIndex = selectedSerialNumbers.findIndex(s => s.id === id);
    
    if (existingIndex >= 0) {
        // Remove from selection
        selectedSerialNumbers.splice(existingIndex, 1);
    } else {
        // Add to selection
        selectedSerialNumbers.push({ id, serialNumber, name });
    }
    
    // Update display
    updateSelectedSerialsDisplay();
    updateSerialSelectionCount();
    
    // Update checkbox visual state
    const checkbox = document.getElementById(`serial-${id}`);
    const parent = checkbox ? checkbox.closest('.checkbox-item') : null;
    if (parent) {
        parent.style.background = checkbox.checked ? '#e7f3ff' : '';
    }
}

// Update selected serials display
function updateSelectedSerialsDisplay() {
    const container = document.getElementById('selected-serials-display');
    const countSpan = document.getElementById('selected-serial-count');
    
    countSpan.textContent = `${selectedSerialNumbers.length} selected`;
    
    if (selectedSerialNumbers.length === 0) {
        container.innerHTML = '<span style="color: #999; font-size: 13px;">No serial numbers selected</span>';
        return;
    }
    
    container.innerHTML = selectedSerialNumbers.map(s => `
        <span class="serial-tag" style="background: #667eea; color: #fff; padding: 4px 10px; border-radius: 15px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; margin: 2px;">
            ${s.serialNumber}
            <span onclick="removeSerialFromSelection('${s.id}')" style="cursor: pointer; font-weight: bold;">×</span>
        </span>
    `).join('');
}

// Remove serial from selection
function removeSerialFromSelection(id) {
    selectedSerialNumbers = selectedSerialNumbers.filter(s => s.id !== id);
    updateSelectedSerialsDisplay();
    updateSerialSelectionCount();
    
    // Update checkbox in modal if it's open
    const checkbox = document.getElementById(`serial-${id}`);
    if (checkbox) {
        checkbox.checked = false;
        const parent = checkbox.closest('.checkbox-item');
        if (parent) {
            parent.style.background = '';
        }
    }
}

// Update serial selection count
function updateSerialSelectionCount() {
    const countSpan = document.getElementById('serial-selection-count');
    const selectAllCheckbox = document.getElementById('select-all-serials');
    
    countSpan.textContent = `(${selectedSerialNumbers.length} selected)`;
    
    // Update Select All checkbox state
    if (availableSerialNumbers.length > 0) {
        const allSelected = availableSerialNumbers.every(s => 
            selectedSerialNumbers.some(sel => sel.id === s.id)
        );
        const someSelected = availableSerialNumbers.some(s => 
            selectedSerialNumbers.some(sel => sel.id === s.id)
        );
        
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = someSelected && !allSelected;
    }
}

// Toggle Select All serials
function toggleSelectAllSerials() {
    const selectAllCheckbox = document.getElementById('select-all-serials');
    
    if (selectAllCheckbox.checked) {
        // Select all
        selectedSerialNumbers = availableSerialNumbers.map(s => ({
            id: s.id,
            serialNumber: s.serialNumber,
            name: s.name
        }));
    } else {
        // Deselect all
        selectedSerialNumbers = [];
    }
    
    // Re-render the list
    renderSerialNumbersList(availableSerialNumbers);
    updateSelectedSerialsDisplay();
}

// Filter serial numbers by search
function filterSerialNumbers() {
    const searchTerm = document.getElementById('serial-search-input').value.toLowerCase();
    
    if (!searchTerm) {
        renderSerialNumbersList(availableSerialNumbers);
        return;
    }
    
    const filtered = availableSerialNumbers.filter(s => 
        s.serialNumber.toLowerCase().includes(searchTerm) ||
        s.name.toLowerCase().includes(searchTerm)
    );
    
    renderSerialNumbersList(filtered);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update selected sell products (called from form)
function updateSelectedSellProducts() {
    // Get product IDs from selected serials
    const productIds = selectedSerialNumbers.map(s => s.id);
    document.getElementById('sell-product-ids').value = productIds.join(',');
}

// Confirm and process the sale
async function confirmSale() {
    // First update the product IDs from selected serials
    updateSelectedSellProducts();
    
    const productIds = document.getElementById('sell-product-ids').value;
    const customerName = document.getElementById('sell-customer-name').value.trim();
    const description = document.getElementById('sell-description').value.trim();
    const price = document.getElementById('sell-price').value;
    const releaseDate = document.getElementById('sell-release-date').value;
    const warehouse = document.getElementById('sell-warehouse').value;

    if (!warehouse) {
        alert('Please select a warehouse');
        return;
    }

    if (selectedSerialNumbers.length === 0) {
        alert('Please select at least one serial number to sell');
        return;
    }

    if (!customerName) {
        alert('Please enter customer name');
        return;
    }

    if (!releaseDate) {
        alert('Please select release date');
        return;
    }

    const userId = auth.currentUser.uid;
    const productIdArray = productIds ? productIds.split(',') : [];

    try {
        // Get the products being sold from selectedSerialNumbers
        const soldProducts = selectedSerialNumbers;

        if (soldProducts.length === 0) {
            alert('Products not found');
            return;
        }

        // Create sale record
        const saleRef = database.ref('sales/' + userId).push();
        await saleRef.set({
            customerName: customerName,
            items: soldProducts.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name,
                warehouse: warehouse
            })),
            itemCount: soldProducts.length,
            warehouse: warehouse,
            description: description || '',
            price: price ? parseFloat(price) : 0,
            releaseDate: releaseDate,
            soldAt: new Date().toISOString()
        });

        // Update customer purchase history
        const saleData = {
            id: saleRef.key,
            items: soldProducts.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name,
                warehouse: warehouse
            })),
            itemCount: soldProducts.length,
            warehouse: warehouse,
            price: price ? parseFloat(price) : 0,
            releaseDate: releaseDate,
            soldAt: new Date().toISOString()
        };
        await updateCustomerHistory(customerName, saleData);

        // Remove sold products from inventory
        for (const serial of soldProducts) {
            await database.ref('products/' + userId + '/' + serial.id).remove();
        }

        closeModal('sell-product-modal');
        document.getElementById('sell-product-form').reset();
        
        // Reset serial selection
        selectedSerialNumbers = [];
        availableSerialNumbers = [];
        currentSellWarehouse = null;
        updateSelectedSerialsDisplay();
        document.getElementById('sell-warehouse').value = '';

        alert(`Successfully sold ${soldProducts.length} item(s) to ${customerName}`);
        
        // Send WhatsApp notification for sale
        sendSaleWhatsAppNotification({
            customerName: customerName,
            warehouse: warehouse,
            itemCount: soldProducts.length,
            price: price,
            description: description,
            releaseDate: releaseDate,
            items: soldProducts.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name
            })),
            soldAt: new Date().toISOString()
        });
        
        // Auto-save to local storage
        autoSaveToLocalStorage();
    } catch (error) {
        console.error('Error processing sale:', error);
        alert('Error processing sale: ' + error.message);
    }
}

// Open Activities Modal
function openActivitiesModal() {
    // Load transfers, sales, deletions, modifications, and customer data
    loadTransfers();
    loadSales();
    loadDeletions();
    loadModifications();
    loadCustomers();
    
    // Show transfers tab by default
    switchActivityTab('transfers');
    
    openModal('activities-modal');
}

// Load Transfers from database
function loadTransfers() {
    const userId = auth.currentUser.uid;
    
    database.ref('transfers/' + userId).on('value', (snapshot) => {
        transfers = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const transfer = childSnapshot.val();
                transfer.id = childSnapshot.key;
                transfers.push(transfer);
            });
        }
        // Sort by date descending
        transfers.sort((a, b) => new Date(b.transferredAt) - new Date(a.transferredAt));
        renderTransfersTable();
    }, (error) => {
        console.error('Error loading transfers:', error);
    });
}

// Load Customers from database (for purchase history tracking)
function loadCustomers() {
    const userId = auth.currentUser.uid;
    
    database.ref('customers/' + userId).on('value', (snapshot) => {
        customers = {};
        if (snapshot.exists()) {
            customers = snapshot.val();
        }
    }, (error) => {
        console.error('Error loading customers:', error);
    });
}

// Update customer purchase history when a sale is made
async function updateCustomerHistory(customerName, saleData) {
    const userId = auth.currentUser.uid;
    const normalizedName = customerName.trim().toLowerCase();
    
    // Get or create customer
    const customerRef = database.ref('customers/' + userId + '/' + normalizedName);
    
    const purchaseRecord = {
        saleId: saleData.id,
        items: saleData.items,
        itemCount: saleData.itemCount,
        warehouse: saleData.warehouse,
        price: saleData.price,
        releaseDate: saleData.releaseDate,
        purchasedAt: saleData.soldAt
    };
    
    // Check if customer exists
    const snapshot = await customerRef.once('value');
    const existingData = snapshot.val();
    
    if (existingData) {
        // Update existing customer - add new purchase to history
        const purchaseHistory = existingData.purchaseHistory || [];
        purchaseHistory.push(purchaseRecord);
        
        await customerRef.update({
            name: customerName.trim(),
            lastPurchase: saleData.soldAt,
            totalPurchases: (existingData.totalPurchases || 0) + saleData.itemCount,
            purchaseHistory: purchaseHistory
        });
    } else {
        // Create new customer
        await customerRef.set({
            name: customerName.trim(),
            createdAt: new Date().toISOString(),
            lastPurchase: saleData.soldAt,
            totalPurchases: saleData.itemCount,
            purchaseHistory: [purchaseRecord]
        });
    }
}

// Get customer purchase history
function getCustomerHistory(customerName) {
    const normalizedName = customerName.trim().toLowerCase();
    return customers[normalizedName] || null;
}

// Load Sales from database
function loadSales() {
    const userId = auth.currentUser.uid;
    
    database.ref('sales/' + userId).on('value', (snapshot) => {
        sales = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const sale = childSnapshot.val();
                sale.id = childSnapshot.key;
                sales.push(sale);
            });
        }
        // Sort by date descending
        sales.sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
        renderSalesTable();
    }, (error) => {
        console.error('Error loading sales:', error);
    });
}

// Load Deletions from database
function loadDeletions() {
    const userId = auth.currentUser.uid;
    
    database.ref('deletions/' + userId).on('value', (snapshot) => {
        deletions = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const deletion = childSnapshot.val();
                deletion.id = childSnapshot.key;
                deletions.push(deletion);
            });
        }
        // Sort by date descending
        deletions.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        renderDeletionsTable();
    }, (error) => {
        console.error('Error loading deletions:', error);
    });
}

// Load Modifications from database
function loadModifications() {
    const userId = auth.currentUser.uid;
    
    database.ref('modifications/' + userId).on('value', (snapshot) => {
        modifications = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const modification = childSnapshot.val();
                modification.id = childSnapshot.key;
                modifications.push(modification);
            });
        }
        // Sort by date descending
        modifications.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
        renderModificationsTable();
    }, (error) => {
        console.error('Error loading modifications:', error);
    });
}

// Switch between tabs
function switchActivityTab(tab) {
    // Update tab buttons
    document.getElementById('tab-transfers').classList.remove('active');
    document.getElementById('tab-sales').classList.remove('active');
    document.getElementById('tab-deletions').classList.remove('active');
    document.getElementById('tab-modifications').classList.remove('active');
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Show/hide content
    document.getElementById('transfers-content').style.display = tab === 'transfers' ? 'block' : 'none';
    document.getElementById('sales-content').style.display = tab === 'sales' ? 'block' : 'none';
    document.getElementById('deletions-content').style.display = tab === 'deletions' ? 'block' : 'none';
    document.getElementById('modifications-content').style.display = tab === 'modifications' ? 'block' : 'none';
}

// Render Transfers Table
function renderTransfersTable() {
    const tbody = document.getElementById('transfers-tbody');
    const noDataMsg = document.getElementById('no-transfers-message');
    
    if (transfers.length === 0) {
        tbody.innerHTML = '';
        noDataMsg.style.display = 'block';
        return;
    }
    
    noDataMsg.style.display = 'none';
    
    tbody.innerHTML = transfers.map((transfer, index) => {
        const date = new Date(transfer.transferredAt).toLocaleDateString('ar-SA');
        const time = new Date(transfer.transferredAt).toLocaleTimeString('ar-SA');
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${transfer.itemCount}</td>
                <td style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${transfer.items ? transfer.items.map(i => i.serialNumber).join(', ') : '-'}</td>
                <td>${getArabicWarehouseName(transfer.fromWarehouse)}</td>
                <td>${getArabicWarehouseName(transfer.toWarehouse)}</td>
                <td>${date}<br><small style="color: #999;">${time}</small></td>
                <td>
                    <button class="action-btn" style="background: #17a2b8; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="printTransfer('${transfer.id}')">🖨</button>
                    <button class="action-btn" style="background: #ffc107; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="editTransfer('${transfer.id}')">✏️</button>
                    <button class="action-btn" style="background: #dc3545; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="deleteTransfer('${transfer.id}')">🗑</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Sales Table
function renderSalesTable() {
    const tbody = document.getElementById('sales-tbody');
    const noDataMsg = document.getElementById('no-sales-message');
    
    if (sales.length === 0) {
        tbody.innerHTML = '';
        noDataMsg.style.display = 'block';
        return;
    }
    
    noDataMsg.style.display = 'none';
    
    tbody.innerHTML = sales.map((sale, index) => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        const time = sale.soldAt ? new Date(sale.soldAt).toLocaleTimeString('ar-SA') : '';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${sale.customerName}</td>
                <td>${sale.itemCount}</td>
                <td style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${sale.items ? sale.items.map(i => i.serialNumber).join(', ') : '-'}</td>
                <td>${sale.price || '-'}</td>
                <td>${date}<br><small style="color: #999;">${time}</small></td>
                <td>${getArabicWarehouseName(sale.warehouse)}</td>
                <td>
                    <button class="action-btn" style="background: #17a2b8; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="showCustomerHistory('${sale.customerName}')">📋</button>
                    <button class="action-btn" style="background: #17a2b8; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="printSale('${sale.id}')">🖨</button>
                    <button class="action-btn" style="background: #ffc107; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="editSale('${sale.id}')">✏️</button>
                    <button class="action-btn" style="background: #dc3545; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="deleteSale('${sale.id}')">🗑</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Deletions Table
function renderDeletionsTable() {
    const tbody = document.getElementById('deletions-tbody');
    const noDataMsg = document.getElementById('no-deletions-message');
    
    if (deletions.length === 0) {
        tbody.innerHTML = '';
        noDataMsg.style.display = 'block';
        return;
    }
    
    noDataMsg.style.display = 'none';
    
    tbody.innerHTML = deletions.map((deletion, index) => {
        const date = new Date(deletion.deletedAt).toLocaleDateString('ar-SA');
        const time = new Date(deletion.deletedAt).toLocaleTimeString('ar-SA');
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${deletion.serialNumber}</td>
                <td>${deletion.productName}</td>
                <td>${getArabicWarehouseName(deletion.warehouse)}</td>
                <td>${date}<br><small style="color: #999;">${time}</small></td>
                <td>
                    <button class="action-btn" style="background: #17a2b8; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="printDeletion('${deletion.id}')">🖨</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Render Modifications Table
function renderModificationsTable() {
    const tbody = document.getElementById('modifications-tbody');
    const noDataMsg = document.getElementById('no-modifications-message');
    
    if (modifications.length === 0) {
        tbody.innerHTML = '';
        noDataMsg.style.display = 'block';
        return;
    }
    
    noDataMsg.style.display = 'none';
    
    tbody.innerHTML = modifications.map((modification, index) => {
        const date = new Date(modification.modifiedAt).toLocaleDateString('ar-SA');
        const time = new Date(modification.modifiedAt).toLocaleTimeString('ar-SA');
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${modification.serialNumber}</td>
                <td>${modification.productName}</td>
                <td>${getArabicWarehouseName(modification.oldWarehouse)}</td>
                <td>${getArabicWarehouseName(modification.newWarehouse)}</td>
                <td>${date}<br><small style="color: #999;">${time}</small></td>
                <td>
                    <button class="action-btn" style="background: #17a2b8; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="printModification('${modification.id}')">🖨</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Print Transfer Report
function printTransfer(transferId) {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return;
    
    const date = new Date(transfer.transferredAt).toLocaleDateString('ar-SA');
    const time = new Date(transfer.transferredAt).toLocaleTimeString('ar-SA');
    
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير نقل</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                th { background-color: #667eea; color: white; }
                .info { margin: 20px 0; }
                .info p { margin: 5px 0; }
            </style>
        </head>
        <body>
            <h1>تقرير نقل المنتجات</h1>
            <div class="info">
                <p><strong>من مستودع:</strong> ${getArabicWarehouseName(transfer.fromWarehouse)}</p>
                <p><strong>إلى مستودع:</strong> ${getArabicWarehouseName(transfer.toWarehouse)}</p>
                <p><strong>التاريخ:</strong> ${date}</p>
                <p><strong>الوقت:</strong> ${time}</p>
                <p><strong>عدد المنتجات:</strong> ${transfer.itemCount}</p>
            </div>
            <table>
                <tr>
                    <th>م</th>
                    <th>رقم المسلسل</th>
                    <th>اسم المنتج</th>
                </tr>
    `;
    
    transfer.items.forEach((item, index) => {
        printContent += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.serialNumber}</td>
                <td>${item.name}</td>
            </tr>
        `;
    });
    
    printContent += '</table></body></html>';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Print Sale Report
function printSale(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
    const time = sale.soldAt ? new Date(sale.soldAt).toLocaleTimeString('ar-SA') : '';
    
    // Get unique product names for display
    const productNames = [...new Set(sale.items.map(item => item.name))];
    const productNamesDisplay = productNames.join('، ');
    
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير بيع</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                th { background-color: #667eea; color: white; }
                .info { margin: 20px 0; }
                .info p { margin: 5px 0; }
                .product-name { color: #667eea; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>تقرير بيع المنتجات</h1>
            <div class="info">
                <p><strong>اسم العميل:</strong> ${sale.customerName}</p>
                <p><strong>اسم المنتج:</strong> <span class="product-name">${productNamesDisplay}</span></p>
                <p><strong>التاريخ:</strong> ${date}</p>
                <p><strong>الوقت:</strong> ${time}</p>
                <p><strong>المستودع:</strong> ${getArabicWarehouseName(sale.warehouse)}</p>
                <p><strong>عدد المنتجات:</strong> ${sale.itemCount}</p>
                ${sale.price ? `<p><strong>السعر:</strong> ${sale.price}</p>` : ''}
                ${sale.description ? `<p><strong>الوصف:</strong> ${sale.description}</p>` : ''}
            </div>
            <table>
                <tr>
                    <th>م</th>
                    <th>رقم المسلسل</th>
                    <th>اسم المنتج</th>
                </tr>
    `;
    
    sale.items.forEach((item, index) => {
        printContent += `
            <tr>
                <td>${index + 1}</td>
                <td>${item.serialNumber}</td>
                <td>${item.name}</td>
            </tr>
        `;
    });
    
    printContent += '</table></body></html>';
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Print Deletion Report
function printDeletion(deletionId) {
    const deletion = deletions.find(d => d.id === deletionId);
    if (!deletion) return;
    
    const date = new Date(deletion.deletedAt).toLocaleDateString('ar-SA');
    const time = new Date(deletion.deletedAt).toLocaleTimeString('ar-SA');
    
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير حذف</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                th { background-color: #dc3545; color: white; }
                .info { margin: 20px 0; }
                .info p { margin: 5px 0; }
            </style>
        </head>
        <body>
            <h1>تقرير حذف المنتج</h1>
            <div class="info">
                <p><strong>رقم المسلسل:</strong> ${deletion.serialNumber}</p>
                <p><strong>اسم المنتج:</strong> ${deletion.productName}</p>
                <p><strong>المستودع:</strong> ${getArabicWarehouseName(deletion.warehouse)}</p>
                <p><strong>التاريخ:</strong> ${date}</p>
                <p><strong>الوقت:</strong> ${time}</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Print Modification Report
function printModification(modificationId) {
    const modification = modifications.find(m => m.id === modificationId);
    if (!modification) return;
    
    const date = new Date(modification.modifiedAt).toLocaleDateString('ar-SA');
    const time = new Date(modification.modifiedAt).toLocaleTimeString('ar-SA');
    
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>تقرير تعديل</title>
            <style>
                body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                th { background-color: #ffc107; color: white; }
                .info { margin: 20px 0; }
                .info p { margin: 5px 0; }
            </style>
        </head>
        <body>
            <h1>تقرير تعديل المنتج</h1>
            <div class="info">
                <p><strong>رقم المسلسل:</strong> ${modification.serialNumber}</p>
                <p><strong>اسم المنتج:</strong> ${modification.productName}</p>
                <p><strong>المستودع القديم:</strong> ${getArabicWarehouseName(modification.oldWarehouse)}</p>
                <p><strong>المستودع الجديد:</strong> ${getArabicWarehouseName(modification.newWarehouse)}</p>
                <p><strong>التاريخ:</strong> ${date}</p>
                <p><strong>الوقت:</strong> ${time}</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Show customer purchase history modal
function showCustomerHistory(customerName) {
    const customerData = getCustomerHistory(customerName);
    
    if (!customerData || !customerData.purchaseHistory || customerData.purchaseHistory.length === 0) {
        alert('No purchase history found for this customer');
        return;
    }
    
    // Build history content
    let historyHtml = `
        <div style="padding: 20px; max-height: 400px; overflow-y: auto;">
            <h3 style="margin-bottom: 10px;">Customer: ${customerData.name}</h3>
            <p style="margin-bottom: 15px; color: #666;">
                <strong>Total Purchases:</strong> ${customerData.totalPurchases} items<br>
                <strong>Total Transactions:</strong> ${customerData.purchaseHistory.length}
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: #f2f2f2;">
                        <th style="padding: 8px; border: 1px solid #ddd;">#</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Date</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Items</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Warehouse</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Price</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Sort by date descending (most recent first)
    const sortedHistory = [...customerData.purchaseHistory].sort((a, b) => 
        new Date(b.purchasedAt) - new Date(a.purchasedAt)
    );
    
    sortedHistory.forEach((purchase, index) => {
        const date = purchase.releaseDate ? new Date(purchase.releaseDate).toLocaleDateString('ar-SA') : '-';
        const itemCount = purchase.itemCount || (purchase.items ? purchase.items.length : 0);
        const warehouse = purchase.warehouse ? getArabicWarehouseName(purchase.warehouse) : '-';
        const price = purchase.price ? purchase.price : '-';
        
        historyHtml += `
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${date}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${itemCount}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${warehouse}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${price}</td>
            </tr>
        `;
    });
    
    historyHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    // Create a simple modal for history
    const modalHtml = `
        <div id="customer-history-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 700px;">
                <span class="close" onclick="document.getElementById('customer-history-modal').remove()">&times;</span>
                <h2>Customer Purchase History</h2>
                ${historyHtml}
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('customer-history-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Edit Transfer
function editTransfer(transferId) {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) return;
    
    // Create edit modal
    const editHtml = `
        <div id="edit-transfer-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 500px;">
                <span class="close" onclick="document.getElementById('edit-transfer-modal').remove()">&times;</span>
                <h2>Edit Transfer</h2>
                <form id="edit-transfer-form">
                    <input type="hidden" id="edit-transfer-id" value="${transfer.id}">
                    <div class="form-group">
                        <label for="edit-transfer-to-warehouse">To Warehouse</label>
                        <select id="edit-transfer-to-warehouse" required>
                            <option value="فيصل" ${transfer.toWarehouse === 'فيصل' ? 'selected' : ''}>فيصل (Faisal)</option>
                            <option value="البيني" ${transfer.toWarehouse === 'البيني' ? 'selected' : ''}>البيني (Al-Bini)</option>
                            <option value="باب الوق" ${transfer.toWarehouse === 'باب الوق' ? 'selected' : ''}>باب الوق (Bab Al-Waq)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-transfer-item-count">Item Count</label>
                        <input type="number" id="edit-transfer-item-count" value="${transfer.itemCount}" required min="1">
                    </div>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('edit-transfer-modal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', editHtml);
    
    document.getElementById('edit-transfer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTransferEdit();
    });
}

// Save Transfer Edit
async function saveTransferEdit() {
    const transferId = document.getElementById('edit-transfer-id').value;
    const toWarehouse = document.getElementById('edit-transfer-to-warehouse').value;
    const itemCount = parseInt(document.getElementById('edit-transfer-item-count').value, 10);
    
    const userId = auth.currentUser.uid;
    
    try {
        await database.ref('transfers/' + userId + '/' + transferId).update({
            toWarehouse: toWarehouse,
            itemCount: itemCount
        });
        
        document.getElementById('edit-transfer-modal').remove();
        alert('Transfer updated successfully');
    } catch (error) {
        console.error('Error updating transfer:', error);
        alert('Error updating transfer: ' + error.message);
    }
}

// Delete Transfer
function deleteTransfer(transferId) {
    if (!confirm('Are you sure you want to delete this transfer? This action cannot be undone.')) {
        return;
    }
    
    const userId = auth.currentUser.uid;
    
    database.ref('transfers/' + userId + '/' + transferId).remove()
        .then(() => {
            alert('Transfer deleted successfully');
        })
        .catch((error) => {
            console.error('Error deleting transfer:', error);
            alert('Error deleting transfer: ' + error.message);
        });
}

// Edit Sale
function editSale(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    // Create edit modal
    const editHtml = `
        <div id="edit-sale-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 500px;">
                <span class="close" onclick="document.getElementById('edit-sale-modal').remove()">&times;</span>
                <h2>Edit Sale</h2>
                <form id="edit-sale-form">
                    <input type="hidden" id="edit-sale-id" value="${sale.id}">
                    <div class="form-group">
                        <label for="edit-sale-customer">Customer Name</label>
                        <input type="text" id="edit-sale-customer" value="${sale.customerName}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-sale-warehouse">Warehouse</label>
                        <select id="edit-sale-warehouse" required>
                            <option value="فيصل" ${sale.warehouse === 'فيصل' ? 'selected' : ''}>فيصل (Faisal)</option>
                            <option value="البيني" ${sale.warehouse === 'البيني' ? 'selected' : ''}>البيني (Al-Bini)</option>
                            <option value="باب الوق" ${sale.warehouse === 'باب الوق' ? 'selected' : ''}>باب الوق (Bab Al-Waq)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-sale-price">Price</label>
                        <input type="number" id="edit-sale-price" step="0.01" value="${sale.price || ''}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="edit-sale-description">Description</label>
                        <textarea id="edit-sale-description" rows="2" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 5px;">${sale.description || ''}</textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('edit-sale-modal');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', editHtml);
    
    document.getElementById('edit-sale-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSaleEdit();
    });
}

// Save Sale Edit
async function saveSaleEdit() {
    const saleId = document.getElementById('edit-sale-id').value;
    const customerName = document.getElementById('edit-sale-customer').value.trim();
    const warehouse = document.getElementById('edit-sale-warehouse').value;
    const price = document.getElementById('edit-sale-price').value;
    const description = document.getElementById('edit-sale-description').value.trim();
    
    const userId = auth.currentUser.uid;
    
    try {
        await database.ref('sales/' + userId + '/' + saleId).update({
            customerName: customerName,
            warehouse: warehouse,
            price: price ? parseFloat(price) : 0,
            description: description
        });
        
        document.getElementById('edit-sale-modal').remove();
        alert('Sale updated successfully');
    } catch (error) {
        console.error('Error updating sale:', error);
        alert('Error updating sale: ' + error.message);
    }
}

// Delete Sale
function deleteSale(saleId) {
    if (!confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
        return;
    }
    
    const userId = auth.currentUser.uid;
    
    database.ref('sales/' + userId + '/' + saleId).remove()
        .then(() => {
            alert('Sale deleted successfully');
        })
        .catch((error) => {
            console.error('Error deleting sale:', error);
            alert('Error deleting sale: ' + error.message);
        });
}

// Export Sales to Excel
function exportSalesToExcel() {
    if (sales.length === 0) {
        alert('No sales data to export');
        return;
    }
    
    // Create CSV content
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += 'م,#عميل,العدد,الاسعار,التاريخ,المستودع,ارقام المسلسلات\n';
    
    sales.forEach((sale, index) => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        const serialNumbers = sale.items ? sale.items.map(i => i.serialNumber).join(' - ') : '-';
        const row = [
            index + 1,
            sale.customerName,
            sale.itemCount,
            sale.price || '0',
            date,
            getArabicWarehouseName(sale.warehouse),
            serialNumbers
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'sales_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export Transfers to Excel
function exportTransfersToExcel() {
    if (transfers.length === 0) {
        alert('No transfers data to export');
        return;
    }
    
    // Create CSV content
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += 'م,من مستودع,إلى مستودع,العدد,التاريخ,ارقام المسلسلات\n';
    
    transfers.forEach((transfer, index) => {
        const date = transfer.transferredAt ? new Date(transfer.transferredAt).toLocaleDateString('ar-SA') : '-';
        const time = transfer.transferredAt ? new Date(transfer.transferredAt).toLocaleTimeString('ar-SA') : '';
        const serialNumbers = transfer.items ? transfer.items.map(i => i.serialNumber).join(' - ') : '-';
        const row = [
            index + 1,
            getArabicWarehouseName(transfer.fromWarehouse),
            getArabicWarehouseName(transfer.toWarehouse),
            transfer.itemCount,
            date + ' ' + time,
            serialNumbers
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'transfers_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Send Sales Report to WhatsApp
function sendSalesToWhatsApp() {
    if (sales.length === 0) {
        alert('No sales data to send');
        return;
    }
    
    // Show WhatsApp configuration modal
    const modalHtml = `
        <div id="whatsapp-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 450px;">
                <span class="close" onclick="document.getElementById('whatsapp-modal').remove()">&times;</span>
                <h2>💬 Send to WhatsApp</h2>
                <p style="color: #666; margin-bottom: 20px;">
                    Enter your WhatsApp Business API credentials to send the sales report.
                </p>
                <form id="whatsapp-form">
                    <div class="form-group">
                        <label for="whatsapp-token">Access Token</label>
                        <input type="text" id="whatsapp-token" placeholder="Enter your WhatsApp Access Token" required>
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-phone-id">Phone Number ID</label>
                        <input type="text" id="whatsapp-phone-id" placeholder="Enter your Phone Number ID" required>
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-recipient">Recipient Phone (with country code)</label>
                        <input type="text" id="whatsapp-recipient" value="+201060133529" placeholder="e.g., +201060133529" required>
                    </div>
                    <button type="submit" class="btn" style="background: #25D366; color: white; width: 100%; padding: 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                        📤 Send Report
                    </button>
                </form>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('whatsapp-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Handle form submission
    document.getElementById('whatsapp-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const token = document.getElementById('whatsapp-token').value;
        const phoneId = document.getElementById('whatsapp-phone-id').value;
        const recipient = document.getElementById('whatsapp-recipient').value;
        
        // Show loading
        const submitBtn = document.querySelector('#whatsapp-form button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '⏳ Sending...';
        submitBtn.disabled = true;
        
        try {
            // Format sales data for WhatsApp
            const message = formatSalesForWhatsApp(sales);
            
            // Send to WhatsApp API
            const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: recipient,
                    type: "text",
                    text: { body: message }
                })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('✅ Sales report sent successfully to WhatsApp!');
                document.getElementById('whatsapp-modal').remove();
            } else {
                throw new Error(result.error?.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('Error sending to WhatsApp:', error);
            alert('❌ Error sending message: ' + error.message);
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Format sales data for WhatsApp message
function formatSalesForWhatsApp(salesData) {
    let message = '📊 *تقرير المبيعات*\n\n';
    
    // Group by date
    const groupedByDate = {};
    salesData.forEach(sale => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(sale);
    });
    
    let totalItems = 0;
    let totalRevenue = 0;
    
    Object.keys(groupedByDate).forEach(date => {
        message += `📅 *${date}*\n`;
        groupedByDate[date].forEach(sale => {
            const items = sale.itemCount || 1;
            totalItems += items;
            totalRevenue += sale.price || 0;
            message += `• ${sale.customerName}: ${items} صنف`;
            if (sale.price) {
                message += ` - ${sale.price}$`;
            }
            message += '\n';
        });
        message += '\n';
    });
    
    message += '━━━━━━━━━━━━━━━━━\n';
    message += `📈 *الإجمالي*: ${totalItems} صنف\n`;
    message += `💰 *الإيرادات*: ${totalRevenue}$`;
    
    return message;
}

// Helper function to export data to Excel
function exportDataToExcel(products, transfers, sales, deletions, modifications, customers) {
    // Convert customers object to array if needed
    let customersArray = customers;
    if (customers && typeof customers === 'object' && !Array.isArray(customers)) {
        customersArray = Object.values(customers);
    }
    
    // Check if there's any data to export
    if (products.length === 0 && transfers.length === 0 && sales.length === 0 && 
        deletions.length === 0 && modifications.length === 0 && customersArray.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Create CSV content with multiple sections
    let csvContent = '\uFEFF'; // BOM for UTF-8
    
    // Products Sheet
    csvContent += '\n========== المنتجات / Products ==========\n';
    csvContent += 'م,رقم المسلسل,اسم المنتج,المستودع,الكمية,تاريخ الإنشاء\n';
    products.forEach((product, index) => {
        const date = product.createdAt ? new Date(product.createdAt).toLocaleDateString('ar-SA') : '-';
        const row = [
            index + 1,
            product.serialNumber || '-',
            product.name || '-',
            product.warehouse || '-',
            product.quantity || 1,
            date
        ];
        // Escape any commas in the data
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Transfers Sheet
    csvContent += '\n========== التحويلات / Transfers ==========\n';
    csvContent += 'م,من مستودع,إلى مستودع,عدد الأصناف,التاريخ,أرقام المسلسلات\n';
    transfers.forEach((transfer, index) => {
        const date = transfer.transferredAt ? new Date(transfer.transferredAt).toLocaleDateString('ar-SA') : '-';
        const serials = transfer.items ? transfer.items.map(i => i.serialNumber).join(' - ') : '-';
        const row = [
            index + 1,
            transfer.fromWarehouse || '-',
            transfer.toWarehouse || '-',
            transfer.itemCount || 0,
            date,
            serials
        ];
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Sales Sheet
    csvContent += '\n========== المبيعات / Sales ==========\n';
    csvContent += 'م,اسم العميل,اسم المنتج,عدد الأصناف,السعر,التاريخ,المستودع,أرقام المسلسلات\n';
    sales.forEach((sale, index) => {
        const date = sale.releaseDate ? new Date(sale.releaseDate).toLocaleDateString('ar-SA') : '-';
        const productNames = sale.items ? [...new Set(sale.items.map(i => i.name))].join(' - ') : '-';
        const serials = sale.items ? sale.items.map(i => i.serialNumber).join(' - ') : '-';
        const row = [
            index + 1,
            sale.customerName || '-',
            productNames,
            sale.itemCount || 0,
            sale.price || 0,
            date,
            sale.warehouse || '-',
            serials
        ];
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Deletions Sheet
    csvContent += '\n========== الحذف / Deletions ==========\n';
    csvContent += 'م,رقم المسلسل,اسم المنتج,المستودع,تاريخ الحذف\n';
    deletions.forEach((deletion, index) => {
        const date = deletion.deletedAt ? new Date(deletion.deletedAt).toLocaleDateString('ar-SA') : '-';
        const row = [
            index + 1,
            deletion.serialNumber || '-',
            deletion.productName || '-',
            deletion.warehouse || '-',
            date
        ];
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Modifications Sheet
    csvContent += '\n========== التعديلات / Modifications ==========\n';
    csvContent += 'م,رقم المسلسل,اسم المنتج,المستودع القديم,المستودع الجديد,تاريخ التعديل\n';
    modifications.forEach((modification, index) => {
        const date = modification.modifiedAt ? new Date(modification.modifiedAt).toLocaleDateString('ar-SA') : '-';
        const row = [
            index + 1,
            modification.serialNumber || '-',
            modification.productName || '-',
            modification.oldWarehouse || '-',
            modification.newWarehouse || '-',
            date
        ];
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Customers Sheet
    csvContent += '\n========== العملاء / Customers ==========\n';
    csvContent += 'م,اسم العميل,إجمالي المشتريات,آخر شراء\n';
    customersArray.forEach((customer, index) => {
        const lastPurchase = customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString('ar-SA') : '-';
        const row = [
            index + 1,
            customer.name || '-',
            customer.totalPurchases || 0,
            lastPurchase
        ];
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'database_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`✅ Export completed!\n\nData exported:\n- Products: ${products.length}\n- Transfers: ${transfers.length}\n- Sales: ${sales.length}\n- Deletions: ${deletions.length}\n- Modifications: ${modifications.length}\n- Customers: ${customersArray.length}`);
}

// Export All Database to Excel (Uses local storage for faster export)
function exportAllToExcel() {
    // Try to load from local storage first for faster export
    const hasLocalData = loadFromLocalStorage();
    
    if (!hasLocalData && !auth.currentUser) {
        alert('Please login first');
        return;
    }
    
    const userId = auth.currentUser ? auth.currentUser.uid : 'local';
    const exportDate = new Date().toLocaleDateString('ar-SA');
    
    // Show loading indicator
    const exportBtn = document.getElementById('export-excel-btn');
    const originalText = exportBtn.textContent;
    exportBtn.textContent = '⏳ Exporting...';
    exportBtn.disabled = true;
    
    // If we have data from local storage, export directly
    if (hasLocalData) {
        exportDataToExcel(products, transfers, sales, deletions, modifications, customers);
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
        return;
    }
    
    // Otherwise load from Firebase
    // Load all data from Firebase
    Promise.all([
        database.ref('products/' + userId).once('value'),
        database.ref('transfers/' + userId).once('value'),
        database.ref('sales/' + userId).once('value'),
        database.ref('deletions/' + userId).once('value'),
        database.ref('modifications/' + userId).once('value'),
        database.ref('customers/' + userId).once('value')
    ]).then(([productsSnapshot, transfersSnapshot, salesSnapshot, deletionsSnapshot, modificationsSnapshot, customersSnapshot]) => {
        // Prepare data for each sheet
        const products = [];
        if (productsSnapshot.exists()) {
            productsSnapshot.forEach(childSnapshot => {
                const product = childSnapshot.val();
                product.id = childSnapshot.key;
                products.push(product);
            });
        }
        
        const transfers = [];
        if (transfersSnapshot.exists()) {
            transfersSnapshot.forEach(childSnapshot => {
                const transfer = childSnapshot.val();
                transfer.id = childSnapshot.key;
                transfers.push(transfer);
            });
        }
        
        const sales = [];
        if (salesSnapshot.exists()) {
            salesSnapshot.forEach(childSnapshot => {
                const sale = childSnapshot.val();
                sale.id = childSnapshot.key;
                sales.push(sale);
            });
        }
        
        const deletions = [];
        if (deletionsSnapshot.exists()) {
            deletionsSnapshot.forEach(childSnapshot => {
                const deletion = childSnapshot.val();
                deletion.id = childSnapshot.key;
                deletions.push(deletion);
            });
        }
        
        const modifications = [];
        if (modificationsSnapshot.exists()) {
            modificationsSnapshot.forEach(childSnapshot => {
                const modification = childSnapshot.val();
                modification.id = childSnapshot.key;
                modifications.push(modification);
            });
        }
        
        const customers = [];
        if (customersSnapshot.exists()) {
            customersSnapshot.forEach(childSnapshot => {
                const customer = childSnapshot.val();
                customer.id = childSnapshot.key;
                customers.push(customer);
            });
        }
        
        // Check if there's any data to export
        if (products.length === 0 && transfers.length === 0 && sales.length === 0 && 
            deletions.length === 0 && modifications.length === 0 && customers.length === 0) {
            alert('No data to export');
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
            return;
        }
        
        // Create CSV content with multiple sections (since browsers can't create true Excel with multiple sheets easily)
        // We'll create a CSV with all data separated by section headers
        
        let csvContent = '\uFEFF'; // BOM for UTF-8
        
        // Products Sheet
        csvContent += '\n========== المنتجات / Products ==========\n';
        csvContent += 'م,رقم المسلسل,اسم المنتج,المستودع,الكمية,تاريخ الإنشاء\n';
        products.forEach((product, index) => {
            const date = product.createdAt ? new Date(product.createdAt).toLocaleDateString('ar-SA') : '-';
            const row = [
                index + 1,
                product.serialNumber || '-',
                product.name || '-',
                product.warehouse || '-',
                product.quantity || 1,
                date
            ];
            // Escape any commas in the data
            csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
        });
        
        // Transfers Sheet
        csvContent += '\n========== التحويلات / Transfers ==========\n';
        csvContent += 'م,من مستودع,إلى مستودع,عدد الأصناف,التاريخ,أرقام المسلسلات\n';
        transfers.forEach((transfer, index) => {
            const date = transfer.transferredAt ? new Date(transfer.transferredAt).toLocaleDateString('ar-SA') : '-';
            const serials = transfer.items ? transfer.items.map(i => i.serialNumber).join(' - ') : '-';
            const row = [
                index + 1,
                transfer.fromWarehouse || '-',
                transfer.toWarehouse || '-',
                transfer.itemCount || 0,
                date,
                serials
            ];
            csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
        });
        
        // Sales Sheet
        csvContent += '\n========== المبيعات / Sales ==========\n';
        csvContent += 'م,اسم العميل,اسم المنتج,عدد الأصناف,السعر,التاريخ,المستودع,أرقام المسلسلات\n';
        sales.forEach((sale, index) => {
            const date = sale.releaseDate ? new Date(sale.releaseDate).toLocaleDateString('ar-SA') : '-';
            const productNames = sale.items ? [...new Set(sale.items.map(i => i.name))].join(' - ') : '-';
            const serials = sale.items ? sale.items.map(i => i.serialNumber).join(' - ') : '-';
            const row = [
                index + 1,
                sale.customerName || '-',
                productNames,
                sale.itemCount || 0,
                sale.price || 0,
                date,
                sale.warehouse || '-',
                serials
            ];
            csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
        });
        
        // Deletions Sheet
        csvContent += '\n========== الحذف / Deletions ==========\n';
        csvContent += 'م,رقم المسلسل,اسم المنتج,المستودع,تاريخ الحذف\n';
        deletions.forEach((deletion, index) => {
            const date = deletion.deletedAt ? new Date(deletion.deletedAt).toLocaleDateString('ar-SA') : '-';
            const row = [
                index + 1,
                deletion.serialNumber || '-',
                deletion.productName || '-',
                deletion.warehouse || '-',
                date
            ];
            csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
        });
        
        // Modifications Sheet
        csvContent += '\n========== التعديلات / Modifications ==========\n';
        csvContent += 'م,رقم المسلسل,اسم المنتج,المستودع القديم,المستودع الجديد,تاريخ التعديل\n';
        modifications.forEach((modification, index) => {
            const date = modification.modifiedAt ? new Date(modification.modifiedAt).toLocaleDateString('ar-SA') : '-';
            const row = [
                index + 1,
                modification.serialNumber || '-',
                modification.productName || '-',
                modification.oldWarehouse || '-',
                modification.newWarehouse || '-',
                date
            ];
            csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
        });
        
        // Customers Sheet
        csvContent += '\n========== العملاء / Customers ==========\n';
        csvContent += 'م,اسم العميل,إجمالي المشتريات,آخر شراء\n';
        customersArray.forEach((customer, index) => {
            const lastPurchase = customer.lastPurchase ? new Date(customer.lastPurchase).toLocaleDateString('ar-SA') : '-';
            const row = [
                index + 1,
                customer.name || '-',
                customer.totalPurchases || 0,
                lastPurchase
            ];
            csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
        });
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'database_export_' + new Date().toISOString().split('T')[0] + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Reset button state
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
        
        alert(`✅ Export completed!\n\nData exported:\n- Products: ${products.length}\n- Transfers: ${transfers.length}\n- Sales: ${sales.length}\n- Deletions: ${deletions.length}\n- Modifications: ${modifications.length}\n- Customers: ${customersArray.length}`);
        
    }).catch(error => {
        console.error('Error exporting data:', error);
        alert('Error exporting data: ' + error.message);
        exportBtn.textContent = originalText;
        exportBtn.disabled = false;
    });
}

// Import from Excel file
function importFromExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n');
            
            let importedProducts = [];
            let currentSection = '';
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Detect section headers
                if (line.includes('========== المنتجات / Products ==========')) {
                    currentSection = 'products';
                    continue;
                } else if (line.includes('========== التحويلات / Transfers ==========')) {
                    currentSection = 'transfers';
                    continue;
                } else if (line.includes('========== المبيعات / Sales ==========')) {
                    currentSection = 'sales';
                    continue;
                } else if (line.includes('========== الحذف / Deletions ==========')) {
                    currentSection = 'deletions';
                    continue;
                } else if (line.includes('========== التعديلات / Modifications ==========')) {
                    currentSection = 'modifications';
                    continue;
                } else if (line.includes('========== العملاء / Customers ==========')) {
                    currentSection = 'customers';
                    continue;
                }
                
                // Skip header rows and empty lines
                if (!line || line.startsWith('م,') || line.startsWith('#') || 
                    line.startsWith('Serial') || line.startsWith('رقم') ||
                    line.startsWith('من') || line.startsWith('اسم')) {
                    continue;
                }
                
                // Parse product data
                if (currentSection === 'products' && line.includes(',')) {
                    const parts = line.split(',');
                    if (parts.length >= 4) {
                        // Try to extract serial number (usually the second field)
                        let serialNumber = parts[1]?.trim().replace(/"/g, '') || '';
                        let name = parts[2]?.trim().replace(/"/g, '') || '';
                        let warehouse = parts[3]?.trim().replace(/"/g, '') || '';
                        
                        if (serialNumber && serialNumber !== '-' && name && name !== '-') {
                            importedProducts.push({
                                serialNumber: serialNumber,
                                name: name,
                                warehouse: warehouse,
                                quantity: 1,
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                }
            }
            
            // Show import preview and confirmation
            if (importedProducts.length === 0) {
                alert('No products found in the file. Please check the file format.');
                return;
            }
            
            // Show confirmation dialog
            const confirmMessage = `Found ${importedProducts.length} products in the file.\n\n` +
                'Do you want to:\n' +
                '• YES - Add these products to existing data (merge)\n' +
                '• NO - Replace all existing products with imported data\n' +
                '• CANCEL - Do nothing';
            
            const userChoice = confirm(confirmMessage);
            
            if (userChoice === true) {
                // Merge: Add to existing products
                mergeImportData(importedProducts, false);
            } else if (userChoice === false) {
                // Replace: Confirm replacement
                if (confirm('This will REPLACE all existing products with the imported ones. Are you sure?')) {
                    mergeImportData(importedProducts, true);
                }
            }
            // If cancel, do nothing
            
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error reading file. Please make sure it\'s a valid Excel/CSV file.');
        }
    };
    
    reader.onerror = function() {
        alert('Error reading file');
    };
    
    reader.readAsText(file);
}

// Merge imported data with existing data
function mergeImportData(importedProducts, replace) {
    const userId = auth.currentUser.uid;
    
    if (!userId) {
        alert('Please login first');
        return;
    }
    
    try {
        if (replace) {
            // Replace mode: Clear existing and add imported
            const productsRef = database.ref('products/' + userId);
            productsRef.remove().then(() => {
                // Add imported products
                const updates = {};
                importedProducts.forEach(product => {
                    const newKey = productsRef.push().key;
                    updates[newKey] = product;
                });
                
                productsRef.update(updates).then(() => {
                    alert(`Successfully imported ${importedProducts.length} products (replaced existing)`);
                    // Clear file input
                    document.getElementById('import-file-input').value = '';
                    // Reload products
                    loadProducts();
                }).catch(err => {
                    console.error('Error importing products:', err);
                    alert('Error importing products: ' + err.message);
                });
            });
        } else {
            // Merge mode: Add to existing
            const productsRef = database.ref('products/' + userId);
            const updates = {};
            
            importedProducts.forEach(product => {
                const newKey = productsRef.push().key;
                updates[newKey] = product;
            });
            
            productsRef.update(updates).then(() => {
                alert(`Successfully imported ${importedProducts.length} products (added to existing)`);
                // Clear file input
                document.getElementById('import-file-input').value = '';
                // Reload products
                loadProducts();
            }).catch(err => {
                console.error('Error importing products:', err);
                alert('Error importing products: ' + err.message);
            });
        }
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data: ' + error.message);
    }
}

