const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    // 只處理 POST 請求 (或 PUT)
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { code, isActive } = req.body;

    // 基本驗證
    if (!code || typeof code !== 'string' || code.trim() === '') {
        return res.status(400).json({ success: false, message: '缺少或無效的序號 (code)。' });
    }
    if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: '缺少或無效的狀態 (isActive)。' });
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'UPDATE serials SET is_active = $1 WHERE code = $2',
            [isActive, code.trim()]
        );

        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: `序號 '${code.trim()}' 狀態更新成功！` });
        } else {
            res.status(404).json({ success: false, message: `找不到序號 '${code.trim()}'。` });
        }

    } catch (error) {
        console.error('Error updating serial status:', error);
        res.status(500).json({ success: false, message: '更新序號狀態時發生內部伺服器錯誤。' });
    } finally {
        if (client) {
            client.release();
        }
    }
}; 