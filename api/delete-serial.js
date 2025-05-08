const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    // 通常使用 DELETE 方法
    if (req.method !== 'DELETE') {
        res.setHeader('Allow', ['DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 從請求 body 獲取 code (需要前端配合傳送 body)
    const { code } = req.body;

    // 基本驗證
    if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ success: false, message: '缺少或無效的序號 (code)。' });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'DELETE FROM serials WHERE serial_key = $1',
            [code.trim()]
        );

        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: `序號 '${code.trim()}' 刪除成功！` });
        } else {
            // 即使找不到也可能回傳成功，因為目標狀態 (不存在) 已達成
            // 但為了明確，可以回傳 404
            res.status(404).json({ success: false, message: `找不到序號 '${code.trim()}'，無法刪除。` });
        }

    } catch (error) {
        console.error('Error deleting serial:', error);
        // 這裡可以檢查是否有 FK 約束等錯誤，但暫時簡化處理
        res.status(500).json({ success: false, message: '刪除序號時發生內部伺服器錯誤。' });
    } finally {
        if (client) {
            client.release();
        }
    }
}; 