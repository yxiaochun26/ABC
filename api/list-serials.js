const { Pool } = require('pg');

// 使用環境變數中的連接字串建立連接池
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432,
    ssl: {
        rejectUnauthorized: false // 在 Vercel/Neon 上通常需要
    }
});

module.exports = async (req, res) => {
    // 只處理 GET 請求
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'SELECT id, serial_key, duration_minutes, status, created_at, used_at FROM serials ORDER BY created_at DESC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching serials:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    } finally {
        if (client) {
            client.release(); // 釋放客戶端回連接池
        }
    }
}; 