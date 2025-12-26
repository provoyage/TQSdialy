/**
 * TQS Diary - Core Logic (Final)
 * Firebase Integration, AI Analysis, and Local Storage Fallbacks.
 */

// --- FIREBASE SETUP ---
// NOTE: firebaseConfig, auth, db, googleProvider are defined in firebase-config.js
// which MUST be loaded before this file.

if (typeof auth === 'undefined' && typeof window.auth === 'undefined') {
    console.error("CRITICAL: 'auth' is undefined.");
    // Fallback check
    window.addEventListener('load', () => {
        if (!window.auth) {
            alert('System error: Firebase failed to initialize. Please reload and check network settings.');
        }
    });
}

// --- State Management ---
const appState = {
    user: null,
    entries: [],
    analysisById: {},
    analysisStatusById: {},
    similarById: {},
    filters: {
        dateFrom: '',
        dateTo: '',
        emotion: 'all',
        pattern: 'all',
        trigger: '',
        query: ''
    },
    period: '7d',
    summaryText: '',
    summaryPeriod: '',
    summaryUpdatedAt: null,
    summaryUpdating: false,
    themes: [],
    currentView: 'list',
    activeEntryId: null,
    writingDate: null,
    theme: localStorage.getItem('theme') || 'dark',
    calendarDate: new Date(),
    apiBase: localStorage.getItem('self_os_api_base') || '',
    filterByDate: null,
    masterPassword: localStorage.getItem('masterPassword') || '',
    userProfile: { mbti: '' },
    userProfileLoaded: false
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
    inputApiBase: getEl('input-api-base'),
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
    selectCalendarYear: getEl('select-calendar-year'),
    selectCalendarMonth: getEl('select-calendar-month'),
    searchInput: getEl('search-input'),
    filterDateFrom: getEl('filter-date-from'),
    filterDateTo: getEl('filter-date-to'),
    filterEmotion: getEl('filter-emotion'),
    filterPattern: getEl('filter-pattern'),
    filterTrigger: getEl('filter-trigger'),
    btnApplyFilters: getEl('btn-apply-filters'),
    btnResetFilters: getEl('btn-reset-filters'),

    // MyPage
    btnMyPage: getEl('btn-mypage'),
    viewMyPage: getEl('view-mypage'),
    mypageContainer: getEl('mypage-container'),

    // Auth UI
    btnLogin: getEl('btn-login'),
    btnLogout: getEl('btn-logout'),
    userProfileSection: getEl('user-profile-section'),
    userAvatar: getEl('user-avatar'),
    userName: getEl('user-name'),
    analysisPanel: getEl('analysis-panel')
};

let currentUploadImage = null;

const EMOTION_ORDER = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];
const EMOTION_LABELS = {
    joy: '\u559c\u3073',
    trust: '\u4fe1\u983c',
    fear: '\u6050\u308c',
    surprise: '\u9a5a\u304d',
    sadness: '\u60b2\u3057\u307f',
    disgust: '\u5acc\u60aa',
    anger: '\u6012\u308a',
    anticipation: '\u671f\u5f85'
};

const EMOTION_COLORS = {
    joy: '#F6C343',
    trust: '#6FCF97',
    fear: '#56A3D9',
    surprise: '#F2994A',
    sadness: '#4A6FA5',
    disgust: '#27AE60',
    anger: '#EB5757',
    anticipation: '#9B51E0'
};
const EMOTION_IMAGE_PATH = 'image/kanjouchart.png';
const MBTI_TYPES = [
    'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
    'ISTP', 'ISFP', 'INFP', 'INTP',
    'ESTP', 'ESFP', 'ENFP', 'ENTP',
    'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
];
const EMOTION_KEY_ALIASES = {
    joy: 'joy',
    trust: 'trust',
    fear: 'fear',
    surprise: 'surprise',
    sadness: 'sadness',
    disgust: 'disgust',
    anger: 'anger',
    anticipation: 'anticipation'
};

const PATTERN_CATALOG = [
    { id: 'jump_to_conclusion', label: '結論の飛躍', desc: '根拠が少ないまま結論を出す' },
    { id: 'overgeneralization', label: '過度の一般化', desc: '一度の出来事で全体を決めつける' },
    { id: 'black_and_white', label: '白黒思考', desc: '極端に捉える' },
    { id: 'emotional_reasoning', label: '感情で決めつけ', desc: '気分を事実だとみなす' },
    { id: 'self_blame', label: '自己否定', desc: '自分のせいだと決めつける' },
    { id: 'mind_reading', label: '他者の意図の読みすぎ', desc: '相手の意図を決めつける' },
    { id: 'catastrophizing', label: '未来の悲観', desc: '悪い結果を決めつける' },
    { id: 'magnification_minimization', label: '拡大・過小評価', desc: '悪い点は大きく、良い点は小さく見る' },
    { id: 'should_statements', label: 'べき思考', desc: '〜すべきで縛る' },
    { id: 'negative_filter', label: 'ネガティブ抽出', desc: '悪い点だけに注目する' },
    { id: 'comparison_inferiority', label: '比較・劣等感', desc: '他人と比べて自分を下げる' },
    { id: 'avoidance_procrastination', label: '回避・先延ばし', desc: '不安や負担から行動を避ける' }
];

const PATTERN_ALIASES = {
    inference_jump: 'jump_to_conclusion',
    jump_to_conclusion: 'jump_to_conclusion',
    '結論飛躍': 'jump_to_conclusion',
    '結論の飛躍': 'jump_to_conclusion',
    overgeneralization: 'overgeneralization',
    '過度の一般化': 'overgeneralization',
    black_and_white: 'black_and_white',
    all_or_nothing: 'black_and_white',
    'all-or-nothing': 'black_and_white',
    '白黒思考': 'black_and_white',
    emotional_reasoning: 'emotional_reasoning',
    '感情で決めつけ': 'emotional_reasoning',
    '感情的決めつけ': 'emotional_reasoning',
    self_blame: 'self_blame',
    'self-blame': 'self_blame',
    '自己否定': 'self_blame',
    '自己責任化': 'self_blame',
    mind_reading: 'mind_reading',
    'mind-reading': 'mind_reading',
    '他者の意図の読みすぎ': 'mind_reading',
    '読心': 'mind_reading',
    catastrophizing: 'catastrophizing',
    '未来の悲観': 'catastrophizing',
    '最悪予測': 'catastrophizing',
    magnification_minimization: 'magnification_minimization',
    '拡大・過小評価': 'magnification_minimization',
    '拡大': 'magnification_minimization',
    '過小評価': 'magnification_minimization',
    should_statements: 'should_statements',
    'べき思考': 'should_statements',
    negative_filter: 'negative_filter',
    'ネガティブ抽出': 'negative_filter',
    'ネガティブフィルター': 'negative_filter',
    '選択的注目': 'negative_filter',
    comparison_inferiority: 'comparison_inferiority',
    '比較・劣等感': 'comparison_inferiority',
    '比較': 'comparison_inferiority',
    '劣等感': 'comparison_inferiority',
    avoidance_procrastination: 'avoidance_procrastination',
    '回避・先延ばし': 'avoidance_procrastination',
    '回避': 'avoidance_procrastination',
    '先延ばし': 'avoidance_procrastination'
};

const PATTERN_MAP = PATTERN_CATALOG.reduce((acc, item) => {
    acc[item.id] = item;
    acc[item.label] = item;
    return acc;
}, {});

function normalizePatternId(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const alias = PATTERN_ALIASES[lower] || PATTERN_ALIASES[raw];
    const key = alias || lower;
    if (PATTERN_MAP[key]) return PATTERN_MAP[key].id;
    if (PATTERN_MAP[raw]) return PATTERN_MAP[raw].id;
    return null;
}

function getPatternEntry(pattern) {
    if (!pattern) return null;
    const raw = typeof pattern === 'string'
        ? pattern
        : (pattern.pattern_id || pattern.label || pattern.id || null);
    const id = normalizePatternId(raw);
    return id ? PATTERN_MAP[id] : null;
}

function normalizeEmotionKey(key) {
    if (!key) return null;
    const raw = String(key).trim().toLowerCase();
    return EMOTION_KEY_ALIASES[raw] || EMOTION_KEY_ALIASES[key] || null;
}

// --- Init & Load ---
function init() {
    applyTheme(appState.theme);

    // Auth Listener
    // Auth Listener
    if (window.auth) {
        window.auth.onAuthStateChanged((user) => {
            if (user) {
                appState.user = user;
                updateAuthUI(true);
                loadEntries();
                loadUserProfile().then(() => {
                    if (appState.currentView === 'mypage') renderMyPage();
                });
                showToast(`ようこそ、${user.displayName}さん`);
            } else {
                appState.user = null;
                appState.entries = [];
                appState.userProfile = { mbti: '' };
                appState.userProfileLoaded = false;
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
    if (dom.btnSave) {
        dom.btnSave.disabled = !isLoggedIn;
        dom.btnSave.title = isLoggedIn ? '' : '\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044';
    }
}

function setupEventListeners() {
    if (dom.inputApiBase) {
        dom.inputApiBase.value = appState.apiBase || DEFAULT_API_BASE;
        dom.inputApiBase.addEventListener('change', () => {
            appState.apiBase = dom.inputApiBase.value.trim();
            localStorage.setItem('self_os_api_base', appState.apiBase);
        });
    }
    if (dom.btnCloseSettings) {
        dom.btnCloseSettings.addEventListener('click', closeSettingsModal);
    }
    if (dom.btnUpdatePass) {
        dom.btnUpdatePass.addEventListener('click', handleUpdatePassword);
    }
    if (dom.btnForgotPassSettings) {
        dom.btnForgotPassSettings.addEventListener('click', handleForgotPassword);
    }
    if (dom.btnForgotPass) {
        dom.btnForgotPass.addEventListener('click', handleForgotPassword);
    }
    if (dom.btnCancelReset) {
        dom.btnCancelReset.addEventListener('click', closeResetModal);
    }
    if (dom.btnSaveReset) {
        dom.btnSaveReset.addEventListener('click', saveResetPassword);
    }
    if (dom.btnUnlockEntry) {
        dom.btnUnlockEntry.addEventListener('click', unlockEntry);
    }
    if (dom.btnUploadImage && dom.entryImageInput) {
        dom.btnUploadImage.addEventListener('click', () => dom.entryImageInput.click());
    }
    if (dom.entryImageInput) {
        dom.entryImageInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            handleImageUpload(file);
        });
    }
    if (dom.btnRemoveImage) {
        dom.btnRemoveImage.addEventListener('click', () => {
            currentUploadImage = null;
            if (dom.imagePreview) dom.imagePreview.src = '';
            if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden');
            if (dom.entryImageInput) dom.entryImageInput.value = '';
        });
    }
    if (dom.btnPrevMonth) {
        dom.btnPrevMonth.addEventListener('click', () => {
            appState.calendarDate = new Date(appState.calendarDate.getFullYear(), appState.calendarDate.getMonth() - 1, 1);
            renderCalendar();
        });
    }
    if (dom.btnNextMonth) {
        dom.btnNextMonth.addEventListener('click', () => {
            appState.calendarDate = new Date(appState.calendarDate.getFullYear(), appState.calendarDate.getMonth() + 1, 1);
            renderCalendar();
        });
    }
    if (dom.selectCalendarYear) {
        dom.selectCalendarYear.addEventListener('change', syncCalendarFromSelectors);
    }
    if (dom.selectCalendarMonth) {
        dom.selectCalendarMonth.addEventListener('change', syncCalendarFromSelectors);
    }
    if (dom.searchInput) {
        dom.searchInput.value = appState.filters.query || '';
        dom.searchInput.addEventListener('input', () => {
            appState.filters.query = dom.searchInput.value.trim();
            renderEntryList();
        });
    }
    if (dom.filterDateFrom) dom.filterDateFrom.value = appState.filters.dateFrom || '';
    if (dom.filterDateTo) dom.filterDateTo.value = appState.filters.dateTo || '';
    if (dom.filterTrigger) dom.filterTrigger.value = appState.filters.trigger || '';
    if (dom.btnApplyFilters) {
        dom.btnApplyFilters.addEventListener('click', applyFiltersFromUI);
    }
    if (dom.btnResetFilters) {
        dom.btnResetFilters.addEventListener('click', resetFilters);
    }
    if (dom.inputContent) {
        dom.inputContent.addEventListener('input', autoResizeTextarea);
    }
    if (dom.btnLogout) {
        dom.btnLogout.addEventListener('click', handleLogout);
    }

    window.googleLogin = googleLogin;
    window.saveEntryHelper = saveEntryHelper;
    window.cancelEdit = cancelEdit;
    window.requestDeleteEntry = requestDeleteEntry;
    window.confirmDeleteHelper = confirmDeleteHelper;
    window.cancelDeleteHelper = cancelDeleteHelper;

    refreshFilterOptions();
}

function autoResizeTextarea() {
    if (!dom.inputContent) return;
    dom.inputContent.style.height = 'auto';
    dom.inputContent.style.height = `${dom.inputContent.scrollHeight}px`;
}

function syncCalendarFromSelectors() {
    if (!dom.selectCalendarYear || !dom.selectCalendarMonth) return;
    const year = Number(dom.selectCalendarYear.value);
    const month = Number(dom.selectCalendarMonth.value);
    if (!Number.isNaN(year) && !Number.isNaN(month)) {
        appState.calendarDate = new Date(year, month - 1, 1);
        renderCalendar();
    }
}

function applyFiltersFromUI() {
    if (dom.filterDateFrom) appState.filters.dateFrom = dom.filterDateFrom.value;
    if (dom.filterDateTo) appState.filters.dateTo = dom.filterDateTo.value;
    if (dom.filterEmotion) appState.filters.emotion = dom.filterEmotion.value || 'all';
    if (dom.filterPattern) appState.filters.pattern = dom.filterPattern.value || 'all';
    if (dom.filterTrigger) appState.filters.trigger = dom.filterTrigger.value.trim();
    if (dom.searchInput) appState.filters.query = dom.searchInput.value.trim();
    renderEntryList();
}

function resetFilters() {
    appState.filters = {
        dateFrom: '',
        dateTo: '',
        emotion: 'all',
        pattern: 'all',
        trigger: '',
        query: ''
    };
    if (dom.filterDateFrom) dom.filterDateFrom.value = '';
    if (dom.filterDateTo) dom.filterDateTo.value = '';
    if (dom.filterEmotion) dom.filterEmotion.value = 'all';
    if (dom.filterPattern) dom.filterPattern.value = 'all';
    if (dom.filterTrigger) dom.filterTrigger.value = '';
    if (dom.searchInput) dom.searchInput.value = '';
    appState.filterByDate = null;
    renderEntryList();
}

async function googleLogin() {
    if (!window.auth || !window.googleProvider) {
        showToast('Firebaseが初期化されていません', 'error');
        return;
    }
    try {
        await window.auth.signInWithPopup(window.googleProvider);
    } catch (e) {
        console.error('[auth] login failed', { code: e.code, message: e.message });
        showToast('ログインに失敗しました', 'error');
    }
}

async function handleLogout() {
    if (!window.auth) return;
    try {
        await window.auth.signOut();
        showToast('ログアウトしました');
    } catch (e) {
        console.error('[auth] logout failed', { code: e.code, message: e.message });
        showToast('ログアウトに失敗しました', 'error');
    }
}

async function handleUpdatePassword() {
    if (!appState.user || !window.auth || !window.googleProvider) {
        showToast('ログインしてください', 'error');
        return;
    }
    const currentPass = dom.inputCurrentPass ? dom.inputCurrentPass.value : '';
    const nextPass = dom.inputNewPass ? dom.inputNewPass.value : '';
    if (appState.masterPassword && currentPass !== appState.masterPassword) {
        showToast('現在のパスワードが違います', 'error');
        return;
    }
    try {
        await window.auth.currentUser.reauthenticateWithPopup(window.googleProvider);
        appState.masterPassword = nextPass || '';
        if (appState.masterPassword) {
            localStorage.setItem('masterPassword', appState.masterPassword);
        } else {
            localStorage.removeItem('masterPassword');
        }
        if (dom.inputCurrentPass) dom.inputCurrentPass.value = '';
        if (dom.inputNewPass) dom.inputNewPass.value = '';
        showToast('パスワードを更新しました');
    } catch (e) {
        console.error('[auth] reauth failed', { code: e.code, message: e.message });
        showToast('認証に失敗しました', 'error');
    }
}

async function handleForgotPassword() {
    if (!appState.user || !window.auth || !window.googleProvider) {
        showToast('ログインしてください', 'error');
        return;
    }
    try {
        await window.auth.currentUser.reauthenticateWithPopup(window.googleProvider);
        openResetModal();
    } catch (e) {
        console.error('[auth] reset reauth failed', { code: e.code, message: e.message });
        showToast('認証に失敗しました', 'error');
    }
}

function openResetModal() {
    if (!dom.modalReset) return;
    dom.modalReset.classList.remove('hidden');
    dom.modalReset.classList.add('active');
    if (dom.inputResetNewPass) dom.inputResetNewPass.value = '';
}

function closeResetModal() {
    if (!dom.modalReset) return;
    dom.modalReset.classList.add('hidden');
    dom.modalReset.classList.remove('active');
}

function saveResetPassword() {
    const nextPass = dom.inputResetNewPass ? dom.inputResetNewPass.value : '';
    appState.masterPassword = nextPass || '';
    if (appState.masterPassword) {
        localStorage.setItem('masterPassword', appState.masterPassword);
    } else {
        localStorage.removeItem('masterPassword');
    }
    closeResetModal();
    showToast('パスワードを更新しました');
}

function closeSettingsModal() {
    if (!dom.modalSettings) return;
    dom.modalSettings.classList.add('hidden');
    dom.modalSettings.classList.remove('active');
}

async function saveEntryHelper() {
    if (!appState.user) {
        showToast('ログインしてください', 'error');
        return;
    }

    const content = dom.inputContent ? dom.inputContent.value.trim() : '';
    if (!content && !currentUploadImage) {
        showToast('本文を入力してください', 'error');
        return;
    }

    const isLocked = dom.selectLockStatus ? dom.selectLockStatus.value === 'locked' : false;
    const existing = appState.activeEntryId
        ? appState.entries.find(e => e.id === appState.activeEntryId)
        : null;

    const baseDate = existing ? getEntryDate(existing) : (appState.writingDate || new Date());
    const entry = existing ? { ...existing } : { created_at: baseDate };
    entry.content = content;
    entry.text = content;
    entry.image = currentUploadImage || null;
    entry.isLocked = isLocked;
    entry.locked = isLocked;
    entry.created_at = entry.created_at || baseDate;

    const isNew = !entry.id;
    const entryId = await saveEntryToFirestore(entry);
    if (!entryId) return;

    entry.id = entryId;
    const index = appState.entries.findIndex(e => e.id === entryId);
    if (index >= 0) {
        appState.entries[index] = entry;
    } else {
        appState.entries.unshift(entry);
    }
    appState.activeEntryId = entryId;
    appState.writingDate = baseDate;

    showToast('保存しました');
    openEntry(entryId);
    renderEntryList();
    if (appState.currentView === 'calendar') renderCalendar();
    if (appState.currentView === 'mypage') renderMyPage();

    await runAnalysisForEntry(entry, !isNew);
}

function cancelEdit() {
    if (appState.activeEntryId) {
        openEntry(appState.activeEntryId);
    } else {
        navigateTo('list');
    }
}

function requestDeleteEntry() {
    if (!appState.activeEntryId || !dom.modalDelete) return;
    dom.modalDelete.classList.remove('hidden');
    dom.modalDelete.classList.add('active');
}

function cancelDeleteHelper() {
    if (!dom.modalDelete) return;
    dom.modalDelete.classList.add('hidden');
    dom.modalDelete.classList.remove('active');
}

async function confirmDeleteHelper() {
    const entryId = appState.activeEntryId;
    if (!entryId) return;
    cancelDeleteHelper();
    await deleteEntryFromFirestore(entryId);
    appState.activeEntryId = null;
    navigateTo('list');
}

// --- Firestore Data Operations ---

async function loadEntries() {
    const db = window.db;
    if (!appState.user || !db) return;
    try {
        const userId = appState.user.uid;
        const entriesMap = new Map();

        const fetchEntries = async (userField, orderField) => {
            try {
                return await db.collection('diary_entries')
                    .where(userField, '==', userId)
                    .orderBy(orderField, 'desc')
                    .get();
            } catch (err) {
                const message = String(err && err.message ? err.message : '');
                if (err && (err.code === 'failed-precondition' || message.includes('index'))) {
                    return await db.collection('diary_entries')
                        .where(userField, '==', userId)
                        .get();
                }
                throw err;
            }
        };

        const queries = [
            fetchEntries('userId', 'createdAt'),
            fetchEntries('user_id', 'created_at')
        ];

        const results = await Promise.allSettled(queries);
        results.forEach((result) => {
            if (result.status !== 'fulfilled') return;
            result.value.forEach((doc) => {
                const data = doc.data() || {};
                entriesMap.set(doc.id, {
                    id: doc.id,
                    userId: data.userId || data.user_id || null,
                    user_id: data.user_id || data.userId || null,
                    createdAt: data.createdAt || null,
                    created_at: data.created_at || data.date || null,
                    text: data.text || '',
                    content: data.text || data.content || '',
                    image: data.image || null,
                    locked: data.locked || data.isLocked || false,
                    isLocked: data.locked || data.isLocked || false,
                    meta: data.meta || {}
                });
            });
        });

        appState.entries = Array.from(entriesMap.values())
            .sort((a, b) => getEntryDate(b) - getEntryDate(a));

        await loadAnalysesForEntries(appState.entries.map(e => e.id));
        refreshFilterOptions();
        renderEntryList();
        if (appState.currentView === 'mypage') renderMyPage();
    } catch (e) {
        console.error('Error loading entries:', e);
        showToast('\u65e5\u8a18\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
    }
}

async function loadAnalysesForEntries(entryIds) {
    const db = window.db;
    if (!appState.user || !db) return;
    appState.analysisById = {};
    for (const entryId of entryIds) {
        if (!entryId) continue;
        try {
            const doc = await db.collection('diary_analysis').doc(entryId).get();
            if (doc.exists) {
                appState.analysisById[entryId] = doc.data();
            }
        } catch (e) {
            console.error('Error loading analysis:', e);
        }
    }
}

function refreshFilterOptions() {
    if (dom.filterEmotion) {
        dom.filterEmotion.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = '\u611f\u60c5: \u3059\u3079\u3066';
        dom.filterEmotion.appendChild(optAll);
        EMOTION_ORDER.forEach((k) => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = EMOTION_LABELS[k];
            dom.filterEmotion.appendChild(opt);
        });
        dom.filterEmotion.value = appState.filters.emotion || 'all';
    }

    if (dom.filterPattern) {
        dom.filterPattern.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = '\u8a8d\u77e5\u30d1\u30bf\u30fc\u30f3: \u3059\u3079\u3066';
        dom.filterPattern.appendChild(optAll);
        PATTERN_CATALOG.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.label;
            dom.filterPattern.appendChild(opt);
        });
        const selected = normalizePatternId(appState.filters.pattern);
        dom.filterPattern.value = selected || 'all';
        appState.filters.pattern = dom.filterPattern.value;
    }
}

async function loadUserProfile() {
    const db = window.db;
    if (!db || !appState.user) return;
    try {
        const doc = await db.collection('users').doc(appState.user.uid).get();
        appState.userProfile = doc.exists ? (doc.data() || { mbti: '' }) : { mbti: '' };
        appState.userProfileLoaded = true;
    } catch (e) {
        console.warn('Error loading user profile:', e);
        appState.userProfile = { mbti: '' };
        appState.userProfileLoaded = true;
    }
}

async function saveUserProfile(update) {
    const db = window.db;
    if (!db || !appState.user) return;
    appState.userProfile = { ...(appState.userProfile || {}), ...update };
    try {
        await db.collection('users').doc(appState.user.uid).set(appState.userProfile, { merge: true });
    } catch (e) {
        console.warn('Error saving user profile:', e);
    }
}

async function saveEntryToFirestore(entry) {
    const auth = window.auth;
    const db = window.db;

    if (!auth || !auth.currentUser || !db) {
        alert('ログイン状態を確認できません。再読み込みしてください。');
        return false;
    }

    const serverTimestamp = getServerTimestamp();
    const entryData = {
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp,
        created_at: getEntryDate(entry).toISOString(),
        text: entry.content || entry.text || '',
        image: entry.image || null,
        locked: entry.isLocked || entry.locked || false,
        meta: entry.meta || {}
    };

    try {
        console.info('[save] diary_entries start', { entryId: entry.id || null, userId: auth.currentUser.uid });
        const entriesRef = db.collection('diary_entries');
        if (entry.id) {
            await entriesRef.doc(entry.id).set(entryData, { merge: true });
        } else {
            const docRef = await entriesRef.add(entryData);
            entry.id = docRef.id;
        }
        console.info('[save] diary_entries ok', { entryId: entry.id });
        return entry.id;
    } catch (e) {
        console.error('[save] diary_entries failed', { stage: 'entry', code: e.code, message: e.message });
        alert('保存に失敗しました: ' + e.message);
        return false;
    }
}

async function deleteEntryFromFirestore(entryId) {
    const db = window.db;
    if (!appState.user || !db) return;
    try {
        const relatedDeletes = await Promise.allSettled([
            db.collection('diary_analysis').doc(entryId).delete(),
            db.collection('diary_embeddings').doc(entryId).delete()
        ]);
        relatedDeletes.forEach((result) => {
            if (result.status === 'rejected') {
                console.warn('[delete] related delete failed', { entryId, message: result.reason?.message });
            }
        });

        await db.collection('diary_entries').doc(entryId).delete();
        await loadEntries();
        showToast('日記を削除しました');
    } catch (e) {
        console.error('Delete Error:', e);
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

function getPeriodConfig(periodKey) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (periodKey === '30d') {
        const from = new Date(end);
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        return { label: '\u0033\u0030\u65e5', from, to: end };
    }
    if (periodKey === '90d') {
        const from = new Date(end);
        from.setDate(from.getDate() - 89);
        from.setHours(0, 0, 0, 0);
        return { label: '\u0039\u0030\u65e5', from, to: end };
    }
    if (periodKey === 'all') {
        return { label: '\u5168\u671f\u9593', from: null, to: end };
    }
    const from = new Date(end);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { label: '\u0037\u65e5', from, to: end };
}

function filterEntriesByPeriod(entries, from) {
    if (!from) return [...entries];
    return entries.filter((e) => {
        const date = getEntryDate(e);
        return date >= from;
    });
}

function computeStreakStats(entries) {
    if (!entries.length) return { streak: 0, longestStreak: 0 };
    const dateSet = new Set(entries.map((e) => getEntryDate(e).toDateString()));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
        if (dateSet.has(cursor.toDateString())) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
            continue;
        }
        break;
    }

    const uniqueDates = Array.from(dateSet).map((d) => {
        const dt = new Date(d);
        return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }).sort((a, b) => a - b);
    let longestStreak = 0;
    let run = 0;
    let prev = null;
    uniqueDates.forEach((d) => {
        if (prev && (d - prev) === 86400000) {
            run += 1;
        } else {
            run = 1;
        }
        if (run > longestStreak) longestStreak = run;
        prev = d;
    });

    return { streak, longestStreak };
}

function aggregateStats(entries) {
    const totalCount = entries.length;
    const totalChars = entries.reduce((sum, e) => sum + ((e.content || '').length), 0);
    const streakStats = computeStreakStats(entries);

    const emotionCounts = {};
    const patternCounts = {};
    const triggerCounts = {};
    let analyzedCount = 0;

    entries.forEach((entry) => {
        const analysis = appState.analysisById[entry.id];
        if (!analysis) return;
        analyzedCount += 1;

        const topEmotion = getTopEmotion(analysis);
        if (topEmotion) {
            emotionCounts[topEmotion.key] = (emotionCounts[topEmotion.key] || 0) + 1;
        }

        const patternsList = Array.isArray(analysis.patterns)
            ? analysis.patterns
            : (analysis.patterns ? Object.values(analysis.patterns) : []);
        patternsList.forEach((p) => {
            const entry = getPatternEntry(p);
            if (!entry) return;
            patternCounts[entry.id] = (patternCounts[entry.id] || 0) + 1;
        });

        (analysis.triggers || []).forEach((t) => {
            const label = String(t || '').trim();
            if (!label) return;
            triggerCounts[label] = (triggerCounts[label] || 0) + 1;
        });
    });

    const emotionsSorted = Object.keys(emotionCounts)
        .map((key) => ({ key, count: emotionCounts[key] }))
        .sort((a, b) => b.count - a.count);

    const patternsSorted = Object.keys(patternCounts)
        .map((id) => ({
            id,
            label: PATTERN_MAP[id]?.label || id,
            count: patternCounts[id]
        }))
        .sort((a, b) => b.count - a.count);

    const triggersSorted = Object.keys(triggerCounts)
        .map((label) => ({ label, count: triggerCounts[label] }))
        .sort((a, b) => b.count - a.count);

    return {
        totalCount,
        totalChars,
        streak: streakStats.streak,
        longestStreak: streakStats.longestStreak,
        analyzedCount,
        emotionCounts,
        emotionsSorted,
        patternsSorted,
        triggersSorted
    };
}

function renderRankList(items, unit) {
    if (!items.length) {
        return `<div class="rank-empty">未集計</div>`;
    }
    return `<div class="rank-list">${items.map((item, idx) => {
        const value = unit ? `${item.value}${unit}` : String(item.value);
        return `
            <div class="rank-row">
                <span class="rank-index">${idx + 1}</span>
                <span class="rank-label">${escapeHtml(item.label)}</span>
                <span class="rank-value">${value}</span>
            </div>
        `;
    }).join('')}</div>`;
}

async function requestSummaryUpdate(periodKey, periodLabel, stats) {
    if (appState.summaryUpdating) return;
    appState.summaryUpdating = true;
    renderMyPage();
    try {
        const topEmotion = stats.emotionsSorted[0] ? EMOTION_LABELS[stats.emotionsSorted[0].key] : '';
        const topPattern = stats.patternsSorted[0] ? stats.patternsSorted[0].label : '';
        const emotionTop5 = stats.emotionsSorted.slice(0, 5).map((e) => ({
            label: EMOTION_LABELS[e.key] || e.key,
            value: e.count
        }));
        const patternTop5 = stats.patternsSorted.slice(0, 5).map((p) => ({
            label: p.label,
            value: p.count
        }));

        const result = await apiPost('/api/summary', {
            period_label: periodLabel,
            top_emotion: topEmotion,
            top_pattern: topPattern,
            emotion_top5: emotionTop5,
            pattern_top5: patternTop5
        });

        appState.summaryText = result.summary || '';
        appState.themes = Array.isArray(result.themes) ? result.themes : [];
        appState.summaryPeriod = periodKey;
        appState.summaryUpdatedAt = new Date().toISOString();
    } catch (e) {
        showToast('要約の更新に失敗しました', 'error');
    } finally {
        appState.summaryUpdating = false;
        renderMyPage();
    }
}

function renderMyPage() {
    if (!dom.mypageContainer) return;
    const periodKey = appState.period || '7d';
    const periodConfig = getPeriodConfig(periodKey);
    const filtered = filterEntriesByPeriod(appState.entries || [], periodConfig.from)
        .sort((a, b) => getEntryDate(b) - getEntryDate(a));
    const stats = aggregateStats(filtered);

    const topEmotion = stats.emotionsSorted[0];
    const topEmotionLabel = topEmotion ? (EMOTION_LABELS[topEmotion.key] || topEmotion.key) : '未集計';
    const emotionTotal = stats.analyzedCount || 0;
    const topEmotionPct = emotionTotal ? Math.round((topEmotion.count / emotionTotal) * 100) : 0;
    const topEmotionValue = emotionTotal ? `${topEmotionLabel} ${topEmotionPct}%` : '未集計';

    const topPattern = stats.patternsSorted[0];
    const topPatternValue = topPattern ? `${topPattern.label} (${topPattern.count})` : '未集計';

    const summaryAvailable = appState.summaryPeriod === periodKey && appState.summaryText;
    const summaryText = summaryAvailable ? appState.summaryText : '要約は未更新です。';
    const themes = summaryAvailable ? appState.themes : [];

    const emotionTop5 = stats.emotionsSorted.slice(0, 5).map((e) => ({
        label: EMOTION_LABELS[e.key] || e.key,
        value: emotionTotal ? Math.round((e.count / emotionTotal) * 100) + '%' : '0%'
    }));
    const patternTop5 = stats.patternsSorted.slice(0, 5).map((p) => ({
        label: p.label,
        value: p.count
    }));
    const triggerTop10 = stats.triggersSorted.slice(0, 10).map((t) => ({
        label: t.label,
        value: t.count
    }));
    const patternCatalogHtml = PATTERN_CATALOG.map((p) => `
        <li class="pattern-item">
            <div class="pattern-label">${escapeHtml(p.label)}</div>
            <div class="pattern-desc">${escapeHtml(p.desc)}</div>
        </li>
    `).join('');
    const mbtiValue = appState.userProfile?.mbti || '';
    const mbtiDisplay = mbtiValue ? mbtiValue : '未設定';
    const personalityInsight = buildDiaryPersonalityInsight(stats);

    const periodButtons = [
        { key: '7d', label: '7日' },
        { key: '30d', label: '30日' },
        { key: '90d', label: '90日' },
        { key: 'all', label: '全期間' }
    ];

    const latestEntry = filtered[0];
    const similar = latestEntry ? (appState.similarById[latestEntry.id] || []) : [];
    const similarItems = similar.map((s) => {
        const ref = appState.entries.find(e => e.id === s.entry_id);
        return {
            id: s.entry_id,
            label: ref ? escapeHtml(ref.content || '').slice(0, 40) : s.entry_id
        };
    });

    const similarHtml = latestEntry
        ? (similarItems.length
            ? `<div class="similar-list">${similarItems.map((s) => `<button class="btn-text-sm" onclick="openEntry('${s.id}')">${s.label}</button>`).join('')}</div>`
            : `<button id="btn-similar-refresh" class="btn-text-sm">類似日記を検索</button>`)
        : `<div class="rank-empty">該当期間の日記がありません</div>`;

    dom.mypageContainer.innerHTML = `
        <div class="mypage-stack">
            <div class="period-selector">
                <div class="period-buttons">
                    ${periodButtons.map((btn) => `
                        <button class="period-btn ${btn.key === periodKey ? 'active' : ''}" data-period="${btn.key}">${btn.label}</button>
                    `).join('')}
                </div>
                <button id="btn-summary-refresh" class="btn-secondary" ${appState.summaryUpdating ? 'disabled' : ''}>${appState.summaryUpdating ? '更新中...' : '要約を更新'}</button>
            </div>

            <div class="stat-card summary-card">
                <div class="summary-header">
                    <h3>今の要約</h3>
                    <span class="summary-period">${periodConfig.label}</span>
                </div>
                <p class="summary-text">${escapeHtml(summaryText)}</p>
            </div>

            <div class="stats-grid" style="width:100%;">
                <div class="stat-card"> <i class="fa-solid fa-book stat-icon"></i> <div class="stat-value">${stats.totalCount}</div> <div class="stat-label">日記の総数</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-fire stat-icon"></i> <div class="stat-value">${stats.streak}</div> <div class="stat-label">連続投稿日数</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-trophy stat-icon"></i> <div class="stat-value">${stats.longestStreak}</div> <div class="stat-label">最長連続投稿日数</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-keyboard stat-icon"></i> <div class="stat-value">${stats.totalChars.toLocaleString('ja-JP')}</div> <div class="stat-label">投稿の総文字数</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-heart stat-icon"></i> <div class="stat-value">${escapeHtml(topEmotionValue)}</div> <div class="stat-label">感情Top1</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-brain stat-icon"></i> <div class="stat-value">${escapeHtml(topPatternValue)}</div> <div class="stat-label">認知パターンTop1</div> </div>
            </div>

            <div class="ranking-grid">
                <div class="stat-card">
                    <h4>感情Top5</h4>
                    ${renderRankList(emotionTop5, '')}
                </div>
                <div class="stat-card">
                    <h4>認知パターンTop5</h4>
                    ${renderRankList(patternTop5, '')}
                </div>
                <div class="stat-card">
                    <h4>トリガー語Top10</h4>
                    ${renderRankList(triggerTop10, '')}
                </div>
            </div>

            <div class="stats-grid" style="width:100%;">
                <div class="stat-card">
                    <h4>MBTI</h4>
                    <div class="mbti-row">
                        <select id="mbti-select" class="filter-input">
                            <option value="">未設定</option>
                            ${MBTI_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                        <div class="mbti-note">任意。自己申告の補助情報として使用します。</div>
                        <div class="mbti-current">現在: ${escapeHtml(mbtiDisplay)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <h4>日記から読み取れる性格診断（推定）</h4>
                    <p class="analysis-text">${escapeHtml(personalityInsight)}</p>
                </div>
            </div>

            <div class="stat-card pattern-catalog-card">
                <h4>認知パターン一覧</h4>
                <p class="pattern-catalog-note">固定12種類の説明です。</p>
                <ul class="pattern-catalog">${patternCatalogHtml}</ul>
            </div>

            <div class="stat-card themes-card">
                <h4>繰り返しテーマTop3</h4>
                <div class="themes-list">
                    ${themes.length ? themes.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('') : '<span class="rank-empty">未更新</span>'}
                </div>
            </div>

            <div class="stat-card similar-card">
                <h4>最近の似ている日</h4>
                ${similarHtml}
            </div>
        </div>
    `;

    const periodBtns = dom.mypageContainer.querySelectorAll('.period-btn');
    periodBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            appState.period = btn.dataset.period || '7d';
            renderMyPage();
        });
    });

    const summaryBtn = dom.mypageContainer.querySelector('#btn-summary-refresh');
    if (summaryBtn) {
        summaryBtn.addEventListener('click', () => requestSummaryUpdate(periodKey, periodConfig.label, stats));
    }

    const mbtiSelect = dom.mypageContainer.querySelector('#mbti-select');
    if (mbtiSelect) {
        mbtiSelect.value = mbtiValue;
        mbtiSelect.addEventListener('change', async () => {
            await saveUserProfile({ mbti: mbtiSelect.value });
            renderMyPage();
        });
    }

    const similarBtn = dom.mypageContainer.querySelector('#btn-similar-refresh');
    if (similarBtn && latestEntry) {
        similarBtn.addEventListener('click', () => fetchSimilarForEntryById(latestEntry.id));
    }
}

// --- Editor Logic ---

function openEntry(entryId = null, targetDate = null) {
    appState.activeEntryId = entryId;
    currentUploadImage = null;
    navigateTo('editor');

    if (dom.lockOverlay) dom.lockOverlay.classList.add('hidden');
    if (dom.inputUnlockPass) dom.inputUnlockPass.value = '';

    if (entryId) {
        const entry = appState.entries.find(e => e.id === entryId);
        if (!entry) return navigateTo('list');

        currentUploadImage = entry.image || null;
        appState.writingDate = getEntryDate(entry);
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = entry.title || '\u65e5\u8a18\u306e\u8a73\u7d30';
        if (dom.displayDate) {
            dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${formatDate(getEntryDate(entry))} <span style="font-size:0.8em; margin-left:10px;">${formatTime(getEntryDate(entry))}</span>`;
        }
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
            toggleEditMode(false);
            if (entry.image) {
                if (dom.imagePreview) dom.imagePreview.src = entry.image;
                if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.remove('hidden');
            } else if (dom.imagePreviewContainer) {
                dom.imagePreviewContainer.classList.add('hidden');
            }
        }

        if (dom.displayScore) dom.displayScore.innerHTML = '';
        renderAnalysisPanel(entry);
    } else {
        appState.writingDate = targetDate || new Date();
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u65b0\u3057\u3044\u65e5\u8a18';
        if (dom.displayDate) dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-plus"></i> ${formatDate(appState.writingDate)}`;
        if (dom.selectLockStatus) dom.selectLockStatus.value = 'unlocked';
        if (dom.inputContent) dom.inputContent.value = '';
        if (dom.displayScore) dom.displayScore.innerHTML = '';
        if (dom.entryImageInput) dom.entryImageInput.value = '';
        if (dom.imagePreview) dom.imagePreview.src = '';
        if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden');
        if (dom.analysisPanel) dom.analysisPanel.innerHTML = '';
        toggleEditMode(true);
        setTimeout(() => {
            if (dom.inputContent) {
                dom.inputContent.focus();
                if (autoResizeTextarea) autoResizeTextarea();
            }
        }, 100);
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
                if (dom.btnSave) dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> \u4fdd\u5b58';
                if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u65e5\u8a18\u3092\u7de8\u96c6';
            }
            if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'inline-flex';
        } else {
            if (dom.btnSave) dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> \u4fdd\u5b58';
            if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u65e5\u8a18\u3092\u66f8\u304f';
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
            renderAnalysisPanel(entry);
        }
    } else {
        showToast('\u30d1\u30b9\u30ef\u30fc\u30c9\u304c\u9055\u3044\u307e\u3059', 'error');
    }
}

async function retryAnalysisHelper(entryId) {
    const entry = appState.entries.find(e => e.id === entryId);
    if (!entry) return;
    await runAnalysisForEntry(entry, true);
}

async function handleImageUpload(file) {
    if (!file) return;
    try {
        const compressed = await compressImage(file, 800, 0.7);
        currentUploadImage = compressed;
        if (dom.imagePreview) dom.imagePreview.src = compressed;
        if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.remove('hidden');
    } catch (e) {
        showToast('\u753b\u50cf\u306e\u8aad\u307f\u8fbc\u307f\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
    }
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

function renderAnalysisPanel(entry) {
    if (!dom.analysisPanel) return;
    if (!entry) {
        dom.analysisPanel.innerHTML = '';
        return;
    }
    if (entry.isLocked) {
        dom.analysisPanel.innerHTML = '<div class="analysis-status">ロック中</div>';
        return;
    }

    const analysis = appState.analysisById[entry.id];
    const status = appState.analysisStatusById[entry.id] || (analysis ? 'done' : 'none');

    if (status === 'processing') {
        dom.analysisPanel.innerHTML = '<div class="analysis-status">解析中...</div>';
        return;
    }

    if (status === 'failed') {
        dom.analysisPanel.innerHTML = `
            <div class="analysis-status">解析に失敗しました</div>
            <button class="btn-secondary" onclick="retryAnalysisHelper('${entry.id}')">解析を再試行</button>
        `;
        return;
    }

    if (!analysis) {
        dom.analysisPanel.innerHTML = `
            <div class="analysis-status">解析がまだありません</div>
            <button class="btn-secondary" onclick="retryAnalysisHelper('${entry.id}')">解析を実行</button>
        `;
        return;
    }

    const topEmotion = getTopEmotion(analysis);
    const emotionLabel = topEmotion ? EMOTION_LABELS[topEmotion.key] : '不明';
    const emotionScore = topEmotion ? Math.round(topEmotion.intensity || 0) : null;
    const summaryText = (analysis.observation_comment || '').trim();
    const summarySafe = summaryText
        ? escapeHtml(summaryText)
        : `「${emotionLabel}」が中心の記録です。`;

    const facts = (analysis.facts || []).map(escapeHtml);
    const story = (analysis.story || []).map(escapeHtml);
    const emotions = (analysis.emotions || []).map((e) => {
        const key = normalizeEmotionKey(e.label || e.primary || e.emotion);
        const name = key ? EMOTION_LABELS[key] : (e.label || '不明');
        const intensity = Math.round(e.intensity_0_100 || 0);
        const certainty = e.certainty_0_1 != null ? Number(e.certainty_0_1).toFixed(2) : null;
        return `${escapeHtml(name)}${Number.isFinite(intensity) ? ` ${intensity}点` : ''}${certainty ? ` (確度 ${certainty})` : ''}`;
    });
    const patternsList = Array.isArray(analysis.patterns)
        ? analysis.patterns
        : (analysis.patterns ? Object.values(analysis.patterns) : []);
    const matchedPatterns = patternsList
        .map((p) => ({ entry: getPatternEntry(p), raw: p }))
        .filter((item) => item.entry);
    const patterns = matchedPatterns.map(({ entry, raw }) => {
        const conf = typeof raw === 'object' && raw !== null && raw.confidence_0_1 != null
            ? Number(raw.confidence_0_1).toFixed(2)
            : null;
        const meta = conf ? `確度 ${conf}` : '';
        return `
            <li class="pattern-item">
                <div class="pattern-label">${escapeHtml(entry.label)}${meta ? ` <span class="pattern-meta">${meta}</span>` : ''}</div>
                ${entry.desc ? `<div class="pattern-desc">${escapeHtml(entry.desc)}</div>` : ''}
            </li>
        `;
    });
    const patternsHtml = patterns.length
        ? patterns.join('')
        : '<li class="pattern-empty">該当なし</li>';
    const habitInsight = buildHabitInsight(patternsList);
    const triggers = (analysis.triggers || []).map(escapeHtml);

    const similar = appState.similarById[entry.id] || [];
    const similarHtml = similar.length
        ? similar.map((s) => {
            const ref = appState.entries.find(e => e.id === s.entry_id);
            const label = ref ? escapeHtml(ref.content || '').slice(0, 40) : s.entry_id;
            return `<button class="btn-text-sm" onclick="openEntry('${s.entry_id}')">${label}</button>`;
        }).join('')
        : `<button class="btn-text-sm" onclick="fetchSimilarForEntryById('${entry.id}')">類似を検索</button>`;

    dom.analysisPanel.innerHTML = `
        <div class="analysis-block">
            <div class="analysis-summary">
                <div class="analysis-summary-header">
                    <div>
                        <div class="analysis-title">今日の気分</div>
                        <div class="analysis-emotion">${emotionLabel}${emotionScore != null ? ` <span class="analysis-emotion-score">${emotionScore}点</span>` : ''}</div>
                    </div>
                    <div class="analysis-actions">
                        <button class="btn-text-sm" onclick="retryAnalysisHelper('${entry.id}')">再解析</button>
                    </div>
                </div>
                <div class="analysis-summary-text">${summarySafe}</div>
            </div>
        </div>
        <div class="analysis-block">
            <div class="analysis-title">似ている日記</div>
            <div class="analysis-similar">${similarHtml}</div>
        </div>
        <div class="analysis-block analysis-details is-open" id="analysis-details-${entry.id}">
            <div class="analysis-detail-grid">
                <div class="analysis-detail">
                    <h4>出来事（Fact）</h4>
                    <ul class="analysis-list">${facts.map(f => `<li>${f}</li>`).join('') || '<li>なし</li>'}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>気づき（Story）</h4>
                    <ul class="analysis-list">${story.map(f => `<li>${f}</li>`).join('') || '<li>なし</li>'}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>感情の内訳</h4>
                    <ul class="analysis-list">${emotions.map(f => `<li>${f}</li>`).join('') || '<li>なし</li>'}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>認知パターン</h4>
                    <ul class="analysis-list">${patternsHtml}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>考え方の癖</h4>
                    <p class="analysis-text">${escapeHtml(habitInsight)}</p>
                </div>
                <div class="analysis-detail">
                    <h4>トリガー語</h4>
                    <div class="analysis-tags">${triggers.map(t => `<span class="tag">${t}</span>`).join('') || '<span class="tag">なし</span>'}</div>
                </div>
            </div>
        </div>
    `;
}
function toggleAnalysisDetails(entryId) {
    const details = document.getElementById(`analysis-details-${entryId}`);
    if (!details) return;
    details.classList.toggle('is-open');
    const btn = dom.analysisPanel ? dom.analysisPanel.querySelector(`[data-analysis-toggle="${entryId}"]`) : null;
    if (btn) {
        btn.textContent = details.classList.contains('is-open') ? '詳細を閉じる' : '詳細を見る';
    }
}
async function saveAnalysisResultToFirestore(entryId, analysis) {
    const db = window.db;
    if (!db || !appState.user || !analysis) return false;
    const payload = {
        ...analysis,
        entry_id: entryId,
        user_id: appState.user.uid,
        analysis_version: analysis.analysis_version || 'soos-v1',
        created_at: analysis.created_at || new Date().toISOString()
    };
    try {
        await db.collection('diary_analysis').doc(entryId).set(payload, { merge: true });
        return true;
    } catch (e) {
        console.error('[save] diary_analysis failed', { stage: 'analysis', code: e.code, message: e.message });
        return false;
    }
}

async function saveEmbeddingResultToFirestore(entryId, embedding) {
    const db = window.db;
    if (!db || !appState.user || !Array.isArray(embedding)) return false;
    const payload = {
        entry_id: entryId,
        user_id: appState.user.uid,
        embedding,
        created_at: new Date().toISOString()
    };
    try {
        await db.collection('diary_embeddings').doc(entryId).set(payload, { merge: true });
        return true;
    } catch (e) {
        console.error('[save] diary_embeddings failed', { stage: 'embedding', code: e.code, message: e.message });
        return false;
    }
}

async function runFallbackAnalysis(entry) {
    try {
        const result = await apiPost('/api/analyze-lite', {
            entry_id: entry.id,
            user_id: appState.user.uid,
            text: entry.content,
            created_at: getEntryDate(entry).toISOString()
        }, { timeoutMs: 8000 });

        if (result.analysis) {
            appState.analysisById[entry.id] = result.analysis;
        }
        if (result.similar) {
            appState.similarById[entry.id] = result.similar;
        }

        let analysisSaved = true;
        let embeddingSaved = true;
        if (result.analysis) {
            analysisSaved = await saveAnalysisResultToFirestore(entry.id, result.analysis);
        }
        if (result.embedding) {
            embeddingSaved = await saveEmbeddingResultToFirestore(entry.id, result.embedding);
        }

        console.info('[save] analysis fallback result', { entryId: entry.id, analysisSaved, embeddingSaved });
        appState.analysisStatusById[entry.id] = 'done';
        renderAnalysisPanel(entry);

        if (!analysisSaved || !embeddingSaved) {
            showToast('解析の保存に失敗しました', 'error');
        }
        return true;
    } catch (e) {
        console.error('[save] analysis fallback failed', { entryId: entry.id, message: e.message });
        return false;
    }
}

async function runAnalysisForEntry(entry, force = false) {
    if (!entry || !entry.content) return false;
    if (!appState.user) return false;
    if (!force && appState.analysisById[entry.id]) return true;
    if (appState.analysisStatusById[entry.id] === 'processing') return false;

    appState.analysisStatusById[entry.id] = 'processing';
    renderAnalysisPanel(entry);

    try {
        console.info('[save] analysis start', { entryId: entry.id });
        const result = await apiPost('/api/analyze', {
            entry_id: entry.id,
            user_id: appState.user.uid,
            text: entry.content,
            created_at: getEntryDate(entry).toISOString()
        }, { timeoutMs: 20000 });
        if (result.analysis) {
            appState.analysisById[entry.id] = result.analysis;
        }
        if (result.similar) {
            appState.similarById[entry.id] = result.similar;
        }
        let analysisSaved = result.analysis_saved !== false;
        let embeddingSaved = result.embedding_saved !== false;
        if (!analysisSaved && result.analysis) {
            analysisSaved = await saveAnalysisResultToFirestore(entry.id, result.analysis);
        }
        if (!embeddingSaved && result.embedding) {
            embeddingSaved = await saveEmbeddingResultToFirestore(entry.id, result.embedding);
        }
        console.info('[save] analysis result', { entryId: entry.id, analysisSaved, embeddingSaved });
        if (!analysisSaved || !embeddingSaved) {
            appState.analysisStatusById[entry.id] = 'failed';
            renderAnalysisPanel(entry);
            showToast('日記は保存済みです。解析のみ失敗しました。再試行できます。', 'error');
            return false;
        }
        appState.analysisStatusById[entry.id] = 'done';
        refreshFilterOptions();
        renderAnalysisPanel(entry);
        return true;
    } catch (e) {
        appState.analysisStatusById[entry.id] = 'failed';
        renderAnalysisPanel(entry);
        let msg = '\u89e3\u6790\u306b\u5931\u6557\u3057\u307e\u3057\u305f';
        if (e.message === 'api_base_missing') {
            msg = 'API Base URL\u304c\u672a\u8a2d\u5b9a\u3067\u3059';
        } else if (e.message === 'api_timeout') {
            const ok = await runFallbackAnalysis(entry);
            if (ok) return true;
            msg = '\u89e3\u6790\u304c\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8\u3057\u307e\u3057\u305f';
        }
        let errInfo = {};
        try { errInfo = JSON.parse(e.message); } catch (_) { errInfo = {}; }
        console.error('[save] analysis failed', { entryId: entry.id, code: errInfo.error || e.code, stage: errInfo.stage || 'analysis', message: e.message });
        showToast(msg, 'error');
        return false;
    }
}

async function fetchSimilarForEntryById(entryId) {
    const entry = appState.entries.find(e => e.id === entryId);
    if (!entry || !appState.user) return;
    try {
        const result = await apiPost('/api/similar', {
            entry_id: entry.id,
            user_id: appState.user.uid,
            limit: 3
        });
        appState.similarById[entry.id] = result.similar || [];
        renderAnalysisPanel(entry);
    } catch (e) {
        showToast('\u985e\u4f3c\u691c\u7d22\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
    }
}

function renderEmotionWheel(emotionData) {
    const key = normalizeEmotionKey(emotionData.primary);
    const label = key ? EMOTION_LABELS[key] : '不明';
    const markers = key ? [{ key, size: 14, opacity: 1 }] : [];
    const chart = renderEmotionImage(markers);

    return `
        <div class="emotion-wheel-wrap">
            ${chart}
            <div class="emotion-caption">感情: <strong>${label}</strong></div>
        </div>
    `;
}

function getEmotionPlotPosition(key) {
    const idx = EMOTION_ORDER.indexOf(key);
    if (idx < 0) return { x: 50, y: 50 };
    const angleDeg = -90 + (idx * 45);
    const rad = angleDeg * Math.PI / 180;
    const r = 38;
    return {
        x: 50 + (Math.cos(rad) * r),
        y: 50 + (Math.sin(rad) * r)
    };
}

function renderEmotionImage(markers) {
    const markerHtml = markers.map((m) => {
        const pos = getEmotionPlotPosition(m.key);
        const size = m.size || 10;
        const color = EMOTION_COLORS[m.key] || '#999999';
        const opacity = m.opacity == null ? 1 : m.opacity;
        return `<span class="emotion-marker" style="left:${pos.x.toFixed(2)}%; top:${pos.y.toFixed(2)}%; width:${size}px; height:${size}px; background:${color}; opacity:${opacity};"></span>`;
    }).join('');

    return `
        <div class="emotion-image-wrap">
            <img src="${EMOTION_IMAGE_PATH}" alt="プルチックの感情の輪" class="emotion-image">
            <div class="emotion-marker-layer">${markerHtml}</div>
        </div>
    `;
}

function getTopEmotion(analysis) {
    if (!analysis || !Array.isArray(analysis.emotions) || analysis.emotions.length === 0) return null;
    const sorted = [...analysis.emotions].sort((a, b) => (b.intensity_0_100 || 0) - (a.intensity_0_100 || 0));
    const top = sorted[0];
    const key = normalizeEmotionKey(top.label || top.emotion || top.primary);
    return key ? { key, intensity: top.intensity_0_100 || 0 } : null;
}

function getTopPattern(analysis) {
    if (!analysis || !analysis.patterns) return null;
    const patternsList = Array.isArray(analysis.patterns)
        ? analysis.patterns
        : Object.values(analysis.patterns);
    if (!patternsList.length) return null;
    const sorted = [...patternsList].sort((a, b) => (b.confidence_0_1 || 0) - (a.confidence_0_1 || 0));
    const top = sorted[0];
    const entry = getPatternEntry(top);
    return entry ? entry.label : (top.label || top.pattern_id || null);
}

function buildDiaryPersonalityInsight(stats) {
    if (!stats || !stats.analyzedCount) {
        return '分析データがまだありません。日記が増えるほど傾向が見えてきます。';
    }
    const parts = [];
    const topEmotion = stats.emotionsSorted[0];
    const topPattern = stats.patternsSorted[0];
    const topTrigger = stats.triggersSorted[0];

    if (topEmotion) {
        const label = EMOTION_LABELS[topEmotion.key] || topEmotion.key;
        parts.push(`感情は「${label}」が多め`);
    }
    if (topPattern) {
        parts.push(`認知パターンは「${topPattern.label}」が目立つ`);
    }
    if (topTrigger) {
        parts.push(`「${topTrigger.label}」に反応しやすい`);
    }

    return parts.length
        ? `${parts.join('、')}傾向があります。`
        : '分析結果はありますが、傾向がまだ安定していません。';
}

function buildHabitInsight(patternsList) {
    if (!patternsList || !patternsList.length) return '該当なし';
    const sorted = [...patternsList].sort((a, b) => (b.confidence_0_1 || 0) - (a.confidence_0_1 || 0));
    const labels = [];
    for (const p of sorted) {
        const entry = getPatternEntry(p);
        const rawLabel = typeof p === 'string' ? p : (p.label || p.pattern_id || '');
        const label = entry ? entry.label : rawLabel;
        if (label && !labels.includes(label)) labels.push(label);
        if (labels.length >= 2) break;
    }
    if (!labels.length) return '該当なし';
    if (labels.length === 1) {
        return `日記からは「${labels[0]}」に近い考え方の癖が見られる可能性があります。`;
    }
    return `日記からは「${labels[0]}」「${labels[1]}」に近い考え方の癖が見られる可能性があります。`;
}

function getFilteredEntries() {
    let list = appState.entries || [];

    if (appState.filterByDate) {
        const target = appState.filterByDate.toDateString();
        list = list.filter(e => getEntryDate(e).toDateString() === target);
    }

    if (appState.filters.dateFrom) {
        const from = new Date(appState.filters.dateFrom);
        list = list.filter(e => getEntryDate(e) >= from);
    }
    if (appState.filters.dateTo) {
        const to = new Date(appState.filters.dateTo);
        to.setHours(23, 59, 59, 999);
        list = list.filter(e => getEntryDate(e) <= to);
    }

    if (appState.filters.emotion && appState.filters.emotion !== 'all') {
        list = list.filter(e => {
            const analysis = appState.analysisById[e.id];
            const top = getTopEmotion(analysis);
            return top && top.key === appState.filters.emotion;
        });
    }

    if (appState.filters.pattern && appState.filters.pattern !== 'all') {
        list = list.filter(e => {
            const analysis = appState.analysisById[e.id];
            if (!analysis) return false;
            const patternsList = Array.isArray(analysis.patterns)
                ? analysis.patterns
                : (analysis.patterns ? Object.values(analysis.patterns) : []);
            return patternsList.some((p) => {
                const entry = getPatternEntry(p);
                return entry && entry.id === appState.filters.pattern;
            });
        });
    }

    if (appState.filters.trigger) {
        const q = appState.filters.trigger.toLowerCase();
        list = list.filter(e => {
            const analysis = appState.analysisById[e.id];
            if (!analysis) return false;
            return (analysis.triggers || []).some(t => String(t).toLowerCase().includes(q));
        });
    }

    if (appState.filters.query) {
        const q = appState.filters.query.toLowerCase();
        list = list.filter(e => (e.content || '').toLowerCase().includes(q));
    }

    return list;
}

function renderEntryList() {
    if (!dom.entryListContainer) return;
    dom.entryListContainer.innerHTML = '';
    const filtered = getFilteredEntries();

    if (filtered.length === 0) {
        dom.entryListContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-book-open"></i><p>まだ日記がありません</p><button class="btn-primary" onclick="openEntry()">最初の日記を書く</button></div>';
        return;
    }

    filtered.forEach(entry => {
        const card = document.createElement('div');
        card.className = `entry-card ${entry.isLocked ? 'locked' : ''}`;
        card.onclick = () => openEntry(entry.id);
        const day = getEntryDate(entry);

        const analysis = appState.analysisById[entry.id];
        const topEmotion = getTopEmotion(analysis);
        const miniSummary = entry.isLocked
            ? 'ロック中'
            : (analysis
                ? `感情: ${topEmotion ? EMOTION_LABELS[topEmotion.key] : '不明'}${topEmotion ? ` (${Math.round(topEmotion.intensity || 0)}点)` : ''}`
                : '解析なし');

        let contentPrev = entry.content || '...';
        let cardTitle = entry.title || '\u65e5\u8a18';

        if (entry.isLocked) {
            contentPrev = '<i class="fa-solid fa-lock" style="margin-right:5px;"></i> \u30ed\u30c3\u30af\u4e2d';
            cardTitle = '\u30ed\u30c3\u30af\u3055\u308c\u305f\u65e5\u8a18';
        }

        card.innerHTML = `
            <div class="entry-header-row">
                <div class="entry-date">${day.getDate()} <span class="entry-day-sm">${day.toLocaleDateString('ja-JP', { weekday: 'short' })}</span> <span style="font-size:0.8em; color:var(--text-muted); font-weight:normal; margin-left:5px;">${formatTime(day)}</span></div>
            </div>
            ${!entry.isLocked ? `<div class="entry-title">${cardTitle}</div>` : ''}
            <div class="entry-preview">${contentPrev}</div>
            <div class="entry-mini">${miniSummary}</div>
        `;
        dom.entryListContainer.appendChild(card);
    });
}function renderCalendar() {
    if (!dom.calendarMonthYear || !dom.calendarDaysGrid) return;
    syncCalendarSelectors();
    dom.calendarMonthYear.textContent = appState.calendarDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    dom.calendarDaysGrid.innerHTML = '';
    const y = appState.calendarDate.getFullYear(), m = appState.calendarDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) dom.calendarDaysGrid.appendChild(document.createElement('div'));

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = new Date(y, m, d).toDateString();
        const entriesOnDay = appState.entries.filter(e => getEntryDate(e).toDateString() === dateStr);
        const avg = null;

        const el = document.createElement('div');
        el.className = `calendar-day ${dateStr === new Date().toDateString() ? 'today' : ''} ${entriesOnDay.length ? 'has-entry' : ''}`;
        const imageEntry = entriesOnDay.find(e => e.image && !e.isLocked);
        if (imageEntry) {
            el.classList.add('has-image');
            el.style.backgroundImage = `url("${imageEntry.image}")`;
        }

        let inner = `<span class="day-number">${d}</span>`;

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

function syncCalendarSelectors() {
    if (!dom.selectCalendarYear || !dom.selectCalendarMonth) return;
    const currentYear = appState.calendarDate.getFullYear();
    const currentMonth = appState.calendarDate.getMonth() + 1;

    const hasYearOption = Array.from(dom.selectCalendarYear.options).some(opt => Number(opt.value) === currentYear);
    if (!hasYearOption) {
        dom.selectCalendarYear.innerHTML = '';
        const start = currentYear - 5;
        const end = currentYear + 5;
        for (let y = start; y <= end; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = `${y}年`;
            dom.selectCalendarYear.appendChild(opt);
        }
    }
    if (dom.selectCalendarMonth.options.length === 0) {
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = String(m);
            opt.textContent = `${m}\u6708`;
            dom.selectCalendarMonth.appendChild(opt);
        }
    }

    dom.selectCalendarYear.value = String(currentYear);
    dom.selectCalendarMonth.value = String(currentMonth);
}

// --- Utils ---
function toDateValue(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getEntryDate(entry) {
    const raw = entry ? (entry.createdAt || entry.created_at || entry.date) : null;
    return toDateValue(raw) || new Date();
}

function getServerTimestamp() {
    if (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
        return window.firebase.firestore.FieldValue.serverTimestamp();
    }
    return new Date();
}

function formatDate(isoStr) {
    const d = toDateValue(isoStr) || new Date();
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTime(isoStr) {
    const d = toDateValue(isoStr) || new Date();
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = 'success') {
    if (!dom.toastContainer) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    dom.toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add('show'); }, 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const DEFAULT_API_BASE = 'https://diary-analysis-api-108616601222.asia-northeast1.run.app';

function getApiBase() {
    if (appState.apiBase) return appState.apiBase.replace(/\/$/, '');
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8787';
    return DEFAULT_API_BASE;
}

async function apiPost(path, body, options = {}) {
    const base = getApiBase();
    if (!base) throw new Error('api_base_missing');
    const controller = new AbortController();
    const timeoutMs = Number(options.timeoutMs || 0);
    let timeoutId;
    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }
    let res;
    try {
        res = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
            signal: controller.signal
        });
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw new Error('api_timeout');
        }
        throw err;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `http_${res.status}`);
    }
    return res.json();
}

// --- Theme ---
window.applyTheme = function (theme) {
    if (theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        if (dom.btnThemeToggle) dom.btnThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.body.removeAttribute('data-theme');
        if (dom.btnThemeToggle) dom.btnThemeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
}
const applyTheme = window.applyTheme; // local alias logic

// --- Global Exports (for HTML onclick handlers) ---
window.openEntry = openEntry;
window.retryAnalysisHelper = retryAnalysisHelper;
window.navigateTo = navigateTo; // Expose navigation
window.app = {
    navigateToWrite: () => openEntry(),
    retryAnalysis: retryAnalysisHelper
};
window.appState = appState;

// --- Initialization ---
function safeInit() {
    if (window.isInitialized) return;
    window.isInitialized = true;
    console.log('[App] Starting initialization...');
    try {
        init();
    } catch (e) {
        console.error('[App] Init crashed:', e);
        alert('アプリの起動に失敗しました: ' + e.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
} else {
    safeInit();
}
