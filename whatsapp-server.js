const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// --- الإعدادات (تأكد من صحتها) ---
const WHATSAPP_TOKEN = 'EAAM8XY8slcUBQz2PYAESEd4qOfQXRDmxGW2Mk...'; 
const PHONE_NUMBER_ID = '924037380801081'; 
const RECIPIENT_PHONE = '201060133529'; 

// 1. دالة تحويل مصفوفة المبيعات لنص منسق
function formatSalesReport(sales) {
    if (!sales || sales.length === 0) return "⚠️ لا توجد بيانات مبيعات لإرسالها.";

    let report = `📊 *تقرير المبيعات الفعلي*\n`;
    report += `━━━━━━━━━━━━━━━━━\n`;
    
    let total = 0;
    sales.forEach((item, index) => {
        const price = parseFloat(item.price) || 0;
        total += price;
        report += `${index + 1}. 👤 *العميل:* ${item.customerName || 'غير معروف'}\n`;
        report += `   📦 *الصنف:* ${item.itemName || 'صنف عام'}\n`;
        report += `   💰 *السعر:* ${price} $\n`;
        report += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    });

    report += `\n💵 *الإجمالي النهائي:* ${total} $`;
    return report;
}

// 2. دالة الإرسال لفيسبوك
async function sendToWhatsApp(text) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: "whatsapp",
                to: RECIPIENT_PHONE,
                type: "text",
                text: { body: text }
            }
        });
        return true;
    } catch (error) {
        console.error("Detail:", error.response ? error.response.data : error.message);
        return false;
    }
}

// 3. الـ API اللي البرنامج بيبعتله البيانات
app.post('/api/send-report', async (req, res) => {
    // هنا بنستقبل المبيعات من البرنامج بتاعك
    const salesData = req.body.sales; 

    if (!salesData) {
        return res.status(400).json({ success: false, error: "لم يتم إرسال بيانات مبيعات" });
    }

    // تحويل البيانات لنص
    const messageText = formatSalesReport(salesData);

    // إرسال النص الفعلي بدل رسالة الـ Test
    const isSent = await sendToWhatsApp(messageText);

    if (isSent) {
        res.json({ success: true, message: "تم إرسال تقرير المبيعات بنجاح" });
    } else {
        res.status(500).json({ success: false, error: "فشل الإرسال" });
    }
});

app.listen(3000, () => console.log("🚀 السيرفر جاهز لإرسال المبيعات الحقيقية"));