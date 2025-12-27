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
    inputMorning: getEl('entry-morning'),
    displayMorning: getEl('entry-morning-display'),
    journalSections: getEl('journal-sections'),
    inputDone: getEl('entry-done'),
    inputNotDone: getEl('entry-not-done'),
    inputNextPlan: getEl('entry-next-plan'),
    inputMealBreakfast: getEl('entry-meal-breakfast'),
    inputMealLunch: getEl('entry-meal-lunch'),
    inputMealDinner: getEl('entry-meal-dinner'),
    inputWeight: getEl('entry-weight'),
    inputSleep: getEl('entry-sleep'),
    displayDone: getEl('entry-done-display'),
    displayNotDone: getEl('entry-not-done-display'),
    displayNextPlan: getEl('entry-next-plan-display'),
    displayMeals: getEl('entry-meals-display'),
    displayWeight: getEl('entry-weight-display'),
    displaySleep: getEl('entry-sleep-display'),
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
    monthlyGoalTitle: getEl('monthly-goal-title'),
    monthlyGoalText: getEl('monthly-goal-text'),
    btnEditMonthlyGoal: getEl('btn-edit-monthly-goal'),
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
const MBTI_TRAITS = {
    ISTJ: '事実を重視し、計画的に物事を進める傾向。',
    ISFJ: '思いやりがあり、周囲の安定を大切にする傾向。',
    INFJ: '理想や意味を深く考え、全体像を捉える傾向。',
    INTJ: '長期的な視点で戦略を立てる傾向。',
    ISTP: '冷静に状況を見て、実用的に対処する傾向。',
    ISFP: '感覚を大切にし、穏やかな選択を好む傾向。',
    INFP: '価値観に沿って行動し、内面を重視する傾向。',
    INTP: '論理的に考え、理解を深めることを好む傾向。',
    ESTP: '行動力があり、現場で素早く動く傾向。',
    ESFP: '周囲と楽しさを共有し、体験を重視する傾向。',
    ENFP: '好奇心が強く、新しい可能性を追う傾向。',
    ENTP: '発想力があり、柔軟にアイデアを試す傾向。',
    ESTJ: '秩序を重視し、実行力が高い傾向。',
    ESFJ: '協調性が高く、人間関係を大切にする傾向。',
    ENFJ: '周囲を支え、方向性を示すことが多い傾向。',
    ENTJ: '目標志向で、判断と推進が速い傾向。'
};
const TOPIC_KEYWORDS = {
    '仕事': ['仕事', '会社', '上司', '職場', '会議', '残業', '出勤', '退勤', '業務', 'メール', '営業', '転職', '面接'],
    '恋愛': ['恋愛', '恋人', '彼氏', '彼女', '好き', 'デート', '片思い', '失恋', '結婚', '別れ'],
    '家族': ['家族', '家庭', '父', '母', '姉', '兄', '妹', '弟', '子ども', '親', '両親'],
    '友人': ['友人', '友達', '友だち', '仲間', '同僚', '同期', '先輩', '後輩'],
    'お金': ['お金', '給料', '貯金', '支出', '節約', '請求', '家計', '収入', '出費'],
    '健康': ['健康', '体調', '病気', '薬', '睡眠', '疲れ', '風邪', '痛み', '食事', '運動'],
    '勉強': ['勉強', '学習', '試験', 'テスト', '資格', '講座', '宿題'],
    '趣味': ['趣味', '映画', '音楽', 'ゲーム', '旅行', 'カフェ', '読書', '写真'],
    '将来': ['将来', '未来', '夢', '目標', '不安', '期待', '計画'],
    '自由': ['自由', '制限', '束縛', '余裕', '時間'],
    '生活': ['生活', '家事', '料理', '掃除', '洗濯', '買い物']
};
const PERSONALITY_TRAIT_MAP = {
    jump_to_conclusion: '結論を急ぎやすい',
    overgeneralization: '一度の出来事を全体化しやすい',
    black_and_white: '白黒ではっきりさせたくなる',
    emotional_reasoning: '感情を根拠にしやすい',
    self_blame: '自分のせいだと思いがち',
    mind_reading: '相手の意図を決めつけがち',
    catastrophizing: '最悪の結果を想定しやすい',
    magnification_minimization: '良し悪しを誇張しやすい',
    should_statements: '〜すべきで自分を縛りがち',
    negative_filter: '悪い点に注意が偏りがち',
    comparison_inferiority: '比べて落ち込みやすい',
    avoidance_procrastination: '不安から先延ばししがち'
};
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
    { id: 'jump_to_conclusion', label: '結論の飛躍', desc: '根拠が少ないまま結論を出しやすい' },
    { id: 'overgeneralization', label: '過度の一般化', desc: '一度の出来事で全体を決めつけやすい' },
    { id: 'black_and_white', label: '白黒思考', desc: '極端に捉えてしまう' },
    { id: 'emotional_reasoning', label: '感情的決めつけ', desc: '気分を事実だと感じやすい' },
    { id: 'self_blame', label: '自己否定', desc: '自分のせいだと考えがち' },
    { id: 'mind_reading', label: '心の読みすぎ', desc: '相手の意図を決めつけやすい' },
    { id: 'catastrophizing', label: '未来の悲観', desc: '最悪の結果を想定しやすい' },
    { id: 'magnification_minimization', label: '拡大・過小評価', desc: '悪い点は大きく、良い点は小さく見やすい' },
    { id: 'should_statements', label: 'べき思考', desc: '〜すべきで自分を縛りがち' },
    { id: 'negative_filter', label: 'ネガティブ抽出', desc: '悪い点に注意が偏りやすい' },
    { id: 'comparison_inferiority', label: '比較による劣等感', desc: '他人と比べて自分を下げやすい' },
    { id: 'avoidance_procrastination', label: '回避・先延ばし', desc: '不安から行動を避けがち' }
];

const PATTERN_ALIASES = {
    inference_jump: 'jump_to_conclusion',
    jump_to_conclusion: 'jump_to_conclusion',
    '結論の飛躍': 'jump_to_conclusion',
    '結論飛躍': 'jump_to_conclusion',
    overgeneralization: 'overgeneralization',
    '過度の一般化': 'overgeneralization',
    black_and_white: 'black_and_white',
    all_or_nothing: 'black_and_white',
    'all-or-nothing': 'black_and_white',
    '白黒思考': 'black_and_white',
    emotional_reasoning: 'emotional_reasoning',
    '感情的決めつけ': 'emotional_reasoning',
    self_blame: 'self_blame',
    'self-blame': 'self_blame',
    '自己否定': 'self_blame',
    '自己責任': 'self_blame',
    mind_reading: 'mind_reading',
    'mind-reading': 'mind_reading',
    '心の読みすぎ': 'mind_reading',
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
    '比較による劣等感': 'comparison_inferiority',
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
                showToast(`繧医≧縺薙◎縲・{user.displayName}縺輔ｓ`);
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
    if (dom.btnEditMonthlyGoal) {
        dom.btnEditMonthlyGoal.disabled = !isLoggedIn;
        dom.btnEditMonthlyGoal.title = isLoggedIn ? '' : '\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u7de8\u96c6';
    }
    renderMonthlyGoal();
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
    if (dom.btnEditMonthlyGoal) {
        dom.btnEditMonthlyGoal.addEventListener('click', editMonthlyGoal);
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
    document.querySelectorAll('.journal-textarea').forEach((el) => {
        el.addEventListener('input', autoResizeTextarea);
    });
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

function autoResizeTextarea(target) {
    const el = target && target.target ? target.target : (target || dom.inputContent);
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}

function resizeAllJournalTextareas() {
    document.querySelectorAll('.journal-textarea').forEach((el) => autoResizeTextarea(el));
}

function setJournalEditMode(isEdit) {
    const inputs = document.querySelectorAll('.journal-input');
    const displays = document.querySelectorAll('.journal-display');
    inputs.forEach((el) => el.classList.toggle('hidden', !isEdit));
    displays.forEach((el) => el.classList.toggle('hidden', isEdit));
}

function formatWithUnit(value, unit) {
    const v = String(value || '').trim();
    if (!v) return '未記入';
    if (unit === '時間') {
        if (/[時間分]/.test(v)) return v;
        const num = Number(v);
        if (!Number.isNaN(num)) {
            const hours = Math.floor(num);
            const hasHalf = Math.abs(num - hours - 0.5) < 0.01;
            if (hasHalf) return hours ? `${hours}時間30分` : '30分';
            if (Number.isInteger(num)) return `${num}時間`;
        }
    }
    if (unit && !v.endsWith(unit)) return `${v}${unit}`;
    return v;
}

function getJournalFromEntry(entry) {
    const meta = entry && entry.meta && entry.meta.journal ? entry.meta.journal : {};
    const journal = entry && entry.journal ? entry.journal : {};
    const source = { ...meta, ...journal };
    const meals = source.meals || {};
    return {
        morning: source.morning || '',
        done: source.done || '',
        notDone: source.not_done || '',
        nextPlan: source.next_plan || '',
        meals: {
            breakfast: meals.breakfast || '',
            lunch: meals.lunch || '',
            dinner: meals.dinner || ''
        },
        weight: source.weight || '',
        sleepHours: source.sleep_hours || ''
    };
}

function fillJournalInputs(journal) {
    if (dom.inputMorning) dom.inputMorning.value = journal.morning || '';
    if (dom.inputDone) dom.inputDone.value = journal.done || '';
    if (dom.inputNotDone) dom.inputNotDone.value = journal.notDone || '';
    if (dom.inputNextPlan) dom.inputNextPlan.value = journal.nextPlan || '';
    if (dom.inputMealBreakfast) dom.inputMealBreakfast.value = journal.meals.breakfast || '';
    if (dom.inputMealLunch) dom.inputMealLunch.value = journal.meals.lunch || '';
    if (dom.inputMealDinner) dom.inputMealDinner.value = journal.meals.dinner || '';
    if (dom.inputWeight) dom.inputWeight.value = journal.weight || '';
    if (dom.inputSleep) dom.inputSleep.value = journal.sleepHours || '';
}

function fillJournalDisplays(journal) {
    if (dom.displayMorning) dom.displayMorning.textContent = journal.morning || '譛ｪ險伜・';
    if (dom.displayDone) dom.displayDone.textContent = journal.done || '譛ｪ險伜・';
    if (dom.displayNotDone) dom.displayNotDone.textContent = journal.notDone || '譛ｪ險伜・';
    if (dom.displayNextPlan) dom.displayNextPlan.textContent = journal.nextPlan || '譛ｪ險伜・';
    if (dom.displayMeals) {
        const breakfast = journal.meals.breakfast || '譛ｪ險伜・';
        const lunch = journal.meals.lunch || '譛ｪ險伜・';
        const dinner = journal.meals.dinner || '譛ｪ險伜・';
        dom.displayMeals.innerHTML = `
            <div>譛・ ${escapeHtml(breakfast)}</div>
            <div>譏ｼ: ${escapeHtml(lunch)}</div>
            <div>譎ｩ: ${escapeHtml(dinner)}</div>
        `;
    }
    if (dom.displayWeight) dom.displayWeight.textContent = formatWithUnit(journal.weight, 'kg');
    if (dom.displaySleep) dom.displaySleep.textContent = formatWithUnit(journal.sleepHours, '時間');
}

function clearJournalFields() {
    fillJournalInputs({
        morning: '',
        done: '',
        notDone: '',
        nextPlan: '',
        meals: { breakfast: '', lunch: '', dinner: '' },
        weight: '',
        sleepHours: ''
    });
    fillJournalDisplays({
        morning: '',
        done: '',
        notDone: '',
        nextPlan: '',
        meals: { breakfast: '', lunch: '', dinner: '' },
        weight: '',
        sleepHours: ''
    });
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
        showToast('Firebase縺悟・譛溷喧縺輔ｌ縺ｦ縺・∪縺帙ｓ', 'error');
        return;
    }
    try {
        await window.auth.signInWithPopup(window.googleProvider);
    } catch (e) {
        console.error('[auth] login failed', { code: e.code, message: e.message });
        showToast('繝ｭ繧ｰ繧､繝ｳ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }
}

async function handleLogout() {
    if (!window.auth) return;
    try {
        await window.auth.signOut();
        showToast('繝ｭ繧ｰ繧｢繧ｦ繝医＠縺ｾ縺励◆');
    } catch (e) {
        console.error('[auth] logout failed', { code: e.code, message: e.message });
        showToast('繝ｭ繧ｰ繧｢繧ｦ繝医↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }
}

async function handleUpdatePassword() {
    if (!appState.user || !window.auth || !window.googleProvider) {
        showToast('繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞', 'error');
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
        showToast('繝代せ繝ｯ繝ｼ繝峨ｒ譖ｴ譁ｰ縺励∪縺励◆');
    } catch (e) {
        console.error('[auth] reauth failed', { code: e.code, message: e.message });
        showToast('隱崎ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
    }
}

async function handleForgotPassword() {
    if (!appState.user || !window.auth || !window.googleProvider) {
        showToast('繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞', 'error');
        return;
    }
    try {
        await window.auth.currentUser.reauthenticateWithPopup(window.googleProvider);
        openResetModal();
    } catch (e) {
        console.error('[auth] reset reauth failed', { code: e.code, message: e.message });
        showToast('隱崎ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
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
    showToast('繝代せ繝ｯ繝ｼ繝峨ｒ譖ｴ譁ｰ縺励∪縺励◆');
}

function closeSettingsModal() {
    if (!dom.modalSettings) return;
    dom.modalSettings.classList.add('hidden');
    dom.modalSettings.classList.remove('active');
}

async function saveEntryHelper() {
    if (!appState.user) {
        showToast('繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞', 'error');
        return;
    }

    const content = dom.inputContent ? dom.inputContent.value.trim() : '';
    if (!content && !currentUploadImage) {
        showToast('譛ｬ譁・ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞', 'error');
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
    const journal = {
        morning: dom.inputMorning ? dom.inputMorning.value.trim() : '',
        done: dom.inputDone ? dom.inputDone.value.trim() : '',
        not_done: dom.inputNotDone ? dom.inputNotDone.value.trim() : '',
        next_plan: dom.inputNextPlan ? dom.inputNextPlan.value.trim() : '',
        meals: {
            breakfast: dom.inputMealBreakfast ? dom.inputMealBreakfast.value.trim() : '',
            lunch: dom.inputMealLunch ? dom.inputMealLunch.value.trim() : '',
            dinner: dom.inputMealDinner ? dom.inputMealDinner.value.trim() : ''
        },
        weight: dom.inputWeight ? dom.inputWeight.value.trim() : '',
        sleep_hours: dom.inputSleep ? dom.inputSleep.value.trim() : ''
    };
    entry.meta = { ...(entry.meta || {}), journal };
    entry.journal = journal;

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

            showToast('日記は保存済みですが、解析または類似の保存に失敗しました。再試行してください。', 'error');
    openEntry(entryId);
    renderEntryList();
    if (appState.currentView === 'calendar') renderCalendar();
    if (appState.currentView === 'mypage') renderMyPage();

    const analysisOk = await runAnalysisForEntry(entry, !isNew);
    if (analysisOk) {
        await updateSummaryForCurrentPeriod();
        if (appState.currentView === 'mypage') renderMyPage();
    }
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
                    meta: data.meta || {},
                    journal: (data.meta && data.meta.journal) ? data.meta.journal : (data.journal || {})
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
        renderMonthlyGoal();
    } catch (e) {
        console.warn('Error loading user profile:', e);
        appState.userProfile = { mbti: '' };
        appState.userProfileLoaded = true;
        renderMonthlyGoal();
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
        alert('ログイン状態を確認してください。再読み込みしてください。');
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
        alert('菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆: ' + e.message);
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
        showToast('譌･險倥ｒ蜑企勁縺励∪縺励◆');
    } catch (e) {
        console.error('Delete Error:', e);
        showToast('蜑企勁縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
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
    const traitCounts = {};
    const topicCounts = {};
    let analyzedCount = 0;

    entries.forEach((entry) => {
                const analysis = appState.analysisById[entry.id];
        const topEmotion = getTopEmotion(analysis);
        const miniSummary = entry.isLocked
            ? 'ロック中'
            : (analysis
                ? `感情: ${topEmotion ? EMOTION_LABELS[topEmotion.key] : '不明'}${topEmotion ? ` (${Math.round(topEmotion.intensity || 0)}点)` : ''}`
                : '解析なし');

        let contentPrev = entry.content || '...';
        let cardTitle = entry.title || '日記';

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
    renderMonthlyGoal();
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
            opt.textContent = `${y}蟷ｴ`;
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

function getMonthlyGoalKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

function renderMonthlyGoal() {
    if (!dom.monthlyGoalTitle || !dom.monthlyGoalText) return;
    const date = appState.calendarDate || new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = getMonthlyGoalKey(date);
    const goals = (appState.userProfile && appState.userProfile.monthlyGoals) ? appState.userProfile.monthlyGoals : {};
    const text = goals[key] || '';
    dom.monthlyGoalTitle.textContent = `${year}年${month}月の目標`;
    if (!appState.user) {
        dom.monthlyGoalText.textContent = 'ログインすると保存できます';
    } else {
        dom.monthlyGoalText.textContent = text ? text : '未記入';
    }
}

async function editMonthlyGoal() {
    if (!appState.user) {
        showToast('ログインしてください', 'error');
        return;
    }
    const date = appState.calendarDate || new Date();
    const key = getMonthlyGoalKey(date);
    const goals = { ...(appState.userProfile?.monthlyGoals || {}) };
    const current = goals[key] || '';
    const input = window.prompt('月の目標を入力してください（空欄で削除）', current);
    if (input === null) return;
    const value = input.trim();
    if (value) {
        goals[key] = value;
    } else {
        delete goals[key];
    }
    await saveUserProfile({ monthlyGoals: goals });
    renderMonthlyGoal();
    showToast(value ? '目標を保存しました' : '目標を削除しました');
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
        alert('繧｢繝励Μ縺ｮ襍ｷ蜍輔↓螟ｱ謨励＠縺ｾ縺励◆: ' + e.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
} else {
    safeInit();
}










