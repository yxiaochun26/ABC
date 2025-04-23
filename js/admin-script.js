document.addEventListener('DOMContentLoaded', () => {
    // --- 登入相關元素 ---
    const loginSection = document.getElementById('login-section');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const loginStatusMsg = document.getElementById('login-status-msg');
    const adminContent = document.getElementById('admin-content');

    // --- 原有管理介面元素 ---
    const newSerialCodeInput = document.getElementById('new-serial-code');
    const newSerialDurationInput = document.getElementById('new-serial-duration');
    const newSerialExpiresInput = document.getElementById('new-serial-expires');
    const addSerialBtn = document.getElementById('add-serial-btn');
    const addStatusMsg = document.getElementById('add-status-msg');

    const refreshListBtn = document.getElementById('refresh-list-btn');
    const serialsTableBody = document.getElementById('serials-table-body');
    const listStatusMsg = document.getElementById('list-status-msg');

    // --- 函數 ---

    /**
     * 格式化日期時間字串 (或返回空字串)
     * @param {string | null} dateString ISO 格式日期字串
     * @returns {string}
     */
    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // 檢查是否為有效日期
            if (isNaN(date.getTime())) return '無效日期';
            // 使用 toLocaleString 格式化，可根據需要調整選項
            return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            console.error('Error formatting date:', error);
            return '格式化錯誤';
        }
    };

    /**
     * 從後端獲取序號列表並顯示在表格中
     */
    const fetchAndDisplaySerials = async () => {
        listStatusMsg.textContent = '正在載入列表...';
        listStatusMsg.className = '';
        serialsTableBody.innerHTML = '<tr><td colspan="7">載入中...</td></tr>'; // 清空並顯示載入中

        try {
            const response = await fetch('/api/list-serials');
            if (!response.ok) {
                throw new Error(`HTTP 錯誤！ 狀態: ${response.status}`);
            }
            const serials = await response.json();

            serialsTableBody.innerHTML = ''; // 清空表格

            if (serials.length === 0) {
                serialsTableBody.innerHTML = '<tr><td colspan="7">目前沒有序號。</td></tr>';
                listStatusMsg.textContent = '';
                return;
            }

            serials.forEach(serial => {
                const row = serialsTableBody.insertRow();
                row.innerHTML = `
                    <td>${serial.code || ''}</td>
                    <td>${serial.duration_minutes || '-'}</td>
                    <td>${formatDateTime(serial.activated_at)}</td>
                    <td>${formatDateTime(serial.expires_at)}</td>
                    <td>${serial.is_active ? '是' : '否'}</td>
                    <td>${formatDateTime(serial.created_at)}</td>
                    <td>
                        <button class="action-btn ${serial.is_active ? 'btn-disable' : 'btn-enable'}" data-code="${serial.code}">
                            ${serial.is_active ? '停用' : '啟用'}
                        </button>
                        <button class="action-btn btn-delete" data-code="${serial.code}">刪除</button>
                    </td>
                `;
            });

            listStatusMsg.textContent = `列表載入成功，共 ${serials.length} 個序號。`;
            listStatusMsg.className = 'status-success';

        } catch (error) {
            console.error('載入序號列表失敗:', error);
            serialsTableBody.innerHTML = '<tr><td colspan="7">載入列表失敗，請稍後再試。</td></tr>';
            listStatusMsg.textContent = `載入列表失敗: ${error.message}`;
            listStatusMsg.className = 'status-error';
        }
    };

    /**
     * 新增序號
     */
    const addSerial = async () => {
        const code = newSerialCodeInput.value.trim();
        const duration = newSerialDurationInput.value ? parseInt(newSerialDurationInput.value, 10) : null;
        const expires = newSerialExpiresInput.value ? newSerialExpiresInput.value : null; // 直接傳遞字串

        if (!code) {
            addStatusMsg.textContent = '序號欄位不能為空！';
            addStatusMsg.className = 'status-error';
            return;
        }

        addStatusMsg.textContent = '正在新增序號...';
        addStatusMsg.className = '';

        try {
            const response = await fetch('/api/add-serial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code, duration, expires }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                addStatusMsg.textContent = result.message || '序號新增成功！';
                addStatusMsg.className = 'status-success';
                // 清空輸入框
                newSerialCodeInput.value = '';
                newSerialDurationInput.value = '';
                newSerialExpiresInput.value = '';
                // 刷新列表
                fetchAndDisplaySerials();
            } else {
                throw new Error(result.message || `HTTP 錯誤！ 狀態: ${response.status}`);
            }

        } catch (error) {
            console.error('新增序號失敗:', error);
            addStatusMsg.textContent = `新增序號失敗: ${error.message}`;
            addStatusMsg.className = 'status-error';
        }
    };

    // --- 事件監聽 ---
    addSerialBtn.addEventListener('click', addSerial);
    refreshListBtn.addEventListener('click', fetchAndDisplaySerials);

    // --- 新增：登入邏輯 ---
    const handleLogin = () => {
        const username = usernameInput.value;
        const password = passwordInput.value;

        // **注意：極不安全的客戶端驗證**
        if (username === 'abc123' && password === 'abc123') {
            loginStatusMsg.textContent = '';
            loginSection.style.display = 'none';
            adminContent.style.display = 'block';
            // 登入成功後才載入序號列表
            fetchAndDisplaySerials();
        } else {
            loginStatusMsg.textContent = '帳號或密碼錯誤！';
            // 可以考慮清空密碼欄位
            passwordInput.value = '';
        }
    };

    // 監聽登入按鈕點擊
    loginBtn.addEventListener('click', handleLogin);

    // 可以選擇性地增加 Enter 鍵觸發登入
    passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
    usernameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
             // 可以將焦點移到密碼欄位，或直接觸發登入
             passwordInput.focus();
            // handleLogin(); // 或者直接登入
        }
    });

}); 