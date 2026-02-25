// Send Single Transfer to WhatsApp - Updated with better mobile support and error handling
function sendSingleTransferToWhatsApp(transferId) {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) {
        alert('Transfer not found');
        return;
    }
    
    // Always show the phone input modal to allow entering any phone number
    showWhatsAppSendSingleTransferModal(transferId);
}

// Alternative function that can be called directly with phone number
function sendSingleTransferToWhatsAppDirect(transferId, phone, token, phoneId) {
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) {
        alert('Transfer not found');
        return;
    }
    
    if (!phone || !token || !phoneId) {
        showWhatsAppSendSingleTransferModal(transferId);
        return;
    }
    
    const whatsappSettings = {
        token: token,
        phoneId: phoneId,
        recipientPhone: phone
    };
    
    sendSingleTransferToWhatsAppWithSettings(transfer, whatsappSettings);
}

function validateWhatsAppTransferSettings(settings) {
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
    
    const cleanPhone = settings.recipientPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        return 'Invalid phone number. Please enter a valid phone number with country code (e.g., +201060133529).';
    }
    
    return null;
}

async function sendSingleTransferToWhatsAppWithSettings(transfer, whatsappSettings) {
    // Validate settings first
    const validationError = validateWhatsAppTransferSettings(whatsappSettings);
    if (validationError) {
        alert(validationError);
        return false;
    }
    
    const message = formatSingleTransferForWhatsApp(transfer);
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
        
        if (response.ok && !result.error) {
            alert('✅ Transfer sent successfully to WhatsApp!');
            return true;
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
            
            alert(userFriendlyMessage);
            return false;
        }
    } catch (error) {
        console.error('Error sending to WhatsApp:', error);
        
        if (!navigator.onLine) {
            alert('❌ لا يوجد اتصال بالإنترنت.\nتحقق من اتصالك وحاول مرة أخرى.');
        } else {
            alert('❌ Network error occurred while sending to WhatsApp.\n\n' +
                  'Please check your internet connection and try again.\n\n' +
                  'Error details: ' + error.message);
        }
        return false;
    }
}

function formatSingleTransferForWhatsApp(transfer) {
    let message = '';
    
    const productCounts = {};
    if (transfer.items && transfer.items.length > 0) {
        transfer.items.forEach(item => {
            const key = item.name || 'Unknown';
            if (productCounts[key]) {
                productCounts[key]++;
            } else {
                productCounts[key] = 1;
            }
        });
    }
    
    if (Object.keys(productCounts).length > 0) {
        Object.entries(productCounts).forEach(([name, qty]) => {
            message += `Quantity: ${qty} / ${name}\n`;
        });
    } else {
        message += '-\n';
    }
    
    message += `${getArabicWarehouseName(transfer.fromWarehouse)} - ${getArabicWarehouseName(transfer.toWarehouse)}`;
    
    return message;
}

// Updated modal with better mobile support
function showWhatsAppSendSingleTransferModal(transferId) {
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
        <div id="whatsapp-send-single-transfer-modal" class="modal" style="display: block; z-index: 10000;">
            <div class="modal-content" style="max-width: 450px; margin: 10px auto; width: 90%;">
                <span class="close" onclick="closeModal('whatsapp-send-single-transfer-modal')">&times;</span>
                <h2>إرسال تقرير التحويل إلى WhatsApp</h2>
                <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
                    أدخل رقم الهاتف وبيانات WhatsApp لإرسال تقرير التحويل.
                </p>
                <form id="whatsapp-send-single-transfer-form" onsubmit="event.preventDefault();">
                    <input type="hidden" id="whatsapp-send-transfer-id" value="${transferId}">
                    <div class="form-group">
                        <label for="whatsapp-send-transfer-recipient" style="font-weight: bold; color: #333;">
                            📱 رقم الهاتف <span style="color: red;">*</span>
                        </label>
                        <input type="tel" id="whatsapp-send-transfer-recipient" 
                               placeholder="مثال: +201060133529" 
                               value="${prefillRecipient}"
                               style="font-size: 16px; padding: 12px; border: 2px solid #25D366; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required autocomplete="tel">
                        <small style="color: #666; font-size: 11px;">أدخل رقم الهاتف مع رمز الدولة</small>
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-send-transfer-token" style="font-weight: bold; color: #333;">
                            🔑 رمز الوصول (Token) <span style="color: red;">*</span>
                        </label>
                        <input type="text" id="whatsapp-send-transfer-token" 
                               placeholder="أدخل رمز الوصول" 
                               value="${prefillToken}"
                               style="font-size: 14px; padding: 12px; border: 1px solid #ddd; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required autocomplete="off">
                    </div>
                    <div class="form-group">
                        <label for="whatsapp-send-transfer-phone-id" style="font-weight: bold; color: #333;">
                            📞 رقم الهاتف ID <span style="color: red;">*</span>
                        </label>
                        <input type="text" id="whatsapp-send-transfer-phone-id" 
                               placeholder="أدخل رقم الهاتف ID" 
                               value="${prefillPhoneId}"
                               style="font-size: 14px; padding: 12px; border: 1px solid #ddd; width: 100%; box-sizing: border-box; border-radius: 5px;"
                               required>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="whatsapp-save-transfer-settings" ${savedSettings ? 'checked' : ''}>
                            <span>حفظ البيانات للاستخدام المستقبلي</span>
                        </label>
                    </div>
                    <button type="button" id="whatsapp-send-transfer-submit" class="btn" style="background: #25D366; color: white; width: 100%; padding: 14px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; touch-action: manipulation; font-weight: bold;" onclick="submitWhatsAppSingleTransfer()">
                        📤 إرسال إلى WhatsApp
                    </button>
                    <div id="single-transfer-status" style="margin-top: 10px; text-align: center; display: none;"></div>
                </form>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('whatsapp-send-single-transfer-modal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Focus on first input for mobile
    setTimeout(() => {
        const recipientInput = document.getElementById('whatsapp-send-transfer-recipient');
        if (recipientInput) {
            recipientInput.focus();
        }
    }, 300);
}

// Update status message for transfer
function updateTransferStatus(elementId, message, isError) {
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

// Submit function for single transfer WhatsApp - called by button
async function submitWhatsAppSingleTransfer() {
    const transferId = document.getElementById('whatsapp-send-transfer-id').value;
    const token = document.getElementById('whatsapp-send-transfer-token').value;
    const phoneId = document.getElementById('whatsapp-send-transfer-phone-id').value;
    const recipient = document.getElementById('whatsapp-send-transfer-recipient').value;
    const saveSettings = document.getElementById('whatsapp-save-transfer-settings').checked;
    
    const transfer = transfers.find(t => t.id === transferId);
    if (!transfer) {
        alert('Transfer not found');
        return;
    }
    
    // Clear previous status
    updateTransferStatus('single-transfer-status', '', false);
    
    // Validate inputs with clear error messages
    if (!token || !token.trim()) {
        updateTransferStatus('single-transfer-status', '❌ Please enter your Access Token', true);
        document.getElementById('whatsapp-send-transfer-token').focus();
        return;
    }
    if (!phoneId || !phoneId.trim()) {
        updateTransferStatus('single-transfer-status', '❌ Please enter your Phone Number ID', true);
        document.getElementById('whatsapp-send-transfer-phone-id').focus();
        return;
    }
    if (!recipient || !recipient.trim()) {
        updateTransferStatus('single-transfer-status', '❌ Please enter the recipient phone number', true);
        document.getElementById('whatsapp-send-transfer-recipient').focus();
        return;
    }
    
    // Validate phone number format
    const cleanPhone = recipient.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
        updateTransferStatus('single-transfer-status', '❌ Invalid phone number. Must be at least 10 digits with country code', true);
        return;
    }
    
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
    
    const submitBtn = document.getElementById('whatsapp-send-transfer-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ جاري الإرسال...';
    submitBtn.disabled = true;
    
    // Update status
    updateTransferStatus('single-transfer-status', '⏳ جاري الإرسال... يرجى الانتظار...', false);
    
    try {
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
                text: { body: formatSingleTransferForWhatsApp(transfer) }
            })
        });
        
        const result = await response.json();
        
        if (response.ok && !result.error) {
            updateTransferStatus('single-transfer-status', '✅ تم الإرسال بنجاح!', false);
            alert('✅ Transfer sent successfully to WhatsApp!');
            closeModal('whatsapp-send-single-transfer-modal');
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
            
            updateTransferStatus('single-transfer-status', '❌ ' + errorMsg, true);
            alert(userFriendlyMessage);
        }
    } catch (error) {
        console.error('Error:', error);
        
        if (!navigator.onLine) {
            updateTransferStatus('single-transfer-status', '❌ لا يوجد اتصال بالإنترنت', true);
            alert('❌ لا يوجد اتصال بالإنترنت.\nتحقق من اتصالك وحاول مرة أخرى.');
        } else {
            updateTransferStatus('single-transfer-status', '❌ خطأ في الشبكة: ' + error.message, true);
            alert('❌ Network error occurred while sending to WhatsApp.\n\n' +
                  'Please check your internet connection and try again.\n\n' +
                  'Error details: ' + error.message);
        }
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

