// Open Send to Customer Modal
function openSendToCustomerModal() {
    openModal('send-to-customer-modal');
    
    // Clear previous inputs
    document.getElementById('customer-name-input').value = '';
    document.getElementById('customer-phone-input').value = '';
    
    // Pre-fill with saved settings if available
    const savedSettings = localStorage.getItem('whatsappSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('customer-phone-input').value = settings.recipientPhone || '';
    }
}

// Handle Send to Customer form submission
function initSendToCustomerForm() {
    const sendToCustomerForm = document.getElementById('send-to-customer-form');
    if (sendToCustomerForm) {
        sendToCustomerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const customerName = document.getElementById('customer-name-input').value.trim();
            const customerPhone = document.getElementById('customer-phone-input').value.trim();
            
            if (!customerName) {
                alert('Please enter a customer name');
                return;
            }
            
            // Find sales for this customer
            const customerSales = sales.filter(s => 
                s.customerName.toLowerCase() === customerName.toLowerCase()
            );
            
            if (customerSales.length === 0) {
                alert('No sales found for customer: ' + customerName);
                return;
            }
            
            // Get WhatsApp settings
            const savedSettings = localStorage.getItem('whatsappSettings');
            let whatsappSettings = null;
            
            if (savedSettings) {
                whatsappSettings = JSON.parse(savedSettings);
            }
            
            // Use customer phone if provided, otherwise use settings phone
            const recipientPhone = customerPhone || (whatsappSettings ? whatsappSettings.recipientPhone : null);
            
            if (!whatsappSettings || !whatsappSettings.token || !whatsappSettings.phoneId) {
                alert('WhatsApp is not configured. Please configure your WhatsApp settings first.');
                return;
            }
            
            if (!recipientPhone) {
                alert('Please enter a customer phone number or configure default recipient in WhatsApp Settings.');
                return;
            }
            
            // Format message for this customer's sales
            const message = formatCustomerSalesReportForWhatsApp(customerSales, customerName);
            
            // Show loading
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            
            // Send to WhatsApp
            const cleanRecipient = recipientPhone.replace(/\D/g, '');
            
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
                if (!result.error) {
                    alert('Sales report sent successfully to ' + customerName + '!');
                    closeModal('send-to-customer-modal');
                } else {
                    const errorMsg = result.error?.message || 'Unknown error';
                    alert('Failed to send message: ' + errorMsg);
                }
            })
            .catch(error => {
                console.error('Error sending to WhatsApp:', error);
                alert('Network error occurred: ' + error.message);
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        });
    }
}

// Format customer sales report for WhatsApp
function formatCustomerSalesReportForWhatsApp(customerSales, customerName) {
    let message = '';
    
    // Get unique products with quantities from all purchases
    const productCounts = {};
    let totalAmount = 0;
    
    customerSales.forEach(sale => {
        // Sum up the price/amount
        if (sale.price) {
            totalAmount += parseFloat(sale.price);
        }
        
        // Count products
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
    });
    
    // Format products with quantity (e.g., "Quantity: 4 / Soswi 18.5")
    if (Object.keys(productCounts).length > 0) {
        Object.entries(productCounts).forEach(([name, qty]) => {
            message += `Quantity: ${qty} / ${name}\n`;
        });
    }
    
    // Add customer name
    message += `${customerName}\n`;
    
    // Add total amount
    if (totalAmount > 0) {
        message += `${totalAmount}`;
    }
    
    return message;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initSendToCustomerForm();
});
