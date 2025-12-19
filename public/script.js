/**
 * TQS Diary - Core Logic (Final)
 * Firebase Integration, AI Analysis, and Local Storage Fallbacks.
 */

// --- FIREBASE SETUP ---
// Config is now loaded from firebase-config.js

let auth = null;
let db = null;
let googleProvider = null;

try {
    if (typeof firebase !== 'undefined') {
        // App should already be initialized by firebase-config.js
        if (!firebase.apps.length) {
            console.error('Firebase not initialized! Check loading order.');
        } else {
            auth = firebase.auth();
            db = firebase.firestore();
            googleProvider = new firebase.auth.GoogleAuthProvider();
            console.log('Firebase Services Ready');
        }
    } else {
        console.error('Firebase SDK not found. Verify internet connection.');
    }
} catch (e) {
    console.error('Firebase Initialization Error:', e);
}

// --- State Management ---
const appState = {
    user: null,
    entries: [],
    currentView: 'list',
    activeEntryId: null,
    writingDate: null,
    theme: localStorage.getItem('theme') || 'dark',
    calendarDate: new Date(),
    apiKey: localStorage.getItem('gemini_api_key') || '',
    filterByDate: null,
    masterPassword: localStorage.getItem('diary_master_pass') || ''
};

// --- DOM References ---
const getEl = (id) => document.getElementById(id);
const dom = {
    body: document.body,
    viewList: getEl('view-list'),
    viewEditor: getEl('view-editor'),
    viewCalendar: getEl('view-calendar'),
    entryListContainer: getEl('entry-list-container'),
    toastContainer: getEl('toast-container'),

    btnViewList: getEl('btn-view-list'),
    btnViewCalendar: getEl('btn-view-calendar'),
    btnNewEntry: getEl('btn-new-entry'),
    btnSettings: getEl('btn-settings'),
    btnThemeToggle: getEl('btn-theme-toggle'),

    modalSettings: getEl('modal-settings'),
    // inputApiKey removed
    inputCurrentPass: getEl('input-current-pass'),
    inputNewPass: getEl('input-new-pass'),
    btnUpdatePass: getEl('btn-update-pass'),
    btnForgotPassSettings: getEl('btn-forgot-pass-settings'),
    btnCloseSettings: getEl('btn-close-settings'),

    inputContent: getEl('entry-content'),
    contentDisplayText: getEl('entry-content-display-text'),
    displayDate: getEl('entry-date-display'),
    displayScore: getEl('entry-score-display'),
    editorTitleLabel: getEl('editor-title-label'),

    selectLockStatus: getEl('select-lock-status'),
    btnSave: getEl('btn-save'),
    btnDeleteEntry: getEl('btn-delete-entry'),
    btnEditEntry: getEl('btn-edit-entry'),

    lockOverlay: getEl('lock-overlay'),
    inputUnlockPass: getEl('input-unlock-pass'),
    btnUnlockEntry: getEl('btn-unlock-entry'),
    btnForgotPass: getEl('btn-forgot-pass'),

    entryImageInput: getEl('entry-image-input'),
    btnUploadImage: getEl('btn-upload-image'),
    imagePreviewContainer: getEl('image-preview-container'),
    imagePreview: getEl('image-preview'),
    btnRemoveImage: getEl('btn-remove-image'),

    modalDelete: getEl('modal-delete-confirm'),
    btnCancelDelete: getEl('btn-cancel-delete'),
    btnConfirmDelete: getEl('btn-confirm-delete'),

    modalReset: getEl('modal-reset-input'),
    inputResetNewPass: getEl('input-reset-new-pass'),
    btnCancelReset: getEl('btn-cancel-reset'),
    btnSaveReset: getEl('btn-save-reset'),

    calendarMonthYear: getEl('calendar-month-year'),
    calendarDaysGrid: getEl('calendar-days-grid'),
    btnPrevMonth: getEl('btn-prev-month'),
    btnNextMonth: getEl('btn-next-month'),
    searchInput: getEl('search-input'),

    // MyPage
    btnMyPage: getEl('btn-mypage'),
    viewMyPage: getEl('view-mypage'),
    mypageContainer: getEl('mypage-container'),

    // Auth UI
    btnLogin: getEl('btn-login'),
    btnLogout: getEl('btn-logout'),
    userProfileSection: getEl('user-profile-section'),
    userAvatar: getEl('user-avatar'),
    userName: getEl('user-name')
};

let currentUploadImage = null;

// --- Init & Load ---
function init() {
    applyTheme(appState.theme);

    // Auth Listener
    if (auth) {
        auth.onAuthStateChanged((user) => {
            if (user) {
                appState.user = user;
                updateAuthUI(true);
                loadEntries();
                showToast(`ようこそ、${user.displayName}さん`);
            } else {
                appState.user = null;
                appState.entries = [];
                updateAuthUI(false);
                renderEntryList();
                navigateTo('list');
            }
        });
    }

    setupEventListeners();

    // Protocol Check (Console only)
    if (window.location.protocol === 'file:') {
        console.warn('RUNNING VIA FILE PROTOCOL: Google Login requires a local HTTP server (e.g. VS Code Live Server).');
    }
}

function updateAuthUI(isLoggedIn) {
    if (dom.btnLogin && dom.userProfileSection) {
        if (isLoggedIn) {
            dom.btnLogin.classList.add('hidden');
            dom.userProfileSection.classList.remove('hidden');
            if (dom.userAvatar) dom.userAvatar.src = appState.user.photoURL;
            if (dom.userName) dom.userName.textContent = appState.user.displayName;
        } else {
            dom.btnLogin.classList.remove('hidden');
            dom.userProfileSection.classList.add('hidden');
        }
    }
}

// --- Firestore Data Operations ---

async function loadEntries() {
    if (!appState.user || !db) return;
    try {
        const snapshot = await db.collection('users')
            .doc(appState.user.uid)
            .collection('entries')
            .orderBy('date', 'desc')
            .get();

        appState.entries = [];
        snapshot.forEach((doc) => {
            appState.entries.push({ id: doc.id, ...doc.data() });
        });
        renderEntryList();
    } catch (e) {
        console.error("Error loading entries: ", e);
        showToast('データの読み込みに失敗しました', 'error');
    }
}

async function saveEntryToFirestore(entry) {
    if (!auth || !auth.currentUser || !db) { // Check auth AND auth.currentUser to prevent crash
        alert('エラー: ログイン状態が確認できません。ページをリロードして再ログインしてください。');
        return false;
    }

    // Deep copy and sanitize to remove any 'undefined' values which Firestore hates
    const entryData = JSON.parse(JSON.stringify(entry));
    delete entryData.id;

    console.log('[DEBUG] Attempting to save:', entryData);

    try {
        const userId = auth.currentUser.uid;
        console.log('[DEBUG] Saving to: users/' + userId + '/entries');
        const entriesRef = db.collection('users').doc(userId).collection('entries');

        if (entry.id && !entry.isNew) {
            await entriesRef.doc(entry.id).set(entryData, { merge: true });
        } else {
            if (entry.id) {
                await entriesRef.doc(entry.id).set(entryData);
            } else {
                await entriesRef.add(entryData);
            }
        }
        await loadEntries();
        return true;
    } catch (e) {
        console.error("Save Error Details: ", e);
        let msg = '保存に失敗しました: ' + e.message;

        // Handle common Firestore errors clearly
        if (e.code === 'permission-denied') {
            msg = '【保存エラー: 権限不足】\nFirebaseのセキュリティルールにより書き込みがブロックされています。\n\nFirebaseコンソールの「Firestore Database」＞「ルール」を開き、\nallow read, write: if request.auth != null; \nに変更してください。';
        } else if (e.code === 'unavailable') {
            msg = '【保存エラー: 通信オフライン】\nインターネット接続を確認してください。';
        }

        alert(msg); // Force alert for visibility
        return false;
    }
}

async function deleteEntryFromFirestore(entryId) {
    if (!appState.user || !db) return;
    try {
        await db.collection('users').doc(appState.user.uid).collection('entries').doc(entryId).delete();
        await loadEntries();
        showToast('日記を削除しました');
    } catch (e) {
        console.error("Delete Error: ", e);
        showToast('削除に失敗しました', 'error');
    }
}

// --- Navigation ---
function navigateTo(viewName) {
    appState.currentView = viewName;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (dom.viewList) dom.viewList.classList.remove('active');
    if (dom.viewMyPage) dom.viewMyPage.classList.remove('active');
    if (dom.viewEditor) dom.viewEditor.classList.remove('active');

    if (viewName === 'list') {
        if (dom.viewList) { dom.viewList.classList.remove('hidden'); requestAnimationFrame(() => dom.viewList.classList.add('active')); }
        if (dom.btnViewList) dom.btnViewList.classList.add('active');
        renderEntryList();
    } else if (viewName === 'editor') {
        if (dom.viewEditor) { dom.viewEditor.classList.remove('hidden'); requestAnimationFrame(() => dom.viewEditor.classList.add('active')); }
        if (dom.btnNewEntry) dom.btnNewEntry.classList.add('active');
        const container = dom.viewEditor ? dom.viewEditor.querySelector('.editor-container') : null;
        if (container) container.scrollTop = 0;
    } else if (viewName === 'calendar') {
        if (dom.viewCalendar) {
            dom.viewCalendar.classList.remove('hidden');
            // CRITICAL FIX: Must add 'active' class for CSS opacity transition to work
            requestAnimationFrame(() => dom.viewCalendar.classList.add('active'));
        }
        if (dom.btnViewCalendar) dom.btnViewCalendar.classList.add('active');
        renderCalendar();
    } else if (viewName === 'mypage') {
        appState.filterByDate = null;
        if (dom.viewMyPage) { dom.viewMyPage.classList.remove('hidden'); requestAnimationFrame(() => dom.viewMyPage.classList.add('active')); }
        if (dom.btnMyPage) dom.btnMyPage.classList.add('active');
        renderMyPage();
    }
}

function renderMyPage() {
    if (!dom.mypageContainer) return;
    const list = appState.entries || [];
    const totalCount = list.length;

    let totalSum = 0, timeSum = 0, qualitySum = 0, enjoySum = 0;
    let scoreCount = 0;

    list.forEach(e => {
        if (e.aiScore && typeof e.aiScore.total === 'number') {
            totalSum += e.aiScore.total;
            timeSum += (e.aiScore.breakdown?.time || 0);
            qualitySum += (e.aiScore.breakdown?.quality || 0);
            enjoySum += (e.aiScore.breakdown?.enjoyment || 0);
            scoreCount++;
        }
    });

    const avgTotal = scoreCount > 0 ? Math.round(totalSum / scoreCount) : 0;
    const avgTime = scoreCount > 0 ? Math.round(timeSum / scoreCount) : 0;
    const avgQuality = scoreCount > 0 ? Math.round(qualitySum / scoreCount) : 0;
    const avgEnjoy = scoreCount > 0 ? Math.round(enjoySum / scoreCount) : 0;

    const g = (lbl, val, sz, iconClass) => {
        const p = Math.min(100, Math.max(0, val || 0));
        const c = p >= 80 ? 'score-high' : p >= 50 ? 'score-mid' : 'score-low';
        return `<div class="score-gauge ${c}" style="width:${sz}px; height:${sz}px; margin: 0 auto;">
            <svg viewBox="0 0 36 36" class="circular-chart">
                <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="circle" stroke-dasharray="${p}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div class="gauge-content">
                ${iconClass ? `<i class="${iconClass}" style="font-size:${sz * 0.2}px; opacity:0.7; margin-bottom:4px;"></i>` : ''}
                <div class="gauge-value" style="font-size:${sz * 0.25}px;">${val}</div>
                <div class="gauge-label" style="font-size:${sz * 0.1}px;">${lbl}</div>
            </div>
        </div>`;
    };

    let streak = 0;
    if (list.length > 0) {
        const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
        const dateSet = new Set(sorted.map(e => new Date(e.date).toDateString()));
        let current = new Date();
        while (true) {
            if (dateSet.has(current.toDateString())) { streak++; current.setDate(current.getDate() - 1); }
            else {
                if (current.toDateString() === new Date().toDateString() && !dateSet.has(current.toDateString())) {
                    current.setDate(current.getDate() - 1); continue;
                }
                break;
            }
        }
    }

    dom.mypageContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:3rem;">
            <div style="text-align:center;">
                <h3 style="margin-bottom:1rem; font-family:var(--font-heading); color:var(--text-muted);">全期間の平均スコア</h3>
                ${g('総合平均', avgTotal, 160, 'fa-solid fa-crown')}
            </div>
            <div style="display:flex; gap:2rem; justify-content:center; flex-wrap:wrap; width:100%;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:1rem;"> ${g('時間の使い方', avgTime, 100, 'fa-regular fa-clock')} </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:1rem;"> ${g('生活の質', avgQuality, 100, 'fa-solid fa-gem')} </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:1rem;"> ${g('充実度', avgEnjoy, 100, 'fa-regular fa-face-smile-wink')} </div>
            </div>
            <div class="stats-grid" style="width:100%; margin-top:1rem;">
                <div class="stat-card"> <i class="fa-solid fa-book stat-icon"></i> <div class="stat-value">${totalCount}</div> <div class="stat-label">日記の総数</div> </div>
                 <div class="stat-card"> <i class="fa-solid fa-fire stat-icon"></i> <div class="stat-value">${streak}</div> <div class="stat-label">連続日数</div> </div>
            </div>
            <div class="stat-card" style="width:100%;">
                <h3 style="margin-bottom:1rem; color:var(--text-main);">TQS分析レポート</h3>
                <p style="color:var(--text-muted); line-height:1.6;">
                    現在の総合平均は <strong>${avgTotal}点</strong> です。<br>
                    ${avgTotal >= 80 ? '素晴らしい状態をキープできています！' : avgTotal >= 50 ? '安定したバランスの良い日々です。' : '少し疲れが見えるかもしれません。休息を大切に。'}
                </p>
            </div>
        </div>
    `;
}

// --- Editor Logic ---
function openEntry(entryId = null, targetDate = null) {
    appState.activeEntryId = entryId;
    currentUploadImage = null;
    navigateTo('editor');

    if (dom.lockOverlay) dom.lockOverlay.classList.add('hidden');
    if (dom.inputUnlockPass) dom.inputUnlockPass.value = '';

    if (entryId) {
        // --- VIEW MODE ---
        const entry = appState.entries.find(e => e.id === entryId);
        if (!entry) return navigateTo('list');

        appState.writingDate = new Date(entry.date);
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = entry.title || '日記の詳細';
        if (dom.displayDate) dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${formatDate(entry.date)} <span style="font-size:0.8em; margin-left:10px;">${formatTime(entry.date)}</span>`;
        if (dom.selectLockStatus) dom.selectLockStatus.value = entry.isLocked ? 'locked' : 'unlocked';

        if (entry.isLocked) {
            toggleEditMode(false);
            if (dom.contentDisplayText) dom.contentDisplayText.classList.add('hidden');
            if (dom.lockOverlay) dom.lockOverlay.classList.remove('hidden');
            if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden');
            if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
            if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'none';
        } else {
            if (dom.contentDisplayText) dom.contentDisplayText.textContent = entry.content;
            toggleEditMode(false); // Default to Read Mode
            if (entry.image) {
                if (dom.imagePreview) dom.imagePreview.src = entry.image;
                if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.remove('hidden');
            } else { if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden'); }
        }

        if (dom.displayScore) dom.displayScore.innerHTML = '';
        if (entry.aiScore && entry.aiScore.total) {
            if (entry.isLocked) { renderAiResult(null, null, entry.aiScore); }
            else { renderAiResult(entry.title, entry.aiAdvice, entry.aiScore); }
        } else if (!entry.isLocked) {
            if (dom.displayScore) dom.displayScore.innerHTML = `<button id="btn-retry-ai" class="btn-primary" style="margin:0 auto;" onclick="app.retryAnalysis('${entry.id}')"><i class="fa-solid fa-wand-magic-sparkles"></i> AI分析を実行</button>`;
        }

    } else {
        // --- WRITE MODE ---
        appState.writingDate = targetDate || new Date();
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '新しい日記';
        if (dom.displayDate) dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-plus"></i> ${formatDate(appState.writingDate)}`;
        if (dom.selectLockStatus) dom.selectLockStatus.value = 'unlocked';
        if (dom.inputContent) dom.inputContent.value = '';
        if (dom.displayScore) dom.displayScore.innerHTML = '';
        if (dom.entryImageInput) dom.entryImageInput.value = '';
        toggleEditMode(true);
        setTimeout(() => { if (dom.inputContent) { dom.inputContent.focus(); if (autoResizeTextarea) autoResizeTextarea(); } }, 100);
    }
}

function toggleEditMode(isEdit) {
    if (isEdit) {
        if (dom.inputContent) dom.inputContent.classList.remove('hidden');
        if (dom.contentDisplayText) dom.contentDisplayText.classList.add('hidden');
        if (dom.btnSave) dom.btnSave.classList.remove('hidden');
        if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
        if (dom.btnUploadImage) dom.btnUploadImage.classList.remove('hidden');
        if (dom.btnRemoveImage) dom.btnRemoveImage.classList.remove('hidden');
        if (dom.selectLockStatus) dom.selectLockStatus.disabled = false;
        if (appState.activeEntryId) {
            const entry = appState.entries.find(e => e.id === appState.activeEntryId);
            if (entry) {
                if (dom.inputContent) dom.inputContent.value = entry.content;
                if (dom.btnSave) dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> 更新';
                if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '日記を編集';
            }
            if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'inline-flex';
        } else {
            if (dom.btnSave) dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> 保存';
        }
        setTimeout(() => { if (autoResizeTextarea) autoResizeTextarea(); }, 10);
    } else {
        if (dom.inputContent) dom.inputContent.classList.add('hidden');
        if (dom.contentDisplayText) dom.contentDisplayText.classList.remove('hidden');
        if (dom.btnSave) dom.btnSave.classList.add('hidden');
        if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'inline-flex';
        if (dom.btnUploadImage) dom.btnUploadImage.classList.add('hidden');
        if (dom.btnRemoveImage) dom.btnRemoveImage.classList.add('hidden');
        if (dom.selectLockStatus) dom.selectLockStatus.disabled = true;
        if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'none';
        if (appState.activeEntryId) {
            const entry = appState.entries.find(e => e.id === appState.activeEntryId);
            if (entry && dom.contentDisplayText) dom.contentDisplayText.textContent = entry.content;
        }
    }
}

function unlockEntry() {
    const pass = dom.inputUnlockPass.value;
    if (pass === appState.masterPassword) {
        const entry = appState.entries.find(e => e.id === appState.activeEntryId);
        if (entry) {
            if (dom.lockOverlay) dom.lockOverlay.classList.add('hidden');
            if (dom.contentDisplayText) dom.contentDisplayText.textContent = entry.content;
            toggleEditMode(false);
            if (entry.image) {
                if (dom.imagePreview) dom.imagePreview.src = entry.image;
                if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.remove('hidden');
            }
            if (entry.aiScore && entry.aiScore.total) { renderAiResult(entry.title, entry.aiAdvice, entry.aiScore); }
            else {
                if (dom.displayScore) dom.displayScore.innerHTML = `<button id="btn-retry-ai" class="btn-primary" style="margin:0 auto;" onclick="app.retryAnalysis('${entry.id}')"><i class="fa-solid fa-wand-magic-sparkles"></i> AI分析を実行</button>`;
            }
        }
    } else {
        showToast('パスワードが違います', 'error');
    }
}

async function retryAnalysisHelper(entryId) {
    if (!appState.apiKey) { showToast('設定からAIキーを入力してください', 'error'); dom.modalSettings.classList.remove('hidden'); return; }
    const entry = appState.entries.find(e => e.id === entryId);
    if (!entry) return;
    const btn = document.getElementById('btn-retry-ai'); if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 分析中...'; }
    try {
        const aiResult = await analyzeDiary(entry.content);
        if (aiResult) {
            entry.title = aiResult.title || entry.title;
            entry.aiAdvice = aiResult.advice || '';
            entry.aiScore = aiResult.score || null;
            // SAVE TO FIRESTORE
            await saveEntryToFirestore(entry);

            showToast('AI分析が完了しました！');
            renderAiResult(entry.title, entry.aiAdvice, entry.aiScore);
        } else {
            showToast('分析に失敗しました。', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> 再試行'; }
        }
    } catch (e) { showToast('エラーが発生しました', 'error'); if (btn) { btn.disabled = false; btn.innerHTML = 'エラー'; } }
}

async function handleImageUpload(file) {
    if (!file) return;
    try {
        const compressed = await compressImage(file, 800, 0.7);
        currentUploadImage = compressed;
        if (dom.imagePreview) dom.imagePreview.src = compressed;
        if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.remove('hidden');
    } catch (e) { showToast('画像エラー', 'error'); }
}

function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject; img.src = e.target.result;
        };
        reader.onerror = reject; reader.readAsDataURL(file);
    });
}

function renderAiResult(title, advice, scoreData) {
    let html = '';
    if (title) html += `<div class="view-entry-title">${title}</div>`;

    if (scoreData && scoreData.total) {
        const { total, breakdown } = scoreData;
        const g = (lbl, val, sz) => {
            const p = Math.min(100, Math.max(0, val || 0));
            const c = p >= 80 ? 'score-high' : p >= 50 ? 'score-mid' : 'score-low';
            return `<div class="score-gauge ${c}" style="width:${sz}px; height:${sz}px;">
                <svg viewBox="0 0 36 36" class="circular-chart">
                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path class="circle" stroke-dasharray="${p}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div class="gauge-content">
                    <div class="gauge-value" style="font-size:${sz * 0.28}px;">${val}</div>
                    <div class="gauge-label" style="font-size:${sz * 0.12}px;">${lbl}</div>
                </div>
            </div>`;
        };
        // Use inline string building for simplicity
        html += `<div class="score-display-wrapper" style="display:flex; flex-direction:column; align-items:center; gap:20px; width:100%; margin-bottom:1.5rem;">${g('総合点', total, 100)}<div class="score-row-sub" style="display:flex; gap:25px; justify-content:center; flex-wrap:wrap;">${g('時間', breakdown?.time, 70)}${g('質', breakdown?.quality, 70)}${g('楽しさ', breakdown?.enjoyment, 70)}</div></div>`;
    }
    if (advice) html += `<div class="ai-advice-box"><p class="ai-advice-text">${advice}</p></div>`;
    if (dom.displayScore) {
        dom.displayScore.style.opacity = '0'; dom.displayScore.innerHTML = html;
        requestAnimationFrame(() => { dom.displayScore.style.transition = 'opacity 0.5s'; dom.displayScore.style.opacity = '1'; });
    }
}

function renderEntryList() {
    if (!dom.entryListContainer) return;
    dom.entryListContainer.innerHTML = '';
    const filtered = appState.entries.filter(e => appState.filterByDate ? new Date(e.date).toDateString() === appState.filterByDate.toDateString() : true);

    if (filtered.length === 0) {
        dom.entryListContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-book-open"></i><p>日記はまだありません</p></div>';
        return;
    }

    filtered.forEach(entry => {
        const card = document.createElement('div'); card.className = `entry-card ${entry.isLocked ? 'locked' : ''}`;
        card.onclick = () => openEntry(entry.id);
        const day = new Date(entry.date);

        let scoreBadge = '';
        if (entry.aiScore && entry.aiScore.total) { // Show score even if locked
            const s = entry.aiScore.total;
            const c = s >= 80 ? 'score-high' : s >= 50 ? 'score-mid' : 'score-low';
            scoreBadge = `<span class="score-badge ${c}">${s}点</span>`;
        }

        let contentPrev = entry.content || '...';
        let cardTitle = entry.title || '無題の日記';

        if (entry.isLocked) {
            contentPrev = '<i class="fa-solid fa-lock" style="margin-right:5px;"></i> 秘密の日記';
            cardTitle = 'Locked Entry';
        }

        card.innerHTML = `
            <div class="entry-header-row">
                <div class="entry-date">${day.getDate()} <span class="entry-day-sm">${day.toLocaleDateString('ja-JP', { weekday: 'short' })}</span> <span style="font-size:0.8em; color:var(--text-muted); font-weight:normal; margin-left:5px;">${formatTime(entry.date)}</span>${scoreBadge}</div>
            </div>
            ${!entry.isLocked ? `<div class="entry-title">${cardTitle}</div>` : ''}
            <div class="entry-preview">${contentPrev}</div>
        `;
        dom.entryListContainer.appendChild(card);
    });
}

function renderCalendar() {
    if (!dom.calendarMonthYear || !dom.calendarDaysGrid) return;
    dom.calendarMonthYear.textContent = appState.calendarDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    dom.calendarDaysGrid.innerHTML = '';
    const y = appState.calendarDate.getFullYear(), m = appState.calendarDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) dom.calendarDaysGrid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = new Date(y, m, d).toDateString();
        const entriesOnDay = appState.entries.filter(e => new Date(e.date).toDateString() === dateStr);
        let avg = null;
        if (entriesOnDay.length > 0) {
            const scored = entriesOnDay.filter(e => e.aiScore && e.aiScore.total);
            if (scored.length > 0) {
                avg = Math.round(scored.reduce((a, b) => a + b.aiScore.total, 0) / scored.length);
            }
        }

        const el = document.createElement('div');
        el.className = `calendar-day ${dateStr === new Date().toDateString() ? 'today' : ''} ${entriesOnDay.length ? 'has-entry' : ''}`;
        const hasImg = entriesOnDay.some(e => e.image);
        if (hasImg) el.classList.add('has-image');

        let inner = `<span class="day-number">${d}</span>`;
        if (avg !== null) {
            const c = avg >= 80 ? 'score-high-cal' : avg >= 50 ? 'score-mid-cal' : 'score-low-cal';
            inner += `<div class="day-score ${c}">${avg}</div>`;
        }

        el.innerHTML = inner;
        el.onclick = () => {
            if (entriesOnDay.length > 0) {
                appState.filterByDate = new Date(y, m, d);
                navigateTo('list');
            } else {
                appState.filterByDate = null;
                openEntry(null, new Date(y, m, d, 9, 0));
            }
        };
        dom.calendarDaysGrid.appendChild(el);
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    if (dom.btnViewList) dom.btnViewList.onclick = () => navigateTo('list');
    if (dom.btnViewCalendar) dom.btnViewCalendar.onclick = () => navigateTo('calendar');
    if (dom.btnNewEntry) dom.btnNewEntry.onclick = () => openEntry();
    // --- Settings ---
    // --- Settings ---
    if (dom.btnSettings) {
        dom.btnSettings.addEventListener('click', () => {
            // Clear password fields on open
            if (dom.inputCurrentPass) dom.inputCurrentPass.value = '';
            if (dom.inputNewPass) dom.inputNewPass.value = '';
            if (dom.modalSettings) {
                dom.modalSettings.classList.remove('hidden');
                void dom.modalSettings.offsetWidth;
                dom.modalSettings.classList.add('active');
            }
        });
    }

    if (dom.btnCloseSettings) {
        dom.btnCloseSettings.addEventListener('click', () => {
            if (dom.modalSettings) dom.modalSettings.classList.remove('active');
            showToast('設定を保存しました');
        });
    }

    // Secure Password Change
    if (dom.btnUpdatePass) {
        dom.btnUpdatePass.addEventListener('click', async () => {
            const currentPassInput = dom.inputCurrentPass ? dom.inputCurrentPass.value : '';
            const newPassInput = dom.inputNewPass ? dom.inputNewPass.value : '';
            const storedPass = localStorage.getItem('masterPassword') || '';

            // 1. Verify Current Password (if one exists)
            if (storedPass && currentPassInput !== storedPass) {
                alert('現在のパスワードが間違っています。');
                return;
            }

            if (!newPassInput) {
                alert('新しいパスワードを入力してください。');
                return;
            }

            // 2. Google Re-authentication
            if (!auth.currentUser) {
                alert('ログインしていません。');
                return;
            }

            try {
                dom.btnUpdatePass.disabled = true;
                dom.btnUpdatePass.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 認証中...';

                await auth.currentUser.reauthenticateWithPopup(googleProvider);

                // 3. Update Password
                localStorage.setItem('masterPassword', newPassInput);
                appState.masterPassword = newPassInput;
                alert('本人確認が完了しました。\nパスワードを変更しました。');

                // Clear fields
                dom.inputCurrentPass.value = '';
                dom.inputNewPass.value = '';
            } catch (e) {
                console.error("Re-auth failed", e);
                alert('認証に失敗しました。パスワードは変更されませんでした。\n' + e.message);
            } finally {
                dom.btnUpdatePass.disabled = false;
                dom.btnUpdatePass.innerHTML = '<i class="fa-brands fa-google"></i> Google認証して変更';
            }
        });
    }
    if (dom.btnThemeToggle) dom.btnThemeToggle.onclick = () => {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        applyTheme(appState.theme);
        localStorage.setItem('theme', appState.theme);
    };

    if (dom.btnMyPage) dom.btnMyPage.onclick = () => navigateTo('mypage');

    // Auth
    if (dom.btnLogin) {
        dom.btnLogin.addEventListener('click', async () => {
            if (window.location.protocol === 'file:') {
                alert("【重要】\nこのアプリをフォルダから直接開いています（file://）。\nGoogleログインは「ローカルサーバー」経由でないと動作しません。\n\nVS Codeの「Live Server」機能を使って開いてください。");
                return;
            }

            if (!auth || !googleProvider) {
                showToast('ログイン設定エラー: APIキーを確認してください', 'error');
                return;
            }
            try {
                await auth.signInWithPopup(googleProvider);
            }
            catch (e) {
                console.error(e);
                let msg = 'ログイン失敗: ' + e.message;
                if (e.code === 'auth/operation-not-allowed-in-this-environment' || e.message.includes('file://')) {
                    msg = '【エラー】\nブラウザのセキュリティ制限により、ファイルから直接開くとGoogleログインは使えません。\n\n必ず「Live Server」などのローカルサーバーを使用してください。';
                    alert(msg);
                } else if (e.code === 'auth/popup-blocked') {
                    msg = '【エラー】\nポップアップがブロックされました。ブラウザの設定で許可してください。';
                    alert(msg);
                } else {
                    alert(msg); // Force alert for other errors too
                }
                showToast(msg, 'error');
            }
        });
    }

    if (dom.btnLogout) dom.btnLogout.onclick = async () => {
        if (!auth) return;
        try { await auth.signOut(); }
        catch (e) { showToast('ログアウト失敗', 'error'); }
    };

    // Search
    if (dom.searchInput) dom.searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        Array.from(dom.entryListContainer.children).forEach(card => {
            if (card.classList.contains('empty-state')) return;
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });

    // Editor Actions
    if (dom.btnSave) dom.btnSave.onclick = async () => {
        if (!dom.inputContent.value.trim() && !currentUploadImage) return showToast('内容を入力してください', 'error');

        // 1. Prepare Entry Object
        let entry;
        if (appState.activeEntryId) {
            entry = appState.entries.find(e => e.id === appState.activeEntryId);
            if (!entry) return showToast('エラー: 編集中の日記が見つかりません', 'error');
            entry.content = dom.inputContent.value;
            if (dom.selectLockStatus) entry.isLocked = dom.selectLockStatus.value === 'locked';
        } else {
            entry = {
                id: Date.now().toString(),
                content: dom.inputContent.value,
                date: appState.writingDate.toISOString(),
                isLocked: dom.selectLockStatus ? dom.selectLockStatus.value === 'locked' : false,
                isNew: true
            };
        }
        if (currentUploadImage) entry.image = currentUploadImage;

        // 2. Initial Save (Critical Step)
        dom.btnSave.disabled = true;
        dom.btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';

        try {
            const success = await saveEntryToFirestore(entry);

            if (success) {
                showToast('日記を保存しました');

                // 3. AI Analysis (Secondary Step)
                if (!entry.isLocked && !entry.aiScore) {
                    showToast('AI分析を開始します...');
                    try {
                        const aiResult = await analyzeDiary(entry.content);
                        if (aiResult) {
                            const updatedEntry = appState.entries.find(e => e.id === entry.id);
                            if (updatedEntry) {
                                updatedEntry.title = aiResult.title;
                                updatedEntry.aiAdvice = aiResult.advice;
                                updatedEntry.aiScore = aiResult.score;
                                await saveEntryToFirestore(updatedEntry);
                                showToast('AI分析が完了しました！');
                            }
                        }
                    } catch (e) {
                        console.error(e);
                        showToast('AI分析に失敗しましたが、日記は保存されています', 'warn');
                    }
                }
                // 4. Navigate to details
                openEntry(entry.id);
            }
        } catch (e) {
            console.error("Critical Save Error:", e);
            alert("予期せぬエラーで保存できませんでした: " + e.message);
        } finally {
            // ALWAYS Reset Button
            if (dom.btnSave) {
                dom.btnSave.disabled = false;
                dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> 保存';
            }
        }
    };

    if (dom.btnDeleteEntry) {
        dom.btnDeleteEntry.onclick = () => {
            console.log("Delete Button Clicked. Active Entry:", appState.activeEntryId);
            if (dom.modalDelete) {
                dom.modalDelete.classList.remove('hidden'); // Ensure hidden class is removed
                // Force a reflow before adding active for transition
                void dom.modalDelete.offsetWidth;
                dom.modalDelete.classList.add('active');
            } else {
                console.error("Delete Modal DOM not found!");
            }
        };
    }
    if (dom.btnCancelDelete) dom.btnCancelDelete.onclick = () => { if (dom.modalDelete) dom.modalDelete.classList.remove('active'); };
    if (dom.btnConfirmDelete) dom.btnConfirmDelete.onclick = async () => {
        if (appState.activeEntryId) {
            dom.btnConfirmDelete.disabled = true;
            dom.btnConfirmDelete.textContent = "削除中...";
            await deleteEntryFromFirestore(appState.activeEntryId);
            dom.btnConfirmDelete.disabled = false;
            dom.btnConfirmDelete.textContent = "削除する";
            if (dom.modalDelete) dom.modalDelete.classList.remove('active');
            navigateTo('list');
        }
    };
    if (dom.btnEditEntry) dom.btnEditEntry.onclick = () => toggleEditMode(true);
    if (dom.btnUnlockEntry) dom.btnUnlockEntry.onclick = unlockEntry;

    if (dom.btnUploadImage) dom.btnUploadImage.onclick = () => dom.entryImageInput.click();
    if (dom.entryImageInput) dom.entryImageInput.onchange = (e) => handleImageUpload(e.target.files[0]);
    if (dom.btnRemoveImage) dom.btnRemoveImage.onclick = () => {
        currentUploadImage = null;
        if (dom.imagePreview) dom.imagePreview.src = '';
        if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden');
        if (appState.activeEntryId) {
            const entry = appState.entries.find(e => e.id === appState.activeEntryId);
            if (entry) { entry.image = null; }
        }
    };

    // --- Helper: Shared Password Reset Logic ---
    const resetPasswordViaGoogleAuth = async (btnElement) => {
        if (!auth.currentUser) {
            alert('本人確認のため、まずはGoogleアカウントでログインしてください。');
            return;
        }

        // Confirm first
        if (!confirm('Googleアカウントで本人確認を行い、パスワードをリセットしますか？')) return;

        const originalText = btnElement ? btnElement.innerHTML : '';
        try {
            if (btnElement) {
                btnElement.disabled = true;
                btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 認証中...';
            }

            // Re-authenticate (Prove you own the email)
            await auth.currentUser.reauthenticateWithPopup(googleProvider);

            // Auth Successful -> Show Custom Modal (No more prompt)
            if (dom.modalReset) {
                if (dom.inputResetNewPass) dom.inputResetNewPass.value = ''; // Clear previous
                dom.modalReset.classList.remove('hidden');
                void dom.modalReset.offsetWidth;
                dom.modalReset.classList.add('active');

                // Focus input
                setTimeout(() => dom.inputResetNewPass && dom.inputResetNewPass.focus(), 100);
            }

        } catch (e) {
            console.error("Reset failed", e);
            alert('認証に失敗したため、パスワードリセットできませんでした。\n' + e.message);
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = originalText;
            }
        }
    };

    // Modal Events
    if (dom.btnSaveReset) {
        dom.btnSaveReset.onclick = () => {
            const newPass = dom.inputResetNewPass ? dom.inputResetNewPass.value : '';

            appState.masterPassword = newPass;
            localStorage.setItem('masterPassword', newPass);

            let msg = 'パスワードを更新しました。';
            if (newPass === '') msg = 'パスワードを解除しました（空欄）。';
            alert(msg);

            // Update various inputs if they exist
            if (dom.inputUnlockPass) dom.inputUnlockPass.value = newPass;
            if (dom.inputCurrentPass) dom.inputCurrentPass.value = newPass;
            if (dom.inputNewPass) dom.inputNewPass.value = '';

            if (dom.modalReset) dom.modalReset.classList.remove('active');
        };
    }

    if (dom.btnCancelReset && dom.modalReset) {
        dom.btnCancelReset.onclick = () => {
            dom.modalReset.classList.remove('active');
            alert('パスワードリセットをキャンセルしました。');
        };
    }

    // Bind triggers
    if (dom.btnForgotPass) {
        dom.btnForgotPass.onclick = () => resetPasswordViaGoogleAuth(dom.btnForgotPass);
    }

    if (dom.btnForgotPassSettings) {
        dom.btnForgotPassSettings.onclick = (e) => {
            e.preventDefault();
            resetPasswordViaGoogleAuth(dom.btnForgotPassSettings);
        };
    }

    if (dom.btnPrevMonth) dom.btnPrevMonth.onclick = () => { appState.calendarDate.setMonth(appState.calendarDate.getMonth() - 1); renderCalendar(); };
    if (dom.btnNextMonth) dom.btnNextMonth.onclick = () => { appState.calendarDate.setMonth(appState.calendarDate.getMonth() + 1); renderCalendar(); };

    if (autoResizeTextarea && dom.inputContent) {
        ['input', 'focus', 'change', 'keydown', 'paste', 'cut'].forEach(evt => {
            dom.inputContent.addEventListener(evt, () => setTimeout(autoResizeTextarea, 0));
        });
        window.addEventListener('resize', autoResizeTextarea);
    }
} // End of setupEventListeners

// --- AI Logic ---
const GEMINI_API_KEY = "AIzaSyB0ONgIPWhuOSIqvuCsxVJ_88QySnQ3WBQ";

async function analyzeDiary(text) {
    // Use the provided key directly
    const apiKey = GEMINI_API_KEY;

    const prompt = `あなたはメンタルケアの専門家です。以下の日記を分析し、JSON形式で出力してください。
    評価基準（各100点満点）:
    1. time: 時間の使い方、充実度
    2. quality: 内容の深さ、気づき
    3. enjoyment: 楽しさ、ポジティブさ
    
    出力フォーマット:
    {
      "title": "日記のタイトル（15文字以内）",
      "score": { "total": 総合点(平均), "breakdown": { "time": 点数, "quality": 点数, "enjoyment": 点数 } },
      "advice": "短いフィードバック（100文字以内、優しく）"
    }
    
    日記本文: ${text}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout

        // Update to gemini-2.0-flash as requested
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            // Likely safety block
            console.warn("AI Safety Block or Empty Response", data);
            showToast('AIが日記の内容を不適切と判断し、分析をスキップしました', 'warn');
            return null;
        }

        const rawText = data.candidates[0].content.parts[0].text;
        // Robust JSON extraction: Find content between first { and last }
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        return JSON.parse(jsonMatch[0]);

    } catch (e) {
        console.error("AI Analysis Failed:", e);
        if (e.name === 'AbortError') { alert('AI分析がタイムアウトしました。通信環境を確認してください。'); }
        else { alert('AI分析エラー: ' + e.message); }
        return null; // Return null handled gracefully by caller
    }
}

// --- Utilities (Global Scope) ---

const autoResizeTextarea = () => {
    if (!dom.inputContent) return;
    dom.inputContent.style.height = 'auto';
    dom.inputContent.style.overflowY = 'hidden';
    const newHeight = dom.inputContent.scrollHeight + 20;
    dom.inputContent.style.height = newHeight + 'px';
};

function showToast(msg, type = 'success') {
    if (!dom.toastContainer) return;
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-check-circle'}" style="color:${type === 'error' ? '#ff6b6b' : 'var(--accent)'}"></i> ${msg}`; dom.toastContainer.appendChild(t); setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}
function applyTheme(t) {
    if (!dom || !dom.body) return;
    dom.body.setAttribute('data-theme', t);
    if (dom.btnThemeToggle) dom.btnThemeToggle.innerHTML = t === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun text-warning"></i>';
}
function formatDate(d) { return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }); }
function formatTime(d) { return new Date(d).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }); }

window.app = {
    navigateTo: navigateTo,
    retryAnalysis: retryAnalysisHelper,
    autoResize: autoResizeTextarea
};

// Start
init();
