
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// WhatsApp Configuration - Replace with your actual values
const WHATSAPP_TOKEN = 'YOUR_WHATSAPP_ACCESS_TOKEN'; // Get from Facebook Developer Portal
const PHONE_NUMBER_ID = 'YOUR_PHONE_NUMBER_ID'; // Get from Facebook Developer Portal
const RECIPIENT_PHONE = '+201060133529'; // Default recipient phone number

// Verify Webhook (called once when setting up in Facebook)
app.get('/webhook', (req, res) => {
    const verify_token = "MY_STRATEGIC_TOKEN_123"; // Same token you set in Facebook Developer Portal
    
    if (req.query['hub.verify_token'] === verify_token) {
        console.log('Webhook verified successfully');
        res.send(req.query['hub.challenge']);
    } else {
        console.log('Webhook verification failed');
        res.sendStatus(403);
    }
});

// Receive incoming messages
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
            let messageText = body.entry[0].changes[0].value.messages[0].text.body;
            let from = body.entry[0].changes[0].value.messages[0].from;
            
            console.log(`Received message from ${from}: ${messageText}`);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Send WhatsApp Message
async function sendWhatsAppMessage(recipientPhone, messageText) {
    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: "whatsapp",
                to: recipientPhone,
                type: "text",
                text: { body: messageText }
            }
        });
        console.log('Message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// API endpoint to send activity report
app.post('/api/send-report', async (req, res) => {
    const { reportType, reportData, phoneNumber } = req.body;
    
    try {
        let message = '';
        
        if (reportType === 'sales') {
            message = formatSalesReport(reportData);
        } else if (reportType === 'transfers') {
            message = formatTransferReport(reportData);
        } else if (reportType === 'inventory') {
            message = formatInventoryReport(reportData);
        } else if (reportType === 'full') {
            message = formatFullReport(reportData);
        }
        
        const recipient = phoneNumber || RECIPIENT_PHONE;
        const result = await sendWhatsAppMessage(recipient, message);
        
        res.json({ success: true, messageId: result.messages[0].id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Format sales report for WhatsApp
function formatSalesReport(sales) {
    let message = '📊 *تقرير المبيعات*\n\n';
    
    if (sales.length === 0) {
        message += 'لا توجد مبيعات';
        return message;
    }
    
    // Group by date
    const groupedByDate = {};
    sales.forEach(sale => {
        const date = new Date(sale.releaseDate).toLocaleDateString('ar-SA');
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(sale);
    });
    
    let totalItems = 0;
    let totalRevenue = 0;
    
    Object.keys(groupedByDate).forEach(date => {
        message += `\n📅 *${date}*\n`;
        groupedByDate[date].forEach(sale => {
            const items = sale.itemCount || 1;
            totalItems += items;
            totalRevenue += sale.price || 0;
            message += `• ${sale.customerName}: ${items} صنف${sale.price ? ' - ' + sale.price + '$' : ''}\n`;
        });
    });
    
    message += `\n━━━━━━━━━━━━━━━━━\n`;
    message += `📈 *الإجمالي*: ${totalItems} صنف\n`;
    message += `💰 *الإيرادات*: ${totalRevenue} $`;
    
    return message;
}

// Format transfer report for WhatsApp
function formatTransferReport(transfers) {
    let message = '🔄 *تقرير النقل*\n\n';
    
    if (transfers.length === 0) {
        message += 'لا توجد عمليات نقل';
        return message;
    }
    
    let totalItems = 0;
    
    transfers.forEach(transfer => {
        const date = new Date(transfer.transferredAt).toLocaleDateString('ar-SA');
        const from = getArabicWarehouse(transfer.fromWarehouse);
        const to = getArabicWarehouse(transfer.toWarehouse);
        const count = transfer.itemCount || 1;
        totalItems += count;
        
        message += `• ${date}: ${count} صنف\n`;
        message += `  ${from} ➝ ${to}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━\n`;
    message += `📦 *الإجمالي*: ${totalItems} صنف`;
    
    return message;
}

// Format inventory report for WhatsApp
function formatInventoryReport(products) {
    let message = '📋 *تقرير المخزون*\n\n';
    
    if (products.length === 0) {
        message += 'لا توجد منتجات في المخزون';
        return message;
    }
    
    // Group by warehouse
    const groupedByWarehouse = {};
    products.forEach(product => {
        const warehouse = product.warehouse;
        if (!groupedByWarehouse[warehouse]) {
            groupedByWarehouse[warehouse] = [];
        }
        groupedByWarehouse[warehouse].push(product);
    });
    
    Object.keys(groupedByWarehouse).forEach(warehouse => {
        const arabicWarehouse = getArabicWarehouse(warehouse);
        const count = groupedByWarehouse[warehouse].length;
        message += `🏭 *${arabicWarehouse}*: ${count} صنف\n`;
    });
    
    message += `\n━━━━━━━━━━━━━━━━━\n`;
    message += `📦 *إجمالي المخزون*: ${products.length} صنف`;
    
    return message;
}

// Format full activity report
function formatFullReport(data) {
    let message = '📊 *تقرير شامل للنشاط*\n\n';
    
    if (data.sales && data.sales.length > 0) {
        message += formatSalesReport(data.sales) + '\n\n';
    }
    
    if (data.transfers && data.transfers.length > 0) {
        message += formatTransferReport(data.transfers) + '\n\n';
    }
    
    if (data.inventory && data.inventory.length > 0) {
        message += formatInventoryReport(data.inventory);
    }
    
    return message;
}

// Helper function to get Arabic warehouse name
function getArabicWarehouse(warehouse) {
    const names = {
        'فيصل': 'فيصل',
        'البيني': 'البيني',
        'باب الوق': 'باب الوق',
        'Faisal': 'فيصل',
        'Al-Bini': 'البيني',
        'Bab Al-Waq': 'باب الوق'
    };
    return names[warehouse] || warehouse;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

