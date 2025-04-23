const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    // 只處理 POST 請求
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // Vercel Serverless Functions 會自動解析 JSON body
    const { code, duration, expires } = req.body;

    // 基本驗證
    if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ success: false, message: '缺少或無效的序號 (code)。' });
    }

    let durationMinutes = null;
    if (duration !== undefined && duration !== null && duration !== '') {
        durationMinutes = parseInt(duration, 10);
        if (isNaN(durationMinutes) || durationMinutes <= 0) {
            return res.status(400).json({ success: false, message: '無效的有效分鐘數 (duration)，必須是正整數。' });
        }
    }

    let expiresAt = null;
    if (expires !== undefined && expires !== null && expires !== '') {
        // 前端傳來的是 datetime-local 字串，格式類似 "YYYY-MM-DDTHH:mm"
        // 直接建立 Date 物件
        expiresAt = new Date(expires);
        if (isNaN(expiresAt.getTime())) {
             return res.status(400).json({ success: false, message: '無效的固定到期日 (expires) 格式，應為 YYYY-MM-DDTHH:mm。' });
        }
    }

    let client;
    try {
        client = await pool.connect();
        const query = `
            INSERT INTO serials (code, duration_minutes, expires_at, is_active)
            VALUES ($1, $2, $3, TRUE)
        `;
        // 將 Date 物件轉為 ISO 字串給 pg，如果 expiresAt 是 null 則傳遞 null
        const values = [code.trim(), durationMinutes, expiresAt ? expiresAt.toISOString() : null];
        await client.query(query, values);

        res.status(200).json({ success: true, message: `序號 '${code.trim()}' 新增成功！` });

    } catch (error) {
        console.error('Error adding serial:', error);
        // 檢查是否為唯一性約束衝突 (序號重複)
        // 注意： 'serials_pkey' 是假設的主鍵名稱，實際可能不同，但 '23505' 通常表示 unique_violation
        if (error.code === '23505') { 
            res.status(409).json({ success: false, message: `序號 '${code.trim()}' 已存在。` });
        } else {
            res.status(500).json({ success: false, message: '新增序號時發生內部伺服器錯誤。'/*, details: error.message*/ }); // 避免洩漏過多細節
        }
    } finally {
        if (client) {
            client.release();
        }
    }
}; 