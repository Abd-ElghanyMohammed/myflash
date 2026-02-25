// Send Single Sale to WhatsApp - Updated with better mobile support and error handling
function sendSingleSaleToWhatsApp(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
        alert('Sale not found');
        return;
    }
    
    // Always show the phone input modal to allow entering any phone number
    showWhatsAppSendSingleModal(saleId);
}

// Alternative function that can be called directly with phone number (for better mobile support)
function sendSingleSaleToWhatsAppDirect(saleId, phone, token, phoneId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
        alert('Sale not found');
        return;
    }
    
    if (!phone || !token || !phoneId) {
        // Show the modal instead
        showWhatsAppSendSingleModal(saleId);
        return;
    }
    
    // Send directly
    const whatsappSettings = {
        token: token,
        phoneId: phoneId,
        recipientPhone: phone
    };
    
    sendSingleSaleToWhatsAppWithSettings(sale, whatsappSettings);
}

// Validate WhatsApp settings with clear error messages
function validateWhatsAppSettings(settings) {
    if (!settings) {
        return 'WhatsApp settings not found. Please configure your settings.';
    }
    if (!settings.token || settings.token.trim() === '') {
        return 'Access Token is missing. Please enter your WhatsApp Access Token.';
    }
    if (!settings.phoneId || settings.phoneId.trim() === '') {
        return 'Phone Number ID is missing. Please enter your Phone Number ID.';
    }
    if (!settings.recipientPhone || settings.recipientPhone.trim() === '') {
        return 'Recipient Phone is missing. Please enter the recipient phone number.';
    }
    
    // Validate phone format
    const cleanPhone = settings.recipientPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        return 'Invalid phone number. Please enter a valid phone number with country code (e.g., +201060133529).';
    }
    
    return null; // No errors
}

// Send single sale with settings - improved error handling
async function sendSingleSaleToWhatsAppWithSettings(sale, whatsappSettings) {
    // Validate settings first
    const validationError = validateWhatsAppSettings(whatsappSettings);
    if (validationError) {
        alert(validationError);
        return false;
    }
    
    // Format single sale data for WhatsApp
    const message = formatSingleSaleForWhatsApp(sale);
    
    // Clean phone number - ensure it's just digits
    const cleanRecipient = whatsappSettings.recipientPhone.replace(/\D/g, '');
    
    console.log('Sending WhatsApp message...');
    console.log('Phone ID:', whatsappSettings.phoneId);
    console.log('Recipient:', cleanRecipient);
    
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
            alert('✅ Sale sent successfully to WhatsApp!');
            return true;
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
            return false;
        }
    } catch (error) {
        console.error('Error sending to WhatsApp:', error);
        
        // Check for network error
        if (!navigator.onLine) {
            alert('❌ لا يوجد اتصال بالإنترنت.\nPlease check your internet connection and try again.');
        } else {
            alert('❌ Network error occurred while sending to WhatsApp.\n\n' +
                  'Please check your internet connection and try again.\n\n' +
                  'Error details: ' + error.message + '\n\n' +
                  '🔧 Try:\n' +
                  '1. Check your internet connection\n' +
                  '2. Verify your WhatsApp settings are correct\n' +
                  '3. Try again in a few moments');
        }
        return false;
    }
}

// Show WhatsApp configuration modal for sending single sale - Updated with better mobile support
function showWhatsAppSendSingleModal(saleId) {
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    // First check if WhatsApp settings are saved
    const savedSettings = localStorage.getItem('whatsappSettings');
    let prefillToken = '';
    let prefillPhoneId = '';
    let prefillRecipient = '';
    
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            prefillToken = settings.token || '';
            prefillPhoneId = settings.phoneId || '';
            prefillRecipient = settings.recipientPhone || '';
        } catch (e) {
            console.error('Error parsing saved settings:', e);
        }
    }
    
    const modalHtml = `
        <div id="whatsapp-send-single-modal" class="modal" style="display: block; z-index: 10000;">
            <div class="modal-content" style="max-width: 450px; margin: 10px auto; width: 90%;">
                <span class="close" onclick="closeModal('whatsapp-send-single-modal')">&times;</span>
                <h2>WhatsApp - إرسال تقرير البيع</h2>
                <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
                    أدخل رقم الهاتف وبيانات WhatsApp لإرسال تقرير البيع.
                </p>
                <form id="whatsapp-send-single-form" onsubmit="event.preventDefault();">
                    <input type="hidden" id="whatsapp-send-single-sale-id" value="${saleId}">
                    <div class="form-group">
                        <label for="whatsapp-send-single-recipient" style="font-weight: bold; color: #333;">
                            📱 رقم الهاتف <span style="color: red;">*</span>
                        </label>
                        <input type="tel" id="whatsapp-send-single-recipient" 
                               placeholder="مثال: +201060133529" 
                               value="${prefillRecipient}"
                               style="font-size: 16px; padding: 12px; border: 2px solid #25D366; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required autocomplete="tel">
                        <small style="color: #666; font-size: 11px;">أدخل رقم الهاتف مع رمز الدولة</small>
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-send-single-token" style="font-weight: bold; color: #333;">
                            🔑 رمز الوصول (Token) <span style="color: red;">*</span>
                        </label>
                        <input type="text" id="whatsapp-send-single-token" 
                               placeholder="أدخل رمز الوصول" 
                               value="${prefillToken}"
                               style="font-size: 14px; padding: 12px; border: 1px solid #ddd; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-send-single-phone-id" style="font-weight: bold; color: #333;">
                            📞 رقم الهاتف ID <span style="color: red;">*</span>
                        </label>
                        <input type="text" id="whatsapp-send-single-phone-id" 
                               placeholder="أدخل رقم الهاتف ID" 
                               value="${prefillPhoneId}"
                               style="font-size: 14px; padding: 12px; border: 1px solid #ddd; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="whatsapp-save-single-settings" ${savedSettings ? 'checked' : ''}>
                            <span>حفظ البيانات للاستخدام المستقبلي</span>
                        </label>
                    </div>
                    <button type="button" id="whatsapp-send-single-submit" class="btn" style="background: #25D366; color: white; width: 100%; padding: 14px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; touch-action: manipulation; font-weight: bold;" onclick="submitWhatsAppSingleSale()">
                        📤 إرسال إلى WhatsApp
                    </button>
                    <div id="single-sale-status" style="margin-top: 10px; text-align: center; display: none;"></div>
                </form>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('whatsapp-send-single-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Focus on first input for mobile
    setTimeout(() => {
        const recipientInput = document.getElementById('whatsapp-send-single-recipient');
        if (recipientInput) {
            recipientInput.focus();
        }
    }, 300);
}

// Update status message
function updateStatus(elementId, message, isError) {
    const statusEl = document.getElementById(elementId);
    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.style.color = isError ? '#dc3545' : '#28a745';
        statusEl.style.padding = '10px';
        statusEl.style.borderRadius = '5px';
        statusEl.style.backgroundColor = isError ? '#f8d7da' : '#d4edda';
        statusEl.textContent = message;
    }
}

// Submit function for single sale WhatsApp - called by button
async function submitWhatsAppSingleSale() {
    const saleId = document.getElementById('whatsapp-send-single-sale-id').value;
    const token = document.getElementById('whatsapp-send-single-token').value;
    const phoneId = document.getElementById('whatsapp-send-single-phone-id').value;
    const recipient = document.getElementById('whatsapp-send-single-recipient').value;
    const saveSettings = document.getElementById('whatsapp-save-single-settings').checked;
    
    const sale = sales.find(s => s.id === saleId);
    if (!sale) {
        alert('Sale not found');
        return;
    }
    
    // Clear previous status
    updateStatus('single-sale-status', '', false);
    
    // Validate inputs with clear error messages
    if (!token || !token.trim()) {
        updateStatus('single-sale-status', '❌ Please enter your Access Token', true);
        document.getElementById('whatsapp-send-single-token').focus();
        return;
    }
    if (!phoneId || !phoneId.trim()) {
        updateStatus('single-sale-status', '❌ Please enter your Phone Number ID', true);
        document.getElementById('whatsapp-send-single-phone-id').focus();
        return;
    }
    if (!recipient || !recipient.trim()) {
        updateStatus('single-sale-status', '❌ Please enter the recipient phone number', true);
        document.getElementById('whatsapp-send-single-recipient').focus();
        return;
    }
    
    // Validate phone number format
    const cleanPhone = recipient.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        updateStatus('single-sale-status', '❌ Invalid phone number. Must be at least 10 digits with country code', true);
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
    const submitBtn = document.getElementById('whatsapp-send-single-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ جاري الإرسال...';
    submitBtn.disabled = true;
    
    // Update status
    updateStatus('single-sale-status', '⏳ جاري الإرسال... يرجى الانتظار...', false);
    
    try {
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
                text: { body: formatSingleSaleForWhatsApp(sale) }
            })
        });
        
        const result = await response.json();
        console.log('WhatsApp API Response:', result);
        
        if (response.ok && !result.error) {
            updateStatus('single-sale-status', '✅ تم الإرسال بنجاح!', false);
            alert('✅ Sale sent successfully to WhatsApp!');
            closeModal('whatsapp-send-single-modal');
        } else {
            // Handle specific error cases
            const errorMsg = result.error?.message || 'Unknown error';
            let userFriendlyMessage = '❌ Failed to send message to WhatsApp.\n\n';
            userFriendlyMessage += 'Error: ' + errorMsg + '\n\n';
            
            // Provide specific guidance based on error
            if (errorMsg.includes('Invalid OAuth access token') || errorMsg.includes('Invalid token')) {
                userFriendlyMessage += '🔧 الحل: رمز الوصول غير صالح أو منتهي الصلاحية.\n';
                userFriendlyMessage += '• اذهب إلى Facebook Developers Portal > WhatsApp > Configuration\n';
                userFriendlyMessage += '• أنشئ رمز وصول جديد\n';
                userFriendlyMessage += '•حدث الإعدادات برمز جديد';
            } else if (errorMsg.includes('Recipient phone number not in allowed list')) {
                userFriendlyMessage += '🔧 الحل: رقم الهاتف غير مسموح به.\n';
                userFriendlyMessage += '• أضف هذا الرقم إلى Test Numbers\n';
                userFriendlyMessage += '• أو تحقق من رقم هاتف العمل';
            } else {
                userFriendlyMessage += 'يرجى التحقق من إعدادات WhatsApp والمحاولة مرة أخرى.';
            }
            
            updateStatus('single-sale-status', '❌ ' + errorMsg, true);
            alert(userFriendlyMessage);
        }
    } catch (error) {
        console.error('Error sending to WhatsApp:', error);
        
        // Check network status
        if (!navigator.onLine) {
            updateStatus('single-sale-status', '❌ لا يوجد اتصال بالإنترنت', true);
            alert('❌ لا يوجد اتصال بالإنترنت.\nتحقق من اتصالك وحاول مرة أخرى.');
        } else {
            updateStatus('single-sale-status', '❌ خطأ في الشبكة: ' + error.message, true);
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

// Format single sale data for WhatsApp message
// New format: Product Name / Quantity: X, Customer name, Amount
function formatSingleSaleForWhatsApp(sale) {
    // Get unique products with their quantities
    const productCounts = {};
    if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
            const key = item.name || 'Unknown';
            if (productCounts[key]) {
                productCounts[key]++;
            } else {
                productCounts[key] = 1;
            }
        });
    }
    
    let message = '';
    
    // Format products with quantity (e.g., "Quantity: 4 / Soswi 18.5")
    if (Object.keys(productCounts).length > 0) {
        Object.entries(productCounts).forEach(([name, qty]) => {
            // Format: Quantity: X / ProductName
            message += `Quantity: ${qty} / ${name}\n`;
        });
    } else {
        message += '-\n';
    }
    
    // Add customer name
    message += `${sale.customerName}\n`;
    
    // Add amount if available (without "Amount" label, just the number)
    if (sale.price) {
        message += `${sale.price}`;
    }
    
    return message;
}

