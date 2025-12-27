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
    ISTJ: '莠句ｮ溘ｒ驥崎ｦ悶＠縲∬ｨ育判逧・↓迚ｩ莠九ｒ騾ｲ繧√ｋ蛯ｾ蜷代・,
    ISFJ: '諤昴＞繧・ｊ縺後≠繧翫∝捉蝗ｲ縺ｮ螳牙ｮ壹ｒ螟ｧ蛻・↓縺吶ｋ蛯ｾ蜷代・,
    INFJ: '蜀・怐逧・〒縲∵э蜻ｳ繧・ｾ｡蛟､繧呈ｷｱ縺剰・∴繧句だ蜷代・,
    INTJ: '蜈ｨ菴灘ワ繧呈緒縺阪・聞譛溽噪縺ｪ謌ｦ逡･繧堤ｫ九※繧句だ蜷代・,
    ISTP: '蜀ｷ髱吶↓迥ｶ豕√ｒ隕九※縲∝ｮ溽畑逧・↓蟇ｾ蜃ｦ縺吶ｋ蛯ｾ蜷代・,
    ISFP: '諢溯ｦ壹ｒ螟ｧ蛻・↓縺励∫ｩ上ｄ縺九↑驕ｸ謚槭ｒ螂ｽ繧蛯ｾ蜷代・,
    INFP: '逅・Φ繧・ｾ｡蛟､隕ｳ縺ｫ豐ｿ縺｣縺ｦ陦悟虚縺励ｄ縺吶＞蛯ｾ蜷代・,
    INTP: '隲也炊逧・↓閠・∴縲∫炊隗｣繧呈ｷｱ繧√ｋ縺薙→繧貞･ｽ繧蛯ｾ蜷代・,
    ESTP: '陦悟虚蜉帙′縺ゅｊ縲∫樟蝣ｴ縺ｧ邏譌ｩ縺丞虚縺丞だ蜷代・,
    ESFP: '蜻ｨ蝗ｲ縺ｨ讌ｽ縺励＆繧貞・譛峨＠縲∽ｽ馴ｨ薙ｒ驥崎ｦ悶☆繧句だ蜷代・,
    ENFP: '螂ｽ螂・ｿ・′蠑ｷ縺上∵眠縺励＞蜿ｯ閭ｽ諤ｧ繧定ｿｽ縺・ｄ縺吶＞蛯ｾ蜷代・,
    ENTP: '逋ｺ諠ｳ蜉帙′縺ゅｊ縲∵沐霆溘↓繧｢繧､繝・い繧定ｩｦ縺吝だ蜷代・,
    ESTJ: '蜉ｹ邇・ｄ遘ｩ蠎上ｒ驥崎ｦ悶＠縲∝ｮ溯｡悟鴨縺碁ｫ倥＞蛯ｾ蜷代・,
    ESFJ: '蜊碑ｪｿ諤ｧ縺碁ｫ倥￥縲・未菫よｧ繧貞､ｧ蛻・↓縺吶ｋ蛯ｾ蜷代・,
    ENFJ: '蜻ｨ蝗ｲ繧呈髪縺医∵婿蜷第ｧ繧堤､ｺ縺吶％縺ｨ縺悟､壹＞蛯ｾ蜷代・,
    ENTJ: '逶ｮ逧・ｿ怜髄縺ｧ縲∝愛譁ｭ縺ｨ謗ｨ騾ｲ縺碁溘＞蛯ｾ蜷代・
};
const TOPIC_KEYWORDS = {
    莉穂ｺ・ ['莉穂ｺ・, '莨夂､ｾ', '荳雁昇', '閨ｷ蝣ｴ', '莨夊ｭｰ', '谿区･ｭ', '蜃ｺ蜍､', '騾蜍､', '讌ｭ蜍・, '繝｡繝ｼ繝ｫ', '蝟ｶ讌ｭ', '霆｢閨ｷ', '蜒・],
    諱区・: ['諱区・', '諱倶ｺｺ', '蠖ｼ豌・, '蠖ｼ螂ｳ', '螂ｽ縺・, '繝・・繝・, '迚・昴＞', '螟ｱ諱・, '邨仙ｩ・, '蛻･繧・],
    螳ｶ譌・ ['螳ｶ譌・, '豈・, '辷ｶ', '蜈・, '蟋・, '蠑・, '螯ｹ', '蟄舌←繧・, '蟄蝉ｾ・, '隕ｪ', '荳｡隕ｪ'],
    蜿倶ｺｺ: ['蜿倶ｺｺ', '蜿矩＃', '蜿九□縺｡', '莉ｲ髢・, '蜷悟・', '蜷梧悄', '蜈郁ｼｩ', '蠕瑚ｼｩ'],
    縺企≡: ['縺企≡', '邨ｦ譁・, '雋ｯ驥・, '謾ｯ蜃ｺ', '遽邏・, '隲区ｱ・, '螳ｶ險・, '蜿主・', '蜃ｺ雋ｻ'],
    蛛･蠎ｷ: ['蛛･蠎ｷ', '菴楢ｪｿ', '逞・劼', '阮ｬ', '逹｡逵', '逍ｲ繧・, '鬚ｨ驍ｪ', '逞帙∩', '鬟滉ｺ・, '驕句虚'],
    蜍牙ｼｷ: ['蜍牙ｼｷ', '蟄ｦ鄙・, '隧ｦ鬨・, '繝・せ繝・, '雉・ｼ', '隰帛ｺｧ', '螳ｿ鬘・],
    雜｣蜻ｳ: ['雜｣蜻ｳ', '譏逕ｻ', '髻ｳ讌ｽ', '繧ｲ繝ｼ繝', '譌・｡・, '繧ｫ繝輔ぉ', '隱ｭ譖ｸ', '蜀咏悄'],
    蟆・擂: ['蟆・擂', '譛ｪ譚･', '螟｢', '逶ｮ讓・, '荳榊ｮ・, '譛溷ｾ・, '險育判'],
    閾ｪ逕ｱ: ['閾ｪ逕ｱ', '蛻ｶ髯・, '譚溽ｸ・, '菴呵｣・, '譎る俣'],
    逕滓ｴｻ: ['逕滓ｴｻ', '螳ｶ莠・, '譁咏炊', '謗・勁', '豢玲ｿｯ', '雋ｷ縺・黄']
};
const PERSONALITY_TRAIT_MAP = {
    jump_to_conclusion: '邨占ｫ悶ｒ譌ｩ縺丞・縺励′縺｡',
    overgeneralization: '迚ｩ莠九ｒ蠎・￥謐峨∴縺後■',
    black_and_white: '逋ｽ鮟偵・縺｣縺阪ｊ縺輔○縺溘＞',
    emotional_reasoning: '諢滓ュ繧帝㍾隕悶＠繧・☆縺・,
    self_blame: '閾ｪ雋ｬ蛯ｾ蜷代′蜃ｺ繧・☆縺・,
    mind_reading: '逶ｸ謇九・諢丞峙繧呈Φ蜒上＠縺後■',
    catastrophizing: '繝ｪ繧ｹ繧ｯ繧貞・隱ｭ縺ｿ縺励ｄ縺吶＞',
    magnification_minimization: '濶ｯ縺玲が縺励・隧穂ｾ｡縺梧険繧後ｄ縺吶＞',
    should_statements: '逅・Φ繧・ｦ冗ｯ・ｒ螟ｧ蛻・↓縺吶ｋ',
    negative_filter: '谺轤ｹ縺ｫ豕ｨ諢上′蜷代″繧・☆縺・,
    comparison_inferiority: '豈碑ｼ・〒隧穂ｾ｡縺励′縺｡',
    avoidance_procrastination: '諷朱㍾縺ｧ蝗樣∩逧・↓縺ｪ繧翫ｄ縺吶＞'
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
    { id: 'jump_to_conclusion', label: '邨占ｫ悶・鬟幄ｺ・, desc: '譬ｹ諡縺悟ｰ代↑縺・∪縺ｾ邨占ｫ悶ｒ蜃ｺ縺・ },
    { id: 'overgeneralization', label: '驕主ｺｦ縺ｮ荳闊ｬ蛹・, desc: '荳蠎ｦ縺ｮ蜃ｺ譚･莠九〒蜈ｨ菴薙ｒ豎ｺ繧√▽縺代ｋ' },
    { id: 'black_and_white', label: '逋ｽ鮟呈晁・, desc: '讌ｵ遶ｯ縺ｫ謐峨∴繧・ },
    { id: 'emotional_reasoning', label: '諢滓ュ縺ｧ豎ｺ繧√▽縺・, desc: '豌怜・繧剃ｺ句ｮ溘□縺ｨ縺ｿ縺ｪ縺・ },
    { id: 'self_blame', label: '閾ｪ蟾ｱ蜷ｦ螳・, desc: '閾ｪ蛻・・縺帙＞縺縺ｨ豎ｺ繧√▽縺代ｋ' },
    { id: 'mind_reading', label: '莉冶・・諢丞峙縺ｮ隱ｭ縺ｿ縺吶℃', desc: '逶ｸ謇九・諢丞峙繧呈ｱｺ繧√▽縺代ｋ' },
    { id: 'catastrophizing', label: '譛ｪ譚･縺ｮ謔ｲ隕ｳ', desc: '謔ｪ縺・ｵ先棡繧呈ｱｺ繧√▽縺代ｋ' },
    { id: 'magnification_minimization', label: '諡｡螟ｧ繝ｻ驕主ｰ剰ｩ穂ｾ｡', desc: '謔ｪ縺・せ縺ｯ螟ｧ縺阪￥縲∬憶縺・せ縺ｯ蟆上＆縺剰ｦ九ｋ' },
    { id: 'should_statements', label: '縺ｹ縺肴晁・, desc: '縲懊☆縺ｹ縺阪〒邵帙ｋ' },
    { id: 'negative_filter', label: '繝阪ぎ繝・ぅ繝匁歓蜃ｺ', desc: '謔ｪ縺・せ縺縺代↓豕ｨ逶ｮ縺吶ｋ' },
    { id: 'comparison_inferiority', label: '豈碑ｼ・・蜉｣遲画─', desc: '莉紋ｺｺ縺ｨ豈斐∋縺ｦ閾ｪ蛻・ｒ荳九￡繧・ },
    { id: 'avoidance_procrastination', label: '蝗樣∩繝ｻ蜈亥ｻｶ縺ｰ縺・, desc: '荳榊ｮ峨ｄ雋諡・°繧芽｡悟虚繧帝∩縺代ｋ' }
];

const PATTERN_ALIASES = {
    inference_jump: 'jump_to_conclusion',
    jump_to_conclusion: 'jump_to_conclusion',
    '邨占ｫ夜｣幄ｺ・: 'jump_to_conclusion',
    '邨占ｫ悶・鬟幄ｺ・: 'jump_to_conclusion',
    overgeneralization: 'overgeneralization',
    '驕主ｺｦ縺ｮ荳闊ｬ蛹・: 'overgeneralization',
    black_and_white: 'black_and_white',
    all_or_nothing: 'black_and_white',
    'all-or-nothing': 'black_and_white',
    '逋ｽ鮟呈晁・: 'black_and_white',
    emotional_reasoning: 'emotional_reasoning',
    '諢滓ュ縺ｧ豎ｺ繧√▽縺・: 'emotional_reasoning',
    '諢滓ュ逧・ｱｺ繧√▽縺・: 'emotional_reasoning',
    self_blame: 'self_blame',
    'self-blame': 'self_blame',
    '閾ｪ蟾ｱ蜷ｦ螳・: 'self_blame',
    '閾ｪ蟾ｱ雋ｬ莉ｻ蛹・: 'self_blame',
    mind_reading: 'mind_reading',
    'mind-reading': 'mind_reading',
    '莉冶・・諢丞峙縺ｮ隱ｭ縺ｿ縺吶℃': 'mind_reading',
    '隱ｭ蠢・: 'mind_reading',
    catastrophizing: 'catastrophizing',
    '譛ｪ譚･縺ｮ謔ｲ隕ｳ': 'catastrophizing',
    '譛謔ｪ莠域ｸｬ': 'catastrophizing',
    magnification_minimization: 'magnification_minimization',
    '諡｡螟ｧ繝ｻ驕主ｰ剰ｩ穂ｾ｡': 'magnification_minimization',
    '諡｡螟ｧ': 'magnification_minimization',
    '驕主ｰ剰ｩ穂ｾ｡': 'magnification_minimization',
    should_statements: 'should_statements',
    '縺ｹ縺肴晁・: 'should_statements',
    negative_filter: 'negative_filter',
    '繝阪ぎ繝・ぅ繝匁歓蜃ｺ': 'negative_filter',
    '繝阪ぎ繝・ぅ繝悶ヵ繧｣繝ｫ繧ｿ繝ｼ': 'negative_filter',
    '驕ｸ謚樒噪豕ｨ逶ｮ': 'negative_filter',
    comparison_inferiority: 'comparison_inferiority',
    '豈碑ｼ・・蜉｣遲画─': 'comparison_inferiority',
    '豈碑ｼ・: 'comparison_inferiority',
    '蜉｣遲画─': 'comparison_inferiority',
    avoidance_procrastination: 'avoidance_procrastination',
    '蝗樣∩繝ｻ蜈亥ｻｶ縺ｰ縺・: 'avoidance_procrastination',
    '蝗樣∩': 'avoidance_procrastination',
    '蜈亥ｻｶ縺ｰ縺・: 'avoidance_procrastination'
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
        showToast('迴ｾ蝨ｨ縺ｮ繝代せ繝ｯ繝ｼ繝峨′驕輔＞縺ｾ縺・, 'error');
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

    showToast('菫晏ｭ倥＠縺ｾ縺励◆');
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
        alert('繝ｭ繧ｰ繧､繝ｳ迥ｶ諷九ｒ遒ｺ隱阪〒縺阪∪縺帙ｓ縲ょ・隱ｭ縺ｿ霎ｼ縺ｿ縺励※縺上□縺輔＞縲・);
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
            const traitLabel = PERSONALITY_TRAIT_MAP[entry.id];
            if (traitLabel) {
                traitCounts[traitLabel] = (traitCounts[traitLabel] || 0) + 1;
            }
        });

        const topics = new Set(extractTopics(entry));
        topics.forEach((topic) => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
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

    const traitsSorted = Object.keys(traitCounts)
        .map((label) => ({ label, count: traitCounts[label] }))
        .sort((a, b) => b.count - a.count);

    const topicsSorted = Object.keys(topicCounts)
        .map((label) => ({ label, count: topicCounts[label] }))
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
        traitCounts,
        traitsSorted,
        topicsSorted
    };
}

function renderRankList(items, unit) {
    if (!items.length) {
        return `<div class="rank-empty">譛ｪ髮・ｨ・/div>`;
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

function stripParenthetical(text) {
    if (!text) return '';
    return String(text).replace(/\s*[?(][^?)]+[?)]\s*$/, '').trim();
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
        showToast('隕∫ｴ・・譖ｴ譁ｰ縺ｫ螟ｱ謨励＠縺ｾ縺励◆', 'error');
    } finally {
        appState.summaryUpdating = false;
        renderMyPage();
    }
}

function updateSummaryForCurrentPeriod() {
    const periodKey = appState.period || '7d';
    const periodConfig = getPeriodConfig(periodKey);
    const filtered = filterEntriesByPeriod(appState.entries || [], periodConfig.from);
    const stats = aggregateStats(filtered);
    if (!stats.totalCount) {
        appState.summaryText = '';
        appState.summaryPeriod = '';
        appState.summaryUpdatedAt = null;
        return Promise.resolve();
    }
    return requestSummaryUpdate(periodKey, periodConfig.label, stats);
}

function renderMyPage() {
    if (!dom.mypageContainer) return;
    const periodKey = appState.period || '7d';
    const periodConfig = getPeriodConfig(periodKey);
    const filtered = filterEntriesByPeriod(appState.entries || [], periodConfig.from)
        .sort((a, b) => getEntryDate(b) - getEntryDate(a));
    const stats = aggregateStats(filtered);

    const topEmotion = stats.emotionsSorted[0];
    const topEmotionLabel = topEmotion ? (EMOTION_LABELS[topEmotion.key] || topEmotion.key) : '譛ｪ髮・ｨ・;
    const emotionTotal = stats.analyzedCount || 0;
    const topEmotionPct = emotionTotal ? Math.round((topEmotion.count / emotionTotal) * 100) : 0;
    const topEmotionValue = emotionTotal ? `${topEmotionLabel} ${topEmotionPct}%` : '譛ｪ髮・ｨ・;

    const topPattern = stats.patternsSorted[0];
    const topPatternValue = topPattern ? `${topPattern.label} (${topPattern.count})` : '譛ｪ髮・ｨ・;

    const summaryAvailable = appState.summaryPeriod === periodKey && appState.summaryText;
    const summaryText = summaryAvailable ? appState.summaryText : '隕∫ｴ・・譛ｪ譖ｴ譁ｰ縺ｧ縺吶・;
    const themes = summaryAvailable ? appState.themes : [];

    const emotionTop5 = stats.emotionsSorted.slice(0, 5).map((e) => ({
        label: EMOTION_LABELS[e.key] || e.key,
        value: emotionTotal ? Math.round((e.count / emotionTotal) * 100) + '%' : '0%'
    }));
    const patternTop5 = stats.patternsSorted.slice(0, 5).map((p) => ({
        label: p.label,
        value: p.count
    }));
    const traitTop3 = stats.traitsSorted.slice(0, 3).map((t) => ({
        label: t.label,
        value: t.count
    }));
    const topicTop10 = stats.topicsSorted.slice(0, 10).map((t) => ({
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
    const mbtiDisplay = mbtiValue ? mbtiValue : '譛ｪ險ｭ螳・;
    const mbtiInsight = getMbtiInsight(mbtiValue);
    const personalityInsight = buildDiaryPersonalityInsight(stats);

    const periodButtons = [
        { key: '7d', label: '7譌･' },
        { key: '30d', label: '30譌･' },
        { key: '90d', label: '90譌･' },
        { key: 'all', label: '蜈ｨ譛滄俣' }
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
            : `<button id="btn-similar-refresh" class="btn-text-sm">鬘樔ｼｼ譌･險倥ｒ讀懃ｴ｢</button>`)
        : `<div class="rank-empty">隧ｲ蠖捺悄髢薙・譌･險倥′縺ゅｊ縺ｾ縺帙ｓ</div>`;

    dom.mypageContainer.innerHTML = `
        <div class="mypage-stack">
            <div class="period-selector">
                <div class="period-buttons">
                    ${periodButtons.map((btn) => `
                        <button class="period-btn ${btn.key === periodKey ? 'active' : ''}" data-period="${btn.key}">${btn.label}</button>
                    `).join('')}
                </div>
                <button id="btn-summary-refresh" class="btn-secondary" ${appState.summaryUpdating ? 'disabled' : ''}>${appState.summaryUpdating ? '譖ｴ譁ｰ荳ｭ...' : '隕∫ｴ・ｒ譖ｴ譁ｰ'}</button>
            </div>

            <div class="stat-card summary-card">
                <div class="summary-header">
                    <h3>莉翫・隕∫ｴ・/h3>
                    <span class="summary-period">${periodConfig.label}</span>
                </div>
                <p class="summary-text">${escapeHtml(summaryText)}</p>
            </div>

            <div class="stats-grid" style="width:100%;">
                <div class="stat-card"> <i class="fa-solid fa-book stat-icon"></i> <div class="stat-value">${stats.totalCount}</div> <div class="stat-label">譌･險倥・邱乗焚</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-fire stat-icon"></i> <div class="stat-value">${stats.streak}</div> <div class="stat-label">騾｣邯壽兜遞ｿ譌･謨ｰ</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-trophy stat-icon"></i> <div class="stat-value">${stats.longestStreak}</div> <div class="stat-label">譛髟ｷ騾｣邯壽兜遞ｿ譌･謨ｰ</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-keyboard stat-icon"></i> <div class="stat-value">${stats.totalChars.toLocaleString('ja-JP')}</div> <div class="stat-label">謚慕ｨｿ縺ｮ邱乗枚蟄玲焚</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-heart stat-icon"></i> <div class="stat-value">${escapeHtml(topEmotionValue)}</div> <div class="stat-label">諢滓ュTop1</div> </div>
                <div class="stat-card"> <i class="fa-solid fa-brain stat-icon"></i> <div class="stat-value">${escapeHtml(topPatternValue)}</div> <div class="stat-label">隱咲衍繝代ち繝ｼ繝ｳTop1</div> </div>
            </div>

            <div class="ranking-grid">
                <div class="stat-card">
                    <h4>諢滓ュTop5</h4>
                    ${renderRankList(emotionTop5, '')}
                </div>
                <div class="stat-card">
                    <h4>隱咲衍繝代ち繝ｼ繝ｳTop5</h4>
                    ${renderRankList(patternTop5, '')}
                </div>
                <div class="stat-card">
                    <h4>鬆ｻ蜃ｺ繝医ヴ繝・けTop10</h4>
                    ${renderRankList(topicTop10, '')}
                </div>
            </div>

            <div class="stats-grid" style="width:100%;">
                <div class="stat-card">
                    <h4>MBTI</h4>
                    <div class="mbti-row">
                        <select id="mbti-select" class="filter-input">
                            <option value="">譛ｪ險ｭ螳・/option>
                            ${MBTI_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
                        </select>
                        <div class="mbti-note">莉ｻ諢上り・蟾ｱ逕ｳ蜻翫・陬懷勧諠・ｱ縺ｨ縺励※菴ｿ逕ｨ縺励∪縺吶・/div>
                        <div class="mbti-current">迴ｾ蝨ｨ: ${escapeHtml(mbtiDisplay)}</div>
                        <div class="analysis-text">諤ｧ譬ｼ縺ｮ迚ｹ蠕ｴ: ${escapeHtml(mbtiInsight)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <h4>譌･險倥°繧芽ｪｭ縺ｿ蜿悶ｌ繧区ｧ譬ｼ險ｺ譁ｭ・域耳螳夲ｼ・/h4>
                    <p class="analysis-text">${escapeHtml(personalityInsight)}</p>
                </div>
                <div class="stat-card">
                    <h4>諤ｧ譬ｼ縺ｮ蛯ｾ蜷禅op3</h4>
                    ${renderRankList(traitTop3, '')}
                </div>
            </div>

            <div class="stat-card pattern-catalog-card">
                <h4>隱咲衍繝代ち繝ｼ繝ｳ荳隕ｧ</h4>
                <p class="pattern-catalog-note">蝗ｺ螳・2遞ｮ鬘槭・隱ｬ譏弱〒縺吶・/p>
                <ul class="pattern-catalog">${patternCatalogHtml}</ul>
            </div>

            <div class="stat-card themes-card">
                <h4>郢ｰ繧願ｿ斐＠繝・・繝杁op3</h4>
                <div class="themes-list">
                    ${themes.length ? themes.map((t) => `<span class="tag">${escapeHtml(stripParenthetical(t))}</span>`).join('') : '<span class="rank-empty">譛ｪ譖ｴ譁ｰ</span>'}
                </div>
            </div>

            <div class="stat-card similar-card">
                <h4>譛霑代・莨ｼ縺ｦ縺・ｋ譌･</h4>
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
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = entry.title || '\u30b8\u30e3\u30fc\u30ca\u30eb';
        if (dom.displayDate) {
            dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${formatDate(getEntryDate(entry))} <span style="font-size:0.8em; margin-left:10px;">${formatTime(getEntryDate(entry))}</span>`;
        }
        if (dom.selectLockStatus) dom.selectLockStatus.value = entry.isLocked ? 'locked' : 'unlocked';
        const journal = getJournalFromEntry(entry);
        fillJournalInputs(journal);
        fillJournalDisplays(journal);
        if (dom.journalSections) dom.journalSections.classList.remove('hidden');

        if (entry.isLocked) {
            toggleEditMode(false);
            if (dom.contentDisplayText) dom.contentDisplayText.classList.add('hidden');
            if (dom.lockOverlay) dom.lockOverlay.classList.remove('hidden');
            if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden');
            if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
            if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'none';
            if (dom.journalSections) dom.journalSections.classList.add('hidden');
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
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u30b8\u30e3\u30fc\u30ca\u30eb';
        if (dom.displayDate) dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-plus"></i> ${formatDate(appState.writingDate)}`;
        if (dom.selectLockStatus) dom.selectLockStatus.value = 'unlocked';
        if (dom.inputContent) dom.inputContent.value = '';
        clearJournalFields();
        if (dom.displayScore) dom.displayScore.innerHTML = '';
        if (dom.entryImageInput) dom.entryImageInput.value = '';
        if (dom.imagePreview) dom.imagePreview.src = '';
        if (dom.imagePreviewContainer) dom.imagePreviewContainer.classList.add('hidden');
        if (dom.analysisPanel) dom.analysisPanel.innerHTML = '';
        if (dom.journalSections) dom.journalSections.classList.remove('hidden');
        toggleEditMode(true);
        setTimeout(() => {
            if (dom.inputContent) {
                dom.inputContent.focus();
                if (autoResizeTextarea) autoResizeTextarea();
            }
            resizeAllJournalTextareas();
        }, 100);
    }
}

function toggleEditMode(isEdit) {
    if (isEdit) {
        if (dom.inputContent) dom.inputContent.classList.remove('hidden');
        if (dom.contentDisplayText) dom.contentDisplayText.classList.add('hidden');
        setJournalEditMode(true);
        if (dom.btnSave) dom.btnSave.classList.remove('hidden');
        if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
        if (dom.btnUploadImage) dom.btnUploadImage.classList.remove('hidden');
        if (dom.btnRemoveImage) dom.btnRemoveImage.classList.remove('hidden');
        if (dom.selectLockStatus) dom.selectLockStatus.disabled = false;
        if (appState.activeEntryId) {
            const entry = appState.entries.find(e => e.id === appState.activeEntryId);
            if (entry) {
                if (dom.inputContent) dom.inputContent.value = entry.content;
                const journal = getJournalFromEntry(entry);
                fillJournalInputs(journal);
                if (dom.btnSave) dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> \u4fdd\u5b58';
                if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u30b8\u30e3\u30fc\u30ca\u30eb';
            }
            if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'inline-flex';
        } else {
            if (dom.btnSave) dom.btnSave.innerHTML = '<i class="fa-solid fa-save"></i> \u4fdd\u5b58';
            if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u30b8\u30e3\u30fc\u30ca\u30eb';
        }
        setTimeout(() => {
            if (autoResizeTextarea) autoResizeTextarea();
            resizeAllJournalTextareas();
        }, 10);
    } else {
        if (dom.inputContent) dom.inputContent.classList.add('hidden');
        if (dom.contentDisplayText) dom.contentDisplayText.classList.remove('hidden');
        setJournalEditMode(false);
        if (dom.btnSave) dom.btnSave.classList.add('hidden');
        if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'inline-flex';
        if (dom.btnUploadImage) dom.btnUploadImage.classList.add('hidden');
        if (dom.btnRemoveImage) dom.btnRemoveImage.classList.add('hidden');
        if (dom.selectLockStatus) dom.selectLockStatus.disabled = true;
        if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'none';
        if (appState.activeEntryId) {
            const entry = appState.entries.find(e => e.id === appState.activeEntryId);
            if (entry && dom.contentDisplayText) dom.contentDisplayText.textContent = entry.content;
            if (entry) {
                const journal = getJournalFromEntry(entry);
                fillJournalDisplays(journal);
            }
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
        dom.analysisPanel.innerHTML = '<div class="analysis-status">繝ｭ繝・け荳ｭ</div>';
        return;
    }

    const analysis = appState.analysisById[entry.id];
    const status = appState.analysisStatusById[entry.id] || (analysis ? 'done' : 'none');

    if (status === 'processing') {
        dom.analysisPanel.innerHTML = '<div class="analysis-status">隗｣譫蝉ｸｭ...</div>';
        return;
    }

    if (status === 'failed') {
        dom.analysisPanel.innerHTML = `
            <div class="analysis-status">隗｣譫舌↓螟ｱ謨励＠縺ｾ縺励◆</div>
            <button class="btn-secondary" onclick="retryAnalysisHelper('${entry.id}')">隗｣譫舌ｒ蜀崎ｩｦ陦・/button>
        `;
        return;
    }

    if (!analysis) {
        dom.analysisPanel.innerHTML = `
            <div class="analysis-status">隗｣譫舌′縺ｾ縺縺ゅｊ縺ｾ縺帙ｓ</div>
            <button class="btn-secondary" onclick="retryAnalysisHelper('${entry.id}')">隗｣譫舌ｒ螳溯｡・/button>
        `;
        return;
    }

    const topEmotion = getTopEmotion(analysis);
    const emotionLabel = topEmotion ? EMOTION_LABELS[topEmotion.key] : '荳肴・';
    const emotionScore = topEmotion ? Math.round(topEmotion.intensity || 0) : null;
    const summaryText = (analysis.observation_comment || '').trim();
    const summarySafe = summaryText
        ? escapeHtml(summaryText)
        : `縲・{emotionLabel}縲阪′荳ｭ蠢・・險倬鹸縺ｧ縺吶Ａ;

    const facts = (analysis.facts || []).map(escapeHtml);
    const story = (analysis.story || []).map(escapeHtml);
    const emotions = (analysis.emotions || []).map((e) => {
        const key = normalizeEmotionKey(e.label || e.primary || e.emotion);
        const name = key ? EMOTION_LABELS[key] : (e.label || '荳肴・');
        const intensity = Math.round(e.intensity_0_100 || 0);
        const certainty = e.certainty_0_1 != null ? Number(e.certainty_0_1).toFixed(2) : null;
        return `${escapeHtml(name)}${Number.isFinite(intensity) ? ` ${intensity}轤ｹ` : ''}${certainty ? ` (遒ｺ蠎ｦ ${certainty})` : ''}`;
    });
    const patternsList = Array.isArray(analysis.patterns)
        ? analysis.patterns
        : (analysis.patterns ? Object.values(analysis.patterns) : []);
    const sortedPatterns = [...patternsList].sort((a, b) => (b.confidence_0_1 || 0) - (a.confidence_0_1 || 0));
    const matchedPatterns = sortedPatterns
        .map((p) => ({ entry: getPatternEntry(p), raw: p }))
        .filter((item) => item.entry);
    const patterns = matchedPatterns.map(({ entry, raw }) => {
        const conf = typeof raw === 'object' && raw !== null && raw.confidence_0_1 != null
            ? Number(raw.confidence_0_1).toFixed(2)
            : null;
        const meta = conf ? `遒ｺ蠎ｦ ${conf}` : '';
        return `
            <li class="pattern-item">
                <div class="pattern-label">${escapeHtml(entry.label)}${meta ? ` <span class="pattern-meta">${meta}</span>` : ''}</div>
                ${entry.desc ? `<div class="pattern-desc">${escapeHtml(entry.desc)}</div>` : ''}
            </li>
        `;
    });
    const patternsHtml = patterns.length
        ? patterns.join('')
        : '<li class="pattern-empty">隧ｲ蠖薙↑縺・/li>';
    const habitInsight = buildHabitInsight(sortedPatterns);
    const nextStep = buildNextStepSuggestion(analysis, sortedPatterns);
    const topics = extractTopics(entry);

    const similar = appState.similarById[entry.id] || [];
    const similarHtml = similar.length
        ? similar.map((s) => {
            const ref = appState.entries.find(e => e.id === s.entry_id);
            const label = ref ? escapeHtml(ref.content || '').slice(0, 40) : s.entry_id;
            return `<button class="btn-text-sm" onclick="openEntry('${s.entry_id}')">${label}</button>`;
        }).join('')
        : `<button class="btn-text-sm" onclick="fetchSimilarForEntryById('${entry.id}')">鬘樔ｼｼ繧呈､懃ｴ｢</button>`;

    dom.analysisPanel.innerHTML = `
        <div class="analysis-block">
            <div class="analysis-summary">
                <div class="analysis-summary-header">
                    <div>
                        <div class="analysis-title">莉頑律縺ｮ豌怜・</div>
                        <div class="analysis-emotion">${emotionLabel}${emotionScore != null ? ` <span class="analysis-emotion-score">${emotionScore}轤ｹ</span>` : ''}</div>
                    </div>
                    <div class="analysis-actions">
                        <button class="btn-text-sm" onclick="retryAnalysisHelper('${entry.id}')">蜀崎ｧ｣譫・/button>
                    </div>
                </div>
                <div class="analysis-summary-text">${summarySafe}</div>
            </div>
        </div>
        <div class="analysis-block">
            <div class="analysis-title">莨ｼ縺ｦ縺・ｋ譌･險・/div>
            <div class="analysis-similar">${similarHtml}</div>
        </div>
        <div class="analysis-block analysis-details is-open" id="analysis-details-${entry.id}">
            <div class="analysis-detail-grid">
                <div class="analysis-detail">
                    <h4>諢滓ュ縺ｮ蜀・ｨｳ</h4>
                    <ul class="analysis-list">${emotions.map(f => `<li>${f}</li>`).join('') || '<li>縺ｪ縺・/li>'}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>隱咲衍繝代ち繝ｼ繝ｳ</h4>
                    <ul class="analysis-list">${patternsHtml}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>閠・∴譁ｹ縺ｮ逋・/h4>
                    <p class="analysis-text">${escapeHtml(habitInsight)}</p>
                </div>
                <div class="analysis-detail">
                    <h4>谺｡縺ｮ荳豁ｩ</h4>
                    <p class="analysis-text">${escapeHtml(nextStep)}</p>
                </div>
                <div class="analysis-detail">
                    <h4>鬆ｻ蜃ｺ繝医ヴ繝・け</h4>
                    <div class="analysis-tags">${topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') || '<span class="tag">隧ｲ蠖薙↑縺・/span>'}</div>
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
        btn.textContent = details.classList.contains('is-open') ? '隧ｳ邏ｰ繧帝哩縺倥ｋ' : '隧ｳ邏ｰ繧定ｦ九ｋ';
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
            showToast('隗｣譫舌・菫晏ｭ倥↓螟ｱ謨励＠縺ｾ縺励◆', 'error');
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
            showToast('譌･險倥・菫晏ｭ俶ｸ医∩縺ｧ縺吶りｧ｣譫舌・縺ｿ螟ｱ謨励＠縺ｾ縺励◆縲ょ・隧ｦ陦後〒縺阪∪縺吶・, 'error');
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
    const label = key ? EMOTION_LABELS[key] : '荳肴・';
    const markers = key ? [{ key, size: 14, opacity: 1 }] : [];
    const chart = renderEmotionImage(markers);

    return `
        <div class="emotion-wheel-wrap">
            ${chart}
            <div class="emotion-caption">諢滓ュ: <strong>${label}</strong></div>
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
            <img src="${EMOTION_IMAGE_PATH}" alt="繝励Ν繝√ャ繧ｯ縺ｮ諢滓ュ縺ｮ霈ｪ" class="emotion-image">
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

function extractTopics(entry) {
    const base = `${entry?.content || ''}`;
    if (!base.trim()) return [];
    const normalized = base.replace(/\s+/g, '');
    const topics = [];
    Object.keys(TOPIC_KEYWORDS).forEach((topic) => {
        const keywords = TOPIC_KEYWORDS[topic] || [];
        if (keywords.some((kw) => normalized.includes(kw))) {
            topics.push(topic);
        }
    });
    return topics;
}

function buildNextStepSuggestion(analysis, patternsList) {
    const topEmotion = getTopEmotion(analysis);
    const topPatternEntry = patternsList && patternsList.length ? getPatternEntry(patternsList[0]) : null;
    const patternId = topPatternEntry ? topPatternEntry.id : null;

    const patternSuggestions = {
        jump_to_conclusion: '邨占ｫ悶ｒ蜃ｺ縺吝燕縺ｫ縲∽ｺ句ｮ溘ｒ1縺､縺縺題ｿｽ蜉縺ｧ遒ｺ隱阪＠縺ｦ縺ｿ繧九・,
        overgeneralization: '莉頑律縺ｮ蜃ｺ譚･莠九・萓句､悶ｒ1縺､譖ｸ縺榊・縺励※縺ｿ繧九・,
        black_and_white: '逋ｽ鮟剃ｻ･螟悶・荳ｭ髢薙・驕ｸ謚櫁い繧・縺､閠・∴縺ｦ縺ｿ繧九・,
        emotional_reasoning: '豌怜・縺ｨ莠句ｮ溘ｒ蛻・￠縺ｦ1陦後★縺､譖ｸ縺・※縺ｿ繧九・,
        self_blame: '閾ｪ蛻・・隕∝屏縺ｨ螟也噪隕∝屏繧貞・縺代※謨ｴ逅・＠縺ｦ縺ｿ繧九・,
        mind_reading: '逶ｸ謇九↓遒ｺ隱阪〒縺阪ｋ莠句ｮ溘□縺代ｒ譖ｸ縺榊・縺励※縺ｿ繧九・,
        catastrophizing: '譛謔ｪ縺ｨ譛濶ｯ縺ｮ2繝代ち繝ｼ繝ｳ繧呈嶌縺・※蟷・ｒ菴懊ｋ縲・,
        magnification_minimization: '濶ｯ縺九▲縺溽せ繧・縺､蜷後§驥阪＆縺ｧ譖ｸ縺・※縺ｿ繧九・,
        should_statements: '縲後懊☆縺ｹ縺阪阪ｒ縲後懊＠縺溘＞縲阪↓險縺・鋤縺医※縺ｿ繧九・,
        negative_filter: '濶ｯ縺九▲縺溽せ繧・縺､縺縺題ｿｽ蜉縺ｧ譖ｸ縺・※縺ｿ繧九・,
        comparison_inferiority: '閾ｪ蛻・渕貅悶〒縺ｧ縺阪◆縺薙→繧・縺､譖ｸ縺・※縺ｿ繧九・,
        avoidance_procrastination: '5蛻・□縺醍捩謇九☆繧句ｰ上＆縺ｪ荳豁ｩ繧呈ｱｺ繧√ｋ縲・
    };
    if (patternId && patternSuggestions[patternId]) return patternSuggestions[patternId];

    if (!topEmotion) return '蟆上＆縺ｪ陦悟虚繧・縺､豎ｺ繧√※螳溯｡後＠縺ｦ縺ｿ繧九・;
    switch (topEmotion.key) {
        case 'sadness':
            return '莉頑律縺ｯ莨第・繧・屓蠕ｩ繧貞━蜈医☆繧区凾髢薙ｒ菴懊▲縺ｦ縺ｿ繧九・;
        case 'fear':
            return '荳榊ｮ峨・豁｣菴薙ｒ1陦後〒譖ｸ縺榊・縺励※縺ｿ繧九・;
        case 'anger':
            return '關ｽ縺｡逹縺上◆繧√↓荳蠎ｦ豺ｱ蜻ｼ蜷ｸ縺励※霍晞屬繧堤ｽｮ縺上・;
        case 'joy':
            return '螫峨＠縺九▲縺溽炊逕ｱ繧・縺､谿九＠縺ｦ縺ｿ繧九・;
        case 'anticipation':
            return '譛溷ｾ・＠縺ｦ縺・ｋ縺薙→縺ｫ蜷代￠縺ｦ蟆上＆縺ｪ貅門ｙ繧偵☆繧九・;
        case 'trust':
            return '菫｡鬆ｼ縺ｧ縺阪ｋ莠ｺ縺ｨ縺ｮ髢｢菫ゅｒ1縺､謖ｯ繧願ｿ斐ｋ縲・;
        case 'surprise':
            return '鬩壹＞縺溽せ繧・縺､蟄ｦ縺ｳ縺ｫ螟峨∴縺ｦ縺ｿ繧九・;
        case 'disgust':
            return '雖後□縺｣縺溽せ縺ｨ霍晞屬繧貞叙繧区婿豕輔ｒ1縺､閠・∴繧九・;
        default:
            return '蟆上＆縺ｪ陦悟虚繧・縺､豎ｺ繧√※螳溯｡後＠縺ｦ縺ｿ繧九・;
    }
}

function buildDiaryPersonalityInsight(stats) {
    if (!stats || !stats.analyzedCount) {
        return '蛻・梵繝・・繧ｿ縺後∪縺縺ゅｊ縺ｾ縺帙ｓ縲よ律險倥′蠅励∴繧九⊇縺ｩ蛯ｾ蜷代′隕九∴縺ｦ縺阪∪縺吶・;
    }
    if (stats.traitsSorted && stats.traitsSorted.length) {
        const top = stats.traitsSorted.slice(0, 2).map((t) => t.label);
        if (top.length === 1) {
            return `譌･險倥°繧峨・縲・{top[0]}縲阪・蛯ｾ蜷代′遨阪∩荳翫′縺｣縺ｦ縺・∪縺吶Ａ;
        }
        return `譌･險倥°繧峨・縲・{top[0]}縲阪・{top[1]}縲阪・蛯ｾ蜷代′遨阪∩荳翫′縺｣縺ｦ縺・∪縺吶Ａ;
    }
    const parts = [];
    const topEmotion = stats.emotionsSorted[0];
    const topPattern = stats.patternsSorted[0];
    const topTopic = stats.topicsSorted[0];

    if (topEmotion) {
        const label = EMOTION_LABELS[topEmotion.key] || topEmotion.key;
        parts.push(`諢滓ュ縺ｯ縲・{label}縲阪′螟壹ａ`);
    }
    if (topPattern) {
        parts.push(`隱咲衍繝代ち繝ｼ繝ｳ縺ｯ縲・{topPattern.label}縲阪′逶ｮ遶九▽`);
    }
    if (topTopic) {
        parts.push(`縲・{topTopic.label}縲阪′繧医￥逋ｻ蝣ｴ縺吶ｋ`);
    }

    return parts.length
        ? `${parts.join('縲・)}蛯ｾ蜷代′縺ゅｊ縺ｾ縺吶Ａ
        : '蛻・梵邨先棡縺ｯ縺ゅｊ縺ｾ縺吶′縲∝だ蜷代′縺ｾ縺螳牙ｮ壹＠縺ｦ縺・∪縺帙ｓ縲・;
}

function getMbtiInsight(mbti) {
    if (!mbti) return 'MBTI繧定ｨｭ螳壹☆繧九→縺薙％縺ｫ陦ｨ遉ｺ縺輔ｌ縺ｾ縺吶・;
    return MBTI_TRAITS[mbti] || '縺薙・MBTI縺ｮ隱ｬ譏弱・譛ｪ逋ｻ骭ｲ縺ｧ縺吶・;
}

function buildHabitInsight(patternsList) {
    if (!patternsList || !patternsList.length) return '隧ｲ蠖薙↑縺・;
    const sorted = [...patternsList].sort((a, b) => (b.confidence_0_1 || 0) - (a.confidence_0_1 || 0));
    const labels = [];
    for (const p of sorted) {
        const entry = getPatternEntry(p);
        const id = entry ? entry.id : null;
        const rawLabel = typeof p === 'string' ? p : (p.label || p.pattern_id || '');
        const label = id && PERSONALITY_TRAIT_MAP[id]
            ? PERSONALITY_TRAIT_MAP[id]
            : (entry ? entry.label : rawLabel);
        if (label && !labels.includes(label)) labels.push(label);
        if (labels.length >= 2) break;
    }
    if (!labels.length) return '隧ｲ蠖薙↑縺・;
    if (labels.length === 1) {
        return `譌･險倥°繧峨・縲・{labels[0]}縲阪→縺・≧蛯ｾ蜷代′隕九ｉ繧後ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧翫∪縺吶Ａ;
    }
    return `譌･險倥°繧峨・縲・{labels[0]}縲阪・{labels[1]}縲阪→縺・≧蛯ｾ蜷代′隕九ｉ繧後ｋ蜿ｯ閭ｽ諤ｧ縺後≠繧翫∪縺吶Ａ;
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
        list = list.filter((entry) => {
            const analysis = appState.analysisById[entry.id];
            if (!analysis) return false;
            return extractTopics(entry).some((t) => String(t).toLowerCase().includes(q));
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
        dom.entryListContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-book-open"></i><p>縺ｾ縺譌･險倥′縺ゅｊ縺ｾ縺帙ｓ</p><button class="btn-primary" onclick="openEntry()">譛蛻昴・繧ｸ繝｣繝ｼ繝翫Ν</button></div>';
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
            ? '繝ｭ繝・け荳ｭ'
            : (analysis
                ? `諢滓ュ: ${topEmotion ? EMOTION_LABELS[topEmotion.key] : '荳肴・'}${topEmotion ? ` (${Math.round(topEmotion.intensity || 0)}轤ｹ)` : ''}`
                : '隗｣譫舌↑縺・);

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
    dom.monthlyGoalTitle.textContent = `${year}蟷ｴ${month}譛医・逶ｮ讓兪;
    if (!appState.user) {
        dom.monthlyGoalText.textContent = '繝ｭ繧ｰ繧､繝ｳ縺吶ｋ縺ｨ菫晏ｭ倥〒縺阪∪縺・;
    } else {
        dom.monthlyGoalText.textContent = text ? text : '譛ｪ險ｭ螳・;
    }
}

async function editMonthlyGoal() {
    if (!appState.user) {
        showToast('繝ｭ繧ｰ繧､繝ｳ縺励※縺上□縺輔＞', 'error');
        return;
    }
    const date = appState.calendarDate || new Date();
    const key = getMonthlyGoalKey(date);
    const goals = { ...(appState.userProfile?.monthlyGoals || {}) };
    const current = goals[key] || '';
    const input = window.prompt('莉頑怦縺ｮ逶ｮ讓吶ｒ蜈･蜉幢ｼ育ｩｺ谺・〒蜑企勁・・, current);
    if (input === null) return;
    const value = input.trim();
    if (value) {
        goals[key] = value;
    } else {
        delete goals[key];
    }
    await saveUserProfile({ monthlyGoals: goals });
    renderMonthlyGoal();
    showToast(value ? '逶ｮ讓吶ｒ菫晏ｭ倥＠縺ｾ縺励◆' : '逶ｮ讓吶ｒ蜑企勁縺励∪縺励◆');
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



