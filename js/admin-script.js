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
     * 顯示狀態訊息
     * @param {HTMLElement} element 顯示訊息的元素
     * @param {string} message 訊息內容
     * @param {boolean} isSuccess 是否為成功訊息
     */
    const showStatusMessage = (element, message, isSuccess) => {
        element.textContent = message;
        element.className = isSuccess ? 'status-success' : 'status-error';
    };

    /**
     * 格式化日期時間字串 (或返回'-')
     * @param {string | null} dateString ISO 格式日期字串
     * @returns {string}
     */
    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            return '-';
        }
    };

    /**
     * 從後端獲取序號列表並顯示在表格中
     */
    const fetchAndDisplaySerials = async () => {
        showStatusMessage(listStatusMsg, '正在載入列表...', true);
        serialsTableBody.innerHTML = '<tr><td colspan="7">載入中...</td></tr>';

        try {
            const response = await fetch('/api/list-serials');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); // Try to parse error
                throw new Error(`HTTP 錯誤！ 狀態: ${response.status}. ${errorData.message || ''}`);
            }
            const serials = await response.json();
            console.log(serials);

            serialsTableBody.innerHTML = ''; // 清空表格

            if (serials.length === 0) {
                serialsTableBody.innerHTML = '<tr><td colspan="7">目前沒有序號。</td></tr>';
                listStatusMsg.textContent = '';
                return;
            }

            const now = new Date(); // 當前時間，用於比較

            serials.forEach(serial => {
                const row = serialsTableBody.insertRow();

                let displayIsActive = true; // 預設有效

                // 固定到期日判斷
                if (serial.expires_at) {
                    const expiresDate = new Date(serial.expires_at);
                    if (!isNaN(expiresDate.getTime()) && expiresDate < now) {
                        displayIsActive = false;
                    }
                }

                // 已啟動且有有效分鐘數，判斷是否過期
                if (displayIsActive && serial.used_at && serial.duration_minutes) {
                    const activatedDate = new Date(serial.used_at);
                    const durationMillis = serial.duration_minutes * 60 * 1000;
                    if (!isNaN(activatedDate.getTime())) {
                        const calculatedExpiry = new Date(activatedDate.getTime() + durationMillis);
                        if (calculatedExpiry < now) {
                            displayIsActive = false;
                        }
                    }
                }

                row.innerHTML = `
                    <td>${serial.serial_key || '-'}</td>
                    <td>${serial.duration_minutes || '-'}</td>
                    <td>${formatDateTime(serial.used_at)}</td>
                    <td>${formatDateTime(serial.expires_at)}</td>
                    <td>${displayIsActive ? '是' : '<span style="color:red;">否</span>'}</td>
                    <td>${formatDateTime(serial.created_at)}</td>
                    <td>
                        <button
                            class="action-btn ${serial.is_active ? 'btn-disable' : 'btn-enable'}"
                            data-code="${serial.code}"
                            data-current-active="${serial.is_active}">
                            ${serial.is_active ? '停用' : '啟用'}
                        </button>
                        <button class="action-btn btn-delete" data-code="${serial.code}">刪除</button>
                    </td>
                `;

                console.log('used_at:', serial.used_at, 'formatted:', formatDateTime(serial.used_at));
            });

            showStatusMessage(listStatusMsg, `列表載入成功，共 ${serials.length} 個序號。`, true);

        } catch (error) {
            console.error('載入序號列表失敗:', error);
            serialsTableBody.innerHTML = '<tr><td colspan="7">載入列表失敗，請檢查網路或後端服務。</td></tr>';
            showStatusMessage(listStatusMsg, `載入列表失敗: ${error.message}`, false);
        }
    };

    /**
     * 新增序號
     */
    const addSerial = async () => {
        const code = newSerialCodeInput.value.trim();
        const duration = newSerialDurationInput.value ? parseInt(newSerialDurationInput.value, 10) : null;
        const expires = newSerialExpiresInput.value ? newSerialExpiresInput.value : null;

        if (!code) {
            showStatusMessage(addStatusMsg, '序號欄位不能為空！', false);
            return;
        }

        showStatusMessage(addStatusMsg, '正在新增序號...', true);

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
                showStatusMessage(addStatusMsg, result.message || '序號新增成功！', true);
                newSerialCodeInput.value = '';
                newSerialDurationInput.value = '';
                newSerialExpiresInput.value = '';
                fetchAndDisplaySerials(); // 刷新列表
            } else {
                throw new Error(result.message || `HTTP 錯誤！ 狀態: ${response.status}`);
            }

        } catch (error) {
            console.error('新增序號失敗:', error);
            showStatusMessage(addStatusMsg, `新增序號失敗: ${error.message}`, false);
        }
    };

    /**
     * 更新序號狀態 (啟用/停用)
     * @param {string} code 序號
     * @param {boolean} newIsActive 新的狀態
     */
    const updateSerialStatus = async (code, newIsActive) => {
        showStatusMessage(listStatusMsg, `正在更新序號 ${code} 狀態...`, true);
        try {
            const response = await fetch('/api/update-serial-status', {
                method: 'POST', // 或 'PUT'
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, isActive: newIsActive })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || `HTTP 錯誤: ${response.status}`);
            }
            showStatusMessage(listStatusMsg, result.message || '狀態更新成功！', true);
            fetchAndDisplaySerials(); // 刷新列表
        } catch (error) {
            console.error(`更新序號 ${code} 狀態失敗:`, error);
            showStatusMessage(listStatusMsg, `更新序號 ${code} 狀態失敗: ${error.message}`, false);
        }
    };

    /**
     * 刪除序號
     * @param {string} code 序號
     */
    const deleteSerial = async (code) => {
        showStatusMessage(listStatusMsg, `正在刪除序號 ${code}...`, true);
        try {
            const response = await fetch('/api/delete-serial', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }) // 將 code 放在 body 中
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                 // 即使是 404 也認為是錯誤
                 throw new Error(result.message || `HTTP 錯誤: ${response.status}`);
            }
            showStatusMessage(listStatusMsg, result.message || '刪除成功！', true);
            fetchAndDisplaySerials(); // 刷新列表
        } catch (error) {
            console.error(`刪除序號 ${code} 失敗:`, error);
            showStatusMessage(listStatusMsg, `刪除序號 ${code} 失敗: ${error.message}`, false);
        }
    };

    // --- 事件監聽 ---
    addSerialBtn.addEventListener('click', addSerial);
    refreshListBtn.addEventListener('click', fetchAndDisplaySerials);

    // --- 新增：表格內按鈕的事件委派 ---
    serialsTableBody.addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName === 'BUTTON' && target.classList.contains('action-btn')) {
            const code = target.dataset.code;
            if (!code) return; // 防禦性檢查

            if (target.classList.contains('btn-disable') || target.classList.contains('btn-enable')) {
                // 從按鈕的 data attribute 獲取當前狀態，並計算新狀態
                const currentIsActive = target.dataset.currentActive === 'true';
                const newIsActive = !currentIsActive;
                updateSerialStatus(code, newIsActive);
            } else if (target.classList.contains('btn-delete')) {
                if (confirm(`您確定要永久刪除序號 '${code}' 嗎？此操作無法復原。`)) {
                    deleteSerial(code);
                }
            }
        }
    });

    // --- 登入邏輯 ---
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
            showStatusMessage(loginStatusMsg, '帳號或密碼錯誤！', false);
            passwordInput.value = '';
        }
    };

    // 監聽登入按鈕點擊
    loginBtn.addEventListener('click', handleLogin);

    // Enter 鍵觸發登入
    passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
    usernameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
             passwordInput.focus();
        }
    });

}); 