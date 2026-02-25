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

// Google Gemini API Key - globally accessible
var GEMINI_API_KEY = 'AIzaSyBfz7JdE5gm1mh3xVNl2bxaEEAwuclThxo';

// Global function to open AI Assistant Modal - defined outside DOMContentLoaded for immediate availability
function openAIAssistant() {
    openModal('ai-assistant-modal');
    // Clear previous messages and show welcome message
    const messagesContainer = document.getElementById('ai-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div style="display: flex; gap: 12px; margin-bottom: 15px;">
                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    🤖
                </div>
                <div style="background: var(--bg-elevated); padding: 12px 16px; border-radius: 12px; border-top-left-radius: 4px; max-width: 80%;">
                    <p style="margin: 0; color: var(--text-primary); font-size: 14px;">
                        Hello! I'm your AI Assistant. I can help you with:
                    </p>
                    <ul style="margin: 8px 0 0 0; padding-left: 18px; color: var(--text-secondary); font-size: 13px;">
                        <li>Inventory summary and statistics</li>
                        <li>Product information and details</li>
                        <li>Sales and transfer analysis</li>
                        <li>General questions</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// Make function globally accessible immediately
window.openAIAssistant = openAIAssistant;

// Quick action button handler - defined outside DOMContentLoaded for immediate availability
function askAIQuick(prompt) {
    document.getElementById('ai-prompt-input').value = prompt;
    sendAIPrompt();
}

// Handle Enter key in AI input - defined outside DOMContentLoaded for immediate availability
function handleAIKeyPress(event) {
    if (event.key === 'Enter') {
        sendAIPrompt();
    }
}

// Send prompt to AI - defined outside DOMContentLoaded for immediate availability
async function sendAIPrompt() {
    const input = document.getElementById('ai-prompt-input');
    if (!input) return;
    
    const prompt = input.value.trim();
    
    if (!prompt) return;
    
    // Add user message to chat
    addUserMessage(prompt);
    input.value = '';
    
    // Show loading
    showAILoading(true);
    
    try {
        // First, check if it's a data-related question
        const dataResponse = await getDataBasedResponse(prompt);
        
        if (dataResponse) {
            // Use data-based response
            addAIMessage(dataResponse);
        } else {
            // Use Gemini API for general questions
            const aiResponse = await callGeminiAPI(prompt);
            addAIMessage(aiResponse);
        }
    } catch (error) {
        console.error('AI Error:', error);
        addAIMessage('Sorry, I encountered an error. Please try again.');
    }
    
    showAILoading(false);
}

// Add user message to chat
function addUserMessage(message) {
    const messagesContainer = document.getElementById('ai-messages');
    if (!messagesContainer) return;
    
    const messageHtml = `
        <div style="display: flex; gap: 12px; margin-bottom: 15px; flex-direction: row-reverse;">
            <div style="width: 36px; height: 36px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                👤
            </div>
            <div style="background: var(--primary); padding: 12px 16px; border-radius: 12px; border-top-right-radius: 4px; max-width: 80%;">
                <p style="margin: 0; color: var(--bg-dark); font-size: 14px;">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollAIChatToBottom();
}

// Add AI message to chat
function addAIMessage(message) {
    const messagesContainer = document.getElementById('ai-messages');
    if (!messagesContainer) return;
    
    const messageHtml = `
        <div style="display: flex; gap: 12px; margin-bottom: 15px;">
            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                🤖
            </div>
            <div style="background: var(--bg-elevated); padding: 12px 16px; border-radius: 12px; border-top-left-radius: 4px; max-width: 80%;">
                <p style="margin: 0; color: var(--text-primary); font-size: 14px; white-space: pre-wrap;">${message}</p>
            </div>
        </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollAIChatToBottom();
}

// Scroll chat to bottom
function scrollAIChatToBottom() {
    const chatDisplay = document.getElementById('ai-chat-display');
    if (chatDisplay) chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Show/hide loading indicator
function showAILoading(show) {
    const loadingEl = document.getElementById('ai-loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
    if (show) {
        scrollAIChatToBottom();
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make these functions globally accessible immediately
window.askAIQuick = askAIQuick;
window.handleAIKeyPress = handleAIKeyPress;
window.sendAIPrompt = sendAIPrompt;

// Call Gemini API
async function callGeminiAPI(prompt) {
    const context = buildProductContext();
    
    const fullPrompt = `You are a helpful AI assistant for a Product Management System. 
Current inventory data:
${context}

User question: ${prompt}

Please provide a helpful, concise response. If the question is about the inventory data, use the data provided above.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            throw new Error('API request failed');
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return 'I apologize, but I could not generate a response. Please try again.';
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return 'Sorry, I encountered an error while processing your request. Please check your internet connection and try again.';
    }
}

// Build product context from current data
function buildProductContext() {
    let context = 'No products in inventory.\n';
    
    if (products && products.length > 0) {
        // Group by warehouse
        const warehouses = {};
        products.forEach(p => {
            if (!warehouses[p.warehouse]) {
                warehouses[p.warehouse] = [];
            }
            warehouses[p.warehouse].push(p);
        });
        
        context = `Total Products: ${products.length}\n\n`;
        context += `By Warehouse:\n`;
        
        Object.keys(warehouses).forEach(wh => {
            context += `- ${wh}: ${warehouses[wh].length} products\n`;
        });
        
        context += `\nRecent Products (first 10):\n`;
        products.slice(0, 10).forEach(p => {
            context += `- ${p.serialNumber}: ${p.name} (${p.warehouse})\n`;
        });
    }
    
    // Add sales info
    if (sales && sales.length > 0) {
        context += `\nTotal Sales: ${sales.length}\n`;
        const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
        context += `Total Revenue: ${totalRevenue}\n`;
        
        // Recent sales
        context += `\nRecent Sales (last 5):\n`;
        sales.slice(0, 5).forEach(s => {
            context += `- ${s.customerName}: ${s.itemCount} items - ${s.price || 'N/A'}\n`;
        });
    }
    
    return context;
}

// Get data-based response for specific queries
async function getDataBasedResponse(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Inventory summary
    if (lowerPrompt.includes('inventory') || lowerPrompt.includes('stock') || lowerPrompt.includes('summary')) {
        return getInventorySummary();
    }
    
    // Low stock products
    if (lowerPrompt.includes('low stock') || lowerPrompt.includes('running out')) {
        return getLowStockProducts();
    }
    
    // Recent sales
    if (lowerPrompt.includes('sale') && (lowerPrompt.includes('recent') || lowerPrompt.includes('last') || lowerPrompt.includes('today'))) {
        return getRecentSales();
    }
    
    // Warehouse info
    if (lowerPrompt.includes('warehouse') || lowerPrompt.includes('فيصل') || lowerPrompt.includes('البيني') || lowerPrompt.includes('باب الوق')) {
        return getWarehouseInfo();
    }
    
    // Total products
    if (lowerPrompt.includes('total product') || lowerPrompt.includes('how many product')) {
        return `You have ${products ? products.length : 0} products in your inventory.`;
    }
    
    return null;
}

// Get inventory summary
function getInventorySummary() {
    if (!products || products.length === 0) {
        return 'Your inventory is currently empty. Add some products to get started!';
    }
    
    const warehouses = {};
    products.forEach(p => {
        if (!warehouses[p.warehouse]) {
            warehouses[p.warehouse] = 0;
        }
        warehouses[p.warehouse]++;
    });
    
    let response = '📊 **Inventory Summary**\n\n';
    response += `Total Products: ${products.length}\n\n`;
    response += 'By Warehouse:\n';
    
    Object.keys(warehouses).forEach(wh => {
        response += `- ${wh}: ${warehouses[wh]} products\n`;
    });
    
    // Group by product name
    const productNames = {};
    products.forEach(p => {
        if (!productNames[p.name]) {
            productNames[p.name] = 0;
        }
        productNames[p.name]++;
    });
    
    response += '\nBy Product Type:\n';
    Object.keys(productNames).forEach(name => {
        response += `- ${name}: ${productNames[name]}\n`;
    });
    
    return response;
}

// Get low stock products (assuming single item is low)
function getLowStockProducts() {
    if (!products || products.length === 0) {
        return 'Your inventory is empty.';
    }
    
    // Since all products are individual, let's find products with unique names that have few items
    const productNames = {};
    products.forEach(p => {
        if (!productNames[p.name]) {
            productNames[p.name] = 0;
        }
        productNames[p.name]++;
    });
    
    const lowStock = Object.entries(productNames).filter(([name, count]) => count <= 3);
    
    if (lowStock.length === 0) {
        return 'All products have good stock levels!';
    }
    
    let response = '⚠️ **Low Stock Products**\n\n';
    lowStock.forEach(([name, count]) => {
        response += `- ${name}: only ${count} item(s) left\n`;
    });
    
    return response;
}

// Get recent sales
function getRecentSales() {
    if (!sales || sales.length === 0) {
        return 'No sales have been recorded yet.';
    }
    
    const recentSales = sales.slice(0, 10);
    
    let response = '💰 **Recent Sales**\n\n';
    
    recentSales.forEach((sale, index) => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        response += `${index + 1}. ${sale.customerName}\n`;
        response += `   Items: ${sale.itemCount} | Price: ${sale.price || 'N/A'} | Date: ${date}\n`;
    });
    
    return response;
}

// Get warehouse information
function getWarehouseInfo() {
    if (!products || products.length === 0) {
        return 'No products in any warehouse.';
    }
    
    const warehouses = {};
    products.forEach(p => {
        if (!warehouses[p.warehouse]) {
            warehouses[p.warehouse] = { count: 0, products: [] };
        }
        warehouses[p.warehouse].count++;
        warehouses[p.warehouse].products.push(p.name);
    });
    
    let response = '🏭 **Warehouse Information**\n\n';
    
    Object.keys(warehouses).forEach(wh => {
        response += `**${wh}**: ${warehouses[wh].count} products\n`;
    });
    
    return response;
}

// Connection state management to prevent reconnection loops
let isConnectionAttemptInProgress = false;
let connectionRetryCount = 0;
const MAX_RETRY_ATTEMPTS = 5;
let connectionRetryTimeout = null;

// WhatsApp Settings
let whatsappSettings = {
    token: '',
    phoneId: '',
    recipientPhone: '',
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
            document.getElementById('whatsapp-recipient-phone').value = whatsappSettings.recipientPhone || '';
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
        whatsappSettings.recipientPhone = document.getElementById('whatsapp-recipient-phone').value;
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
    
    // Clean phone number from any plus signs or spaces
    const rawRecipient = recipientPhone || whatsappSettings.recipientPhone;
    const cleanRecipient = rawRecipient.replace(/\D/g, '');
    
    // recipient should be a valid phone number (e.g., 201060133529)
    if (!cleanRecipient) {
        console.log('No recipient phone number specified. Please add a recipient phone in WhatsApp Settings.');
        return false;
    }
    
    try {
        const response = await fetch(`https://graph.facebook.com/v22.0/${whatsappSettings.phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whatsappSettings.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: cleanRecipient,
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
            // Provide more helpful error message
            if (result.error && result.error.message) {
                if (result.error.message.includes('Recipient phone number not in allowed list')) {
                    alert('❌ Error: The recipient phone number is not in the allowed list.\n\n' + 
                          'To fix this:\n' +
                          '1. Go to Facebook Developers Portal > Your App > WhatsApp > Configuration\n' +
                          '2. Under "Test Numbers", add this phone number\n' +
                          '3. Or verify your business phone number');
                } else {
                    alert('❌ WhatsApp Error: ' + result.error.message);
                }
            }
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
    
    // Get unique product names from items array
    const productNames = sale.items && sale.items.length > 0
        ? [...new Set(sale.items.map(item => item.name))].join('، ')
        : '-';
    
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

    // Expand Products button
    const expandProductsBtn = document.getElementById('expand-products-btn');
    if (expandProductsBtn) {
        expandProductsBtn.addEventListener('click', () => {
            expandAllProducts();
        });
    }

    // Print Products button
    const printProductsBtn = document.getElementById('print-products-btn');
    if (printProductsBtn) {
        printProductsBtn.addEventListener('click', () => {
            printProducts();
        });
    }

    // Import Products button
    const importProductsBtn = document.getElementById('import-products-btn');
    if (importProductsBtn) {
        importProductsBtn.addEventListener('click', () => {
            openModal('import-products-modal');
            // Reset form
            document.getElementById('import-file').value = '';
            document.getElementById('import-preview').style.display = 'none';
        });
    }

    // JSON Data Recovery button
    const jsonRecoveryBtn = document.getElementById('json-recovery-btn');
    if (jsonRecoveryBtn) {
        jsonRecoveryBtn.addEventListener('click', () => {
            openJsonRecovery();
        });
    }

    // Import Products form submission
    const importProductsForm = document.getElementById('import-products-form');
    if (importProductsForm) {
        importProductsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleImportProducts();
        });
    }

    // Import file change - show preview
    const importFileInput = document.getElementById('import-file');
    if (importFileInput) {
        importFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await showImportPreview(file);
            }
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

    const tabSalesAccounts = document.getElementById('tab-sales-accounts');
    if (tabSalesAccounts) {
        tabSalesAccounts.addEventListener('click', () => {
            switchActivityTab('sales-accounts');
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

// Expand all product groups
function expandAllProducts() {
    const groupHeaders = document.querySelectorAll('.group-header');
    let expandedCount = 0;
    
    groupHeaders.forEach((header, index) => {
        const groupId = `group-${index}`;
        const group = document.getElementById(groupId);
        const arrow = document.getElementById(`arrow-${groupId}`);
        
        if (group && group.style.display === 'none') {
            group.style.display = 'table-row';
            if (arrow) arrow.innerHTML = '&#9660;'; // Down arrow
            expandedCount++;
        }
    });
    
    if (expandedCount > 0) {
        console.log(`Expanded ${expandedCount} product groups`);
    } else {
        // If all are already expanded, collapse them instead
        groupHeaders.forEach((header, index) => {
            const groupId = `group-${index}`;
            const group = document.getElementById(groupId);
            const arrow = document.getElementById(`arrow-${groupId}`);
            
            if (group && group.style.display !== 'none') {
                group.style.display = 'none';
                if (arrow) arrow.innerHTML = '&#9658;'; // Right arrow
            }
        });
        console.log('Collapsed all product groups');
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

// Filter products by warehouse
function filterByWarehouse() {
    const warehouseFilter = document.getElementById('warehouse-filter').value;
    const searchTerm = document.getElementById('product-search').value.toLowerCase().trim();
    
    // Get the products table body
    const productsTableBody = document.getElementById('products-tbody');
    if (!productsTableBody) return;
    
    // Get all group header rows
    const groupHeaders = productsTableBody.querySelectorAll('.group-header');
    
    groupHeaders.forEach(header => {
        let hasVisibleItems = false;
        
        // Get the next sibling row (the child container)
        const nextRow = header.nextElementSibling;
        if (nextRow && nextRow.id && nextRow.id.startsWith('group-')) {
            const childRows = nextRow.querySelectorAll('tr');
            
            childRows.forEach(childRow => {
                const rowText = childRow.textContent.toLowerCase();
                
                // Check both warehouse filter and search term
                let shouldShow = true;
                
                // Apply warehouse filter
                if (warehouseFilter && !rowText.includes(warehouseFilter.toLowerCase())) {
                    shouldShow = false;
                }
                
                // Apply search filter
                if (searchTerm && !rowText.includes(searchTerm)) {
                    shouldShow = false;
                }
                
                if (shouldShow) {
                    childRow.style.display = '';
                    hasVisibleItems = true;
                } else {
                    childRow.style.display = 'none';
                }
            });
            
            // Show/hide the entire group based on whether there are visible items
            if (hasVisibleItems) {
                header.style.display = '';
                nextRow.style.display = '';
            } else {
                header.style.display = 'none';
                nextRow.style.display = 'none';
            }
        }
    });
    
    // Update no products message
    const noProductsMsg = document.getElementById('no-products-message');
    if (noProductsMsg) {
        const visibleGroups = Array.from(groupHeaders).filter(g => g.style.display !== 'none');
        if (visibleGroups.length === 0 && products.length > 0) {
            noProductsMsg.textContent = 'No products match your filter';
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
        case 'auth/user-disabled':
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
    link.setAttribute('download', 'products_export.csv');
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
    document.getElementById('tab-sales-accounts').classList.remove('active');
    document.getElementById('tab-deletions').classList.remove('active');
    document.getElementById('tab-modifications').classList.remove('active');
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Show/hide content
    document.getElementById('transfers-content').style.display = tab === 'transfers' ? 'block' : 'none';
    document.getElementById('sales-content').style.display = tab === 'sales' ? 'block' : 'none';
    document.getElementById('sales-accounts-content').style.display = tab === 'sales-accounts' ? 'block' : 'none';
    document.getElementById('deletions-content').style.display = tab === 'deletions' ? 'block' : 'none';
    document.getElementById('modifications-content').style.display = tab === 'modifications' ? 'block' : 'none';
    
    // Load data for sales accounts tab when clicked
    if (tab === 'sales-accounts') {
        renderSalesAccountsTable();
    }
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
                    <button class="action-btn" style="background: #25D366; color: white; padding: 5px 10px; font-size: 11px;"
                        onclick="sendSingleTransferToWhatsApp('${transfer.id}')">📤</button>
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
        
        // Get unique product names for display
        const productNames = sale.items && sale.items.length > 0 
            ? [...new Set(sale.items.map(item => item.name))].join('، ')
            : '-';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${sale.customerName}</td>
                <td>${productNames}</td>
                <td>${sale.itemCount}</td>
                <td style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${sale.items ? sale.items.map(i => i.serialNumber).join(', ') : '-'}</td>
                <td>${sale.price || '-'}</td>
                <td>${date}<br><small style="color: #999;">${time}</small></td>
                <td>${getArabicWarehouseName(sale.warehouse)}</td>
                <td>
                    <button class="action-btn" style="background: #25D366; color: white; padding: 5px 10px; font-size: 11px;" 
onclick="sendSingleSaleToWhatsApp('${sale.id}')">📤</button>
                </td>
                <td>
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
    const productNames = sale.items && sale.items.length > 0
        ? [...new Set(sale.items.map(item => item.name))].join('، ')
        : '-';
    
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
<p><strong>اسم المنتج:</strong> <span class="product-name">${productNames}</span></p>
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
    
    // Create a simple modal for history with Send to WhatsApp button
    const modalHtml = `
        <div id="customer-history-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 700px;">
                <span class="close" onclick="document.getElementById('customer-history-modal').remove()">&times;</span>
                <h2>Customer Purchase History</h2>
                <button onclick="sendCustomerSalesToWhatsApp('${escapeHtml(customerName)}')" style="background: #25D366; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; margin-bottom: 15px;">
                    📤 Send to WhatsApp
                </button>
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

// Send customer sales to WhatsApp
function sendCustomerSalesToWhatsApp(customerName) {
    const customerData = getCustomerHistory(customerName);
    
    if (!customerData || !customerData.purchaseHistory || customerData.purchaseHistory.length === 0) {
        alert('No purchase history found for this customer');
        return;
    }
    
    // Check if WhatsApp settings are configured
    const savedSettings = localStorage.getItem('whatsappSettings');
    let whatsappSettings = null;
    
    if (savedSettings) {
        try {
            whatsappSettings = JSON.parse(savedSettings);
        } catch (e) {
            console.error('Error parsing WhatsApp settings:', e);
        }
    }
    
    if (!whatsappSettings || !whatsappSettings.token || !whatsappSettings.phoneId || !whatsappSettings.recipientPhone) {
        alert('WhatsApp is not configured. Please configure your WhatsApp settings first.');
        return;
    }
    
    // Format the message for this customer's sales
    const message = formatCustomerSalesForWhatsApp(customerData);
    
    // Clean phone number
    const cleanRecipient = whatsappSettings.recipientPhone.replace(/\D/g, '');
    
    console.log('Sending WhatsApp message for customer:', customerName);
    console.log('Phone ID:', whatsappSettings.phoneId);
    console.log('Recipient:', cleanRecipient);
    
    fetch(`https://graph.facebook.com/v22.0/${whatsappSettings.phoneId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${whatsappSettings.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanRecipient,
            type: "text",
            text: { body: message }
        })
    })
    .then(response => response.json())
    .then(result => {
        console.log('WhatsApp API Response:', result);
        
        if (!result.error) {
            alert('✅ Customer sales sent successfully to WhatsApp!');
        } else {
            const errorMsg = result.error?.message || 'Unknown error';
            alert('❌ Failed to send message: ' + errorMsg);
        }
    })
    .catch(error => {
        console.error('Error sending to WhatsApp:', error);
        alert('❌ Network error occurred: ' + error.message);
    });
}

// Format customer sales data for WhatsApp message
function formatCustomerSalesForWhatsApp(customerData) {
    let message = '';
    
    // Get unique products with quantities from all purchases
    const productCounts = {};
    let totalAmount = 0;
    
    if (customerData.purchaseHistory && customerData.purchaseHistory.length > 0) {
        customerData.purchaseHistory.forEach(purchase => {
            // Sum up the price/amount
            if (purchase.price) {
                totalAmount += parseFloat(purchase.price);
            }
            
            // Count products
            if (purchase.items && purchase.items.length > 0) {
                purchase.items.forEach(item => {
                    const key = item.name || 'Unknown';
                    if (productCounts[key]) {
                        productCounts[key]++;
                    } else {
                        productCounts[key] = 1;
                    }
                });
            }
        });
    }
    
    // Format products with quantity
    if (Object.keys(productCounts).length > 0) {
        Object.entries(productCounts).forEach(([name, qty]) => {
            message += `${name} / Quantity: ${qty}\n`;
        });
    }
    
    // Add customer name
    message += `${customerData.name}\n`;
    
    // Add total amount
    if (totalAmount > 0) {
        message += `${totalAmount}`;
    }
    
    return message;
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
        const productNames = sale.items && sale.items.length > 0
            ? [...new Set(sale.items.map(item => item.name))].join('، ')
            : '-';
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
    link.setAttribute('download', 'sales_export.csv');
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
    link.setAttribute('download', 'transfers_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Send All Transfers Report to WhatsApp
function sendAllTransfersToWhatsApp() {
    if (transfers.length === 0) {
        alert('No transfers data to send');
        return;
    }
    
    // Check if WhatsApp settings are configured
    const savedSettings = localStorage.getItem('whatsappSettings');
    let whatsappSettings = null;
    
    if (savedSettings) {
        whatsappSettings = JSON.parse(savedSettings);
    }
    
    if (!whatsappSettings || !whatsappSettings.token || !whatsappSettings.phoneId || !whatsappSettings.recipientPhone) {
        alert('WhatsApp is not configured. Please configure your WhatsApp settings first.');
        return;
    }
    
    // Format transfers data for WhatsApp
    const message = formatAllTransfersForWhatsApp(transfers);
    
    // Clean phone number
    const cleanRecipient = whatsappSettings.recipientPhone.replace(/\D/g, '');
    
    console.log('Sending WhatsApp message...');
    console.log('Phone ID:', whatsappSettings.phoneId);
    console.log('Recipient:', cleanRecipient);
    
    fetch(`https://graph.facebook.com/v22.0/${whatsappSettings.phoneId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${whatsappSettings.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanRecipient,
            type: "text",
            text: { body: message }
        })
    })
    .then(response => response.json())
    .then(result => {
        console.log('WhatsApp API Response:', result);
        
        if (!result.error) {
            alert('✅ Transfers report sent successfully to WhatsApp!');
        } else {
            const errorMsg = result.error?.message || 'Unknown error';
            alert('❌ Failed to send message: ' + errorMsg);
        }
    })
    .catch(error => {
        console.error('Error sending to WhatsApp:', error);
        alert('❌ Network error occurred: ' + error.message);
    });
}

// Format all transfers data for WhatsApp message
function formatAllTransfersForWhatsApp(transfersData) {
    let message = '';
    
    let totalItems = 0;
    
    transfersData.forEach((transfer, index) => {
        const items = transfer.itemCount || 1;
        totalItems += items;
        
        // Format: from warehouse to warehouse
        message += `من ${getArabicWarehouseName(transfer.fromWarehouse)} إلى ${getArabicWarehouseName(transfer.toWarehouse)}\n`;
        
        // Get unique products with quantities
        if (transfer.items && transfer.items.length > 0) {
            const productCounts = {};
            transfer.items.forEach(item => {
                const name = item.name || 'Unknown';
                if (productCounts[name]) {
                    productCounts[name]++;
                } else {
                    productCounts[name] = 1;
                }
            });
            
            // Format each product with quantity
            Object.entries(productCounts).forEach(([name, qty]) => {
                message += `${name} / Quantity: ${qty}\n`;
            });
        }
        
        message += '\n';
    });
    
    return message;
}

// Send All Sales Report to WhatsApp
function sendAllSalesToWhatsApp() {
    if (sales.length === 0) {
        alert('No sales data to send');
        return;
    }
    
    // First, open the Activities modal with Sales tab to show the data
    openActivitiesModal();
    switchActivityTab('sales');
    
    // Show a confirmation dialog after showing the data
    setTimeout(() => {
        const confirmSend = confirm(`📊 Sales Report Ready!\n\nTotal sales: ${sales.length}\n\nClick OK to send to WhatsApp, or Cancel to view the data first.`);
        
        if (confirmSend) {
            // Use the saved WhatsApp settings from localStorage
            const savedSettings = localStorage.getItem('whatsappSettings');
            let whatsappSettings = null;
            
            if (savedSettings) {
                whatsappSettings = JSON.parse(savedSettings);
            }
            
            if (!whatsappSettings || !whatsappSettings.token || !whatsappSettings.phoneId || !whatsappSettings.recipientPhone) {
                // Show WhatsApp configuration modal if settings are not saved
                showWhatsAppSendModal();
                return;
            }
            
            // Send directly using saved settings
            sendSalesToWhatsAppWithSettings(whatsappSettings);
        }
    }, 500);
}

// Helper function to clean phone number - removes all non-digit characters
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    // Remove all non-digit characters but keep leading +
    let cleaned = phone.replace(/\D/g, '');
    return cleaned;
}

// Send sales with settings
async function sendSalesToWhatsAppWithSettings(whatsappSettings) {
    // Validate settings first
    const validationError = validateWhatsAppSettings(whatsappSettings);
    if (validationError) {
        alert(validationError);
        showWhatsAppSendModal();
        return;
    }
    
    // Format sales data for WhatsApp
    const message = formatSalesForWhatsApp(sales);
    
    // Clean phone number - ensure it's just digits
    const cleanRecipient = cleanPhoneNumber(whatsappSettings.recipientPhone);
    
    // Validate phone number has at least 10 digits
    if (cleanRecipient.length < 10) {
        alert('❌ Invalid recipient phone number. Please check your WhatsApp settings.\n\nPhone must have at least 10 digits with country code.');
        return;
    }
    
    console.log('Sending WhatsApp message...');
    console.log('Phone ID:', whatsappSettings.phoneId);
    console.log('Recipient:', cleanRecipient);
    console.log('Message length:', message.length);
    
    try {
        const response = await fetch(`https://graph.facebook.com/v22.0/${whatsappSettings.phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${whatsappSettings.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: cleanRecipient,
                type: "text",
                text: { body: message }
            })
        });
        
        const result = await response.json();
        console.log('WhatsApp API Response:', result);
        
        if (response.ok && !result.error) {
            alert('✅ Sales report sent successfully to WhatsApp!');
        } else {
            // Handle specific error cases
            const errorMsg = result.error?.message || 'Unknown error';
            console.error('WhatsApp API Error:', errorMsg);
            
            let userFriendlyMessage = '❌ Failed to send message to WhatsApp.\n\n';
            userFriendlyMessage += 'Error: ' + errorMsg + '\n\n';
            
            // Provide specific guidance based on error
            if (errorMsg.includes('Invalid OAuth access token') || errorMsg.includes('Invalid token')) {
                userFriendlyMessage += '🔧 Solution: Your Access Token is invalid or expired.\n';
                userFriendlyMessage += '• Go to Facebook Developers Portal > WhatsApp > Configuration\n';
                userFriendlyMessage += '• Generate a new Access Token\n';
                userFriendlyMessage += '• Update your settings with the new token';
            } else if (errorMsg.includes('Recipient phone number not in allowed list')) {
                userFriendlyMessage += '🔧 Solution: The recipient phone number is not in the allowed list.\n';
                userFriendlyMessage += '• Go to Facebook Developers Portal > Your App > WhatsApp > Configuration\n';
                userFriendlyMessage += '• Under "Test Numbers", add this phone number: ' + whatsappSettings.recipientPhone + '\n';
                userFriendlyMessage += '• Or verify your business phone number';
            } else if (errorMsg.includes('Parameter must be an array')) {
                userFriendlyMessage += '🔧 Solution: There was an issue with the message format. Please try again.';
            } else {
                userFriendlyMessage += 'Please check your WhatsApp settings and try again.';
            }
            
            alert(userFriendlyMessage);
        }
    } catch (error) {
        console.error('Error sending to WhatsApp:', error);
        alert('❌ Network error occurred while sending to WhatsApp.\n\n' +
              'Please check your internet connection and try again.\n\n' +
              'Error details: ' + error.message);
    }
}

// Show WhatsApp configuration modal for sending
function showWhatsAppSendModal() {
    // First check if WhatsApp settings are saved
    const savedSettings = localStorage.getItem('whatsappSettings');
    let prefillToken = '';
    let prefillPhoneId = '';
    let prefillRecipient = '+201060133529'; // Default value
    
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            prefillToken = settings.token || '';
            prefillPhoneId = settings.phoneId || '';
            prefillRecipient = settings.recipientPhone || '+201060133529';
        } catch (e) {
            console.error('Error parsing saved settings:', e);
        }
    }
    
    const modalHtml = `
        <div id="whatsapp-send-modal" class="modal" style="display: block; z-index: 10000;">
            <div class="modal-content" style="max-width: 450px; margin: 10px auto; width: 90%;">
                <span class="close" onclick="closeModal('whatsapp-send-modal')">&times;</span>
                <h2>💬 إرسال إلى WhatsApp</h2>
                <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
                    أدخل بيانات WhatsApp لإرسال تقرير المبيعات.
                </p>
                <form id="whatsapp-send-form" onsubmit="event.preventDefault();">
                    <div class="form-group">
                        <label for="whatsapp-send-recipient" style="font-weight: bold; color: #333;">
                            📱 رقم الهاتف <span style="color: red;">*</span>
                        </label>
                        <input type="tel" id="whatsapp-send-recipient" 
                               placeholder="مثال: +201060133529" 
                               value="${prefillRecipient}"
                               style="font-size: 16px; padding: 12px; border: 2px solid #25D366; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required autocomplete="tel">
                        <small style="color: #666; font-size: 11px;">أدخل رقم الهاتف مع رمز الدولة</small>
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-send-token" style="font-weight: bold; color: #333;">
                            🔑 رمز الوصول (Token) <span style="color: red;">*</span>
                        </label>
                        <input type="text" id="whatsapp-send-token" 
                               placeholder="أدخل رمز الوصول" 
                               value="${prefillToken}"
                               style="font-size: 14px; padding: 12px; border: 1px solid #ddd; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-send-phone-id" style="font-weight: bold; color: #333;">
                            📞 رقم الهاتف ID <span style="color: red;">*</span>
                        </label>
                        <input type="text" id="whatsapp-send-phone-id" 
                               placeholder="أدخل رقم الهاتف ID" 
                               value="${prefillPhoneId}"
                               style="font-size: 14px; padding: 12px; border: 1px solid #ddd; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="whatsapp-save-settings" ${savedSettings ? 'checked' : ''}>
                            <span>حفظ البيانات للاستخدام المستقبلي</span>
                        </label>
                    </div>
                    <button type="button" id="whatsapp-send-submit" class="btn" style="background: #25D366; color: white; width: 100%; padding: 14px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold; touch-action: manipulation;" onclick="submitWhatsAppAllSales()">
                        📤 إرسال تقرير (${sales.length} مبيعات)
                    </button>
                    <div id="all-sales-status" style="margin-top: 10px; text-align: center; display: none;"></div>
                </form>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('whatsapp-send-modal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Focus on first input for mobile
    setTimeout(() => {
        const recipientInput = document.getElementById('whatsapp-send-recipient');
        if (recipientInput) {
            recipientInput.focus();
        }
    }, 300);
}

// Submit function for all sales WhatsApp
async function submitWhatsAppAllSales() {
    const token = document.getElementById('whatsapp-send-token').value;
    const phoneId = document.getElementById('whatsapp-send-phone-id').value;
    const recipient = document.getElementById('whatsapp-send-recipient').value;
    const saveSettings = document.getElementById('whatsapp-save-settings').checked;
    
    // Clear previous status
    const statusEl = document.getElementById('all-sales-status');
    if (statusEl) {
        statusEl.style.display = 'none';
    }
    
    // Validate inputs with clear error messages
    if (!token || !token.trim()) {
        updateAllSalesStatus('❌ Please enter your Access Token', true);
        document.getElementById('whatsapp-send-token').focus();
        return;
    }
    if (!phoneId || !phoneId.trim()) {
        updateAllSalesStatus('❌ Please enter your Phone Number ID', true);
        document.getElementById('whatsapp-send-phone-id').focus();
        return;
    }
    if (!recipient || !recipient.trim()) {
        updateAllSalesStatus('❌ Please enter the recipient phone number', true);
        document.getElementById('whatsapp-send-recipient').focus();
        return;
    }
    
    // Validate phone number format
    const cleanPhone = recipient.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        updateAllSalesStatus('❌ Invalid phone number. Must be at least 10 digits with country code', true);
        return;
    }
    
    // Save settings if checkbox is checked
    if (saveSettings) {
        const settings = {
            token: token,
            phoneId: phoneId,
            recipientPhone: recipient,
            enableTransfers: true,
            enableSales: true
        };
        localStorage.setItem('whatsappSettings', JSON.stringify(settings));
    }
    
    // Show loading
    const submitBtn = document.getElementById('whatsapp-send-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ جاري الإرسال...';
    submitBtn.disabled = true;
    
    // Update status
    updateAllSalesStatus('⏳ جاري الإرسال... يرجى الانتظار...', false);
    
    try {
        // Format sales data for WhatsApp
        const message = formatSalesForWhatsApp(sales);

        // Send to WhatsApp API
        const response = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: cleanPhone,
                type: "text",
                text: { body: message }
            })
        });

        const result = await response.json();
        
        console.log('WhatsApp API Response:', result);

        if (response.ok && !result.error) {
            updateAllSalesStatus('✅ تم الإرسال بنجاح!', false);
            alert('✅ Sales report sent successfully to WhatsApp!');
            closeModal('whatsapp-send-modal');
        } else {
            const errorMsg = result.error?.message || 'Unknown error';
            let userFriendlyMessage = '❌ Failed to send message to WhatsApp.\n\n';
            userFriendlyMessage += 'Error: ' + errorMsg + '\n\n';
            
            if (errorMsg.includes('Invalid OAuth access token') || errorMsg.includes('Invalid token')) {
                userFriendlyMessage += '🔧 الحل: رمز الوصول غير صالح أو منتهي الصلاحية.\n';
                userFriendlyMessage += '• اذهب إلى Facebook Developers Portal > WhatsApp > Configuration\n';
                userFriendlyMessage += '• أنشئ رمز وصول جديد';
            } else if (errorMsg.includes('Recipient phone number not in allowed list')) {
                userFriendlyMessage += '🔧 الحل: رقم الهاتف غير مسموح به.\n';
                userFriendlyMessage += '• أضف هذا الرقم إلى Test Numbers';
            } else {
                userFriendlyMessage += 'يرجى التحقق من إعدادات WhatsApp والمحاولة مرة أخرى.';
            }
            
            updateAllSalesStatus('❌ ' + errorMsg, true);
            alert(userFriendlyMessage);
        }
    } catch (error) {
        console.error('Error sending to WhatsApp:', error);
        
        // Check network status
        if (!navigator.onLine) {
            updateAllSalesStatus('❌ لا يوجد اتصال بالإنترنت', true);
            alert('❌ لا يوجد اتصال بالإنترنت.\nتحقق من اتصالك وحاول مرة أخرى.');
        } else {
            updateAllSalesStatus('❌ خطأ في الشبكة: ' + error.message, true);
            alert('❌ Network error occurred while sending to WhatsApp.\n\n' +
                  'Please check your internet connection and try again.\n\n' +
                  'Error details: ' + error.message + '\n\n' +
                  '🔧 Things to try:\n' +
                  '1. Check your internet connection\n' +
                  '2. Verify your WhatsApp settings are correct\n' +
                  '3. Wait a moment and try again');
        }
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Update status for all sales
function updateAllSalesStatus(message, isError) {
    const statusEl = document.getElementById('all-sales-status');
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? '#dc3545' : '#28a745';
        statusEl.style.padding = '10px';
        statusEl.style.borderRadius = '5px';
        statusEl.style.backgroundColor = isError ? '#f8d7da' : '#d4edda';
        statusEl.textContent = message;
    }
}

// Format sales data for WhatsApp message
// New format: Customer Name, Product Name (warehouse), Number of products
function formatSalesForWhatsApp(salesData) {
    let message = '📊 تقرير المبيعات\n\n';
    
    let totalItems = 0;
    
    // Process each sale - show customer name, products with warehouse, quantity
    salesData.forEach((sale, index) => {
        const items = sale.itemCount || 1;
        totalItems += items;
        
        // Get unique products with warehouse info
        const productDetails = sale.items && sale.items.length > 0
            ? [...new Set(sale.items.map(item => item.name + ' (' + getArabicWarehouseName(item.warehouse || sale.warehouse) + ')'))].join('، ')
            : '-';
        
        // Format: Customer Name, Product Name (warehouse), Number taken
        message += `${index + 1}. 👤 ${sale.customerName}\n`;
        message += `   📦 ${productDetails}\n`;
        message += `   🔢 العدد: ${items}\n`;
        
        if (sale.price) {
            message += `   💰 السعر: ${sale.price}$\n`;
        }
        
        message += '\n';
    });
    
    message += '----------------------\n';
    message += `📈 الإجمالي: ${totalItems} صنف`;
    
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
    link.setAttribute('download', 'database_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`✅ Export completed!\n\nData exported:\n- Products: ${products.length}\n- Transfers: ${transfers.length}\n- Sales: ${sales.length}\n- Deletions: ${deletions.length}\n- Modifications: ${modifications.length}\n- Customers: ${customersArray.length}`);

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

// ============================================
// AI ASSISTANT FUNCTIONS
// ============================================

// Google Gemini API Key - globally accessible
var GEMINI_API_KEY = 'AIzaSyBfz7JdE5gm1mh3xVNl2bxaEEAwuclThxo';

// Open AI Assistant Modal
function openAIAssistant() {
    openModal('ai-assistant-modal');
    // Clear previous messages and show welcome message
    document.getElementById('ai-messages').innerHTML = `
        <div style="display: flex; gap: 12px; margin-bottom: 15px;">
            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                🤖
            </div>
            <div style="background: var(--bg-elevated); padding: 12px 16px; border-radius: 12px; border-top-left-radius: 4px; max-width: 80%;">
                <p style="margin: 0; color: var(--text-primary); font-size: 14px;">
                    Hello! I'm your AI Assistant. I can help you with:
                </p>
                <ul style="margin: 8px 0 0 0; padding-left: 18px; color: var(--text-secondary); font-size: 13px;">
                    <li>Inventory summary and statistics</li>
                    <li>Product information and details</li>
                    <li>Sales and transfer analysis</li>
                    <li>General questions</li>
                </ul>
            </div>
        </div>
    `;
}

// Make function globally accessible
window.openAIAssistant = openAIAssistant;

// Handle Enter key in AI input
function handleAIKeyPress(event) {
    if (event.key === 'Enter') {
        sendAIPrompt();
    }
}

// Send prompt to AI
async function sendAIPrompt() {
    const input = document.getElementById('ai-prompt-input');
    const prompt = input.value.trim();

    if (!prompt) return;

    // Add user message to chat
    addUserMessage(prompt);
    input.value = '';

    // Show loading
    showAILoading(true);

    try {
        // First, check if it's a data-related question
        const dataResponse = await getDataBasedResponse(prompt);

        if (dataResponse) {
            // Use data-based response
            addAIMessage(dataResponse);
        } else {
            // Use Gemini API for general questions
            const aiResponse = await callGeminiAPI(prompt);
            addAIMessage(aiResponse);
        }
    } catch (error) {
        console.error('AI Error:', error);
        addAIMessage('Sorry, I encountered an error. Please try again.');
    }

    showAILoading(false);
}

// Quick action button handler
function askAIQuick(prompt) {
    document.getElementById('ai-prompt-input').value = prompt;
    sendAIPrompt();
}

// Add user message to chat
function addUserMessage(message) {
    const messagesContainer = document.getElementById('ai-messages');
    const messageHtml = `
        <div style="display: flex; gap: 12px; margin-bottom: 15px; flex-direction: row-reverse;">
            <div style="width: 36px; height: 36px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                👤
            </div>
            <div style="background: var(--primary); padding: 12px 16px; border-radius: 12px; border-top-right-radius: 4px; max-width: 80%;">
                <p style="margin: 0; color: var(--bg-dark); font-size: 14px;">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollAIChatToBottom();
}

// Add AI message to chat
function addAIMessage(message) {
    const messagesContainer = document.getElementById('ai-messages');
    const messageHtml = `
        <div style="display: flex; gap: 12px; margin-bottom: 15px;">
            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6, #a855f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                🤖
            </div>
            <div style="background: var(--bg-elevated); padding: 12px 16px; border-radius: 12px; border-top-left-radius: 4px; max-width: 80%;">
                <p style="margin: 0; color: var(--text-primary); font-size: 14px; white-space: pre-wrap;">${message}</p>
            </div>
        </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollAIChatToBottom();
}

// Scroll chat to bottom
function scrollAIChatToBottom() {
    const chatDisplay = document.getElementById('ai-chat-display');
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Show/hide loading indicator
function showAILoading(show) {
    document.getElementById('ai-loading').style.display = show ? 'block' : 'none';
    if (show) {
        scrollAIChatToBottom();
    }
}

// Call Gemini API
async function callGeminiAPI(prompt) {
    const context = buildProductContext();
    
    const fullPrompt = `You are a helpful AI assistant for a Product Management System. 
Current inventory data:
${context}

User question: ${prompt}

Please provide a helpful, concise response. If the question is about the inventory data, use the data provided above.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullPrompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            throw new Error('API request failed');
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return 'I apologize, but I could not generate a response. Please try again.';
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return 'Sorry, I encountered an error while processing your request. Please check your internet connection and try again.';
    }
}

// Build product context from current data
function buildProductContext() {
    let context = 'No products in inventory.\n';
    
    if (products.length > 0) {
        // Group by warehouse
        const warehouses = {};
        products.forEach(p => {
            if (!warehouses[p.warehouse]) {
                warehouses[p.warehouse] = [];
            }
            warehouses[p.warehouse].push(p);
        });
        
        context = `Total Products: ${products.length}\n\n`;
        context += `By Warehouse:\n`;
        
        Object.keys(warehouses).forEach(wh => {
            context += `- ${wh}: ${warehouses[wh].length} products\n`;
        });
        
        context += `\nRecent Products (first 10):\n`;
        products.slice(0, 10).forEach(p => {
            context += `- ${p.serialNumber}: ${p.name} (${p.warehouse})\n`;
        });
    }
    
    // Add sales info
    if (sales.length > 0) {
        context += `\nTotal Sales: ${sales.length}\n`;
        const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
        context += `Total Revenue: ${totalRevenue}\n`;
        
        // Recent sales
        context += `\nRecent Sales (last 5):\n`;
        sales.slice(0, 5).forEach(s => {
            context += `- ${s.customerName}: ${s.itemCount} items - ${s.price || 'N/A'}\n`;
        });
    }
    
    return context;
}

// Get data-based response for specific queries
async function getDataBasedResponse(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Inventory summary
    if (lowerPrompt.includes('inventory') || lowerPrompt.includes('stock') || lowerPrompt.includes('summary')) {
        return getInventorySummary();
    }
    
    // Low stock products
    if (lowerPrompt.includes('low stock') || lowerPrompt.includes('running out')) {
        return getLowStockProducts();
    }
    
    // Recent sales
    if (lowerPrompt.includes('sale') && (lowerPrompt.includes('recent') || lowerPrompt.includes('last') || lowerPrompt.includes('today'))) {
        return getRecentSales();
    }
    
    // Warehouse info
    if (lowerPrompt.includes('warehouse') || lowerPrompt.includes('فيصل') || lowerPrompt.includes('البيني') || lowerPrompt.includes('باب الوق')) {
        return getWarehouseInfo();
    }
    
    // Total products
    if (lowerPrompt.includes('total product') || lowerPrompt.includes('how many product')) {
        return `You have ${products.length} products in your inventory.`;
    }
    
    return null;
}

// Get inventory summary
function getInventorySummary() {
    if (products.length === 0) {
        return 'Your inventory is currently empty. Add some products to get started!';
    }
    
    const warehouses = {};
    products.forEach(p => {
        if (!warehouses[p.warehouse]) {
            warehouses[p.warehouse] = 0;
        }
        warehouses[p.warehouse]++;
    });
    
    let response = '📊 **Inventory Summary**\n\n';
    response += `Total Products: ${products.length}\n\n`;
    response += 'By Warehouse:\n';
    
    Object.keys(warehouses).forEach(wh => {
        response += `- ${wh}: ${warehouses[wh]} products\n`;
    });
    
    // Group by product name
    const productNames = {};
    products.forEach(p => {
        if (!productNames[p.name]) {
            productNames[p.name] = 0;
        }
        productNames[p.name]++;
    });
    
    response += '\nBy Product Type:\n';
    Object.keys(productNames).forEach(name => {
        response += `- ${name}: ${productNames[name]}\n`;
    });
    
    return response;
}

// Get low stock products (assuming single item is low)
function getLowStockProducts() {
    // Since all products are individual, let's find products with unique names that have few items
    const productNames = {};
    products.forEach(p => {
        if (!productNames[p.name]) {
            productNames[p.name] = 0;
        }
        productNames[p.name]++;
    });
    
    const lowStock = Object.entries(productNames).filter(([name, count]) => count <= 3);
    
    if (lowStock.length === 0) {
        return 'All products have good stock levels!';
    }
    
    let response = '⚠️ **Low Stock Products**\n\n';
    lowStock.forEach(([name, count]) => {
        response += `- ${name}: only ${count} item(s) left\n`;
    });
    
    return response;
}

// Get recent sales
function getRecentSales() {
    if (sales.length === 0) {
        return 'No sales have been recorded yet.';
    }
    
    const recentSales = sales.slice(0, 10);
    
    let response = '💰 **Recent Sales**\n\n';
    
    recentSales.forEach((sale, index) => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        response += `${index + 1}. ${sale.customerName}\n`;
        response += `   Items: ${sale.itemCount} | Price: ${sale.price || 'N/A'} | Date: ${date}\n`;
    });
    
    return response;
}

// Get warehouse information
function getWarehouseInfo() {
    const warehouses = {};
    products.forEach(p => {
        if (!warehouses[p.warehouse]) {
            warehouses[p.warehouse] = { count: 0, products: [] };
        }
        warehouses[p.warehouse].count++;
        warehouses[p.warehouse].products.push(p.name);
    });
    
    let response = '🏭 **Warehouse Information**\n\n';
    
    Object.keys(warehouses).forEach(wh => {
        response += `**${wh}**: ${warehouses[wh].count} products\n`;
    });
    
    return response;
}

// ============================================
// AI COMMAND EXECUTION SYSTEM
// ============================================

// Pending operation waiting for user confirmation
let pendingAIOperation = null;

// Parse user command to detect operations
function parseUserCommand(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check for transfer operation keywords
    const transferKeywords = ['move', 'transfer', 'نقل', 'تحويل', 'transport', 'نقل من', 'تحويل من'];
    const hasTransferKeyword = transferKeywords.some(kw => lowerPrompt.includes(kw));
    
    // Check for delete operation keywords
    const deleteKeywords = ['delete', 'remove', 'حذف', 'مسح', 'remove all', 'delete all', 'حذف الكل'];
    const hasDeleteKeyword = deleteKeywords.some(kw => lowerPrompt.includes(kw));
    
    // Check for add operation keywords
    const addKeywords = ['add', 'create', 'إضافة', 'إضافة منتج', 'add product', 'create product', 'أضف'];
    const hasAddKeyword = addKeywords.some(kw => lowerPrompt.includes(kw));
    
    // Check for sell operation keywords
    const sellKeywords = ['sell', 'sale', 'بيع', 'بيعت', 'selling'];
    const hasSellKeyword = sellKeywords.some(kw => lowerPrompt.includes(kw));
    
    // Parse transfer operation
    if (hasTransferKeyword) {
        return parseTransferCommand(prompt);
    }
    
    // Parse delete operation
    if (hasDeleteKeyword) {
        return parseDeleteCommand(prompt);
    }
    
    // Parse add operation
    if (hasAddKeyword) {
        return parseAddCommand(prompt);
    }
    
    // Parse sell operation
    if (hasSellKeyword) {
        return parseSellCommand(prompt);
    }
    
    return null;
}

// Parse transfer command
function parseTransferCommand(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Extract warehouses
    let fromWarehouse = null;
    let toWarehouse = null;
    
    // Arabic warehouse names
    if (lowerPrompt.includes('فيصل')) fromWarehouse = 'فيصل';
    else if (lowerPrompt.includes('البيني')) fromWarehouse = 'البيني';
    else if (lowerPrompt.includes('باب الوق') || lowerPrompt.includes('بابوق')) fromWarehouse = 'باب الوق';
    
    // To warehouse
    if (lowerPrompt.includes('إلى فيصل') || lowerPrompt.includes('لفيصل') || lowerPrompt.includes('to faisal')) toWarehouse = 'فيصل';
    else if (lowerPrompt.includes('إلى البيني') || lowerPrompt.includes('للبيني') || lowerPrompt.includes('to bini') || lowerPrompt.includes('to al-bini')) toWarehouse = 'البيني';
    else if (lowerPrompt.includes('إلى باب الوق') || lowerPrompt.includes('لباب الوق') || lowerPrompt.includes('to downtown') || lowerPrompt.includes('to bab')) toWarehouse = 'باب الوق';
    
    // Extract product name or serial number pattern
    let productName = null;
    let serialPattern = null;
    
    // Check for specific product name patterns
    const namePatterns = ['12/100', '12/80', '15kw', '10kw', '5kw', 'solar', 'inverter', 'panel'];
    for (const name of namePatterns) {
        if (lowerPrompt.includes(name)) {
            productName = name;
            break;
        }
    }
    
    // Check for serial number patterns (e.g., "from serial 100 to 200")
    const serialMatch = prompt.match(/(?:serial|from|من)\s*(\d+)\s*(?:to|-|إلى)\s*(\d+)/i);
    if (serialMatch) {
        serialPattern = { from: parseInt(serialMatch[1], 10), to: parseInt(serialMatch[2], 10) };
    }
    
    // If fromWarehouse not detected but toWarehouse is, try to infer from context
    if (!fromWarehouse && toWarehouse) {
        // Look for other warehouse mentions as source
        if (toWarehouse !== 'فيصل' && lowerPrompt.includes('فيصل')) fromWarehouse = 'فيصل';
        else if (toWarehouse !== 'البيني' && lowerPrompt.includes('البيني')) fromWarehouse = 'البيني';
        else if (toWarehouse !== 'باب الوق' && lowerPrompt.includes('باب الوق')) fromWarehouse = 'باب الوق';
    }
    
    if (fromWarehouse && toWarehouse) {
        return {
            type: 'transfer',
            fromWarehouse: fromWarehouse,
            toWarehouse: toWarehouse,
            productName: productName,
            serialPattern: serialPattern,
            description: prompt
        };
    }
    
    return null;
}

// Parse delete command
function parseDeleteCommand(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    let productName = null;
    let deleteAll = false;
    
    // Check for "delete all" pattern
    if (lowerPrompt.includes('all') || lowerPrompt.includes('الكل') || lowerPrompt.includes('everything')) {
        deleteAll = true;
    }
    
    // Extract product name
    const namePatterns = ['12/100', '12/80', '15kw', '10kw', '5kw', 'solar', 'inverter', 'panel'];
    for (const name of namePatterns) {
        if (lowerPrompt.includes(name)) {
            productName = name;
            break;
        }
    }
    
    // If no specific name found, try to extract any product-like text
    if (!productName && !deleteAll) {
        const words = prompt.split(' ');
        for (let i = words.length - 1; i >= 0; i--) {
            const word = words[i].toLowerCase().replace(/[^\w]/g, '');
            if (word.length > 2 && !['delete', 'remove', 'حذف', 'مسح', 'the', 'all', 'الكل'].includes(word)) {
                productName = word;
                break;
            }
        }
    }
    
    // Check for serial number pattern
    const serialMatch = prompt.match(/(?:serial|رقم)\s*[:=]?\s*([A-Z0-9]+)/i);
    let serialNumber = serialMatch ? serialMatch[1] : null;
    
    return {
        type: 'delete',
        productName: productName,
        serialNumber: serialNumber,
        deleteAll: deleteAll,
        description: prompt
    };
}

// Parse add command
function parseAddCommand(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    let productName = null;
    let quantity = 1;
    let warehouse = null;
    let serialFrom = null;
    let serialTo = null;
    
    // Extract quantity
    const quantityMatch = prompt.match(/(\d+)\s*(?:items?|products?|صنف|قطعة|وحدة)/i);
    if (quantityMatch) {
        quantity = parseInt(quantityMatch[1], 10);
    } else {
        // Check for number range pattern
        const rangeMatch = prompt.match(/(?:from|من)\s*(\d+)\s*(?:to|-|إلى)\s*(\d+)/i);
        if (rangeMatch) {
            serialFrom = parseInt(rangeMatch[1], 10);
            serialTo = parseInt(rangeMatch[2], 10);
            quantity = serialTo - serialFrom + 1;
        }
    }
    
    // Extract warehouse
    if (lowerPrompt.includes('فيصل')) warehouse = 'فيصل';
    else if (lowerPrompt.includes('البيني')) warehouse = 'البيني';
    else if (lowerPrompt.includes('باب الوق') || lowerPrompt.includes('بابوق')) warehouse = 'باب الوق';
    
    // Extract product name
    const namePatterns = [
        { pattern: '12/100', name: '12/100' },
        { pattern: '12/80', name: '12/80' },
        { pattern: '15kw', name: '15kw' },
        { pattern: '10kw', name: '10kw' },
        { pattern: '5kw', name: '5kw' }
    ];
    for (const np of namePatterns) {
        if (lowerPrompt.includes(np.pattern)) {
            productName = np.name;
            break;
        }
    }
    
    if (!productName) {
        // Try to find any alphanumeric product code
        const codeMatch = prompt.match(/([A-Z0-9]{5,})/i);
        if (codeMatch) {
            productName = codeMatch[1];
        }
    }
    
    if (productName && (warehouse || quantity > 0)) {
        return {
            type: 'add',
            productName: productName,
            quantity: quantity,
            warehouse: warehouse,
            serialFrom: serialFrom,
            serialTo: serialTo,
            description: prompt
        };
    }
    
    return null;
}

// Parse sell command
function parseSellCommand(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    let customerName = null;
    let productName = null;
    let quantity = 1;
    let price = null;
    let warehouse = null;
    
    // Extract customer name (look for "to customer X" or "for customer X")
    const customerMatch = prompt.match(/(?:to|for|ل|إلى|بيع إلى)\s+([A-Za-z\u0600-\u06FF\s]+?)(?:\s+(?:at|with|price|بسعر|$))/i);
    if (customerMatch) {
        customerName = customerMatch[1].trim();
    }
    
    // Extract quantity
    const quantityMatch = prompt.match(/(\d+)\s*(?:items?|products?|صنف|قطعة|وحدة)/i);
    if (quantityMatch) {
        quantity = parseInt(quantityMatch[1], 10);
    }
    
    // Extract price
    const priceMatch = prompt.match(/(?:price|بسعر|سعر|harga)\s*[:=]?\s*([\d.]+)/i);
    if (priceMatch) {
        price = parseFloat(priceMatch[1]);
    }
    
    // Extract product name
    const namePatterns = ['12/100', '12/80', '15kw', '10kw', '5kw', 'solar', 'inverter', 'panel'];
    for (const name of namePatterns) {
        if (lowerPrompt.includes(name)) {
            productName = name;
            break;
        }
    }
    
    // Extract warehouse
    if (lowerPrompt.includes('فيصل')) warehouse = 'فيصل';
    else if (lowerPrompt.includes('البيني')) warehouse = 'البيني';
    else if (lowerPrompt.includes('باب الوق') || lowerPrompt.includes('بابوق')) warehouse = 'باب الوق';
    
    if (customerName || productName) {
        return {
            type: 'sell',
            customerName: customerName,
            productName: productName,
            quantity: quantity,
            price: price,
            warehouse: warehouse,
            description: prompt
        };
    }
    
    return null;
}

// Validate transfer operation
function validateTransferOperation(operation) {
    const warnings = [];
    const errors = [];
    
    // Check if source and destination are different
    if (operation.fromWarehouse === operation.toWarehouse) {
        errors.push('Source and destination warehouses are the same.');
    }
    
    // Find matching products
    let matchingProducts = [];
    if (operation.productName) {
        matchingProducts = products.filter(p => 
            p.name && p.name.toLowerCase().includes(operation.productName.toLowerCase()) &&
            p.warehouse === operation.fromWarehouse
        );
    } else if (operation.serialPattern) {
        matchingProducts = products.filter(p => 
            p.warehouse === operation.fromWarehouse &&
            p.fromSerial >= operation.serialPattern.from &&
            p.toSerial <= operation.serialPattern.to
        );
    } else {
        // Transfer all products from source warehouse
        matchingProducts = products.filter(p => p.warehouse === operation.fromWarehouse);
    }
    
    if (matchingProducts.length === 0) {
        errors.push(`No products found in ${operation.fromWarehouse} matching the criteria.`);
    }
    
    if (matchingProducts.length > 100) {
        warnings.push(`You are about to transfer ${matchingProducts.length} products. This is a large batch.`);
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        products: matchingProducts
    };
}

// Validate delete operation
function validateDeleteOperation(operation) {
    const warnings = [];
    const errors = [];
    
    let matchingProducts = [];
    
    if (operation.serialNumber) {
        matchingProducts = products.filter(p => p.serialNumber === operation.serialNumber);
    } else if (operation.productName) {
        matchingProducts = products.filter(p => 
            p.name && p.name.toLowerCase() === operation.productName.toLowerCase()
        );
    } else if (operation.deleteAll) {
        matchingProducts = products;
        warnings.push('This will delete ALL products in your inventory. This action cannot be undone!');
    }
    
    if (matchingProducts.length === 0) {
        errors.push('No products found matching the criteria.');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        products: matchingProducts
    };
}

// Validate add operation
function validateAddOperation(operation) {
    const warnings = [];
    const errors = [];
    
    if (!operation.productName) {
        errors.push('Product name is required.');
    }
    
    if (!operation.warehouse) {
        warnings.push('No warehouse specified. You will need to select a warehouse.');
    }
    
    if (operation.quantity > 1000) {
        errors.push('Maximum 1000 products allowed at once.');
    }
    
    // Check for potential duplicates
    const existingProducts = products.filter(p => 
        p.name && p.name.toLowerCase() === operation.productName.toLowerCase() &&
        p.warehouse === operation.warehouse
    );
    
    if (existingProducts.length > 0) {
        warnings.push(`There are already ${existingProducts.length} products with name "${operation.productName}" in ${operation.warehouse}.`);
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}

// Validate sell operation
function validateSellOperation(operation) {
    const warnings = [];
    const errors = [];
    
    if (!operation.customerName) {
        errors.push('Customer name is required.');
    }
    
    let matchingProducts = [];
    if (operation.productName && operation.warehouse) {
        matchingProducts = products.filter(p => 
            p.name && p.name.toLowerCase().includes(operation.productName.toLowerCase()) &&
            p.warehouse === operation.warehouse
        );
    } else if (operation.warehouse) {
        matchingProducts = products.filter(p => p.warehouse === operation.warehouse);
    }
    
    if (matchingProducts.length === 0) {
        errors.push('No products available for sale in the specified warehouse.');
    }
    
    if (operation.quantity > matchingProducts.length) {
        errors.push(`Requested quantity (${operation.quantity}) exceeds available products (${matchingProducts.length}).`);
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
        availableProducts: matchingProducts
    };
}

// Create operation confirmation message
function createConfirmationMessage(operation, validation, products) {
    let message = '';
    
    if (operation.type === 'transfer') {
        message = '📦 **Transfer Operation Detected**\n\n';
        message += `**From:** ${operation.fromWarehouse}\n`;
        message += `**To:** ${operation.toWarehouse}\n`;
        message += `**Products to transfer:** ${products.length}\n\n`;
    } else if (operation.type === 'delete') {
        message = '🗑️ **Delete Operation Detected**\n\n';
        message += `**Products to delete:** ${products.length}\n`;
        if (operation.productName) {
            message += `**Product name:** ${operation.productName}\n`;
        }
        if (operation.serialNumber) {
            message += `**Serial number:** ${operation.serialNumber}\n`;
        }
        message += '\n⚠️ **This action cannot be undone!**\n\n';
    } else if (operation.type === 'add') {
        message = '➕ **Add Product Operation**\n\n';
        message += `**Product name:** ${operation.productName}\n`;
        message += `**Quantity:** ${operation.quantity}\n`;
        if (operation.warehouse) {
            message += `**Warehouse:** ${operation.warehouse}\n`;
        }
        message += '\n';
    } else if (operation.type === 'sell') {
        message = '💰 **Sell Operation Detected**\n\n';
        message += `**Customer:** ${operation.customerName}\n`;
        message += `**Quantity:** ${operation.quantity}\n`;
        if (operation.price) {
            message += `**Price:** ${operation.price}\n`;
        }
        if (operation.warehouse) {
            message += `**Warehouse:** ${operation.warehouse}\n`;
        }
        message += '\n';
    }
    
    // Add warnings
    if (validation.warnings && validation.warnings.length > 0) {
        message += '⚠️ **Warnings:**\n';
        validation.warnings.forEach(w => {
            message += `- ${w}\n`;
        });
        message += '\n';
    }
    
    // Add errors
    if (validation.errors && validation.errors.length > 0) {
        message += '❌ **Errors:**\n';
        validation.errors.forEach(e => {
            message += `- ${e}\n`;
        });
        message += '\n';
    }
    
    // Add confirmation request
    message += '❓ **Do you want to proceed with this operation?**\n\n';
    message += 'Reply with:\n';
    message += '• **YES** or **نعم** - to confirm and execute\n';
    message += '• **NO** or **لا** - to cancel';
    
    return message;
}

// Execute transfer operation
async function executeTransferOperation(productsToTransfer, fromWarehouse, toWarehouse) {
    const userId = auth.currentUser.uid;
    const transferDate = new Date().toISOString();
    
    try {
        // Create transfer record
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
        
        // Update products
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        
        for (const product of productsToTransfer) {
            updates[product.id + '/warehouse'] = toWarehouse;
            updates[product.id + '/transferredAt'] = transferDate;
        }
        
        await productsRef.update(updates);
        
        // Send WhatsApp notification
        await sendTransferWhatsAppNotification({
            fromWarehouse: fromWarehouse,
            toWarehouse: toWarehouse,
            itemCount: productsToTransfer.length,
            items: productsToTransfer.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name
            })),
            transferredAt: transferDate
        });
        
        // Auto-save
        autoSaveToLocalStorage();
        
        return { success: true, message: `Successfully transferred ${productsToTransfer.length} products from ${fromWarehouse} to ${toWarehouse}.` };
    } catch (error) {
        console.error('Error executing transfer:', error);
        return { success: false, message: 'Error executing transfer: ' + error.message };
    }
}

// Execute delete operation
async function executeDeleteOperation(productsToDelete) {
    const userId = auth.currentUser.uid;
    
    try {
        // Record deletions first
        for (const product of productsToDelete) {
            const deletionRef = database.ref('deletions/' + userId).push();
            await deletionRef.set({
                serialNumber: product.serialNumber,
                productName: product.name,
                warehouse: product.warehouse,
                deletedAt: new Date().toISOString()
            });
        }
        
        // Delete products
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        
        for (const product of productsToDelete) {
            updates[product.id] = null;
        }
        
        await productsRef.update(updates);
        
        // Auto-save
        autoSaveToLocalStorage();
        
        return { success: true, message: `Successfully deleted ${productsToDelete.length} products.` };
    } catch (error) {
        console.error('Error executing delete:', error);
        return { success: false, message: 'Error executing delete: ' + error.message };
    }
}

// Execute add operation
async function executeAddOperation(operation) {
    const userId = auth.currentUser.uid;
    const serialPrefix = 'PCD0401TR25';
    
    // Need warehouse from user - return message asking for it
    if (!operation.warehouse) {
        return { 
            success: false, 
            needsInput: true,
            message: 'Please specify the warehouse for the new products. Available warehouses: فيصل, البيني, باب الوق' 
        };
    }
    
    try {
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        const quantity = operation.quantity || 1;
        
        // Determine serial range
        const fromSerial = operation.serialFrom || 1;
        const toSerial = operation.serialTo || quantity;
        
        for (let i = fromSerial; i <= toSerial; i++) {
            const serialNum = (100000 + i).toString();
            const uniqueSerial = `${serialPrefix}10${serialNum}`;
            const newKey = productsRef.push().key;
            
            updates[newKey] = {
                serialNumber: uniqueSerial,
                name: operation.productName,
                warehouse: operation.warehouse,
                fromSerial: i,
                toSerial: i,
                quantity: 1,
                createdAt: new Date().toISOString()
            };
        }
        
        await productsRef.update(updates);
        
        // Auto-save
        autoSaveToLocalStorage();
        
        return { success: true, message: `Successfully added ${toSerial - fromSerial + 1} products to ${operation.warehouse}.` };
    } catch (error) {
        console.error('Error executing add:', error);
        return { success: false, message: 'Error adding products: ' + error.message };
    }
}

// Execute sell operation
async function executeSellOperation(operation, productsToSell) {
    const userId = auth.currentUser.uid;
    const releaseDate = new Date().toISOString().split('T')[0];
    
    try {
        // Create sale record
        const saleRef = database.ref('sales/' + userId).push();
        await saleRef.set({
            customerName: operation.customerName,
            items: productsToSell.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name,
                warehouse: p.warehouse
            })),
            itemCount: productsToSell.length,
            warehouse: productsToSell[0]?.warehouse,
            description: '',
            price: operation.price || 0,
            releaseDate: releaseDate,
            soldAt: new Date().toISOString()
        });
        
        // Delete sold products
        const productsRef = database.ref('products/' + userId);
        const updates = {};
        
        for (const product of productsToSell) {
            updates[product.id] = null;
        }
        
        await productsRef.update(updates);
        
        // Update customer history
        await updateCustomerHistory(operation.customerName, {
            id: saleRef.key,
            items: productsToSell.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name,
                warehouse: p.warehouse
            })),
            itemCount: productsToSell.length,
            warehouse: productsToSell[0]?.warehouse,
            price: operation.price || 0,
            releaseDate: releaseDate,
            soldAt: new Date().toISOString()
        });
        
        // Send WhatsApp notification
        await sendSaleWhatsAppNotification({
            customerName: operation.customerName,
            warehouse: productsToSell[0]?.warehouse,
            itemCount: productsToSell.length,
            price: operation.price,
            description: '',
            releaseDate: releaseDate,
            items: productsToSell.map(p => ({
                serialNumber: p.serialNumber,
                name: p.name
            })),
            soldAt: new Date().toISOString()
        });
        
        // Auto-save
        autoSaveToLocalStorage();
        
        return { success: true, message: `Successfully sold ${productsToSell.length} products to ${operation.customerName}.` };
    } catch (error) {
        console.error('Error executing sell:', error);
        return { success: false, message: 'Error executing sale: ' + error.message };
    }
}

// Handle AI command detection in getDataBasedResponse
function checkForCommands(prompt) {
    // First check if this is a confirmation response
    const lowerPrompt = prompt.toLowerCase();
    
    if (pendingAIOperation) {
        // Check for yes confirmation
        if (lowerPrompt.includes('yes') || lowerPrompt.includes('نعم') || lowerPrompt.includes('ok') || 
            lowerPrompt.includes('confirm') || lowerPrompt.includes('تأكيد')) {
            return handleOperationConfirmation();
        }
        
        // Check for no/cancel
        if (lowerPrompt.includes('no') || lowerPrompt.includes('لا') || lowerPrompt.includes('cancel') || 
            lowerPrompt.includes('إلغاء') || lowerPrompt.includes('الغاء')) {
            pendingAIOperation = null;
            return 'Operation cancelled. Is there anything else I can help you with?';
        }
    }
    
    // Parse for new command
    const operation = parseUserCommand(prompt);
    
    if (!operation) {
        return null; // Not a command, let regular AI handle it
    }
    
    // Validate the operation
    let validation = null;
    let products = [];
    
    switch (operation.type) {
        case 'transfer':
            validation = validateTransferOperation(operation);
            products = validation.products || [];
            break;
        case 'delete':
            validation = validateDeleteOperation(operation);
            products = validation.products || [];
            break;
        case 'add':
            validation = validateAddOperation(operation);
            break;
        case 'sell':
            validation = validateSellOperation(operation);
            products = validation.availableProducts || [];
            break;
    }
    
    if (validation.errors && validation.errors.length > 0) {
        let errorMessage = '❌ **Operation Cannot Proceed**\n\n';
        validation.errors.forEach(e => {
            errorMessage += `- ${e}\n`;
        });
        errorMessage += '\nPlease check your request and try again.';
        return errorMessage;
    }
    
    // Store pending operation
    pendingAIOperation = {
        operation: operation,
        validation: validation,
        products: products
    };
    
    // Return confirmation message
    return createConfirmationMessage(operation, validation, products);
}

// Handle operation confirmation
async function handleOperationConfirmation() {
    if (!pendingAIOperation) {
        return 'No pending operation to confirm.';
    }
    
    const { operation, products } = pendingAIOperation;
    let result;
    
    switch (operation.type) {
        case 'transfer':
            result = await executeTransferOperation(products, operation.fromWarehouse, operation.toWarehouse);
            break;
        case 'delete':
            result = await executeDeleteOperation(products);
            break;
        case 'add':
            result = await executeAddOperation(operation);
            break;
        case 'sell':
            // For sell, we need to select the first N products
            const productsToSell = products.slice(0, operation.quantity);
            result = await executeSellOperation(operation, productsToSell);
            break;
    }
    
    pendingAIOperation = null;
    
    if (result.success) {
        return `✅ **Operation Completed Successfully!**\n\n${result.message}\n\nIs there anything else I can help you with?`;
    } else if (result.needsInput) {
        pendingAIOperation = { operation: operation, validation: {}, products: [] };
        return result.message;
    } else {
        return `❌ **Operation Failed**\n\n${result.message}\n\nPlease try again or contact support.`;
    }
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

// ============================================
// SALES ACCOUNTS FUNCTIONS
// ============================================

// Render Sales Accounts Table with customer name repeated for each transaction
function renderSalesAccountsTable() {
    const tbody = document.getElementById('sales-accounts-tbody');
    const noDataMsg = document.getElementById('no-sales-accounts-message');
    const customerFilter = document.getElementById('sales-accounts-customer-filter');
    
    if (!tbody) return;
    
    // Get filter value
    const filterValue = customerFilter ? customerFilter.value : '';
    
    // Filter sales if needed
    let filteredSales = sales;
    if (filterValue) {
        filteredSales = sales.filter(s => s.customerName && s.customerName.toLowerCase() === filterValue.toLowerCase());
    }
    
    // Sort by date (newest first) then by customer name
    filteredSales.sort((a, b) => {
        const dateA = new Date(a.releaseDate || 0);
        const dateB = new Date(b.releaseDate || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (a.customerName || '').localeCompare(b.customerName || '');
    });
    
    if (filteredSales.length === 0) {
        tbody.innerHTML = '';
        if (noDataMsg) noDataMsg.style.display = 'block';
        return;
    }
    
    if (noDataMsg) noDataMsg.style.display = 'none';
    
    // Populate customer dropdown
    if (customerFilter) {
        const uniqueCustomers = [...new Set(sales.map(s => s.customerName).filter(Boolean))].sort();
        customerFilter.innerHTML = '<option value="">All Customers</option>';
        uniqueCustomers.forEach(customer => {
            customerFilter.innerHTML += `<option value="${customer}" ${customer === filterValue ? 'selected' : ''}>${customer}</option>`;
        });
    }
    
    // Render the table - each sale on its own row with customer name repeated
    tbody.innerHTML = filteredSales.map((sale, index) => {
        const date = sale.releaseDate ? new Date(sale.releaseDate).toLocaleDateString('ar-SA') : '-';
        
        // Get unique product names for display
        const productNames = sale.items && sale.items.length > 0 
            ? [...new Set(sale.items.map(item => item.name))].join('، ')
            : '-';
        
        // Get all serial numbers
        const serialNumbers = sale.items ? sale.items.map(i => i.serialNumber).join(', ') : '-';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td style="font-weight: 500;">${sale.customerName || '-'}</td>
                <td>${productNames}</td>
                <td>${sale.itemCount}</td>
                <td style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${serialNumbers}</td>
                <td>${sale.price || '-'}</td>
                <td>${date}</td>
                <td>${getArabicWarehouseName(sale.warehouse)}</td>
            </tr>
        `;
    }).join('');
}

// Filter sales accounts by customer
function filterSalesAccountsByCustomer() {
    renderSalesAccountsTable();
}

// Export Sales Accounts to Excel with merged cells for same customer/date
function exportSalesAccountsToExcel() {
    if (sales.length === 0) {
        alert('No sales data to export');
        return;
    }
    
    // Sort by date (newest first) then by customer name
    const sortedSales = [...sales].sort((a, b) => {
        const dateA = new Date(a.releaseDate || 0);
        const dateB = new Date(b.releaseDate || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (a.customerName || '').localeCompare(b.customerName || '');
    });
    
    // Create CSV content
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += 'م,اسم العميل,اسم المنتج,العدد,السعر,التاريخ,المستودع,ارقام المسلسلات\n';
    
    sortedSales.forEach((sale, index) => {
        const date = sale.releaseDate ? new Date(sale.releaseDate).toLocaleDateString('ar-SA') : '-';
        
        // Get unique product names for display
        const productNames = sale.items && sale.items.length > 0
            ? [...new Set(sale.items.map(item => item.name))].join(' - ')
            : '-';
        
        // Get all serial numbers
        const serialNumbers = sale.items ? sale.items.map(i => i.serialNumber).join(' - ') : '-';
        
        const row = [
            index + 1,
            sale.customerName || '-',
            productNames,
            sale.itemCount || 0,
            sale.price || '0',
            date,
            getArabicWarehouseName(sale.warehouse) || '-',
            serialNumbers
        ];
        
        // Escape any commas in the data
        csvContent += row.map(cell => {
            const cellStr = String(cell);
            return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') 
                ? `"${cellStr.replace(/"/g, '""')}"` 
                : cellStr;
        }).join(',') + '\n';
    });
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'sales_accounts_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// CUSTOMER FILTER AND EXPORT FUNCTIONS
// ============================================

// Filter sales by customer in Sales tab
function filterSalesByCustomer() {
    const filterValue = document.getElementById('sales-customer-filter').value;
    const tbody = document.getElementById('sales-tbody');
    
    if (!tbody) return;
    
    // Filter sales
    let filteredSales = sales;
    if (filterValue) {
        filteredSales = sales.filter(s => s.customerName && s.customerName.toLowerCase() === filterValue.toLowerCase());
    }
    
    // Sort by date descending
    filteredSales.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    
    if (filteredSales.length === 0) {
        tbody.innerHTML = '';
        document.getElementById('no-sales-message').style.display = 'block';
        return;
    }
    
    document.getElementById('no-sales-message').style.display = 'none';
    
    // Populate customer dropdown
    const customerFilter = document.getElementById('sales-customer-filter');
    if (customerFilter) {
        const uniqueCustomers = [...new Set(sales.map(s => s.customerName).filter(Boolean))].sort();
        customerFilter.innerHTML = '<option value="">All Customers</option>';
        uniqueCustomers.forEach(customer => {
            customerFilter.innerHTML += `<option value="${customer}" ${customer === filterValue ? 'selected' : ''}>${customer}</option>`;
        });
    }
    
    // Render the filtered table
    tbody.innerHTML = filteredSales.map((sale, index) => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        const time = sale.soldAt ? new Date(sale.soldAt).toLocaleTimeString('ar-SA') : '';
        
        // Get unique product names for display
        const productNames = sale.items && sale.items.length > 0 
            ? [...new Set(sale.items.map(item => item.name))].join('، ')
            : '-';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${sale.customerName}</td>
                <td>${productNames}</td>
                <td>${sale.itemCount}</td>
                <td style="font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${sale.items ? sale.items.map(i => i.serialNumber).join(', ') : '-'}</td>
                <td>${sale.price || '-'}</td>
                <td>${date}<br><small style="color: #999;">${time}</small></td>
                <td>${getArabicWarehouseName(sale.warehouse)}</td>
                <td>
                    <button class="action-btn" style="background: #25D366; color: white; padding: 5px 10px; font-size: 11px;" 
onclick="sendSingleSaleToWhatsApp('${sale.id}')">📤</button>
                </td>
                <td>
                    <button class="action-btn" style="background: #ffc107; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="editSale('${sale.id}')">✏️</button>
                    <button class="action-btn" style="background: #dc3545; color: white; padding: 5px 10px; font-size: 11px;" 
                        onclick="deleteSale('${sale.id}')">🗑</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Export filtered sales (by selected customer) to Excel
function exportFilteredSalesToExcel() {
    const filterValue = document.getElementById('sales-customer-filter').value;
    
    // Filter sales
    let filteredSales = sales;
    if (filterValue) {
        filteredSales = sales.filter(s => s.customerName && s.customerName.toLowerCase() === filterValue.toLowerCase());
    }
    
    if (filteredSales.length === 0) {
        alert('No sales data to export');
        return;
    }
    
    // Sort by date descending
    filteredSales.sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0));
    
    // Create CSV content
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += 'م,#عميل,العدد,الاسعار,التاريخ,المستودع,ارقام المسلسلات\n';
    
    filteredSales.forEach((sale, index) => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        const productNames = sale.items && sale.items.length > 0
            ? [...new Set(sale.items.map(item => item.name))].join(' - ')
            : '-';
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
        
        // Escape any commas
        csvContent += row.map(cell => String(cell).includes(',') ? `"${cell}"` : cell).join(',') + '\n';
    });
    
    // Create filename with customer name if filtered
    const filename = filterValue ? `sales_${filterValue.replace(/[^a-zA-Z0-9]/g, '_')}_export.csv` : 'sales_export.csv';

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Make AI functions globally accessible
window.handleAIKeyPress = handleAIKeyPress;
window.askAIQuick = askAIQuick;
window.sendAIPrompt = sendAIPrompt;
}