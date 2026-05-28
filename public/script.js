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

const THEME_PRESETS = [
    { id: 'nordic', label: '北欧カラー', colors: ['#254678', '#bbe3f5', '#da6a38'] },
    { id: 'westcoast', label: 'アメリカ西海岸', colors: ['#e8ebe7', '#c9be72', '#76a1b8'] },
    { id: 'parisienne', label: 'パリジェンヌ', colors: ['#aa998a', '#eadfca', '#9ec3bc'] },
    { id: 'harajuku', label: 'HARAJUKU', colors: ['#f5b8cc', '#2e69b3', '#4abcb9'] },
    { id: 'cool', label: 'クール', colors: ['#101841', '#70acce', '#144da0'] },
    { id: 'cafe', label: 'カフェ', colors: ['#a2997f', '#6e6457', '#cfdedf'] },
    { id: 'dark', label: 'ダーク', colors: ['#0f1115', '#1c2230', '#c98b56'] }
];

function normalizeThemeId(themeId) {
    if (!themeId) return 'cafe';
    return THEME_PRESETS.some((theme) => theme.id === themeId) ? themeId : 'cafe';
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
    summaryText: '',
    summaryPeriod: '',
    summaryUpdatedAt: null,
    summaryUpdating: false,
    aiInsightUpdating: false,
    themes: [],
    currentView: 'list',
    activeEntryId: null,
    writingDate: null,
    theme: normalizeThemeId(localStorage.getItem('theme')),
    calendarDate: new Date(),
    apiBase: localStorage.getItem('self_os_api_base') || '',
    filterByDate: null,
    masterPassword: localStorage.getItem('masterPassword') || '',
    userProfile: {},
    userProfileLoaded: false,
    monthlyGoalEditing: false,
    questions: [],
    answers: [],
    answersById: {},
    answerCountsByQuestionId: {},
    questionsViewMode: 'answer',
    personaSelectedLayer: '',
    personaPendingLayer: '',
    personaSessionBooting: false,
    personaSessionActive: false,
    personaSessionLayer: '',
    personaSessionQueue: [],
    personaSessionIndex: 0,
    personaPendingReset: false,
    personaQuickSaving: false,
    currentQuestionId: null,
    currentQuestionChoice: '',
    questionAdminTab: 'new',
    editingQuestionId: null,
    editingAnswerId: null,
    pendingEditAnswerId: null,
    deletingAnswerId: null,
    pendingAnswerPayload: null,
    detailAnswerId: null,
    confirmEditOpen: false,
    isEditing: false,
    draftText: '',
    settingsTab: 'account',
    settingsEditingName: false,
    settingsEditingAvatar: false,
    settingsFriendTab: 'friends',
    settingsFriendSearch: '',
    friendIdSearchQuery: '',
    friendIdSearchResult: null,
    friendIdSearchError: '',
    friendIdStatus: 'idle',
    friendIdError: '',
    friendRequestsLoaded: false,
    friendSchedulesByDate: {},
    friendState: null,
    language: localStorage.getItem('appLanguage') || 'ja',
    aiInsightTab: 'journal',
    readQuery: '',
    readCustomTab: 'keyword',
    readCustomConditions: [],
    readFilteredEntries: [],
    readIndex: 0,
    screeningProfile: null,
    screeningLoading: false,
    screeningError: '',
    layerDrafts: {},
    mypageRightTab: 'layer'
};

let journalLayoutResizeTimer = null;
const AGGREGATE_ANALYSIS_INTERVAL = 3;
let locationPickerMap = null;
let locationPickerMarker = null;
let locationPickerLatLng = null;
let locationSearchTimer = null;
let locationSearchRequestId = 0;
let activeLocationSlotIndex = 0;
let emotionPickerState = null;
let scheduleTimeTargetRow = null;
let scheduleTimeState = null;
let durationPickerTarget = null;
let durationPickerState = null;
let personaProgressRef = null;
let personaDraftSyncUnavailable = false;
const FIXED_GRID_CONFIG = {
    gap: 6,
    leftRatio: 0.38,
    rightRatio: 0.62,
    rightColRatios: [0.75, 1.35, 1.35],
    analysisRatio: 0.412,
    memoRatio: 0.2,
    diaryMin: 160
};
const FIXED_GRID_MIN_WIDTH = 1024;
const JOURNAL_LAYOUT_MODE = 'fixed-grid';
const SLEEP_OPTIONS = Array.from({ length: 27 }, (_, index) => 1 + index * 0.5).filter((v) => v <= 14);
const SATISFACTION_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, '0'));
const SCHEDULE_MINUTES = Array.from({ length: 12 }, (_, idx) => String(idx * 5).padStart(2, '0'));
const DURATION_HOURS = Array.from({ length: 13 }, (_, idx) => String(idx).padStart(2, '0'));
const SLEEP_HOURS = Array.from({ length: 15 }, (_, idx) => String(idx).padStart(2, '0'));
const SCROLL_PICKER_ITEM_HEIGHT = 40;
const SCROLL_PICKER_SCROLL_DELAY = 80;
const EMOTION_NONE_VALUE = '__none__';
const SCREENING_CATEGORY = 'screening';
const QUESTION_CATEGORY_NORMAL = 'normal';
const SCREENING_INSTRUMENT_ADHD = 'adhd_adult_v1';
const SCREENING_INSTRUMENT_PERSONA = 'persona_5layer_v1';
const SCREENING_OPTION_SCORES = [0, 1, 2, 3, 4];
const SCREENING_DEFAULT_OPTIONS = ['まったく当てはまらない', 'あまり当てはまらない', 'どちらでもない', 'やや当てはまる', '非常に当てはまる'];
const SCREENING_RISK_BANDS = [
    { key: 'low', max: 34, label: '低リスク' },
    { key: 'moderate', max: 64, label: '中リスク' },
    { key: 'high', max: 100, label: '高リスク' }
];
const PERSONALITY_TRAIT_KEYS = ['selfRegulation', 'stressSensitivity', 'socialDrive', 'noveltySeeking', 'consistency'];
const PERSONALITY_TRAIT_LABELS = {
    selfRegulation: '自己調整',
    stressSensitivity: 'ストレス感受性',
    socialDrive: '社会駆動性',
    noveltySeeking: '新規性追求',
    consistency: '一貫性'
};
const PERSONA_LAYER_ORDER = ['soc', 'cog', 'act', 'emo', 'mot'];
const PERSONA_LAYER_LABELS = {
    soc: '対人・社会',
    cog: '思考・判断',
    act: '実行・行動',
    emo: '情動・自己調整',
    mot: '動機・世界観'
};
const PERSONA_LAYER_DEFINITIONS = {
    soc: {
        code: 'SOC',
        label: '対人・社会',
        axes: [
            { code: 'SOC01', key: 'soc01', left: '距離', right: '親和' },
            { code: 'SOC02', key: 'soc02', left: '非開示', right: '自己開示' },
            { code: 'SOC03', key: 'soc03', left: '独立', right: '同調' },
            { code: 'SOC04', key: 'soc04', left: '追従', right: '主導' },
            { code: 'SOC05', key: 'soc05', left: '調和優先', right: '対立許容' },
            { code: 'SOC06', key: 'soc06', left: '受動交流', right: '能動交流' },
            { code: 'SOC07', key: 'soc07', left: '役割収束', right: '役割越境' },
            { code: 'SOC08', key: 'soc08', left: '承認低依存', right: '承認高依存' }
        ]
    },
    cog: {
        code: 'COG',
        label: '思考・判断',
        axes: [
            { code: 'COG01', key: 'cog01', left: '感情基準', right: '論理基準' },
            { code: 'COG02', key: 'cog02', left: '具体', right: '抽象' },
            { code: 'COG03', key: 'cog03', left: '局所', right: '全体' },
            { code: 'COG04', key: 'cog04', left: '収束', right: '探索' },
            { code: 'COG05', key: 'cog05', left: '検証', right: '直観' },
            { code: 'COG06', key: 'cog06', left: '精度重視', right: '速度重視' },
            { code: 'COG07', key: 'cog07', left: '過去参照', right: '未来投影' },
            { code: 'COG08', key: 'cog08', left: '外界基準', right: '内界基準' }
        ]
    },
    act: {
        code: 'ACT',
        label: '実行・行動',
        axes: [
            { code: 'ACT01', key: 'act01', left: '即興', right: '計画' },
            { code: 'ACT02', key: 'act02', left: '開始慎重', right: '開始容易' },
            { code: 'ACT03', key: 'act03', left: '瞬発', right: '持続' },
            { code: 'ACT04', key: 'act04', left: '直列', right: '並列' },
            { code: 'ACT05', key: 'act05', left: '探求志向', right: '完了志向' },
            { code: 'ACT06', key: 'act06', left: '環境依存', right: '意志駆動' },
            { code: 'ACT07', key: 'act07', left: '即時型', right: '蓄積型' },
            { code: 'ACT08', key: 'act08', left: '短期視点', right: '長期視点' }
        ]
    },
    emo: {
        code: 'EMO',
        label: '情動・自己調整',
        axes: [
            { code: 'EMO01', key: 'emo01', left: '抑制', right: '表出' },
            { code: 'EMO02', key: 'emo02', left: '鈍感受性', right: '快感受性' },
            { code: 'EMO03', key: 'emo03', left: '安定感受性', right: '不安感受性' },
            { code: 'EMO04', key: 'emo04', left: '回復遅', right: '回復速' },
            { code: 'EMO05', key: 'emo05', left: '安定維持', right: '刺激追求' },
            { code: 'EMO06', key: 'emo06', left: '自己受容', right: '自己批評' },
            { code: 'EMO07', key: 'emo07', left: '反芻', right: '切替' },
            { code: 'EMO08', key: 'emo08', left: '受容感', right: '統制感' },
            { code: 'EMO09', key: 'emo09', left: '被影響感', right: '主体感' },
            { code: 'EMO10', key: 'emo10', left: '境界弱', right: '境界強' }
        ]
    },
    mot: {
        code: 'MOT/WRL',
        label: '動機・世界観',
        axes: [
            { code: 'MOT01', key: 'mot01', left: '充足志向', right: '達成志向' },
            { code: 'MOT02', key: 'mot02', left: '安定欲求', right: '成長欲求' },
            { code: 'MOT03', key: 'mot03', left: '実利追求', right: '意味追求' },
            { code: 'MOT04', key: 'mot04', left: '過程志向', right: '目的志向' },
            { code: 'MOT05', key: 'mot05', left: '役割受容', right: '選択自由' },
            { code: 'MOT06', key: 'mot06', left: '自己保存', right: '自己超越' },
            { code: 'WRL01', key: 'wrl01', left: '偶然観', right: '必然観' },
            { code: 'WRL02', key: 'wrl02', left: '直線感覚', right: '循環感覚' },
            { code: 'WRL03', key: 'wrl03', left: '分離観', right: '一体観' },
            { code: 'WRL04', key: 'wrl04', left: '現在志向', right: '未来志向' }
        ]
    }
};
const PERSONA_DIAGNOSIS_VERSION_ID = 'v1.0';
const PERSONA_LAYER_DOC_IDS = {
    soc: 'SOC',
    cog: 'COG',
    act: 'ACT',
    emo: 'EMO',
    mot: 'MOT'
};
const PERSONA_MANAGED_DRAFT_LAYERS = new Set(['soc', 'cog', 'act', 'emo', 'mot']);
const PERSONA_BASELINE_OPTIONS = ['まったく当てはまらない', 'あまり当てはまらない', 'どちらでもない', 'やや当てはまる', '非常に当てはまる'];
const PERSONA_BASELINE_OPTION_SCORES = [1, 2, 3, 4, 5];
const PERSONA_SOC_QUESTION_BANK = [
    { id: 'SOCQ01', axisCode: 'SOC01', reverseScored: false, body: '人と会う頻度は自然と多くなるほうだ' },
    { id: 'SOCQ02', axisCode: 'SOC01', reverseScored: false, body: '初対面でも距離が縮まるのは早いほうだ' },
    { id: 'SOCQ03', axisCode: 'SOC01', reverseScored: true, body: '必要以上に人と関わるのは疲れる' },
    { id: 'SOCQ04', axisCode: 'SOC01', reverseScored: true, body: '連絡は最低限で十分だと感じる' },
    { id: 'SOCQ05', axisCode: 'SOC02', reverseScored: false, body: '自分の感情を比較的素直に言葉にする' },
    { id: 'SOCQ06', axisCode: 'SOC02', reverseScored: false, body: '個人的な話も信頼できる人には共有する' },
    { id: 'SOCQ07', axisCode: 'SOC02', reverseScored: true, body: '本音はあまり人に見せない' },
    { id: 'SOCQ08', axisCode: 'SOC02', reverseScored: true, body: '自分の弱みは基本的に隠しておきたい' },
    { id: 'SOCQ09', axisCode: 'SOC03', reverseScored: true, body: '周囲よりも自分の基準を優先することが多い' },
    { id: 'SOCQ10', axisCode: 'SOC03', reverseScored: false, body: '多数派の意見は参考にするほうだ' },
    { id: 'SOCQ11', axisCode: 'SOC03', reverseScored: false, body: '「普通はどうか」をよく考える' },
    { id: 'SOCQ12', axisCode: 'SOC03', reverseScored: true, body: '周りに合わせるのはあまり得意ではない' },
    { id: 'SOCQ13', axisCode: 'SOC04', reverseScored: false, body: '集まりでは自然と進行役になることが多い' },
    { id: 'SOCQ14', axisCode: 'SOC04', reverseScored: false, body: '意思決定では自分から提案することが多い' },
    { id: 'SOCQ15', axisCode: 'SOC04', reverseScored: true, body: '誰かが決めてくれる方が楽だと感じる' },
    { id: 'SOCQ16', axisCode: 'SOC04', reverseScored: true, body: '自分から場の流れを変えることは少ない' },
    { id: 'SOCQ17', axisCode: 'SOC05', reverseScored: false, body: '多少の衝突があっても本音を伝えたい' },
    { id: 'SOCQ18', axisCode: 'SOC05', reverseScored: false, body: '意見が違う場合ははっきり伝えるほうだ' },
    { id: 'SOCQ19', axisCode: 'SOC05', reverseScored: true, body: '空気が悪くなるなら黙っていたほうがいい' },
    { id: 'SOCQ20', axisCode: 'SOC05', reverseScored: true, body: '不満はなるべく表に出さない' },
    { id: 'SOCQ21', axisCode: 'SOC06', reverseScored: false, body: '自分から人を誘うことが多い' },
    { id: 'SOCQ22', axisCode: 'SOC06', reverseScored: false, body: '連絡は基本的に自分から取るほうだ' },
    { id: 'SOCQ23', axisCode: 'SOC06', reverseScored: true, body: '誘われるのを待つことが多い' },
    { id: 'SOCQ24', axisCode: 'SOC06', reverseScored: true, body: '人間関係は自然に任せたい' },
    { id: 'SOCQ25', axisCode: 'SOC07', reverseScored: false, body: '自分の担当外でも必要なら口を出す' },
    { id: 'SOCQ26', axisCode: 'SOC07', reverseScored: false, body: '頼まれていなくてもサポートに入ることがある' },
    { id: 'SOCQ27', axisCode: 'SOC07', reverseScored: true, body: '自分の役割以上のことは基本的にしない' },
    { id: 'SOCQ28', axisCode: 'SOC07', reverseScored: true, body: '境界を越えるのはあまり好まない' },
    { id: 'SOCQ29', axisCode: 'SOC08', reverseScored: false, body: '他人からの反応はやる気に影響する' },
    { id: 'SOCQ30', axisCode: 'SOC08', reverseScored: false, body: '評価されるとモチベーションが上がる' },
    { id: 'SOCQ31', axisCode: 'SOC08', reverseScored: true, body: '他人の評価はあまり気にしない' },
    { id: 'SOCQ32', axisCode: 'SOC08', reverseScored: true, body: '認められなくても気持ちは揺れない' }
];
const PERSONA_COG_QUESTION_BANK = [
    { id: 'COGQ01', axisCode: 'COG01', reverseScored: true, body: '判断するとき、まず「しっくりくるか」を大事にする' },
    { id: 'COGQ02', axisCode: 'COG01', reverseScored: false, body: '理由を説明するとき、感情より因果関係で話すことが多い' },
    { id: 'COGQ03', axisCode: 'COG01', reverseScored: false, body: '結論に納得できるかは、筋が通っているかで決まる' },
    { id: 'COGQ04', axisCode: 'COG01', reverseScored: true, body: '理屈が正しくても、気持ちが追いつかないと決められない' },
    { id: 'COGQ05', axisCode: 'COG02', reverseScored: true, body: '話を理解するとき、まず手順や事実を押さえる' },
    { id: 'COGQ06', axisCode: 'COG02', reverseScored: false, body: '具体例より「本質は何か」を考える方が得意だ' },
    { id: 'COGQ07', axisCode: 'COG02', reverseScored: false, body: '目の前の事実より、概念や意味づけから考えが広がる' },
    { id: 'COGQ08', axisCode: 'COG02', reverseScored: true, body: '抽象的な話より、具体的に何をするかが重要だと思う' },
    { id: 'COGQ09', axisCode: 'COG03', reverseScored: false, body: '細部を詰めるより、全体像を先に掴みたい' },
    { id: 'COGQ10', axisCode: 'COG03', reverseScored: true, body: '1つの論点を深掘りしてから次へ進むことが多い' },
    { id: 'COGQ11', axisCode: 'COG03', reverseScored: false, body: '「そもそも目的は何か」をよく確認する' },
    { id: 'COGQ12', axisCode: 'COG03', reverseScored: true, body: '俯瞰よりも、目の前の一部に集中しやすい' },
    { id: 'COGQ13', axisCode: 'COG04', reverseScored: true, body: '早めに結論を決めて前に進めたい' },
    { id: 'COGQ14', axisCode: 'COG04', reverseScored: false, body: '決める前に選択肢をできるだけ洗い出したい' },
    { id: 'COGQ15', axisCode: 'COG04', reverseScored: false, body: '可能性が残っていると、つい広げ続けてしまう' },
    { id: 'COGQ16', axisCode: 'COG04', reverseScored: true, body: '選択肢が多いと疲れるので、早く絞りたい' },
    { id: 'COGQ17', axisCode: 'COG05', reverseScored: true, body: '判断前に裏取りや確認をしたくなる' },
    { id: 'COGQ18', axisCode: 'COG05', reverseScored: false, body: '最初のひらめきで方向性を決めることが多い' },
    { id: 'COGQ19', axisCode: 'COG05', reverseScored: true, body: '根拠が薄いまま進めるのは不安だ' },
    { id: 'COGQ20', axisCode: 'COG05', reverseScored: false, body: 'データより直感が当たると感じることが多い' },
    { id: 'COGQ21', axisCode: 'COG06', reverseScored: false, body: '多少荒くても、まず形にしてから直したい' },
    { id: 'COGQ22', axisCode: 'COG06', reverseScored: true, body: '正確さを優先して、時間がかかっても納得できるまで詰めたい' },
    { id: 'COGQ23', axisCode: 'COG06', reverseScored: false, body: '完璧よりスピードが重要だと思う場面が多い' },
    { id: 'COGQ24', axisCode: 'COG06', reverseScored: true, body: 'ミスを避けるために慎重になりがちだ' },
    { id: 'COGQ25', axisCode: 'COG07', reverseScored: true, body: '決めるとき、過去の経験や前例を重視する' },
    { id: 'COGQ26', axisCode: 'COG07', reverseScored: false, body: '「こうなりたい未来」から逆算して決めることが多い' },
    { id: 'COGQ27', axisCode: 'COG07', reverseScored: true, body: '前にうまくいった方法をまず試す' },
    { id: 'COGQ28', axisCode: 'COG07', reverseScored: false, body: '前例がなくても、将来像が見えれば進められる' },
    { id: 'COGQ29', axisCode: 'COG08', reverseScored: true, body: '客観的な事実や数値が、判断の中心になりやすい' },
    { id: 'COGQ30', axisCode: 'COG08', reverseScored: false, body: '自分の感覚（違和感・納得感）を判断材料として強く使う' },
    { id: 'COGQ31', axisCode: 'COG08', reverseScored: false, body: '他人がどう見るかより、自分がどう感じるかが重要だ' },
    { id: 'COGQ32', axisCode: 'COG08', reverseScored: true, body: '自分の感覚より、外の根拠を優先することが多い' }
];
const PERSONA_ACT_QUESTION_BANK = [
    { id: 'ACTQ01', axisCode: 'ACT01', reverseScored: true, body: 'その場の流れで動くことが多い' },
    { id: 'ACTQ02', axisCode: 'ACT01', reverseScored: false, body: '行動前に段取りを考えることが多い' },
    { id: 'ACTQ03', axisCode: 'ACT01', reverseScored: true, body: '計画よりも状況に合わせて調整するほうだ' },
    { id: 'ACTQ04', axisCode: 'ACT01', reverseScored: false, body: '事前にスケジュールを決めてから動きたい' },
    { id: 'ACTQ05', axisCode: 'ACT02', reverseScored: true, body: '十分に準備が整うまで始められないことがある' },
    { id: 'ACTQ06', axisCode: 'ACT02', reverseScored: false, body: 'とりあえず手をつけてから考えるほうだ' },
    { id: 'ACTQ07', axisCode: 'ACT02', reverseScored: true, body: '不安があると着手が遅れることが多い' },
    { id: 'ACTQ08', axisCode: 'ACT02', reverseScored: false, body: '完璧でなくてもすぐ始められる' },
    { id: 'ACTQ09', axisCode: 'ACT03', reverseScored: true, body: '短時間で一気に集中することが多い' },
    { id: 'ACTQ10', axisCode: 'ACT03', reverseScored: false, body: '毎日コツコツ続けるほうが得意だ' },
    { id: 'ACTQ11', axisCode: 'ACT03', reverseScored: false, body: '長時間一定ペースで進めるのは得意だ' },
    { id: 'ACTQ12', axisCode: 'ACT03', reverseScored: true, body: '集中は波があり、短期型だと思う' },
    { id: 'ACTQ13', axisCode: 'ACT04', reverseScored: false, body: '複数の作業を同時に進めることが多い' },
    { id: 'ACTQ14', axisCode: 'ACT04', reverseScored: true, body: '1つ終えてから次へ進みたい' },
    { id: 'ACTQ15', axisCode: 'ACT04', reverseScored: false, body: 'タスクを同時並行で回すのが自然だ' },
    { id: 'ACTQ16', axisCode: 'ACT04', reverseScored: true, body: '同時進行は混乱しやすい' },
    { id: 'ACTQ17', axisCode: 'ACT05', reverseScored: true, body: '納得するまで掘り下げ続けたい' },
    { id: 'ACTQ18', axisCode: 'ACT05', reverseScored: false, body: 'ある程度で区切って終わらせたい' },
    { id: 'ACTQ19', axisCode: 'ACT05', reverseScored: true, body: '終わらせることより深めることが重要だ' },
    { id: 'ACTQ20', axisCode: 'ACT05', reverseScored: false, body: '完了チェックがつくと安心する' },
    { id: 'ACTQ21', axisCode: 'ACT06', reverseScored: true, body: '環境が整わないと動きづらい' },
    { id: 'ACTQ22', axisCode: 'ACT06', reverseScored: false, body: '状況が悪くてもやると決めたら続ける' },
    { id: 'ACTQ23', axisCode: 'ACT06', reverseScored: true, body: '周囲の雰囲気に行動が左右されやすい' },
    { id: 'ACTQ24', axisCode: 'ACT06', reverseScored: false, body: '外的条件に関係なく自分でペースを作れる' },
    { id: 'ACTQ25', axisCode: 'ACT07', reverseScored: true, body: '思い立ったらすぐ結果を出したい' },
    { id: 'ACTQ26', axisCode: 'ACT07', reverseScored: false, body: '少しずつ積み上げるプロセスが好きだ' },
    { id: 'ACTQ27', axisCode: 'ACT07', reverseScored: true, body: 'その場で完結させることが多い' },
    { id: 'ACTQ28', axisCode: 'ACT07', reverseScored: false, body: '習慣化して継続することが多い' },
    { id: 'ACTQ29', axisCode: 'ACT08', reverseScored: true, body: '目の前の成果を優先することが多い' },
    { id: 'ACTQ30', axisCode: 'ACT08', reverseScored: false, body: '長期的な計画を意識して動く' },
    { id: 'ACTQ31', axisCode: 'ACT08', reverseScored: false, body: '数ヶ月〜数年単位で物事を設計することがある' },
    { id: 'ACTQ32', axisCode: 'ACT08', reverseScored: true, body: '今の状況への即応を重視する' }
];
const PERSONA_EMO_QUESTION_BANK = [
    { id: 'EMOQ01', axisCode: 'EMO01', reverseScored: false, body: 'うれしい・つらいなどの感情は、表情や声に出やすい' },
    { id: 'EMOQ02', axisCode: 'EMO01', reverseScored: false, body: '人前でも感情を言葉で伝えられるほうだ' },
    { id: 'EMOQ03', axisCode: 'EMO01', reverseScored: true, body: '感情があっても、外には出さずにおくことが多い' },
    { id: 'EMOQ04', axisCode: 'EMO01', reverseScored: true, body: '気持ちは自分の中で処理してしまいがちだ' },
    { id: 'EMOQ05', axisCode: 'EMO02', reverseScored: false, body: '小さな楽しみ（音・香り・景色など）に気づきやすい' },
    { id: 'EMOQ06', axisCode: 'EMO02', reverseScored: false, body: 'いい出来事があると、気分の上がり幅が大きいほうだ' },
    { id: 'EMOQ07', axisCode: 'EMO02', reverseScored: true, body: 'うれしいことがあっても、気分はあまり動かないほうだ' },
    { id: 'EMOQ08', axisCode: 'EMO02', reverseScored: true, body: '「楽しい」と感じるまでに時間がかかることが多い' },
    { id: 'EMOQ09', axisCode: 'EMO03', reverseScored: false, body: '先に最悪のケースを想像して備えることが多い' },
    { id: 'EMOQ10', axisCode: 'EMO03', reverseScored: false, body: '小さなリスクや違和感でも、気になりやすい' },
    { id: 'EMOQ11', axisCode: 'EMO03', reverseScored: true, body: '多少の不確実さがあっても、あまり不安にならない' },
    { id: 'EMOQ12', axisCode: 'EMO03', reverseScored: true, body: '心配よりも「何とかなる」が先に出やすい' },
    { id: 'EMOQ13', axisCode: 'EMO04', reverseScored: false, body: '嫌な出来事があっても、気分は比較的早く戻る' },
    { id: 'EMOQ14', axisCode: 'EMO04', reverseScored: false, body: '落ち込んでも、次の日には切り替わっていることが多い' },
    { id: 'EMOQ15', axisCode: 'EMO04', reverseScored: true, body: '気分のダメージが翌日以降も残りやすい' },
    { id: 'EMOQ16', axisCode: 'EMO04', reverseScored: true, body: '一度乱れると、立て直しに時間がかかるほうだ' },
    { id: 'EMOQ17', axisCode: 'EMO05', reverseScored: false, body: '新しい刺激や変化があると元気が出やすい' },
    { id: 'EMOQ18', axisCode: 'EMO05', reverseScored: false, body: '予定が単調だと、物足りなさを感じやすい' },
    { id: 'EMOQ19', axisCode: 'EMO05', reverseScored: true, body: 'いつも通りの安定した日々が一番落ち着く' },
    { id: 'EMOQ20', axisCode: 'EMO05', reverseScored: true, body: '変化よりも「平常運転」を守りたい気持ちが強い' },
    { id: 'EMOQ21', axisCode: 'EMO06', reverseScored: true, body: '失敗しても「自分は自分」と受け止められるほうだ' },
    { id: 'EMOQ22', axisCode: 'EMO06', reverseScored: true, body: 'できない自分にも、一定の理解を向けられる' },
    { id: 'EMOQ23', axisCode: 'EMO06', reverseScored: false, body: '小さなミスでも、自分を強く責めがちだ' },
    { id: 'EMOQ24', axisCode: 'EMO06', reverseScored: false, body: 'もっとできたはずだ、と自分に厳しくなりやすい' },
    { id: 'EMOQ25', axisCode: 'EMO07', reverseScored: true, body: '気になることがあると、頭の中で何度も繰り返してしまう' },
    { id: 'EMOQ26', axisCode: 'EMO07', reverseScored: true, body: '終わったことを思い返して、考え続けることが多い' },
    { id: 'EMOQ27', axisCode: 'EMO07', reverseScored: false, body: '切り替えようと思えば、比較的すぐ別のことに移れる' },
    { id: 'EMOQ28', axisCode: 'EMO07', reverseScored: false, body: '気持ちの整理がついたら、引きずりにくい' },
    { id: 'EMOQ29', axisCode: 'EMO08', reverseScored: false, body: '状況を自分でコントロールしたい気持ちが強い' },
    { id: 'EMOQ30', axisCode: 'EMO08', reverseScored: false, body: '想定外が起きると、まず手綱を握り直したくなる' },
    { id: 'EMOQ31', axisCode: 'EMO08', reverseScored: true, body: '流れに任せたほうがうまくいくと思うことが多い' },
    { id: 'EMOQ32', axisCode: 'EMO08', reverseScored: true, body: '多少の不確実さは受け入れて進められる' },
    { id: 'EMOQ33', axisCode: 'EMO09', reverseScored: false, body: '「自分で選んだ」と感じられると気持ちが安定する' },
    { id: 'EMOQ34', axisCode: 'EMO09', reverseScored: false, body: '周囲の状況より、自分の意思で決めて動くほうだ' },
    { id: 'EMOQ35', axisCode: 'EMO09', reverseScored: true, body: '雰囲気や相手の反応で、自分の気分が左右されやすい' },
    { id: 'EMOQ36', axisCode: 'EMO09', reverseScored: true, body: '「仕方ない」と感じて動くことが多い' },
    { id: 'EMOQ37', axisCode: 'EMO10', reverseScored: true, body: '頼まれていないことでも、抱え込みすぎることがある' },
    { id: 'EMOQ38', axisCode: 'EMO10', reverseScored: true, body: '他人の問題まで自分の責任のように感じやすい' },
    { id: 'EMOQ39', axisCode: 'EMO10', reverseScored: false, body: 'ここから先は引き受けない、という線引きができる' },
    { id: 'EMOQ40', axisCode: 'EMO10', reverseScored: false, body: '相手の感情と自分の感情を分けて考えられる' }
];
const PERSONA_MOT_QUESTION_BANK = [
    { id: 'MOTQ01', axisCode: 'MOT01', reverseScored: false, body: '目標を達成したときに最も満たされる' },
    { id: 'MOTQ02', axisCode: 'MOT01', reverseScored: true, body: '成果よりも「今ここが満たされているか」が重要だ' },
    { id: 'MOTQ03', axisCode: 'MOT01', reverseScored: false, body: '数値や結果が出ないと満足しにくい' },
    { id: 'MOTQ04', axisCode: 'MOT01', reverseScored: true, body: '特別な達成がなくても日々に満足できる' },
    { id: 'MOTQ05', axisCode: 'MOT02', reverseScored: false, body: '新しい挑戦は多少不安でも取り組みたい' },
    { id: 'MOTQ06', axisCode: 'MOT02', reverseScored: true, body: '現状維持のほうが安心できる' },
    { id: 'MOTQ07', axisCode: 'MOT02', reverseScored: false, body: '自分を変える機会があると前向きになれる' },
    { id: 'MOTQ08', axisCode: 'MOT02', reverseScored: true, body: '変化よりも安定を優先したい' },
    { id: 'MOTQ09', axisCode: 'MOT03', reverseScored: true, body: '役に立つかどうかが最優先だ' },
    { id: 'MOTQ10', axisCode: 'MOT03', reverseScored: false, body: '意味や価値を感じられないと動きにくい' },
    { id: 'MOTQ11', axisCode: 'MOT03', reverseScored: false, body: '実用性よりも「なぜそれをするか」が重要だ' },
    { id: 'MOTQ12', axisCode: 'MOT03', reverseScored: true, body: '結果として得をするかをまず考える' },
    { id: 'MOTQ13', axisCode: 'MOT04', reverseScored: false, body: 'ゴールが明確でないと動きにくい' },
    { id: 'MOTQ14', axisCode: 'MOT04', reverseScored: true, body: '過程そのものを楽しめるほうだ' },
    { id: 'MOTQ15', axisCode: 'MOT04', reverseScored: true, body: '結果よりもプロセスに価値を感じる' },
    { id: 'MOTQ16', axisCode: 'MOT04', reverseScored: false, body: '目的達成が最も重要だ' },
    { id: 'MOTQ17', axisCode: 'MOT05', reverseScored: true, body: '与えられた役割は自然に受け入れられる' },
    { id: 'MOTQ18', axisCode: 'MOT05', reverseScored: false, body: '自分で選べないと納得しにくい' },
    { id: 'MOTQ19', axisCode: 'MOT05', reverseScored: true, body: '決められた枠組みの中で動くほうが楽だ' },
    { id: 'MOTQ20', axisCode: 'MOT05', reverseScored: false, body: '常に自分で選択している感覚がほしい' },
    { id: 'MOTQ21', axisCode: 'MOT06', reverseScored: true, body: 'リスクがあるなら基本的に避けたい' },
    { id: 'MOTQ22', axisCode: 'MOT06', reverseScored: false, body: '自分の限界を越える経験を求めることがある' },
    { id: 'MOTQ23', axisCode: 'MOT06', reverseScored: true, body: '安全を確保してから動きたい' },
    { id: 'MOTQ24', axisCode: 'MOT06', reverseScored: false, body: '多少の危険があっても挑戦する価値があると思う' },
    { id: 'MOTQ25', axisCode: 'WRL01', reverseScored: true, body: '人生は偶然の積み重ねだと思う' },
    { id: 'MOTQ26', axisCode: 'WRL01', reverseScored: false, body: '起こる出来事には何らかの意味があると感じる' },
    { id: 'MOTQ27', axisCode: 'WRL01', reverseScored: false, body: '物事は流れに導かれているように思えることがある' },
    { id: 'MOTQ28', axisCode: 'WRL01', reverseScored: true, body: '出来事に特別な意味を見出すことは少ない' },
    { id: 'MOTQ29', axisCode: 'WRL02', reverseScored: true, body: '人生は前へ進み続けるものだと感じる' },
    { id: 'MOTQ30', axisCode: 'WRL02', reverseScored: false, body: '物事は巡り巡って戻ってくると感じることがある' },
    { id: 'MOTQ31', axisCode: 'WRL02', reverseScored: false, body: '同じテーマが繰り返し現れると感じる' },
    { id: 'MOTQ32', axisCode: 'WRL02', reverseScored: true, body: '一度終わったことは基本的に戻らないと思う' },
    { id: 'MOTQ33', axisCode: 'WRL03', reverseScored: true, body: '自分と世界は基本的に別物だと感じる' },
    { id: 'MOTQ34', axisCode: 'WRL03', reverseScored: false, body: '自然や他者とつながっている感覚を持つことがある' },
    { id: 'MOTQ35', axisCode: 'WRL03', reverseScored: false, body: '物事は相互につながっていると思う' },
    { id: 'MOTQ36', axisCode: 'WRL03', reverseScored: true, body: '自分は独立した存在だという感覚が強い' },
    { id: 'MOTQ37', axisCode: 'WRL04', reverseScored: true, body: '将来よりも今この瞬間を大切にしたい' },
    { id: 'MOTQ38', axisCode: 'WRL04', reverseScored: false, body: '数年先を見据えて行動することが多い' },
    { id: 'MOTQ39', axisCode: 'WRL04', reverseScored: true, body: '今の満足を優先しがちだ' },
    { id: 'MOTQ40', axisCode: 'WRL04', reverseScored: false, body: '未来の展望があると行動に意味を感じる' }
];
const PERSONA_FIXED_LAYER_BANKS = {
    soc: PERSONA_SOC_QUESTION_BANK,
    cog: PERSONA_COG_QUESTION_BANK,
    act: PERSONA_ACT_QUESTION_BANK,
    emo: PERSONA_EMO_QUESTION_BANK,
    mot: PERSONA_MOT_QUESTION_BANK
};
const PERSONA_QUESTION_TEMPLATES = [
    { reverse: false, build: (axis) => `日常で「${axis.right}」を優先する場面が多い。` },
    { reverse: false, build: (axis) => `迷ったとき、私は「${axis.right}」寄りで判断しやすい。` },
    { reverse: true, build: (axis) => `自然体の自分は「${axis.left}」側に近い。` },
    { reverse: true, build: (axis) => `負荷が高い場面では「${axis.left}」を選びやすい。` }
];

function buildPersonaBaselineQuestions() {
    const questions = [];
    PERSONA_LAYER_ORDER.forEach((layerKey, layerIndex) => {
        const layerDef = PERSONA_LAYER_DEFINITIONS[layerKey];
        if (!layerDef || !Array.isArray(layerDef.axes)) return;
        const fixedBank = PERSONA_FIXED_LAYER_BANKS[layerKey];
        if (Array.isArray(fixedBank) && fixedBank.length) {
            fixedBank.forEach((seed, index) => {
                const axis = layerDef.axes.find((item) => item.code === seed.axisCode);
                if (!axis) return;
                questions.push({
                    id: seed.id,
                    layer: layerKey,
                    axisKey: axis.key,
                    reverseScored: seed.reverseScored === true,
                    order: (layerIndex + 1) * 1000 + index + 1,
                    body: seed.body
                });
            });
            return;
        }
        layerDef.axes.forEach((axisDef, axisIndex) => {
            PERSONA_QUESTION_TEMPLATES.forEach((template, questionIndex) => {
                const order = (layerIndex + 1) * 1000 + (axisIndex + 1) * 10 + (questionIndex + 1);
                questions.push({
                    id: `p5_${layerKey}_${axisDef.key}_${String(questionIndex + 1).padStart(2, '0')}`,
                    layer: layerKey,
                    axisKey: axisDef.key,
                    reverseScored: template.reverse === true,
                    order,
                    body: template.build(axisDef)
                });
            });
        });
    });
    return questions;
}

const PERSONA_BASELINE_QUESTIONS = buildPersonaBaselineQuestions();
const PERSONA_BASELINE_QUESTION_MAP = PERSONA_BASELINE_QUESTIONS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
}, {});

function rebuildPersonaBaselineQuestionMap() {
    Object.keys(PERSONA_BASELINE_QUESTION_MAP).forEach((key) => {
        delete PERSONA_BASELINE_QUESTION_MAP[key];
    });
    PERSONA_BASELINE_QUESTIONS.forEach((item) => {
        PERSONA_BASELINE_QUESTION_MAP[item.id] = item;
    });
}

const PERSONA_AXIS_LABEL_HINTS = Object.freeze({
    '距離': '人との間合いを保ちながら、必要な関係だけを選んで関わる傾向です。',
    '親和': '人と打ち解けやすく、関係の温度を上げることで力を発揮しやすい傾向です。',
    '非開示': '内面情報を慎重に扱い、安心できるまで開示を控える傾向です。',
    '自己開示': '気持ちや考えを言葉で共有し、関係の透明性を作る傾向です。',
    '独立': '周囲より自分基準で判断し、意思を単独で保ちやすい傾向です。',
    '同調': '場の流れや周囲の意図を読み、調和的に合わせる傾向です。',
    '追従': '既存の方針や決定に沿って、実行面で安定を出す傾向です。',
    '主導': '意思決定や段取りの起点になり、場を前に進める傾向です。',
    '調和優先': '摩擦を抑え、関係維持を優先して言い方を調整する傾向です。',
    '対立許容': '必要な場面では意見衝突を受け入れ、本音を伝える傾向です。',
    '受動交流': '誘われる流れで関係を深めることが多い傾向です。',
    '能動交流': '自分から声をかけ、関係を作りにいく傾向です。',
    '役割収束': '担当範囲を守って責務を果たし、境界を明確にする傾向です。',
    '役割越境': '必要があれば担当外にも踏み込み、支援範囲を広げる傾向です。',
    '承認低依存': '外部評価に左右されにくく、自分基準で安定しやすい傾向です。',
    '承認高依存': '反応や評価を強く動機に変え、対外成果で燃えやすい傾向です。',
    '感情基準': '体感的な納得感を重視して意思決定する傾向です。',
    '論理基準': '整合性や因果関係を優先して意思決定する傾向です。',
    '具体': '事実や手順を起点に考え、再現性を重視する傾向です。',
    '抽象': '概念や意味を起点に考え、全体の解像度を上げる傾向です。',
    '局所': '一点深掘りで質を高め、細部を詰める傾向です。',
    '全体': '俯瞰で構造を捉え、目的との整合で調整する傾向です。',
    '収束': '選択肢を絞って結論を固め、前進速度を優先する傾向です。',
    '探索': '可能性を広げながら最適解を探し続ける傾向です。',
    '検証': '裏取りや根拠確認で確度を高める傾向です。',
    '直観': 'ひらめきや初期感覚を起点に方向を決める傾向です。',
    '精度重視': '正確性を優先してミスを減らす傾向です。',
    '速度重視': 'まず動いて改善し、スピードで成果を作る傾向です。',
    '過去参照': '経験や前例を軸にして判断する傾向です。',
    '未来投影': '将来像から逆算して判断する傾向です。',
    '外界基準': '客観データや外部事実を基準に判断する傾向です。',
    '内界基準': '内面の納得感や違和感を基準に判断する傾向です。',
    '即興': '状況変化に合わせて柔軟に動く傾向です。',
    '計画': '事前設計で進行を安定させる傾向です。',
    '開始慎重': '着手条件を整えてから始める傾向です。',
    '開始容易': '準備途中でも着手して前進させる傾向です。',
    '瞬発': '短時間高出力で成果を出す傾向です。',
    '持続': '一定ペースで継続し、長期で成果を積む傾向です。',
    '直列': '一つずつ順に処理して質を安定させる傾向です。',
    '並列': '同時進行で複数タスクを回す傾向です。',
    '探求志向': '納得まで掘り下げて理解を深める傾向です。',
    '完了志向': '区切りと完了を重視して進捗を作る傾向です。',
    '環境依存': '環境条件に行動が影響されやすい傾向です。',
    '意志駆動': '環境に左右されにくく意志で継続する傾向です。',
    '即時型': 'その場完結で結果を出す傾向です。',
    '蓄積型': '積み上げで再現性ある成果を作る傾向です。',
    '短期視点': '目の前の課題解決を優先して動く傾向です。',
    '長期視点': '中長期の布石を意識して動く傾向です。',
    '抑制': '感情を内側で処理し、外に出し過ぎない傾向です。',
    '表出': '感情を外に出して共有し、周囲と同期する傾向です。',
    '鈍感受性': '快刺激への反応が穏やかで、気分変動が小さい傾向です。',
    '快感受性': '小さな喜びにも反応しやすく、報酬感度が高い傾向です。',
    '安定感受性': '不安刺激に過剰反応しにくく、落ち着きを保ちやすい傾向です。',
    '不安感受性': 'リスクや違和感を早く検知し、備えを重視する傾向です。',
    '回復遅': '心理的ダメージの残留が長く、回復に時間がかかる傾向です。',
    '回復速': '気分回復が比較的早く、再起動しやすい傾向です。',
    '安定維持': '刺激より安定を選び、平常状態を維持しやすい傾向です。',
    '刺激追求': '変化や新規刺激からエネルギーを得やすい傾向です。',
    '自己受容': '失敗時も自分を受け止め、自己評価を保ちやすい傾向です。',
    '自己批評': '課題を厳しく捉え、改善圧を高く維持する傾向です。',
    '反芻': '出来事を繰り返し考え、整理に時間を使う傾向です。',
    '切替': '思考の焦点を切り替え、次行動へ移しやすい傾向です。',
    '受容感': '流れを受け入れ、不確実性と共存しやすい傾向です。',
    '統制感': '状況を制御して主導権を保つ傾向です。',
    '被影響感': '周囲の反応や雰囲気の影響を受けやすい傾向です。',
    '主体感': '自分で選んで動く感覚を保ちやすい傾向です。',
    '境界弱': '他者課題を抱え込みやすく、線引きが曖昧になりやすい傾向です。',
    '境界強': '自他の境界を明確にし、責任範囲を管理しやすい傾向です。',
    '充足志向': '現時点の満足や充実感を重視する傾向です。',
    '達成志向': '目標達成と成果指標を重視する傾向です。',
    '安定欲求': '変化より安定確保を優先する傾向です。',
    '成長欲求': '未知への挑戦や自己更新を重視する傾向です。',
    '実利追求': '実用性と利益の明確さを重視する傾向です。',
    '意味追求': '行動の意味や価値納得を重視する傾向です。',
    '過程志向': '成果よりプロセスの質に価値を置く傾向です。',
    '目的志向': 'ゴール達成の明確性を優先する傾向です。',
    '役割受容': '与えられた役割に沿って安定運用しやすい傾向です。',
    '選択自由': '自分で選ぶ裁量を強く求める傾向です。',
    '自己保存': '安全確保と損失回避を優先する傾向です。',
    '自己超越': '限界突破や自己拡張を志向する傾向です。',
    '偶然観': '出来事を偶発として捉え、流動的に解釈する傾向です。',
    '必然観': '出来事に意味や必然を見出して統合する傾向です。',
    '直線感覚': '時間を前進軸で捉え、段階的に進む傾向です。',
    '循環感覚': '周期や再来を前提に捉える傾向です。',
    '分離観': '自他や対象の独立性を重視して捉える傾向です。',
    '一体観': '相互接続性や関係性を重視して捉える傾向です。',
    '現在志向': '今この瞬間の実感を重視する傾向です。',
    '未来志向': '将来展望と長期方向性を重視する傾向です。'
});

function buildPersonaAxisMeaning(leftLabel, rightLabel, dominantLabel = '', dominantPercent = 0) {
    const left = String(leftLabel || '左側').trim() || '左側';
    const right = String(rightLabel || '右側').trim() || '右側';
    const dominant = String(dominantLabel || '').trim() || (Number(dominantPercent) >= 50 ? right : left);
    const opposite = dominant === right ? left : right;
    const pct = Math.max(0, Math.min(100, Math.round(Number(dominantPercent) || 0)));
    const dominantHint = PERSONA_AXIS_LABEL_HINTS[dominant] || `「${dominant}」を優先して行動しやすい傾向です。`;
    const oppositeHint = PERSONA_AXIS_LABEL_HINTS[opposite] || `反対側の「${opposite}」を使うと状況対応の幅が広がります。`;
    return `この軸は「${left} ⇄ ${right}」の連続指標です。現在は「${dominant}」寄り（${pct}%）。${dominantHint} 反対側では、${oppositeHint}`;
}

function applyLayerQuestionsToBaseline(layerKey, rawQuestions) {
    const layer = normalizePersonaLayer(layerKey || '');
    if (!layer || !Array.isArray(rawQuestions) || !rawQuestions.length) return;
    const layerDef = PERSONA_LAYER_DEFINITIONS[layer];
    const axisMap = new Map((layerDef?.axes || []).map((axis) => [String(axis.code || '').toUpperCase(), axis]));
    const normalized = rawQuestions.map((item, index) => {
        const axis = axisMap.get(String(item.axisId || item.axisCode || '').toUpperCase());
        if (!axis) return null;
        const id = String(item.id || '').trim();
        const body = String(item.text || item.body || '').trim();
        if (!id || !body) return null;
        return {
            id,
            layer,
            axisKey: axis.key,
            reverseScored: item.reverse === true || item.reverseScored === true,
            order: (PERSONA_LAYER_ORDER.indexOf(layer) + 1) * 1000 + index + 1,
            body
        };
    }).filter(Boolean);
    if (!normalized.length) return;

    const next = PERSONA_BASELINE_QUESTIONS.filter((question) => question.layer !== layer);
    next.push(...normalized);
    next.sort(compareQuestionOrder);

    PERSONA_BASELINE_QUESTIONS.length = 0;
    PERSONA_BASELINE_QUESTIONS.push(...next);
    rebuildPersonaBaselineQuestionMap();
}

const ADMIN_EMAILS = ['qutech314@gmail.com'];



// --- DOM References ---
const getEl = (id) => document.getElementById(id);
const dom = {
    body: document.body,
    viewList: getEl('view-list'),
    viewEditor: getEl('view-editor'),
    viewCalendar: getEl('view-calendar'),
    viewQuestions: getEl('view-questions'),
    entryListContainer: getEl('entry-list-container'),
    entryCarousel: getEl('entry-carousel'),
    entryCarouselTrack: getEl('entry-carousel-track'),
    readCard: getEl('read-card'),
    readPrev: getEl('read-prev'),
    readNext: getEl('read-next'),
    readSearchInput: getEl('read-search-input'),
    readSearchBtn: getEl('read-search-btn'),
    btnReadCustom: getEl('btn-read-custom'),
    modalReadCustom: getEl('modal-read-custom'),
    readCustomTitle: getEl('read-custom-title'),
    readCustomInput: getEl('read-custom-input'),
    readCustomConditions: getEl('read-custom-conditions'),
    btnReadCustomSearch: getEl('btn-read-custom-search'),
    btnReadCustomClear: getEl('btn-read-custom-clear'),
    btnReadCustomClose: getEl('btn-read-custom-close'),
    modalReadDetail: getEl('modal-read-detail'),
    readDetailLeft: getEl('read-detail-left'),
    readDetailRight: getEl('read-detail-right'),
    btnReadDetailClose: getEl('btn-read-detail-close'),
    modalReadPhoto: getEl('modal-read-photo'),
    readPhotoImage: getEl('read-photo-image'),
    btnReadPhotoClose: getEl('btn-read-photo-close'),
    toastContainer: getEl('toast-container'),

    btnViewList: getEl('btn-view-list'),
    btnViewCalendar: getEl('btn-view-calendar'),
    btnNewEntry: getEl('btn-new-entry'),
    btnViewQuestions: getEl('btn-questions'),
    btnThemeToggle: getEl('btn-theme-toggle'),
    themePicker: getEl('theme-picker'),

    modalSettings: getEl('modal-settings'),
    inputApiBase: getEl('input-api-base'),
    inputCurrentPass: getEl('input-current-pass'),
    inputNewPass: getEl('input-new-pass'),
    btnUpdatePass: getEl('btn-update-pass'),
    btnForgotPassSettings: getEl('btn-forgot-pass-settings'),
    btnCloseSettings: getEl('btn-close-settings'),
    modalAppPassword: getEl('modal-app-password'),
    inputAppPassword: getEl('app-password-new'),
    inputAppPasswordConfirm: getEl('app-password-confirm'),
    btnAppPasswordSave: getEl('btn-app-pass-save'),
    btnAppPasswordCancel: getEl('btn-app-pass-cancel'),
    btnAppPasswordClose: getEl('btn-app-pass-close'),
    btnAppPasswordRemove: getEl('btn-app-pass-remove'),
    modalFriendId: getEl('modal-friend-id'),
    btnFriendIdClose: getEl('btn-friend-id-close'),
    inputFriendId: getEl('input-friend-id'),
    btnFriendIdSearch: getEl('btn-friend-id-search'),
    friendIdResult: getEl('friend-id-result'),
    btnFriendRequest: getEl('btn-friend-request'),

    inputContent: getEl('entry-content'),
    contentDisplayText: getEl('entry-content-display-text'),
    journalSections: getEl('journal-sections'),
    inputHighlight: getEl('entry-highlight'),
    inputEmotionPrimary: getEl('entry-emotion-primary'),
    inputEmotionSecondary: getEl('entry-emotion-secondary'),
    inputSatisfaction: getEl('entry-satisfaction'),
    satisfactionValue: getEl('entry-satisfaction-value'),
    btnSatisfaction: getEl('entry-satisfaction-btn'),
    modalSatisfaction: getEl('modal-satisfaction'),
    satisfactionOptions: getEl('satisfaction-options'),
    btnSatisfactionClose: getEl('btn-satisfaction-close'),
    inputLocation: getEl('entry-location'),
    inputLocationSearch: getEl('entry-location-search'),
    locationSuggestions: getEl('entry-location-suggestions'),
    inputLocationSearchModal: getEl('location-search-modal'),
    locationSuggestionsModal: getEl('location-modal-suggestions'),
    modalLocation: getEl('modal-location'),
    locationMap: getEl('location-map'),
    btnLocationConfirm: getEl('btn-location-confirm'),
    btnLocationCancel: getEl('btn-location-cancel'),
    btnLocationClose: getEl('btn-location-close'),
    locationPreview: getEl('entry-location-preview'),
    locationLabel: getEl('entry-location-label'),
    locationSummary: getEl('entry-location-summary'),
    inputBrowsing: getEl('entry-browsing'),
    inputMemo: getEl('entry-memo'),
    inputSchedule: getEl('entry-schedule'),
    inputDone: getEl('entry-done'),
    inputNotDone: getEl('entry-not-done'),
    inputNextPlan: getEl('entry-next-plan'),
    inputMealBreakfast: getEl('entry-meal-breakfast'),
    inputMealLunch: getEl('entry-meal-lunch'),
    inputMealDinner: getEl('entry-meal-dinner'),
    inputWeight: getEl('entry-weight'),
    inputSleep: getEl('entry-sleep'),
    btnSleep: getEl('entry-sleep-btn'),
    sleepValue: getEl('entry-sleep-value'),
    modalSleep: getEl('modal-sleep'),
    sleepOptions: getEl('sleep-options'),
    btnSleepClose: getEl('btn-sleep-close'),
    btnWeight: getEl('entry-weight-btn'),
    weightValue: getEl('entry-weight-value'),
    modalWeight: getEl('modal-weight'),
    inputWeightModal: getEl('weight-input'),
    btnWeightConfirm: getEl('btn-weight-confirm'),
    btnWeightCancel: getEl('btn-weight-cancel'),
    btnWeightClose: getEl('btn-weight-close'),
    inputFocus: getEl('entry-focus'),
    btnFocus: getEl('entry-focus-btn'),
    focusValue: getEl('entry-focus-value'),
    inputWorkout: getEl('entry-workout'),
    btnWorkout: getEl('entry-workout-btn'),
    workoutValue: getEl('entry-workout-value'),
    summaryLocation: getEl('entry-summary-location'),
    summaryDate: getEl('entry-summary-date'),
    summaryEmotionValue: getEl('entry-emotion-summary'),
    btnSummaryEmotion: getEl('btn-summary-emotion'),
    modalDuration: getEl('modal-duration'),
    durationModalTitle: getEl('duration-modal-title'),
    durationTimeHour: getEl('duration-time-hour'),
    durationTimeMinute: getEl('duration-time-minute'),
    btnDurationConfirm: getEl('btn-duration-confirm'),
    btnDurationCancel: getEl('btn-duration-cancel'),
    btnDurationClose: getEl('btn-duration-close'),
    modalEmotion: getEl('modal-emotion'),
    emotionModalTitle: getEl('emotion-modal-title'),
    emotionPrimaryList: getEl('emotion-primary-list'),
    emotionSecondaryList: getEl('emotion-secondary-list'),
    btnEmotionConfirm: getEl('btn-emotion-confirm'),
    btnEmotionCancel: getEl('btn-emotion-cancel'),
    btnEmotionClose: getEl('btn-emotion-close'),
    modalScheduleTime: getEl('modal-schedule-time'),
    scheduleTimeStartHour: getEl('schedule-time-start-hour'),
    scheduleTimeStartMinute: getEl('schedule-time-start-minute'),
    scheduleTimeEndHour: getEl('schedule-time-end-hour'),
    scheduleTimeEndMinute: getEl('schedule-time-end-minute'),
    btnScheduleAllDay: getEl('btn-schedule-all-day'),
    btnScheduleTimeConfirm: getEl('btn-schedule-time-confirm'),
    btnScheduleTimeCancel: getEl('btn-schedule-time-cancel'),
    btnScheduleTimeClose: getEl('btn-schedule-time-close'),
    displayDone: getEl('entry-done-display'),
    displayNotDone: getEl('entry-not-done-display'),
    displayNextPlan: getEl('entry-next-plan-display'),
    displayHighlight: getEl('entry-highlight-display'),
    displayEmotion: getEl('entry-emotion-display'),
    displaySatisfaction: getEl('entry-satisfaction-display'),
    displayLocation: getEl('entry-location-display'),
    displayBrowsing: getEl('entry-browsing-display'),
    displayMemo: getEl('entry-memo-display'),
    displaySchedule: getEl('entry-schedule-display'),
    displayMeals: getEl('entry-meals-display'),
    displayWeight: getEl('entry-weight-display'),
    displaySleep: getEl('entry-sleep-display'),
    displayFocus: getEl('entry-focus-display'),
    displayWorkout: getEl('entry-workout-display'),
    displayDate: getEl('entry-date-display'),
    displayScore: getEl('entry-score-display'),
    editorTitleLabel: getEl('editor-title-label'),
    editorComplete: getEl('editor-complete'),
    editorAdviceText: getEl('editor-advice-text'),
    btnViewToday: getEl('btn-view-today'),
    btnViewQuestionsComplete: getEl('btn-view-questions-complete'),

    selectLockStatus: getEl('select-lock-status'),
    btnSave: getEl('btn-save'),
    btnAddEntry: getEl('btn-add'),
    btnResetLayout: getEl('btn-reset-layout'),
    btnDeleteEntry: getEl('btn-delete-entry'),
    btnEditEntry: getEl('btn-edit-entry'),
    btnCancel: getEl('btn-cancel'),

    lockOverlay: getEl('lock-overlay'),
    inputUnlockPass: getEl('input-unlock-pass'),
    btnUnlockEntry: getEl('btn-unlock-entry'),
    btnForgotPass: getEl('btn-forgot-pass'),

    entryImageInput: getEl('entry-image-input'),
    btnUploadImage: getEl('btn-upload-image'),
    photoSection: getEl('photo-section'),
    imagePreviewContainer: getEl('image-preview-container'),
    imagePreview: getEl('image-preview'),
    analysisPanel: getEl('analysis-panel'),

    modalDelete: getEl('modal-delete-confirm'),
    btnCancelDelete: getEl('btn-cancel-delete'),
    btnConfirmDelete: getEl('btn-confirm-delete'),

    modalReset: getEl('modal-reset-input'),
    inputResetNewPass: getEl('input-reset-new-pass'),
    btnCancelReset: getEl('btn-cancel-reset'),
    btnSaveReset: getEl('btn-save-reset'),
    modalPhoto: getEl('modal-photo'),
    photoModalImage: getEl('photo-modal-image'),
    btnPhotoClose: getEl('btn-photo-close'),
    btnPhotoChange: getEl('btn-photo-change'),
    btnPhotoDelete: getEl('btn-photo-delete'),

    calendarMonthYear: getEl('calendar-month-year'),
    calendarTitleBtn: getEl('btn-calendar-picker'),
    calendarPickerModal: getEl('calendar-picker-modal'),
    calendarPickerClose: getEl('btn-calendar-picker-close'),
    calendarPickerDone: getEl('btn-calendar-picker-done'),
    calendarContainer: getEl('calendar-container'),
    calendarDaysGrid: getEl('calendar-days-grid'),
    btnCalendarToday: getEl('btn-calendar-today'),
    btnCalendarAddSchedule: getEl('btn-calendar-add-schedule'),
    calendarScheduleList: getEl('calendar-own-schedule'),
    calendarFriendList: getEl('calendar-friend-schedule'),
    calendarFriendEmpty: getEl('calendar-friend-empty'),
    modalScheduleShare: getEl('modal-schedule-share'),
    shareModalClose: getEl('btn-share-modal-close'),
    shareModalTime: getEl('share-modal-time'),
    shareModalTitle: getEl('share-modal-title'),
    shareListShared: getEl('share-list-shared'),
    shareListUnshared: getEl('share-list-unshared'),
    btnShareSave: getEl('btn-share-save'),
    btnPrevMonth: getEl('btn-prev-month'),
    btnNextMonth: getEl('btn-next-month'),
    selectCalendarYear: getEl('select-calendar-year'),
    selectCalendarMonth: getEl('select-calendar-month'),
    monthlyGoalTitle: getEl('monthly-goal-title'),
    monthlyGoalText: getEl('monthly-goal-text'),
    btnEditMonthlyGoal: getEl('btn-edit-monthly-goal'),
    monthlyGoalJourney: getEl('monthly-goal-journey'),
    monthlyGoalDot: getEl('monthly-goal-dot'),
    calendarSideDate: getEl('calendar-side-date'),
    calendarSideText: getEl('calendar-side-text'),
    searchInput: getEl('search-input'),
    filterDateFrom: getEl('filter-date-from'),
    filterDateTo: getEl('filter-date-to'),
    filterEmotion: getEl('filter-emotion'),
    filterPattern: getEl('filter-pattern'),
    filterTrigger: getEl('filter-trigger'),
    btnApplyFilters: getEl('btn-apply-filters'),
    btnResetFilters: getEl('btn-reset-filters'),
    settingsContainer: getEl('settings-container'),

    // MyPage
    btnMyPage: getEl('btn-mypage'),
    viewMyPage: getEl('view-mypage'),
    mypageContainer: getEl('mypage-container'),
    btnQuestionsModePersona: getEl('btn-questions-mode-persona'),
    btnQuestionsModeAnswer: getEl('btn-questions-mode-answer'),
    btnQuestionsModeHistory: getEl('btn-questions-mode-history'),
    questionsStageAnswer: getEl('questions-stage-answer'),
    questionsStageHistory: getEl('questions-stage-history'),
    answersList: getEl('answers-list'),
    currentQuestionTitle: getEl('current-question-title'),
    currentQuestionMeta: getEl('current-question-meta'),
    currentQuestionBody: getEl('current-question-body'),
    currentQuestionEmpty: getEl('current-question-empty'),
    personaLayerSelector: getEl('persona-layer-selector'),
    questionChoiceArea: getEl('question-choice-area'),
    personaInlineQuestion: getEl('persona-inline-question'),
    personaInlineQuestionMeta: getEl('persona-inline-question-meta'),
    personaInlineQuestionBody: getEl('persona-inline-question-body'),
    personaQuestionProgressInline: getEl('persona-question-progress-inline'),
    personaQuestionProgressText: getEl('persona-question-progress-text'),
    personaQuestionProgressFill: getEl('persona-question-progress-fill'),
    answerContext: getEl('answer-context'),
    answerBody: getEl('answer-body'),
    btnPersonaPrevQuestion: getEl('btn-persona-prev-question'),
    btnPersonaCloseSession: getEl('btn-persona-close-session'),
    btnSaveAnswer: getEl('btn-save-answer'),
    answerLoginNote: getEl('answer-login-note'),
    btnQuestionRefresh: getEl('btn-question-refresh'),
    btnQuestionAdmin: getEl('btn-question-admin'),
    modalAnswerDetail: getEl('modal-answer-detail'),
    btnAnswerDetailClose: getEl('btn-answer-detail-close'),
    answerDetailStatus: getEl('answer-detail-status'),
    answerDetailDate: getEl('answer-detail-date'),
    answerDetailTitle: getEl('answer-detail-title'),
    answerDetailQuestion: getEl('answer-detail-question'),
    answerDetailBody: getEl('answer-detail-body'),
    answerDetailEdit: getEl('answer-detail-edit'),
    answerDetailTextarea: getEl('answer-detail-textarea'),
    answerDetailActions: getEl('answer-detail-actions'),
    answerDetailEditActions: getEl('answer-detail-edit-actions'),
    btnAnswerDetailEdit: getEl('btn-answer-detail-edit'),
    btnAnswerDetailDelete: getEl('btn-answer-detail-delete'),
    btnAnswerDetailSave: getEl('btn-answer-detail-save'),
    btnAnswerDetailCancel: getEl('btn-answer-detail-cancel'),
    modalQuestionAdmin: getEl('modal-question-admin'),
    btnQuestionAdminClose: getEl('btn-question-admin-close'),
    btnQuestionCreateSave: getEl('btn-question-create-save'),
    adminTabNew: getEl('admin-tab-new'),
    adminTabManage: getEl('admin-tab-manage'),
    adminTabDeleted: getEl('admin-tab-deleted'),
    adminPanelNew: getEl('admin-panel-new'),
    adminPanelManage: getEl('admin-panel-manage'),
    adminPanelDeleted: getEl('admin-panel-deleted'),
    questionManageGrid: getEl('question-manage-grid'),
    questionManageDeletedGrid: getEl('question-manage-deleted-grid'),
    questionTitleInput: getEl('question-title-input'),
    questionCategoryInput: getEl('question-category-input'),
    questionTypeInput: getEl('question-type-input'),
    questionScreeningFields: getEl('question-screening-fields'),
    questionInstrumentInput: getEl('question-instrument-input'),
    questionDimensionInput: getEl('question-dimension-input'),
    questionOrderInput: getEl('question-order-input'),
    questionCoreInput: getEl('question-core-input'),
    questionBodyInput: getEl('question-body-input'),
    questionOptionsGroup: getEl('question-options-group'),
    questionOptionsInput: getEl('question-options-input'),
    questionPublishedInput: getEl('question-published-input'),
    modalQuestionEdit: getEl('modal-question-edit'),
    btnQuestionEditClose: getEl('btn-question-edit-close'),
    questionEditTitle: getEl('question-edit-title'),
    questionEditCategory: getEl('question-edit-category'),
    questionEditType: getEl('question-edit-type'),
    questionEditScreeningFields: getEl('question-edit-screening-fields'),
    questionEditInstrument: getEl('question-edit-instrument'),
    questionEditDimension: getEl('question-edit-dimension'),
    questionEditOrder: getEl('question-edit-order'),
    questionEditCore: getEl('question-edit-core'),
    questionEditBody: getEl('question-edit-body'),
    questionEditOptionsGroup: getEl('question-edit-options-group'),
    questionEditOptions: getEl('question-edit-options'),
    questionEditPublished: getEl('question-edit-published'),
    btnQuestionEditSave: getEl('btn-question-edit-save'),
    btnQuestionDelete: getEl('btn-question-delete'),
    modalAnswerConfirm: getEl('modal-answer-confirm'),
    btnAnswerConfirmClose: getEl('btn-answer-confirm-close'),
    btnAnswerConfirmCancel: getEl('btn-answer-confirm-cancel'),
    btnAnswerConfirmSend: getEl('btn-answer-confirm-send'),
    answerConfirmQuestion: getEl('answer-confirm-question'),
    answerConfirmText: getEl('answer-confirm-text'),
    modalAnswerEditConfirm: getEl('modal-answer-edit-confirm'),
    btnAnswerEditConfirmClose: getEl('btn-answer-edit-confirm-close'),
    btnAnswerEditConfirmCancel: getEl('btn-answer-edit-confirm-cancel'),
    btnAnswerEditConfirmApprove: getEl('btn-answer-edit-confirm-approve'),
    modalAnswerEdit: getEl('modal-answer-edit'),
    btnAnswerEditClose: getEl('btn-answer-edit-close'),
    btnAnswerEditSave: getEl('btn-answer-edit-save'),
    answerEditQuestion: getEl('answer-edit-question'),
    answerEditText: getEl('answer-edit-text'),
    modalAnswerDelete: getEl('modal-answer-delete'),
    btnAnswerDeleteClose: getEl('btn-answer-delete-close'),
    btnAnswerDeleteCancel: getEl('btn-answer-delete-cancel'),
    btnAnswerDeleteConfirm: getEl('btn-answer-delete-confirm'),

    // Auth UI
    btnLogin: getEl('btn-login'),
    btnLogout: getEl('btn-logout'),
    userProfileSection: getEl('user-profile-section'),
    userAvatar: getEl('user-avatar'),
    userName: getEl('user-name'),

    // Browsing modal (URL)
    btnBrowsingOpen: getEl('btn-browsing-open'),
    modalBrowsing: getEl('modal-browsing'),
    inputBrowsingModal: getEl('entry-browsing-modal'),
    btnBrowsingSave: getEl('btn-browsing-save'),
    btnBrowsingCancel: getEl('btn-browsing-cancel'),
    btnBrowsingClose: getEl('btn-browsing-close')
};

let currentUploadImage = null;
let calendarNoteSaveTimer = null;
let calendarMemoSaveTimer = null;
let calendarScheduleSaveTimer = null;
let calendarShareModalState = null;
const JOURNAL_DAY_CUTOFF_HOUR = 3;

function applyJournalCutoff(date) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return new Date();
    if (d.getHours() < JOURNAL_DAY_CUTOFF_HOUR) {
        d.setDate(d.getDate() - 1);
    }
    return d;
}

function getJournalDateKeyForEntry(date) {
    return getDateKey(applyJournalCutoff(date));
}

function getJournalDayStart(date) {
    const d = applyJournalCutoff(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getJournalDateNow() {
    return applyJournalCutoff(new Date());
}

function getDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCalendarNote(date) {
    const key = getDateKey(date);
    return appState.userProfile?.calendarNotes?.[key] || '';
}

function getCalendarEntryForDate(date) {
    if (!date) return null;
    return findFinalEntryForDate(date) || findDraftEntryForDate(date);
}

function mergeEntryJournal(entry) {
    if (!entry) return {};
    return { ...(entry.meta?.journal || {}), ...(entry.journal || {}) };
}

function createCalendarDraftEntry(date) {
    const baseDate = new Date(date);
    return {
        createdAt: baseDate,
        created_at: baseDate.toISOString(),
        content: '',
        text: '',
        image: null,
        locked: false,
        isLocked: false,
        meta: { status: 'draft', journal: {} },
        journal: {}
    };
}

function getCalendarJournalForDate(date) {
    const entry = getCalendarEntryForDate(date);
    if (!entry) return { memo: '', schedule: [] };
    return getJournalFromEntry(entry);
}

function getSelfAvatarInfo() {
    const name = getProfileDisplayName();
    const avatarUrl = getProfileAvatarUrl() || (appState.user?.photoURL || '');
    return { name, avatarUrl };
}

function normalizeShareTarget(target) {
    if (!target) return null;
    if (typeof target === 'string') return { name: target };
    if (typeof target === 'object') {
        return {
            name: target.name || target.displayName || target.label || '',
            avatarUrl: target.avatarUrl || target.photoURL || target.photoUrl || target.url || ''
        };
    }
    return null;
}

function normalizeFriendEntry(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
        return { id: raw, name: raw, avatarUrl: '' };
    }
    if (typeof raw === 'object') {
        const id = raw.id || raw.uid || raw.userId || raw.friendId || raw.key || raw.email || '';
        const name = raw.name || raw.displayName || raw.label || raw.email || '';
        const avatarUrl = raw.avatarUrl || raw.photoURL || raw.photoUrl || raw.url || '';
        if (!id) return null;
        return { id, name, avatarUrl };
    }
    return null;
}

function normalizeFriendList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeFriendEntry).filter(Boolean);
}

function buildFriendEntryFromRequest(data, direction, requestId) {
    if (!data) return null;
    const isOutgoing = direction === 'outgoing';
    const friendId = isOutgoing
        ? (data.toFriendId || data.toFriendID || data.to_friend_id || '')
        : (data.fromFriendId || data.fromFriendID || data.from_friend_id || '');
    const friendUid = isOutgoing ? data.toUid : data.fromUid;
    const friendName = isOutgoing
        ? (data.toName || data.toDisplayName || data.to_display_name || '')
        : (data.fromName || data.fromDisplayName || data.from_display_name || '');
    const friendAvatarUrl = isOutgoing
        ? (data.toAvatarUrl || data.toAvatarURL || data.to_avatar_url || '')
        : (data.fromAvatarUrl || data.fromAvatarURL || data.from_avatar_url || '');
    const fallbackId = friendId || friendUid || '';
    if (!fallbackId) return null;
    return {
        id: fallbackId,
        uid: friendUid || '',
        name: friendName || fallbackId,
        avatarUrl: friendAvatarUrl || '',
        requestId: requestId || ''
    };
}

async function loadFriendRequests() {
    const db = window.db;
    if (!db || !appState.user) return;
    const uid = appState.user.uid;
    try {
        const [outgoingSnap, incomingSnap] = await Promise.all([
            db.collection('friend_requests').where('fromUid', '==', uid).get(),
            db.collection('friend_requests').where('toUid', '==', uid).get()
        ]);
        const merged = new Map();
        outgoingSnap.docs.forEach((doc) => {
            merged.set(doc.id, { ...(doc.data() || {}), _id: doc.id });
        });
        incomingSnap.docs.forEach((doc) => {
            merged.set(doc.id, { ...(doc.data() || {}), _id: doc.id });
        });
        const nextState = { friends: [], outgoing: [], incoming: [] };
        const seenFriends = new Set();
        merged.forEach((data) => {
            const status = data.status || 'pending';
            const isOutgoing = data.fromUid === uid;
            const isIncoming = data.toUid === uid;
            if (!isOutgoing && !isIncoming) return;
            if (status === 'accepted') {
                const entry = buildFriendEntryFromRequest(data, isOutgoing ? 'outgoing' : 'incoming', data._id);
                if (entry && !seenFriends.has(entry.id)) {
                    seenFriends.add(entry.id);
                    nextState.friends.push(entry);
                }
                return;
            }
            if (status === 'pending') {
                const entry = buildFriendEntryFromRequest(data, isOutgoing ? 'outgoing' : 'incoming', data._id);
                if (!entry) return;
                if (isOutgoing) {
                    nextState.outgoing.push(entry);
                } else if (isIncoming) {
                    nextState.incoming.push(entry);
                }
            }
        });
        appState.friendState = nextState;
        appState.friendRequestsLoaded = true;
        renderSettingsFriendsList();
    } catch (e) {
        console.warn('Failed to load friend requests', e);
    }
}

function getFriendState() {
    if (appState.friendState) return appState.friendState;
    const profile = appState.userProfile || {};
    appState.friendState = {
        friends: normalizeFriendList(profile.friends || profile.friendList || profile.friend_list || profile.friendIds),
        outgoing: normalizeFriendList(profile.outgoing_requests || profile.outgoingRequests || profile.outgoingRequest),
        incoming: normalizeFriendList(profile.incoming_requests || profile.incomingRequests || profile.incomingRequest)
    };
    return appState.friendState;
}

function setFriendState(nextState, options = {}) {
    appState.friendState = nextState;
    if (options.persist) {
        // TODO: connect friends/outgoing/incoming persistence to Firestore (users doc or dedicated collection).
        saveUserProfile({
            friends: nextState.friends || [],
            outgoing_requests: nextState.outgoing || [],
            incoming_requests: nextState.incoming || []
        });
    }
}

function getFriendCandidates() {
    const state = getFriendState();
    if (state.friends && state.friends.length) return state.friends;
    return [];
}

function getFriendById(friendId) {
    if (!friendId) return null;
    const list = getFriendCandidates();
    return list.find((friend) => friend.id === friendId) || null;
}

function normalizeSharedId(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
        return raw.id || raw.uid || raw.userId || raw.friendId || raw.key || raw.email || '';
    }
    return '';
}

function normalizeSharedList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map(normalizeSharedId).filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function normalizeSharedUidList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((uid) => String(uid || '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw.split(',').map((uid) => uid.trim()).filter(Boolean);
    }
    return [];
}

function parseRowDatasetArray(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        // ignore parse errors
    }
    if (typeof raw === 'string') {
        return raw.split(',').map((value) => value.trim()).filter(Boolean);
    }
    return [];
}

async function resolveSharedUids(sharedIds = [], friendUidMap) {
    const result = [];
    const missing = [];
    sharedIds.forEach((id) => {
        const uid = friendUidMap?.get(id) || '';
        if (uid) {
            result.push(uid);
        } else if (id) {
            missing.push(id);
        }
    });
    if (!missing.length || !window.db || !appState.user) {
        return result;
    }
    await Promise.all(missing.map(async (friendId) => {
        try {
            const doc = await window.db.collection('friend_ids').doc(friendId).get();
            if (doc.exists) {
                const data = doc.data() || {};
                const uid = String(data.uid || '').trim();
                if (uid) {
                    friendUidMap?.set(friendId, uid);
                    result.push(uid);
                }
            }
        } catch (e) {
            console.warn('Failed to resolve friend UID', e);
        }
    }));
    return result;
}

function renderScheduleAvatar(info) {
    const name = String(info?.name || '').trim();
    const label = name || 'あなた';
    const letter = getProfileAvatarLetter(label);
    const url = String(info?.avatarUrl || '').trim();
    if (url) {
        return `<span class="schedule-avatar has-image" style="background-image:url('${escapeHtml(url)}')" aria-label="${escapeHtml(label)}">${escapeHtml(letter)}</span>`;
    }
    return `<span class="schedule-avatar" aria-label="${escapeHtml(label)}">${escapeHtml(letter)}</span>`;
}

function getCalendarShareTargets(item) {
    const raw = item?.sharedWith || item?.shared_with || item?.shareWith || item?.share_with || item?.shareTargets || [];
    const list = Array.isArray(raw)
        ? raw.map((entry) => {
            const sharedId = normalizeSharedId(entry);
            if (sharedId) {
                const friend = getFriendById(sharedId);
                if (friend) return friend;
            }
            return normalizeShareTarget(entry);
        }).filter(Boolean)
        : [];
    if (list.length) return list;
    return [getSelfAvatarInfo()];
}

function renderCalendarScheduleRows(items = [], options = {}) {
    if (!dom.calendarScheduleList) return;
    const canEdit = !options.readOnly;
    const list = Array.isArray(items) && items.length ? items : [{ start: '', end: '', title: '' }];
    dom.calendarScheduleList.innerHTML = '';
    list.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.dataset.index = String(index);
        const startParts = splitTimeParts(item.start);
        const endParts = splitTimeParts(item.end);
        const allDay = !!(item.allDay || item.all_day);
        row.dataset.allDay = allDay ? 'true' : 'false';
        const timeLabel = buildScheduleTimeButtonLabel(item.start || '', item.end || '', allDay);
        const timeMarkup = buildScheduleTimeButtonMarkup(item.start || '', item.end || '', allDay);
        const shareMarkup = getCalendarShareTargets(item).map(renderScheduleAvatar).join('');
        const sharedIds = normalizeSharedList(item.sharedWith || item.shared_with || item.shareWith || item.share_with || item.shareTargets || []);
        const sharedUids = normalizeSharedUidList(item.sharedWithUids || item.shared_with_uids || item.shareWithUids || item.share_with_uids || item.sharedWithUIDs || []);
        row.innerHTML = `
            <div class="schedule-time">
                <button type="button" class="schedule-time-btn journal-input" data-role="time-btn" aria-label="${escapeHtml(timeLabel)}">
                    ${timeMarkup}
                </button>
                <input type="hidden" data-role="start-hour" value="${escapeHtml(startParts.hour)}">
                <input type="hidden" data-role="start-minute" value="${escapeHtml(startParts.minute)}">
                <input type="hidden" data-role="end-hour" value="${escapeHtml(endParts.hour)}">
                <input type="hidden" data-role="end-minute" value="${escapeHtml(endParts.minute)}">
                <input type="hidden" data-role="all-day" value="${allDay ? '1' : ''}">
            </div>
            <input type="text" class="schedule-title-input journal-input" data-role="title" placeholder="予定を記入" value="${escapeHtml(item.title || '')}">
            <div class="schedule-actions">
                <button type="button" class="schedule-share-btn" data-role="share-btn" aria-label="共有設定">
                    ${shareMarkup}
                </button>
                ${canEdit ? '<button type="button" class="schedule-remove-btn journal-input" aria-label="予定を削除">−</button>' : '<span class="schedule-remove-spacer"></span>'}
            </div>
        `;
        row.dataset.sharedWith = JSON.stringify(sharedIds);
        row.dataset.sharedWithUids = JSON.stringify(sharedUids);
        if (!canEdit) {
            row.classList.add('is-readonly');
            const titleInput = row.querySelector('[data-role="title"]');
            if (titleInput) titleInput.readOnly = true;
            const timeBtn = row.querySelector('[data-role="time-btn"]');
            if (timeBtn) timeBtn.disabled = true;
            const removeBtn = row.querySelector('.schedule-remove-btn');
            if (removeBtn) removeBtn.disabled = true;
            const shareBtn = row.querySelector('[data-role="share-btn"]');
            if (shareBtn) shareBtn.disabled = true;
        }
        dom.calendarScheduleList.appendChild(row);
    });
}

function renderCalendarFriendRows(items = []) {
    if (!dom.calendarFriendList || !dom.calendarFriendEmpty) return;
    const list = Array.isArray(items) ? items : [];
    dom.calendarFriendList.innerHTML = '';
    if (!list.length) {
        dom.calendarFriendEmpty.classList.remove('hidden');
        return;
    }
    dom.calendarFriendEmpty.classList.add('hidden');
    list.forEach((item) => {
        const allDay = !!(item.allDay || item.all_day);
        const timeMarkup = buildScheduleTimeButtonMarkup(item.start || '', item.end || '', allDay);
        const creator = normalizeShareTarget(item.creator || item.owner || item.author) || {};
        const avatarMarkup = renderScheduleAvatar(creator);
        const row = document.createElement('div');
        row.className = 'calendar-friend-row';
        row.innerHTML = `
            <div class="calendar-friend-time">${timeMarkup}</div>
            <div class="calendar-friend-title">${escapeHtml(item.title || '---')}</div>
            <div class="schedule-share">${avatarMarkup}</div>
        `;
        dom.calendarFriendList.appendChild(row);
    });
}

function getFriendSchedulesForDate(date) {
    if (!date) return [];
    const key = getDateKey(date);
    if (!appState.friendSchedulesByDate) appState.friendSchedulesByDate = {};
    return appState.friendSchedulesByDate[key] || [];
}

async function loadFriendSchedulesForDate(date) {
    const targetDate = date || appState.calendarSelectedDate || appState.calendarDate || new Date();
    const key = getDateKey(targetDate);
    if (!appState.friendSchedulesByDate) appState.friendSchedulesByDate = {};
    if (!appState.user || !window.db) {
        appState.friendSchedulesByDate[key] = [];
        renderCalendarFriendRows([]);
        return;
    }
    const uid = appState.user.uid;
    try {
        const snapshot = await window.db.collection('shared_schedules')
            .where('sharedWithUids', 'array-contains', uid)
            .get();
        const list = snapshot.docs.map((doc) => doc.data() || {}).filter((item) => item.dateKey === key);
        const mapped = list.map((item) => ({
            start: item.start || '',
            end: item.end || '',
            title: item.title || '',
            allDay: !!item.allDay,
            creator: {
                name: item.ownerName || '',
                avatarUrl: item.ownerAvatarUrl || ''
            }
        }));
        appState.friendSchedulesByDate[key] = mapped;
        renderCalendarFriendRows(mapped);
    } catch (e) {
        console.warn('Failed to load shared schedules', e);
        renderCalendarFriendRows([]);
    }
}

function collectScheduleRowsFrom(container, options = {}) {
    if (!container) return [];
    const includeEmpty = !!options.includeEmpty;
    const rows = [];
    container.querySelectorAll('.schedule-row').forEach((row) => {
        const startHour = row.querySelector('[data-role="start-hour"]')?.value || '';
        const startMinute = row.querySelector('[data-role="start-minute"]')?.value || '';
        const endHour = row.querySelector('[data-role="end-hour"]')?.value || '';
        const endMinute = row.querySelector('[data-role="end-minute"]')?.value || '';
        const allDay = row.querySelector('[data-role="all-day"]')?.value === '1' || row.dataset.allDay === 'true';
        const start = allDay ? '' : combineTime(startHour, startMinute);
        const end = allDay ? '' : combineTime(endHour, endMinute);
        const title = row.querySelector('[data-role="title"]')?.value.trim() || '';
        const sharedWith = normalizeSharedList(parseRowDatasetArray(row.dataset.sharedWith));
        const sharedWithUids = normalizeSharedUidList(parseRowDatasetArray(row.dataset.sharedWithUids));
        if (includeEmpty || allDay || start || end || title || sharedWith.length) {
            rows.push({ start, end, title, allDay, sharedWith, sharedWithUids });
        }
    });
    return rows;
}

function collectCalendarScheduleRowsRaw() {
    return collectScheduleRowsFrom(dom.calendarScheduleList, { includeEmpty: true });
}

function collectCalendarScheduleRows() {
    return collectScheduleRowsFrom(dom.calendarScheduleList, { includeEmpty: false });
}

function openCalendarShareModalForRow(rowIndex) {
    if (!dom.modalScheduleShare) return;
    const date = appState.calendarSelectedDate || appState.calendarDate || new Date();
    const journal = getCalendarJournalForDate(date);
    const baseSchedule = Array.isArray(journal.schedule) ? journal.schedule : [];
    const uiSchedule = collectCalendarScheduleRowsRaw();
    const baseItem = baseSchedule[rowIndex] || {};
    const uiItem = uiSchedule[rowIndex] || {};
    const sharedRaw = baseItem.sharedWith || baseItem.shared_with || baseItem.shareWith || baseItem.share_with || baseItem.shareTargets || [];
    const uiSharedRaw = uiItem.sharedWith || uiItem.shared_with || uiItem.shareWith || uiItem.share_with || uiItem.shareTargets || [];
    const sharedIds = new Set([
        ...normalizeSharedList(sharedRaw),
        ...normalizeSharedList(uiSharedRaw)
    ]);
    const friends = getFriendCandidates();
    const friendUidMap = new Map(friends.map((friend) => [friend.id, friend.uid]).filter((entry) => entry[0] && entry[1]));

    calendarShareModalState = {
        date,
        rowIndex,
        friends,
        sharedIds,
        friendUidMap
    };

    if (dom.shareModalTime) {
        const timeMarkup = buildScheduleTimeButtonMarkup(uiItem.start || '', uiItem.end || '', uiItem.allDay || uiItem.all_day);
        dom.shareModalTime.innerHTML = timeMarkup;
    }
    if (dom.shareModalTitle) {
        dom.shareModalTitle.textContent = uiItem.title || '予定を記入';
    }

    renderShareModalLists();
    dom.modalScheduleShare.classList.remove('hidden');
    dom.modalScheduleShare.classList.add('active');
}

function closeCalendarShareModal() {
    if (!dom.modalScheduleShare) return;
    dom.modalScheduleShare.classList.add('hidden');
    dom.modalScheduleShare.classList.remove('active');
    calendarShareModalState = null;
}

function renderShareModalLists() {
    if (!calendarShareModalState || !dom.shareListShared || !dom.shareListUnshared) return;
    const { friends, sharedIds } = calendarShareModalState;
    dom.shareListShared.innerHTML = '';
    dom.shareListUnshared.innerHTML = '';

    if (!friends.length) {
        dom.shareListShared.innerHTML = '<div class="calendar-friend-empty">友達がいません</div>';
        dom.shareListUnshared.innerHTML = '<div class="calendar-friend-empty">友達がいません</div>';
        return;
    }

    friends.forEach((friend) => {
        const isShared = sharedIds.has(friend.id);
        const row = document.createElement('div');
        row.className = 'share-person-row';
        row.dataset.friendId = friend.id;
        const avatarMarkup = renderScheduleAvatar(friend);
        const btnLabel = isShared ? '共有から外す' : '共有に追加';
        row.innerHTML = `
            <div class="share-person-info">
                ${avatarMarkup}
                <span class="share-person-name">${escapeHtml(friend.name || friend.id)}</span>
            </div>
            <button type="button" class="share-toggle-btn" data-action="${isShared ? 'remove' : 'add'}" aria-label="${escapeHtml(btnLabel)}">
                ${isShared ? '−' : '+'}
            </button>
        `;
        if (isShared) {
            dom.shareListShared.appendChild(row);
        } else {
            dom.shareListUnshared.appendChild(row);
        }
    });
}

function handleShareModalToggle(event) {
    if (!calendarShareModalState) return;
    const actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;
    const row = actionBtn.closest('.share-person-row');
    if (!row) return;
    const friendId = row.dataset.friendId;
    if (!friendId) return;
    if (actionBtn.dataset.action === 'add') {
        calendarShareModalState.sharedIds.add(friendId);
    } else {
        calendarShareModalState.sharedIds.delete(friendId);
    }
    renderShareModalLists();
}

async function applyCalendarShareChanges() {
    if (!calendarShareModalState) return;
    const { date, rowIndex, sharedIds, friendUidMap } = calendarShareModalState;
    const nextSharedIds = Array.from(sharedIds);
    const nextSharedUids = await resolveSharedUids(nextSharedIds, friendUidMap);
    const uiSchedule = collectCalendarScheduleRowsRaw();
    const journal = getCalendarJournalForDate(date);
    const baseSchedule = Array.isArray(journal.schedule) ? journal.schedule : [];
    const nextSchedule = uiSchedule.map((item, index) => {
        const base = baseSchedule[index] || {};
        const existingShared = base.sharedWith || base.shared_with || base.shareWith || base.share_with || base.shareTargets || [];
        const normalizedExisting = normalizeSharedList(existingShared);
        const existingSharedUids = base.sharedWithUids || base.shared_with_uids || base.shareWithUids || base.share_with_uids || [];
        const normalizedExistingUids = normalizeSharedUidList(existingSharedUids);
        const nextShared = index === rowIndex ? nextSharedIds : normalizedExisting;
        const nextUids = index === rowIndex ? nextSharedUids : normalizedExistingUids;
        return { ...base, ...item, sharedWith: nextShared, sharedWithUids: nextUids };
    });
    await saveCalendarEntry(date, { schedule: nextSchedule });
    renderCalendarScheduleRows(nextSchedule);
    closeCalendarShareModal();
}

async function syncSharedSchedulesForDate(date, scheduleItems = []) {
    if (!appState.user || !window.db) return;
    const ownerUid = appState.user.uid;
    const ownerFriendId = appState.userProfile?.friend_id || appState.userProfile?.friendId || '';
    const ownerName = getProfileDisplayName();
    const ownerAvatarUrl = getProfileAvatarUrl() || appState.user.photoURL || '';
    const dateKey = getDateKey(date || new Date());
    const tasks = scheduleItems.map((item, index) => {
        const sharedIds = normalizeSharedList(item.sharedWith || item.shared_with || item.shareWith || item.share_with || item.shareTargets || []);
        const sharedUids = normalizeSharedUidList(item.sharedWithUids || item.shared_with_uids || item.shareWithUids || item.share_with_uids || []);
        const docId = `${ownerUid}_${dateKey}_${index}`;
        if (!sharedIds.length || !sharedUids.length) {
            return window.db.collection('shared_schedules').doc(docId).delete().catch(() => {});
        }
        return window.db.collection('shared_schedules').doc(docId).set({
            ownerUid,
            ownerFriendId,
            ownerName,
            ownerAvatarUrl,
            sharedWith: sharedIds,
            sharedWithUids: sharedUids,
            dateKey,
            start: item.start || '',
            end: item.end || '',
            title: item.title || '',
            allDay: !!(item.allDay || item.all_day),
            updatedAt: getServerTimestamp()
        }, { merge: true });
    });
    await Promise.all(tasks);
}

function renderSettingsFriendAvatar(friend) {
    const name = String(friend?.name || friend?.id || '').trim();
    const letter = getProfileAvatarLetter(name || '友');
    const url = String(friend?.avatarUrl || '').trim();
    if (url) {
        return `<span class="settings-friend-avatar has-image" style="background-image:url('${escapeHtml(url)}')">${escapeHtml(letter)}</span>`;
    }
    return `<span class="settings-friend-avatar">${escapeHtml(letter)}</span>`;
}

function filterFriendsByQuery(list, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((friend) => {
        const name = String(friend.name || '').toLowerCase();
        const id = String(friend.id || '').toLowerCase();
        return name.includes(q) || id.includes(q);
    });
}

function renderSettingsFriendsList() {
    const container = dom.settingsContainer?.querySelector('#settings-friends-list');
    if (!container) return;
    const state = getFriendState();
    const tab = appState.settingsFriendTab || 'friends';
    const searchQuery = appState.settingsFriendSearch || '';
    const list = tab === 'friends'
        ? state.friends
        : (tab === 'outgoing' ? state.outgoing : state.incoming);
    const filtered = filterFriendsByQuery(list, searchQuery);
    if (!filtered.length) {
        container.innerHTML = `<div class="settings-friends-empty">${tab === 'outgoing' ? '申請中の友だちがいません' : (tab === 'incoming' ? '承認待ちの友だちがいません' : '友だちがいません')}</div>`;
    } else {
        container.innerHTML = filtered.map((friend) => `
            <div class="settings-friend-row" data-friend-id="${escapeHtml(friend.id || '')}" data-request-id="${escapeHtml(friend.requestId || '')}">
                <div class="settings-friend-info">
                    ${renderSettingsFriendAvatar(friend)}
                    <div class="settings-friend-text">
                        <div class="settings-friend-name">${escapeHtml(friend.name || friend.id || '')}</div>
                        ${friend.id ? `<div class="settings-friend-id">ID: ${escapeHtml(friend.id)}</div>` : ''}
                    </div>
                </div>
                ${tab === 'incoming' ? '<button class="btn-secondary settings-friend-approve" data-action="approve">承認</button>' : ''}
            </div>
        `).join('');
    }
    dom.settingsContainer?.querySelectorAll('[data-friend-tab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.friendTab === tab);
    });
}

function openFriendIdModal() {
    if (!dom.modalFriendId) return;
    appState.friendIdSearchQuery = '';
    appState.friendIdSearchResult = null;
    appState.friendIdSearchError = '';
    if (dom.inputFriendId) dom.inputFriendId.value = '';
    renderFriendIdSearchResult();
    dom.modalFriendId.classList.remove('hidden');
    dom.modalFriendId.classList.add('active');
}

function closeFriendIdModal() {
    if (!dom.modalFriendId) return;
    dom.modalFriendId.classList.add('hidden');
    dom.modalFriendId.classList.remove('active');
}

function renderFriendIdSearchResult() {
    if (!dom.friendIdResult || !dom.btnFriendRequest) return;
    const error = appState.friendIdSearchError;
    const result = appState.friendIdSearchResult;
    if (error) {
        dom.friendIdResult.innerHTML = `<div class="friend-id-empty">${escapeHtml(error)}</div>`;
        dom.btnFriendRequest.disabled = true;
        return;
    }
    if (!result) {
        dom.friendIdResult.innerHTML = '<div class="friend-id-empty">IDを入力して検索してください</div>';
        dom.btnFriendRequest.disabled = true;
        return;
    }
    dom.friendIdResult.innerHTML = `
        <div class="friend-id-card">
            ${renderSettingsFriendAvatar(result)}
            <div class="settings-friend-text">
                <div class="settings-friend-name">${escapeHtml(result.name || result.id)}</div>
                <div class="settings-friend-id">ID: ${escapeHtml(result.id)}</div>
            </div>
        </div>
    `;
    dom.btnFriendRequest.disabled = false;
}

function generateFriendId(length = 8) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let id = '';
    for (let i = 0; i < length; i += 1) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

function formatFriendIdError(err, fallback) {
    const raw = String(err && (err.code || err.message || '')).toLowerCase();
    if (raw.includes('permission') || raw.includes('permission-denied') || raw.includes('insufficient')) {
        return '権限エラーのためIDを生成できませんでした';
    }
    return fallback;
}

function refreshSettingsIfOpen() {
    if (!dom.modalSettings || !dom.settingsContainer) return;
    if (dom.modalSettings.classList.contains('hidden')) return;
    renderSettingsPage();
}

async function ensureFriendId() {
    const db = window.db;
    if (!db || !appState.user) return;
    const currentId = appState.userProfile?.friend_id || appState.userProfile?.friendId || '';
    const profileName = getProfileDisplayName();
    const avatarUrl = getProfileAvatarUrl() || appState.user.photoURL || '';

    if (currentId) {
        appState.friendIdStatus = 'ready';
        appState.friendIdError = '';
        try {
            const ref = db.collection('friend_ids').doc(currentId);
            const snapshot = await ref.get();
            if (!snapshot.exists) {
                await ref.set({
                    uid: appState.user.uid,
                    displayName: profileName,
                    avatarUrl,
                    createdAt: getServerTimestamp()
                }, { merge: true });
            }
        } catch (e) {
            console.warn('Failed to ensure friend ID mapping', e);
            appState.friendIdStatus = 'failed';
            appState.friendIdError = formatFriendIdError(e, 'IDの確認に失敗しました');
        }
        refreshSettingsIfOpen();
        return;
    }

    appState.friendIdStatus = 'generating';
    appState.friendIdError = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = generateFriendId(8);
        const ref = db.collection('friend_ids').doc(candidate);
        try {
            await db.runTransaction(async (tx) => {
                const doc = await tx.get(ref);
                if (doc.exists) throw new Error('friend_id_exists');
                tx.set(ref, {
                    uid: appState.user.uid,
                    displayName: profileName,
                    avatarUrl,
                    createdAt: getServerTimestamp()
                });
                tx.set(db.collection('users').doc(appState.user.uid), { friend_id: candidate }, { merge: true });
            });
            appState.userProfile = { ...(appState.userProfile || {}), friend_id: candidate };
            appState.friendIdStatus = 'ready';
            appState.friendIdError = '';
            refreshSettingsIfOpen();
            return;
        } catch (e) {
            if (String(e && e.message || '').includes('friend_id_exists')) {
                continue;
            }
            console.warn('Failed to create friend ID', e);
            appState.friendIdStatus = 'failed';
            appState.friendIdError = formatFriendIdError(e, 'IDの生成に失敗しました');
            refreshSettingsIfOpen();
            return;
        }
    }
    appState.friendIdStatus = 'failed';
    appState.friendIdError = 'IDの生成に失敗しました';
    refreshSettingsIfOpen();
}

async function searchFriendById() {
    if (!dom.inputFriendId) return;
    const query = String(dom.inputFriendId.value || '').trim();
    appState.friendIdSearchQuery = query;
    appState.friendIdSearchError = '';
    appState.friendIdSearchResult = null;
    if (!query) {
        appState.friendIdSearchError = 'IDを入力してください';
        renderFriendIdSearchResult();
        return;
    }
    if (appState.user && (query === appState.user.uid || query === appState.user.email)) {
        appState.friendIdSearchError = '自分は追加できません';
        renderFriendIdSearchResult();
        return;
    }
    const db = window.db;
    if (!db || !appState.user) {
        appState.friendIdSearchError = 'ログインしてください';
        renderFriendIdSearchResult();
        return;
    }
    try {
        const idDoc = await db.collection('friend_ids').doc(query).get();
        if (!idDoc.exists) {
            appState.friendIdSearchError = '該当するIDがありません';
            renderFriendIdSearchResult();
            return;
        }
        const data = idDoc.data() || {};
        const uid = data.uid || '';
        if (!uid || uid === appState.user.uid) {
            appState.friendIdSearchError = '自分は追加できません';
            renderFriendIdSearchResult();
            return;
        }
        let userData = {};
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                userData = userDoc.data() || {};
            }
        } catch (e) {
            console.warn('Friend user profile read blocked, fallback to friend_ids', e);
        }
        appState.friendIdSearchResult = {
            id: query,
            uid,
            name: userData.displayName || data.displayName || query,
            avatarUrl: userData.avatarUrl || data.avatarUrl || ''
        };
    } catch (e) {
        console.warn('Friend ID search failed', e);
        appState.friendIdSearchError = '検索に失敗しました';
    }
    renderFriendIdSearchResult();
}

function requestFriendById() {
    const result = appState.friendIdSearchResult;
    if (!result) return;
    const state = getFriendState();
    const existsIn = (list) => list.some((item) => item.id === result.id);
    if (existsIn(state.friends)) {
        showToast('既に友だちです');
        return;
    }
    if (existsIn(state.outgoing)) {
        showToast('既に申請中です');
        return;
    }
    if (existsIn(state.incoming)) {
        showToast('既に承認待ちです');
        return;
    }
    if (!window.db || !appState.user) {
        showToast('ログインしてください', 'error');
        return;
    }
    const db = window.db;
    const fromUid = appState.user.uid;
    const toUid = result.uid;
    const profileName = getProfileDisplayName();
    const profileAvatarUrl = getProfileAvatarUrl() || appState.user.photoURL || '';
    const friendId = appState.userProfile?.friend_id || appState.userProfile?.friendId || '';
    (async () => {
        try {
            const outgoingSnap = await db.collection('friend_requests')
                .where('fromUid', '==', fromUid)
                .where('toUid', '==', toUid)
                .get();
            if (!outgoingSnap.empty) {
                showToast('既に申請中です');
                return;
            }
            const incomingSnap = await db.collection('friend_requests')
                .where('fromUid', '==', toUid)
                .where('toUid', '==', fromUid)
                .get();
            if (!incomingSnap.empty) {
                const reverseData = incomingSnap.docs[0].data() || {};
                if ((reverseData.status || 'pending') === 'accepted') {
                    showToast('既に友だちです');
                } else {
                    showToast('相手から承認待ちがあります');
                    await loadFriendRequests();
                }
                return;
            }
            await db.collection('friend_requests').add({
                fromUid,
                toUid,
                fromFriendId: friendId,
                toFriendId: result.id,
                fromName: profileName,
                toName: result.name || result.id,
                fromAvatarUrl: profileAvatarUrl,
                toAvatarUrl: result.avatarUrl || '',
                status: 'pending',
                createdAt: getServerTimestamp(),
                updatedAt: getServerTimestamp()
            });
            await loadFriendRequests();
            showToast('申請を送信しました');
            closeFriendIdModal();
        } catch (e) {
            console.warn('Failed to create friend request', e);
            showToast('申請に失敗しました', 'error');
        }
    })();
}

async function approveFriendRequest(requestId) {
    if (!requestId || !window.db || !appState.user) return;
    try {
        await window.db.collection('friend_requests').doc(requestId).set({
            status: 'accepted',
            updatedAt: getServerTimestamp()
        }, { merge: true });
        await loadFriendRequests();
        showToast('承認しました');
    } catch (e) {
        console.warn('Failed to approve friend request', e);
        showToast('承認に失敗しました', 'error');
    }
}

function updateCalendarSidePanel(targetDate) {
    if (!dom.calendarSideDate) return;
    const date = targetDate || appState.calendarSelectedDate || appState.calendarDate || new Date();
    appState.calendarSelectedDate = date;
    dom.calendarSideDate.textContent = formatDate(date);
    if (dom.btnCalendarAddSchedule) {
        dom.btnCalendarAddSchedule.disabled = !appState.user;
    }
    if (!appState.user) {
        if (dom.calendarSideText) {
            dom.calendarSideText.value = '';
            dom.calendarSideText.placeholder = 'ログインすると編集できます';
            dom.calendarSideText.readOnly = true;
        }
        if (dom.calendarScheduleList) {
            dom.calendarScheduleList.innerHTML = '<div class="calendar-friend-empty">ログインすると編集できます</div>';
        }
        renderCalendarFriendRows([]);
        return;
    }
    const journal = getCalendarJournalForDate(date);
    renderCalendarScheduleRows(journal.schedule || [], { readOnly: false });
    if (dom.calendarSideText) {
        dom.calendarSideText.readOnly = false;
        dom.calendarSideText.placeholder = 'メモを入力';
        dom.calendarSideText.value = journal.memo || '';
    }
    renderCalendarFriendRows(getFriendSchedulesForDate(date));
    loadFriendSchedulesForDate(date);
}

function queueCalendarMemoSave() {
    if (!dom.calendarSideText || !appState.user) return;
    const text = dom.calendarSideText.value.trim();
    const date = appState.calendarSelectedDate || appState.calendarDate || new Date();
    if (calendarMemoSaveTimer) clearTimeout(calendarMemoSaveTimer);
    calendarMemoSaveTimer = setTimeout(() => {
        saveCalendarEntry(date, { memo: text });
    }, 400);
}

function queueCalendarScheduleSave() {
    if (!appState.user) return;
    const date = appState.calendarSelectedDate || appState.calendarDate || new Date();
    const scheduleItems = collectCalendarScheduleRows();
    if (calendarScheduleSaveTimer) clearTimeout(calendarScheduleSaveTimer);
    calendarScheduleSaveTimer = setTimeout(() => {
        saveCalendarEntry(date, { schedule: scheduleItems });
    }, 400);
}

async function saveCalendarEntry(date, updates = {}) {
    if (!appState.user) return;
    const targetDate = date || appState.calendarSelectedDate || appState.calendarDate || new Date();
    const existing = getCalendarEntryForDate(targetDate);
    const entry = existing ? { ...existing } : createCalendarDraftEntry(targetDate);
    const mergedJournal = mergeEntryJournal(entry);
    if (Object.prototype.hasOwnProperty.call(updates, 'memo')) {
        mergedJournal.memo = updates.memo || '';
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'schedule')) {
        mergedJournal.schedule = Array.isArray(updates.schedule) ? updates.schedule : [];
    }
    const status = existing ? getEntryStatus(existing) : 'draft';
    entry.meta = { ...(entry.meta || {}), status, journal: mergedJournal };
    entry.journal = mergedJournal;
    if (!entry.created_at) entry.created_at = targetDate.toISOString();
    if (!entry.createdAt) entry.createdAt = targetDate;

    const entryId = await saveEntryToFirestore(entry);
    if (!entryId) return;
    entry.id = entryId;
    const index = appState.entries.findIndex(e => e.id === entryId);
    if (index >= 0) {
        appState.entries[index] = entry;
    } else {
        appState.entries.unshift(entry);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'schedule')) {
        await syncSharedSchedulesForDate(targetDate, mergedJournal.schedule || []);
    }
}

function isSameDay(a, b) {
    return getJournalDateKeyForEntry(a) === getDateKey(b);
}

function getEntryStatus(entry) {
    return entry && entry.meta && entry.meta.status ? entry.meta.status : 'final';
}

function isDraftEntry(entry) {
    return getEntryStatus(entry) === 'draft';
}

function isFinalEntry(entry) {
    return !isDraftEntry(entry);
}

function findEntryForDate(date, predicate) {
    const list = appState.entries || [];
    return list.find((entry) => predicate(entry) && isSameDay(getEntryDate(entry), date));
}

function findFinalEntryForDate(date) {
    return findEntryForDate(date, isFinalEntry);
}

function findDraftEntryForDate(date) {
    return findEntryForDate(date, isDraftEntry);
}

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
const EMOTION_OPPOSITES = {
    joy: 'sadness',
    sadness: 'joy',
    anticipation: 'surprise',
    surprise: 'anticipation',
    anger: 'fear',
    fear: 'anger',
    disgust: 'trust',
    trust: 'disgust'
};
const COMPOUND_EMOTIONS = {
    'joy|anticipation': '\u697d\u89b3',
    'sadness|surprise': '\u5931\u671b',
    'joy|anger': '\u8a87\u308a',
    'fear|sadness': '\u7d76\u671b',
    'joy|disgust': '\u75c5\u7684\u72b6\u614b',
    'trust|sadness': '\u611f\u50b7',
    'anger|anticipation': '\u7a4d\u6975\u6027',
    'fear|surprise': '\u754f\u656c',
    'disgust|anticipation': '\u51b7\u7b11',
    'trust|surprise': '\u597d\u5947\u5fc3',
    'sadness|anticipation': '\u60b2\u89b3',
    'joy|surprise': '\u6b53\u559c',
    'disgust|anger': '\u8efd\u8511',
    'trust|fear': '\u670d\u5f93',
    'sadness|anger': '\u7fa8\u671b',
    'joy|fear': '\u7f6a\u60aa\u611f',
    'surprise|anger': '\u61a4\u6168',
    'fear|anticipation': '\u4e0d\u5b89',
    'sadness|disgust': '\u81ea\u8cac',
    'joy|trust': '\u611b',
    'surprise|disgust': '\u4e0d\u4fe1',
    'trust|anticipation': '\u5e0c\u671b',
    'fear|disgust': '\u6065',
    'trust|anger': '\u512a\u4f4d'
};

const MATRIX_CONTEXTS = ['仕事/学業', '私生活', '恋愛/親密', '家族', '一人', 'ストレス'];
const MATRIX_TRAITS = [
    '外交的', '内向的', '自己開示', '非開示', '論理基準', '感情基準',
    '抽象志向', '具体志向', '計画的', '即興的', '即行動', '慎重開始',
    '主導的', '追従的', '調和志向', '対立許容'
];
const MATRIX_TRAIT_COLORS = {
    '外交的': '#4a77d4',
    '内向的': '#4a77d4',
    '自己開示': '#8a5cd6',
    '非開示': '#8a5cd6',
    '論理基準': '#d95b5b',
    '感情基準': '#d95b5b',
    '抽象志向': '#f1c84d',
    '具体志向': '#f1c84d',
    '計画的': '#f0a43a',
    '即興的': '#f0a43a',
    '即行動': '#f3b46a',
    '慎重開始': '#f3b46a',
    '主導的': '#b87b4f',
    '追従的': '#b87b4f',
    '調和志向': '#8e8e8e',
    '対立許容': '#8e8e8e'
};
const MATRIX_CATEGORY_LABELS = [
    { label: '対人距離', start: 0, end: 1 },
    { label: '情報開示', start: 2, end: 3 },
    { label: '判断基準', start: 4, end: 5 },
    { label: '思考粒度', start: 6, end: 7 },
    { label: '行動設計', start: 8, end: 9 },
    { label: '行動開始', start: 10, end: 11 },
    { label: '主体性', start: 12, end: 13 },
    { label: '摩擦スタンス', start: 14, end: 15 }
];

function hashStringToSeed(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function formatMatrixDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function renderContextTraitMatrixPlot(container, events, onSelectEvent, options = {}) {
    if (!container) return;
    const width = container.clientWidth || 920;
    const heightOverride = Number.isFinite(options.height) ? options.height : null;
    const height = heightOverride || Math.max(260, Math.min(340, Math.round(width * 0.45)));
    const isExpanded = !!options.isExpanded;
    container.innerHTML = '';
    container.style.height = `${height}px`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', `${width}`);
    svg.setAttribute('height', `${height}`);
    svg.classList.add('matrix-svg');

    const margin = isExpanded
        ? { top: 52, right: 20, bottom: 90, left: 110 }
        : { top: 16, right: 16, bottom: 72, left: 96 };
    const gridWidth = width - margin.left - margin.right;
    const gridHeight = height - margin.top - margin.bottom;
    const colCount = MATRIX_TRAITS.length;
    const rowCount = MATRIX_CONTEXTS.length;
    const cellW = gridWidth / colCount;
    const cellH = gridHeight / rowCount;

    const gridBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    gridBg.setAttribute('x', `${margin.left}`);
    gridBg.setAttribute('y', `${margin.top}`);
    gridBg.setAttribute('width', `${gridWidth}`);
    gridBg.setAttribute('height', `${gridHeight}`);
    gridBg.setAttribute('fill', '#ffffff');
    svg.appendChild(gridBg);

    for (let c = 0; c <= colCount; c += 1) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const x = margin.left + c * cellW;
        const isGroupBoundary = c !== 0 && c % 2 === 0;
        line.setAttribute('x1', `${x}`);
        line.setAttribute('x2', `${x}`);
        line.setAttribute('y1', `${margin.top}`);
        line.setAttribute('y2', `${margin.top + gridHeight}`);
        line.setAttribute('stroke', isGroupBoundary ? '#c9c9c9' : '#e5e5e5');
        line.setAttribute('stroke-width', isGroupBoundary ? '1.4' : '1');
        svg.appendChild(line);
    }

    for (let r = 0; r <= rowCount; r += 1) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const y = margin.top + r * cellH;
        line.setAttribute('x1', `${margin.left}`);
        line.setAttribute('x2', `${margin.left + gridWidth}`);
        line.setAttribute('y1', `${y}`);
        line.setAttribute('y2', `${y}`);
        line.setAttribute('stroke', '#d9d9d9');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
    }

    MATRIX_CONTEXTS.forEach((label, index) => {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        const y = margin.top + index * cellH + cellH / 2 + 4;
        text.setAttribute('x', `${margin.left - 10}`);
        text.setAttribute('y', `${y}`);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('font-size', '12');
        text.setAttribute('fill', '#5f5f5f');
        text.textContent = label;
        svg.appendChild(text);
    });

    MATRIX_TRAITS.forEach((label, index) => {
        const x = margin.left + index * cellW + cellW / 2;
        const y = margin.top + gridHeight + (isExpanded ? 26 : 34);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${x}`);
        text.setAttribute('y', `${y}`);
        text.setAttribute('text-anchor', isExpanded ? 'middle' : 'end');
        text.setAttribute('font-size', isExpanded ? '10.5' : '11');
        text.setAttribute('fill', '#5f5f5f');
        if (!isExpanded) {
            text.setAttribute('transform', `rotate(-45 ${x} ${y})`);
        }
        text.textContent = label;
        svg.appendChild(text);
    });

    if (isExpanded) {
        MATRIX_CATEGORY_LABELS.forEach((group) => {
            const startX = margin.left + group.start * cellW;
            const endX = margin.left + (group.end + 1) * cellW;
            const centerX = (startX + endX) / 2;
            const y = margin.top - 14;
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', `${centerX}`);
            text.setAttribute('y', `${y}`);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', '#7a7a7a');
            text.textContent = group.label;
            svg.appendChild(text);
        });
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'matrix-tooltip';
    container.appendChild(tooltip);

    const plotEvents = Array.isArray(events) ? events.filter(Boolean) : [];
    if (!plotEvents.length) {
        const empty = document.createElement('div');
        empty.className = 'matrix-empty-state';
        empty.textContent = 'データが不足しています';
        container.appendChild(svg);
        container.appendChild(empty);
        return;
    }

    const pointRadius = Number.isFinite(options.pointRadius) ? options.pointRadius : (isExpanded ? 4 : 3);
    const pointOpacity = Number.isFinite(options.pointOpacity) ? options.pointOpacity : 0.45;
    plotEvents.forEach((event) => {
        const rowIndex = MATRIX_CONTEXTS.indexOf(event.context);
        const colIndex = MATRIX_TRAITS.indexOf(event.trait);
        if (rowIndex < 0 || colIndex < 0) return;
        const seed = hashStringToSeed(String(event.id || `${event.context}-${event.trait}`));
        const rand = mulberry32(seed);
        const jitterX = (rand() - 0.5) * cellW * 0.5;
        const jitterY = (rand() - 0.5) * cellH * 0.5;
        const x = margin.left + colIndex * cellW + cellW / 2 + jitterX;
        const y = margin.top + rowIndex * cellH + cellH / 2 + jitterY;
        const confidence = Number.isFinite(event.confidence) ? Math.max(0, Math.min(1, event.confidence)) : 0.5;
        const radius = pointRadius;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', `${x}`);
        circle.setAttribute('cy', `${y}`);
        circle.setAttribute('r', `${radius}`);
        circle.setAttribute('fill', MATRIX_TRAIT_COLORS[event.trait] || '#7c7c7c');
        circle.setAttribute('fill-opacity', `${pointOpacity}`);
        circle.style.cursor = 'pointer';
        circle.addEventListener('mouseenter', () => {
            const dateLabel = formatMatrixDate(event.timestamp);
            tooltip.innerHTML = `
                <div class="tooltip-title">${escapeHtml(event.context)} / ${escapeHtml(event.trait)}</div>
                <div class="tooltip-meta">${dateLabel}・信頼度 ${(confidence * 100).toFixed(0)}%</div>
            `;
            tooltip.classList.add('active');
        });
        circle.addEventListener('mousemove', (e) => {
            const rect = container.getBoundingClientRect();
            const left = e.clientX - rect.left + 12;
            const top = e.clientY - rect.top + 12;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        });
        circle.addEventListener('mouseleave', () => {
            tooltip.classList.remove('active');
        });
        circle.addEventListener('click', () => {
            if (typeof onSelectEvent === 'function') {
                onSelectEvent(event);
            }
        });
        svg.appendChild(circle);
    });

    container.appendChild(svg);
}

function getEmotionPairKey(primary, secondary) {
    const left = String(primary || '').trim();
    const right = String(secondary || '').trim();
    if (!left || !right) return '';
    const order = (a, b) => EMOTION_ORDER.indexOf(a) - EMOTION_ORDER.indexOf(b);
    const [first, second] = [left, right].sort(order);
    return `${first}|${second}`;
}

function getCompoundEmotion(primary, secondary) {
    const key = getEmotionPairKey(primary, secondary);
    if (!key) return '';
    if (COMPOUND_EMOTIONS[key]) return COMPOUND_EMOTIONS[key];
    const reverseKey = `${String(secondary || '').trim()}|${String(primary || '').trim()}`;
    return COMPOUND_EMOTIONS[reverseKey] || '';
}

const PHOTO_PLACEHOLDER_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">' +
    '<rect width="240" height="240" rx="24" fill="#f4e7d8"/>' +
    '<rect x="48" y="64" width="144" height="96" rx="16" fill="#ead8c6" stroke="#d7c0aa" stroke-width="3"/>' +
    '<circle cx="120" cy="112" r="24" fill="#f4e7d8" stroke="#d7c0aa" stroke-width="3"/>' +
    '<text x="120" y="184" font-family="Outfit, Arial, sans-serif" font-size="22" fill="#b39579" text-anchor="middle">NO PHOTO</text>' +
    '</svg>'
);

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

function isAdminUser() {
    const email = appState.user?.email || '';
    return !!email && ADMIN_EMAILS.includes(email);
}

function normalizeQuestionType(value) {
    return value === 'choice' ? 'choice' : 'text';
}

function normalizeQuestionCategory(value) {
    return value === SCREENING_CATEGORY ? SCREENING_CATEGORY : QUESTION_CATEGORY_NORMAL;
}

function normalizeScreeningDimension(value) {
    return value === 'hyperactivity' ? 'hyperactivity' : (value === 'inattention' ? 'inattention' : '');
}

function normalizePersonaLayer(value) {
    const raw = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(PERSONA_LAYER_LABELS, raw) ? raw : '';
}

function normalizePersonaTypeKey(layer, typeKey) {
    return '';
}

function getPersonaLayerLabel(layer) {
    return PERSONA_LAYER_LABELS[normalizePersonaLayer(layer)] || '';
}

function getPersonaTypeLabel(layer, typeKey) {
    return '';
}

function getPersonaLayerDefinition(layerKey) {
    const normalizedLayer = normalizePersonaLayer(layerKey);
    if (!normalizedLayer) return null;
    return PERSONA_LAYER_DEFINITIONS[normalizedLayer] || null;
}

function getPersonaAxisDefinition(axisKey) {
    const target = String(axisKey || '').trim().toLowerCase();
    if (!target) return null;
    for (const layerKey of PERSONA_LAYER_ORDER) {
        const layerDef = PERSONA_LAYER_DEFINITIONS[layerKey];
        if (!layerDef || !Array.isArray(layerDef.axes)) continue;
        const found = layerDef.axes.find((axis) => String(axis.key || '').toLowerCase() === target);
        if (found) return found;
    }
    return null;
}

function isPersonaBaselineQuestion(question) {
    if (!question) return false;
    return question.category === SCREENING_CATEGORY
        && question.instrumentId === SCREENING_INSTRUMENT_PERSONA
        && !!question.isBaseline;
}

function compareQuestionOrder(left, right) {
    const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function getPersonaBaselineFlow() {
    const baselineQuestions = appState.questions
        .filter((question) => isPersonaBaselineQuestion(question) && question.isPublished && question.isActive !== false)
        .sort(compareQuestionOrder);

    const total = baselineQuestions.length;
    if (!total) {
        return {
            total: 0,
            answered: 0,
            currentIndex: 0,
            remainingAfterCurrent: 0,
            layers: [],
            activeLayer: null,
            activeLayerIndex: -1,
            currentLayerQuestionIndex: 0,
            currentLayerRemainingAfterCurrent: 0,
            unansweredInActiveLayer: []
        };
    }

    const answered = baselineQuestions.reduce((count, question) => count + (appState.answersById[question.id] ? 1 : 0), 0);
    const dynamicLayerOrder = [];
    baselineQuestions.forEach((question) => {
        const layer = normalizePersonaLayer(question.layer);
        if (layer && !dynamicLayerOrder.includes(layer)) dynamicLayerOrder.push(layer);
    });
    const orderedLayers = PERSONA_LAYER_ORDER.filter((layer) => dynamicLayerOrder.includes(layer))
        .concat(dynamicLayerOrder.filter((layer) => !PERSONA_LAYER_ORDER.includes(layer)));

    const layers = orderedLayers.map((layer) => {
        const questions = baselineQuestions.filter((question) => normalizePersonaLayer(question.layer) === layer);
        const answeredCount = questions.reduce((count, question) => count + (appState.answersById[question.id] ? 1 : 0), 0);
        const unansweredQuestions = questions.filter((question) => !appState.answersById[question.id]);
        return {
            key: layer,
            label: getPersonaLayerLabel(layer) || layer,
            questions,
            total: questions.length,
            answered: answeredCount,
            unansweredQuestions
        };
    }).filter((layer) => layer.total > 0);

    const activeLayerIndex = layers.findIndex((layer) => layer.answered < layer.total);
    const activeLayer = activeLayerIndex >= 0 ? layers[activeLayerIndex] : null;
    const currentIndex = activeLayer ? Math.min(total, answered + 1) : total;
    const remainingAfterCurrent = activeLayer ? Math.max(0, total - currentIndex) : 0;
    const currentLayerQuestionIndex = activeLayer ? Math.min(activeLayer.total, activeLayer.answered + 1) : 0;
    const currentLayerRemainingAfterCurrent = activeLayer
        ? Math.max(0, activeLayer.total - currentLayerQuestionIndex)
        : 0;

    return {
        total,
        answered,
        currentIndex,
        remainingAfterCurrent,
        layers,
        activeLayer,
        activeLayerIndex,
        currentLayerQuestionIndex,
        currentLayerRemainingAfterCurrent,
        unansweredInActiveLayer: activeLayer ? activeLayer.unansweredQuestions : []
    };
}

function getPersonaBaselineProgress() {
    const flow = getPersonaBaselineFlow();
    return { answered: flow.answered, total: flow.total };
}

function getPersonaBaselineQuestions() {
    return PERSONA_BASELINE_QUESTIONS.map((item) => normalizeQuestionRecord(item.id, {
        title: '5レイヤー基礎診断',
        body: item.body,
        category: SCREENING_CATEGORY,
        type: 'choice',
        options: PERSONA_BASELINE_OPTIONS,
        optionScores: PERSONA_BASELINE_OPTION_SCORES,
        instrumentId: SCREENING_INSTRUMENT_PERSONA,
        dimension: '',
        layer: item.layer,
        typeKey: '',
        axisKey: item.axisKey || '',
        reverseScored: item.reverseScored === true,
        isCore: true,
        isBaseline: true,
        isFixed: true,
        isPublished: true,
        isActive: true,
        order: item.order,
        createdAt: null
    }));
}

function computeLocalPersonaLayerProfile(layerKey) {
    const normalizedLayer = normalizePersonaLayer(layerKey);
    if (!normalizedLayer) return null;
    const layerDef = getPersonaLayerDefinition(normalizedLayer);
    if (!layerDef) return null;
    const layerQuestions = getPersonaBaselineQuestions()
        .filter((question) => normalizePersonaLayer(question.layer) === normalizedLayer);
    if (!layerQuestions.length) return null;

    const axisSamples = {};
    (layerDef.axes || []).forEach((axis) => {
        axisSamples[axis.key] = [];
    });
    let answeredCore = 0;
    layerQuestions.forEach((question) => {
        const answer = appState.answersById[question.id];
        if (!answer) return;
        const likertAnswer = normalizeLikertAnswerFromChoice(
            question,
            answer.choiceScore,
            answer.choiceValue || answer.body || ''
        );
        if (!Number.isFinite(likertAnswer)) return;
        answeredCore += 1;
        const bounded = Math.max(1, Math.min(5, Number(likertAnswer)));
        const oriented = question.reverseScored ? (6 - bounded) : bounded;
        const normalized = ((oriented - 1) / 4) * 100;
        const axisKey = String(question.axisKey || '').trim().toLowerCase();
        if (!axisSamples[axisKey]) axisSamples[axisKey] = [];
        axisSamples[axisKey].push(normalized);
    });

    const axisTable = (layerDef.axes || []).map((axis) => {
        const values = axisSamples[axis.key] || [];
        const avg = values.length
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : 50;
        const score = Math.max(0, Math.min(100, Number(avg)));
        const rightScore = Math.round(score);
        const leftScore = Math.round(100 - score);
        const dominantSide = rightScore >= leftScore ? 'right' : 'left';
        const dominantLabel = dominantSide === 'right' ? axis.right : axis.left;
        const dominantPercent = dominantSide === 'right' ? rightScore : leftScore;
        return {
            axisCode: axis.code,
            axisKey: axis.key,
            label: `${axis.left} ⇄ ${axis.right}`,
            leftLabel: axis.left,
            rightLabel: axis.right,
            score: Number(score.toFixed(1)),
            leftScore,
            rightScore,
            dominantSide,
            dominantLabel,
            dominantPercent,
            answeredItems: values.length
        };
    });
    const answeredAxes = axisTable.filter((axis) => axis.answeredItems > 0).length;
    const totalCore = layerQuestions.length;
    const totalAxes = axisTable.length;
    const completionRate = totalCore > 0 ? (answeredCore / totalCore) : 0;
    return {
        layerLabel: getPersonaLayerLabel(normalizedLayer) || normalizedLayer,
        status: answeredCore >= totalCore && totalCore > 0 ? 'ready' : 'insufficient',
        progress: {
            answeredCore,
            totalCore,
            answeredAxes,
            totalAxes
        },
        confidence0to1: Number(completionRate.toFixed(2)),
        axisTable
    };
}

function getPersonaLayerProfileForUi(layerKey) {
    const normalizedLayer = normalizePersonaLayer(layerKey);
    if (!normalizedLayer) return {};
    const screening = appState.screeningProfile || {};
    const persona5 = screening.persona5 || {};
    const remoteLayers = persona5.layers || {};
    const remoteLayer = remoteLayers[normalizedLayer] || {};
    const localLayer = computeLocalPersonaLayerProfile(normalizedLayer);
    if (!localLayer) return remoteLayer;
    const merged = {
        ...remoteLayer,
        ...localLayer,
        axisTable: Array.isArray(localLayer.axisTable) && localLayer.axisTable.length
            ? localLayer.axisTable
            : (Array.isArray(remoteLayer.axisTable) ? remoteLayer.axisTable : []),
    };
    const progress = merged.progress || {};
    const answeredCore = Number(progress.answeredCore) || 0;
    const totalCore = Number(progress.totalCore) || 0;
    const fullyCompleted = totalCore > 0 && answeredCore >= totalCore && merged.status === 'ready';
    merged.analysis = fullyCompleted ? (remoteLayer.analysis || null) : null;
    return merged;
}

function normalizeOptionScores(value, optionCount = 0) {
    const base = Array.isArray(value) ? value : [];
    const parsed = base.map((n) => Number(n));
    if (parsed.length === optionCount && parsed.every((n) => Number.isFinite(n))) {
        return parsed;
    }
    if (optionCount === 5) return [...SCREENING_OPTION_SCORES];
    if (optionCount <= 1) return [];
    const max = optionCount - 1;
    return Array.from({ length: optionCount }, (_, idx) => Math.round((idx / max) * 4));
}

function getRiskBandFromScore(score) {
    const numeric = Math.max(0, Math.min(100, Number(score) || 0));
    return SCREENING_RISK_BANDS.find((band) => numeric <= band.max) || SCREENING_RISK_BANDS[SCREENING_RISK_BANDS.length - 1];
}

function getQuestionCategoryLabel(category) {
    return category === SCREENING_CATEGORY ? '自己スクリーニング' : '通常お題';
}

function getScreeningDimensionLabel(dimension) {
    if (dimension === 'inattention') return '不注意';
    if (dimension === 'hyperactivity') return '多動・衝動性';
    return '';
}

function getScreeningInstrumentLabel(instrumentId) {
    if (!instrumentId) return '';
    if (instrumentId === SCREENING_INSTRUMENT_ADHD) return 'ADHD成人版';
    if (instrumentId === SCREENING_INSTRUMENT_PERSONA) return '5レイヤー基礎診断';
    return instrumentId;
}

function getScreeningDefaultOptions() {
    return [...SCREENING_DEFAULT_OPTIONS];
}

function ensureQuestionOptionsByCategory(category, options) {
    if (category !== SCREENING_CATEGORY) return options;
    return options.length === SCREENING_DEFAULT_OPTIONS.length ? options : getScreeningDefaultOptions();
}

function normalizeQuestionRecord(id, data) {
    const baselineSeed = PERSONA_BASELINE_QUESTION_MAP[id] || null;
    const category = baselineSeed
        ? SCREENING_CATEGORY
        : normalizeQuestionCategory(data.category || '');
    const typeSource = normalizeQuestionType(data.type || data.questionType || 'text');
    const type = baselineSeed
        ? 'choice'
        : (category === SCREENING_CATEGORY ? 'choice' : typeSource);
    const instrumentId = baselineSeed
        ? SCREENING_INSTRUMENT_PERSONA
        : (category === SCREENING_CATEGORY
            ? String(data.instrumentId || '').trim()
            : '');
    const layer = instrumentId === SCREENING_INSTRUMENT_PERSONA
        ? normalizePersonaLayer(data.layer || baselineSeed?.layer || '')
        : '';
    const typeKey = '';
    const axisKey = instrumentId === SCREENING_INSTRUMENT_PERSONA
        ? String(data.axisKey || baselineSeed?.axisKey || '').trim().toLowerCase()
        : '';
    const reverseScored = instrumentId === SCREENING_INSTRUMENT_PERSONA
        ? (data.reverseScored === true || baselineSeed?.reverseScored === true)
        : false;
    const options = baselineSeed
        ? [...PERSONA_BASELINE_OPTIONS]
        : ensureQuestionOptionsByCategory(
            category,
            normalizeQuestionOptions(data.options || data.choices || [])
        );
    const optionScores = baselineSeed
        ? [...PERSONA_BASELINE_OPTION_SCORES]
        : normalizeOptionScores(data.optionScores, options.length);
    return {
        id,
        title: data.title || (baselineSeed ? '5レイヤー基礎診断' : ''),
        body: data.body || baselineSeed?.body || '',
        category,
        type,
        options,
        optionScores,
        instrumentId,
        dimension: category === SCREENING_CATEGORY
            ? normalizeScreeningDimension(data.dimension || '')
            : '',
        layer,
        typeKey,
        axisKey,
        reverseScored,
        isCore: baselineSeed ? true : (category === SCREENING_CATEGORY ? data.isCore !== false : false),
        isBaseline: baselineSeed ? true : data.isBaseline === true,
        isFixed: baselineSeed ? true : data.isFixed === true,
        order: Number.isFinite(Number(data.order))
            ? Number(data.order)
            : (baselineSeed ? Number(baselineSeed.order || 0) : 0),
        isPublished: baselineSeed ? true : !!data.isPublished,
        isActive: baselineSeed ? true : data.isActive !== false,
        createdAt: data.createdAt || null,
        createdBy: data.createdBy || ''
    };
}

function getChoiceScoreForQuestion(question, choiceValue) {
    if (!question || question.type !== 'choice') return null;
    const value = String(choiceValue || '').trim();
    if (!value) return null;
    const optionIndex = (question.options || []).findIndex((option) => String(option || '').trim() === value);
    if (optionIndex < 0) return null;
    const scoreList = normalizeOptionScores(question.optionScores || [], (question.options || []).length);
    const score = Number(scoreList[optionIndex]);
    return Number.isFinite(score) ? score : null;
}

function getPersonaLayerDocId(layerKey) {
    const normalized = normalizePersonaLayer(layerKey || '');
    if (!normalized) return '';
    return PERSONA_LAYER_DOC_IDS[normalized] || String(normalized).toUpperCase();
}

function isManagedPersonaDraftLayer(layerKey) {
    const normalized = normalizePersonaLayer(layerKey || '');
    return !!normalized && PERSONA_MANAGED_DRAFT_LAYERS.has(normalized);
}

function normalizeLikertAnswerFromChoice(question, choiceScore, choiceValue = '') {
    const numeric = Number(choiceScore);
    if (Number.isFinite(numeric)) {
        if (numeric >= 1 && numeric <= 5) return Math.round(numeric);
        if (numeric >= 0 && numeric <= 4) return Math.round(numeric + 1);
    }
    if (!question || question.type !== 'choice') return null;
    const value = String(choiceValue || '').trim();
    if (!value) return null;
    const optionIndex = (question.options || []).findIndex((option) => String(option || '').trim() === value);
    if (optionIndex < 0) return null;
    // options are [1..5] from "まったく当てはまらない" to "非常に当てはまる"
    return optionIndex + 1;
}

function getLayerBaselineQuestions(layerKey) {
    const normalized = normalizePersonaLayer(layerKey || '');
    if (!normalized) return [];
    return getPersonaBaselineQuestions().filter((question) => normalizePersonaLayer(question.layer) === normalized);
}

function getLayerDraftDocId(layerKey) {
    const docLayerId = getPersonaLayerDocId(layerKey);
    if (!docLayerId) return '';
    return `${PERSONA_DIAGNOSIS_VERSION_ID}_${docLayerId}`;
}

function shuffleArrayFisherYates(source) {
    const list = Array.isArray(source) ? source.slice() : [];
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

async function syncManagedDiagnosisVersionDocs() {
    const db = window.db;
    if (!db) return;
    const versionRef = db.collection('diagnosis_versions').doc(PERSONA_DIAGNOSIS_VERSION_ID);
    for (const layerKey of PERSONA_MANAGED_DRAFT_LAYERS) {
        const layerDocId = getPersonaLayerDocId(layerKey);
        const layerDef = PERSONA_LAYER_DEFINITIONS[layerKey];
        const bank = PERSONA_FIXED_LAYER_BANKS[layerKey];
        if (!layerDocId || !layerDef || !Array.isArray(bank) || !bank.length) continue;
        const layerRef = versionRef.collection('layers').doc(layerDocId);
        try {
            const layerSnap = await layerRef.get();
            if (layerSnap.exists) {
                const data = layerSnap.data() || {};
                if (Array.isArray(data.questions) && data.questions.length) {
                    applyLayerQuestionsToBaseline(layerKey, data.questions);
                }
                continue;
            }
            if (!isAdminUser()) continue;
            const axes = (layerDef.axes || []).map((axis) => ({
                axisId: axis.code,
                axisKey: axis.key,
                left: axis.left,
                right: axis.right
            }));
            const questions = bank.map((item) => ({
                id: item.id,
                text: item.body,
                axisId: item.axisCode,
                reverse: item.reverseScored === true
            }));
            await versionRef.set({
                versionId: PERSONA_DIAGNOSIS_VERSION_ID,
                updatedAt: getServerTimestamp()
            }, { merge: true });
            await layerRef.set({
                layerId: layerDocId,
                axes,
                questions,
                updatedAt: getServerTimestamp()
            }, { merge: true });
        } catch (err) {
            console.warn(`[persona] failed to sync ${layerDocId} diagnosis version`, err);
        }
    }
}

async function ensureLayerDraft(layerKey, questionPool = []) {
    const layer = normalizePersonaLayer(layerKey || '');
    const db = window.db;
    if (!db || !appState.user || !layer || !isManagedPersonaDraftLayer(layer)) return null;
    const docId = getLayerDraftDocId(layer);
    if (!docId) return null;
    const draftRef = db.collection('users').doc(appState.user.uid).collection('layer_drafts').doc(docId);
    const validIds = (Array.isArray(questionPool) ? questionPool : getLayerBaselineQuestions(layer))
        .map((question) => question.id);
    if (!validIds.length) return null;

    const isPermissionDeniedError = (err) => {
        const raw = String(err && (err.code || err.message || '')).toLowerCase();
        return raw.includes('permission-denied') || raw.includes('insufficient permissions') || raw.includes('permission');
    };

    const localDraft = appState.layerDrafts[layer] || {};
    let snapshot = null;
    if (!personaDraftSyncUnavailable) {
        try {
            snapshot = await draftRef.get();
        } catch (err) {
            if (isPermissionDeniedError(err)) {
                personaDraftSyncUnavailable = true;
            } else {
                console.warn(`[persona] failed to load ${layer} draft`, err);
            }
        }
    }

    let stored = snapshot?.exists ? (snapshot.data() || {}) : {
        questionOrder: Array.isArray(localDraft.questionOrder) ? localDraft.questionOrder : [],
        answers: localDraft.answers && typeof localDraft.answers === 'object' ? { ...localDraft.answers } : {}
    };
    let questionOrder = Array.isArray(stored.questionOrder) ? stored.questionOrder.filter((id) => validIds.includes(id)) : [];
    const missing = validIds.filter((id) => !questionOrder.includes(id));
    if (!questionOrder.length || missing.length) {
        questionOrder = shuffleArrayFisherYates(validIds);
        stored = {
            ...stored,
            questionOrder,
            answers: stored.answers && typeof stored.answers === 'object' ? stored.answers : {}
        };
        if (!personaDraftSyncUnavailable) {
            try {
                await draftRef.set({
                    layerId: getPersonaLayerDocId(layer),
                    versionId: PERSONA_DIAGNOSIS_VERSION_ID,
                    questionOrder,
                    answers: stored.answers || {},
                    updatedAt: getServerTimestamp()
                }, { merge: true });
            } catch (err) {
                if (isPermissionDeniedError(err)) {
                    personaDraftSyncUnavailable = true;
                } else {
                    console.warn(`[persona] failed to create ${layer} draft`, err);
                }
            }
        }
    }

    appState.layerDrafts[layer] = {
        docId,
        questionOrder,
        answers: stored.answers && typeof stored.answers === 'object' ? { ...stored.answers } : {}
    };
    return appState.layerDrafts[layer];
}

async function saveLayerDraftAnswer(layerKey, questionId, answerValue) {
    const layer = normalizePersonaLayer(layerKey || '');
    const db = window.db;
    if (!db || !appState.user || !questionId || !layer || !isManagedPersonaDraftLayer(layer)) return;
    const normalized = Math.max(1, Math.min(5, Math.round(Number(answerValue) || 0)));
    if (!Number.isFinite(normalized)) return;
    const draft = appState.layerDrafts[layer] || { docId: getLayerDraftDocId(layer), questionOrder: [], answers: {} };
    draft.answers = {
        ...(draft.answers || {}),
        [questionId]: normalized
    };
    appState.layerDrafts[layer] = draft;

    if (personaDraftSyncUnavailable) return;
    const draftRef = db.collection('users').doc(appState.user.uid).collection('layer_drafts').doc(getLayerDraftDocId(layer));
    try {
        await draftRef.set({
            layerId: getPersonaLayerDocId(layer),
            versionId: PERSONA_DIAGNOSIS_VERSION_ID,
            questionOrder: Array.isArray(draft.questionOrder) ? draft.questionOrder : [],
            answers: draft.answers,
            updatedAt: getServerTimestamp()
        }, { merge: true });
    } catch (err) {
        const raw = String(err && (err.code || err.message || '')).toLowerCase();
        if (raw.includes('permission-denied') || raw.includes('insufficient permissions') || raw.includes('permission')) {
            personaDraftSyncUnavailable = true;
            return;
        }
        console.warn(`[persona] failed to save ${layer} draft answer`, err);
    }
}

function classifyAxisStrength(score) {
    const value = Math.max(0, Math.min(100, Number(score) || 0));
    if (value <= 24) return 'strong_left';
    if (value <= 39) return 'mild_left';
    if (value <= 59) return 'neutral';
    if (value <= 74) return 'mild_right';
    return 'strong_right';
}

function computeLayerAxisScoresForResult(layerKey, answersMap = {}) {
    const layer = normalizePersonaLayer(layerKey || '');
    if (!layer) return {};
    const layerDef = PERSONA_LAYER_DEFINITIONS[layer];
    const questions = getLayerBaselineQuestions(layer);
    const axisBuckets = {};
    (layerDef?.axes || []).forEach((axis) => {
        axisBuckets[axis.code] = [];
    });
    questions.forEach((question) => {
        const axis = (layerDef?.axes || []).find((item) => item.key === String(question.axisKey || '').toLowerCase());
        if (!axis) return;
        const answer = Number(answersMap[question.id]);
        if (!Number.isFinite(answer)) return;
        const bounded = Math.max(1, Math.min(5, Math.round(answer)));
        const oriented = question.reverseScored ? (6 - bounded) : bounded;
        axisBuckets[axis.code].push(oriented);
    });

    const axisScores = {};
    (layerDef?.axes || []).forEach((axis) => {
        const samples = axisBuckets[axis.code] || [];
        const avg = samples.length
            ? samples.reduce((sum, value) => sum + value, 0) / samples.length
            : 0;
        const normalized = samples.length
            ? ((avg - 1) / 4) * 100
            : 0;
        axisScores[axis.code] = {
            axisId: axis.code,
            axisKey: axis.key,
            leftLabel: axis.left,
            rightLabel: axis.right,
            avg1to5: Number(avg.toFixed(3)),
            score0to100: Number(Math.max(0, Math.min(100, normalized)).toFixed(1)),
            strength: classifyAxisStrength(normalized),
            answeredItems: samples.length
        };
    });
    return axisScores;
}

async function saveLayerResult(layerKey) {
    const layer = normalizePersonaLayer(layerKey || '');
    const db = window.db;
    if (!db || !appState.user || !layer || !isManagedPersonaDraftLayer(layer)) return;
    const questions = getLayerBaselineQuestions(layer);
    if (!questions.length) return;
    const answers = {};
    questions.forEach((question) => {
        const answerRecord = appState.answersById[question.id];
        const value = normalizeLikertAnswerFromChoice(question, answerRecord?.choiceScore, answerRecord?.choiceValue || answerRecord?.body || '');
        if (Number.isFinite(value)) {
            answers[question.id] = value;
        }
    });
    if (Object.keys(answers).length < questions.length) return;

    const axisScores = computeLayerAxisScoresForResult(layer, answers);
    const resultId = `${getPersonaLayerDocId(layer)}_${Date.now()}`;
    const resultRef = db.collection('users').doc(appState.user.uid).collection('layer_results').doc(resultId);
    await resultRef.set({
        layerId: getPersonaLayerDocId(layer),
        versionId: PERSONA_DIAGNOSIS_VERSION_ID,
        answers,
        axisScores,
        completedAt: getServerTimestamp()
    }, { merge: true });

    const draftRef = db.collection('users').doc(appState.user.uid).collection('layer_drafts').doc(getLayerDraftDocId(layer));
    try {
        await draftRef.delete();
    } catch (_err) {
        // ignore if no draft
    }
    delete appState.layerDrafts[layer];
}

function normalizeAnswerRecord(docId, data, question) {
    const fallbackType = data.choiceValue ? 'choice' : 'text';
    const answerType = normalizeQuestionType(data.answerType || question?.type || fallbackType);
    const category = normalizeQuestionCategory(data.category || question?.category || QUESTION_CATEGORY_NORMAL);
    const choiceValue = answerType === 'choice'
        ? String(data.choiceValue || data.body || '').trim()
        : '';
    const rawScore = Number(data.choiceScore);
    const choiceScore = Number.isFinite(rawScore)
        ? rawScore
        : getChoiceScoreForQuestion(question, choiceValue);
    const likertAnswer = isManagedPersonaDraftLayer(data.layer || question?.layer || '')
        ? normalizeLikertAnswerFromChoice(question, choiceScore, choiceValue)
        : null;
    return {
        id: docId,
        questionId: data.questionId || '',
        userId: data.userId || data.user_id || '',
        category,
        instrumentId: String(data.instrumentId || question?.instrumentId || '').trim(),
        dimension: normalizeScreeningDimension(data.dimension || question?.dimension || ''),
        layer: normalizePersonaLayer(data.layer || question?.layer || ''),
        typeKey: normalizePersonaTypeKey(data.layer || question?.layer || '', data.typeKey || question?.typeKey || ''),
        axisKey: String(data.axisKey || question?.axisKey || '').trim(),
        reverseScored: data.reverseScored === true || question?.reverseScored === true,
        body: data.body || '',
        answerType,
        choiceValue,
        choiceScore: Number.isFinite(choiceScore) ? choiceScore : null,
        likertAnswer: Number.isFinite(likertAnswer) ? likertAnswer : null,
        scoredAt: data.scoredAt || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        pendingAnalysis: data.pendingAnalysis !== false
    };
}

function normalizeQuestionOptions(value) {
    if (!value) return [];
    const list = Array.isArray(value) ? value : String(value).split('\n');
    return list
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function parseQuestionOptionsInput(value) {
    const seen = new Set();
    return normalizeQuestionOptions(value).filter((option) => {
        if (seen.has(option)) return false;
        seen.add(option);
        return true;
    });
}

function getAnswerDisplayText(answer) {
    if (!answer) return '';
    if (answer.answerType === 'choice') {
        return answer.choiceValue || answer.body || '';
    }
    return answer.body || '';
}

// --- Init & Load ---
function init() {
    renderThemePicker();
    applyTheme(appState.theme);
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme !== appState.theme) {
        localStorage.setItem('theme', appState.theme);
    }

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
                loadQuestionsAndAnswers();
                const profileName = getProfileDisplayName();
                const welcomeName = profileName && profileName !== 'あなた' ? profileName : '';
                showToast(welcomeName ? `ようこそ、${welcomeName}さん` : 'ログインしました');
            } else {
                appState.user = null;
                appState.entries = [];
                appState.userProfile = {};
                appState.userProfileLoaded = false;
                appState.friendState = null;
                appState.friendRequestsLoaded = false;
                appState.friendSchedulesByDate = {};
                appState.questions = [];
                appState.answers = [];
                appState.answersById = {};
                appState.currentQuestionId = null;
                appState.screeningProfile = null;
                appState.screeningLoading = false;
                appState.screeningError = '';
                applyWallpaper('');
                updateAuthUI(false);
                renderEntryList();
                loadQuestionsAndAnswers();
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
    if (dom.modalSettings) {
        dom.modalSettings.addEventListener('click', (event) => {
            if (event.target === dom.modalSettings) closeSettingsModal();
        });
    }
    if (dom.btnAppPasswordClose) {
        dom.btnAppPasswordClose.addEventListener('click', closeAppPasswordModal);
    }
    if (dom.btnAppPasswordCancel) {
        dom.btnAppPasswordCancel.addEventListener('click', closeAppPasswordModal);
    }
    if (dom.btnAppPasswordSave) {
        dom.btnAppPasswordSave.addEventListener('click', saveAppPassword);
    }
    if (dom.btnAppPasswordRemove) {
        dom.btnAppPasswordRemove.addEventListener('click', removeAppPassword);
    }
    if (dom.modalAppPassword) {
        dom.modalAppPassword.addEventListener('click', (event) => {
            if (event.target === dom.modalAppPassword) closeAppPasswordModal();
        });
    }
    if (dom.btnUpdatePass) {
        dom.btnUpdatePass.addEventListener('click', handleUpdatePassword);
    }
    if (dom.btnForgotPassSettings) {
        dom.btnForgotPassSettings.addEventListener('click', handleForgotPassword);
    }
    if (dom.themePicker) {
        dom.themePicker.addEventListener('click', (event) => {
            const target = event.target.closest('.theme-option');
            if (!target) return;
            setTheme(target.dataset.theme || '');
        });
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
    if (dom.imagePreviewContainer) {
        dom.imagePreviewContainer.addEventListener('click', () => {
            openPhotoModal();
        });
    }
    if (dom.btnPhotoClose) {
        dom.btnPhotoClose.addEventListener('click', closePhotoModal);
    }
    if (dom.btnPhotoChange) {
        dom.btnPhotoChange.addEventListener('click', () => {
            closePhotoModal();
            if (dom.entryImageInput) dom.entryImageInput.click();
        });
    }
    if (dom.btnPhotoDelete) {
        dom.btnPhotoDelete.addEventListener('click', () => {
            clearPhotoPreview(isEditorEditable());
            closePhotoModal();
        });
    }
    if (dom.modalPhoto) {
        dom.modalPhoto.addEventListener('click', (event) => {
            if (event.target === dom.modalPhoto) closePhotoModal();
        });
    }
    if (dom.btnSleep) {
        dom.btnSleep.addEventListener('click', (event) => openDurationPicker('sleep', event.currentTarget));
    }
    if (dom.btnSleepClose) {
        dom.btnSleepClose.addEventListener('click', closeSleepModal);
    }
    if (dom.modalSleep) {
        dom.modalSleep.addEventListener('click', (event) => {
            if (event.target === dom.modalSleep) closeSleepModal();
        });
    }
    if (dom.sleepOptions) {
        dom.sleepOptions.addEventListener('click', (event) => {
            const target = event.target.closest('button[data-value]');
            if (!target) return;
            event.preventDefault();
            setSleepValue(target.dataset.value || '');
        });
    }
    if (dom.btnWeight) {
        dom.btnWeight.addEventListener('click', () => openWeightModal());
    }
    if (dom.btnWeightConfirm) {
        dom.btnWeightConfirm.addEventListener('click', () => applyWeightValue());
    }
    if (dom.btnWeightCancel) {
        dom.btnWeightCancel.addEventListener('click', closeWeightModal);
    }
    if (dom.btnWeightClose) {
        dom.btnWeightClose.addEventListener('click', closeWeightModal);
    }
    if (dom.btnFocus) {
        dom.btnFocus.addEventListener('click', (event) => openDurationPicker('focus', event.currentTarget));
    }
    if (dom.btnWorkout) {
        dom.btnWorkout.addEventListener('click', (event) => openDurationPicker('workout', event.currentTarget));
    }
    if (dom.btnSummaryEmotion) {
        dom.btnSummaryEmotion.addEventListener('click', () => {
            handleSummaryLabelClick('emotion');
        });
    }
    const summaryLabelButtons = document.querySelectorAll('.summary-label-btn');
    summaryLabelButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.target || '';
            handleSummaryLabelClick(target);
        });
    });
    if (dom.modalWeight) {
        dom.modalWeight.addEventListener('click', (event) => {
            if (event.target === dom.modalWeight) closeWeightModal();
        });
    }
    if (dom.btnSatisfaction) {
        dom.btnSatisfaction.addEventListener('click', () => openSatisfactionModal());
    }
    if (dom.btnSatisfactionClose) {
        dom.btnSatisfactionClose.addEventListener('click', closeSatisfactionModal);
    }
    if (dom.modalSatisfaction) {
        dom.modalSatisfaction.addEventListener('click', (event) => {
            if (event.target === dom.modalSatisfaction) closeSatisfactionModal();
        });
    }
    if (dom.satisfactionOptions) {
        dom.satisfactionOptions.addEventListener('click', (event) => {
            const target = event.target.closest('button[data-value]');
            if (!target) return;
            event.preventDefault();
            setSatisfactionValue(target.dataset.value || '');
        });
    }
    if (dom.btnDurationConfirm) {
        dom.btnDurationConfirm.addEventListener('click', (event) => {
            event.preventDefault();
            applyDurationSelection();
        });
    }
    if (dom.btnDurationCancel) {
        dom.btnDurationCancel.addEventListener('click', (event) => {
            event.preventDefault();
            closeDurationPicker();
        });
    }
    if (dom.btnDurationClose) {
        dom.btnDurationClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeDurationPicker();
        });
    }
    if (dom.modalDuration) {
        dom.modalDuration.addEventListener('click', (event) => {
            if (event.target === dom.modalDuration) closeDurationPicker();
        });
    }
    if (dom.btnScheduleTimeConfirm) {
        dom.btnScheduleTimeConfirm.addEventListener('click', (event) => {
            event.preventDefault();
            applyScheduleTimeSelection();
        });
    }
    if (dom.btnScheduleTimeCancel) {
        dom.btnScheduleTimeCancel.addEventListener('click', (event) => {
            event.preventDefault();
            closeScheduleTimePicker();
        });
    }
    if (dom.btnScheduleTimeClose) {
        dom.btnScheduleTimeClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeScheduleTimePicker();
        });
    }
    if (dom.btnScheduleAllDay) {
        dom.btnScheduleAllDay.addEventListener('click', (event) => {
            event.preventDefault();
            if (!scheduleTimeState) return;
            setScheduleAllDay(!scheduleTimeState.allDay);
        });
    }
    if (dom.modalScheduleTime) {
        dom.modalScheduleTime.addEventListener('click', (event) => {
            if (event.target === dom.modalScheduleTime) {
                closeScheduleTimePicker();
            }
        });
    }
    if (dom.inputSchedule) {
        dom.inputSchedule.addEventListener('click', (event) => {
            const timeBtn = event.target.closest('.schedule-time-btn');
            if (timeBtn) {
                event.preventDefault();
                const row = timeBtn.closest('.schedule-row');
                if (row) openScheduleTimePicker(row, timeBtn);
                return;
            }
            const removeBtn = event.target.closest('.schedule-remove-btn');
            if (removeBtn) {
                event.preventDefault();
                const row = removeBtn.closest('.schedule-row');
                if (!row) return;
                const rows = Array.from(dom.inputSchedule.querySelectorAll('.schedule-row'));
                const index = rows.indexOf(row);
                const items = collectScheduleRowsRaw();
                if (index >= 0) {
                    items.splice(index, 1);
                }
                renderScheduleRows(items);
                return;
            }
            const addBtn = event.target.closest('.schedule-add-btn');
            if (!addBtn) return;
            event.preventDefault();
            const items = collectScheduleRowsRaw();
            items.push({ start: '', end: '', title: '' });
            renderScheduleRows(items);
        });
    }
    if (dom.inputLocationSearch) {
        dom.inputLocationSearch.addEventListener('input', handleLocationSearchInput);
        dom.inputLocationSearch.addEventListener('focus', () => {
            if (dom.locationSuggestions && dom.locationSuggestions.childElementCount > 0) {
                dom.locationSuggestions.classList.remove('hidden');
            }
        });
    }
    if (dom.locationSuggestions) {
        dom.locationSuggestions.addEventListener('click', (event) => {
            const target = event.target.closest('button[data-lat]');
            if (!target) return;
            event.preventDefault();
            selectLocationSuggestion(target.dataset);
        });
    }
    if (dom.inputLocationSearchModal) {
        dom.inputLocationSearchModal.addEventListener('input', handleLocationSearchInputModal);
        dom.inputLocationSearchModal.addEventListener('focus', () => {
            if (dom.locationSuggestionsModal && dom.locationSuggestionsModal.childElementCount > 0) {
                dom.locationSuggestionsModal.classList.remove('hidden');
            }
        });
    }
    if (dom.locationSuggestionsModal) {
        dom.locationSuggestionsModal.addEventListener('click', (event) => {
            const target = event.target.closest('button[data-lat]');
            if (!target) return;
            event.preventDefault();
            selectLocationSuggestion(target.dataset, true);
        });
    }
    if (dom.locationPreview) {
        dom.locationPreview.addEventListener('click', (event) => {
            if (dom.locationPreview.classList.contains('hidden')) return;
            event.preventDefault();
            openLocationPicker();
        });
    }
    const locationSlots = getLocationSlots();
    if (locationSlots.length) {
        locationSlots.forEach((slot, index) => {
            slot.addEventListener('click', (event) => {
                event.preventDefault();
                activeLocationSlotIndex = index;
                syncLocationInputsFromSlot(index);
                openLocationPicker();
            });
        });
    }
    document.addEventListener('click', (event) => {
        if (dom.locationSuggestions && dom.inputLocationSearch) {
            if (!dom.locationSuggestions.contains(event.target) && !dom.inputLocationSearch.contains(event.target)) {
                clearLocationSuggestions(dom.locationSuggestions);
            }
        }
        if (dom.locationSuggestionsModal && dom.inputLocationSearchModal) {
            if (!dom.locationSuggestionsModal.contains(event.target) && !dom.inputLocationSearchModal.contains(event.target)) {
                clearLocationSuggestions(dom.locationSuggestionsModal);
            }
        }
    });
    if (dom.btnLocationConfirm) {
        dom.btnLocationConfirm.addEventListener('click', confirmLocationPicker);
    }
    if (dom.btnLocationCancel) {
        dom.btnLocationCancel.addEventListener('click', closeLocationPicker);
    }
    if (dom.btnLocationClose) {
        dom.btnLocationClose.addEventListener('click', closeLocationPicker);
    }
    if (dom.modalLocation) {
        dom.modalLocation.addEventListener('click', (event) => {
            if (event.target === dom.modalLocation) closeLocationPicker();
        });
    }
    if (dom.btnEmotionConfirm) {
        dom.btnEmotionConfirm.addEventListener('click', applyEmotionPickerSelection);
    }
    if (dom.btnEmotionCancel) {
        dom.btnEmotionCancel.addEventListener('click', closeEmotionPicker);
    }
    if (dom.btnEmotionClose) {
        dom.btnEmotionClose.addEventListener('click', closeEmotionPicker);
    }
    if (dom.modalEmotion) {
        dom.modalEmotion.addEventListener('click', (event) => {
            if (event.target === dom.modalEmotion) closeEmotionPicker();
        });
    }
    if (dom.inputSatisfaction) {
        updateSatisfactionButton();
    }
    if (dom.btnPrevMonth) {
        dom.btnPrevMonth.addEventListener('click', () => {
            changeCalendarMonth(-1);
        });
    }
    if (dom.btnNextMonth) {
        dom.btnNextMonth.addEventListener('click', () => {
            changeCalendarMonth(1);
        });
    }
    if (dom.btnCalendarToday) {
        dom.btnCalendarToday.addEventListener('click', () => {
            const today = new Date();
            appState.calendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
            appState.calendarSelectedDate = today;
            renderCalendar();
        });
    }
    if (dom.calendarTitleBtn) {
        dom.calendarTitleBtn.addEventListener('click', openCalendarPicker);
    }
    if (dom.calendarPickerClose) {
        dom.calendarPickerClose.addEventListener('click', closeCalendarPicker);
    }
    if (dom.calendarPickerDone) {
        dom.calendarPickerDone.addEventListener('click', closeCalendarPicker);
    }
    if (dom.calendarPickerModal) {
        dom.calendarPickerModal.addEventListener('click', (event) => {
            if (event.target === dom.calendarPickerModal) closeCalendarPicker();
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
    if (dom.calendarSideText) {
        dom.calendarSideText.addEventListener('input', () => {
            queueCalendarMemoSave();
        });
    }
    if (dom.btnCalendarAddSchedule) {
        dom.btnCalendarAddSchedule.addEventListener('click', () => {
            if (!appState.user) {
                showToast('ログインしてください', 'error');
                return;
            }
            const items = collectCalendarScheduleRowsRaw();
            items.push({ start: '', end: '', title: '' });
            renderCalendarScheduleRows(items);
            const rows = dom.calendarScheduleList ? dom.calendarScheduleList.querySelectorAll('.schedule-row') : [];
            const lastRow = rows.length ? rows[rows.length - 1] : null;
            const titleInput = lastRow ? lastRow.querySelector('[data-role="title"]') : null;
            if (titleInput) titleInput.focus();
        });
    }
    if (dom.calendarScheduleList) {
        dom.calendarScheduleList.addEventListener('click', (event) => {
            if (!appState.user) return;
            const shareBtn = event.target.closest('[data-role="share-btn"]');
            if (shareBtn) {
                event.preventDefault();
                const row = shareBtn.closest('.schedule-row');
                const rowIndex = row ? Number(row.dataset.index) : -1;
                if (Number.isFinite(rowIndex) && rowIndex >= 0) {
                    openCalendarShareModalForRow(rowIndex);
                }
                return;
            }
            const timeBtn = event.target.closest('.schedule-time-btn');
            if (timeBtn) {
                event.preventDefault();
                const row = timeBtn.closest('.schedule-row');
                if (row) openScheduleTimePicker(row, timeBtn);
                return;
            }
            const removeBtn = event.target.closest('.schedule-remove-btn');
            if (removeBtn) {
                event.preventDefault();
                const row = removeBtn.closest('.schedule-row');
                if (!row) return;
                const rows = Array.from(dom.calendarScheduleList.querySelectorAll('.schedule-row'));
                const index = rows.indexOf(row);
                const items = collectCalendarScheduleRowsRaw();
                if (index >= 0) items.splice(index, 1);
                renderCalendarScheduleRows(items);
                queueCalendarScheduleSave();
            }
        });
        dom.calendarScheduleList.addEventListener('input', (event) => {
            if (!appState.user) return;
            if (event.target.closest('[data-role="title"]')) {
                queueCalendarScheduleSave();
            }
        });
    }
    if (dom.shareModalClose) {
        dom.shareModalClose.addEventListener('click', closeCalendarShareModal);
    }
    if (dom.modalScheduleShare) {
        dom.modalScheduleShare.addEventListener('click', (event) => {
            if (event.target === dom.modalScheduleShare) closeCalendarShareModal();
        });
    }
    if (dom.shareListShared) {
        dom.shareListShared.addEventListener('click', handleShareModalToggle);
    }
    if (dom.shareListUnshared) {
        dom.shareListUnshared.addEventListener('click', handleShareModalToggle);
    }
    if (dom.btnShareSave) {
        dom.btnShareSave.addEventListener('click', () => {
            applyCalendarShareChanges();
        });
    }
    if (dom.btnFriendIdClose) {
        dom.btnFriendIdClose.addEventListener('click', closeFriendIdModal);
    }
    if (dom.modalFriendId) {
        dom.modalFriendId.addEventListener('click', (event) => {
            if (event.target === dom.modalFriendId) closeFriendIdModal();
        });
    }
    if (dom.btnFriendIdSearch) {
        dom.btnFriendIdSearch.addEventListener('click', () => {
            searchFriendById();
        });
    }
    if (dom.inputFriendId) {
        dom.inputFriendId.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                searchFriendById();
            }
        });
    }
    if (dom.btnFriendRequest) {
        dom.btnFriendRequest.addEventListener('click', () => {
            requestFriendById();
        });
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
    if (dom.btnResetLayout) {
        dom.btnResetLayout.addEventListener('click', resetJournalLayoutToDefault);
    }
    if (dom.btnQuestionsModePersona) dom.btnQuestionsModePersona.textContent = '5レイヤー診断';
    if (dom.btnQuestionsModeAnswer) dom.btnQuestionsModeAnswer.textContent = 'その他お題';
    if (dom.btnQuestionsModeHistory) dom.btnQuestionsModeHistory.textContent = '回答一覧';
    if (dom.btnQuestionsModePersona) {
        dom.btnQuestionsModePersona.addEventListener('click', () => setQuestionsViewMode('persona'));
    }
    if (dom.btnQuestionsModeAnswer) {
        dom.btnQuestionsModeAnswer.addEventListener('click', () => setQuestionsViewMode('answer'));
    }
    if (dom.btnQuestionsModeHistory) {
        dom.btnQuestionsModeHistory.addEventListener('click', () => setQuestionsViewMode('history'));
    }
    if (dom.questionChoiceArea) {
        dom.questionChoiceArea.addEventListener('click', async (event) => {
            const optionButton = event.target.closest('[data-choice-value]');
            if (!optionButton) return;
            const selectedValue = optionButton.dataset.choiceValue || '';
            appState.currentQuestionChoice = selectedValue;
            renderQuestionChoiceOptions();
            if (appState.questionsViewMode === 'persona') {
                await savePersonaChoiceImmediately(selectedValue);
            }
        });
    }
    if (dom.answersList) {
        dom.answersList.addEventListener('click', (event) => {
            const card = event.target.closest('.answer-card');
            if (!card) return;
            const answerId = card.dataset.answerId || '';
            const answer = appState.answers.find((item) => item.id === answerId);
            if (answer) openAnswerDetailModal(answer);
        });
    }
    if (dom.btnSaveAnswer) {
        dom.btnSaveAnswer.addEventListener('click', () => openAnswerConfirmModal());
    }
    if (dom.btnPersonaPrevQuestion) {
        dom.btnPersonaPrevQuestion.addEventListener('click', () => movePersonaQuestionPrev());
    }
    if (dom.btnPersonaCloseSession) {
        dom.btnPersonaCloseSession.addEventListener('click', () => {
            void closePersonaSessionByUser();
        });
    }
    if (dom.btnQuestionRefresh) {
        dom.btnQuestionRefresh.addEventListener('click', () => refreshCurrentQuestion());
    }
    if (dom.btnQuestionAdmin) {
        dom.btnQuestionAdmin.addEventListener('click', openQuestionAdminModal);
    }
    if (dom.btnQuestionAdminClose) {
        dom.btnQuestionAdminClose.addEventListener('click', closeQuestionAdminModal);
    }
    if (dom.btnQuestionCreateSave) {
        dom.btnQuestionCreateSave.addEventListener('click', saveQuestionFromModal);
    }
    if (dom.questionTypeInput) {
        dom.questionTypeInput.addEventListener('change', () => {
            syncQuestionComposerState();
        });
    }
    if (dom.questionCategoryInput) {
        dom.questionCategoryInput.addEventListener('change', () => {
            syncQuestionComposerState();
        });
    }
    if (dom.modalQuestionAdmin) {
        dom.modalQuestionAdmin.addEventListener('click', (event) => {
            if (event.target === dom.modalQuestionAdmin) closeQuestionAdminModal();
        });
    }
    if (dom.adminTabNew) {
        dom.adminTabNew.addEventListener('click', () => setQuestionAdminTab('new'));
    }
    if (dom.adminTabManage) {
        dom.adminTabManage.addEventListener('click', () => setQuestionAdminTab('manage'));
    }
    if (dom.adminTabDeleted) {
        dom.adminTabDeleted.addEventListener('click', () => setQuestionAdminTab('deleted'));
    }
    if (dom.questionManageGrid) {
        dom.questionManageGrid.addEventListener('click', (event) => {
            const card = event.target.closest('.question-manage-card');
            if (!card) return;
            const questionId = card.dataset.questionId || '';
            if (questionId) openQuestionEditModal(questionId);
        });
    }
    if (dom.questionManageDeletedGrid) {
        dom.questionManageDeletedGrid.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            const card = event.target.closest('.question-manage-card');
            if (!card) return;
            const questionId = card.dataset.questionId || '';
            if (!questionId) return;
            if (!button) return;
            const action = button.dataset.action || '';
            if (action === 'restore') {
                restoreQuestion(questionId);
            } else if (action === 'delete') {
                hardDeleteQuestion(questionId);
            }
        });
    }
    if (dom.btnQuestionEditClose) {
        dom.btnQuestionEditClose.addEventListener('click', closeQuestionEditModal);
    }
    if (dom.questionEditType) {
        dom.questionEditType.addEventListener('change', () => {
            syncQuestionEditState();
        });
    }
    if (dom.questionEditCategory) {
        dom.questionEditCategory.addEventListener('change', () => {
            syncQuestionEditState();
        });
    }
    if (dom.btnQuestionEditSave) {
        dom.btnQuestionEditSave.addEventListener('click', saveQuestionEdit);
    }
    if (dom.btnQuestionDelete) {
        dom.btnQuestionDelete.addEventListener('click', softDeleteQuestion);
    }
    if (dom.btnAnswerConfirmClose) {
        dom.btnAnswerConfirmClose.addEventListener('click', closeAnswerConfirmModal);
    }
    if (dom.btnAnswerConfirmCancel) {
        dom.btnAnswerConfirmCancel.addEventListener('click', closeAnswerConfirmModal);
    }
    if (dom.btnAnswerConfirmSend) {
        dom.btnAnswerConfirmSend.addEventListener('click', commitAnswerSave);
    }
    if (dom.btnAnswerEditClose) {
        dom.btnAnswerEditClose.addEventListener('click', closeAnswerEditModal);
    }
    if (dom.btnAnswerEditSave) {
        dom.btnAnswerEditSave.addEventListener('click', saveAnswerEdit);
    }
    if (dom.btnAnswerDeleteClose) {
        dom.btnAnswerDeleteClose.addEventListener('click', closeAnswerDeleteConfirm);
    }
    if (dom.btnAnswerDeleteCancel) {
        dom.btnAnswerDeleteCancel.addEventListener('click', closeAnswerDeleteConfirm);
    }
    if (dom.btnAnswerDeleteConfirm) {
        dom.btnAnswerDeleteConfirm.addEventListener('click', deleteAnswer);
    }
    if (dom.modalQuestionEdit) {
        dom.modalQuestionEdit.addEventListener('click', (event) => {
            if (event.target === dom.modalQuestionEdit) closeQuestionEditModal();
        });
    }
    if (dom.btnAnswerDetailClose) {
        dom.btnAnswerDetailClose.addEventListener('click', closeAnswerDetailModal);
    }
    if (dom.btnAnswerDetailEdit) {
        dom.btnAnswerDetailEdit.addEventListener('click', () => {
            if (!appState.detailAnswerId) return;
            openAnswerEditConfirm(appState.detailAnswerId);
        });
    }
    if (dom.btnAnswerDetailDelete) {
        dom.btnAnswerDetailDelete.addEventListener('click', () => {
            if (!appState.detailAnswerId) return;
            closeAnswerDetailModal();
            openAnswerDeleteConfirm(appState.detailAnswerId);
        });
    }
    if (dom.modalAnswerDetail) {
        dom.modalAnswerDetail.addEventListener('click', (event) => {
            if (event.target === dom.modalAnswerDetail) closeAnswerDetailModal();
        });
    }
    if (dom.btnAnswerEditConfirmClose) {
        dom.btnAnswerEditConfirmClose.addEventListener('click', closeAnswerEditConfirm);
    }
    if (dom.btnAnswerEditConfirmCancel) {
        dom.btnAnswerEditConfirmCancel.addEventListener('click', closeAnswerEditConfirm);
    }
    if (dom.btnAnswerEditConfirmApprove) {
        dom.btnAnswerEditConfirmApprove.addEventListener('click', () => {
            if (!appState.pendingEditAnswerId) return;
            const answerId = appState.pendingEditAnswerId;
            const answer = appState.answers.find((item) => item.id === answerId);
            appState.confirmEditOpen = false;
            appState.isEditing = true;
            appState.draftText = getAnswerDisplayText(answer);
            closeAnswerEditConfirm();
            if (dom.modalAnswerDetail) {
                dom.modalAnswerDetail.classList.remove('hidden');
                dom.modalAnswerDetail.classList.add('active');
            }
            updateAnswerDetailMode();
        });
    }
    if (dom.modalAnswerEditConfirm) {
        dom.modalAnswerEditConfirm.addEventListener('click', (event) => {
            if (event.target === dom.modalAnswerEditConfirm) closeAnswerEditConfirm();
        });
    }
    if (dom.btnAnswerDetailSave) {
        dom.btnAnswerDetailSave.addEventListener('click', saveAnswerDetailEdit);
    }
    if (dom.btnAnswerDetailCancel) {
        dom.btnAnswerDetailCancel.addEventListener('click', cancelAnswerDetailEdit);
    }
    if (dom.readSearchInput) {
        dom.readSearchInput.value = appState.readQuery || '';
        dom.readSearchInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            appState.readQuery = normalizeReadText(dom.readSearchInput.value);
            appState.readIndex = 0;
            renderEntryList();
        });
    }
    if (dom.readSearchBtn) {
        dom.readSearchBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (!dom.readSearchInput) return;
            appState.readQuery = normalizeReadText(dom.readSearchInput.value);
            appState.readIndex = 0;
            renderEntryList();
        });
    }
    const moveReadIndex = (direction) => {
        if (!appState.readFilteredEntries.length) {
            renderEntryList();
        }
        const list = appState.readFilteredEntries || [];
        if (!list.length) return;
        const current = Number.isFinite(appState.readIndex) ? appState.readIndex : 0;
        let nextIndex = current;
        if (direction === 'newer') {
            nextIndex = Math.max(0, current - 1);
        } else if (direction === 'older') {
            nextIndex = Math.min(list.length - 1, current + 1);
        }
        if (nextIndex === current) return;
        appState.readIndex = nextIndex;
        renderReadCard(list[nextIndex]);
    };
    if (dom.readPrev) {
        dom.readPrev.addEventListener('click', (event) => {
            event.preventDefault();
            moveReadIndex('older');
        });
    }
    if (dom.readNext) {
        dom.readNext.addEventListener('click', (event) => {
            event.preventDefault();
            moveReadIndex('newer');
        });
    }
    if (dom.btnReadCustom) {
        dom.btnReadCustom.addEventListener('click', (event) => {
            event.preventDefault();
            openReadCustomModal();
        });
    }
    if (dom.btnReadCustomClose) {
        dom.btnReadCustomClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeReadCustomModal();
        });
    }
    if (dom.btnReadCustomSearch) {
        dom.btnReadCustomSearch.addEventListener('click', (event) => {
            event.preventDefault();
            applyReadCustomSearch();
        });
    }
    if (dom.btnReadCustomClear) {
        dom.btnReadCustomClear.addEventListener('click', (event) => {
            event.preventDefault();
            clearReadConditions();
        });
    }
    if (dom.modalReadCustom) {
        dom.modalReadCustom.addEventListener('click', (event) => {
            if (event.target === dom.modalReadCustom) {
                closeReadCustomModal();
                return;
            }
            const tabButton = event.target.closest('.read-custom-tab');
            if (tabButton && tabButton.dataset.tab) {
                setReadCustomTab(tabButton.dataset.tab);
                return;
            }
            const chip = event.target.closest('.read-condition-chip');
            if (chip && chip.dataset.id) {
                appState.readCustomConditions = appState.readCustomConditions.filter((cond) => cond.id !== chip.dataset.id);
                renderReadCustomConditions();
                renderEntryList();
            }
        });
    }
    if (dom.btnReadDetailClose) {
        dom.btnReadDetailClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeReadDetailModal();
        });
    }
    if (dom.modalReadDetail) {
        dom.modalReadDetail.addEventListener('click', (event) => {
            if (event.target === dom.modalReadDetail) closeReadDetailModal();
        });
    }
    if (dom.btnReadPhotoClose) {
        dom.btnReadPhotoClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeReadPhotoModal();
        });
    }
    if (dom.modalReadPhoto) {
        dom.modalReadPhoto.addEventListener('click', (event) => {
            if (event.target === dom.modalReadPhoto) closeReadPhotoModal();
        });
    }
    if (dom.btnBrowsingOpen) {
        dom.btnBrowsingOpen.addEventListener('click', (event) => {
            event.preventDefault();
            openBrowsingModal();
        });
    }
    if (dom.btnBrowsingClose) {
        dom.btnBrowsingClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeBrowsingModal();
        });
    }
    if (dom.btnBrowsingCancel) {
        dom.btnBrowsingCancel.addEventListener('click', (event) => {
            event.preventDefault();
            closeBrowsingModal();
        });
    }
    if (dom.btnBrowsingSave) {
        dom.btnBrowsingSave.addEventListener('click', (event) => {
            event.preventDefault();
            commitBrowsingModal();
        });
    }
    if (dom.modalBrowsing) {
        dom.modalBrowsing.addEventListener('click', (event) => {
            if (event.target === dom.modalBrowsing) closeBrowsingModal();
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const isReadActive = appState.currentView === 'list' || (dom.viewList && dom.viewList.classList.contains('active'));
        if (!isReadActive) return;
        const target = event.target;
        const tag = target && target.tagName;
        const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target && target.isContentEditable);
        if (isTyping) return;
        const isModalOpen = [dom.modalReadCustom, dom.modalReadDetail, dom.modalReadPhoto].some((el) => el && el.classList.contains('active'));
        if (isModalOpen) return;
        event.preventDefault();
        moveReadIndex(event.key === 'ArrowLeft' ? 'older' : 'newer');
    });

    window.googleLogin = googleLogin;
    window.saveEntryHelper = saveEntryHelper;
    window.addEntryHelper = addEntryHelper;
    window.cancelEdit = cancelEdit;
    window.requestDeleteEntry = requestDeleteEntry;
    window.confirmDeleteHelper = confirmDeleteHelper;
    window.cancelDeleteHelper = cancelDeleteHelper;

    refreshFilterOptions();
    setupJournalLayout();
    setupCalendarSwipe();
    window.addEventListener('resize', () => {
        if (journalLayoutResizeTimer) {
            clearTimeout(journalLayoutResizeTimer);
        }
        journalLayoutResizeTimer = setTimeout(() => {
            setupJournalLayout();
            updateMonthlyGoalProgress(appState.calendarDate);
        }, 150);
    });
}

function autoResizeTextarea(target) {
    const el = target && target.target ? target.target : (target || dom.inputContent);
    if (!el) return;
    if (el.classList && el.classList.contains('no-autoresize')) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}

function resizeAllJournalTextareas() {
    document.querySelectorAll('.journal-textarea').forEach((el) => autoResizeTextarea(el));
}

function setJournalEditMode(isEdit) {
    const inputs = document.querySelectorAll('.journal-input');
    const displays = document.querySelectorAll('.journal-display');
    const rangeValues = document.querySelectorAll('.journal-range-value');
    const editOnly = document.querySelectorAll('.journal-edit-only');
    inputs.forEach((el) => el.classList.toggle('hidden', !isEdit));
    displays.forEach((el) => el.classList.toggle('hidden', isEdit));
    rangeValues.forEach((el) => el.classList.toggle('hidden', !isEdit));
    editOnly.forEach((el) => el.classList.toggle('hidden', !isEdit));
    if (!isEdit) {
        closeEmotionPicker();
    }
}

function formatWithUnit(value, unit) {
    const v = String(value || '').trim();
    if (!v) return '———';
    if (unit === '時間') {
        if (v.includes(':')) {
            const parts = splitTimeParts(v);
            const hourNum = Number(parts.hour || 0);
            const minuteNum = Number(parts.minute || 0);
            if (minuteNum && hourNum) return `${hourNum}時間${minuteNum}分`;
            if (minuteNum && !hourNum) return `${minuteNum}分`;
            if (hourNum) return `${hourNum}時間`;
        }
        if (/[時間分]/.test(v)) return v;
        const num = Number(v);
        if (!Number.isNaN(num)) {
            const hours = Math.floor(num);
            const minutes = Math.round((num - hours) * 60);
            if (minutes > 0) {
                if (hours) return `${hours}時間${minutes}分`;
                return `${minutes}分`;
            }
            if (Number.isInteger(num)) return `${num}時間`;
        }
    }
    if (unit && !v.endsWith(unit)) return `${v}${unit}`;
    return v;
}

function openSleepModal() {
    openDurationPicker('sleep');
}

function closeSleepModal() {
    if (!dom.modalSleep) return;
    dom.modalSleep.classList.add('hidden');
    dom.modalSleep.classList.remove('active');
}

function renderSleepOptions() {
    if (!dom.sleepOptions) return;
    const current = String(dom.inputSleep ? dom.inputSleep.value : '').trim();
    dom.sleepOptions.innerHTML = SLEEP_OPTIONS.map((value) => {
        const label = formatWithUnit(value, '時間');
        const isSelected = current && Number(current) === value;
        return `<button class="picker-option${isSelected ? ' is-selected' : ''}" data-value="${value}">${label}</button>`;
    }).join('');
}

function setSleepValue(value) {
    if (dom.inputSleep) dom.inputSleep.value = String(value || '').trim();
    updateSleepButton();
    closeSleepModal();
}

function updateSleepButton() {
    if (!dom.sleepValue) return;
    const value = dom.inputSleep ? String(dom.inputSleep.value || '').trim() : '';
    dom.sleepValue.textContent = value ? formatWithUnit(value, '時間') : '-';
}

function openWeightModal() {
    if (!dom.modalWeight || !dom.inputWeightModal) return;
    dom.inputWeightModal.value = dom.inputWeight ? dom.inputWeight.value : '';
    dom.modalWeight.classList.remove('hidden');
    dom.modalWeight.classList.add('active');
    dom.inputWeightModal.focus();
}

function closeWeightModal() {
    if (!dom.modalWeight) return;
    dom.modalWeight.classList.add('hidden');
    dom.modalWeight.classList.remove('active');
}

function applyWeightValue() {
    if (!dom.inputWeightModal) return;
    const raw = dom.inputWeightModal.value.trim();
    if (raw && Number.isNaN(Number(raw))) {
        showToast('数値で入力してください', 'error');
        return;
    }
    if (dom.inputWeight) dom.inputWeight.value = raw;
    updateWeightButton();
    closeWeightModal();
}

function updateWeightButton() {
    if (!dom.weightValue) return;
    const value = dom.inputWeight ? String(dom.inputWeight.value || '').trim() : '';
    dom.weightValue.textContent = value ? `${value} kg` : '-';
}

function updateFocusButton() {
    if (!dom.focusValue) return;
    const value = dom.inputFocus ? String(dom.inputFocus.value || '').trim() : '';
    dom.focusValue.textContent = value ? formatDurationLabel(value) : '-';
}

function updateWorkoutButton() {
    if (!dom.workoutValue) return;
    const value = dom.inputWorkout ? String(dom.inputWorkout.value || '').trim() : '';
    dom.workoutValue.textContent = value ? formatDurationLabel(value) : '-';
}

function openSatisfactionModal() {
    if (!dom.modalSatisfaction) return;
    renderSatisfactionOptions();
    dom.modalSatisfaction.classList.remove('hidden');
    dom.modalSatisfaction.classList.add('active');
}

function closeSatisfactionModal() {
    if (!dom.modalSatisfaction) return;
    dom.modalSatisfaction.classList.add('hidden');
    dom.modalSatisfaction.classList.remove('active');
}

function renderSatisfactionOptions() {
    if (!dom.satisfactionOptions) return;
    const current = String(dom.inputSatisfaction ? dom.inputSatisfaction.value : '').trim();
    dom.satisfactionOptions.innerHTML = SATISFACTION_OPTIONS.map((value) => {
        const isSelected = current && Number(current) === value;
        return `<button class="picker-option${isSelected ? ' is-selected' : ''}" data-value="${value}">${value}</button>`;
    }).join('');
}

function setSatisfactionValue(value) {
    if (dom.inputSatisfaction) dom.inputSatisfaction.value = String(value || '').trim();
    updateSatisfactionButton();
    closeSatisfactionModal();
}

function updateSatisfactionButton() {
    if (!dom.satisfactionValue) return;
    const value = dom.inputSatisfaction ? String(dom.inputSatisfaction.value || '').trim() : '';
    dom.satisfactionValue.textContent = value ? `${value}/10` : '-';
}

function formatDurationLabel(value) {
    const safe = String(value || '').trim();
    if (!safe) return '-';
    const label = formatWithUnit(safe, '時間');
    return label === '???' ? safe : label;
}

function parseDurationValue(value) {
    const safe = String(value || '').trim();
    if (!safe) return { hour: '', minute: '' };
    if (safe.includes(':')) {
        const parts = splitTimeParts(safe);
        return {
            hour: parts.hour,
            minute: parts.minute || '00'
        };
    }
    const numeric = Number(safe.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric)) return { hour: '', minute: '' };
    let hour = Math.floor(numeric);
    if (hour < 0) hour = 0;
    if (hour > 12) hour = 12;
    const minuteRaw = Math.round(((numeric - hour) * 60) / 5) * 5;
    const minute = Math.min(55, Math.max(0, minuteRaw));
    return {
        hour: String(hour).padStart(2, '0'),
        minute: String(minute).padStart(2, '0')
    };
}

function renderDurationOptions() {
    if (!durationPickerState) return;
    const hourValue = durationPickerState.hour || '00';
    const minuteValue = durationPickerState.minute || '00';
    const hourOptions = durationPickerTarget === 'sleep' ? SLEEP_HOURS : DURATION_HOURS;
    renderScrollPicker(dom.durationTimeHour, hourOptions, hourValue, 'duration-hour');
    renderScrollPicker(dom.durationTimeMinute, SCHEDULE_MINUTES, minuteValue, 'duration-minute');
}

function openDurationPicker(target, anchorEl) {
    if (!dom.modalDuration) return;
    durationPickerTarget = target;
    const label = target === 'focus' ? '集中時間' : (target === 'sleep' ? '睡眠時間' : '運動時間');
    if (dom.durationModalTitle) dom.durationModalTitle.textContent = `${label}を選択`;
    const currentValue = target === 'focus'
        ? (dom.inputFocus ? dom.inputFocus.value : '')
        : (target === 'sleep'
            ? (dom.inputSleep ? dom.inputSleep.value : '')
            : (dom.inputWorkout ? dom.inputWorkout.value : ''));
    durationPickerState = parseDurationValue(currentValue);
    renderDurationOptions();
    openScrollPopover(dom.modalDuration, anchorEl);
}

function closeDurationPicker() {
    if (!dom.modalDuration) return;
    dom.modalDuration.classList.add('hidden');
    dom.modalDuration.classList.remove('active');
    dom.modalDuration.classList.remove('is-centered');
    dom.modalDuration.setAttribute('aria-hidden', 'true');
    const content = dom.modalDuration.querySelector('.modal-content');
    if (content) {
        content.style.top = '';
        content.style.left = '';
    }
    durationPickerTarget = null;
    durationPickerState = null;
}

function applyDurationSelection() {
    if (!durationPickerState || !durationPickerTarget) return;
    finalizeScrollPicker(dom.durationTimeHour);
    finalizeScrollPicker(dom.durationTimeMinute);
    const hour = durationPickerState.hour || '';
    const minute = durationPickerState.minute || '00';
    const isEmpty = !hour || (hour === '00' && minute === '00');
    const value = isEmpty ? '' : combineTime(hour, minute);
    if (durationPickerTarget === 'focus') {
        if (dom.inputFocus) dom.inputFocus.value = value;
        updateFocusButton();
    }
    if (durationPickerTarget === 'workout') {
        if (dom.inputWorkout) dom.inputWorkout.value = value;
        updateWorkoutButton();
    }
    if (durationPickerTarget === 'sleep') {
        if (dom.inputSleep) dom.inputSleep.value = value;
        updateSleepButton();
    }
    closeDurationPicker();
}

function getNextEmotionTarget() {
    const primary = dom.inputEmotionPrimary ? dom.inputEmotionPrimary.value.trim() : '';
    const secondary = dom.inputEmotionSecondary ? dom.inputEmotionSecondary.value.trim() : '';
    if (!primary) return 'primary';
    if (!secondary) return 'secondary';
    return 'primary';
}

function handleSummaryLabelClick(target) {
    switch (target) {
        case 'sleep':
            openDurationPicker('sleep');
            break;
        case 'workout':
            openDurationPicker('workout');
            break;
        case 'weight':
            openWeightModal();
            break;
        case 'focus':
            openDurationPicker('focus');
            break;
        case 'satisfaction':
            openSatisfactionModal();
            break;
        case 'emotion':
            openEmotionPicker();
            break;
        default:
            break;
    }
}

function updateSummaryDate(date) {
    if (!dom.summaryDate) return;
    const target = date || appState.writingDate || getJournalDateNow();
    dom.summaryDate.textContent = formatDate(target);
}

function formatScale(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '———';
    return `${num}/10`;
}

function formatEmotionPair(primary, secondary, compoundOverride) {
    const leftKey = String(primary || '').trim();
    const rightKey = String(secondary || '').trim();
    const left = leftKey ? (EMOTION_LABELS[leftKey] || leftKey) : '';
    const right = rightKey ? (EMOTION_LABELS[rightKey] || rightKey) : '';
    if (left && right) {
        const compound = compoundOverride || getCompoundEmotion(leftKey, rightKey);
        return compound || `${left} \u00d7 ${right}`;
    }
    if (left) return left;
    if (right) return right;
    return '-';
}

function normalizeEmotionPair(primary, secondary) {
    const left = String(primary || '').trim();
    const right = String(secondary || '').trim();
    if (!left || !right) {
        return { primary: left, secondary: right };
    }
    if (left === right || EMOTION_OPPOSITES[left] === right) {
        return { primary: left, secondary: '' };
    }
    return { primary: left, secondary: right };
}

function renderSummaryEmotionText(primary, secondary) {
    if (!dom.summaryEmotionValue) return;
    const normalized = normalizeEmotionPair(primary, secondary);
    dom.summaryEmotionValue.textContent = formatEmotionPair(normalized.primary, normalized.secondary);
}

function updateEmotionControls() {
    const primary = dom.inputEmotionPrimary ? dom.inputEmotionPrimary.value : '';
    const secondary = dom.inputEmotionSecondary ? dom.inputEmotionSecondary.value : '';
    if (dom.displayEmotion) dom.displayEmotion.textContent = formatEmotionPair(primary, secondary);
    renderSummaryEmotionText(primary, secondary);
}

function buildEmotionPickerValues(otherValue) {
    const forbidden = new Set();
    if (otherValue) {
        forbidden.add(otherValue);
        const opposite = EMOTION_OPPOSITES[otherValue];
        if (opposite) forbidden.add(opposite);
    }
    const values = [{ value: EMOTION_NONE_VALUE, label: '-' }];
    EMOTION_ORDER.forEach((key) => {
        if (forbidden.has(key)) return;
        values.push({ value: key, label: EMOTION_LABELS[key] || key });
    });
    return values;
}

function renderEmotionPickerOptions() {
    if (!emotionPickerState) return;
    const primary = emotionPickerState.primary || '';
    const secondary = emotionPickerState.secondary || '';
    const primaryValues = buildEmotionPickerValues(secondary);
    const secondaryValues = buildEmotionPickerValues(primary);
    renderScrollPicker(dom.emotionPrimaryList, primaryValues, primary || EMOTION_NONE_VALUE, 'emotion-primary');
    renderScrollPicker(dom.emotionSecondaryList, secondaryValues, secondary || EMOTION_NONE_VALUE, 'emotion-secondary');
}

function openEmotionPicker() {
    if (!dom.modalEmotion) return;
    const normalized = normalizeEmotionPair(
        dom.inputEmotionPrimary ? dom.inputEmotionPrimary.value.trim() : '',
        dom.inputEmotionSecondary ? dom.inputEmotionSecondary.value.trim() : ''
    );
    emotionPickerState = {
        primary: normalized.primary,
        secondary: normalized.secondary
    };
    renderEmotionPickerOptions();
    openScrollPopover(dom.modalEmotion);
}

function closeEmotionPicker() {
    if (!dom.modalEmotion) return;
    dom.modalEmotion.classList.add('hidden');
    dom.modalEmotion.classList.remove('active');
    dom.modalEmotion.classList.remove('is-centered');
    dom.modalEmotion.setAttribute('aria-hidden', 'true');
    const content = dom.modalEmotion.querySelector('.modal-content');
    if (content) {
        content.style.top = '';
        content.style.left = '';
    }
    emotionPickerState = null;
}

function applyEmotionPickerSelection() {
    if (!emotionPickerState) return;
    finalizeScrollPicker(dom.emotionPrimaryList);
    finalizeScrollPicker(dom.emotionSecondaryList);
    const normalized = normalizeEmotionPair(
        emotionPickerState.primary || '',
        emotionPickerState.secondary || ''
    );
    if (dom.inputEmotionPrimary) dom.inputEmotionPrimary.value = normalized.primary;
    if (dom.inputEmotionSecondary) dom.inputEmotionSecondary.value = normalized.secondary;
    updateEmotionControls();
    closeEmotionPicker();
}

function parseLatLng(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

function buildMapUrls(lat, lng, size) {
    const scale = Math.max(160, Math.min(size || 220, 640));
    const latStr = lat.toFixed(5);
    const lngStr = lng.toFixed(5);
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${latStr},${lngStr}&zoom=15&size=${scale}x${scale}&maptype=mapnik&markers=${latStr},${lngStr},red-pushpin`;
    const yandexSize = Math.max(200, Math.min(scale, 450));
    const fallbackUrl = `https://static-maps.yandex.ru/1.x/?ll=${lngStr},${latStr}&z=15&size=${yandexSize},${yandexSize}&l=map&pt=${lngStr},${latStr},pm2rdm`;
    const linkUrl = `https://www.openstreetmap.org/?mlat=${latStr}&mlon=${lngStr}#map=17/${latStr}/${lngStr}`;
    return { mapUrl, fallbackUrl, linkUrl };
}

function getLocationSlots() {
    return Array.from(document.querySelectorAll('.location-slot'));
}

function getActiveLocationSlot() {
    const slots = getLocationSlots();
    if (!slots.length) return null;
    if (activeLocationSlotIndex >= slots.length) {
        activeLocationSlotIndex = 0;
    }
    return slots[activeLocationSlotIndex] || null;
}

function normalizeLocationItem(item) {
    if (!item) return { coords: '', label: '' };
    if (typeof item === 'string') return { coords: item, label: '' };
    return {
        coords: String(item.coords || item.location || item.value || '').trim(),
        label: String(item.label || item.locationLabel || item.name || '').trim()
    };
}

function buildLocationSummaryText(locations) {
    const unique = new Map();
    locations.forEach((loc) => {
        const raw = String(loc.label || '').replace(/\s+/g, ' ').trim();
        if (!raw) return;
        const key = raw.replace(/[\s、，,]+/g, '');
        if (!key) return;
        if (!unique.has(key)) unique.set(key, raw);
    });
    return unique.size ? Array.from(unique.values()).join(', ') : '---';
}

function applyLocationToSlot(index, coords, label) {
    const slots = getLocationSlots();
    if (!slots.length) return;
    const slotIndex = Number.isFinite(index) ? index : activeLocationSlotIndex;
    const slot = slots[slotIndex] || slots[0];
    if (!slot) return;
    updateLocationSlotPreview(slot, coords, label);
    syncLocationSummary(collectLocationSlots());
    activeLocationSlotIndex = slots.indexOf(slot);
    syncLocationInputsFromSlot(activeLocationSlotIndex);
    updateLocationPreview(coords, label, 320);
}

function updateLocationSlotPreview(slot, coords, label) {
    if (!slot) return;
    slot.dataset.coords = coords || '';
    slot.dataset.label = label || '';
    const img = slot.querySelector('.location-slot-map');
    const placeholder = slot.querySelector('.location-slot-placeholder');
    if (coords) {
        const parsed = parseLatLng(coords);
        if (parsed && img) {
            const { mapUrl, fallbackUrl } = buildMapUrls(parsed.lat, parsed.lng, 180);
            img.src = mapUrl;
            img.dataset.fallback = fallbackUrl;
            img.onerror = () => {
                if (img.dataset.fallback && img.src !== img.dataset.fallback) {
                    img.src = img.dataset.fallback;
                }
            };
            img.classList.remove('hidden');
        }
        if (placeholder) placeholder.classList.add('hidden');
    } else {
        if (img) {
            img.removeAttribute('src');
            img.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

function syncLocationSummary(locations) {
    if (!dom.locationSummary && !dom.summaryLocation) return;
    const summaryText = buildLocationSummaryText(locations);
    if (dom.locationSummary) dom.locationSummary.textContent = summaryText;
    if (dom.summaryLocation) dom.summaryLocation.textContent = summaryText;
}

function applyLocationSlots(locations = []) {
    const normalized = Array.isArray(locations) ? locations.map(normalizeLocationItem) : [];
    const slots = getLocationSlots();
    slots.forEach((slot, index) => {
        const item = normalized[index] || { coords: '', label: '' };
        updateLocationSlotPreview(slot, item.coords, item.label);
    });
    if (slots.length) {
        if (activeLocationSlotIndex >= slots.length) activeLocationSlotIndex = 0;
        syncLocationInputsFromSlot(activeLocationSlotIndex);
    }
    const primary = normalized[0] || { coords: '', label: '' };
    if (dom.inputLocation) dom.inputLocation.value = primary.coords || '';
    if (dom.locationLabel) {
        if (primary.label) {
            dom.locationLabel.textContent = primary.label;
            dom.locationLabel.classList.remove('hidden');
        } else {
            dom.locationLabel.textContent = '';
            dom.locationLabel.classList.add('hidden');
        }
    }
    syncLocationSummary(normalized);
}

function collectLocationSlots() {
    return getLocationSlots().map((slot) => ({
        coords: String(slot.dataset.coords || '').trim(),
        label: String(slot.dataset.label || '').trim()
    }));
}

function syncLocationInputsFromSlot(index) {
    const slots = getLocationSlots();
    const slot = slots[index];
    if (!slot) return;
    const coords = String(slot.dataset.coords || '').trim();
    const label = String(slot.dataset.label || '').trim();
    if (dom.inputLocation) dom.inputLocation.value = coords;
    if (dom.locationLabel) {
        dom.locationLabel.textContent = label;
        dom.locationLabel.classList.toggle('hidden', !label);
    }
    if (dom.inputLocationSearchModal) {
        dom.inputLocationSearchModal.value = label || '';
    }
    if (dom.inputLocationSearch) {
        dom.inputLocationSearch.value = label || '';
    }
}

function renderLocationMarkup(value, size) {
    const placeholder = '\u2014\u2014\u2014';
    const text = String(value || '').trim();
    if (!text) return `<span class="location-text">${placeholder}</span>`;
    const coords = parseLatLng(text);
    if (!coords) return `<span class="location-text">${escapeHtml(text)}</span>`;
    const { mapUrl, fallbackUrl, linkUrl } = buildMapUrls(coords.lat, coords.lng, size);
    return `
        <a class="location-map" href="${linkUrl}" target="_blank" rel="noopener">
            <img src="${mapUrl}" data-fallback="${fallbackUrl}" alt="現在地の地図"
                onerror="this.onerror=null; if (this.dataset.fallback) { this.src=this.dataset.fallback; }">
        </a>
    `;
}

function buildLocationLabel(displayName) {
    const parts = String(displayName || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return '';
    return parts.slice(0, 3).join('、');
}

function clearLocationSuggestions(container) {
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('hidden');
}

function renderLocationSuggestions(container, suggestions) {
    if (!container) return;
    if (!suggestions.length) {
        clearLocationSuggestions(container);
        return;
    }
    container.innerHTML = suggestions
        .map(
            (item) =>
                `<button type="button" data-lat="${item.lat}" data-lng="${item.lng}" data-label="${escapeHtml(item.label)}">${escapeHtml(item.label)}</button>`
        )
        .join('');
    container.classList.remove('hidden');
}

async function fetchLocationSuggestions(query) {
    const trimmed = String(query || '').trim();
    if (trimmed.length < 2) return [];
    const requestId = ++locationSearchRequestId;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'ja' } });
    if (!res.ok) throw new Error('location_search_failed');
    const data = await res.json();
    if (requestId !== locationSearchRequestId) return [];
    return (Array.isArray(data) ? data : [])
        .map((item) => ({
            label: buildLocationLabel(item.display_name || ''),
            lat: Number(item.lat),
            lng: Number(item.lon)
        }))
        .filter((item) => item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

function selectLocationSuggestion(dataset, fromModal = false) {
    const lat = Number(dataset.lat);
    const lng = Number(dataset.lng);
    const label = String(dataset.label || '').trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const coordsText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (dom.inputLocationSearch) dom.inputLocationSearch.value = label;
    if (dom.inputLocationSearchModal) dom.inputLocationSearchModal.value = label;
    applyLocationToSlot(activeLocationSlotIndex, coordsText, label);
    if (window.L) {
        locationPickerLatLng = L.latLng(lat, lng);
        if (locationPickerMap) {
            locationPickerMap.setView([lat, lng], 15);
            if (!locationPickerMarker) {
                locationPickerMarker = L.marker(locationPickerLatLng).addTo(locationPickerMap);
            } else {
                locationPickerMarker.setLatLng(locationPickerLatLng);
            }
        }
    }
    clearLocationSuggestions(fromModal ? dom.locationSuggestionsModal : dom.locationSuggestions);
}

function handleLocationSearchInput(event) {
    const value = event.target.value;
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        if (dom.inputLocation) dom.inputLocation.value = '';
        if (dom.locationLabel) {
            dom.locationLabel.textContent = '';
            dom.locationLabel.classList.add('hidden');
        }
        updateLocationPreview('', '', 320);
        clearLocationSuggestions(dom.locationSuggestions);
        return;
    }
    if (locationSearchTimer) window.clearTimeout(locationSearchTimer);
    locationSearchTimer = window.setTimeout(async () => {
        try {
            const suggestions = await fetchLocationSuggestions(value);
            renderLocationSuggestions(dom.locationSuggestions, suggestions);
        } catch {
            clearLocationSuggestions(dom.locationSuggestions);
        }
    }, 300);
}

function handleLocationSearchInputModal(event) {
    const value = event.target.value;
    const trimmed = String(value || '').trim();
    if (!trimmed) {
        clearLocationSuggestions(dom.locationSuggestionsModal);
        return;
    }
    if (locationSearchTimer) window.clearTimeout(locationSearchTimer);
    locationSearchTimer = window.setTimeout(async () => {
        try {
            const suggestions = await fetchLocationSuggestions(value);
            renderLocationSuggestions(dom.locationSuggestionsModal, suggestions);
        } catch {
            clearLocationSuggestions(dom.locationSuggestionsModal);
        }
    }, 300);
}

function syncLocationSearchInputs() {
    const slot = getActiveLocationSlot();
    const label = slot ? String(slot.dataset.label || '').trim() : (dom.locationLabel ? dom.locationLabel.textContent.trim() : '');
    const fallback = label || (dom.inputLocationSearch ? dom.inputLocationSearch.value.trim() : '');
    if (dom.inputLocationSearchModal) {
        dom.inputLocationSearchModal.value = fallback;
    }
}

function isDesktopFixedGrid() {
    return JOURNAL_LAYOUT_MODE === 'fixed-grid'
        && window.matchMedia(`(min-width: ${FIXED_GRID_MIN_WIDTH}px)`).matches;
}

function updateFixedGridMetrics() {
    if (!dom.journalSections || !dom.viewEditor) return;
    if (!isDesktopFixedGrid()) return;
    const containerWidth = dom.journalSections.clientWidth || dom.journalSections.offsetWidth;
    if (!containerWidth) return;
    const gap = FIXED_GRID_CONFIG.gap;
    const availableWidth = Math.max(0, containerWidth - gap);
    const leftWidth = availableWidth * FIXED_GRID_CONFIG.leftRatio;
    const rightWidth = availableWidth * FIXED_GRID_CONFIG.rightRatio;
    const rightAvailable = Math.max(0, rightWidth - gap * 2);
    const ratioTotal = FIXED_GRID_CONFIG.rightColRatios.reduce((sum, value) => sum + value, 0);
    const colUnit = ratioTotal ? rightAvailable / ratioTotal : 0;
    const col1 = colUnit * FIXED_GRID_CONFIG.rightColRatios[0];
    const col2 = colUnit * FIXED_GRID_CONFIG.rightColRatios[1];
    const col3 = colUnit * FIXED_GRID_CONFIG.rightColRatios[2];

    const row1 = Math.round(col1 * 0.85);
    const baseRow2 = Math.max(52, Math.round(row1 / 3));
    const row2 = Math.round(baseRow2 * 1.3);
    const row3 = Math.round(row2 * 1.15);
    const row4 = Math.max(44, Math.round(row1 / 4));

    const containerTop = dom.journalSections.getBoundingClientRect().top;
    const baseColumnHeight = Math.max(360, Math.floor(window.innerHeight - containerTop - 16));
    const row5 = Math.max(
        FIXED_GRID_CONFIG.diaryMin,
        Math.round(baseColumnHeight - (row1 + row2 + row3 + row4))
    );
    const columnHeight = Math.max(baseColumnHeight, row1 + row2 + row3 + row4 + row5);

    dom.journalSections.style.setProperty('--left-col-width', `${Math.round(leftWidth)}px`);
    dom.journalSections.style.setProperty('--column-height', `${columnHeight}px`);
    dom.journalSections.style.setProperty('--left-ai-height', `${Math.round(leftWidth * FIXED_GRID_CONFIG.analysisRatio)}px`);
    dom.journalSections.style.setProperty('--left-memo-height', `${Math.round(leftWidth * FIXED_GRID_CONFIG.memoRatio)}px`);
    dom.journalSections.style.setProperty('--left-location-size', `${Math.round(leftWidth / 3)}px`);
    dom.journalSections.style.setProperty('--left-location-text-height', `${Math.round(leftWidth / 6)}px`);
    dom.journalSections.style.setProperty('--right-col1', `${Math.round(col1)}px`);
    dom.journalSections.style.setProperty('--right-col2', `${Math.round(col2)}px`);
    dom.journalSections.style.setProperty('--right-col3', `${Math.round(col3)}px`);
    dom.journalSections.style.setProperty('--row1', `${Math.round(row1)}px`);
    dom.journalSections.style.setProperty('--row2', `${Math.round(row2)}px`);
    dom.journalSections.style.setProperty('--row3', `${Math.round(row3)}px`);
    dom.journalSections.style.setProperty('--row4', `${Math.round(row4)}px`);
    dom.journalSections.style.setProperty('--row5', `${Math.round(row5)}px`);
}

function resetJournalLayoutToDefault() {
    if (!dom.journalSections) return;
    if (!isDesktopFixedGrid()) {
        showToast('PC\u8868\u793a\u3067\u4f7f\u3048\u307e\u3059', 'error');
        return;
    }
    updateFixedGridMetrics();
    showToast('\u914d\u7f6e\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f');
}

function setupJournalLayout() {
    if (!dom.journalSections) return;
    if (appState.currentView !== 'editor') return;
    if (!dom.viewEditor || dom.viewEditor.classList.contains('hidden')) return;
    if (!dom.journalSections.offsetParent) return;
    if (isDesktopFixedGrid()) {
        dom.journalSections.classList.add('fixed-grid');
        dom.viewEditor.classList.add('fixed-layout');
        requestAnimationFrame(updateFixedGridMetrics);
        return;
    }
    dom.journalSections.classList.remove('fixed-grid');
    dom.viewEditor.classList.remove('fixed-layout');
}

async function reverseGeocode(lat, lng) {
    const latStr = lat.toFixed(5);
    const lngStr = lng.toFixed(5);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latStr}&lon=${lngStr}&zoom=14&addressdetails=1&accept-language=ja`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'ja' } });
    if (!res.ok) throw new Error('reverse_geocode_failed');
    const data = await res.json();
    const address = data.address || {};
    const prefecture = address.state || address.province || address.county;
    const city = address.city || address.town || address.village || address.municipality;
    const ward = address.city_district || address.suburb || address.neighbourhood;
    const parts = [prefecture, city, ward].filter(Boolean);
    if (parts.length) return parts.join('');
    return data.display_name || '';
}

function normalizeScheduleItems(raw) {
    if (Array.isArray(raw)) {
        return raw.map((item) => ({
            start: String(item?.start || item?.from || '').trim(),
            end: String(item?.end || item?.to || '').trim(),
            title: String(item?.title || item?.name || '').trim(),
            allDay: !!(item?.allDay || item?.all_day),
            sharedWith: normalizeSharedList(item?.sharedWith || item?.shared_with || item?.shareWith || item?.share_with || item?.shareTargets || []),
            sharedWithUids: normalizeSharedUidList(item?.sharedWithUids || item?.shared_with_uids || item?.shareWithUids || item?.share_with_uids || item?.sharedWithUIDs || [])
        })).filter((item) => item.allDay || item.start || item.end || item.title);
    }
    if (typeof raw === 'string') {
        return parseScheduleText(raw);
    }
    return [];
}

function parseScheduleText(text) {
    const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.map((line) => {
        if (line.startsWith('\u7d42\u65e5')) {
            const title = line.replace(/^\u7d42\u65e5\s*/, '').trim();
            return { start: '', end: '', title, allDay: true };
        }
        const match = line.match(/(\d{1,2}:\d{2})\s*[-~?\u30fc]\s*(\d{1,2}:\d{2})\s*(.*)$/);
        if (match) {
            return { start: match[1], end: match[2], title: (match[3] || '').trim() };
        }
        return { start: '', end: '', title: line };
    }).filter((item) => item.allDay || item.start || item.end || item.title);
}
function formatScheduleText(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map((item) => {
        const start = String(item?.start || '').trim();
        const end = String(item?.end || '').trim();
        const title = String(item?.title || '').trim();
        const allDay = !!(item?.allDay || item?.all_day);
        if (allDay) return ['\u7d42\u65e5', title].filter(Boolean).join(' ');
        const time = start && end ? `${start}-${end}` : (start || end ? `${start}${end ? `-${end}` : ''}` : '');
        return [time, title].filter(Boolean).join(' ');
    }).filter(Boolean).join('\n');
}
function buildSelectOptions(values, selected, placeholder) {
    const safe = String(selected || '').trim();
    const options = [`<option value=""${safe ? '' : ' selected'}>${placeholder}</option>`];
    values.forEach((value) => {
        const label = String(value);
        options.push(`<option value="${label}"${label === safe ? ' selected' : ''}>${label}</option>`);
    });
    return options.join('');
}

function splitTimeParts(value) {
    const safe = String(value || '').trim();
    if (!safe) return { hour: '', minute: '' };
    const [hour = '', minute = ''] = safe.split(':');
    return {
        hour: hour.padStart(2, '0'),
        minute: minute.padStart(2, '0')
    };
}

function combineTime(hour, minute) {
    const safeHour = String(hour || '').trim();
    if (!safeHour) return '';
    const safeMinute = String(minute || '').trim() || '00';
    return `${safeHour.padStart(2, '0')}:${safeMinute.padStart(2, '0')}`;
}

function ensureScrollPickerPadding(container) {
    if (!container) return;
    const height = container.clientHeight || 0;
    if (!height) return;
    const padding = Math.max(0, Math.round((height - SCROLL_PICKER_ITEM_HEIGHT) / 2));
    container.style.paddingTop = `${padding}px`;
    container.style.paddingBottom = `${padding}px`;
}

function setScrollPickerSelection(container, value) {
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.scroll-picker-item'));
    items.forEach((item) => {
        item.classList.toggle('is-selected', item.dataset.value === value);
    });
}

function scrollToPickerValue(container, value, behavior = 'auto') {
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.scroll-picker-item'));
    const index = Math.max(0, items.findIndex((item) => item.dataset.value === value));
    const top = index * SCROLL_PICKER_ITEM_HEIGHT;
    container.scrollTo({ top, behavior });
    const fallbackValue = items[index] ? items[index].dataset.value : value;
    if (fallbackValue) setScrollPickerSelection(container, fallbackValue);
}

function applyScrollPickerValue(role, value) {
    if (!role || !value) return;
    if (role.startsWith('duration-')) {
        if (!durationPickerState) return;
        if (role === 'duration-hour') durationPickerState.hour = value;
        if (role === 'duration-minute') durationPickerState.minute = value;
        return;
    }
    if (role.startsWith('emotion-')) {
        if (!emotionPickerState) return;
        const normalizedValue = value === EMOTION_NONE_VALUE ? '' : value;
        if (role === 'emotion-primary') emotionPickerState.primary = normalizedValue;
        if (role === 'emotion-secondary') emotionPickerState.secondary = normalizedValue;
        const normalized = normalizeEmotionPair(emotionPickerState.primary, emotionPickerState.secondary);
        emotionPickerState.primary = normalized.primary;
        emotionPickerState.secondary = normalized.secondary;
        renderEmotionPickerOptions();
        return;
    }
    if (!scheduleTimeState || scheduleTimeState.allDay) return;
    if (role === 'start-hour') scheduleTimeState.startHour = value;
    if (role === 'start-minute') scheduleTimeState.startMinute = value;
    if (role === 'end-hour') scheduleTimeState.endHour = value;
    if (role === 'end-minute') scheduleTimeState.endMinute = value;
}

function finalizeScrollPicker(container) {
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.scroll-picker-item'));
    if (!items.length) return;
    const index = Math.min(items.length - 1, Math.max(0, Math.round(container.scrollTop / SCROLL_PICKER_ITEM_HEIGHT)));
    const item = items[index];
    if (!item) return;
    scrollToPickerValue(container, item.dataset.value || '', 'auto');
    const role = container.dataset.role || '';
    const value = item.dataset.value || '';
    if (container.dataset.touched === 'true') {
        setScrollPickerSelection(container, value);
        applyScrollPickerValue(role, value);
    }
}

function setupScrollPicker(container) {
    if (!container || container.dataset.pickerInit === 'true') return;
    container.dataset.pickerInit = 'true';
    ensureScrollPickerPadding(container);
    let scrollTimer = null;
    container.addEventListener('scroll', () => {
        container.dataset.touched = 'true';
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => finalizeScrollPicker(container), SCROLL_PICKER_SCROLL_DELAY);
    }, { passive: true });
    container.addEventListener('click', (event) => {
        const item = event.target.closest('.scroll-picker-item');
        if (!item) return;
        event.preventDefault();
        container.dataset.touched = 'true';
        scrollToPickerValue(container, item.dataset.value || '', 'smooth');
        const role = container.dataset.role || '';
        if (item.dataset.value) {
            setScrollPickerSelection(container, item.dataset.value);
            applyScrollPickerValue(role, item.dataset.value);
        }
    });
}

function renderScrollPicker(container, values, selected, role) {
    if (!container) return;
    container.dataset.role = role || container.dataset.role || '';
    container.dataset.touched = 'false';
    const normalizedValues = values.map((value) => {
        if (typeof value === 'string') {
            return { value, label: value };
        }
        return value;
    });
    container.innerHTML = normalizedValues.map((item) => {
        const value = String(item.value);
        const label = item.label != null ? String(item.label) : value;
        const isSelected = value === selected;
        return `<button type="button" class="scroll-picker-item${isSelected ? ' is-selected' : ''}" data-value="${value}">${label}</button>`;
    }).join('');
    setupScrollPicker(container);
    ensureScrollPickerPadding(container);
    const fallback = selected || (normalizedValues[0] ? normalizedValues[0].value : '');
    if (fallback) scrollToPickerValue(container, fallback, 'auto');
}

function positionScrollPopover(modal, anchorEl) {
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (!content || !anchorEl) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const contentRect = content.getBoundingClientRect();
    let top = anchorRect.bottom + 8;
    let left = anchorRect.left;
    if (top + contentRect.height > viewportHeight - margin) {
        top = anchorRect.top - contentRect.height - 8;
    }
    if (top < margin) top = margin;
    if (left + contentRect.width > viewportWidth - margin) {
        left = viewportWidth - contentRect.width - margin;
    }
    if (left < margin) left = margin;
    content.style.top = `${top}px`;
    content.style.left = `${left}px`;
}

function refreshScrollPickerPadding(modal) {
    if (!modal) return;
    modal.querySelectorAll('.scroll-picker-list').forEach((container) => {
        ensureScrollPickerPadding(container);
        const selected = container.querySelector('.scroll-picker-item.is-selected')?.dataset.value;
        if (selected) {
            scrollToPickerValue(container, selected, 'auto');
        }
    });
}

function openScrollPopover(modal, anchorEl) {
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    const isCentered = !anchorEl;
    modal.classList.toggle('is-centered', isCentered);
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.transform = 'none';
    }
    if (!anchorEl) {
        if (content) {
            content.style.top = '';
            content.style.left = '';
        }
        requestAnimationFrame(() => refreshScrollPickerPadding(modal));
        return;
    }
    requestAnimationFrame(() => {
        positionScrollPopover(modal, anchorEl);
        refreshScrollPickerPadding(modal);
    });
}

function buildHourOptions(selected) {
    const hours = Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, '0'));
    return buildSelectOptions(hours, selected, '--');
}

function buildMinuteOptions(selected) {
    const minutes = [];
    for (let minute = 0; minute < 60; minute += 5) {
        minutes.push(String(minute).padStart(2, '0'));
    }
    return buildSelectOptions(minutes, selected, '--');
}

function buildScheduleTimeButtonLabel(start, end, allDay) {
    if (allDay) return '終日';
    if (start || end) return `${start || '--:--'}〜${end || '--:--'}`;
    return '時間';
}

function buildScheduleTimeButtonMarkup(start, end, allDay) {
    if (allDay) {
        return '<span class="schedule-time-line">終日</span>';
    }
    if (!start && !end) {
        return '<span class="schedule-time-placeholder">時間</span>';
    }
    const startLabel = escapeHtml(start || '--:--');
    const endLabel = escapeHtml(end || '--:--');
    return `<span class="schedule-time-line">${startLabel}</span><span class="schedule-time-line">${endLabel}</span>`;
}

function readScheduleTimeState(row) {
    if (!row) {
        return { startHour: '', startMinute: '', endHour: '', endMinute: '', allDay: false };
    }
    const startHour = row.querySelector('[data-role="start-hour"]')?.value || '';
    const startMinute = row.querySelector('[data-role="start-minute"]')?.value || '';
    const endHour = row.querySelector('[data-role="end-hour"]')?.value || '';
    const endMinute = row.querySelector('[data-role="end-minute"]')?.value || '';
    const allDay = row.querySelector('[data-role="all-day"]')?.value === '1' || row.dataset.allDay === 'true';
    return { startHour, startMinute, endHour, endMinute, allDay };
}

function renderScheduleTimeOptions() {
    if (!scheduleTimeState) return;
    const startHourValue = scheduleTimeState.startHour || '00';
    const startMinuteValue = scheduleTimeState.startMinute || '00';
    const endHourValue = scheduleTimeState.endHour || '00';
    const endMinuteValue = scheduleTimeState.endMinute || '00';
    renderScrollPicker(dom.scheduleTimeStartHour, SCHEDULE_HOURS, startHourValue, 'start-hour');
    renderScrollPicker(dom.scheduleTimeStartMinute, SCHEDULE_MINUTES, startMinuteValue, 'start-minute');
    renderScrollPicker(dom.scheduleTimeEndHour, SCHEDULE_HOURS, endHourValue, 'end-hour');
    renderScrollPicker(dom.scheduleTimeEndMinute, SCHEDULE_MINUTES, endMinuteValue, 'end-minute');
    if (dom.modalScheduleTime) dom.modalScheduleTime.classList.toggle('is-all-day', scheduleTimeState.allDay);
    if (dom.btnScheduleAllDay) dom.btnScheduleAllDay.setAttribute('aria-pressed', scheduleTimeState.allDay ? 'true' : 'false');
    const disabled = scheduleTimeState.allDay;
    [dom.scheduleTimeStartHour, dom.scheduleTimeStartMinute, dom.scheduleTimeEndHour, dom.scheduleTimeEndMinute].forEach((container) => {
        if (!container) return;
        container.classList.toggle('is-disabled', disabled);
        container.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
}

function openScheduleTimePicker(row, anchorEl) {
    if (!dom.modalScheduleTime) return;
    scheduleTimeTargetRow = row;
    scheduleTimeState = readScheduleTimeState(row);
    renderScheduleTimeOptions();
    openScrollPopover(dom.modalScheduleTime, anchorEl);
}

function closeScheduleTimePicker() {
    if (!dom.modalScheduleTime) return;
    dom.modalScheduleTime.classList.add('hidden');
    dom.modalScheduleTime.classList.remove('active');
    dom.modalScheduleTime.classList.remove('is-centered');
    dom.modalScheduleTime.setAttribute('aria-hidden', 'true');
    const content = dom.modalScheduleTime.querySelector('.modal-content');
    if (content) {
        content.style.top = '';
        content.style.left = '';
    }
    scheduleTimeTargetRow = null;
    scheduleTimeState = null;
}

function setScheduleAllDay(enabled) {
    if (!scheduleTimeState) return;
    scheduleTimeState.allDay = enabled;
    renderScheduleTimeOptions();
}

function applyScheduleTimeSelection() {
    if (!scheduleTimeTargetRow || !scheduleTimeState) return;
    const targetRow = scheduleTimeTargetRow;
    finalizeScrollPicker(dom.scheduleTimeStartHour);
    finalizeScrollPicker(dom.scheduleTimeStartMinute);
    finalizeScrollPicker(dom.scheduleTimeEndHour);
    finalizeScrollPicker(dom.scheduleTimeEndMinute);
    const startHour = scheduleTimeState.startHour || '';
    const startMinute = scheduleTimeState.startMinute || (startHour ? '00' : '');
    const endHour = scheduleTimeState.endHour || '';
    const endMinute = scheduleTimeState.endMinute || (endHour ? '00' : '');
    const allDay = !!scheduleTimeState.allDay;
    scheduleTimeTargetRow.dataset.allDay = allDay ? 'true' : 'false';
    const startHourInput = scheduleTimeTargetRow.querySelector('[data-role="start-hour"]');
    const startMinuteInput = scheduleTimeTargetRow.querySelector('[data-role="start-minute"]');
    const endHourInput = scheduleTimeTargetRow.querySelector('[data-role="end-hour"]');
    const endMinuteInput = scheduleTimeTargetRow.querySelector('[data-role="end-minute"]');
    const allDayInput = scheduleTimeTargetRow.querySelector('[data-role="all-day"]');
    if (startHourInput) startHourInput.value = allDay ? '' : startHour;
    if (startMinuteInput) startMinuteInput.value = allDay ? '' : startMinute;
    if (endHourInput) endHourInput.value = allDay ? '' : endHour;
    if (endMinuteInput) endMinuteInput.value = allDay ? '' : endMinute;
    if (allDayInput) allDayInput.value = allDay ? '1' : '';
    const start = allDay ? '' : combineTime(startHour, startMinute);
    const end = allDay ? '' : combineTime(endHour, endMinute);
    const label = buildScheduleTimeButtonLabel(start, end, allDay);
    const markup = buildScheduleTimeButtonMarkup(start, end, allDay);
    const timeBtn = scheduleTimeTargetRow.querySelector('[data-role="time-btn"]');
    if (timeBtn) {
        timeBtn.innerHTML = markup;
        timeBtn.setAttribute('aria-label', label);
    }
    closeScheduleTimePicker();
    if (dom.calendarScheduleList && targetRow && dom.calendarScheduleList.contains(targetRow)) {
        queueCalendarScheduleSave();
    }
}

function renderScheduleRows(items = []) {
    if (!dom.inputSchedule) return;
    const list = Array.isArray(items) && items.length ? items : [{ start: '', end: '', title: '' }];
    dom.inputSchedule.innerHTML = '';
    list.forEach((item, index) => {
        const startParts = splitTimeParts(item.start);
        const endParts = splitTimeParts(item.end);
        const row = document.createElement('div');
        row.className = 'schedule-row';
        const isLast = index === list.length - 1;
        const showRemove = list.length > 1;
        const allDay = !!(item.allDay || item.all_day);
        row.dataset.allDay = allDay ? 'true' : 'false';
        const timeLabel = buildScheduleTimeButtonLabel(item.start || '', item.end || '', allDay);
        const timeMarkup = buildScheduleTimeButtonMarkup(item.start || '', item.end || '', allDay);
        row.innerHTML = `
            <div class="schedule-time">
                <button type="button" class="schedule-time-btn journal-input" data-role="time-btn" aria-label="${escapeHtml(timeLabel)}">
                    ${timeMarkup}
                </button>
                <input type="hidden" data-role="start-hour" value="${escapeHtml(startParts.hour)}">
                <input type="hidden" data-role="start-minute" value="${escapeHtml(startParts.minute)}">
                <input type="hidden" data-role="end-hour" value="${escapeHtml(endParts.hour)}">
                <input type="hidden" data-role="end-minute" value="${escapeHtml(endParts.minute)}">
                <input type="hidden" data-role="all-day" value="${allDay ? '1' : ''}">
            </div>
            <input type="text" class="schedule-title-input journal-input" data-role="title" placeholder="予定を記入" value="${escapeHtml(item.title || '')}">
            <div class="schedule-actions">
                ${showRemove ? '<button type="button" class="schedule-remove-btn journal-input" aria-label="予定を削除">−</button>' : '<span class="schedule-remove-spacer"></span>'}
                ${isLast ? '<button type="button" class="schedule-add-btn journal-input" aria-label="予定を追加">+</button>' : '<span class="schedule-add-spacer"></span>'}
            </div>
        `;
        dom.inputSchedule.appendChild(row);
    });
}

function collectScheduleRowsRaw() {
    if (!dom.inputSchedule) return [];
    const rows = [];
    dom.inputSchedule.querySelectorAll('.schedule-row').forEach((row) => {
        const startHour = row.querySelector('[data-role="start-hour"]')?.value || '';
        const startMinute = row.querySelector('[data-role="start-minute"]')?.value || '';
        const endHour = row.querySelector('[data-role="end-hour"]')?.value || '';
        const endMinute = row.querySelector('[data-role="end-minute"]')?.value || '';
        const allDay = row.querySelector('[data-role="all-day"]')?.value === '1' || row.dataset.allDay === 'true';
        const start = allDay ? '' : combineTime(startHour, startMinute);
        const end = allDay ? '' : combineTime(endHour, endMinute);
        const title = row.querySelector('[data-role="title"]')?.value.trim() || '';
        rows.push({ start, end, title, allDay });
    });
    return rows;
}

function snapTimeToStep(value, stepMinutes = 5) {
    if (!value) return '';
    const parts = String(value).split(':');
    if (parts.length < 2) return value;
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    const total = hour * 60 + minute;
    const max = 23 * 60 + 55;
    const snapped = Math.min(Math.max(Math.round(total / stepMinutes) * stepMinutes, 0), max);
    const h = String(Math.floor(snapped / 60)).padStart(2, '0');
    const m = String(snapped % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function collectScheduleRows() {
    if (!dom.inputSchedule) return [];
    const rows = [];
    dom.inputSchedule.querySelectorAll('.schedule-row').forEach((row) => {
        const startHour = row.querySelector('[data-role="start-hour"]')?.value || '';
        const startMinute = row.querySelector('[data-role="start-minute"]')?.value || '';
        const endHour = row.querySelector('[data-role="end-hour"]')?.value || '';
        const endMinute = row.querySelector('[data-role="end-minute"]')?.value || '';
        const allDay = row.querySelector('[data-role="all-day"]')?.value === '1' || row.dataset.allDay === 'true';
        const start = allDay ? '' : combineTime(startHour, startMinute);
        const end = allDay ? '' : combineTime(endHour, endMinute);
        const title = row.querySelector('[data-role="title"]')?.value.trim() || '';
        if (allDay || start || end || title) rows.push({ start, end, title, allDay });
    });
    return rows;
}

function renderScheduleDisplay(items = []) {
    const safeItems = Array.isArray(items) ? items : [];
    if (!safeItems.length) return '<div class="schedule-display-empty">---</div>';
    return safeItems.map((item) => {
        const start = String(item.start || '').trim();
        const end = String(item.end || '').trim();
        const title = String(item.title || '').trim();
        const allDay = !!(item.allDay || item.all_day);
        const timeLabel = allDay
            ? '<div class="schedule-time-label">終日</div>'
            : (start || end ? `<div class="schedule-time-label">${escapeHtml(start || '--:--')}<span>${escapeHtml(end || '--:--')}</span></div>` : '');
        const titleLabel = title ? escapeHtml(title) : '---';
        return `<div class="schedule-display-row">${timeLabel}<div class="schedule-title-label">${titleLabel}</div></div>`;
    }).join('');
}

function renderBrowsingLinks(value, placeholder) {
    const text = String(value || '').trim();
    if (!text || text === '\u672a\u8a18\u5165') {
        return `<span class="journal-read-muted">${placeholder}</span>`;
    }
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
        return `<span class="journal-read-muted">${placeholder}</span>`;
    }
    const links = lines.map((line) => {
        const href = /^https?:\/\//i.test(line) ? line : `https://${line}`;
        const safeHref = encodeURI(href);
        const label = escapeHtml(line);
        return `<a class="journal-read-link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    return `<div class="journal-read-links">${links.join('')}</div>`;
}

function getJournalFromEntry(entry) {
    const meta = entry && entry.meta && entry.meta.journal ? entry.meta.journal : {};
    const journal = entry && entry.journal ? entry.journal : {};
    const source = { ...meta, ...journal };
    const meals = source.meals || {};
    const emotionPrimary = source.emotion_primary || source.emotionPrimary || '';
    const emotionSecondary = source.emotion_secondary || source.emotionSecondary || '';
    const emotionCompound = source.emotion_compound || source.emotionCompound || getCompoundEmotion(emotionPrimary, emotionSecondary);
    const rawLocations = source.locations || source.location_slots || source.locationSlots || [];
    const locations = Array.isArray(rawLocations) ? rawLocations.map(normalizeLocationItem) : [];
    let primaryLocation = source.location || '';
    let primaryLabel = source.location_label || source.locationLabel || '';
    if (locations.length) {
        const primary = normalizeLocationItem(locations[0]);
        if (primary.coords) primaryLocation = primary.coords;
        if (primary.label) primaryLabel = primary.label;
    }
    return {
        highlight: source.highlight || '',
        mood: source.mood || '',
        emotionPrimary,
        emotionSecondary,
        emotionCompound,
        satisfaction: source.satisfaction || '',
        done: source.done || '',
        notDone: source.not_done || '',
        nextPlan: source.next_plan || '',
        locations,
        location: primaryLocation,
        locationLabel: primaryLabel,
        browsing: source.browsing || '',
        memo: source.memo || '',
        schedule: normalizeScheduleItems(source.schedule || source.schedule_items || ''),
        meals: {
            breakfast: meals.breakfast || '',
            lunch: meals.lunch || '',
            dinner: meals.dinner || ''
        },
        weight: source.weight || '',
        sleepHours: source.sleep_hours || '',
        focus: source.focus || source.focus_time || source.focus_hours || '',
        workout: source.workout || source.workout_time || source.workout_hours || ''
    };
}

function fillJournalInputs(journal) {
    if (dom.inputHighlight) dom.inputHighlight.value = journal.highlight || '';
    if (dom.inputDone) dom.inputDone.value = journal.done || '';
    if (dom.inputNotDone) dom.inputNotDone.value = journal.notDone || '';
    if (dom.inputNextPlan) dom.inputNextPlan.value = journal.nextPlan || '';
    const fallbackLocations = journal.location || journal.locationLabel
        ? [{ coords: journal.location || '', label: journal.locationLabel || '' }]
        : [];
    applyLocationSlots(journal.locations && journal.locations.length ? journal.locations : fallbackLocations);
    if (dom.inputBrowsing) dom.inputBrowsing.value = journal.browsing || '';
    if (dom.inputMemo) dom.inputMemo.value = journal.memo || '';
    renderScheduleRows(journal.schedule || []);
    if (dom.inputMealBreakfast) dom.inputMealBreakfast.value = journal.meals.breakfast || '';
    if (dom.inputMealLunch) dom.inputMealLunch.value = journal.meals.lunch || '';
    if (dom.inputMealDinner) dom.inputMealDinner.value = journal.meals.dinner || '';
    if (dom.inputWeight) dom.inputWeight.value = journal.weight || '';
    if (dom.inputSleep) dom.inputSleep.value = journal.sleepHours || '';
    if (dom.inputFocus) dom.inputFocus.value = journal.focus || '';
    if (dom.inputWorkout) dom.inputWorkout.value = journal.workout || '';
    updateSleepButton();
    updateWeightButton();
    updateFocusButton();
    updateWorkoutButton();
    if (dom.inputEmotionPrimary) dom.inputEmotionPrimary.value = journal.emotionPrimary || '';
    if (dom.inputEmotionSecondary) dom.inputEmotionSecondary.value = journal.emotionSecondary || '';
    updateEmotionControls();
    if (dom.inputSatisfaction) {
        dom.inputSatisfaction.value = journal.satisfaction ? String(journal.satisfaction) : '';
        updateSatisfactionButton();
    }
    updateLocationPreview(journal.location || '', journal.locationLabel || '', 320);
    updateSummaryDate(appState.writingDate || getJournalDateNow());
}

function fillJournalDisplays(journal) {
    const placeholder = '\u2014\u2014\u2014';
    if (dom.displayHighlight) dom.displayHighlight.textContent = journal.highlight || placeholder;
    if (dom.displayEmotion) dom.displayEmotion.textContent = formatEmotionPair(journal.emotionPrimary, journal.emotionSecondary, journal.emotionCompound);
    if (dom.displaySatisfaction) dom.displaySatisfaction.textContent = formatScale(journal.satisfaction);
    if (dom.displayDone) dom.displayDone.textContent = journal.done || placeholder;
    if (dom.displayNotDone) dom.displayNotDone.textContent = journal.notDone || placeholder;
    if (dom.displayNextPlan) dom.displayNextPlan.textContent = journal.nextPlan || placeholder;
    if (dom.displayLocation) dom.displayLocation.innerHTML = renderLocationMarkup(journal.location, 220);
    if (dom.displayBrowsing) dom.displayBrowsing.textContent = journal.browsing || placeholder;
    if (dom.displayMemo) dom.displayMemo.textContent = journal.memo || placeholder;
    if (dom.displaySchedule) dom.displaySchedule.innerHTML = renderScheduleDisplay(journal.schedule || []);
    if (dom.displayMeals) {
        const breakfast = journal.meals.breakfast || placeholder;
        const lunch = journal.meals.lunch || placeholder;
        const dinner = journal.meals.dinner || placeholder;
        dom.displayMeals.innerHTML = `
            <div>\u671d: ${escapeHtml(breakfast)}</div>
            <div>\u663c: ${escapeHtml(lunch)}</div>
            <div>\u591c: ${escapeHtml(dinner)}</div>
        `;
    }
    if (dom.displayWeight) dom.displayWeight.textContent = formatWithUnit(journal.weight, 'kg');
    if (dom.displaySleep) dom.displaySleep.textContent = formatWithUnit(journal.sleepHours, '時間');
    if (dom.displayFocus) dom.displayFocus.textContent = journal.focus || placeholder;
    if (dom.displayWorkout) dom.displayWorkout.textContent = journal.workout || placeholder;
}

function clearJournalFields() {
    fillJournalInputs({
        highlight: '',
        emotionPrimary: '',
        emotionSecondary: '',
        satisfaction: '',
        done: '',
        notDone: '',
        nextPlan: '',
        locations: [],
        location: '',
        browsing: '',
        memo: '',
        schedule: [],
        meals: { breakfast: '', lunch: '', dinner: '' },
        weight: '',
        sleepHours: '',
        focus: '',
        workout: ''
    });
    fillJournalDisplays({
        highlight: '',
        emotionPrimary: '',
        emotionSecondary: '',
        satisfaction: '',
        done: '',
        notDone: '',
        nextPlan: '',
        locations: [],
        location: '',
        browsing: '',
        memo: '',
        schedule: [],
        meals: { breakfast: '', lunch: '', dinner: '' },
        weight: '',
        sleepHours: '',
        focus: '',
        workout: ''
    });
    applyLocationSlots([]);
    updateLocationPreview('', '', 320);
    updateSummaryDate(appState.writingDate || getJournalDateNow());
}

function ensureLocationPickerMap() {
    if (locationPickerMap || !dom.locationMap || !window.L) return;
    locationPickerMap = L.map(dom.locationMap, {
        zoomControl: true,
        attributionControl: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(locationPickerMap);
    locationPickerMap.on('click', (event) => {
        const latlng = event.latlng;
        locationPickerLatLng = latlng;
        if (!locationPickerMarker) {
            locationPickerMarker = L.marker(latlng).addTo(locationPickerMap);
        } else {
            locationPickerMarker.setLatLng(latlng);
        }
    });
}

function openLocationPicker() {
    if (!dom.modalLocation) return;
    if (!window.L) {
        showToast('地図を読み込めませんでした', 'error');
        return;
    }
    dom.modalLocation.classList.remove('hidden');
    dom.modalLocation.classList.add('active');
    dom.modalLocation.style.display = 'flex';
    dom.modalLocation.style.opacity = '1';
    dom.modalLocation.style.visibility = 'visible';
    dom.modalLocation.style.zIndex = '2000';
    dom.modalLocation.style.position = 'fixed';
    dom.modalLocation.style.top = '0';
    dom.modalLocation.style.left = '0';
    dom.modalLocation.style.right = '0';
    dom.modalLocation.style.bottom = '0';
    dom.modalLocation.style.width = '100vw';
    dom.modalLocation.style.height = '100vh';
    syncLocationSearchInputs();
    clearLocationSuggestions(dom.locationSuggestionsModal);
    ensureLocationPickerMap();
    const slot = getActiveLocationSlot();
    const slotCoords = slot ? String(slot.dataset.coords || '').trim() : '';
    const coords = parseLatLng(slotCoords || (dom.inputLocation ? dom.inputLocation.value : ''));
    const defaultCenter = { lat: 35.68124, lng: 139.76712 };
    const center = coords || defaultCenter;
    if (locationPickerMap) {
        locationPickerMap.setView([center.lat, center.lng], coords ? 15 : 12);
        if (coords) {
            locationPickerLatLng = L.latLng(coords.lat, coords.lng);
            if (!locationPickerMarker) {
                locationPickerMarker = L.marker(locationPickerLatLng).addTo(locationPickerMap);
            } else {
                locationPickerMarker.setLatLng(locationPickerLatLng);
            }
        } else if (locationPickerMarker) {
            locationPickerMap.removeLayer(locationPickerMarker);
            locationPickerMarker = null;
            locationPickerLatLng = null;
        }
        setTimeout(() => locationPickerMap.invalidateSize(), 50);
    }
}

function closeLocationPicker() {
    if (!dom.modalLocation) return;
    dom.modalLocation.classList.add('hidden');
    dom.modalLocation.classList.remove('active');
    dom.modalLocation.removeAttribute('style');
}

function confirmLocationPicker() {
    if (!locationPickerLatLng || !dom.inputLocation) {
        closeLocationPicker();
        return;
    }
    const lat = locationPickerLatLng.lat;
    const lng = locationPickerLatLng.lng;
    const coordsText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const manualLabel = dom.inputLocationSearchModal ? dom.inputLocationSearchModal.value.trim() : '';
    applyLocationToSlot(activeLocationSlotIndex, coordsText, manualLabel);
    reverseGeocode(lat, lng)
        .then((label) => {
            const resolvedLabel = manualLabel || label || '選択した場所';
            if (dom.inputLocationSearch) dom.inputLocationSearch.value = resolvedLabel;
            if (dom.inputLocationSearchModal) dom.inputLocationSearchModal.value = resolvedLabel;
            applyLocationToSlot(activeLocationSlotIndex, coordsText, resolvedLabel);
        })
        .catch(() => {
            const fallbackLabel = manualLabel || '選択した場所';
            if (dom.inputLocationSearch) dom.inputLocationSearch.value = fallbackLabel;
            if (dom.inputLocationSearchModal) dom.inputLocationSearchModal.value = fallbackLabel;
            applyLocationToSlot(activeLocationSlotIndex, coordsText, fallbackLabel);
        });
    closeLocationPicker();
}

function updateLocationPreview(value, label, size) {
    if (!dom.locationPreview) return;
    const text = String(value || (dom.inputLocation ? dom.inputLocation.value : '')).trim();
    const labelText = String(label || (dom.locationLabel ? dom.locationLabel.textContent : '')).trim();
    if (dom.locationLabel) {
        if (labelText) {
            dom.locationLabel.textContent = labelText;
            dom.locationLabel.classList.remove('hidden');
        } else {
            dom.locationLabel.textContent = '';
            dom.locationLabel.classList.add('hidden');
        }
    }
    if (!text) {
        dom.locationPreview.innerHTML = '';
        dom.locationPreview.classList.add('hidden');
        return;
    }
    dom.locationPreview.innerHTML = renderLocationMarkup(text, size || 320);
    dom.locationPreview.classList.remove('hidden');
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
        showToast('\u30fbFirebase\u304c\u521d\u671f\u5316\u3055\u308c\u3066\u3044\u307e\u305b\u3093', 'error');
        console.error('[auth] not initialized', { hasAuth: !!window.auth, hasProvider: !!window.googleProvider });
        return;
    }
    try {
        await window.auth.signInWithPopup(window.googleProvider);
    } catch (e) {
        const code = e && e.code ? e.code : '';
        console.error('[auth] login failed', { code, message: e && e.message });
        if (code in { 'auth/popup-blocked': 1, 'auth/cancelled-popup-request': 1, 'auth/popup-closed-by-user': 1 }) {
            showToast('\u30dd\u30c3\u30d7\u30a2\u30c3\u30d7\u304c\u30d6\u30ed\u30c3\u30af\u3055\u308c\u307e\u3057\u305f\u3002\u30ea\u30c0\u30a4\u30ec\u30af\u30c8\u3067\u518d\u8a66\u884c\u3057\u307e\u3059\u3002', 'error');
            await window.auth.signInWithRedirect(window.googleProvider);
            return;
        }
        if (code === 'auth/unauthorized-domain') {
            showToast('\u3053\u306e\u30c9\u30e1\u30a4\u30f3\u306f\u8a8d\u8a3c\u306e\u8a31\u53ef\u30c9\u30e1\u30a4\u30f3\u306b\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002Firebase \u30b3\u30f3\u30bd\u30fc\u30eb\u3067\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002', 'error');
            return;
        }
        showToast(`\u30ed\u30b0\u30a4\u30f3\u306b\u5931\u6557\u3057\u307e\u3057\u305f${code ? ` (${code})` : ''}`, 'error');
    }
}

async function handleLogout() {
    if (!window.auth) return;
    try {
        await window.auth.signOut();
        showToast('\u30ed\u30b0\u30a2\u30a6\u30c8\u3057\u307e\u3057\u305f');
    } catch (e) {
        console.error('[auth] logout failed', { code: e.code, message: e.message });
        showToast('\u30ed\u30b0\u30a2\u30a6\u30c8\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
    }
}

async function handleUpdatePassword() {
    if (!appState.user || !window.auth || !window.googleProvider) {
        showToast('\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044', 'error');
        return;
    }
    const currentPass = dom.inputCurrentPass ? dom.inputCurrentPass.value : '';
    const nextPass = dom.inputNewPass ? dom.inputNewPass.value : '';
    if (appState.masterPassword && currentPass !== appState.masterPassword) {
        showToast('\u73fe\u5728\u306e\u30d1\u30b9\u30ef\u30fc\u30c9\u304c\u9055\u3044\u307e\u3059', 'error');
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
        showToast('\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f');
    } catch (e) {
        console.error('[auth] reauth failed', { code: e.code, message: e.message });
        showToast('\u8a8d\u8a3c\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
    }
}

async function handleForgotPassword() {
    if (!appState.user || !window.auth || !window.googleProvider) {
        showToast('\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044', 'error');
        return;
    }
    try {
        await window.auth.currentUser.reauthenticateWithPopup(window.googleProvider);
        openResetModal();
    } catch (e) {
        console.error('[auth] reset reauth failed', { code: e.code, message: e.message });
        showToast('\u8a8d\u8a3c\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
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
    showToast('\u30d1\u30b9\u30ef\u30fc\u30c9\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f');
}

function closeSettingsModal() {
    if (!dom.modalSettings) return;
    appState.settingsEditingName = false;
    appState.settingsEditingAvatar = false;
    dom.modalSettings.classList.add('hidden');
    dom.modalSettings.classList.remove('active');
}

function openSettingsModal(sectionId) {
    if (!dom.modalSettings) return;
    if (sectionId) {
        appState.settingsTab = sectionId === 'theme' ? 'appearance' : sectionId;
    }
    renderSettingsPage();
    dom.modalSettings.classList.remove('hidden');
    dom.modalSettings.classList.add('active');
    if (sectionId === 'theme') {
        requestAnimationFrame(() => {
            if (dom.themePicker) dom.themePicker.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
    }
}

async function hashTextSHA256(text) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('WebCrypto is not available');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function openAppPasswordModal() {
    if (!dom.modalAppPassword) return;
    const hasPassword = Boolean(appState.userProfile?.appPasswordHash);
    if (dom.btnAppPasswordRemove) {
        dom.btnAppPasswordRemove.classList.toggle('hidden', !hasPassword);
    }
    if (dom.inputAppPassword) dom.inputAppPassword.value = '';
    if (dom.inputAppPasswordConfirm) dom.inputAppPasswordConfirm.value = '';
    dom.modalAppPassword.classList.remove('hidden');
    dom.modalAppPassword.classList.add('active');
}

function closeAppPasswordModal() {
    if (!dom.modalAppPassword) return;
    dom.modalAppPassword.classList.add('hidden');
    dom.modalAppPassword.classList.remove('active');
}

async function saveAppPassword() {
    const pass = String(dom.inputAppPassword?.value || '').trim();
    const confirmPass = String(dom.inputAppPasswordConfirm?.value || '').trim();
    if (pass.length < 8) {
        showToast('8文字以上で入力してください', 'error');
        return;
    }
    if (pass !== confirmPass) {
        showToast('パスワードが一致しません', 'error');
        return;
    }
    try {
        const hash = await hashTextSHA256(pass);
        await saveUserProfile({ appPasswordHash: hash });
        showToast('保存しました');
        closeAppPasswordModal();
        renderSettingsPage();
    } catch (e) {
        console.warn('Failed to hash password', e);
        showToast('保存に失敗しました', 'error');
    }
}

async function removeAppPassword() {
    if (!confirm('アプリ内パスワードを削除しますか？')) return;
    await saveUserProfile({ appPasswordHash: '' });
    showToast('削除しました');
    closeAppPasswordModal();
    renderSettingsPage();
}

async function saveEntryHelper(options = {}) {
    const { finalize = false, toastMessage = '' } = options;
    if (!appState.user) {
        showToast('\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044', 'error');
        return;
    }

    const content = dom.inputContent ? dom.inputContent.value.trim() : '';
    const emotionPrimary = dom.inputEmotionPrimary ? dom.inputEmotionPrimary.value.trim() : '';
    const emotionSecondary = dom.inputEmotionSecondary ? dom.inputEmotionSecondary.value.trim() : '';
    const normalizedEmotion = normalizeEmotionPair(emotionPrimary, emotionSecondary);
    const emotionCompound = getCompoundEmotion(normalizedEmotion.primary, normalizedEmotion.secondary);
    const satisfactionValue = dom.inputSatisfaction ? Number(dom.inputSatisfaction.value) : 0;
    const scheduleItems = collectScheduleRows();
    const locationSlots = collectLocationSlots();
    const hasLocation = locationSlots.some((slot) => {
        const coords = String(slot.coords || '').trim();
        const label = String(slot.label || '').trim();
        return coords || label;
    });
    const hasAnyInput = [
        content,
        dom.inputMorning ? dom.inputMorning.value : '',
        dom.inputHighlight ? dom.inputHighlight.value : '',
        dom.inputDone ? dom.inputDone.value : '',
        dom.inputNotDone ? dom.inputNotDone.value : '',
        dom.inputNextPlan ? dom.inputNextPlan.value : '',
        dom.inputMealBreakfast ? dom.inputMealBreakfast.value : '',
        dom.inputMealLunch ? dom.inputMealLunch.value : '',
        dom.inputMealDinner ? dom.inputMealDinner.value : '',
        dom.inputWeight ? dom.inputWeight.value : '',
        dom.inputSleep ? dom.inputSleep.value : '',
        dom.inputLocation ? dom.inputLocation.value : '',
        dom.inputBrowsing ? dom.inputBrowsing.value : '',
        dom.inputMemo ? dom.inputMemo.value : '',
        dom.inputFocus ? dom.inputFocus.value : '',
        dom.inputWorkout ? dom.inputWorkout.value : '',
        normalizedEmotion.primary,
        normalizedEmotion.secondary
    ].some(value => String(value || '').trim()) || scheduleItems.length > 0 || satisfactionValue > 0 || !!currentUploadImage || hasLocation;
    if (!hasAnyInput) {
        showToast('入力がありません', 'error');
        return;
    }

    const isLocked = dom.selectLockStatus ? dom.selectLockStatus.value === 'locked' : false;
    const existing = appState.activeEntryId
        ? appState.entries.find(e => e.id === appState.activeEntryId)
        : null;

    const baseDate = existing ? getEntryDate(existing) : (appState.writingDate || getJournalDateNow());
    const entry = existing ? { ...existing } : { created_at: baseDate };
    entry.content = content;
    entry.text = content;
    entry.image = currentUploadImage || null;
    entry.isLocked = isLocked;
    entry.locked = isLocked;
    entry.created_at = entry.created_at || baseDate;
    const primaryLocation = locationSlots[0] || { coords: '', label: '' };
    const journal = {
        highlight: dom.inputHighlight ? dom.inputHighlight.value.trim() : '',
        emotion_primary: normalizedEmotion.primary,
        emotion_secondary: normalizedEmotion.secondary,
        emotion_compound: emotionCompound,
        satisfaction: satisfactionValue > 0 ? satisfactionValue : '',
        locations: locationSlots,
        location: String(primaryLocation.coords || '').trim(),
        location_label: String(primaryLocation.label || '').trim(),
        browsing: dom.inputBrowsing ? dom.inputBrowsing.value.trim() : '',
        memo: dom.inputMemo ? dom.inputMemo.value.trim() : '',
        schedule: scheduleItems,
        done: dom.inputDone ? dom.inputDone.value.trim() : '',
        not_done: dom.inputNotDone ? dom.inputNotDone.value.trim() : '',
        next_plan: dom.inputNextPlan ? dom.inputNextPlan.value.trim() : '',
        meals: {
            breakfast: dom.inputMealBreakfast ? dom.inputMealBreakfast.value.trim() : '',
            lunch: dom.inputMealLunch ? dom.inputMealLunch.value.trim() : '',
            dinner: dom.inputMealDinner ? dom.inputMealDinner.value.trim() : ''
        },
        weight: dom.inputWeight ? dom.inputWeight.value.trim() : '',
        sleep_hours: dom.inputSleep ? dom.inputSleep.value.trim() : '',
        focus: dom.inputFocus ? dom.inputFocus.value.trim() : '',
        workout: dom.inputWorkout ? dom.inputWorkout.value.trim() : ''
    };
    const existingStatus = existing && existing.meta ? existing.meta.status : null;
    const nextStatus = finalize ? 'final' : (existing ? (existingStatus || 'final') : 'draft');
    const becameFinal = finalize && (!existing || existingStatus === 'draft');
    entry.meta = { ...(entry.meta || {}), status: nextStatus, journal };
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

    showToast(toastMessage || (finalize ? '\u8ffd\u52a0\u3057\u307e\u3057\u305f' : '\u4fdd\u5b58\u3057\u307e\u3057\u305f'));
    if (finalize) {
        showEditorCompletion(entry);
    } else if (existing && isFinalEntry(entry)) {
        openEntry(entryId);
    }
    if (becameFinal && appState.currentView === 'calendar') renderCalendar();
    renderEntryList();
    if (appState.currentView === 'calendar') renderCalendar();
    if (appState.currentView === 'mypage') renderMyPage();

    const shouldAnalyze = finalize || isFinalEntry(entry);
    if (shouldAnalyze) {
        const analysisOk = await runAnalysisForEntry(entry, !isNew);
        if (analysisOk) {
            await updateSummaryForCurrentPeriod();
        }
        await maybeRunAggregateInsight(entry, becameFinal);
        if (appState.currentView === 'mypage') renderMyPage();
    }
    return entry;
}

async function addEntryHelper() {
    if (!appState.user) {
        showToast('\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044', 'error');
        return;
    }
    const baseDate = appState.writingDate || getJournalDateNow();
    const existingFinal = findFinalEntryForDate(baseDate);
    if (existingFinal) {
        showEditorCompletion(existingFinal);
        return;
    }
    await saveEntryHelper({ finalize: true, toastMessage: '\u8ffd\u52a0\u3057\u307e\u3057\u305f' });
}

async function saveEntryEditsFromCard(entry, card) {
    if (!entry || !card) return false;
    const getValue = (field) => {
        const el = card.querySelector(`[data-field="${field}"]`);
        return el ? el.value.trim() : '';
    };
    const content = getValue('content');
    const scheduleText = getValue('schedule');
    const emotionPrimary = getValue('emotion_primary');
    const emotionSecondary = getValue('emotion_secondary');
    const normalizedEmotion = normalizeEmotionPair(emotionPrimary, emotionSecondary);
    const existingLocations = Array.isArray(entry.journal?.locations) ? entry.journal.locations : [];
    const nextLocations = existingLocations.length
        ? existingLocations.map(normalizeLocationItem)
        : [];
    const updatedLocation = getValue('location');
    const updatedLocationLabel = entry.journal?.location_label || entry.meta?.journal?.location_label || '';
    if (updatedLocation || updatedLocationLabel) {
        if (nextLocations.length) {
            nextLocations[0] = { coords: updatedLocation, label: updatedLocationLabel };
        } else {
            nextLocations.push({ coords: updatedLocation, label: updatedLocationLabel });
        }
    }
    const journal = {
        highlight: getValue('highlight'),
        emotion_primary: normalizedEmotion.primary,
        emotion_secondary: normalizedEmotion.secondary,
        satisfaction: getValue('satisfaction'),
        locations: nextLocations,
        location: updatedLocation,
        location_label: updatedLocationLabel,
        browsing: getValue('browsing'),
        memo: getValue('memo'),
        schedule: parseScheduleText(scheduleText),
        done: getValue('done'),
        not_done: getValue('not_done'),
        next_plan: getValue('next_plan'),
        meals: {
            breakfast: getValue('meal_breakfast'),
            lunch: getValue('meal_lunch'),
            dinner: getValue('meal_dinner')
        },
        weight: getValue('weight'),
        sleep_hours: getValue('sleep_hours'),
        focus: entry.journal?.focus || entry.meta?.journal?.focus || '',
        workout: entry.journal?.workout || entry.meta?.journal?.workout || ''
    };

    const updated = { ...entry };
    updated.content = content;
    updated.text = content;
    updated.meta = { ...(updated.meta || {}), status: getEntryStatus(entry), journal };
    updated.journal = journal;

    const entryId = await saveEntryToFirestore(updated);
    if (!entryId) return false;

    const index = appState.entries.findIndex(e => e.id === entryId);
    if (index >= 0) {
        appState.entries[index] = updated;
    } else {
        appState.entries.unshift(updated);
    }

    showToast('\u7de8\u96c6\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f');
    renderEntryList();
    if (appState.currentView === 'calendar') renderCalendar();
    if (appState.currentView === 'mypage') renderMyPage();
    return true;
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
        if (appState.currentView === 'editor') {
            updateEditorAdvice(appState.writingDate || getJournalDateNow());
        }
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
        appState.userProfile = doc.exists ? (doc.data() || {}) : {};
        appState.userProfileLoaded = true;
        applyWallpaper(appState.userProfile?.wallpaperUrl || '');
        appState.friendState = null;
        appState.friendRequestsLoaded = false;
        appState.friendSchedulesByDate = {};
        await ensureFriendId();
        await loadFriendRequests();
        await loadScreeningProfile();
        renderMonthlyGoal();
        setupJournalLayout();
        if (appState.currentView === 'calendar') updateCalendarSidePanel();
    } catch (e) {
        console.warn('Error loading user profile:', e);
        appState.userProfile = {};
        appState.userProfileLoaded = true;
        appState.screeningProfile = null;
        applyWallpaper('');
        renderMonthlyGoal();
    }
}

async function saveUserProfile(update) {
    const db = window.db;
    if (!db || !appState.user) return;
    appState.userProfile = { ...(appState.userProfile || {}), ...update };
    try {
        await db.collection('users').doc(appState.user.uid).set(appState.userProfile, { merge: true });
        const friendId = appState.userProfile?.friend_id || appState.userProfile?.friendId;
        if (friendId && (Object.prototype.hasOwnProperty.call(update, 'displayName') || Object.prototype.hasOwnProperty.call(update, 'avatarUrl'))) {
            await db.collection('friend_ids').doc(friendId).set({
                uid: appState.user.uid,
                displayName: appState.userProfile.displayName || getProfileDisplayName(),
                avatarUrl: appState.userProfile.avatarUrl || ''
            }, { merge: true });
        }
    } catch (e) {
        console.warn('Error saving user profile:', e);
    }
}

async function loadScreeningProfile() {
    const db = window.db;
    if (!db || !appState.user) {
        appState.screeningProfile = null;
        appState.screeningError = '';
        return null;
    }
    try {
        const doc = await db.collection('screening_profiles').doc(appState.user.uid).get();
        appState.screeningProfile = doc.exists ? (doc.data() || null) : null;
        appState.screeningError = '';
        return appState.screeningProfile;
    } catch (err) {
        console.warn('[screening] failed to load profile', err);
        appState.screeningProfile = null;
        appState.screeningError = '自己スクリーニング結果の取得に失敗しました';
        return null;
    } finally {
        if (appState.currentView === 'mypage') renderMyPage();
        if (appState.currentView === 'questions' && appState.questionsViewMode === 'persona') {
            renderPersonaLayerSelector();
        }
    }
}

async function recomputeScreeningProfile(triggerAnswerId = '') {
    if (!appState.user) return null;
    appState.screeningLoading = true;
    appState.screeningError = '';
    if (appState.currentView === 'mypage') renderMyPage();
    try {
        const result = await apiPost('/api/screening/recompute', {
            user_id: appState.user.uid,
            trigger_answer_id: triggerAnswerId || ''
        }, {
            timeoutMs: 12000,
            useAuth: true
        });
        appState.screeningProfile = result?.profile || null;
        return appState.screeningProfile;
    } catch (err) {
        console.warn('[screening] recompute failed', err);
        appState.screeningError = '自己スクリーニング結果の更新に失敗しました';
        showToast('診断結果の更新に失敗しました。しばらくして再試行してください。', 'error');
        await loadScreeningProfile();
        return appState.screeningProfile;
    } finally {
        appState.screeningLoading = false;
        if (appState.currentView === 'mypage') renderMyPage();
        if (appState.currentView === 'questions' && appState.questionsViewMode === 'persona') {
            renderPersonaLayerSelector();
        }
    }
}

// --- Questions & Answers ---
async function loadQuestionsAndAnswers() {
    const db = window.db;
    if (!db) return;
    // Fixed 5-layer baseline questions are managed in-client; skip remote sync to avoid
    // blocking flows when diagnosis_versions rules are not configured.

    const isAdmin = isAdminUser();
    let questionQuery = db.collection('questions');
    if (!isAdmin) {
        questionQuery = questionQuery.where('isPublished', '==', true);
    }

    try {
        let questionSnapshot;
        try {
            questionSnapshot = await questionQuery.orderBy('createdAt', 'desc').get();
        } catch (err) {
            questionSnapshot = await questionQuery.get();
        }

        const firestoreQuestions = questionSnapshot.docs
            .map((doc) => normalizeQuestionRecord(doc.id, doc.data() || {}))
            .map((question) => ({ ...question, isFixed: !!question.isFixed }));
        const fixedQuestions = getPersonaBaselineQuestions();
        const questionMap = new Map();
        const baselineQuestionIds = new Set(fixedQuestions.map((question) => question.id));
        firestoreQuestions.forEach((question) => {
            // Baseline IDs are always controlled by fixed in-app definitions.
            if (baselineQuestionIds.has(question.id)) return;
            questionMap.set(question.id, question);
        });
        fixedQuestions.forEach((question) => {
            questionMap.set(question.id, question);
        });

        appState.questions = Array.from(questionMap.values())
            .sort((left, right) => {
                if (left.isBaseline && right.isBaseline) {
                    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : Number.MAX_SAFE_INTEGER;
                    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : Number.MAX_SAFE_INTEGER;
                    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                } else if (left.isBaseline !== right.isBaseline) {
                    return left.isBaseline ? -1 : 1;
                }
                const leftScreening = left.category === SCREENING_CATEGORY;
                const rightScreening = right.category === SCREENING_CATEGORY;
                if (leftScreening && rightScreening) {
                    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : Number.MAX_SAFE_INTEGER;
                    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : Number.MAX_SAFE_INTEGER;
                    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                }
                const leftDate = toDateValue(left.createdAt);
                const rightDate = toDateValue(right.createdAt);
                return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
            });
    } catch (err) {
        console.warn('[questions] failed to load questions', err);
        appState.questions = [];
    }

    const baselineDefaults = getPersonaBaselineQuestions();
    if (baselineDefaults.length) {
        const existingQuestionIds = new Set(appState.questions.map((question) => question.id));
        const missingBaselineQuestions = baselineDefaults.filter((question) => !existingQuestionIds.has(question.id));
        if (missingBaselineQuestions.length) {
            appState.questions = [...missingBaselineQuestions, ...appState.questions];
        }
    }

    if (isAdmin) {
        await loadAnswerCountsForAdmin();
    } else {
        appState.answerCountsByQuestionId = {};
    }

    if (!appState.user) {
        appState.answers = [];
        appState.answersById = {};
        appState.currentQuestionId = null;
        appState.currentQuestionChoice = '';
        renderQuestionsPage();
        return;
    }

    try {
        let answersSnapshot;
        const answersQuery = db.collection('answers').where('userId', '==', appState.user.uid);
        try {
            answersSnapshot = await answersQuery.orderBy('updatedAt', 'desc').get();
        } catch (err) {
            answersSnapshot = await answersQuery.get();
        }

        appState.answers = answersSnapshot.docs.map((doc) => {
            const data = doc.data() || {};
            const question = getQuestionById(data.questionId || '');
            return normalizeAnswerRecord(doc.id, data, question);
        });
        appState.answersById = {};
        appState.answers.forEach((answer) => {
            if (answer.questionId) appState.answersById[answer.questionId] = answer;
        });
    } catch (err) {
        console.warn('[questions] failed to load answers', err);
        appState.answers = [];
        appState.answersById = {};
    }

    renderQuestionsPage();
    loadScreeningProfile();
}

function renderQuestionsPage() {
    if (!dom.viewQuestions) return;
    renderPersonaLayerSelector();
    ensurePersonaProgressBadge();
    setQuestionsViewMode(appState.questionsViewMode || 'answer');
    renderAnswersList();
    updateAnswerEditorState();
    renderQuestionAdminManage();
}

function ensurePersonaProgressBadge() {
    if (personaProgressRef && personaProgressRef.isConnected) return personaProgressRef;
    const header = dom.questionsStageAnswer
        ? dom.questionsStageAnswer.querySelector('.questions-stage-card .questions-card-header')
        : null;
    if (!header) return null;
    let badge = header.querySelector('#persona-question-progress');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'persona-question-progress';
        badge.className = 'persona-question-progress hidden';
        header.appendChild(badge);
    }
    personaProgressRef = badge;
    return badge;
}

function setPersonaProgressBadge(text = '', visible = false) {
    const badge = ensurePersonaProgressBadge();
    if (!badge) return;
    badge.textContent = text;
    badge.classList.toggle('hidden', !visible);
}

function setPersonaInlineProgress({ current = 0, total = 0, visible = false } = {}) {
    if (!dom.personaQuestionProgressInline || !dom.personaQuestionProgressText || !dom.personaQuestionProgressFill) return;
    dom.personaQuestionProgressInline.classList.toggle('hidden', !visible);
    if (!visible || total <= 0) {
        dom.personaQuestionProgressText.textContent = '';
        dom.personaQuestionProgressFill.style.width = '0%';
        const track = dom.personaQuestionProgressFill.parentElement;
        if (track) track.setAttribute('aria-valuenow', '0');
        return;
    }
    const safeCurrent = Math.max(1, Math.min(total, Number(current) || 1));
    const safeTotal = Math.max(1, Number(total) || 1);
    const percent = Math.round((safeCurrent / safeTotal) * 100);
    const remaining = Math.max(0, safeTotal - safeCurrent);
    dom.personaQuestionProgressText.textContent = `${safeCurrent}/${safeTotal}（残り${remaining}問）`;
    dom.personaQuestionProgressFill.style.width = `${percent}%`;
    const track = dom.personaQuestionProgressFill.parentElement;
    if (track) track.setAttribute('aria-valuenow', String(percent));
}

function ensurePersonaLayerSelector() {
    if (dom.personaLayerSelector) return dom.personaLayerSelector;
    const host = dom.currentQuestionBody ? dom.currentQuestionBody.parentElement : null;
    if (!host) return null;

    const selector = document.createElement('div');
    selector.id = 'persona-layer-selector';
    selector.className = 'persona-layer-selector hidden';

    const anchor = dom.currentQuestionTitle || host.firstChild || null;
    if (anchor) {
        host.insertBefore(selector, anchor);
    } else {
        host.appendChild(selector);
    }

    selector.addEventListener('click', async (event) => {
        const button = event.target.closest('.persona-layer-start-btn');
        if (!button) return;
        const selectedLayer = normalizePersonaLayer(button.dataset.layerKey || '');
        if (!selectedLayer) return;
        if (appState.personaSessionActive) {
            if (selectedLayer !== normalizePersonaLayer(appState.personaSessionLayer || '')) {
                showToast('現在の診断が終わるまで他の診断には移動できません', 'error');
            }
            return;
        }
        if ((button.dataset.action || 'start') === 'reset') {
            const label = getPersonaLayerLabel(selectedLayer) || selectedLayer;
            const ok = await openPersonaResetConfirmModal(label);
            if (!ok) return;
            const resetOk = await resetPersonaLayerHistory(selectedLayer);
            if (!resetOk) return;
            renderPersonaLayerSelector();
            renderCurrentQuestion();
            updateAnswerEditorState();
            return;
        }
        await startPersonaLayerSession(selectedLayer);
    });

    dom.personaLayerSelector = selector;
    return selector;
}

let personaStartModalRef = null;
let personaStartTitleRef = null;
let personaStartBodyRef = null;
let personaStartBeginBtnRef = null;
let personaResetConfirmModalRef = null;
let personaResetConfirmMessageRef = null;
let personaResetConfirmDeleteBtnRef = null;
let personaResetConfirmResolver = null;
let personaExitConfirmModalRef = null;
let personaExitConfirmMessageRef = null;
let personaExitConfirmLeaveBtnRef = null;
let personaExitConfirmResolver = null;

function hasPersonaLayerHistory(layerKey, layerInfo = null) {
    const layer = normalizePersonaLayer(layerKey || '');
    if (!layer) return false;
    const info = layerInfo || getPersonaLayerProfileForUi(layer) || {};
    const progress = info.progress || {};
    const answered = Number(progress.answeredCore) || 0;
    const localDraft = ((appState.layerDrafts || {})[layer] || {});
    const draftAnswerCount = Object.keys(localDraft.answers || {}).length;
    const remoteLayers = (((appState.screeningProfile || {}).persona5 || {}).layers || {});
    const remoteLayer = remoteLayers[layer] || {};
    const hasRemoteReady = remoteLayer.status === 'ready' || !!remoteLayer.completedAt;
    return answered > 0 || draftAnswerCount > 0 || hasRemoteReady;
}

function ensurePersonaLayerStartModal() {
    if (personaStartModalRef) return personaStartModalRef;

    const modal = document.createElement('div');
    modal.id = 'modal-persona-start';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content persona-start-modal">
            <div class="modal-header">
                <h3 id="persona-start-title">5レイヤー診断を開始</h3>
                <button id="btn-persona-start-close" class="icon-btn" type="button" aria-label="閉じる">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div id="persona-start-body" class="persona-start-body"></div>
            <div class="modal-actions">
                <button id="btn-persona-start-cancel" class="btn-secondary" type="button">キャンセル</button>
                <button id="btn-persona-start-begin" class="btn-primary" type="button">開始する</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    personaStartModalRef = modal;
    personaStartTitleRef = modal.querySelector('#persona-start-title');
    personaStartBodyRef = modal.querySelector('#persona-start-body');

    const close = () => closePersonaLayerStartModal();
    const closeBtn = modal.querySelector('#btn-persona-start-close');
    const cancelBtn = modal.querySelector('#btn-persona-start-cancel');
    const beginBtn = modal.querySelector('#btn-persona-start-begin');
    personaStartBeginBtnRef = beginBtn;

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (beginBtn) {
        beginBtn.addEventListener('click', async () => {
            const layer = normalizePersonaLayer(appState.personaPendingLayer || '');
            if (!layer) return;
            await startPersonaLayerSession(layer);
        });
    }
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });

    return modal;
}

function ensurePersonaResetConfirmModal() {
    if (personaResetConfirmModalRef) return personaResetConfirmModalRef;
    const modal = document.createElement('div');
    modal.id = 'modal-persona-reset-confirm';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content persona-reset-confirm-modal">
            <div class="modal-header">
                <h3>再診断の確認</h3>
                <button id="btn-persona-reset-close" class="icon-btn" type="button" aria-label="閉じる">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="persona-reset-confirm-body">
                <p id="persona-reset-confirm-message">過去の診断結果を削除します。よろしいですか？</p>
            </div>
            <div class="modal-actions persona-reset-confirm-actions">
                <button id="btn-persona-reset-cancel" class="btn-secondary" type="button">キャンセル</button>
                <button id="btn-persona-reset-delete" class="btn-primary" type="button">削除する</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    personaResetConfirmModalRef = modal;
    personaResetConfirmMessageRef = modal.querySelector('#persona-reset-confirm-message');
    personaResetConfirmDeleteBtnRef = modal.querySelector('#btn-persona-reset-delete');

    const settle = (value) => {
        if (personaResetConfirmResolver) {
            const resolver = personaResetConfirmResolver;
            personaResetConfirmResolver = null;
            resolver(value);
        }
    };
    const closeWith = (value) => {
        modal.classList.add('hidden');
        modal.classList.remove('active');
        if (personaResetConfirmDeleteBtnRef) {
            personaResetConfirmDeleteBtnRef.disabled = false;
            personaResetConfirmDeleteBtnRef.textContent = '削除する';
        }
        settle(value);
    };

    const closeBtn = modal.querySelector('#btn-persona-reset-close');
    const cancelBtn = modal.querySelector('#btn-persona-reset-cancel');
    if (closeBtn) closeBtn.addEventListener('click', () => closeWith(false));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeWith(false));
    if (personaResetConfirmDeleteBtnRef) {
        personaResetConfirmDeleteBtnRef.addEventListener('click', () => {
            personaResetConfirmDeleteBtnRef.disabled = true;
            personaResetConfirmDeleteBtnRef.textContent = '削除中...';
            closeWith(true);
        });
    }
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeWith(false);
    });
    return modal;
}

function openPersonaResetConfirmModal(layerLabel) {
    const modal = ensurePersonaResetConfirmModal();
    const safeLabel = String(layerLabel || '').trim() || 'このレイヤー';
    if (personaResetConfirmMessageRef) {
        personaResetConfirmMessageRef.textContent = `${safeLabel}はすでに診断済みです。過去の${safeLabel}診断結果と回答を削除します。よろしいですか？`;
    }
    if (personaResetConfirmDeleteBtnRef) {
        personaResetConfirmDeleteBtnRef.disabled = false;
        personaResetConfirmDeleteBtnRef.textContent = '削除する';
    }
    modal.classList.remove('hidden');
    modal.classList.add('active');
    return new Promise((resolve) => {
        personaResetConfirmResolver = resolve;
    });
}

function ensurePersonaExitConfirmModal() {
    if (personaExitConfirmModalRef) return personaExitConfirmModalRef;
    const modal = document.createElement('div');
    modal.id = 'modal-persona-exit-confirm';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content persona-exit-confirm-modal">
            <div class="modal-header">
                <h3>診断を中断しますか？</h3>
                <button id="btn-persona-exit-close" class="icon-btn" type="button" aria-label="閉じる">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="persona-exit-confirm-body">
                <p id="persona-exit-confirm-message">診断は途中保存できません。終了しますか？</p>
            </div>
            <div class="modal-actions persona-exit-confirm-actions">
                <button id="btn-persona-exit-cancel" class="btn-secondary" type="button">キャンセル</button>
                <button id="btn-persona-exit-leave" class="btn-primary" type="button">診断をやめる</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    personaExitConfirmModalRef = modal;
    personaExitConfirmMessageRef = modal.querySelector('#persona-exit-confirm-message');
    personaExitConfirmLeaveBtnRef = modal.querySelector('#btn-persona-exit-leave');

    const settle = (value) => {
        if (personaExitConfirmResolver) {
            const resolver = personaExitConfirmResolver;
            personaExitConfirmResolver = null;
            resolver(value);
        }
    };
    const closeWith = (value) => {
        modal.classList.add('hidden');
        modal.classList.remove('active');
        if (personaExitConfirmLeaveBtnRef) {
            personaExitConfirmLeaveBtnRef.disabled = false;
            personaExitConfirmLeaveBtnRef.textContent = '診断をやめる';
        }
        settle(value);
    };

    const closeBtn = modal.querySelector('#btn-persona-exit-close');
    const cancelBtn = modal.querySelector('#btn-persona-exit-cancel');
    if (closeBtn) closeBtn.addEventListener('click', () => closeWith(false));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeWith(false));
    if (personaExitConfirmLeaveBtnRef) {
        personaExitConfirmLeaveBtnRef.addEventListener('click', () => {
            personaExitConfirmLeaveBtnRef.disabled = true;
            personaExitConfirmLeaveBtnRef.textContent = '終了中...';
            closeWith(true);
        });
    }
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeWith(false);
    });
    return modal;
}

function openPersonaExitConfirmModal(layerLabel) {
    const modal = ensurePersonaExitConfirmModal();
    const safeLabel = String(layerLabel || '').trim() || 'このレイヤー';
    if (personaExitConfirmMessageRef) {
        personaExitConfirmMessageRef.textContent = `${safeLabel}診断は途中保存できません。ここで終了すると回答は保存されず、次回は最初からになります。診断をやめますか？`;
    }
    if (personaExitConfirmLeaveBtnRef) {
        personaExitConfirmLeaveBtnRef.disabled = false;
        personaExitConfirmLeaveBtnRef.textContent = '診断をやめる';
    }
    modal.classList.remove('hidden');
    modal.classList.add('active');
    return new Promise((resolve) => {
        personaExitConfirmResolver = resolve;
    });
}

function openPersonaLayerStartModal(layerKey) {
    const layer = normalizePersonaLayer(layerKey || '');
    if (!layer) return;
    const modal = ensurePersonaLayerStartModal();
    appState.personaPendingLayer = layer;
    const label = getPersonaLayerLabel(layer) || layer;
    appState.personaPendingReset = false;
    if (personaStartTitleRef) {
        personaStartTitleRef.textContent = `${label}診断を開始`;
    }
    if (personaStartBodyRef) {
        personaStartBodyRef.innerHTML = `
            <p>${escapeHtml(label)}に関する質問を連続で回答します。</p>
            <p>診断中は他の診断には移動できません。</p>
        `;
    }
    if (personaStartBeginBtnRef) {
        personaStartBeginBtnRef.textContent = '開始する';
    }
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

function closePersonaLayerStartModal() {
    if (!personaStartModalRef) return;
    personaStartModalRef.classList.add('hidden');
    personaStartModalRef.classList.remove('active');
    appState.personaPendingLayer = '';
    appState.personaPendingReset = false;
    if (personaStartBeginBtnRef) {
        personaStartBeginBtnRef.textContent = '開始する';
    }
}

async function resetPersonaLayerHistory(layerKey, options = {}) {
    const layer = normalizePersonaLayer(layerKey || '');
    const db = window.db;
    if (!layer || !db || !appState.user) return false;
    const silent = options.silent === true;
    const uid = appState.user.uid;
    const questionIds = new Set(getLayerBaselineQuestions(layer).map((question) => question.id));
    try {
        const softErrors = [];
        const answerDocs = appState.answers
            .filter((answer) => questionIds.has(String(answer.questionId || '').trim()))
            .map((answer) => answer.id)
            .filter(Boolean);
        try {
            for (let i = 0; i < answerDocs.length; i += 350) {
                const chunk = answerDocs.slice(i, i + 350);
                const batch = db.batch();
                chunk.forEach((docId) => {
                    batch.delete(db.collection('answers').doc(docId));
                });
                await batch.commit();
            }
        } catch (err) {
            softErrors.push('answers');
            console.warn('[persona] failed to delete layer answers', err);
        }

        const draftDocId = getLayerDraftDocId(layer);
        if (draftDocId) {
            await db.collection('users').doc(uid).collection('layer_drafts').doc(draftDocId).delete().catch((err) => {
                softErrors.push('layer_drafts');
                console.warn('[persona] failed to delete layer draft', err);
            });
        }

        const layerDocId = getPersonaLayerDocId(layer);
        if (layerDocId) {
            try {
                const resultSnap = await db.collection('users').doc(uid)
                    .collection('layer_results')
                    .where('layerId', '==', layerDocId)
                    .get();
                for (let i = 0; i < resultSnap.docs.length; i += 350) {
                    const chunk = resultSnap.docs.slice(i, i + 350);
                    const batch = db.batch();
                    chunk.forEach((doc) => batch.delete(doc.ref));
                    await batch.commit();
                }
            } catch (err) {
                // layer_resultsは環境によって権限未付与でも再診断自体は成立するため、ここは継続する
                softErrors.push('layer_results');
                console.warn('[persona] failed to delete layer results', err);
            }
        }

        appState.answers = appState.answers.filter((answer) => !questionIds.has(String(answer.questionId || '').trim()));
        questionIds.forEach((questionId) => {
            delete appState.answersById[questionId];
        });
        delete appState.layerDrafts[layer];
        if (appState.screeningProfile?.persona5?.layers?.[layer]) {
            delete appState.screeningProfile.persona5.layers[layer];
        }

        appState.screeningError = '';
        if (appState.currentView === 'mypage') {
            renderMyPage();
        } else if (appState.currentView === 'questions') {
            renderPersonaLayerSelector();
        }
        if (softErrors.length) {
            console.info('[persona] reset completed with soft errors:', softErrors);
        }
        if (!silent) {
            showToast('過去の診断結果を削除しました。新しい診断を開始できます。');
        }
        return true;
    } catch (err) {
        console.warn('[persona] failed to reset layer history', err);
        if (!silent) {
            showToast('過去の診断結果の削除に失敗しました', 'error');
        }
        return false;
    }
}

async function startPersonaLayerSession(layerKey) {
    const layer = normalizePersonaLayer(layerKey || '');
    if (!layer) return false;
    appState.personaSessionBooting = true;
    syncPersonaQuestionFocus();
    closePersonaLayerStartModal();
    appState.personaSessionActive = false;
    appState.personaSessionLayer = '';
    appState.personaSessionQueue = [];
    appState.personaSessionIndex = 0;
    appState.currentQuestionId = null;
    appState.currentQuestionChoice = '';
    appState.personaSelectedLayer = layer;
    if (dom.answerBody) dom.answerBody.value = '';
    updateAnswerEditorState();
    try {
        const pool = getPersonaModeQuestions();
        if (!pool.length) {
            showToast('この診断に表示できる質問がありません', 'error');
            appState.personaSessionBooting = false;
            appState.personaSessionActive = false;
            appState.personaSessionLayer = '';
            appState.personaSessionQueue = [];
            appState.personaSessionIndex = 0;
            appState.currentQuestionId = null;
            appState.currentQuestionChoice = '';
            appState.personaSelectedLayer = '';
            renderPersonaLayerSelector();
            renderCurrentQuestion();
            updateAnswerEditorState();
            syncPersonaQuestionFocus();
            return false;
        }

        const validIds = pool.map((question) => question.id);
        const localDraft = appState.layerDrafts[layer] || {};
        let queue = Array.isArray(localDraft.questionOrder)
            ? localDraft.questionOrder.filter((id) => validIds.includes(id))
            : [];
        if (!queue.length) {
            queue = shuffleArrayFisherYates(validIds);
        }
        appState.layerDrafts[layer] = {
            docId: getLayerDraftDocId(layer),
            questionOrder: queue.slice(),
            answers: localDraft.answers && typeof localDraft.answers === 'object'
                ? { ...localDraft.answers }
                : {}
        };

        appState.personaSessionActive = true;
        appState.personaSessionLayer = layer;
        appState.personaSessionQueue = queue;
        const firstUnansweredIndex = queue.findIndex((questionId) => !appState.answersById[questionId]);
        appState.personaSessionIndex = firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0;
        appState.currentQuestionId = appState.personaSessionQueue[appState.personaSessionIndex] || null;
        appState.currentQuestionChoice = '';
        if (dom.answerBody) dom.answerBody.value = '';
        if (!appState.currentQuestionId) {
            appState.personaSessionBooting = false;
            appState.personaSessionActive = false;
            appState.personaSessionLayer = '';
            appState.personaSessionQueue = [];
            appState.personaSessionIndex = 0;
            appState.currentQuestionId = null;
            appState.currentQuestionChoice = '';
            appState.personaSelectedLayer = '';
            renderPersonaLayerSelector();
            renderCurrentQuestion();
            updateAnswerEditorState();
            syncPersonaQuestionFocus();
            showToast('質問の読み込みに失敗しました。再度お試しください。', 'error');
            return false;
        }
        // Apply focus class before rendering to avoid one-frame z-index flicker.
        syncPersonaQuestionFocus();
        renderPersonaLayerSelector();
        renderCurrentQuestion();
        updateAnswerEditorState();
        appState.personaSessionBooting = false;
        syncPersonaQuestionFocus();

        // Try to sync draft remotely in background without blocking question display.
        if (isManagedPersonaDraftLayer(layer) && !personaDraftSyncUnavailable) {
            ensureLayerDraft(layer, pool).then((draft) => {
                if (!draft || !Array.isArray(draft.questionOrder) || !draft.questionOrder.length) return;
                if (!appState.personaSessionActive || appState.personaSessionLayer !== layer) return;
                const syncedQueue = draft.questionOrder.filter((id) => validIds.includes(id));
                if (!syncedQueue.length) return;
                const previousQuestionId = appState.currentQuestionId;
                appState.personaSessionQueue = syncedQueue;
                const previousIndex = previousQuestionId ? syncedQueue.indexOf(previousQuestionId) : -1;
                if (previousIndex >= 0) {
                    appState.personaSessionIndex = previousIndex;
                } else {
                    const nextUnanswered = syncedQueue.findIndex((questionId) => !appState.answersById[questionId]);
                    appState.personaSessionIndex = nextUnanswered >= 0 ? nextUnanswered : 0;
                    appState.currentQuestionId = syncedQueue[appState.personaSessionIndex] || null;
                }
                renderCurrentQuestion();
                updateAnswerEditorState();
            }).catch(() => {});
        }
        return true;
    } catch (err) {
        console.warn('[persona] failed to start layer session', err);
        appState.personaSessionBooting = false;
        appState.personaSessionActive = false;
        appState.personaSessionLayer = '';
        appState.personaSessionQueue = [];
        appState.personaSessionIndex = 0;
        appState.currentQuestionId = null;
        appState.currentQuestionChoice = '';
        appState.personaSelectedLayer = '';
        renderPersonaLayerSelector();
        renderCurrentQuestion();
        updateAnswerEditorState();
        syncPersonaQuestionFocus();
        showToast('質問の読み込みに失敗しました。再度お試しください。', 'error');
        return false;
    }
}

function finishPersonaLayerSession(options = {}) {
    const showCompletedToast = options.showCompletedToast !== false;
    appState.personaSessionBooting = false;
    appState.personaSessionActive = false;
    appState.personaSessionLayer = '';
    appState.personaSessionQueue = [];
    appState.personaSessionIndex = 0;
    appState.personaSelectedLayer = '';
    appState.currentQuestionId = null;
    appState.currentQuestionChoice = '';
    if (dom.answerBody) dom.answerBody.value = '';
    renderPersonaLayerSelector();
    syncPersonaQuestionFocus();
    if (showCompletedToast) {
        showToast('この診断の回答が完了しました');
    }
}

function renderPersonaLayerSelector() {
    const selector = ensurePersonaLayerSelector();
    if (!selector) return;
    const isPersonaMode = appState.questionsViewMode === 'persona';
    selector.classList.toggle('hidden', !isPersonaMode);
    if (!isPersonaMode) return;

    const selectedLayer = normalizePersonaLayer(appState.personaSelectedLayer || '');
    const lockedLayer = normalizePersonaLayer(appState.personaSessionLayer || '');
    const locked = appState.personaSessionActive && !!lockedLayer;

    selector.innerHTML = PERSONA_LAYER_ORDER.map((layerKey) => {
        const info = getPersonaLayerProfileForUi(layerKey);
        const layerLabel = getPersonaLayerLabel(layerKey) || info.layerLabel || layerKey;
        const progress = info.progress || {};
        const answered = Number(progress.answeredCore) || 0;
        const total = Number(progress.totalCore) || 0;
        const status = info.status === 'ready' ? '完了' : '未完了';
        const isActive = !!selectedLayer && selectedLayer === layerKey;
        const isLocked = locked && layerKey !== lockedLayer;
        const isInProgressLayer = locked && layerKey === lockedLayer;
        const hasHistory = hasPersonaLayerHistory(layerKey, info);
        const disabled = isLocked || isInProgressLayer;
        const buttonLabel = isInProgressLayer ? '診断中' : (hasHistory ? '再診断する' : '診断する');
        const buttonAction = hasHistory ? 'reset' : 'start';
        return `
            <div class="persona-layer-card${isActive ? ' active' : ''}${isLocked ? ' locked' : ''}" data-layer-key="${escapeHtml(layerKey)}">
                <div class="persona-layer-card-title">${escapeHtml(layerLabel)}</div>
                <div class="persona-layer-card-type">状態: <strong>${escapeHtml(status)}</strong></div>
                <div class="persona-layer-card-progress">回答 ${answered}/${total || 0}</div>
                <button type="button" class="btn-secondary persona-layer-start-btn" data-layer-key="${escapeHtml(layerKey)}" data-action="${buttonAction}" ${disabled ? 'disabled' : ''}>
                    ${escapeHtml(buttonLabel)}
                </button>
            </div>
        `;
    }).join('');
}

function getPersonaModeQuestions() {
    const selectedLayer = normalizePersonaLayer(appState.personaSelectedLayer || '');
    if (!selectedLayer) return [];
    return getLayerBaselineQuestions(selectedLayer)
        .filter((question) => question.isPublished && question.isActive !== false)
        .sort(compareQuestionOrder);
}

function getAnswerModeQuestions() {
    return appState.questions.filter((question) => {
        if (!question.isPublished) return false;
        if (question.isActive === false) return false;
        if (isPersonaBaselineQuestion(question)) return false;
        return !appState.answersById[question.id];
    });
}

function getQuestionPoolByMode(mode = appState.questionsViewMode) {
    if (mode === 'persona') return getPersonaModeQuestions();
    return getAnswerModeQuestions();
}

function getPersonaModeProgress(questionList, currentQuestionId) {
    let list = Array.isArray(questionList) ? questionList : [];
    if (
        appState.questionsViewMode === 'persona'
        && appState.personaSessionActive
        && isManagedPersonaDraftLayer(appState.personaSessionLayer || '')
        && Array.isArray(appState.personaSessionQueue)
        && appState.personaSessionQueue.length
    ) {
        const byId = new Map(list.map((question) => [question.id, question]));
        const queued = appState.personaSessionQueue
            .map((id) => byId.get(id))
            .filter(Boolean);
        if (queued.length) {
            list = queued;
        }
    }
    const total = list.length;
    if (!total) {
        return {
            total: 0,
            currentIndex: 0,
            remainingAfterCurrent: 0,
            layers: [],
            activeLayer: null,
            activeLayerIndex: -1,
            currentLayerQuestionIndex: 0,
            currentLayerRemainingAfterCurrent: 0
        };
    }

    const currentIndexRaw = list.findIndex((question) => question.id === currentQuestionId);
    const safeIndex = currentIndexRaw >= 0 ? currentIndexRaw : 0;
    const currentQuestion = list[safeIndex] || null;
    const currentIndex = safeIndex + 1;
    const remainingAfterCurrent = Math.max(0, total - currentIndex);
    const currentLayerKey = normalizePersonaLayer(currentQuestion?.layer || '');

    const dynamicLayerOrder = [];
    list.forEach((question) => {
        const layer = normalizePersonaLayer(question.layer);
        if (layer && !dynamicLayerOrder.includes(layer)) dynamicLayerOrder.push(layer);
    });
    const orderedLayers = PERSONA_LAYER_ORDER.filter((layer) => dynamicLayerOrder.includes(layer))
        .concat(dynamicLayerOrder.filter((layer) => !PERSONA_LAYER_ORDER.includes(layer)));

    const layers = orderedLayers.map((layer) => {
        const questions = list.filter((question) => normalizePersonaLayer(question.layer) === layer);
        return {
            key: layer,
            label: getPersonaLayerLabel(layer) || layer,
            questions,
            total: questions.length
        };
    }).filter((layer) => layer.total > 0);

    const activeLayerIndex = layers.findIndex((layer) => layer.key === currentLayerKey);
    const activeLayer = activeLayerIndex >= 0 ? layers[activeLayerIndex] : null;
    const currentLayerIndexRaw = activeLayer
        ? activeLayer.questions.findIndex((question) => question.id === currentQuestion?.id)
        : -1;
    const currentLayerQuestionIndex = activeLayer
        ? (currentLayerIndexRaw >= 0 ? currentLayerIndexRaw + 1 : 1)
        : 0;
    const currentLayerRemainingAfterCurrent = activeLayer
        ? Math.max(0, activeLayer.total - currentLayerQuestionIndex)
        : 0;

    return {
        total,
        currentIndex,
        remainingAfterCurrent,
        layers,
        activeLayer,
        activeLayerIndex,
        currentLayerQuestionIndex,
        currentLayerRemainingAfterCurrent
    };
}

function renderCurrentQuestion() {
    if (!dom.currentQuestionTitle || !dom.currentQuestionBody || !dom.currentQuestionEmpty) return;

    const previousQuestionId = appState.currentQuestionId;
    const mode = appState.questionsViewMode === 'persona' ? 'persona' : 'answer';
    const isPersonaMode = mode === 'persona';
    const answerCard = dom.questionsStageAnswer
        ? dom.questionsStageAnswer.querySelector('.questions-answer-card')
        : null;
    const selectedLayer = normalizePersonaLayer(appState.personaSelectedLayer || '');
    if (dom.questionsStageAnswer) {
        dom.questionsStageAnswer.classList.toggle('persona-active', isPersonaMode);
    }
    const clearPersonaInlineQuestion = () => {
        if (dom.personaInlineQuestionBody) dom.personaInlineQuestionBody.textContent = '';
        if (dom.personaInlineQuestionMeta) {
            dom.personaInlineQuestionMeta.textContent = '';
            dom.personaInlineQuestionMeta.classList.add('hidden');
        }
        if (dom.personaInlineQuestion) dom.personaInlineQuestion.classList.add('hidden');
    };
    const renderPersonaInlineQuestion = (bodyText, metaText = '') => {
        if (!dom.personaInlineQuestion || !dom.personaInlineQuestionBody) return;
        dom.personaInlineQuestionBody.textContent = bodyText || '';
        if (dom.personaInlineQuestionMeta) {
            dom.personaInlineQuestionMeta.textContent = metaText || '';
            dom.personaInlineQuestionMeta.classList.toggle('hidden', !metaText);
        }
        dom.personaInlineQuestion.classList.remove('hidden');
    };
    if (!isPersonaMode) clearPersonaInlineQuestion();
    renderPersonaLayerSelector();
    setPersonaProgressBadge('', false);
    setPersonaInlineProgress({ visible: false });

    if (mode === 'persona' && !selectedLayer) {
        appState.currentQuestionId = null;
        appState.currentQuestionChoice = '';
        if (answerCard) answerCard.classList.add('hidden');
        dom.currentQuestionTitle.classList.add('hidden');
        if (dom.currentQuestionMeta) {
            dom.currentQuestionMeta.textContent = '';
            dom.currentQuestionMeta.classList.add('hidden');
        }
        dom.currentQuestionBody.classList.add('hidden');
        dom.currentQuestionEmpty.classList.remove('hidden');
        dom.currentQuestionEmpty.textContent = 'まず5レイヤーから1つ選んでください。';
        if (dom.questionChoiceArea) {
            dom.questionChoiceArea.classList.add('hidden');
            dom.questionChoiceArea.innerHTML = '';
        }
        if (dom.answerBody) {
            dom.answerBody.classList.remove('hidden');
            dom.answerBody.placeholder = 'お題に対する回答を書いてください';
            if (previousQuestionId) dom.answerBody.value = '';
        }
        clearPersonaInlineQuestion();
        return;
    }
    if (answerCard) answerCard.classList.remove('hidden');
    const pool = getQuestionPoolByMode(mode);

    if (!pool.length) {
        appState.currentQuestionId = null;
        appState.currentQuestionChoice = '';
        if (isPersonaMode && answerCard) answerCard.classList.add('hidden');
        dom.currentQuestionTitle.classList.add('hidden');
        if (dom.currentQuestionMeta) {
            dom.currentQuestionMeta.textContent = '';
            dom.currentQuestionMeta.classList.add('hidden');
        }
        dom.currentQuestionBody.classList.add('hidden');
        dom.currentQuestionEmpty.classList.remove('hidden');
        if (dom.questionChoiceArea) {
            dom.questionChoiceArea.classList.add('hidden');
            dom.questionChoiceArea.innerHTML = '';
        }
        if (dom.answerBody) {
            dom.answerBody.classList.remove('hidden');
            dom.answerBody.placeholder = 'お題に対する回答を書いてください';
        }
        dom.currentQuestionEmpty.textContent = mode === 'persona'
            ? '5レイヤー診断の固定質問がありません。'
            : '今は未回答のお題がありません。';
        if (previousQuestionId && dom.answerBody) dom.answerBody.value = '';
        clearPersonaInlineQuestion();
        return;
    }

    let current = pool.find((item) => item.id === appState.currentQuestionId);
    if (!current) {
        current = mode === 'persona' ? pool[0] : pickRandomQuestion(pool);
    }
    appState.currentQuestionId = current.id;
    const existingAnswer = appState.answersById[current.id] || null;
    const existingChoiceValue = current.type === 'choice'
        ? String(existingAnswer?.choiceValue || '').trim()
        : '';
    const existingTextValue = current.type === 'text'
        ? String(existingAnswer?.body || '')
        : '';

    if (current.title && !isPersonaMode) {
        dom.currentQuestionTitle.textContent = current.title;
        dom.currentQuestionTitle.classList.remove('hidden');
    } else {
        dom.currentQuestionTitle.textContent = '';
        dom.currentQuestionTitle.classList.add('hidden');
    }
    if (dom.currentQuestionMeta) {
        const metaParts = [];
        metaParts.push(getQuestionCategoryLabel(current.category));
        metaParts.push(current.type === 'choice' ? '選択式' : '記述式');
        if (current.category === SCREENING_CATEGORY) {
            const instrumentLabel = getScreeningInstrumentLabel(current.instrumentId);
            const dimensionLabel = getScreeningDimensionLabel(current.dimension);
            const layerLabel = getPersonaLayerLabel(current.layer);
            const typeLabel = getPersonaTypeLabel(current.layer, current.typeKey);
            if (instrumentLabel) metaParts.push(instrumentLabel);
            if (dimensionLabel) metaParts.push(dimensionLabel);
            if (layerLabel) metaParts.push(layerLabel);
            if (typeLabel) metaParts.push(typeLabel);
            if (current.isCore) metaParts.push('コア');
            if (isPersonaBaselineQuestion(current)) {
                const flow = mode === 'persona'
                    ? getPersonaModeProgress(pool, current.id)
                    : getPersonaBaselineFlow();
                if (flow.total > 0) {
                    if (mode === 'persona') {
                        setPersonaProgressBadge(`${flow.currentIndex}/${flow.total}`, true);
                        setPersonaInlineProgress({
                            current: flow.currentIndex,
                            total: flow.total,
                            visible: true
                        });
                    }
                    if (mode !== 'persona' && flow.activeLayer) {
                        metaParts.push(`レイヤー ${flow.activeLayerIndex + 1}/${flow.layers.length}`);
                        metaParts.push(`レイヤー進捗 ${flow.currentLayerQuestionIndex}/${flow.activeLayer.total}`);
                        metaParts.push(`このレイヤー残り ${flow.currentLayerRemainingAfterCurrent}問`);
                    }
                    if (mode === 'persona') {
                        const selectedLayerLabel = getPersonaLayerLabel(selectedLayer);
                        if (selectedLayerLabel) metaParts.push(`${selectedLayerLabel}診断`);
                        metaParts.push(`質問 ${flow.currentIndex}/${flow.total}`);
                    } else {
                        metaParts.push(`全体 ${flow.currentIndex}/${flow.total}`);
                    }
                    metaParts.push(`完了まであと ${flow.remainingAfterCurrent}問`);
                }
            }
        }
        const metaText = metaParts.join(' / ');
        if (isPersonaMode) {
            dom.currentQuestionMeta.textContent = '';
            dom.currentQuestionMeta.classList.add('hidden');
            renderPersonaInlineQuestion(current.body || '', '');
        } else {
            dom.currentQuestionMeta.textContent = metaText;
            dom.currentQuestionMeta.classList.toggle('hidden', !metaParts.length);
        }
    }
    dom.currentQuestionBody.textContent = current.body || '';
    dom.currentQuestionBody.classList.toggle('hidden', isPersonaMode);
    dom.currentQuestionEmpty.classList.add('hidden');
    if (previousQuestionId && previousQuestionId !== current.id) {
        appState.currentQuestionChoice = existingChoiceValue;
        if (dom.answerBody) dom.answerBody.value = existingTextValue;
    }
    renderQuestionChoiceOptions();
}

function getCurrentQuestion() {
    return getQuestionById(appState.currentQuestionId);
}

async function savePersonaChoiceImmediately(choiceValue) {
    if (!appState.user || appState.personaQuickSaving) return;
    const question = getCurrentQuestion();
    if (!question || appState.questionsViewMode !== 'persona') return;
    const value = String(choiceValue || '').trim();
    if (!value) return;

    appState.pendingAnswerPayload = {
        questionId: question.id,
        body: value,
        answerType: 'choice',
        choiceValue: value,
        category: normalizeQuestionCategory(question.category || QUESTION_CATEGORY_NORMAL),
        instrumentId: String(question.instrumentId || '').trim(),
        dimension: normalizeScreeningDimension(question.dimension || ''),
        layer: normalizePersonaLayer(question.layer || ''),
        typeKey: normalizePersonaTypeKey(question.layer || '', question.typeKey || ''),
        axisKey: String(question.axisKey || '').trim(),
        reverseScored: question.reverseScored === true
    };

    appState.personaQuickSaving = true;
    updateAnswerEditorState();
    try {
        await commitAnswerSave({ silent: true });
    } finally {
        appState.personaQuickSaving = false;
        updateAnswerEditorState();
    }
}

function renderQuestionChoiceOptions() {
    if (!dom.questionChoiceArea || !dom.answerBody) return;
    const current = getCurrentQuestion();
    const isChoice = current?.type === 'choice' && Array.isArray(current.options) && current.options.length > 0;
    const isPersonaScale = appState.questionsViewMode === 'persona' && isPersonaBaselineQuestion(current);
    dom.questionChoiceArea.innerHTML = '';
    dom.questionChoiceArea.classList.toggle('persona-choice-scale', !!isPersonaScale);
    if (!isChoice) {
        dom.questionChoiceArea.classList.add('hidden');
        dom.answerBody.classList.remove('hidden');
        dom.answerBody.placeholder = 'お題に対する回答を書いてください';
        return;
    }
    dom.questionChoiceArea.classList.remove('hidden');
    dom.answerBody.classList.add('hidden');
    dom.answerBody.value = '';

    const options = current.options || [];
    if (!options.includes(appState.currentQuestionChoice)) {
        appState.currentQuestionChoice = '';
    }

    const fragment = document.createDocumentFragment();
    if (isPersonaScale) {
        const wrap = document.createElement('div');
        wrap.className = 'persona-choice-scale-wrap';

        const leftLabel = document.createElement('span');
        leftLabel.className = 'persona-choice-edge-label left';
        leftLabel.textContent = 'そう思う';

        const rightLabel = document.createElement('span');
        rightLabel.className = 'persona-choice-edge-label right';
        rightLabel.textContent = 'そう思わない';

        const row = document.createElement('div');
        row.className = 'persona-choice-scale-row';
        const displayOptions = options.slice().reverse();
        const mid = (displayOptions.length - 1) / 2;
        displayOptions.forEach((option, index) => {
            const optionButton = document.createElement('button');
            optionButton.type = 'button';
            optionButton.className = 'question-choice-option persona-scale-option';
            optionButton.dataset.choiceValue = option;
            optionButton.setAttribute('aria-label', option);
            optionButton.title = option;
            const size = Math.max(34, Math.round(38 + Math.abs(index - mid) * 10));
            optionButton.style.setProperty('--choice-size', `${size}px`);
            if (appState.currentQuestionChoice === option) optionButton.classList.add('active');
            optionButton.innerHTML = '<span class="persona-scale-ring" aria-hidden="true"></span>';
            row.appendChild(optionButton);
        });

        wrap.appendChild(leftLabel);
        wrap.appendChild(row);
        wrap.appendChild(rightLabel);
        fragment.appendChild(wrap);
        dom.questionChoiceArea.appendChild(fragment);
        return;
    }

    options.forEach((option) => {
        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'question-choice-option';
        optionButton.dataset.choiceValue = option;
        if (appState.currentQuestionChoice === option) optionButton.classList.add('active');
        optionButton.innerHTML = `
            <span class="question-choice-dot" aria-hidden="true"></span>
            <span class="question-choice-label">${escapeHtml(option)}</span>
        `;
        fragment.appendChild(optionButton);
    });
    dom.questionChoiceArea.appendChild(fragment);
}

function setQuestionsViewMode(mode) {
    const prevMode = appState.questionsViewMode;
    const nextMode = mode === 'history'
        ? 'history'
        : (mode === 'persona' ? 'persona' : 'answer');
    appState.questionsViewMode = nextMode;
    if (nextMode === 'persona' && prevMode !== 'persona' && !appState.personaSessionActive) {
        appState.personaSelectedLayer = '';
        appState.currentQuestionId = null;
        appState.currentQuestionChoice = '';
        if (dom.answerBody) dom.answerBody.value = '';
    }
    if (dom.btnQuestionsModePersona) dom.btnQuestionsModePersona.classList.toggle('active', nextMode === 'persona');
    if (dom.btnQuestionsModeAnswer) dom.btnQuestionsModeAnswer.classList.toggle('active', nextMode === 'answer');
    if (dom.btnQuestionsModeHistory) dom.btnQuestionsModeHistory.classList.toggle('active', nextMode === 'history');
    if (dom.questionsStageAnswer) dom.questionsStageAnswer.classList.toggle('hidden', nextMode === 'history');
    if (dom.questionsStageHistory) dom.questionsStageHistory.classList.toggle('hidden', nextMode !== 'history');
    renderPersonaLayerSelector();
    if (nextMode !== 'history') {
        const pool = getQuestionPoolByMode(nextMode);
        if (!pool.some((question) => question.id === appState.currentQuestionId)) {
            appState.currentQuestionId = null;
            appState.currentQuestionChoice = '';
            if (dom.answerBody) dom.answerBody.value = '';
        }
    }
    renderCurrentQuestion();
    updateAnswerEditorState();
}

function getUnansweredActiveQuestions() {
    return getAnswerModeQuestions();
}

function isPersonaBaselineAnswer(answer) {
    if (!answer) return false;
    const question = getQuestionById(answer.questionId || '');
    if (question && isPersonaBaselineQuestion(question)) return true;
    const category = normalizeQuestionCategory(answer.category || question?.category || QUESTION_CATEGORY_NORMAL);
    const instrumentId = String(answer.instrumentId || question?.instrumentId || '').trim();
    if (category !== SCREENING_CATEGORY || instrumentId !== SCREENING_INSTRUMENT_PERSONA) return false;
    if (answer.isBaseline === true || question?.isBaseline === true) return true;
    return Object.prototype.hasOwnProperty.call(PERSONA_BASELINE_QUESTION_MAP, String(answer.questionId || ''));
}

function pickRandomQuestion(list, excludeId) {
    if (!list.length) return null;
    const pool = excludeId ? list.filter((item) => item.id !== excludeId) : list;
    if (!pool.length) return list[0];
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
}

function renderAnswersList() {
    if (!dom.answersList) return;
    const answers = appState.answers
        .filter((answer) => !isPersonaBaselineAnswer(answer))
        .slice();

    dom.answersList.innerHTML = '';

    if (!answers.length) {
        const empty = document.createElement('p');
        empty.className = 'questions-empty';
        empty.textContent = appState.user ? 'まだ回答がありません。' : 'ログインすると回答履歴を確認できます。';
        dom.answersList.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    answers.forEach((answer) => {
        const question = getQuestionById(answer.questionId);
        const title = question?.title?.trim() || '';
        const questionText = question?.body || question?.title || 'お題';
        const questionSnippet = truncateText(questionText, 72);
        const answerText = truncateText(getAnswerDisplayText(answer) || '回答なし', 80);
        const answerType = answer.answerType === 'choice' ? '選択式' : '記述式';
        const category = normalizeQuestionCategory(answer.category || question?.category || QUESTION_CATEGORY_NORMAL);
        const categoryLabel = getQuestionCategoryLabel(category);
        const instrumentLabel = category === SCREENING_CATEGORY
            ? getScreeningInstrumentLabel(answer.instrumentId || question?.instrumentId || '')
            : '';
        const dimensionLabel = category === SCREENING_CATEGORY
            ? getScreeningDimensionLabel(answer.dimension || question?.dimension || '')
            : '';
        const layerLabel = category === SCREENING_CATEGORY
            ? getPersonaLayerLabel(answer.layer || question?.layer || '')
            : '';

        const card = document.createElement('div');
        card.className = 'answer-card';
        card.dataset.answerId = answer.id;
        card.innerHTML = `
            <div class="answer-card-badges">
                <span class="answer-card-type">${escapeHtml(categoryLabel)}</span>
                <span class="answer-card-type">${escapeHtml(answerType)}</span>
                ${instrumentLabel ? `<span class="answer-card-type">${escapeHtml(instrumentLabel)}</span>` : ''}
                ${dimensionLabel ? `<span class="answer-card-type">${escapeHtml(dimensionLabel)}</span>` : ''}
                ${layerLabel ? `<span class="answer-card-type">${escapeHtml(layerLabel)}</span>` : ''}
            </div>
            ${title ? `<div class="answer-card-title">${escapeHtml(title)}</div>` : ''}
            <div class="answer-card-question">${escapeHtml(questionSnippet)}</div>
            <div class="answer-card-answer">${escapeHtml(answerText)}</div>
            <div class="answer-card-meta">
                <span>${escapeHtml(formatDate(answer.updatedAt || answer.createdAt))}</span>
                ${Number.isFinite(answer.choiceScore) ? `<span>スコア ${answer.choiceScore}</span>` : '<span></span>'}
            </div>
        `;
        fragment.appendChild(card);
    });

    dom.answersList.appendChild(fragment);
}

async function loadAnswerCountsForAdmin() {
    const db = window.db;
    if (!db || !isAdminUser()) return;
    try {
        const snapshot = await db.collection('answers').get();
        const counts = {};
        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const questionId = data.questionId || '';
            if (!questionId) return;
            counts[questionId] = (counts[questionId] || 0) + 1;
        });
        appState.answerCountsByQuestionId = counts;
    } catch (err) {
        console.warn('[questions] failed to load answer counts', err);
        appState.answerCountsByQuestionId = {};
    }
}

function refreshCurrentQuestion() {
    const mode = appState.questionsViewMode === 'persona' ? 'persona' : 'answer';
    if (mode === 'persona' && !normalizePersonaLayer(appState.personaSelectedLayer || '')) {
        renderCurrentQuestion();
        updateAnswerEditorState();
        return;
    }
    const pool = getQuestionPoolByMode(mode);
    if (!pool.length) return;
    const next = mode === 'persona'
        ? (() => {
            const currentIndex = pool.findIndex((question) => question.id === appState.currentQuestionId);
            if (currentIndex < 0) return pool[0];
            return pool[(currentIndex + 1) % pool.length];
        })()
        : pickRandomQuestion(pool, appState.currentQuestionId);
    if (!next) return;
    appState.currentQuestionId = next.id;
    appState.currentQuestionChoice = '';
    if (dom.answerBody) dom.answerBody.value = '';
    renderCurrentQuestion();
    updateAnswerEditorState();
}

function movePersonaQuestionPrev() {
    if (appState.questionsViewMode !== 'persona') return;
    if (!appState.personaSessionActive) return;
    if (appState.personaQuickSaving) return;
    const queue = Array.isArray(appState.personaSessionQueue) ? appState.personaSessionQueue : [];
    if (!queue.length) return;
    const currentIndex = queue.findIndex((questionId) => questionId === appState.currentQuestionId);
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : appState.personaSessionIndex;
    if (safeCurrentIndex <= 0) return;
    const prevIndex = safeCurrentIndex - 1;
    const prevQuestionId = queue[prevIndex] || '';
    if (!prevQuestionId) return;
    appState.personaSessionIndex = prevIndex;
    appState.currentQuestionId = prevQuestionId;
    const previousAnswer = appState.answersById[prevQuestionId] || null;
    appState.currentQuestionChoice = previousAnswer?.answerType === 'choice'
        ? String(previousAnswer.choiceValue || '').trim()
        : '';
    if (dom.answerBody) {
        dom.answerBody.value = previousAnswer?.answerType === 'text'
            ? String(previousAnswer.body || '')
            : '';
    }
    renderCurrentQuestion();
    updateAnswerEditorState();
}

async function closePersonaSessionByUser() {
    if (!appState.personaSessionActive) return;
    const currentLayer = normalizePersonaLayer(appState.personaSessionLayer || '');
    const layerLabel = getPersonaLayerLabel(currentLayer) || 'このレイヤー';
    const confirmed = await openPersonaExitConfirmModal(layerLabel);
    if (!confirmed) return;
    if (!appState.personaSessionActive) return;
    if (currentLayer) {
        const resetOk = await resetPersonaLayerHistory(currentLayer, { silent: true });
        if (!resetOk) {
            showToast('中断処理に失敗しました。通信状態を確認して再試行してください。', 'error');
            return;
        }
    }
    finishPersonaLayerSession({ showCompletedToast: false });
    renderCurrentQuestion();
    updateAnswerEditorState();
    showToast('診断を終了しました。途中回答は保存されていません。');
}

function syncPersonaQuestionFocus() {
    const bootingFocus = appState.currentView === 'questions'
        && appState.questionsViewMode === 'persona'
        && appState.personaSessionBooting;
    const shouldFocus = bootingFocus || (appState.currentView === 'questions'
        && appState.questionsViewMode === 'persona'
        && appState.personaSessionActive
        && !!appState.currentQuestionId);
    document.body.classList.toggle('persona-question-focus', shouldFocus);
}

function updateAnswerEditorState() {
    const hasQuestion = !!appState.currentQuestionId;
    const isLoggedIn = !!appState.user;
    const isPersonaMode = appState.questionsViewMode === 'persona';
    const hasPersonaSession = isPersonaMode
        && appState.personaSessionActive
        && Array.isArray(appState.personaSessionQueue)
        && appState.personaSessionQueue.length > 0;
    if (dom.btnQuestionAdmin) {
        dom.btnQuestionAdmin.classList.toggle('hidden', !isAdminUser());
    }
    if (dom.btnQuestionRefresh) {
        dom.btnQuestionRefresh.disabled = !hasQuestion;
        dom.btnQuestionRefresh.classList.toggle('disabled', !hasQuestion);
    }

    if (dom.answerLoginNote) {
        dom.answerLoginNote.classList.toggle('hidden', isLoggedIn);
    }

    const shouldDisable = !isLoggedIn || !hasQuestion || appState.personaQuickSaving;
    if (dom.answerBody) dom.answerBody.disabled = shouldDisable;
    const choiceButtons = dom.questionChoiceArea ? dom.questionChoiceArea.querySelectorAll('.question-choice-option') : [];
    choiceButtons.forEach((button) => {
        button.disabled = shouldDisable;
    });
    if (dom.btnPersonaPrevQuestion) {
        const hasPrevQuestion = hasPersonaSession && appState.personaSessionIndex > 0;
        const prevDisabled = shouldDisable || !hasPrevQuestion;
        dom.btnPersonaPrevQuestion.disabled = prevDisabled;
        dom.btnPersonaPrevQuestion.classList.toggle('hidden', !hasPrevQuestion);
    }
    if (dom.btnPersonaCloseSession) {
        const closeDisabled = shouldDisable || !hasPersonaSession;
        dom.btnPersonaCloseSession.disabled = closeDisabled;
        dom.btnPersonaCloseSession.classList.toggle('hidden', !hasPersonaSession);
    }
    if (dom.btnSaveAnswer) {
        dom.btnSaveAnswer.disabled = shouldDisable;
        dom.btnSaveAnswer.classList.toggle('hidden', isPersonaMode);
        const actions = dom.btnSaveAnswer.closest('.questions-actions');
        if (actions) actions.classList.toggle('hidden', isPersonaMode && !hasPersonaSession);
    }
    syncPersonaQuestionFocus();
}

function getQuestionById(questionId) {
    if (!questionId) return null;
    const found = appState.questions.find((question) => question.id === questionId);
    if (found) return found;
    const baselineSeed = PERSONA_BASELINE_QUESTION_MAP[String(questionId)] || null;
    if (!baselineSeed) return null;
    return normalizeQuestionRecord(String(questionId), {
        title: '5レイヤー基礎診断',
        body: baselineSeed.body,
        category: SCREENING_CATEGORY,
        type: 'choice',
        options: PERSONA_BASELINE_OPTIONS,
        optionScores: PERSONA_BASELINE_OPTION_SCORES,
        instrumentId: SCREENING_INSTRUMENT_PERSONA,
        dimension: '',
        layer: baselineSeed.layer,
        typeKey: '',
        axisKey: baselineSeed.axisKey || '',
        reverseScored: baselineSeed.reverseScored === true,
        isCore: true,
        isBaseline: true,
        isFixed: true,
        isPublished: true,
        isActive: true,
        order: baselineSeed.order
    });
}

function openAnswerConfirmModal() {
    if (!appState.user) {
        showToast('ログインしてください', 'error');
        return;
    }
    if (!appState.currentQuestionId) {
        showToast('回答できるお題がありません', 'error');
        return;
    }
    const question = getQuestionById(appState.currentQuestionId);
    const isChoiceQuestion = question?.type === 'choice' && Array.isArray(question.options) && question.options.length > 0;
    const selectedChoice = isChoiceQuestion ? String(appState.currentQuestionChoice || '').trim() : '';
    const body = isChoiceQuestion
        ? selectedChoice
        : (dom.answerBody ? dom.answerBody.value.trim() : '');
    if (!body) {
        showToast(isChoiceQuestion ? '選択肢を選んでください' : '回答を入力してください', 'error');
        return;
    }
    if (dom.answerConfirmQuestion) {
        dom.answerConfirmQuestion.textContent = question?.body || question?.title || '';
    }
    if (dom.answerConfirmText) {
        dom.answerConfirmText.textContent = body;
    }
    appState.pendingAnswerPayload = {
        questionId: appState.currentQuestionId,
        body,
        answerType: isChoiceQuestion ? 'choice' : 'text',
        choiceValue: isChoiceQuestion ? body : '',
        category: normalizeQuestionCategory(question?.category || QUESTION_CATEGORY_NORMAL),
        instrumentId: String(question?.instrumentId || '').trim(),
        dimension: normalizeScreeningDimension(question?.dimension || ''),
        layer: normalizePersonaLayer(question?.layer || ''),
        typeKey: normalizePersonaTypeKey(question?.layer || '', question?.typeKey || ''),
        axisKey: String(question?.axisKey || '').trim(),
        reverseScored: question?.reverseScored === true
    };
    if (dom.modalAnswerConfirm) {
        dom.modalAnswerConfirm.classList.remove('hidden');
        dom.modalAnswerConfirm.classList.add('active');
    }
}

function closeAnswerConfirmModal() {
    if (!dom.modalAnswerConfirm) return;
    dom.modalAnswerConfirm.classList.add('hidden');
    dom.modalAnswerConfirm.classList.remove('active');
    appState.pendingAnswerPayload = null;
}

function openAnswerEditConfirm(answerId) {
    if (!dom.modalAnswerEditConfirm) return;
    appState.pendingEditAnswerId = answerId;
    appState.confirmEditOpen = true;
    dom.modalAnswerEditConfirm.classList.remove('hidden');
    dom.modalAnswerEditConfirm.classList.add('active');
}

function closeAnswerEditConfirm() {
    if (!dom.modalAnswerEditConfirm) return;
    dom.modalAnswerEditConfirm.classList.add('hidden');
    dom.modalAnswerEditConfirm.classList.remove('active');
    appState.pendingEditAnswerId = null;
    appState.confirmEditOpen = false;
}

function updateAnswerDetailMode() {
    const isEditing = !!appState.isEditing;
    if (dom.answerDetailBody) dom.answerDetailBody.classList.toggle('hidden', isEditing);
    if (dom.answerDetailEdit) dom.answerDetailEdit.classList.toggle('hidden', !isEditing);
    if (dom.answerDetailActions) dom.answerDetailActions.classList.toggle('hidden', isEditing);
    if (dom.answerDetailEditActions) dom.answerDetailEditActions.classList.toggle('hidden', !isEditing);
    if (dom.answerDetailTextarea && isEditing) {
        dom.answerDetailTextarea.value = appState.draftText || '';
    }
}

function getNextPersonaQuestionIdAfterSave(savedQuestionId) {
    const pool = getQuestionPoolByMode('persona');
    if (!pool.length) return null;
    const unanswered = pool.filter((question) => !appState.answersById[question.id]);
    if (unanswered.length) return unanswered[0].id;
    const currentIndex = pool.findIndex((question) => question.id === savedQuestionId);
    if (currentIndex < 0) return pool[0].id;
    return pool[(currentIndex + 1) % pool.length]?.id || pool[0].id;
}

async function commitAnswerSave(options = {}) {
    const silent = !!options.silent;
    if (!appState.user || !appState.pendingAnswerPayload) return;
    const db = window.db;
    if (!db) return;

    const body = appState.pendingAnswerPayload.body;
    const questionId = appState.pendingAnswerPayload.questionId;
    const question = getQuestionById(questionId);
    const answerType = normalizeQuestionType(appState.pendingAnswerPayload.answerType || question?.type || 'text');
    const category = normalizeQuestionCategory(
        appState.pendingAnswerPayload.category || question?.category || QUESTION_CATEGORY_NORMAL
    );
    const instrumentId = String(
        appState.pendingAnswerPayload.instrumentId || question?.instrumentId || ''
    ).trim();
    const dimension = normalizeScreeningDimension(
        appState.pendingAnswerPayload.dimension || question?.dimension || ''
    );
    const layer = normalizePersonaLayer(
        appState.pendingAnswerPayload.layer || question?.layer || ''
    );
    const typeKey = normalizePersonaTypeKey(
        layer,
        appState.pendingAnswerPayload.typeKey || question?.typeKey || ''
    );
    const axisKey = String(
        appState.pendingAnswerPayload.axisKey || question?.axisKey || ''
    ).trim();
    const reverseScored = appState.pendingAnswerPayload.reverseScored === true || question?.reverseScored === true;
    const choiceValue = answerType === 'choice'
        ? String(appState.pendingAnswerPayload.choiceValue || body || '').trim()
        : '';
    const choiceScore = answerType === 'choice'
        ? getChoiceScoreForQuestion(question, choiceValue)
        : null;
    const layerLikertAnswer = isManagedPersonaDraftLayer(layer) && answerType === 'choice'
        ? normalizeLikertAnswerFromChoice(question, choiceScore, choiceValue)
        : null;
    const docId = `${appState.user.uid}_${questionId}`;
    const existing = appState.answersById[questionId];
    const now = new Date();
    const serverTimestamp = getServerTimestamp();

    const payload = {
        questionId,
        userId: appState.user.uid,
        body,
        answerType,
        choiceValue,
        category,
        instrumentId,
        dimension,
        layer,
        typeKey,
        axisKey,
        reverseScored,
        choiceScore,
        likertAnswer: Number.isFinite(layerLikertAnswer) ? layerLikertAnswer : null,
        scoredAt: answerType === 'choice' ? serverTimestamp : null,
        updatedAt: serverTimestamp,
        createdAt: existing?.createdAt || serverTimestamp,
        pendingAnalysis: true
    };

    try {
        await db.collection('answers').doc(docId).set(payload, { merge: true });
        const localAnswer = {
            id: docId,
            questionId: payload.questionId,
            userId: payload.userId,
            category,
            instrumentId,
            dimension,
            layer,
            typeKey,
            axisKey,
            reverseScored,
            body: payload.body,
            answerType: payload.answerType,
            choiceValue: payload.choiceValue,
            choiceScore,
            likertAnswer: Number.isFinite(layerLikertAnswer) ? layerLikertAnswer : null,
            scoredAt: answerType === 'choice' ? now : null,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            pendingAnalysis: true
        };

        const index = appState.answers.findIndex((answer) => answer.id === docId);
        if (index >= 0) {
            appState.answers[index] = localAnswer;
        } else {
            appState.answers.unshift(localAnswer);
        }
        appState.answersById[questionId] = localAnswer;
        if (Number.isFinite(layerLikertAnswer)) {
            await saveLayerDraftAnswer(layer, questionId, layerLikertAnswer);
        }

        if (dom.answerBody) dom.answerBody.value = '';
        appState.currentQuestionChoice = '';
        let shouldRecompute = true;
        let waitForRecompute = false;
        if (appState.questionsViewMode === 'persona') {
            const inSession = appState.personaSessionActive
                && normalizePersonaLayer(appState.personaSessionLayer || '') === normalizePersonaLayer(localAnswer.layer || '');
            if (inSession) {
                const queue = Array.isArray(appState.personaSessionQueue) ? appState.personaSessionQueue : [];
                const currentIndex = queue.findIndex((id) => id === questionId);
                const nextIndex = currentIndex >= 0 ? currentIndex + 1 : appState.personaSessionIndex + 1;
                appState.personaSessionIndex = Math.max(0, nextIndex);
                if (nextIndex >= queue.length) {
                    if (isManagedPersonaDraftLayer(localAnswer.layer)) {
                        try {
                            await saveLayerResult(localAnswer.layer);
                        } catch (layerErr) {
                            console.warn('[persona] failed to persist layer result', layerErr);
                        }
                    }
                    finishPersonaLayerSession();
                    waitForRecompute = true;
                } else {
                    appState.currentQuestionId = queue[nextIndex];
                    // 5レイヤー診断中は最後の設問回答時のみ再計算し、競合更新を防ぐ
                    shouldRecompute = false;
                }
            } else {
                appState.currentQuestionId = getNextPersonaQuestionIdAfterSave(questionId);
            }
        } else {
            appState.currentQuestionId = null;
        }
        if (!silent) {
            showToast('回答を保存しました');
        }
        closeAnswerConfirmModal();
        renderQuestionsPage();
        if (shouldRecompute) {
            const recomputePromise = recomputeScreeningProfile(docId);
            if (waitForRecompute) {
                await recomputePromise;
            }
        }
    } catch (err) {
        console.error('[questions] save answer failed', err);
        showToast('回答の保存に失敗しました', 'error');
    }
}

function openAnswerEditModal(answerId) {
    if (!dom.modalAnswerEdit) return;
    const answer = appState.answers.find((item) => item.id === answerId);
    if (!answer) return;
    const question = getQuestionById(answer.questionId);
    appState.editingAnswerId = answerId;
    if (dom.answerEditQuestion) {
        dom.answerEditQuestion.textContent = question?.body || question?.title || '';
    }
    if (dom.answerEditText) {
        dom.answerEditText.value = getAnswerDisplayText(answer);
    }
    dom.modalAnswerEdit.classList.remove('hidden');
    dom.modalAnswerEdit.classList.add('active');
}

function closeAnswerEditModal() {
    if (!dom.modalAnswerEdit) return;
    dom.modalAnswerEdit.classList.add('hidden');
    dom.modalAnswerEdit.classList.remove('active');
    appState.editingAnswerId = null;
}

async function saveAnswerEdit() {
    if (!appState.user || !appState.editingAnswerId) return;
    const db = window.db;
    if (!db) return;
    const body = dom.answerEditText ? dom.answerEditText.value.trim() : '';
    if (!body) {
        showToast('回答を入力してください', 'error');
        return;
    }
    const target = appState.answers.find((item) => item.id === appState.editingAnswerId);
    if (!target) return;
    const answerType = target.answerType === 'choice' ? 'choice' : 'text';
    const question = getQuestionById(target.questionId);
    const category = normalizeQuestionCategory(target.category || question?.category || QUESTION_CATEGORY_NORMAL);
    const instrumentId = String(target.instrumentId || question?.instrumentId || '').trim();
    const dimension = normalizeScreeningDimension(target.dimension || question?.dimension || '');
    const layer = normalizePersonaLayer(target.layer || question?.layer || '');
    const typeKey = normalizePersonaTypeKey(layer, target.typeKey || question?.typeKey || '');
    const axisKey = String(target.axisKey || question?.axisKey || '').trim();
    const reverseScored = target.reverseScored === true || question?.reverseScored === true;
    const choiceScore = answerType === 'choice'
        ? getChoiceScoreForQuestion(question, body)
        : null;
    const layerLikertAnswer = isManagedPersonaDraftLayer(layer) && answerType === 'choice'
        ? normalizeLikertAnswerFromChoice(question, choiceScore, body)
        : null;
    const payload = {
        body,
        answerType,
        choiceValue: answerType === 'choice' ? body : '',
        category,
        instrumentId,
        dimension,
        layer,
        typeKey,
        axisKey,
        reverseScored,
        choiceScore,
        likertAnswer: Number.isFinite(layerLikertAnswer) ? layerLikertAnswer : null,
        scoredAt: answerType === 'choice' ? getServerTimestamp() : null,
        pendingAnalysis: true,
        updatedAt: getServerTimestamp()
    };
    try {
        await db.collection('answers').doc(appState.editingAnswerId).set(payload, { merge: true });
        target.body = body;
        target.choiceValue = payload.choiceValue;
        target.category = category;
        target.instrumentId = instrumentId;
        target.dimension = dimension;
        target.layer = layer;
        target.typeKey = typeKey;
        target.axisKey = axisKey;
        target.reverseScored = reverseScored;
        target.choiceScore = choiceScore;
        target.likertAnswer = Number.isFinite(layerLikertAnswer) ? layerLikertAnswer : null;
        target.scoredAt = answerType === 'choice' ? new Date() : null;
        target.pendingAnalysis = true;
        target.updatedAt = new Date();
        appState.answersById[target.questionId] = target;
        if (Number.isFinite(layerLikertAnswer)) {
            await saveLayerDraftAnswer(layer, target.questionId, layerLikertAnswer);
        }
        showToast('回答を更新しました');
        closeAnswerEditModal();
        renderQuestionsPage();
        recomputeScreeningProfile(target.id);
    } catch (err) {
        console.error('[questions] update answer failed', err);
        showToast('回答の更新に失敗しました', 'error');
    }
}

function cancelAnswerDetailEdit() {
    if (!appState.detailAnswerId) return;
    const target = appState.answers.find((item) => item.id === appState.detailAnswerId);
    appState.isEditing = false;
    appState.draftText = getAnswerDisplayText(target);
    updateAnswerDetailMode();
}

async function saveAnswerDetailEdit() {
    if (!appState.user || !appState.detailAnswerId) return;
    const db = window.db;
    if (!db) return;
    const body = dom.answerDetailTextarea ? dom.answerDetailTextarea.value.trim() : '';
    if (!body) {
        showToast('回答を入力してください', 'error');
        return;
    }
    const target = appState.answers.find((item) => item.id === appState.detailAnswerId);
    if (!target) return;
    const answerType = target.answerType === 'choice' ? 'choice' : 'text';
    const question = getQuestionById(target.questionId);
    const category = normalizeQuestionCategory(target.category || question?.category || QUESTION_CATEGORY_NORMAL);
    const instrumentId = String(target.instrumentId || question?.instrumentId || '').trim();
    const dimension = normalizeScreeningDimension(target.dimension || question?.dimension || '');
    const layer = normalizePersonaLayer(target.layer || question?.layer || '');
    const typeKey = normalizePersonaTypeKey(layer, target.typeKey || question?.typeKey || '');
    const axisKey = String(target.axisKey || question?.axisKey || '').trim();
    const reverseScored = target.reverseScored === true || question?.reverseScored === true;
    const choiceScore = answerType === 'choice'
        ? getChoiceScoreForQuestion(question, body)
        : null;
    const layerLikertAnswer = isManagedPersonaDraftLayer(layer) && answerType === 'choice'
        ? normalizeLikertAnswerFromChoice(question, choiceScore, body)
        : null;
    const payload = {
        body,
        answerType,
        choiceValue: answerType === 'choice' ? body : '',
        category,
        instrumentId,
        dimension,
        layer,
        typeKey,
        axisKey,
        reverseScored,
        choiceScore,
        likertAnswer: Number.isFinite(layerLikertAnswer) ? layerLikertAnswer : null,
        scoredAt: answerType === 'choice' ? getServerTimestamp() : null,
        pendingAnalysis: true,
        updatedAt: getServerTimestamp()
    };
    try {
        await db.collection('answers').doc(appState.detailAnswerId).set(payload, { merge: true });
        target.body = body;
        target.choiceValue = payload.choiceValue;
        target.category = category;
        target.instrumentId = instrumentId;
        target.dimension = dimension;
        target.layer = layer;
        target.typeKey = typeKey;
        target.axisKey = axisKey;
        target.reverseScored = reverseScored;
        target.choiceScore = choiceScore;
        target.likertAnswer = Number.isFinite(layerLikertAnswer) ? layerLikertAnswer : null;
        target.scoredAt = answerType === 'choice' ? new Date() : null;
        target.pendingAnalysis = true;
        target.updatedAt = new Date();
        appState.answersById[target.questionId] = target;
        if (Number.isFinite(layerLikertAnswer)) {
            await saveLayerDraftAnswer(layer, target.questionId, layerLikertAnswer);
        }
        appState.isEditing = false;
        appState.draftText = body;
        if (dom.answerDetailBody) dom.answerDetailBody.textContent = body;
        updateAnswerDetailMode();
        showToast('回答を更新しました');
        renderQuestionsPage();
        recomputeScreeningProfile(target.id);
    } catch (err) {
        console.error('[questions] update answer failed', err);
        showToast('回答の更新に失敗しました', 'error');
    }
}

function openAnswerDeleteConfirm(answerId) {
    if (!dom.modalAnswerDelete) return;
    appState.deletingAnswerId = answerId;
    dom.modalAnswerDelete.classList.remove('hidden');
    dom.modalAnswerDelete.classList.add('active');
}

function closeAnswerDeleteConfirm() {
    if (!dom.modalAnswerDelete) return;
    dom.modalAnswerDelete.classList.add('hidden');
    dom.modalAnswerDelete.classList.remove('active');
    appState.deletingAnswerId = null;
}

async function deleteAnswer() {
    if (!appState.user || !appState.deletingAnswerId) return;
    const db = window.db;
    if (!db) return;
    const deletedAnswerId = appState.deletingAnswerId;
    try {
        await db.collection('answers').doc(deletedAnswerId).delete();
        appState.answers = appState.answers.filter((item) => item.id !== deletedAnswerId);
        const removed = Object.keys(appState.answersById).find((key) => appState.answersById[key]?.id === deletedAnswerId);
        if (removed) {
            delete appState.answersById[removed];
        }
        showToast('回答を削除しました');
        closeAnswerDeleteConfirm();
        renderQuestionsPage();
        recomputeScreeningProfile(deletedAnswerId);
    } catch (err) {
        console.error('[questions] delete answer failed', err);
        showToast('回答の削除に失敗しました', 'error');
    }
}

function openAnswerDetailModal(answer) {
    if (!dom.modalAnswerDetail || !answer) return;
    const question = getQuestionById(answer.questionId);
    appState.detailAnswerId = answer.id;
    appState.isEditing = false;
    appState.draftText = getAnswerDisplayText(answer);
    const title = question?.title?.trim() || '';
    if (dom.answerDetailDate) dom.answerDetailDate.textContent = formatDateTime(answer.updatedAt || answer.createdAt);
    if (dom.answerDetailStatus) {
        const pending = !!answer.pendingAnalysis;
        dom.answerDetailStatus.classList.toggle('hidden', !pending);
    }
    if (dom.answerDetailTitle) {
        dom.answerDetailTitle.textContent = title;
        dom.answerDetailTitle.classList.toggle('hidden', !title);
    }
    if (dom.answerDetailQuestion) dom.answerDetailQuestion.textContent = question?.body || question?.title || 'お題';
    if (dom.answerDetailBody) dom.answerDetailBody.textContent = getAnswerDisplayText(answer);
    updateAnswerDetailMode();

    dom.modalAnswerDetail.classList.remove('hidden');
    dom.modalAnswerDetail.classList.add('active');
}

function closeAnswerDetailModal() {
    if (!dom.modalAnswerDetail) return;
    dom.modalAnswerDetail.classList.add('hidden');
    dom.modalAnswerDetail.classList.remove('active');
    appState.detailAnswerId = null;
    appState.isEditing = false;
    appState.draftText = '';
    closeAnswerEditConfirm();
}

function syncQuestionComposerState() {
    const category = normalizeQuestionCategory(dom.questionCategoryInput?.value || QUESTION_CATEGORY_NORMAL);
    const type = category === SCREENING_CATEGORY
        ? 'choice'
        : normalizeQuestionType(dom.questionTypeInput?.value || 'text');
    if (dom.questionCategoryInput) dom.questionCategoryInput.value = category;
    if (dom.questionTypeInput) {
        dom.questionTypeInput.value = type;
        dom.questionTypeInput.disabled = category === SCREENING_CATEGORY;
    }
    if (dom.questionScreeningFields) {
        dom.questionScreeningFields.classList.toggle('hidden', category !== SCREENING_CATEGORY);
    }
    if (dom.questionOptionsGroup) {
        dom.questionOptionsGroup.classList.toggle('hidden', type !== 'choice');
    }
    if (category === SCREENING_CATEGORY) {
        if (dom.questionInstrumentInput && !String(dom.questionInstrumentInput.value || '').trim()) {
            dom.questionInstrumentInput.value = SCREENING_INSTRUMENT_ADHD;
        }
        if (dom.questionDimensionInput && !normalizeScreeningDimension(dom.questionDimensionInput.value)) {
            dom.questionDimensionInput.value = 'inattention';
        }
        if (dom.questionOptionsInput) {
            const current = parseQuestionOptionsInput(dom.questionOptionsInput.value);
            if (current.length !== SCREENING_DEFAULT_OPTIONS.length) {
                dom.questionOptionsInput.value = SCREENING_DEFAULT_OPTIONS.join('\n');
            }
        }
    }
}

function syncQuestionEditState() {
    const category = normalizeQuestionCategory(dom.questionEditCategory?.value || QUESTION_CATEGORY_NORMAL);
    const type = category === SCREENING_CATEGORY
        ? 'choice'
        : normalizeQuestionType(dom.questionEditType?.value || 'text');
    if (dom.questionEditCategory) dom.questionEditCategory.value = category;
    if (dom.questionEditType) {
        dom.questionEditType.value = type;
        dom.questionEditType.disabled = category === SCREENING_CATEGORY;
    }
    if (dom.questionEditScreeningFields) {
        dom.questionEditScreeningFields.classList.toggle('hidden', category !== SCREENING_CATEGORY);
    }
    if (dom.questionEditOptionsGroup) {
        dom.questionEditOptionsGroup.classList.toggle('hidden', type !== 'choice');
    }
    if (category === SCREENING_CATEGORY) {
        if (dom.questionEditInstrument && !String(dom.questionEditInstrument.value || '').trim()) {
            dom.questionEditInstrument.value = SCREENING_INSTRUMENT_ADHD;
        }
        if (dom.questionEditDimension && !normalizeScreeningDimension(dom.questionEditDimension.value)) {
            dom.questionEditDimension.value = 'inattention';
        }
        if (dom.questionEditOptions) {
            const current = parseQuestionOptionsInput(dom.questionEditOptions.value);
            if (current.length !== SCREENING_DEFAULT_OPTIONS.length) {
                dom.questionEditOptions.value = SCREENING_DEFAULT_OPTIONS.join('\n');
            }
        }
    }
}

function openQuestionAdminModal() {
    if (!dom.modalQuestionAdmin || !isAdminUser()) return;
    if (dom.questionCategoryInput) dom.questionCategoryInput.value = normalizeQuestionCategory(dom.questionCategoryInput.value);
    if (dom.questionTypeInput) dom.questionTypeInput.value = normalizeQuestionType(dom.questionTypeInput.value || 'text');
    syncQuestionComposerState();
    dom.modalQuestionAdmin.classList.remove('hidden');
    dom.modalQuestionAdmin.classList.add('active');
    setQuestionAdminTab(appState.questionAdminTab || 'new');
    renderQuestionAdminManage();
}

function closeQuestionAdminModal() {
    if (!dom.modalQuestionAdmin) return;
    dom.modalQuestionAdmin.classList.add('hidden');
    dom.modalQuestionAdmin.classList.remove('active');
}

function setQuestionAdminTab(tab) {
    const next = tab === 'manage' ? 'manage' : (tab === 'deleted' ? 'deleted' : 'new');
    appState.questionAdminTab = next;
    if (dom.adminTabNew) dom.adminTabNew.classList.toggle('active', next === 'new');
    if (dom.adminTabManage) dom.adminTabManage.classList.toggle('active', next === 'manage');
    if (dom.adminTabDeleted) dom.adminTabDeleted.classList.toggle('active', next === 'deleted');
    if (dom.adminPanelNew) dom.adminPanelNew.classList.toggle('hidden', next !== 'new');
    if (dom.adminPanelManage) dom.adminPanelManage.classList.toggle('hidden', next !== 'manage');
    if (dom.adminPanelDeleted) dom.adminPanelDeleted.classList.toggle('hidden', next !== 'deleted');
    if (next === 'new') syncQuestionComposerState();
    if (next === 'manage' || next === 'deleted') renderQuestionAdminManage();
}

function renderQuestionAdminManage() {
    if (!dom.questionManageGrid || !dom.questionManageDeletedGrid || !isAdminUser()) return;
    dom.questionManageGrid.innerHTML = '';
    dom.questionManageDeletedGrid.innerHTML = '';
    if (!appState.questions.length) {
        const empty = document.createElement('p');
        empty.className = 'questions-empty';
        empty.textContent = 'まだお題がありません。';
        dom.questionManageGrid.appendChild(empty);
        return;
    }

    const activeQuestions = appState.questions.filter((question) => question.isActive !== false && !question.isFixed);
    const deletedQuestions = appState.questions.filter((question) => question.isActive === false && !question.isFixed);

    if (!activeQuestions.length) {
        const empty = document.createElement('p');
        empty.className = 'questions-empty';
        empty.textContent = '公開中のお題がありません。';
        dom.questionManageGrid.appendChild(empty);
    }

    activeQuestions.forEach((question) => {
        const card = document.createElement('div');
        card.className = 'question-manage-card';
        card.dataset.questionId = question.id;
        const count = appState.answerCountsByQuestionId?.[question.id] ?? 0;
        const typeLabel = question.type === 'choice' ? '選択式' : '記述式';
        const categoryLabel = getQuestionCategoryLabel(question.category);
        const instrumentLabel = question.category === SCREENING_CATEGORY ? getScreeningInstrumentLabel(question.instrumentId) : '';
        const dimensionLabel = question.category === SCREENING_CATEGORY ? getScreeningDimensionLabel(question.dimension) : '';
        const layerLabel = question.category === SCREENING_CATEGORY ? getPersonaLayerLabel(question.layer) : '';
        card.innerHTML = `
            <div class="question-manage-meta">
                <span>${question.isPublished ? '公開中' : '非公開'}</span>
                <span class="question-manage-count">回答 ${count}</span>
            </div>
            <div class="question-manage-meta">
                <span>${categoryLabel}</span>
                <span>${typeLabel}</span>
            </div>
            ${instrumentLabel || dimensionLabel || layerLabel ? `<div class="question-manage-meta"><span>${escapeHtml([instrumentLabel, dimensionLabel, layerLabel].filter(Boolean).join(' / '))}</span></div>` : ''}
            <div>${escapeHtml(truncateText(question.body || question.title || 'お題', 64))}</div>
        `;
        dom.questionManageGrid.appendChild(card);
    });

    if (!deletedQuestions.length) {
        const empty = document.createElement('p');
        empty.className = 'questions-empty';
        empty.textContent = '削除済みのお題はありません。';
        dom.questionManageDeletedGrid.appendChild(empty);
    }

    deletedQuestions.forEach((question) => {
        const card = document.createElement('div');
        card.className = 'question-manage-card question-manage-inactive';
        card.dataset.questionId = question.id;
        const count = appState.answerCountsByQuestionId?.[question.id] ?? 0;
        const typeLabel = question.type === 'choice' ? '選択式' : '記述式';
        const categoryLabel = getQuestionCategoryLabel(question.category);
        card.innerHTML = `
            <div class="question-manage-meta">
                <span>削除済み</span>
                <span class="question-manage-count">回答 ${count}</span>
            </div>
            <div class="question-manage-meta">
                <span>${categoryLabel}</span>
                <span>${typeLabel}</span>
            </div>
            <div>${escapeHtml(truncateText(question.body || question.title || 'お題', 64))}</div>
            <div class="question-manage-card-actions">
                <button class="question-manage-btn" data-action="restore">復元</button>
                <button class="question-manage-btn danger" data-action="delete">削除</button>
            </div>
        `;
        dom.questionManageDeletedGrid.appendChild(card);
    });
}

function openQuestionEditModal(questionId) {
    if (!dom.modalQuestionEdit || !isAdminUser()) return;
    const question = getQuestionById(questionId);
    if (!question) return;
    if (question.isFixed) {
        showToast('固定診断の質問は編集できません', 'error');
        return;
    }
    const type = normalizeQuestionType(question.type || 'text');
    const category = normalizeQuestionCategory(question.category || QUESTION_CATEGORY_NORMAL);
    appState.editingQuestionId = questionId;
    if (dom.questionEditTitle) dom.questionEditTitle.value = question.title || '';
    if (dom.questionEditCategory) dom.questionEditCategory.value = category;
    if (dom.questionEditType) dom.questionEditType.value = type;
    if (dom.questionEditInstrument) dom.questionEditInstrument.value = question.instrumentId || SCREENING_INSTRUMENT_ADHD;
    if (dom.questionEditDimension) dom.questionEditDimension.value = normalizeScreeningDimension(question.dimension || 'inattention') || 'inattention';
    if (dom.questionEditOrder) dom.questionEditOrder.value = Number.isFinite(Number(question.order)) ? String(question.order) : '1';
    if (dom.questionEditCore) dom.questionEditCore.checked = !!question.isCore;
    if (dom.questionEditBody) dom.questionEditBody.value = question.body || '';
    if (dom.questionEditOptions) dom.questionEditOptions.value = (question.options || []).join('\n');
    syncQuestionEditState();
    if (dom.questionEditPublished) dom.questionEditPublished.checked = !!question.isPublished;
    dom.modalQuestionEdit.classList.remove('hidden');
    dom.modalQuestionEdit.classList.add('active');
}

function closeQuestionEditModal() {
    if (!dom.modalQuestionEdit) return;
    dom.modalQuestionEdit.classList.add('hidden');
    dom.modalQuestionEdit.classList.remove('active');
    appState.editingQuestionId = null;
}

async function saveQuestionEdit() {
    if (!isAdminUser() || !appState.editingQuestionId) return;
    const db = window.db;
    if (!db) return;
    const category = normalizeQuestionCategory(dom.questionEditCategory ? dom.questionEditCategory.value : QUESTION_CATEGORY_NORMAL);
    const type = category === SCREENING_CATEGORY
        ? 'choice'
        : normalizeQuestionType(dom.questionEditType ? dom.questionEditType.value : 'text');
    let options = type === 'choice' ? parseQuestionOptionsInput(dom.questionEditOptions ? dom.questionEditOptions.value : '') : [];
    options = ensureQuestionOptionsByCategory(category, options);
    const optionScores = normalizeOptionScores([], options.length);
    const instrumentId = category === SCREENING_CATEGORY
        ? String(dom.questionEditInstrument ? dom.questionEditInstrument.value : SCREENING_INSTRUMENT_ADHD).trim() || SCREENING_INSTRUMENT_ADHD
        : '';
    const dimension = category === SCREENING_CATEGORY
        ? normalizeScreeningDimension(dom.questionEditDimension ? dom.questionEditDimension.value : '')
        : '';
    const orderValue = Number(dom.questionEditOrder ? dom.questionEditOrder.value : 0);
    const order = Number.isFinite(orderValue) && orderValue > 0 ? Math.floor(orderValue) : 0;
    const isCore = category === SCREENING_CATEGORY
        ? !!(dom.questionEditCore && dom.questionEditCore.checked)
        : false;
    const payload = {
        title: dom.questionEditTitle ? dom.questionEditTitle.value.trim() : '',
        category,
        type,
        options,
        optionScores,
        instrumentId,
        dimension,
        order,
        isCore,
        body: dom.questionEditBody ? dom.questionEditBody.value.trim() : '',
        isPublished: dom.questionEditPublished ? dom.questionEditPublished.checked : false,
        updatedAt: getServerTimestamp()
    };
    if (!payload.body) {
        showToast('お題本文を入力してください', 'error');
        return;
    }
    if (type === 'choice' && options.length < 2) {
        showToast('選択式は2つ以上の選択肢が必要です', 'error');
        return;
    }
    if (category === SCREENING_CATEGORY && options.length !== SCREENING_DEFAULT_OPTIONS.length) {
        showToast('自己スクリーニングは5件法の選択肢が必要です', 'error');
        return;
    }
    try {
        await db.collection('questions').doc(appState.editingQuestionId).set(payload, { merge: true });
        showToast('お題を更新しました');
        closeQuestionEditModal();
        loadQuestionsAndAnswers();
    } catch (err) {
        console.error('[questions] update failed', err);
        showToast('お題の更新に失敗しました', 'error');
    }
}

async function softDeleteQuestion() {
    if (!isAdminUser() || !appState.editingQuestionId) return;
    const db = window.db;
    if (!db) return;
    const targetQuestionId = appState.editingQuestionId;
    try {
        await db.collection('questions').doc(targetQuestionId).set({
            isActive: false,
            updatedAt: getServerTimestamp()
        }, { merge: true });
        const deletedAnswerCount = await deleteOwnAnswersByQuestionId(targetQuestionId);
        const deletedSuffix = deletedAnswerCount > 0 ? `（回答${deletedAnswerCount}件も削除）` : '';
        showToast(`お題を削除しました${deletedSuffix}`);
        closeQuestionEditModal();
        loadQuestionsAndAnswers();
    } catch (err) {
        console.error('[questions] delete failed', {
            code: err?.code,
            message: err?.message,
            questionId: targetQuestionId
        });
        showToast('お題の削除に失敗しました', 'error');
    }
}

async function restoreQuestion(questionId) {
    if (!isAdminUser() || !questionId) return;
    const db = window.db;
    if (!db) return;
    try {
        await db.collection('questions').doc(questionId).set({ isActive: true }, { merge: true });
        showToast('お題を復元しました');
        loadQuestionsAndAnswers();
    } catch (err) {
        console.error('[questions] restore failed', err);
        showToast('お題の復元に失敗しました', 'error');
    }
}

async function hardDeleteQuestion(questionId) {
    if (!isAdminUser() || !questionId) return;
    const db = window.db;
    if (!db) return;
    try {
        const deletedAnswerCount = await deleteOwnAnswersByQuestionId(questionId);
        await db.collection('questions').doc(questionId).delete();
        const deletedSuffix = deletedAnswerCount > 0 ? `（回答${deletedAnswerCount}件も削除）` : '';
        showToast(`お題を完全に削除しました${deletedSuffix}`);
        loadQuestionsAndAnswers();
    } catch (err) {
        console.error('[questions] hard delete failed', {
            code: err?.code,
            message: err?.message,
            questionId
        });
        showToast('お題の削除に失敗しました', 'error');
    }
}

async function deleteOwnAnswersByQuestionId(questionId) {
    const db = window.db;
    if (!db || !appState.user || !questionId) return 0;

    try {
        const snapshot = await db.collection('answers')
            .where('userId', '==', appState.user.uid)
            .where('questionId', '==', questionId)
            .get();
        if (!snapshot || snapshot.empty) return 0;

        const deletedIds = snapshot.docs.map((docSnap) => docSnap.id);
        for (let index = 0; index < snapshot.docs.length; index += 400) {
            const batch = db.batch();
            snapshot.docs.slice(index, index + 400).forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });
            await batch.commit();
        }

        if (deletedIds.length) {
            const deletedSet = new Set(deletedIds);
            appState.answers = appState.answers.filter((item) => !deletedSet.has(item.id));
            Object.keys(appState.answersById).forEach((answerQuestionId) => {
                const answerId = appState.answersById[answerQuestionId]?.id;
                if (answerId && deletedSet.has(answerId)) {
                    delete appState.answersById[answerQuestionId];
                }
            });
            if (appState.deletingAnswerId && deletedSet.has(appState.deletingAnswerId)) {
                appState.deletingAnswerId = null;
            }
            if (appState.detailAnswerId && deletedSet.has(appState.detailAnswerId)) {
                closeAnswerDetailModal();
            }
        }

        return deletedIds.length;
    } catch (err) {
        console.warn('[questions] failed to delete linked answers', {
            code: err?.code,
            message: err?.message,
            questionId
        });
        return 0;
    }
}

async function saveQuestionFromModal() {
    if (!isAdminUser()) return;
    const db = window.db;
    if (!db || !appState.user) return;

    const title = dom.questionTitleInput ? dom.questionTitleInput.value.trim() : '';
    const category = normalizeQuestionCategory(dom.questionCategoryInput ? dom.questionCategoryInput.value : QUESTION_CATEGORY_NORMAL);
    const type = category === SCREENING_CATEGORY
        ? 'choice'
        : normalizeQuestionType(dom.questionTypeInput ? dom.questionTypeInput.value : 'text');
    const body = dom.questionBodyInput ? dom.questionBodyInput.value.trim() : '';
    let options = type === 'choice' ? parseQuestionOptionsInput(dom.questionOptionsInput ? dom.questionOptionsInput.value : '') : [];
    options = ensureQuestionOptionsByCategory(category, options);
    const optionScores = normalizeOptionScores([], options.length);
    const instrumentId = category === SCREENING_CATEGORY
        ? String(dom.questionInstrumentInput ? dom.questionInstrumentInput.value : SCREENING_INSTRUMENT_ADHD).trim() || SCREENING_INSTRUMENT_ADHD
        : '';
    const dimension = category === SCREENING_CATEGORY
        ? normalizeScreeningDimension(dom.questionDimensionInput ? dom.questionDimensionInput.value : '')
        : '';
    const orderValue = Number(dom.questionOrderInput ? dom.questionOrderInput.value : 0);
    const order = Number.isFinite(orderValue) && orderValue > 0 ? Math.floor(orderValue) : 0;
    const isCore = category === SCREENING_CATEGORY
        ? !!(dom.questionCoreInput && dom.questionCoreInput.checked)
        : false;
    const isPublished = dom.questionPublishedInput ? dom.questionPublishedInput.checked : false;

    if (!body) {
        showToast('お題本文を入力してください', 'error');
        return;
    }
    if (type === 'choice' && options.length < 2) {
        showToast('選択式は2つ以上の選択肢が必要です', 'error');
        return;
    }
    if (category === SCREENING_CATEGORY && options.length !== SCREENING_DEFAULT_OPTIONS.length) {
        showToast('自己スクリーニングは5件法の選択肢が必要です', 'error');
        return;
    }

    const payload = {
        title,
        category,
        type,
        options,
        optionScores,
        instrumentId,
        dimension,
        order,
        isCore,
        body,
        isPublished,
        isActive: true,
        createdAt: getServerTimestamp(),
        createdBy: appState.user.uid
    };

    try {
        await db.collection('questions').add(payload);
        showToast('保存しました');
        if (dom.questionTitleInput) dom.questionTitleInput.value = '';
        if (dom.questionCategoryInput) dom.questionCategoryInput.value = QUESTION_CATEGORY_NORMAL;
        if (dom.questionTypeInput) dom.questionTypeInput.value = 'text';
        if (dom.questionInstrumentInput) dom.questionInstrumentInput.value = SCREENING_INSTRUMENT_ADHD;
        if (dom.questionDimensionInput) dom.questionDimensionInput.value = 'inattention';
        if (dom.questionOrderInput) dom.questionOrderInput.value = '1';
        if (dom.questionCoreInput) dom.questionCoreInput.checked = true;
        if (dom.questionBodyInput) dom.questionBodyInput.value = '';
        if (dom.questionOptionsInput) dom.questionOptionsInput.value = '';
        syncQuestionComposerState();
        if (dom.questionPublishedInput) dom.questionPublishedInput.checked = true;
        closeQuestionAdminModal();
        loadQuestionsAndAnswers();
    } catch (err) {
        console.error('[questions] create failed', {
            code: err?.code,
            message: err?.message,
            stack: err?.stack,
            user: appState.user?.email || null,
            payload
        });
        showToast('お題の保存に失敗しました', 'error');
    }
}

async function saveEntryToFirestore(entry) {
    const auth = window.auth;
    const db = window.db;

    if (!auth || !auth.currentUser || !db) {
        alert('\u30ed\u30b0\u30a4\u30f3\u72b6\u614b\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u304f\u3060\u3055\u3044\u3002');
        return false;
    }

    const serverTimestamp = getServerTimestamp();
    const isUpdate = !!entry.id;
    const existingCreatedAt = entry.createdAt || entry.created_at || entry.date || null;
    const createdAtValue = isUpdate ? (existingCreatedAt || serverTimestamp) : serverTimestamp;
    const createdAtIso = isUpdate && entry.created_at
        ? entry.created_at
        : (toDateValue(existingCreatedAt) ? toDateValue(existingCreatedAt).toISOString() : getEntryDate(entry).toISOString());
    const entryData = {
        userId: auth.currentUser.uid,
        createdAt: createdAtValue,
        created_at: createdAtIso,
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
        alert('\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + e.message);
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
        showToast('\u65e5\u8a18\u3092\u524a\u9664\u3057\u307e\u3057\u305f');
    } catch (e) {
        console.error('Delete Error:', e);
        showToast('\u524a\u9664\u306b\u5931\u6557\u3057\u307e\u3057\u305f', 'error');
    }
}

// --- Navigation ---
function navigateTo(viewName) {
    if (
        appState.personaSessionActive
        && appState.currentView === 'questions'
        && viewName !== 'questions'
    ) {
        const shouldLeave = window.confirm('今の5レイヤー診断を中断すると、現在の診断は最初からになります。移動しますか？');
        if (!shouldLeave) return;
        finishPersonaLayerSession({ showCompletedToast: false });
    }
    appState.currentView = viewName;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (dom.viewList) dom.viewList.classList.remove('active');
    if (dom.viewMyPage) dom.viewMyPage.classList.remove('active');
    if (dom.viewEditor) dom.viewEditor.classList.remove('active');
    if (dom.viewQuestions) dom.viewQuestions.classList.remove('active');
    if (dom.viewSettings) dom.viewSettings.classList.remove('active');

    if (viewName === 'list') {
        if (dom.viewList) { dom.viewList.classList.remove('hidden'); requestAnimationFrame(() => dom.viewList.classList.add('active')); }
        if (dom.btnViewList) dom.btnViewList.classList.add('active');
        renderEntryList();
    } else if (viewName === 'editor') {
        if (dom.viewEditor) {
            dom.viewEditor.classList.remove('hidden');
            requestAnimationFrame(() => {
                dom.viewEditor.classList.add('active');
                setupJournalLayout();
            });
        }
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
        updateCalendarSidePanel(appState.calendarSelectedDate || appState.calendarDate);
    } else if (viewName === 'mypage') {
        appState.filterByDate = null;
        if (dom.viewMyPage) { dom.viewMyPage.classList.remove('hidden'); requestAnimationFrame(() => dom.viewMyPage.classList.add('active')); }
        if (dom.btnMyPage) dom.btnMyPage.classList.add('active');
        renderMyPage();
        if (appState.user && !appState.screeningLoading) {
            loadScreeningProfile();
        }
    } else if (viewName === 'questions') {
        if (dom.viewQuestions) { dom.viewQuestions.classList.remove('hidden'); requestAnimationFrame(() => dom.viewQuestions.classList.add('active')); }
        if (dom.btnViewQuestions) dom.btnViewQuestions.classList.add('active');
        if (!appState.questions.length) loadQuestionsAndAnswers();
        renderQuestionsPage();
    }
    syncPersonaQuestionFocus();
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

function toPositiveNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.includes(':')) {
        const parts = splitTimeParts(raw);
        const hourNum = Number(parts.hour || 0);
        const minuteNum = Number(parts.minute || 0);
        const total = hourNum + (minuteNum / 60);
        return Number.isFinite(total) && total > 0 ? total : null;
    }
    if (/[時間分]/.test(raw)) {
        const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*時間/);
        const minuteMatch = raw.match(/(\d+(?:\.\d+)?)\s*分/);
        const hourNum = hourMatch ? Number(hourMatch[1]) : 0;
        const minuteNum = minuteMatch ? Number(minuteMatch[1]) : 0;
        const total = hourNum + (minuteNum / 60);
        return Number.isFinite(total) && total > 0 ? total : null;
    }
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function average(values) {
    if (!values.length) return null;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
}

function buildSparkline(values, width = 200, height = 64) {
    if (!values.length) {
        return `<div class="sparkline-empty">データなし</div>`;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 6;
    const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
    const points = values.map((value, idx) => {
        const x = padding + step * idx;
        const y = padding + (height - padding * 2) * (1 - (value - min) / range);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const circles = values.map((value, idx) => {
        const x = padding + step * idx;
        const y = padding + (height - padding * 2) * (1 - (value - min) / range);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2"></circle>`;
    }).join('');
    return `
        <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="体重の推移">
            <polyline points="${points}"></polyline>
            ${circles}
        </svg>
    `;
}

function summarizeMoodAndSatisfaction(records) {
    const moodValues = records.map((r) => r.mood).filter((v) => v != null);
    const satisfactionValues = records.map((r) => r.satisfaction).filter((v) => v != null);
    return {
        moodAvg: average(moodValues),
        moodCount: moodValues.length,
        satisfactionAvg: average(satisfactionValues),
        satisfactionCount: satisfactionValues.length
    };
}

function formatDelta(delta) {
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}`;
}

function buildJournalInsight(records) {
    const base = summarizeMoodAndSatisfaction(records);
    if (!base.moodCount && !base.satisfactionCount) {
        return '気分や満足度の記録が増えると傾向を表示します。';
    }

    const candidates = [
        { label: '睡眠7時間以上', match: (r) => r.sleep != null && r.sleep >= 7 },
        { label: '睡眠8時間以上', match: (r) => r.sleep != null && r.sleep >= 8 },
        { label: '朝食を記録した日', match: (r) => r.hasBreakfast },
        { label: '食事を3回記録した日', match: (r) => r.hasMealsAll },
        { label: 'できたことを書いた日', match: (r) => r.hasDone },
        { label: 'ハイライトを書いた日', match: (r) => r.hasHighlight },
        { label: '日記を書いた日', match: (r) => r.hasDiary }
    ];

    let best = null;
    candidates.forEach((candidate) => {
        const subset = records.filter(candidate.match);
        const stats = summarizeMoodAndSatisfaction(subset);
        const dataCount = stats.moodCount + stats.satisfactionCount;
        if (dataCount < 3) return;

        const moodDelta = base.moodAvg != null && stats.moodAvg != null ? stats.moodAvg - base.moodAvg : 0;
        const satisfactionDelta = base.satisfactionAvg != null && stats.satisfactionAvg != null
            ? stats.satisfactionAvg - base.satisfactionAvg
            : 0;
        const score = moodDelta + satisfactionDelta;

        if (!best || score > best.score) {
            best = { candidate, stats, moodDelta, satisfactionDelta, score };
        }
    });

    if (!best || best.score < 0.3) {
        return '今ははっきりした傾向が見つかりませんでした。';
    }

    const parts = [];
    if (best.stats.moodAvg != null && base.moodAvg != null) {
        parts.push(`気分${formatDelta(best.moodDelta)}`);
    }
    if (best.stats.satisfactionAvg != null && base.satisfactionAvg != null) {
        parts.push(`満足度${formatDelta(best.satisfactionDelta)}`);
    }
    const detail = parts.length ? `${parts.join('、')}の傾向` : '変化が小さめ';
    return `${best.candidate.label}の日は、${detail}があります。`;
}

function aggregateJournalMetrics(entries) {
    const records = entries.map((entry) => {
        const journal = getJournalFromEntry(entry);
        const diaryText = String(entry.content || '').trim();
        const breakfast = String(journal.meals?.breakfast || '').trim();
        const lunch = String(journal.meals?.lunch || '').trim();
        const dinner = String(journal.meals?.dinner || '').trim();
        return {
            date: getEntryDate(entry),
            sleep: toPositiveNumber(journal.sleepHours),
            weight: toPositiveNumber(journal.weight),
            mood: toPositiveNumber(journal.mood),
            satisfaction: toPositiveNumber(journal.satisfaction),
            hasBreakfast: !!breakfast,
            hasMealsAll: !!(breakfast && lunch && dinner),
            hasDone: !!String(journal.done || '').trim(),
            hasHighlight: !!String(journal.highlight || '').trim(),
            hasDiary: !!diaryText
        };
    });

    const sleepValues = records.map((r) => r.sleep).filter((v) => v != null);
    const sleepAvg = average(sleepValues);

    const weightSeries = records
        .filter((r) => r.weight != null)
        .sort((a, b) => a.date - b.date);
    const weightValues = weightSeries.map((r) => r.weight);
    const weightDelta = weightValues.length > 1
        ? weightValues[weightValues.length - 1] - weightValues[0]
        : null;

    return {
        sleepAvg,
        sleepCount: sleepValues.length,
        weightValues,
        weightDelta,
        insightText: buildJournalInsight(records)
    };
}

function parseDateKey(key) {
    if (!key) return null;
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function getRecentMetricSeries(entries, extractor, limit = 7) {
    const records = entries.map((entry) => {
        const journal = getJournalFromEntry(entry);
        return {
            date: getEntryDate(entry),
            value: extractor(journal)
        };
    }).filter((r) => r.value != null);
    records.sort((a, b) => a.date - b.date);
    const sliced = records.slice(-limit);
    return sliced.map((r) => r.value);
}

function buildRecentSleepBarData(entries, days = 7) {
    const sleepByDate = new Map();
    entries.forEach((entry) => {
        const key = getJournalDateKeyForEntry(getEntryDate(entry));
        if (sleepByDate.has(key)) return;
        const journal = getJournalFromEntry(entry);
        sleepByDate.set(key, toPositiveNumber(journal.sleepHours));
    });

    const baseDate = getJournalDayStart(new Date());
    const points = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - offset);
        const key = getDateKey(d);
        const value = sleepByDate.has(key) ? sleepByDate.get(key) : null;
        points.push({
            dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
            value: value != null ? Number(value) : null
        });
    }
    return points;
}

function buildRecentMetricPoints(entries, extractor, days = 7) {
    const valueByDate = new Map();
    entries.forEach((entry) => {
        const key = getJournalDateKeyForEntry(getEntryDate(entry));
        if (valueByDate.has(key)) return;
        const journal = getJournalFromEntry(entry);
        valueByDate.set(key, extractor(journal));
    });
    const baseDate = getJournalDayStart(new Date());
    const points = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - offset);
        const key = getDateKey(d);
        const value = valueByDate.has(key) ? valueByDate.get(key) : null;
        points.push({
            dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
            value: value != null ? Number(value) : null
        });
    }
    return points;
}

function buildSleepBarChart(points, width = 320, height = 150) {
    if (!Array.isArray(points) || !points.length) {
        return `<div class="sparkline-empty">データなし</div>`;
    }
    const values = points.map((point) => point.value).filter((value) => value != null);
    const maxValue = values.length ? Math.max(...values) : 0;
    const yMax = Math.max(8, Math.ceil(maxValue / 2) * 2);
    const margin = { top: 8, right: 8, bottom: 32, left: 34 };
    const plotWidth = Math.max(10, width - margin.left - margin.right);
    const plotHeight = Math.max(10, height - margin.top - margin.bottom);
    const step = plotWidth / points.length;
    const barWidth = Math.max(8, step * 0.58);
    const ticks = 4;

    const gridLines = [];
    const yLabels = [];
    for (let i = 0; i <= ticks; i += 1) {
        const value = (yMax / ticks) * i;
        const y = margin.top + plotHeight - (value / yMax) * plotHeight;
        gridLines.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" class="sleep-bar-grid" />`);
        yLabels.push(`<text x="${(margin.left - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="sleep-bar-axis-label">${value.toFixed(0)}</text>`);
    }

    const bars = points.map((point, idx) => {
        const x = margin.left + idx * step + (step - barWidth) / 2;
        const numeric = point.value != null ? Math.max(0, point.value) : 0;
        const barHeight = (numeric / yMax) * plotHeight;
        const y = margin.top + plotHeight - barHeight;
        const valueText = point.value != null ? point.value.toFixed(1) : '';
        return `
            <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" class="sleep-bar-rect${point.value == null ? ' is-empty' : ''}" />
            ${valueText ? `<text x="${(x + barWidth / 2).toFixed(1)}" y="${Math.max(margin.top + 10, y - 4).toFixed(1)}" text-anchor="middle" class="sleep-bar-value">${valueText}</text>` : ''}
            <text x="${(x + barWidth / 2).toFixed(1)}" y="${(margin.top + plotHeight + 16).toFixed(1)}" text-anchor="middle" class="sleep-bar-date">${point.dateLabel}</text>
        `;
    }).join('');

    return `
        <svg class="sleep-bar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="過去7日間の睡眠時間棒グラフ">
            ${gridLines.join('')}
            ${yLabels.join('')}
            <line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" class="sleep-bar-axis" />
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(margin.top + plotHeight).toFixed(1)}" class="sleep-bar-axis" />
            <text x="12" y="${(margin.top + plotHeight / 2).toFixed(1)}" text-anchor="middle" class="sleep-bar-axis-title" transform="rotate(-90 12 ${(margin.top + plotHeight / 2).toFixed(1)})">時間</text>
            ${bars}
        </svg>
    `;
}

function buildWeightLineChart(points, width = 320, height = 170) {
    if (!Array.isArray(points) || !points.length) {
        return `<div class="sparkline-empty">データなし</div>`;
    }
    const values = points.map((point) => point.value).filter((value) => value != null);
    const hasValues = values.length > 0;
    const minValue = hasValues ? Math.min(...values) : 45;
    const maxValue = hasValues ? Math.max(...values) : 75;
    const paddedMin = Math.max(0, Math.floor((minValue - 0.6) * 10) / 10);
    const paddedMax = Math.ceil((maxValue + 0.6) * 10) / 10;
    const yRange = Math.max(0.5, paddedMax - paddedMin);
    const margin = { top: 8, right: 8, bottom: 32, left: 38 };
    const plotWidth = Math.max(10, width - margin.left - margin.right);
    const plotHeight = Math.max(10, height - margin.top - margin.bottom);
    const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;
    const ticks = 4;

    const gridLines = [];
    const yLabels = [];
    for (let i = 0; i <= ticks; i += 1) {
        const value = paddedMin + (yRange / ticks) * i;
        const y = margin.top + plotHeight - ((value - paddedMin) / yRange) * plotHeight;
        gridLines.push(`<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${y.toFixed(1)}" class="weight-line-grid" />`);
        yLabels.push(`<text x="${(margin.left - 6).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="weight-line-axis-label">${value.toFixed(1)}</text>`);
    }

    const plottedPoints = points.map((point, index) => {
        const x = margin.left + step * index;
        if (point.value == null) return null;
        const y = margin.top + plotHeight - ((point.value - paddedMin) / yRange) * plotHeight;
        return { x, y, value: point.value, dateLabel: point.dateLabel };
    });
    const validPoints = plottedPoints.filter(Boolean);
    const polyline = validPoints.length
        ? `<polyline class="weight-line-path" points="${validPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" />`
        : '';
    const circles = validPoints.map((point) => `<circle class="weight-line-point" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.8" />`).join('');
    const emptyDots = !hasValues ? points.map((point, index) => {
        const x = margin.left + step * index;
        const y = margin.top + plotHeight * 0.5;
        return `<circle class="weight-line-point is-empty" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" />`;
    }).join('') : '';
    const emptyGuide = !hasValues
        ? `<line x1="${margin.left}" y1="${(margin.top + plotHeight * 0.5).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight * 0.5).toFixed(1)}" class="weight-line-placeholder" />`
        : '';

    const dateLabels = points.map((point, index) => {
        const x = margin.left + step * index;
        return `<text x="${x.toFixed(1)}" y="${(margin.top + plotHeight + 16).toFixed(1)}" text-anchor="middle" class="weight-line-date">${point.dateLabel}</text>`;
    }).join('');

    return `
        <svg class="weight-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="過去7日間の体重推移折れ線グラフ">
            ${gridLines.join('')}
            ${yLabels.join('')}
            <line x1="${margin.left}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${(margin.top + plotHeight).toFixed(1)}" class="weight-line-axis" />
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(margin.top + plotHeight).toFixed(1)}" class="weight-line-axis" />
            <text x="12" y="${(margin.top + plotHeight / 2).toFixed(1)}" text-anchor="middle" class="weight-line-axis-title" transform="rotate(-90 12 ${(margin.top + plotHeight / 2).toFixed(1)})">kg</text>
            ${emptyGuide}
            ${polyline}
            ${circles}
            ${emptyDots}
            ${dateLabels}
        </svg>
    `;
}

function clampPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, numeric));
}

function getPersonaRadarAxisData(row) {
    const score = clampPercent(row?.score);
    const leftLabel = String(row?.leftLabel || '').trim();
    const rightLabel = String(row?.rightLabel || '').trim();
    const dominantSide = score >= 50 ? 'right' : 'left';
    const fallbackLabel = dominantSide === 'right' ? rightLabel : leftLabel;
    const label = String(row?.dominantLabel || fallbackLabel || row?.axisCode || '').trim() || '軸';
    const dominantPercentRaw = row?.dominantPercent;
    const dominantPercent = Number.isFinite(Number(dominantPercentRaw))
        ? clampPercent(Number(dominantPercentRaw))
        : (dominantSide === 'right' ? score : clampPercent(100 - score));
    return {
        label,
        value: dominantPercent
    };
}

function buildPersonaLayerRadarChart(axisTable, options = {}) {
    if (!Array.isArray(axisTable) || !axisTable.length) {
        return '<div class="mypage-persona-radar-empty">未回答</div>';
    }
    const axes = axisTable.map(getPersonaRadarAxisData).filter((axis) => axis.label);
    const count = axes.length;
    if (count < 3) {
        return '<div class="mypage-persona-radar-empty">軸データ不足</div>';
    }

    const width = Number(options.width) || 250;
    const height = Number(options.height) || 200;
    const cx = width / 2;
    const cy = height / 2 + 3;
    const radius = Math.max(48, Math.min(width * 0.34, height * 0.34));
    const levels = [0.25, 0.5, 0.75, 1];
    const angleStep = (Math.PI * 2) / count;
    const startAngle = -Math.PI / 2;

    const getPoint = (index, scale) => {
        const angle = startAngle + angleStep * index;
        return {
            x: cx + Math.cos(angle) * radius * scale,
            y: cy + Math.sin(angle) * radius * scale
        };
    };

    const gridPolygons = levels.map((level) => {
        const points = axes.map((_, index) => {
            const p = getPoint(index, level);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        }).join(' ');
        return `<polygon points="${points}" class="mypage-persona-radar-grid" />`;
    }).join('');

    const spokes = axes.map((_, index) => {
        const p = getPoint(index, 1);
        return `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" class="mypage-persona-radar-spoke" />`;
    }).join('');

    const dataPointList = axes.map((axis, index) => {
        const p = getPoint(index, clampPercent(axis.value) / 100);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    });
    const dataPoints = dataPointList.join(' ');
    const closedLinePoints = dataPointList.length > 2
        ? `${dataPoints} ${dataPointList[0]}`
        : dataPoints;

    const dots = axes.map((axis, index) => {
        const p = getPoint(index, clampPercent(axis.value) / 100);
        return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.9" class="mypage-persona-radar-dot" />`;
    }).join('');

    const labels = axes.map((axis, index) => {
        const p = getPoint(index, 1.12);
        const anchor = p.x > cx + 8 ? 'start' : (p.x < cx - 8 ? 'end' : 'middle');
        return `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="${anchor}" class="mypage-persona-radar-label">${escapeHtml(axis.label)}</text>`;
    }).join('');

    return `
        <svg class="mypage-persona-radar-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="レイヤーレーダーチャート">
            ${gridPolygons}
            ${spokes}
            <polygon points="${dataPoints}" class="mypage-persona-radar-area" />
            <polyline points="${closedLinePoints}" class="mypage-persona-radar-line" />
            ${dots}
            ${labels}
        </svg>
    `;
}

function computeNextPlanCompletion(entries) {
    const byDate = new Map();
    entries.forEach((entry) => {
        if (!isFinalEntry(entry)) return;
        const key = getJournalDateKeyForEntry(getEntryDate(entry));
        if (!byDate.has(key)) {
            byDate.set(key, getJournalFromEntry(entry));
        }
    });
    const keys = Array.from(byDate.keys()).sort();
    let total = 0;
    let completed = 0;
    keys.forEach((key) => {
        const journal = byDate.get(key);
        const nextPlan = String(journal.nextPlan || '').trim();
        if (!nextPlan) return;
        total += 1;
        const dateObj = parseDateKey(key);
        if (!dateObj) return;
        dateObj.setDate(dateObj.getDate() + 1);
        const nextKey = getDateKey(dateObj);
        const nextJournal = byDate.get(nextKey);
        if (nextJournal && String(nextJournal.done || '').trim()) {
            completed += 1;
        }
    });
    const rate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, rate };
}

function getBucketList() {
    const list = appState.userProfile?.bucketList;
    return Array.isArray(list)
        ? list.map((item) => ({
            text: String(item.text || '').trim(),
            done: !!item.done
        })).filter((item) => item.text)
        : [];
}

function computeBucketProgress(list) {
    const total = list.length;
    const done = list.filter((item) => item.done).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
}

function computeLevelStats(entries) {
    const totalCount = entries.length;
    const totalChars = entries.reduce((sum, entry) => sum + String(entry.content || '').length, 0);
    const analysisCount = entries.reduce((sum, entry) => (appState.analysisById[entry.id] ? sum + 1 : sum), 0);
    const answerCount = Array.isArray(appState.answers) ? appState.answers.length : 0;
    const score = (totalCount * 3) + Math.floor(totalChars / 500) + (analysisCount * 2) + (answerCount * 2);
    const level = Math.min(999, Math.max(1, Math.floor(score / 5) + 1));
    return { level, totalCount, totalChars, analysisCount, answerCount };
}

const AVATAR_CATALOG = [
    { id: 'seed', label: 'スプラウト', level: 1, icon: 'fa-seedling' },
    { id: 'feather', label: 'フェザー', level: 5, icon: 'fa-feather' },
    { id: 'moon', label: 'ムーン', level: 10, icon: 'fa-moon' },
    { id: 'star', label: 'スター', level: 20, icon: 'fa-star' },
    { id: 'sparkles', label: 'スパーク', level: 35, icon: 'fa-wand-magic-sparkles' },
    { id: 'crown', label: 'クラウン', level: 50, icon: 'fa-crown' }
];

function getUnlockedAvatars(level) {
    return AVATAR_CATALOG.filter((item) => level >= item.level);
}

function getProfileAvatar(level) {
    const unlocked = getUnlockedAvatars(level);
    if (!unlocked.length) return null;
    const selectedId = appState.userProfile?.avatarId;
    const selected = unlocked.find((item) => item.id === selectedId);
    return selected || unlocked[unlocked.length - 1];
}

function getProfileDisplayName() {
    const raw = String(appState.userProfile?.displayName || appState.user?.displayName || '').trim();
    if (raw) return raw;
    const email = String(appState.user?.email || '').trim();
    if (email.includes('@')) return email.split('@')[0];
    return 'あなた';
}

function getProfileAvatarLetter(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'D';
    return trimmed[0];
}

function getProfileAvatarUrl() {
    const url = String(appState.userProfile?.avatarUrl || '').trim();
    return url || '';
}

function countByKey(list, getKey) {
    const counts = {};
    list.forEach((item) => {
        const key = getKey(item);
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts)
        .map((key) => ({ label: key, count: counts[key] }))
        .sort((a, b) => b.count - a.count);
}

function extractDomains(text) {
    const domains = [];
    const urlMatches = String(text || '').match(/https?:\/\/[^\s)]+/gi) || [];
    urlMatches.forEach((raw) => {
        try {
            const url = new URL(raw);
            const host = url.hostname.replace(/^www\./, '');
            if (host) domains.push(host);
        } catch {
            // ignore parse errors
        }
    });
    const looseMatches = String(text || '').match(/\b[a-z0-9.-]+\.[a-z]{2,}\b/gi) || [];
    looseMatches.forEach((raw) => {
        const host = raw.replace(/^www\./, '');
        if (host && !domains.includes(host)) domains.push(host);
    });
    return domains;
}

function tokenizeFood(text) {
    return String(text || '')
        .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && w.length <= 8);
}

function buildAggregateInsightPayload(entries, latestEntry) {
    const finals = entries.filter(isFinalEntry);
    const sleepValues = [];
    const moodValues = [];
    const satisfactionValues = [];
    const locations = [];
    const foods = [];
    const domains = [];
    const sleepMoodPairs = [];
    const sleepSatisfactionPairs = [];

    finals.forEach((entry) => {
        const journal = getJournalFromEntry(entry);
        const sleep = toPositiveNumber(journal.sleepHours);
        const mood = toPositiveNumber(journal.mood);
        const satisfaction = toPositiveNumber(journal.satisfaction);
        if (sleep != null) sleepValues.push(sleep);
        if (mood != null) moodValues.push(mood);
        if (satisfaction != null) satisfactionValues.push(satisfaction);
        if (sleep != null && mood != null) sleepMoodPairs.push({ sleep, mood });
        if (sleep != null && satisfaction != null) sleepSatisfactionPairs.push({ sleep, satisfaction });

        if (Array.isArray(journal.locations) && journal.locations.length) {
            journal.locations
                .map((loc) => String(loc.label || '').trim())
                .filter(Boolean)
                .forEach((label) => locations.push(label));
        } else {
            const locLabel = (journal.locationLabel || journal.location || '').trim();
            if (locLabel) locations.push(locLabel);
        }

        foods.push(...tokenizeFood(journal.meals?.breakfast));
        foods.push(...tokenizeFood(journal.meals?.lunch));
        foods.push(...tokenizeFood(journal.meals?.dinner));

        domains.push(...extractDomains(journal.browsing || ''));
    });

    const topLocations = countByKey(locations, (v) => v).slice(0, 5);
    const topFoods = countByKey(foods, (v) => v).slice(0, 5);
    const topDomains = countByKey(domains, (v) => v).slice(0, 5);

    const avgSleep = average(sleepValues);
    const avgMood = average(moodValues);
    const avgSatisfaction = average(satisfactionValues);
    const avgSleepMood = average(sleepMoodPairs.map((p) => p.mood));
    const avgSleepSatisfaction = average(sleepSatisfactionPairs.map((p) => p.satisfaction));

    const latestJournal = latestEntry ? getJournalFromEntry(latestEntry) : {};
    const daily = latestEntry ? {
        text: String(latestEntry.content || ''),
        mood: latestJournal.mood || '',
        satisfaction: latestJournal.satisfaction || '',
        sleepHours: latestJournal.sleepHours || '',
        meals: latestJournal.meals || {},
        locationLabel: (() => {
            const summary = buildLocationSummaryText(
                Array.isArray(latestJournal.locations) ? latestJournal.locations.map(normalizeLocationItem) : []
            );
            return summary !== '---' ? summary : (latestJournal.locationLabel || latestJournal.location || '');
        })(),
        highlight: latestJournal.highlight || ''
    } : {};

    return {
        daily,
        aggregate: {
            total_entries: finals.length,
            avg_sleep: avgSleep != null ? Number(avgSleep.toFixed(2)) : null,
            avg_mood: avgMood != null ? Number(avgMood.toFixed(2)) : null,
            avg_satisfaction: avgSatisfaction != null ? Number(avgSatisfaction.toFixed(2)) : null,
            avg_sleep_mood: avgSleepMood != null ? Number(avgSleepMood.toFixed(2)) : null,
            avg_sleep_satisfaction: avgSleepSatisfaction != null ? Number(avgSleepSatisfaction.toFixed(2)) : null,
            top_locations: topLocations,
            top_foods: topFoods,
            top_domains: topDomains
        }
    };
}

function normalizeAiInsightPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return {
        daily: payload.daily_insight || payload.daily || '',
        aggregate: payload.aggregate_insight || payload.aggregate || '',
        signals: Array.isArray(payload.signals) ? payload.signals : []
    };
}

function getAggregateAnalysisProgress() {
    const totalFinal = (appState.entries || []).filter(isFinalEntry).length;
    const baseCountRaw = Number(appState.userProfile?.aiInsightBaseCount || 0);
    const baseCount = Math.min(totalFinal, Math.max(0, baseCountRaw));
    const pending = Math.max(0, totalFinal - baseCount);
    const remaining = AGGREGATE_ANALYSIS_INTERVAL - (pending % AGGREGATE_ANALYSIS_INTERVAL || 0);
    return { totalFinal, baseCount, pending, remaining };
}

async function requestAggregateInsightUpdate(latestEntry) {
    if (appState.aiInsightUpdating) return false;
    appState.aiInsightUpdating = true;
    if (appState.currentView === 'mypage') renderMyPage();
    try {
        const payload = buildAggregateInsightPayload(appState.entries || [], latestEntry);
        const result = await apiPost('/api/insight', payload);
        const normalized = normalizeAiInsightPayload(result) || {
            daily: '',
            aggregate: '',
            signals: []
        };
        const update = {
            aiInsight: normalized,
            aiInsightUpdatedAt: new Date().toISOString(),
            aiInsightBaseCount: payload.aggregate.total_entries
        };
        await saveUserProfile(update);
        return true;
    } catch (e) {
        showToast('AI分析に失敗しました', 'error');
        return false;
    } finally {
        appState.aiInsightUpdating = false;
        if (appState.currentView === 'mypage') renderMyPage();
    }
}

async function maybeRunAggregateInsight(latestEntry, shouldCount) {
    if (!shouldCount || !appState.user) return false;
    const progress = getAggregateAnalysisProgress();
    if (progress.pending < AGGREGATE_ANALYSIS_INTERVAL) return false;
    return requestAggregateInsightUpdate(latestEntry);
}

function renderRankList(items, unit) {
    if (!items.length) {
        return `<div class="rank-empty">データなし</div>`;
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
        showToast('??', 'error');
    } finally {
        appState.summaryUpdating = false;
        renderMyPage();
    }
}

function updateSummaryForCurrentPeriod() {
    const periodKey = 'all';
    const filtered = (appState.entries || []).filter(isFinalEntry);
    const stats = aggregateStats(filtered);
    if (!stats.totalCount) {
        appState.summaryText = '';
        appState.summaryPeriod = '';
        appState.summaryUpdatedAt = null;
        return Promise.resolve();
    }
    return requestSummaryUpdate(periodKey, '全期間', stats);
}

function renderMyPage() {
    if (!dom.mypageContainer) return;
    if (!appState.user) {
        dom.mypageContainer.innerHTML = `
            <div class="mypage-login-cta">
                <div class="stat-card login-card">
                    <h3>\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u30de\u30a4\u30da\u30fc\u30b8\u3092\u8868\u793a</h3>
                    <p class="login-note">\u30ed\u30b0\u30a4\u30f3\u3059\u308b\u3068\u96c6\u8a08\u3084\u5206\u6790\u304c\u8868\u793a\u3055\u308c\u307e\u3059\u3002</p>
                    <button id="mypage-login" class="btn-primary">\u30ed\u30b0\u30a4\u30f3</button>
                </div>
            </div>
        `;
        const loginBtn = dom.mypageContainer.querySelector('#mypage-login');
        if (loginBtn) loginBtn.addEventListener('click', () => googleLogin());
        return;
    }
    const periodKey = 'all';
    const filtered = (appState.entries || [])
        .filter(isFinalEntry)
        .sort((a, b) => getEntryDate(b) - getEntryDate(a));
    const stats = aggregateStats(filtered);
    const journalMetrics = aggregateJournalMetrics(filtered);
    const allFinalEntries = (appState.entries || []).filter(isFinalEntry);
    const levelStats = computeLevelStats(allFinalEntries);
    const insightProgress = getAggregateAnalysisProgress();
    const aiInsightStatus = appState.aiInsightUpdating
        ? '分析中...'
        : `次の分析まであと${insightProgress.remaining}回`;
    const profileName = getProfileDisplayName();
    const profileInitial = getProfileAvatarLetter(profileName);
    const profileAvatarUrl = getProfileAvatarUrl();
    const profileAvatar = getProfileAvatar(levelStats.level);
    const answerCount = levelStats.answerCount || 0;
    const profileLevelText = `Lv ${levelStats.level}`;
    const profileAvatarStyle = profileAvatarUrl ? `style="background-image:url('${encodeURI(profileAvatarUrl)}')"` : '';
    const profileAvatarClass = profileAvatarUrl ? 'has-image' : '';
    const profileAvatarMarkup = profileAvatar
        ? `<i class="fa-solid ${profileAvatar.icon}"></i>`
        : escapeHtml(profileInitial);
    const profileAvatarTitle = profileAvatar ? profileAvatar.label : 'デフォルト';
    const sleepAvgLabel = journalMetrics.sleepAvg != null
        ? `${journalMetrics.sleepAvg.toFixed(1)}時間`
        : 'データなし';
    const sleepSubLabel = journalMetrics.sleepCount
        ? `${journalMetrics.sleepCount}日分`
        : '記録なし';
    const weightDeltaLabel = journalMetrics.weightDelta != null
        ? `${journalMetrics.weightDelta >= 0 ? '+' : ''}${journalMetrics.weightDelta.toFixed(1)}kg`
        : 'データ不足';
    const weightSparkline = buildSparkline(journalMetrics.weightValues);
    const journalInsight = journalMetrics.insightText;

    const aiInsightTabs = [
        {
            id: 'journal',
            label: 'ジャーナル',
            text: '最近のジャーナルでは、日常の話題が複数に広がりつつも、満足度が高い日は睡眠が安定し、軽い運動や外出がある傾向が見られます。生活要素と気分の関係を意識すると、調子の良い日の再現性が高まりそうです。'
        },
        {
            id: 'work',
            label: '仕事',
            text: '仕事面では、課題を整理して進める場面で力を発揮しやすく、目的が明確だと集中しやすい傾向があります。一方で締切が近い時は気分の波が出やすいので、区切りを作ると安定しやすそうです。'
        },
        {
            id: 'love',
            label: '恋愛',
            text: '恋愛面では、相手との距離感を丁寧に調整しながら関係を育てる傾向があります。安心感がある環境だと素直に気持ちを伝えやすく、互いのペースを尊重できる関係と噛み合いやすいようです。'
        },
        {
            id: 'personal',
            label: 'パーソナル',
            text: '全体として慎重さと好奇心のバランスがあり、状況を見ながら最適解を探る傾向があります。気持ちに揺れがある時ほど、言語化することで落ち着きを取り戻しやすいタイプです。'
        }
    ];
    const activeAiTab = appState.aiInsightTab || 'journal';
    const activeAiText = (aiInsightTabs.find((item) => item.id === activeAiTab) || aiInsightTabs[0]).text;
    const sleepTrendPoints = buildRecentSleepBarData(filtered, 7);
    const weightTrendPoints = buildRecentMetricPoints(filtered, (journal) => toPositiveNumber(journal.weight), 7);
    const sleepTrendChart = buildSleepBarChart(sleepTrendPoints, 320, 170);
    const weightTrendChart = buildWeightLineChart(weightTrendPoints, 320, 170);
    const bucketList = getBucketList();
    const bucketProgress = computeBucketProgress(bucketList);
    const bucketPercent = Math.max(0, Math.min(100, Number(bucketProgress.percent) || 0));
    const minBucketItems = 30;
    const bucketFilled = bucketList.length >= minBucketItems
        ? bucketList
        : bucketList.concat(Array.from({ length: minBucketItems - bucketList.length }, () => ({
            text: '',
            done: false
        })));
    const bucketRows = bucketFilled.map((item) => `
        <div class="bucket-row${item.done ? ' bucket-done' : ''}">
            <input type="checkbox" ${item.done ? 'checked' : ''}>
            <input type="text" value="${escapeHtml(item.text)}" placeholder="やりたいことを入力">
        </div>
    `).join('');
    const screening = appState.screeningProfile || {};
    const adhdProfile = screening.adhd || {};
    const adhdStatus = adhdProfile.status || 'insufficient';
    const adhdProgress = adhdProfile.progress || {};
    const answeredCore = Number(adhdProgress.answeredCore) || 0;
    const totalCore = Number(adhdProgress.totalCore) || 0;
    const adhdScores = adhdProfile.scores || {};
    const normalizedScore = Number.isFinite(Number(adhdScores.normalized0to100))
        ? Math.round(Number(adhdScores.normalized0to100))
        : 0;
    const adhdRiskBand = getRiskBandFromScore(normalizedScore);
    const adhdRiskLabel = adhdStatus === 'ready' ? adhdRiskBand.label : '判定保留';
    const adhdUpdatedLabel = screening.updatedAt ? formatDateTime(screening.updatedAt) : '未更新';
    const personalityProfile = screening.personality || {};
    const personalityStatus = personalityProfile.status || 'insufficient';
    const personalityTraits = personalityProfile.traits || {};
    const personalityEvidence = personalityProfile.evidenceCounts || {};
    const persona5Profile = screening.persona5 || {};
    const persona5Layers = { ...(persona5Profile.layers || {}) };
    PERSONA_LAYER_ORDER.forEach((layerKey) => {
        const mergedLayer = getPersonaLayerProfileForUi(layerKey);
        if (mergedLayer && Object.keys(mergedLayer).length) {
            persona5Layers[layerKey] = mergedLayer;
        }
    });
    const adhdConfidence = Number.isFinite(Number(adhdProfile.confidence0to1))
        ? Math.round(Math.max(0, Math.min(1, Number(adhdProfile.confidence0to1))) * 100)
        : 0;
    const screeningNotices = [
        'この結果は医療診断ではありません',
        '気になる症状が続く場合は専門機関に相談してください',
        '回答数が不足している場合は判定精度が低下します'
    ];
    if (String(screening.notice || '').trim()) {
        screeningNotices.push(String(screening.notice).trim());
    }
    const traitRows = PERSONALITY_TRAIT_KEYS.map((key) => {
        const valueRaw = Number(personalityTraits[key]);
        const value = Number.isFinite(valueRaw) ? Math.max(0, Math.min(100, Math.round(valueRaw))) : 0;
        return `
            <div class="personality-trait-row">
                <span class="personality-trait-label">${escapeHtml(PERSONALITY_TRAIT_LABELS[key] || key)}</span>
                <div class="personality-trait-track">
                    <span class="personality-trait-fill" style="width:${value}%"></span>
                </div>
                <span class="personality-trait-value">${value}</span>
            </div>
        `;
    }).join('');
    const isPersonaLayerReadyForCard = (layerInfo) => {
        const progress = layerInfo?.progress || {};
        const answeredCore = Number(progress.answeredCore) || 0;
        const totalCore = Number(progress.totalCore) || 0;
        const hasAxis = Array.isArray(layerInfo?.axisTable) && layerInfo.axisTable.length > 0;
        return hasAxis && totalCore > 0 && answeredCore >= totalCore && layerInfo?.status === 'ready';
    };
    const personaLayerCards = PERSONA_LAYER_ORDER.map((layerKey) => {
        const layerInfo = persona5Layers[layerKey] || {};
        const layerLabel = getPersonaLayerLabel(layerKey) || layerInfo.layerLabel || layerKey;
        const progress = layerInfo.progress || {};
        const answeredCore = Number(progress.answeredCore) || 0;
        const totalCore = Number(progress.totalCore) || 0;
        const isReady = isPersonaLayerReadyForCard(layerInfo);
        const chartMarkup = isReady
            ? buildPersonaLayerRadarChart(layerInfo.axisTable, { width: 250, height: 200 })
            : '<div class="mypage-persona-radar-empty">回答完了で表示</div>';
        return `
            <button type="button" class="mypage-persona-card persona-layer-btn" data-layer-key="${escapeHtml(layerKey)}">
                <div class="mypage-persona-card-head">
                    <span class="mypage-persona-card-title">${escapeHtml(layerLabel)}</span>
                    <span class="mypage-persona-card-status ${isReady ? 'is-ready' : 'is-pending'}">${isReady ? '完了' : '未完了'}</span>
                </div>
                <div class="mypage-persona-radar-wrap">${chartMarkup}</div>
                <div class="mypage-persona-card-foot">回答 ${answeredCore}/${totalCore || 0}</div>
            </button>
        `;
    }).join('');
    const personaLayerAllCompleted = PERSONA_LAYER_ORDER.every((layerKey) => isPersonaLayerReadyForCard(persona5Layers[layerKey] || {}));
    const personaOverallHighlights = personaLayerAllCompleted
        ? PERSONA_LAYER_ORDER.map((layerKey) => {
            const layerInfo = persona5Layers[layerKey] || {};
            const layerLabel = getPersonaLayerLabel(layerKey) || layerInfo.layerLabel || layerKey;
            const topAxis = (Array.isArray(layerInfo.axisTable) ? layerInfo.axisTable : [])
                .map((row) => ({
                    ...getPersonaRadarAxisData(row),
                    value: clampPercent(row?.dominantPercent)
                }))
                .sort((a, b) => b.value - a.value)[0];
            return {
                layerLabel,
                axisLabel: topAxis?.label || '軸',
                percent: Math.round(topAxis?.value || 0)
            };
        })
        : [];
    const personaOverallTop = personaOverallHighlights
        .slice()
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 3);
    const personaOverallCard = personaLayerAllCompleted
        ? `
            <div class="mypage-persona-card mypage-persona-summary-card">
                <div class="mypage-persona-card-head">
                    <span class="mypage-persona-card-title">5レイヤー総括</span>
                    <span class="mypage-persona-card-status is-ready">完成</span>
                </div>
                <div class="mypage-persona-summary-body">
                    <div class="mypage-persona-summary-lead">強く出ている傾向（上位3）</div>
                    <ul class="mypage-persona-summary-list">
                        ${personaOverallTop.map((item) => `
                            <li>
                                <span class="layer">${escapeHtml(item.layerLabel)}</span>
                                <span class="axis">${escapeHtml(item.axisLabel)}</span>
                                <strong>${item.percent}%</strong>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="mypage-persona-card-foot">5レイヤーの回答データから生成</div>
            </div>
        `
        : `
            <div class="mypage-persona-card mypage-persona-summary-card is-locked">
                <div class="mypage-persona-card-head">
                    <span class="mypage-persona-card-title">5レイヤー総括</span>
                    <span class="mypage-persona-card-status is-pending">準備中</span>
                </div>
                <div class="mypage-persona-radar-empty">5レイヤーすべて完了で表示</div>
                <div class="mypage-persona-card-foot">未完了のレイヤーがあります</div>
            </div>
        `;
    const rightTab = appState.mypageRightTab === 'life' ? 'life' : 'layer';
    const rightLayerPanel = `
        <div class="mypage-right-panel-stack">
            <div class="stat-card radar-card">
                <button id="btn-matrix-expand" class="icon-btn matrix-expand-btn" aria-label="拡大">⤢</button>
                <div id="context-trait-matrix" class="matrix-plot"></div>
            </div>
            <div class="stat-card screening-card persona5-card persona5-card-right">
                <div class="screening-header">
                    <h3>5レイヤースコア</h3>
                </div>
                <div class="mypage-persona-grid">
                    ${personaLayerCards}
                    ${personaOverallCard}
                </div>
            </div>
        </div>
    `;
    const rightLifePanel = `
        <div class="mypage-right-grid mypage-right-grid-life">
            <div class="stat-card bucket-card">
                <div class="bucket-header">
                    <h4>夢リスト</h4>
                    <button id="btn-bucket-edit" class="icon-btn" aria-label="編集">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
                <div class="bucket-progress-ring" style="--progress:${bucketPercent};">
                    <span class="bucket-progress-value">${bucketPercent}%</span>
                </div>
                <div class="stat-sub">達成 ${bucketProgress.done}/${bucketProgress.total || 0}</div>
            </div>
            <div class="stat-card trend-card sleep-trend-card">
                <h4>過去7日間の睡眠推移</h4>
                <div class="sparkline-wrap">${sleepTrendChart}</div>
            </div>
            <div class="stat-card trend-card weight-trend-card">
                <h4>過去7日間の体重推移</h4>
                <div class="sparkline-wrap">${weightTrendChart}</div>
            </div>
        </div>
    `;

    dom.mypageContainer.innerHTML = `
        <div class="mypage-layout">
            <div class="mypage-col mypage-left">
                <div class="stat-card profile-card">
                    <div class="profile-avatar ${profileAvatarClass}" ${profileAvatarStyle} aria-label="\u30a2\u30a4\u30b3\u30f3" title="${escapeHtml(profileAvatarTitle)}">
                        <span class="profile-avatar-letter">${profileAvatarMarkup}</span>
                    </div>
                    <div class="profile-info">
                        <div class="profile-level">${escapeHtml(profileLevelText)}</div>
                        <div class="profile-name">${escapeHtml(profileName)}</div>
                    </div>
                </div>
                <div class="stat-card stats-summary stats-summary-wide">
                    <div class="summary-grid">
                        <div class="summary-labels">
                            <span>投稿総数</span>
                            <span>連続投稿</span>
                            <span>最長連続</span>
                            <span>お題回答数</span>
                        </div>
                        <div class="summary-values">
                            <span>${stats.totalCount}</span>
                            <span>${stats.streak}日</span>
                            <span>${stats.longestStreak}日</span>
                            <span>${answerCount}</span>
                        </div>
                    </div>
                    <div class="summary-divider"></div>
                    <div class="summary-total">投稿の総文字数 ${stats.totalChars.toLocaleString('ja-JP')}文字</div>
                </div>
                <div class="stat-card ai-personal-card">
                    <div class="ai-insight-header">
                        <h3>AI分析</h3>
                        <span class="ai-insight-status">${escapeHtml(aiInsightStatus)}</span>
                    </div>
                    <div class="ai-tabs">
                        ${aiInsightTabs.map((tab) => `
                            <button class="ai-tab-btn ${tab.id === activeAiTab ? 'active' : ''}" data-tab="${tab.id}">
                                ${tab.label}
                            </button>
                        `).join('')}
                    </div>
                    <p class="analysis-text ai-tab-text">${escapeHtml(activeAiText)}</p>
                </div>
                <div class="stat-card screening-card adhd-screening-card">
                    <div class="screening-header">
                        <h3>ADHD自己スクリーニング</h3>
                        <span class="screening-updated">${escapeHtml(adhdUpdatedLabel)}</span>
                    </div>
                    <div class="screening-progress-row">
                        <span>コア回答 ${answeredCore}/${totalCore || '-'}</span>
                        <span class="screening-risk-band screening-risk-${adhdRiskBand.key}">${escapeHtml(adhdRiskLabel)}</span>
                    </div>
                    ${appState.screeningLoading ? '<div class="screening-loading">再計算中...</div>' : ''}
                    ${appState.screeningError ? `<div class="screening-error">${escapeHtml(appState.screeningError)}</div>` : ''}
                    ${adhdStatus === 'ready'
            ? `<div class="screening-score-grid">
                                <div class="screening-score-item"><span>総合</span><strong>${normalizedScore}</strong></div>
                                <div class="screening-score-item"><span>不注意</span><strong>${Math.round(Number(adhdScores.inattention) || 0)}</strong></div>
                                <div class="screening-score-item"><span>多動・衝動性</span><strong>${Math.round(Number(adhdScores.hyperactivity) || 0)}</strong></div>
                                <div class="screening-score-item"><span>信頼度</span><strong>${adhdConfidence}%</strong></div>
                            </div>`
            : '<div class="screening-insufficient">回答数が不足しています。5件法のコア質問に回答してください。</div>'}
                    <ul class="screening-notice-list">
                        ${screeningNotices.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
                    </ul>
                </div>
                <div class="stat-card screening-card personality-card">
                    <div class="screening-header">
                        <h3>性格プロファイル</h3>
                        <span class="screening-updated">${personalityStatus === 'ready' ? '推定値' : 'データ不足'}</span>
                    </div>
                    ${personalityStatus === 'ready'
            ? `<div class="personality-trait-list">${traitRows}</div>`
            : '<div class="screening-insufficient">日記と回答データが十分に集まると表示されます。</div>'}
                    <div class="screening-evidence">日記 ${Number(personalityEvidence.diaryCount) || 0}件 / 回答 ${Number(personalityEvidence.answerCount) || 0}件</div>
                </div>
            </div>
            <div class="mypage-col mypage-right">
                <div class="mypage-right-tabs">
                    <button type="button" class="mypage-right-tab-btn ${rightTab === 'layer' ? 'active' : ''}" data-right-tab="layer">5レイヤースコア</button>
                    <button type="button" class="mypage-right-tab-btn ${rightTab === 'life' ? 'active' : ''}" data-right-tab="life">夢リスト・推移グラフ</button>
                </div>
                <div class="mypage-right-panel">
                    ${rightTab === 'layer' ? rightLayerPanel : rightLifePanel}
                </div>
            </div>
        </div>
        <div id="bucket-modal" class="modal hidden">
            <div class="modal-content bucket-modal">
                <div class="modal-header">
                    <h3>夢リスト</h3>
                    <button id="btn-bucket-close" class="btn-text bucket-close" aria-label="閉じる">×</button>
                </div>
                <div class="bucket-list" id="bucket-list">
                    ${bucketRows}
                </div>
                <div class="modal-actions">
                    <button id="btn-bucket-add" class="btn-text">追加</button>
                    <button id="btn-bucket-save" class="btn-primary">保存</button>
                </div>
            </div>
        </div>
        <div id="modal-matrix" class="modal hidden">
            <div class="modal-content matrix-modal">
                <button id="btn-matrix-help" class="icon-btn matrix-help-btn" aria-label="ヘルプ">?</button>
                <button id="btn-matrix-close" class="btn-text matrix-close" aria-label="close">×</button>
                <div id="matrix-help-popover" class="matrix-help-popover">
                    <div class="matrix-help-title">行動選択マトリクスの見かた</div>
                    <div class="matrix-help-item"><strong>対人距離</strong>：人との距離感。外交的/内向的のどちらに寄りやすいかの方向性。</div>
                    <div class="matrix-help-item"><strong>情報開示</strong>：自分の情報を開く/控える選びやすさ。</div>
                    <div class="matrix-help-item"><strong>判断基準</strong>：論理/感情のどちらを軸に置きやすいか。</div>
                    <div class="matrix-help-item"><strong>思考粒度</strong>：抽象/具体のどちらで捉えやすいか。</div>
                    <div class="matrix-help-item"><strong>行動設計</strong>：計画的/即興的のどちらで進めやすいか。</div>
                    <div class="matrix-help-item"><strong>行動開始</strong>：即行動/慎重開始のどちらを選びやすいか。</div>
                    <div class="matrix-help-item"><strong>主体性</strong>：主導的/追従的のどちらに寄りやすいか。</div>
                    <div class="matrix-help-item"><strong>摩擦スタンス</strong>：調和志向/対立許容のどちらを選びやすいか。</div>
                    <div class="matrix-help-note">良し悪しではなく、選択の方向性の傾向を示します。</div>
                </div>
                <div class="matrix-modal-body">
                    <div id="context-trait-matrix-full" class="matrix-plot"></div>
                </div>
            </div>
        </div>
        <div id="modal-persona-layer-detail" class="modal hidden">
            <div class="modal-content persona-layer-modal">
                <div class="modal-header persona-layer-modal-header">
                    <h3 id="persona-layer-modal-title">5レイヤー解説</h3>
                    <button id="btn-persona-layer-close" class="btn-text persona-layer-modal-close" aria-label="close">×</button>
                </div>
                <div id="persona-layer-modal-body" class="persona-layer-modal-body"></div>
            </div>
        </div>
    `;

    dom.mypageContainer.querySelectorAll('.ai-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            appState.aiInsightTab = btn.dataset.tab || 'journal';
            renderMyPage();
        });
    });
    dom.mypageContainer.querySelectorAll('.mypage-right-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextTab = btn.dataset.rightTab === 'life' ? 'life' : 'layer';
            if (appState.mypageRightTab === nextTab) return;
            appState.mypageRightTab = nextTab;
            renderMyPage();
        });
    });

    const bucketModal = dom.mypageContainer.querySelector('#bucket-modal');
    const bucketEditBtn = dom.mypageContainer.querySelector('#btn-bucket-edit');
    const bucketCloseBtn = dom.mypageContainer.querySelector('#btn-bucket-close');
    const bucketAddBtn = dom.mypageContainer.querySelector('#btn-bucket-add');
    const bucketSaveBtn = dom.mypageContainer.querySelector('#btn-bucket-save');
    const bucketListEl = dom.mypageContainer.querySelector('#bucket-list');

    const openBucketModal = () => {
        if (!bucketModal) return;
        bucketModal.classList.remove('hidden');
        bucketModal.classList.add('active');
        bucketModal.style.display = 'flex';
        bucketModal.style.opacity = '1';
        bucketModal.style.visibility = 'visible';
        bucketModal.style.zIndex = '2000';
    };

    const closeBucketModal = () => {
        if (!bucketModal) return;
        bucketModal.classList.add('hidden');
        bucketModal.classList.remove('active');
        bucketModal.removeAttribute('style');
    };

    if (bucketEditBtn) bucketEditBtn.addEventListener('click', openBucketModal);
    if (bucketCloseBtn) bucketCloseBtn.addEventListener('click', closeBucketModal);
    if (bucketModal) {
        bucketModal.addEventListener('click', (event) => {
            if (event.target === bucketModal) closeBucketModal();
        });
    }
    if (bucketAddBtn && bucketListEl) {
        bucketAddBtn.addEventListener('click', () => {
            const rows = [];
            for (let i = 0; i < 3; i += 1) {
                const row = document.createElement('div');
                row.className = 'bucket-row';
                row.innerHTML = `
                    <input type="checkbox">
                    <input type="text" placeholder="やりたいことを入力">
                `;
                rows.push(row);
                bucketListEl.appendChild(row);
            }
            const input = rows[0]?.querySelector('input[type="text"]');
            if (input) input.focus();
        });
    }
    if (bucketListEl) {
        bucketListEl.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            if (target.type !== 'checkbox') return;
            const row = target.closest('.bucket-row');
            if (!row) return;
            row.classList.toggle('bucket-done', target.checked);
        });
    }
    if (bucketSaveBtn && bucketListEl) {
        bucketSaveBtn.addEventListener('click', async () => {
            const rows = Array.from(bucketListEl.querySelectorAll('.bucket-row'));
            const nextList = rows.map((row) => {
                const checkbox = row.querySelector('input[type="checkbox"]');
                const input = row.querySelector('input[type="text"]');
                return {
                    text: String(input ? input.value : '').trim(),
                    done: !!(checkbox && checkbox.checked)
                };
            }).filter((item) => item.text);
            await saveUserProfile({ bucketList: nextList });
            closeBucketModal();
            renderMyPage();
        });
    }

    const matrixPlot = dom.mypageContainer.querySelector('#context-trait-matrix');
    const matrixExpandBtn = dom.mypageContainer.querySelector('#btn-matrix-expand');
    const matrixModal = dom.mypageContainer.querySelector('#modal-matrix');
    const matrixModalClose = dom.mypageContainer.querySelector('#btn-matrix-close');
    const matrixModalPlot = dom.mypageContainer.querySelector('#context-trait-matrix-full');
    const matrixHelpBtn = dom.mypageContainer.querySelector('#btn-matrix-help');
    const matrixHelpPopover = dom.mypageContainer.querySelector('#matrix-help-popover');
    if (matrixPlot) {
        renderContextTraitMatrixPlot(matrixPlot, appState.userProfile?.contextTraitEvents || [], (event) => {
            appState.selectedMatrixEvent = event;
        });
    }
    const openMatrixModal = () => {
        if (!matrixModal) return;
        matrixModal.classList.remove('hidden');
        matrixModal.classList.add('active');
        matrixModal.style.display = 'flex';
        matrixModal.style.opacity = '1';
        matrixModal.style.visibility = 'visible';
        matrixModal.style.zIndex = '2000';
        requestAnimationFrame(() => {
            if (!matrixModalPlot) return;
            renderContextTraitMatrixPlot(
                matrixModalPlot,
                appState.userProfile?.contextTraitEvents || [],
                (event) => {
                    appState.selectedMatrixEvent = event;
                },
                {
                    isExpanded: true,
                    pointRadius: 4,
                    pointOpacity: 0.45,
                    height: matrixModalPlot.clientHeight || 520
                }
            );
        });
    };
    const closeMatrixModal = () => {
        if (!matrixModal) return;
        matrixModal.classList.add('hidden');
        matrixModal.classList.remove('active');
        matrixModal.removeAttribute('style');
        if (matrixHelpPopover) matrixHelpPopover.classList.remove('active');
    };
    if (matrixExpandBtn) matrixExpandBtn.addEventListener('click', openMatrixModal);
    if (matrixModalClose) matrixModalClose.addEventListener('click', closeMatrixModal);
    if (matrixHelpBtn && matrixHelpPopover) {
        matrixHelpBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            matrixHelpPopover.classList.toggle('active');
        });
    }
    if (matrixModal) {
        matrixModal.addEventListener('click', (event) => {
            if (event.target === matrixModal) closeMatrixModal();
        });
    }

    const personaLayerModal = dom.mypageContainer.querySelector('#modal-persona-layer-detail');
    const personaLayerModalTitle = dom.mypageContainer.querySelector('#persona-layer-modal-title');
    const personaLayerModalBody = dom.mypageContainer.querySelector('#persona-layer-modal-body');
    const personaLayerCloseBtn = dom.mypageContainer.querySelector('#btn-persona-layer-close');
    const personaLayerButtons = dom.mypageContainer.querySelectorAll('.persona-layer-btn');

    const closePersonaLayerModal = () => {
        if (!personaLayerModal) return;
        personaLayerModal.classList.add('hidden');
        personaLayerModal.classList.remove('active');
    };

    const openPersonaLayerModal = (layerKey) => {
        const normalizedLayer = normalizePersonaLayer(layerKey);
        if (!normalizedLayer || !personaLayerModal || !personaLayerModalBody || !personaLayerModalTitle) return;
        const layerInfo = persona5Layers[normalizedLayer] || {};
        const layerLabel = getPersonaLayerLabel(normalizedLayer) || layerInfo.layerLabel || normalizedLayer;
        const axisTable = Array.isArray(layerInfo.axisTable) ? layerInfo.axisTable : [];
        const progress = layerInfo.progress || {};
        const answeredCoreCount = Number(progress.answeredCore) || 0;
        const answeredFromAxis = axisTable.reduce((sum, row) => sum + (Number(row?.answeredItems) || 0), 0);
        const hasAnyAnswer = answeredCoreCount > 0 || answeredFromAxis > 0;

        personaLayerModalTitle.textContent = `${layerLabel}の解説`;
        if (!hasAnyAnswer) {
            personaLayerModalBody.innerHTML = `
                <div class="persona-layer-empty-state" aria-live="polite">
                    <div class="persona-layer-empty-card">
                        <div class="persona-layer-empty-title">まだ診断していません</div>
                        <p class="persona-layer-empty-text">このレイヤーは未回答です。お題ページの5レイヤー診断で回答すると、詳細がここに表示されます。</p>
                    </div>
                </div>
            `;
            personaLayerModal.classList.remove('hidden');
            personaLayerModal.classList.add('active');
            return;
        }

        const axisRows = axisTable.length
            ? axisTable.map((row) => {
                const score = Math.max(0, Math.min(100, Number(row?.score) || 0));
                const reverseScore = Math.max(0, 100 - score);
                const axisMeta = getPersonaAxisDefinition(row?.axisKey || '');
                const leftLabel = String(row?.leftLabel || axisMeta?.left || '-');
                const rightLabel = String(row?.rightLabel || axisMeta?.right || '-');
                const dominantRight = score >= reverseScore;
                const dominantLabel = dominantRight ? rightLabel : leftLabel;
                const dominantPercent = Math.max(
                    0,
                    Math.min(
                        100,
                        Number(row?.dominantPercent) || (dominantRight ? score : reverseScore)
                    )
                );
                const markerPosition = Math.max(4, Math.min(96, score));
                const colorSeed = Math.abs(String(row?.axisKey || '').split('').reduce((n, ch) => n + ch.charCodeAt(0), 0));
                const axisColor = ['#2e9cc2', '#d7a436', '#17a980', '#8a63ad', '#de6a6a'][colorSeed % 5];
                const meaning = buildPersonaAxisMeaning(leftLabel, rightLabel, dominantLabel, dominantPercent);
                return `
                    <div class="persona-axis-row"
                        style="--axis-color:${axisColor}"
                        tabindex="0"
                        data-axis-id="${escapeHtml(String(row?.axisKey || ''))}"
                        data-axis-display="${escapeHtml(`${leftLabel} ⇄ ${rightLabel}`)}"
                        data-axis-left="${escapeHtml(leftLabel)}"
                        data-axis-right="${escapeHtml(rightLabel)}"
                        data-axis-score="${Math.round(score)}"
                        data-axis-dominant-label="${escapeHtml(dominantLabel)}"
                        data-axis-dominant-percent="${Math.round(dominantPercent)}"
                        data-axis-meaning="${escapeHtml(meaning)}">
                        <div class="persona-axis-head">
                            <span class="persona-axis-summary">${Math.round(score)}%</span>
                        </div>
                        <div class="persona-axis-track">
                            <span class="persona-axis-point-label" style="left:${markerPosition}%">${Math.round(score)}% <span>${escapeHtml(dominantLabel)}</span></span>
                            <span class="persona-axis-point" style="left:${markerPosition}%" aria-hidden="true"></span>
                        </div>
                        <div class="persona-axis-ends">
                            <span>${escapeHtml(leftLabel)}</span>
                            <span>${escapeHtml(rightLabel)}</span>
                        </div>
                    </div>
                `;
            }).join('')
            : '';
        const analysis = (layerInfo.status === 'ready' && layerInfo.analysis && typeof layerInfo.analysis === 'object')
            ? layerInfo.analysis
            : null;
        const toList = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) {
                return value
                    .map((item) => String(item || '').trim())
                    .filter(Boolean);
            }
            return String(value)
                .split('\n')
                .map((item) => item.replace(/^[-*・\s]+/, '').trim())
                .filter(Boolean);
        };
        const renderList = (list) => {
            const rows = toList(list);
            if (!rows.length) return '<p class="persona-layer-detail-note">-</p>';
            return `<ul class="persona-analysis-list">${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
        };
        const analysisRows = analysis
            ? (() => {
                const title = String(analysis.title || '').trim() || `${layerLabel}の傾向レポート`;
                const overview = String(analysis.overview || analysis.summary || '').trim();
                const keyTraits = analysis.keyTraits || analysis.upperAxes;
                const hiddenSides = analysis.hiddenSides || analysis.lowerAxes;
                const gapInsight = String(analysis.gapInsight || analysis.gapRead || '').trim();
                const strengths = analysis.strengths;
                const cautions = analysis.cautions || analysis.pitfalls;
                const actionHints = analysis.actionHints || analysis.improvements;
                const notice = String(analysis.notice || analysis.disclaimer || '').trim();
                return `
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">タイトル</div>
                        <p class="persona-layer-detail-note">${escapeHtml(title)}</p>
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">概要</div>
                        <p class="persona-layer-detail-note">${escapeHtml(overview || '-')}</p>
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">主な特徴</div>
                        ${renderList(keyTraits)}
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">裏の顔/補足</div>
                        ${renderList(hiddenSides)}
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">バランス/ギャップの読み</div>
                        <p class="persona-layer-detail-note">${escapeHtml(gapInsight || '-')}</p>
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">強み</div>
                        ${renderList(strengths)}
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">気をつけたい点</div>
                        ${renderList(cautions)}
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">今日から使えるヒント</div>
                        ${renderList(actionHints)}
                    </div>
                    <div class="persona-analysis-row">
                        <div class="persona-layer-detail-section-title">注意書き（診断ではない）</div>
                        <p class="persona-layer-detail-note">${escapeHtml(notice || '-')}</p>
                    </div>
                `;
            })()
            : `<div class="screening-insufficient">このレイヤーのAI分析は、回答完了後に表示されます。</div>`;

        personaLayerModalBody.innerHTML = `
            <div class="persona-layer-detail-single">
                <div class="persona-axis-inspector">
                    <div class="persona-axis-inspector-list">
                        ${axisRows || '<div class="screening-insufficient">このレイヤーの軸データがありません。</div>'}
                    </div>
                    <aside class="persona-axis-inspector-panel">
                        <div class="persona-axis-inspector-panel-title" id="persona-axis-inspector-title">軸の解説</div>
                        <div class="persona-axis-inspector-panel-score" id="persona-axis-inspector-score">-</div>
                        <p class="persona-axis-inspector-panel-desc" id="persona-axis-inspector-desc">軸にカーソルを合わせると解説が表示されます。</p>
                    </aside>
                </div>
                <div class="persona-ai-analysis-block">
                    <div class="persona-layer-detail-section-title">AI分析</div>
                    <div class="persona-layer-detail-scores">
                        ${analysisRows}
                    </div>
                </div>
            </div>
        `;

        const inspectorRows = Array.from(personaLayerModalBody.querySelectorAll('.persona-axis-row[data-axis-id]'));
        const inspectorTitle = personaLayerModalBody.querySelector('#persona-axis-inspector-title');
        const inspectorScore = personaLayerModalBody.querySelector('#persona-axis-inspector-score');
        const inspectorDesc = personaLayerModalBody.querySelector('#persona-axis-inspector-desc');
        const setInspectorAxis = (rowEl) => {
            if (!rowEl || !inspectorTitle || !inspectorScore || !inspectorDesc) return;
            inspectorRows.forEach((item) => item.classList.toggle('active', item === rowEl));
            const display = rowEl.dataset.axisDisplay || '軸';
            const score = Number(rowEl.dataset.axisScore || 0);
            const dominant = rowEl.dataset.axisDominantLabel || '';
            const dominantPercent = Number(rowEl.dataset.axisDominantPercent || 0);
            inspectorTitle.textContent = display;
            inspectorScore.textContent = `${Math.round(score)}% ${dominant}（寄り ${Math.round(dominantPercent)}%）`;
            inspectorDesc.textContent = rowEl.dataset.axisMeaning || '';
        };
        inspectorRows.forEach((rowEl) => {
            const trackEl = rowEl.querySelector('.persona-axis-track');
            rowEl.addEventListener('focus', () => setInspectorAxis(rowEl));
            rowEl.addEventListener('click', () => setInspectorAxis(rowEl));
            if (trackEl) {
                trackEl.addEventListener('mouseenter', () => setInspectorAxis(rowEl));
                trackEl.addEventListener('mousemove', () => setInspectorAxis(rowEl));
            } else {
                rowEl.addEventListener('mouseenter', () => setInspectorAxis(rowEl));
            }
        });
        if (inspectorRows[0]) {
            setInspectorAxis(inspectorRows[0]);
        }

        personaLayerModal.classList.remove('hidden');
        personaLayerModal.classList.add('active');
    };

    personaLayerButtons.forEach((button) => {
        button.addEventListener('click', () => {
            openPersonaLayerModal(button.dataset.layerKey || '');
        });
    });
    if (personaLayerCloseBtn) {
        personaLayerCloseBtn.addEventListener('click', closePersonaLayerModal);
    }
    if (personaLayerModal) {
        personaLayerModal.addEventListener('click', (event) => {
            if (event.target === personaLayerModal) closePersonaLayerModal();
        });
    }
}

function renderSettingsPage() {
    if (!dom.settingsContainer) return;
    if (!appState.user) {
        dom.settingsContainer.innerHTML = `
            <div class="mypage-login-cta">
                <div class="stat-card login-card">
                    <h3>ログインして設定を表示</h3>
                    <p class="login-note">ログインするとアカウント設定が利用できます。</p>
                    <button id="settings-login" class="btn-primary">ログイン</button>
                </div>
            </div>
        `;
        const loginBtn = dom.settingsContainer.querySelector('#settings-login');
        if (loginBtn) loginBtn.addEventListener('click', () => googleLogin());
        return;
    }

    const tab = appState.settingsTab || 'account';
    const profileName = getProfileDisplayName();
    const email = String(appState.user?.email || '').trim();
    const languageValue = appState.language || 'ja';
    const profileInitial = getProfileAvatarLetter(profileName);
    const profileAvatarUrl = getProfileAvatarUrl();
    const profileAvatarStyle = profileAvatarUrl ? `style="background-image:url('${encodeURI(profileAvatarUrl)}')"` : '';
    const profileAvatarClass = profileAvatarUrl ? 'has-image' : '';
    const isEditingName = Boolean(appState.settingsEditingName);
    const isEditingAvatar = Boolean(appState.settingsEditingAvatar);
    const hasAppPassword = Boolean(appState.userProfile?.appPasswordHash);

    const tabs = [
        { id: 'account', label: 'アカウント' },
        { id: 'security', label: 'セキュリティ' },
        { id: 'appearance', label: '外観' },
        { id: 'language', label: '言語' },
        { id: 'friends', label: '友だち' },
        { id: 'analysis', label: '分析' }
    ];

    const renderTabContent = () => {
        if (tab === 'account') {
            const friendId = appState.userProfile?.friend_id || appState.userProfile?.friendId || '';
            const friendIdStatus = appState.friendIdStatus || 'idle';
            const friendIdMessage = appState.friendIdError || '';
            return `
                <div class="settings-panel-inner">
                    <h2 class="settings-title">アカウント</h2>
                    <div class="settings-section-title">プロフィール</div>
                    <div class="settings-row">
                        <div class="settings-label">プロフィール画像</div>
                        <div class="settings-value">
                            <div class="settings-avatar ${profileAvatarClass}" ${profileAvatarStyle}>
                                ${profileAvatarUrl ? '' : escapeHtml(profileInitial)}
                            </div>
                            <button id="settings-avatar-edit" class="settings-link" type="button">編集する</button>
                        </div>
                    </div>
                    <div class="settings-row settings-row-editor ${isEditingAvatar ? '' : 'hidden'}">
                        <div class="settings-label">変更</div>
                        <div class="settings-value">
                            <input id="settings-avatar-url" type="text" value="${escapeHtml(profileAvatarUrl)}" placeholder="画像URLを入力">
                            <button id="settings-save-avatar" class="btn-primary">保存</button>
                            <button id="settings-cancel-avatar" class="btn-text" type="button">キャンセル</button>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">表示名</div>
                        <div class="settings-value">
                            <span class="settings-value-text">${escapeHtml(profileName)}</span>
                            <button id="settings-name-edit" class="settings-link" type="button">編集する</button>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">友だちID</div>
                        <div class="settings-value">
                            <span class="settings-value-text">${friendId ? escapeHtml(friendId) : (friendIdStatus === 'failed' ? escapeHtml(friendIdMessage || '生成できませんでした') : '生成中')}</span>
                            ${friendId
                    ? '<button id="settings-copy-friend-id" class="settings-link" type="button">コピー</button>'
                    : '<button id="settings-generate-friend-id" class="settings-link" type="button">再試行</button>'}
                        </div>
                    </div>
                    <div class="settings-row settings-row-editor ${isEditingName ? '' : 'hidden'}">
                        <div class="settings-label">変更</div>
                        <div class="settings-value">
                            <input id="settings-display-name" type="text" value="${escapeHtml(profileName)}" maxlength="20">
                            <button id="settings-save-name" class="btn-primary">保存</button>
                            <button id="settings-cancel-name" class="btn-text" type="button">キャンセル</button>
                        </div>
                    </div>
                    <div class="settings-section-title">メール</div>
                    <div class="settings-row">
                        <div class="settings-label">メール</div>
                        <div class="settings-value">
                            <span class="settings-value-text">${escapeHtml(email || '未設定')}</span>
                            <span class="settings-muted">準備中</span>
                        </div>
                    </div>
                    <div class="settings-section-title">ログアウト</div>
                    <div class="settings-row settings-row-danger" id="settings-logout">
                        <div class="settings-label">ログアウト</div>
                        <div class="settings-value">
                            <span class="settings-danger-text">ログアウト</span>
                        </div>
                    </div>
                </div>
            `;
        }
        if (tab === 'security') {
            return `
                <div class="settings-panel-inner">
                    <h2 class="settings-title">セキュリティ</h2>
                    <div class="settings-row">
                        <div class="settings-label">アプリ内パスワード</div>
                        <div class="settings-value">
                            <button id="settings-app-pass" class="settings-link" type="button">${hasAppPassword ? '変更する' : '設定する'}</button>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="settings-label">パスワード変更</div>
                        <div class="settings-value">
                            <span class="settings-muted">準備中</span>
                        </div>
                    </div>
                </div>
            `;
        }
        if (tab === 'appearance') {
            const wallpaperUrl = String(appState.userProfile?.wallpaperUrl || '').trim();
            return `
                <div class="settings-panel-inner">
                    <h2 class="settings-title">外観</h2>
                    <div class="settings-row settings-row-theme">
                        <div class="settings-value">
                            <div id="theme-picker" class="theme-picker"></div>
                        </div>
                    </div>
                    <div class="settings-row settings-row-wallpaper">
                        <div class="settings-label">壁紙</div>
                        <div class="settings-value">
                            <div class="wallpaper-controls">
                                <input id="settings-wallpaper-input" type="file" accept="image/webp" class="hidden">
                                <button id="settings-wallpaper-upload" class="btn-secondary" type="button">アップロード</button>
                                <button id="settings-wallpaper-remove" class="btn-text-sm" type="button">削除</button>
                                <span class="settings-muted">WebP / 1MBまで</span>
                            </div>
                            <div id="settings-wallpaper-preview" class="wallpaper-preview ${wallpaperUrl ? '' : 'hidden'}"
                                style="${wallpaperUrl ? `background-image: url('${wallpaperUrl}');` : ''}"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        if (tab === 'language') {
            return `
                <div class="settings-panel-inner">
                    <h2 class="settings-title">言語</h2>
                    <div class="settings-row">
                        <div class="settings-label">表示言語</div>
                        <div class="settings-value">
                            <select id="settings-language" class="filter-input">
                                <option value="ja">日本語</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }
        if (tab === 'friends') {
            return `
                <div class="settings-panel-inner settings-friends">
                    <h2 class="settings-title">友だち</h2>
                    <div class="settings-divider"></div>
                    <div class="settings-friends-body">
                        <div class="settings-friends-scroll">
                            <div class="settings-friends-search">
                                <div class="settings-search-input">
                                    <i class="fa-solid fa-magnifying-glass"></i>
                                    <input id="settings-friend-search" type="text" placeholder="友だちを検索">
                                </div>
                                <button id="btn-friend-add" class="icon-btn settings-friend-add" type="button" aria-label="友だちを追加">
                                    <i class="fa-solid fa-plus"></i>
                                </button>
                            </div>
                            <div id="settings-friends-list" class="settings-friends-list"></div>
                        </div>
                        <div class="settings-friends-tabs">
                            <button class="settings-friends-tab" data-friend-tab="friends">友だち</button>
                            <button class="settings-friends-tab" data-friend-tab="outgoing">申請中</button>
                            <button class="settings-friends-tab" data-friend-tab="incoming">承認</button>
                        </div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="settings-panel-inner">
                <h2 class="settings-title">分析</h2>
                <div class="settings-note-block">分析設定はマイページの自己スクリーニング結果に連動します。</div>
                <div class="settings-section-title">インポート（近日対応）</div>
                <div class="settings-note-block">会話ログやSNS投稿などを取り込める枠を今後追加予定です。</div>
            </div>
        `;
    };

    dom.settingsContainer.innerHTML = `
        <div class="settings-layout">
            <aside class="settings-nav">
                <div class="settings-nav-title">設定</div>
                ${tabs.map((item) => `
                    <button class="settings-nav-btn ${item.id === tab ? 'active' : ''}" data-tab="${item.id}">
                        ${item.label}
                    </button>
                `).join('')}
            </aside>
            <div class="settings-panel ${tab === 'friends' ? 'settings-panel-friends' : ''}">
                ${renderTabContent()}
            </div>
        </div>
    `;

    dom.settingsContainer.querySelectorAll('.settings-nav-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            appState.settingsTab = btn.dataset.tab || 'account';
            renderSettingsPage();
        });
    });

    const editAvatarBtn = dom.settingsContainer.querySelector('#settings-avatar-edit');
    if (editAvatarBtn) {
        editAvatarBtn.addEventListener('click', () => {
            appState.settingsEditingAvatar = true;
            renderSettingsPage();
        });
    }

    const cancelAvatarBtn = dom.settingsContainer.querySelector('#settings-cancel-avatar');
    if (cancelAvatarBtn) {
        cancelAvatarBtn.addEventListener('click', () => {
            appState.settingsEditingAvatar = false;
            renderSettingsPage();
        });
    }

    const avatarInput = dom.settingsContainer.querySelector('#settings-avatar-url');
    const saveAvatarBtn = dom.settingsContainer.querySelector('#settings-save-avatar');
    if (avatarInput && saveAvatarBtn) {
        saveAvatarBtn.addEventListener('click', async () => {
            const trimmed = String(avatarInput.value || '').trim();
            if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                showToast('画像URLを入力してください', 'error');
                return;
            }
            if (trimmed) {
                try {
                    new URL(trimmed);
                } catch (e) {
                    showToast('URL形式が正しくありません', 'error');
                    return;
                }
            }
            await saveUserProfile({ avatarUrl: trimmed });
            appState.settingsEditingAvatar = false;
            showToast('保存しました');
            renderSettingsPage();
            if (appState.currentView === 'mypage') renderMyPage();
        });
    }

    const editNameBtn = dom.settingsContainer.querySelector('#settings-name-edit');
    if (editNameBtn) {
        editNameBtn.addEventListener('click', () => {
            appState.settingsEditingName = true;
            renderSettingsPage();
        });
    }

    const cancelNameBtn = dom.settingsContainer.querySelector('#settings-cancel-name');
    if (cancelNameBtn) {
        cancelNameBtn.addEventListener('click', () => {
            appState.settingsEditingName = false;
            renderSettingsPage();
        });
    }

    const nameInput = dom.settingsContainer.querySelector('#settings-display-name');
    const saveNameBtn = dom.settingsContainer.querySelector('#settings-save-name');
    if (nameInput && saveNameBtn) {
        saveNameBtn.addEventListener('click', async () => {
            const trimmed = String(nameInput.value || '').trim().slice(0, 20);
            if (!trimmed) {
                showToast('名前を入力してください', 'error');
                return;
            }
            await saveUserProfile({ displayName: trimmed });
            appState.settingsEditingName = false;
            showToast('保存しました');
            renderSettingsPage();
            if (appState.currentView === 'mypage') renderMyPage();
        });
    }

    const appPassBtn = dom.settingsContainer.querySelector('#settings-app-pass');
    if (appPassBtn) {
        appPassBtn.addEventListener('click', () => {
            openAppPasswordModal();
        });
    }

    const logoutBtn = dom.settingsContainer.querySelector('#settings-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => handleLogout());

    const copyFriendIdBtn = dom.settingsContainer.querySelector('#settings-copy-friend-id');
    if (copyFriendIdBtn) {
        copyFriendIdBtn.addEventListener('click', async () => {
            const friendId = appState.userProfile?.friend_id || appState.userProfile?.friendId || '';
            if (!friendId) {
                showToast('IDを生成中です', 'error');
                return;
            }
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(friendId);
                } else {
                    const temp = document.createElement('textarea');
                    temp.value = friendId;
                    temp.style.position = 'fixed';
                    temp.style.opacity = '0';
                    document.body.appendChild(temp);
                    temp.focus();
                    temp.select();
                    document.execCommand('copy');
                    document.body.removeChild(temp);
                }
                showToast('コピーしました');
            } catch (e) {
                showToast('コピーに失敗しました', 'error');
            }
        });
    }

    const generateFriendIdBtn = dom.settingsContainer.querySelector('#settings-generate-friend-id');
    if (generateFriendIdBtn) {
        generateFriendIdBtn.addEventListener('click', async () => {
            appState.friendIdStatus = 'generating';
            appState.friendIdError = '';
            renderSettingsPage();
            await ensureFriendId();
            if (appState.friendIdStatus === 'ready') {
                showToast('友だちIDを生成しました');
            } else if (appState.friendIdStatus === 'failed') {
                showToast(appState.friendIdError || 'IDの生成に失敗しました', 'error');
            }
        });
    }

    if (tab === 'friends') {
        if (!appState.friendRequestsLoaded) {
            loadFriendRequests();
        }
        const friendSearchInput = dom.settingsContainer.querySelector('#settings-friend-search');
        if (friendSearchInput) {
            friendSearchInput.value = appState.settingsFriendSearch || '';
            friendSearchInput.addEventListener('input', () => {
                appState.settingsFriendSearch = friendSearchInput.value;
                renderSettingsFriendsList();
            });
        }
        const friendAddBtn = dom.settingsContainer.querySelector('#btn-friend-add');
        if (friendAddBtn) {
            friendAddBtn.addEventListener('click', () => openFriendIdModal());
        }
        dom.settingsContainer.querySelectorAll('[data-friend-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                appState.settingsFriendTab = btn.dataset.friendTab || 'friends';
                renderSettingsFriendsList();
            });
        });
        const friendList = dom.settingsContainer.querySelector('#settings-friends-list');
        if (friendList) {
            friendList.addEventListener('click', (event) => {
                const approveBtn = event.target.closest('[data-action="approve"]');
                if (!approveBtn) return;
                const row = approveBtn.closest('[data-friend-id]');
                if (!row) return;
                const requestId = row.dataset.requestId;
                if (requestId) {
                    approveFriendRequest(requestId);
                    return;
                }
                const friendId = row.dataset.friendId;
                if (!friendId) return;
                const state = getFriendState();
                const target = state.incoming.find((item) => item.id === friendId);
                if (!target) return;
                const nextState = {
                    friends: state.friends.some((item) => item.id === friendId)
                        ? state.friends
                        : [...state.friends, target],
                    outgoing: state.outgoing,
                    incoming: state.incoming.filter((item) => item.id !== friendId)
                };
                setFriendState(nextState, { persist: false });
                renderSettingsFriendsList();
            });
        }
        renderSettingsFriendsList();
    }

    const languageSelect = dom.settingsContainer.querySelector('#settings-language');
    if (languageSelect) {
        languageSelect.value = languageValue;
        languageSelect.addEventListener('change', () => {
            appState.language = languageSelect.value;
            localStorage.setItem('appLanguage', appState.language);
            document.documentElement.lang = appState.language;
            showToast('保存しました');
        });
    }

    dom.themePicker = dom.settingsContainer.querySelector('#theme-picker');
    if (dom.themePicker) {
        renderThemePicker();
        dom.themePicker.addEventListener('click', (event) => {
            const target = event.target.closest('.theme-option');
            if (!target) return;
            setTheme(target.dataset.theme || '');
        });
    }
    const wallpaperInput = dom.settingsContainer.querySelector('#settings-wallpaper-input');
    const wallpaperUploadBtn = dom.settingsContainer.querySelector('#settings-wallpaper-upload');
    const wallpaperRemoveBtn = dom.settingsContainer.querySelector('#settings-wallpaper-remove');
    if (wallpaperUploadBtn && wallpaperInput) {
        wallpaperUploadBtn.addEventListener('click', () => wallpaperInput.click());
    }
    if (wallpaperInput) {
        wallpaperInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) handleWallpaperUpload(file);
            wallpaperInput.value = '';
        });
    }
    if (wallpaperRemoveBtn) {
        wallpaperRemoveBtn.addEventListener('click', () => handleWallpaperRemove());
    }
}

// --- Editor Logic ---

function hideEditorCompletion() {
    const editorContainer = dom.viewEditor?.querySelector('.editor-container');
    if (editorContainer) editorContainer.classList.remove('editor-complete-mode');
    if (dom.viewEditor) dom.viewEditor.classList.remove('editor-complete-mode');
    if (dom.editorComplete) dom.editorComplete.classList.add('hidden');
    if (dom.photoSection) dom.photoSection.classList.remove('hidden');
    if (dom.journalSections) dom.journalSections.classList.remove('hidden');
    if (dom.analysisPanel) dom.analysisPanel.classList.remove('hidden');
    if (dom.selectLockStatus) {
        dom.selectLockStatus.disabled = false;
        dom.selectLockStatus.classList.remove('hidden');
    }
    if (dom.displayDate) dom.displayDate.classList.remove('hidden');
    if (dom.btnCancel) dom.btnCancel.classList.remove('hidden');
}

function showEditorCompletion(entry) {
    const editorContainer = dom.viewEditor?.querySelector('.editor-container');
    if (editorContainer) editorContainer.classList.add('editor-complete-mode');
    if (dom.viewEditor) dom.viewEditor.classList.add('editor-complete-mode');
    if (dom.editorComplete) dom.editorComplete.classList.remove('hidden');
    if (dom.photoSection) dom.photoSection.classList.add('hidden');
    if (dom.journalSections) dom.journalSections.classList.add('hidden');
    if (dom.analysisPanel) dom.analysisPanel.classList.add('hidden');
    if (dom.displayDate) dom.displayDate.classList.add('hidden');
    if (dom.btnSave) dom.btnSave.classList.add('hidden');
    if (dom.btnAddEntry) dom.btnAddEntry.classList.add('hidden');
    if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
    if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'none';
    if (dom.btnUploadImage) dom.btnUploadImage.classList.add('hidden');
    if (dom.selectLockStatus) {
        dom.selectLockStatus.disabled = true;
        dom.selectLockStatus.classList.add('hidden');
    }
    if (dom.btnCancel) dom.btnCancel.classList.add('hidden');
    if (dom.btnViewToday && entry) {
        dom.btnViewToday.onclick = () => {
            appState.readIndex = 0;
            appState.filterByDate = applyJournalCutoff(getEntryDate(entry));
            navigateTo('list');
        };
    }
    if (dom.btnViewQuestionsComplete) {
        dom.btnViewQuestionsComplete.onclick = () => {
            navigateTo('questions');
        };
    }
}

function updateEditorActionButtons(entry) {
    if (!dom.btnAddEntry) return;
    const canAdd = !entry || isDraftEntry(entry);
    dom.btnAddEntry.classList.toggle('hidden', !canAdd);
}

function getPreviousFinalEntry(targetDate) {
    const baseDate = targetDate || getJournalDateNow();
    const targetTs = getJournalDayStart(baseDate).getTime();
    let candidate = null;
    let candidateTs = -Infinity;
    (appState.entries || []).filter(isFinalEntry).forEach((entry) => {
        const entryTs = getJournalDayStart(getEntryDate(entry)).getTime();
        if (entryTs < targetTs && entryTs > candidateTs) {
            candidate = entry;
            candidateTs = entryTs;
        }
    });
    return candidate;
}

const PATTERN_ADVICE_JA = {
    jump_to_conclusion: '結論を急ぐ前に、根拠をひとつだけ追加してみよう。',
    overgeneralization: '例外をひとつ書いて、視野を広げてみよう。',
    black_and_white: '中間の選択肢を一つ考えてみよう。',
    emotional_reasoning: '感情と事実を分けて一文で書いてみよう。',
    self_blame: '自分以外の要因をひとつ挙げてみよう。',
    mind_reading: '確かな根拠があるかを一度見直してみよう。',
    catastrophizing: '最悪ではなく「最もありそう」な結果を書いてみよう。',
    magnification_minimization: '影響度を1〜10で見積もってみよう。',
    should_statements: '「べき」を「望ましい」に言い換えてみよう。',
    negative_filter: '良かった点を一つだけ追加してみよう。',
    comparison_inferiority: '昨日の自分と比べてみよう。',
    avoidance_procrastination: 'まず5分だけ手を動かす作業を書いてみよう。'
};

const EMOTION_ADVICE_JA = {
    sadness: '気持ちが落ち着くことを一つだけ書いてみよう。',
    fear: '不安と反対の視点を一つ書いてみよう。',
    anger: '深呼吸して、気持ちが戻る行動を一つ書いてみよう。',
    joy: '嬉しかった理由を一言で残してみよう。',
    trust: '信頼できた点を一つ書いてみよう。',
    surprise: '驚いた理由を一文で整理してみよう。',
    disgust: '距離を取る方法を一つ書いてみよう。',
    anticipation: '期待していることを具体的に一つ書いてみよう。'
};

function buildEditorAdviceText(analysis) {
    if (!analysis) return '前回の分析結果がまだありません。';
    const comment = String(analysis.observation_comment || analysis.observationComment || '').trim();
    if (comment) return comment;
    const patternsList = Array.isArray(analysis.patterns)
        ? analysis.patterns
        : (analysis.patterns ? Object.values(analysis.patterns) : []);
    const sortedPatterns = [...patternsList].sort((a, b) => (b.confidence_0_1 || 0) - (a.confidence_0_1 || 0));
    if (sortedPatterns.length) {
        const entry = getPatternEntry(sortedPatterns[0]);
        if (entry && PATTERN_ADVICE_JA[entry.id]) return PATTERN_ADVICE_JA[entry.id];
    }
    const topEmotion = getTopEmotion(analysis);
    if (topEmotion && EMOTION_ADVICE_JA[topEmotion.key]) return EMOTION_ADVICE_JA[topEmotion.key];
    return '今日の気づきを一つだけ書いてみよう。';
}

function updateEditorAdvice(targetDate) {
    if (!dom.editorAdviceText) return;
    const baseDate = targetDate || appState.writingDate || getJournalDateNow();
    const prevEntry = getPreviousFinalEntry(baseDate);
    if (!prevEntry) {
        dom.editorAdviceText.textContent = '前回のジャーナルがまだありません。';
        return;
    }
    const analysis = appState.analysisById[prevEntry.id];
    dom.editorAdviceText.textContent = buildEditorAdviceText(analysis);
}

function openEntry(entryId = null, targetDate = null) {
    appState.activeEntryId = entryId;
    currentUploadImage = null;
    navigateTo('editor');
    hideEditorCompletion();

    if (dom.lockOverlay) dom.lockOverlay.classList.add('hidden');
    if (dom.inputUnlockPass) dom.inputUnlockPass.value = '';

    if (!entryId) {
        const baseDate = targetDate || getJournalDateNow();
        const existingFinal = findFinalEntryForDate(baseDate);
        if (existingFinal) {
            appState.activeEntryId = null;
            appState.writingDate = baseDate;
            if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u30b8\u30e3\u30fc\u30ca\u30eb';
            if (dom.displayDate) dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${formatDate(baseDate)}`;
            if (dom.selectLockStatus) dom.selectLockStatus.value = 'unlocked';
            showEditorCompletion(existingFinal);
            updateEditorAdvice(baseDate);
            updateSummaryDate(baseDate);
            return;
        }
        const draftEntry = findDraftEntryForDate(baseDate);
        if (draftEntry) {
            entryId = draftEntry.id;
            appState.activeEntryId = entryId;
        }
    }

    if (entryId) {
        const entry = appState.entries.find(e => e.id === entryId);
        if (!entry) return navigateTo('list');

        currentUploadImage = entry.image || null;
        const entryDate = getEntryDate(entry);
        const journalDate = applyJournalCutoff(entryDate);
        appState.writingDate = journalDate;
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = entry.title || '\u30b8\u30e3\u30fc\u30ca\u30eb';
        if (dom.displayDate) {
            dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${formatDate(journalDate)}`;
        }
        if (dom.selectLockStatus) dom.selectLockStatus.value = entry.isLocked ? 'locked' : 'unlocked';
        const journal = getJournalFromEntry(entry);
        fillJournalInputs(journal);
        fillJournalDisplays(journal);
        updateSummaryDate(journalDate);
        if (dom.journalSections) dom.journalSections.classList.remove('hidden');

        if (entry.isLocked) {
            toggleEditMode(false);
            if (dom.contentDisplayText) dom.contentDisplayText.classList.add('hidden');
            if (dom.lockOverlay) dom.lockOverlay.classList.remove('hidden');
            setPhotoPreview('', false);
            if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
            if (dom.btnDeleteEntry) dom.btnDeleteEntry.style.display = 'none';
            if (dom.journalSections) dom.journalSections.classList.add('hidden');
        } else {
            if (dom.contentDisplayText) dom.contentDisplayText.textContent = entry.content;
            const isEditing = isDraftEntry(entry);
            toggleEditMode(isEditing);
            setPhotoPreview(entry.image || '', isEditing);
        }

        if (dom.displayScore) dom.displayScore.innerHTML = '';
        renderAnalysisPanel(entry);
        updateEditorActionButtons(entry);
        updateEditorAdvice(appState.writingDate);
    } else {
        appState.writingDate = targetDate || getJournalDateNow();
        if (dom.editorTitleLabel) dom.editorTitleLabel.textContent = '\u30b8\u30e3\u30fc\u30ca\u30eb';
        if (dom.displayDate) dom.displayDate.innerHTML = `<i class="fa-regular fa-calendar-plus"></i> ${formatDate(appState.writingDate)}`;
        if (dom.selectLockStatus) dom.selectLockStatus.value = 'unlocked';
        if (dom.inputContent) dom.inputContent.value = '';
        clearJournalFields();
        updateSummaryDate(appState.writingDate);
        if (dom.displayScore) dom.displayScore.innerHTML = '';
        clearPhotoPreview(true);
        if (dom.analysisPanel) dom.analysisPanel.innerHTML = '';
        if (dom.journalSections) dom.journalSections.classList.remove('hidden');
        toggleEditMode(true);
        updateEditorActionButtons(null);
        updateEditorAdvice(appState.writingDate);
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
        if (dom.btnAddEntry) dom.btnAddEntry.classList.remove('hidden');
        if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'none';
        if (dom.btnUploadImage) {
            const hasImage = !!getPhotoSource();
            dom.btnUploadImage.classList.toggle('hidden', hasImage);
        }
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
        const activeEntry = appState.activeEntryId
            ? appState.entries.find(e => e.id === appState.activeEntryId)
            : null;
        updateEditorActionButtons(activeEntry);
        setTimeout(() => {
            if (autoResizeTextarea) autoResizeTextarea();
            resizeAllJournalTextareas();
        }, 10);
    } else {
        if (dom.inputContent) dom.inputContent.classList.add('hidden');
        if (dom.contentDisplayText) dom.contentDisplayText.classList.remove('hidden');
        setJournalEditMode(false);
        if (dom.btnSave) dom.btnSave.classList.add('hidden');
        if (dom.btnAddEntry) dom.btnAddEntry.classList.add('hidden');
        if (dom.btnEditEntry) dom.btnEditEntry.style.display = 'inline-flex';
        if (dom.btnUploadImage) dom.btnUploadImage.classList.add('hidden');
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
            setPhotoPreview(entry.image || '', false);
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

function getPhotoSource() {
    if (currentUploadImage) return currentUploadImage;
    if (!dom.imagePreview) return '';
    return dom.imagePreview.getAttribute('src') || '';
}

function isEditorEditable() {
    return !!(dom.inputContent && !dom.inputContent.classList.contains('hidden'));
}

function setPhotoPreview(imageSrc, editable = true) {
    const hasImage = !!imageSrc;
    if (dom.imagePreview) {
        if (hasImage) {
            dom.imagePreview.src = imageSrc;
        } else {
            dom.imagePreview.removeAttribute('src');
        }
    }
    if (dom.imagePreviewContainer) {
        dom.imagePreviewContainer.classList.toggle('hidden', !hasImage);
    }
    if (dom.photoSection) {
        dom.photoSection.classList.toggle('has-image', hasImage);
    }
    if (dom.btnUploadImage) {
        dom.btnUploadImage.classList.toggle('hidden', !editable || hasImage);
    }
}

function clearPhotoPreview(editable = true) {
    currentUploadImage = null;
    if (dom.entryImageInput) dom.entryImageInput.value = '';
    setPhotoPreview('', editable);
}

function openPhotoModal() {
    const imageSrc = getPhotoSource();
    if (!imageSrc || !dom.modalPhoto) return;
    if (dom.photoModalImage) dom.photoModalImage.src = imageSrc;
    if (dom.modalPhoto.parentElement !== document.body) {
        document.body.appendChild(dom.modalPhoto);
    }
    dom.modalPhoto.classList.remove('hidden');
    dom.modalPhoto.classList.add('active');
    dom.modalPhoto.style.display = 'flex';
    dom.modalPhoto.style.opacity = '1';
    dom.modalPhoto.style.visibility = 'visible';
    dom.modalPhoto.style.zIndex = '2000';
    dom.modalPhoto.style.position = 'fixed';
    dom.modalPhoto.style.top = '0';
    dom.modalPhoto.style.left = '0';
    dom.modalPhoto.style.right = '0';
    dom.modalPhoto.style.bottom = '0';
    dom.modalPhoto.style.width = '100vw';
    dom.modalPhoto.style.height = '100vh';
}

function closePhotoModal() {
    if (!dom.modalPhoto) return;
    dom.modalPhoto.classList.add('hidden');
    dom.modalPhoto.classList.remove('active');
    dom.modalPhoto.removeAttribute('style');
}

async function handleImageUpload(file) {
    if (!file) return;
    try {
        const compressed = await compressImage(file, 800, 0.7);
        currentUploadImage = compressed;
        setPhotoPreview(compressed, true);
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
        dom.analysisPanel.innerHTML = '<div class="analysis-status">?</div>';
        return;
    }

    const analysis = appState.analysisById[entry.id];
    const status = appState.analysisStatusById[entry.id] || (analysis ? 'done' : 'none');

    if (status === 'processing') {
        dom.analysisPanel.innerHTML = '<div class="analysis-status">\u89e3\u6790\u4e2d...</div>';
        return;
    }

    if (status === 'failed') {
        dom.analysisPanel.innerHTML = `
            <div class="analysis-status">\u89e3\u6790\u306b\u5931\u6557\u3057\u307e\u3057\u305f</div>
            <button class="btn-secondary" onclick="retryAnalysisHelper('${entry.id}')">?</button>
        `;
        return;
    }

    if (!analysis) {
        dom.analysisPanel.innerHTML = `
            <div class="analysis-status">\u89e3\u6790\u304c\u307e\u3060\u3042\u308a\u307e\u305b\u3093</div>
            <button class="btn-secondary" onclick="retryAnalysisHelper('${entry.id}')">??</button>
        `;
        return;
    }

    const topEmotion = getTopEmotion(analysis);
    const emotionLabel = topEmotion ? EMOTION_LABELS[topEmotion.key] : '\u672a\u5206\u6790';
    const emotionScore = topEmotion ? Math.round(topEmotion.intensity || 0) : null;
    const summaryText = (analysis.observation_comment || '').trim();
    const summarySafe = summaryText
        ? escapeHtml(summaryText)
        : `${emotionLabel}\u304c\u4e2d\u5fc3\u306e\u8a18\u9332\u3067\u3059\u3002`;

    const facts = (analysis.facts || []).map(escapeHtml);
    const story = (analysis.story || []).map(escapeHtml);
    const emotions = (analysis.emotions || []).map((e) => {
        const key = normalizeEmotionKey(e.label || e.primary || e.emotion);
        const name = key ? EMOTION_LABELS[key] : (e.label || '\u672a\u5206\u6790');
        const intensity = Math.round(e.intensity_0_100 || 0);
        const certainty = e.certainty_0_1 != null ? Number(e.certainty_0_1).toFixed(2) : null;
        return `${escapeHtml(name)}${Number.isFinite(intensity) ? ` ${intensity}\u70b9` : ''}${certainty ? ` (\u78ba\u5ea6 ${certainty})` : ''}`;
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
        const meta = conf ? `\u78ba\u5ea6 ${conf}` : '';
        return `
            <li class="pattern-item">
                <div class="pattern-label">${escapeHtml(entry.label)}${meta ? ` <span class="pattern-meta">${meta}</span>` : ''}</div>
                ${entry.desc ? `<div class="pattern-desc">${escapeHtml(entry.desc)}</div>` : ''}
            </li>
        `;
    });
    const patternsHtml = patterns.length
        ? patterns.join('')
        : '<li class="pattern-empty">?</li>';
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
        : `<button class="btn-text-sm" onclick="fetchSimilarForEntryById('${entry.id}')">\u985e\u4f3c\u3092\u691c\u7d22</button>`;

    dom.analysisPanel.innerHTML = `
        <div class="analysis-block">
            <div class="analysis-summary">
                <div class="analysis-summary-header">
                    <div>
                        <div class="analysis-title">??</div>
                        <div class="analysis-emotion">${emotionLabel}${emotionScore != null ? ` <span class="analysis-emotion-score">${emotionScore}\u70b9</span>` : ''}</div>
                    </div>
                    <div class="analysis-actions">
                        <button class="btn-text-sm" onclick="retryAnalysisHelper('${entry.id}')">??</button>
                    </div>
                </div>
                <div class="analysis-summary-text">${summarySafe}</div>
            </div>
        </div>
        <div class="analysis-block">
            <div class="analysis-title">?</div>
            <div class="analysis-similar">${similarHtml}</div>
        </div>
        <div class="analysis-block analysis-details is-open" id="analysis-details-${entry.id}">
            <div class="analysis-detail-grid">
                <div class="analysis-detail">
                    <h4>??</h4>
                    <ul class="analysis-list">${emotions.map(f => `<li>${f}</li>`).join('') || '<li>?</li>'}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>\u8a8d\u77e5\u30d1\u30bf\u30fc\u30f3</h4>
                    <ul class="analysis-list">${patternsHtml}</ul>
                </div>
                <div class="analysis-detail">
                    <h4>??</h4>
                    <p class="analysis-text">${escapeHtml(habitInsight)}</p>
                </div>
                <div class="analysis-detail">
                    <h4>\u6b21\u306e\u4e00\u6b69</h4>
                    <p class="analysis-text">${escapeHtml(nextStep)}</p>
                </div>
                <div class="analysis-detail">
                    <h4>?</h4>
                    <div class="analysis-tags">${topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') || '<span class="tag">?</span>'}</div>
                </div>
            </div>
        </div>
    `;
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
            showToast('??', 'error');
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
            showToast('\u65e5\u8a18\u306f\u4fdd\u5b58\u6e08\u307f\u3067\u3059\u304c\u3001\u89e3\u6790\u307e\u305f\u306f\u985e\u4f3c\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u518d\u8a66\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002', 'error');
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

function getTopEmotion(analysis) {
    if (!analysis || !Array.isArray(analysis.emotions) || analysis.emotions.length === 0) return null;
    const sorted = [...analysis.emotions].sort((a, b) => (b.intensity_0_100 || 0) - (a.intensity_0_100 || 0));
    const top = sorted[0];
    const key = normalizeEmotionKey(top.label || top.emotion || top.primary);
    return key ? { key, intensity: top.intensity_0_100 || 0 } : null;
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
        jump_to_conclusion: 'Add one more piece of evidence before deciding.',
        overgeneralization: 'Note one exception to balance the pattern.',
        black_and_white: 'List a middle option between the extremes.',
        emotional_reasoning: 'Separate feelings from facts in one sentence.',
        self_blame: 'Write one factor outside your control.',
        mind_reading: 'Ask what evidence you actually have.',
        catastrophizing: 'Name the most likely outcome, not the worst.',
        magnification_minimization: 'Rate the impact from 1-10 for perspective.',
        should_statements: 'Rewrite the "should" as a preference.',
        negative_filter: 'Add one neutral detail you noticed.',
        comparison_inferiority: 'Compare today only with yesterday you.',
        avoidance_procrastination: 'Define a 5-minute starter task.'
    };
    if (patternId && patternSuggestions[patternId]) return patternSuggestions[patternId];

    if (!topEmotion) return 'Pick one small thing to notice and write it down.';
    switch (topEmotion.key) {
        case 'sadness':
            return 'Do one gentle action that calms you.';
        case 'fear':
            return 'Write one worry and one counter-point.';
        case 'anger':
            return 'Take 5 minutes away and breathe slowly.';
        case 'joy':
            return 'Note one detail you want to repeat later.';
        case 'anticipation':
            return 'Break the first step into a tiny action.';
        case 'trust':
            return 'Write why you felt safe or supported.';
        case 'surprise':
            return 'Summarize what you learned in one line.';
        case 'disgust':
            return 'Name the discomfort and take a small distance.';
        default:
            return 'Pick one small thing to notice and write it down.';
    }
}

function buildDiaryPersonalityInsight(stats) {
    if (!stats || !stats.analyzedCount) {
        return 'Not enough analyzed entries yet. Write a few more to see trends.';
    }
    if (stats.traitsSorted && stats.traitsSorted.length) {
        const top = stats.traitsSorted.slice(0, 2).map((t) => t.label);
        if (top.length === 1) {
            return `Your diary often shows: ${top[0]}.`;
        }
        return `Your diary often shows: ${top[0]} and ${top[1]}.`;
    }
    const parts = [];
    const topEmotion = stats.emotionsSorted[0];
    const topPattern = stats.patternsSorted[0];
    const topTopic = stats.topicsSorted[0];

    if (topEmotion) {
        const label = EMOTION_LABELS[topEmotion.key] || topEmotion.key;
        parts.push(`Emotion trend: ${label}.`);
    }
    if (topPattern) {
        parts.push(`Pattern trend: ${topPattern.label}.`);
    }
    if (topTopic) {
        const topicLabel = topTopic.label || topTopic.key || topTopic;
        parts.push(`Topic trend: ${topicLabel}.`);
    }
    return parts.length ? parts.join(' ') : 'No clear trend yet.';
}

function buildHabitInsight(patternsList) {
    if (!patternsList || !patternsList.length) return 'No patterns detected yet.';
    const sorted = [...patternsList].sort((a, b) => (b.confidence_0_1 || 0) - (a.confidence_0_1 || 0));
    const top = sorted[0];
    const entry = getPatternEntry(top);
    if (!entry) return 'No patterns detected yet.';
    return `Most frequent pattern: ${entry.label}.`;
}

function getFilteredEntries() {
    let list = (appState.entries || []).filter(isFinalEntry);

    if (appState.filterByDate) {
        const targetKey = getDateKey(appState.filterByDate);
        list = list.filter(e => getJournalDateKeyForEntry(getEntryDate(e)) === targetKey);
    }

    if (appState.filters.dateFrom) {
        const from = new Date(appState.filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        list = list.filter(e => getJournalDayStart(getEntryDate(e)) >= from);
    }
    if (appState.filters.dateTo) {
        const to = new Date(appState.filters.dateTo);
        to.setHours(23, 59, 59, 999);
        list = list.filter(e => getJournalDayStart(getEntryDate(e)) <= to);
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

function buildJournalPreview(entry) {
    if (!entry) return '';
    const journal = getJournalFromEntry(entry);
    const placeholder = '\u2014\u2014\u2014';
    const normalizeEmpty = (value) => {
        const v = String(value || '').trim();
        return !v || v === '\u672a\u8a18\u5165' ? placeholder : v;
    };
    const normalizeScale = (value) => {
        const v = formatScale(value);
        return v === '???' ? placeholder : v;
    };
    const diaryText = entry.content || entry.text || '';
    const imageUrl = String(entry.image || '').trim();
    const heroImage = imageUrl || PHOTO_PLACEHOLDER_IMAGE;
    const heroAlt = imageUrl ? '\u5199\u771f' : '\u5199\u771f\u306a\u3057';
    const diary = normalizeEmpty(diaryText);
    const highlight = normalizeEmpty(journal.highlight);
    const emotionPair = formatEmotionPair(journal.emotionPrimary, journal.emotionSecondary, journal.emotionCompound);
    const satisfaction = normalizeScale(journal.satisfaction);
    const done = normalizeEmpty(journal.done);
    const notDone = normalizeEmpty(journal.notDone);
    const nextPlan = normalizeEmpty(journal.nextPlan);
    const locationMarkup = renderLocationMarkup(journal.location, 180);
    const locationLabelText = journal.locationLabel ? escapeHtml(journal.locationLabel) : placeholder;
    const browsingMarkup = renderBrowsingLinks(journal.browsing || '', placeholder);
    const memo = normalizeEmpty(journal.memo);
    const scheduleHtml = renderScheduleDisplay(journal.schedule || []);
    const breakfast = normalizeEmpty(journal.meals.breakfast);
    const lunch = normalizeEmpty(journal.meals.lunch);
    const dinner = normalizeEmpty(journal.meals.dinner);
    const weight = journal.weight ? formatWithUnit(journal.weight, 'kg') : placeholder;
    const sleep = journal.sleepHours ? formatWithUnit(journal.sleepHours, '時間') : placeholder;
    return `
        <div class="journal-read-grid">
            <div class="journal-read-card journal-read-hero">
                <div class="journal-hero">
                    <div class="journal-hero-media ${imageUrl ? '' : 'is-placeholder'}">
                        <img src="${encodeURI(heroImage)}" alt="${heroAlt}">
                    </div>
                    <div class="journal-hero-content">
                        <div class="journal-read-label">\u65e5\u8a18</div>
                        <div class="journal-read-text">${escapeHtml(diary)}</div>
                    </div>
                </div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u4e88\u5b9a</div>
                <div class="journal-read-text journal-read-schedule">${scheduleHtml}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u7761\u7720\u6642\u9593</div>
                <div class="journal-read-text">${escapeHtml(sleep)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u4f53\u91cd</div>
                <div class="journal-read-text">${escapeHtml(weight)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u5370\u8c61\u306b\u6b8b\u3063\u305f\u611f\u60c5</div>
                <div class="journal-read-text">${escapeHtml(emotionPair)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u4e00\u65e5\u306e\u6e80\u8db3\u5ea6</div>
                <div class="journal-read-text">${escapeHtml(satisfaction)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u98df\u3079\u305f\u3082\u306e</div>
                <div class="journal-read-list">
                    <div class="journal-read-sub-row"><span class="journal-read-sub-label">\u671d</span><span>${escapeHtml(breakfast)}</span></div>
                    <div class="journal-read-sub-row"><span class="journal-read-sub-label">\u663c</span><span>${escapeHtml(lunch)}</span></div>
                    <div class="journal-read-sub-row"><span class="journal-read-sub-label">\u591c</span><span>${escapeHtml(dinner)}</span></div>
                </div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u3067\u304d\u305f\u3053\u3068</div>
                <div class="journal-read-text">${escapeHtml(done)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u3067\u304d\u306a\u304b\u3063\u305f\u3053\u3068</div>
                <div class="journal-read-text">${escapeHtml(notDone)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u3053\u308c\u304b\u3089\u3084\u308b\u3053\u3068</div>
                <div class="journal-read-text">${escapeHtml(nextPlan)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u95b2\u89a7</div>
                <div class="journal-read-text">${browsingMarkup}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u30e1\u30e2</div>
                <div class="journal-read-text">${escapeHtml(memo)}</div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u5834\u6240</div>
                <div class="journal-read-text">
                    <div class="journal-read-muted">${locationLabelText}</div>
                    ${locationMarkup}
                </div>
            </div>
            <div class="journal-read-card">
                <div class="journal-read-label">\u30cf\u30a4\u30e9\u30a4\u30c8</div>
                <div class="journal-read-text">${escapeHtml(highlight)}</div>
            </div>
        </div>
    `;
}

function buildEmotionSelectOptions(selected) {
    const current = String(selected || '').trim();
    const options = ['<option value="">\u306a\u3057</option>'];
    EMOTION_ORDER.forEach((key) => {
        const label = EMOTION_LABELS[key] || key;
        const isSelected = key === current ? ' selected' : '';
        options.push(`<option value="${key}"${isSelected}>${label}</option>`);
    });
    return options.join('');
}

function buildEntryCard(entry, options = {}) {
    const card = document.createElement('div');
    card.className = `entry-card ${entry.isLocked ? 'locked' : ''}`;
    if (options.toggleOnClick) {
        card.classList.add('is-collapsible');
        card.addEventListener('click', (event) => {
            if (card.classList.contains('is-editing')) return;
            if (event.target.closest('.entry-card-actions') || event.target.closest('.entry-edit')) return;
            event.preventDefault();
            card.classList.toggle('is-expanded');
        });
    } else {
        card.onclick = () => openEntry(entry.id);
    }

    const day = getEntryDate(entry);
    const analysis = appState.analysisById[entry.id];
    const topEmotion = getTopEmotion(analysis);
    const miniSummary = entry.isLocked
        ? '\u30ed\u30c3\u30af\u4e2d'
        : (analysis
            ? `\u611f\u60c5: ${topEmotion ? (EMOTION_LABELS[topEmotion.key] || topEmotion.key) : '\u672a\u5206\u6790'}${topEmotion ? ` (${Math.round(topEmotion.intensity || 0)}\u70b9)` : ''}`
            : '\u89e3\u6790\u306a\u3057');

    let contentPrev = entry.content || '...';
    let cardTitle = entry.title || '\u65e5\u8a18';

    if (entry.isLocked) {
        contentPrev = '<i class="fa-solid fa-lock" style="margin-right:5px;"></i> \u30ed\u30c3\u30af\u4e2d';
        cardTitle = '\u30ed\u30c3\u30af\u3055\u308c\u305f\u65e5\u8a18';
    }

    const canEdit = !entry.isLocked;
    const journalPreview = entry.isLocked ? '' : buildJournalPreview(entry);
    const journal = getJournalFromEntry(entry);

    const editForm = canEdit
        ? `
            <div class="entry-edit">
            <div class="entry-edit-grid">
                <div class="entry-edit-field">
                    <label>予定</label>
                    <textarea class="journal-input journal-textarea" rows="3" data-field="schedule">${escapeHtml(formatScheduleText(journal.schedule || []))}</textarea>
                </div>
                <div class="entry-edit-row entry-edit-row-2">
                    <div class="entry-edit-field">
                        <label>睡眠時間</label>
                        <input class="journal-input" data-field="sleep_hours" placeholder="時間" value="${escapeHtml(journal.sleepHours || '')}">
                    </div>
                    <div class="entry-edit-field">
                        <label>体重</label>
                        <input class="journal-input" data-field="weight" placeholder="kg" value="${escapeHtml(journal.weight || '')}">
                    </div>
                </div>
                <div class="entry-edit-row entry-edit-row-2">
                    <div class="entry-edit-field">
                        <label>印象に残った感情 (1)</label>
                        <select class="journal-input" data-field="emotion_primary">
                            ${buildEmotionSelectOptions(journal.emotionPrimary)}
                        </select>
                    </div>
                    <div class="entry-edit-field">
                        <label>印象に残った感情 (2)</label>
                        <select class="journal-input" data-field="emotion_secondary">
                            ${buildEmotionSelectOptions(journal.emotionSecondary)}
                        </select>
                    </div>
                </div>
                <div class="entry-edit-field">
                    <label>一日の満足度 (0-10)</label>
                    <input class="journal-input" type="number" min="0" max="10" step="1" data-field="satisfaction" placeholder="0-10" value="${escapeHtml(journal.satisfaction || '')}">
                </div>
                <div class="entry-edit-field">
                    <label>食べたもの</label>
                    <div class="entry-edit-row">
                        <input class="journal-input" data-field="meal_breakfast" placeholder="朝" value="${escapeHtml(journal.meals?.breakfast || '')}">
                        <input class="journal-input" data-field="meal_lunch" placeholder="昼" value="${escapeHtml(journal.meals?.lunch || '')}">
                        <input class="journal-input" data-field="meal_dinner" placeholder="夜" value="${escapeHtml(journal.meals?.dinner || '')}">
                    </div>
                </div>
                <div class="entry-edit-field">
                    <label>できたこと</label>
                    <textarea class="journal-input journal-textarea" rows="2" data-field="done">${escapeHtml(journal.done || '')}</textarea>
                </div>
                <div class="entry-edit-field">
                    <label>できなかったこと</label>
                    <textarea class="journal-input journal-textarea" rows="2" data-field="not_done">${escapeHtml(journal.notDone || '')}</textarea>
                </div>
                <div class="entry-edit-field">
                    <label>これからやること</label>
                    <textarea class="journal-input journal-textarea" rows="2" data-field="next_plan">${escapeHtml(journal.nextPlan || '')}</textarea>
                </div>
                <div class="entry-edit-field">
                    <label>閲覧</label>
                    <textarea class="journal-input journal-textarea" rows="2" data-field="browsing">${escapeHtml(journal.browsing || '')}</textarea>
                </div>
                <div class="entry-edit-field">
                    <label>メモ</label>
                    <textarea class="journal-input journal-textarea" rows="2" data-field="memo">${escapeHtml(journal.memo || '')}</textarea>
                </div>
                <div class="entry-edit-field">
                    <label>場所</label>
                    <input class="journal-input" data-field="location" placeholder="現在地や場所" value="${escapeHtml(journal.location || '')}">
                </div>
                <div class="entry-edit-field">
                    <label>ハイライト</label>
                    <input class="journal-input" data-field="highlight" placeholder="一言で" value="${escapeHtml(journal.highlight || '')}">
                </div>
                <div class="entry-edit-field">
                    <label>日記</label>
                    <textarea class="journal-input journal-textarea" rows="3" data-field="content">${escapeHtml(entry.content || '')}</textarea>
                </div>
            </div>
        </div>`
        : '';

    const actionsHtml = canEdit
        ? `
        <div class="entry-card-actions">
            <button class="btn-text-sm entry-delete hidden" data-entry-action="delete">削除</button>
            <button class="btn-text-sm entry-edit-toggle" data-entry-action="edit">編集</button>
        </div>`
        : '';

    card.innerHTML = `
        <div class="entry-header-row">
            <div class="entry-date">${day.getDate()} <span class="entry-day-sm">${day.toLocaleDateString('ja-JP', { weekday: 'short' })}</span> <span style="font-size:0.8em; color:var(--text-muted); font-weight:normal; margin-left:5px;">${formatTime(day)}</span></div>
            ${actionsHtml}
        </div>
        <div class="entry-readonly">
            ${entry.isLocked ? `<div class="entry-preview entry-preview-full">${contentPrev}</div>` : journalPreview}
        </div>
        ${editForm}
        <div class="entry-mini">${miniSummary}</div>
    `;

    if (canEdit) {
        const editToggle = card.querySelector('[data-entry-action="edit"]');
        const deleteBtn = card.querySelector('[data-entry-action="delete"]');
        if (editToggle) {
            editToggle.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (card.classList.contains('is-editing')) {
                    const ok = await saveEntryEditsFromCard(entry, card);
                    if (ok) {
                        card.classList.remove('is-editing');
                    }
                    return;
                }
                card.classList.add('is-editing');
                editToggle.textContent = '完了';
                if (deleteBtn) deleteBtn.classList.remove('hidden');
            });
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (!confirm('このジャーナルを削除しますか？')) return;
                await deleteEntryFromFirestore(entry.id);
            });
        }
    }

    return card;
}

function getReadEntries() {
    const entries = Array.isArray(appState.entries) ? appState.entries : [];
    return entries.filter(isFinalEntry).sort((a, b) => getEntryDate(b) - getEntryDate(a));
}

function normalizeReadText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildReadSearchText(entry) {
    const journal = getJournalFromEntry(entry);
    const analysis = appState.analysisById[entry.id] || {};
    const scheduleTitles = (journal.schedule || []).map((item) => item.title || '').join(' ');
    const locationText = buildLocationSummaryText(journal.locations || []);
    const values = [
        entry.title,
        entry.content,
        entry.text,
        journal.memo,
        journal.highlight,
        journal.done,
        journal.notDone,
        journal.nextPlan,
        journal.browsing,
        journal.mood,
        journal.meals.breakfast,
        journal.meals.lunch,
        journal.meals.dinner,
        scheduleTitles,
        locationText,
        analysis.observation_comment || analysis.observationComment || ''
    ];
    return normalizeReadText(values.filter(Boolean).join(' ')).toLowerCase();
}

function formatReadDateLabel(entry) {
    const date = applyJournalCutoff(getEntryDate(entry));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const weekday = date.toLocaleDateString('ja-JP', { weekday: 'short' });
    return `${y}.${m}.${d}（${weekday}）`;
}

function buildReadSummary(entry) {
    if (entry.isLocked) {
        return '\u30ed\u30c3\u30af\u4e2d\u306e\u305f\u3081\u3001\u8981\u7d04\u306f\u8868\u793a\u3055\u308c\u307e\u305b\u3093\u3002';
    }
    const analysis = appState.analysisById[entry.id] || {};
    const raw = normalizeReadText(analysis.observation_comment || analysis.observationComment || '');
    if (raw) return raw;
    const journal = getJournalFromEntry(entry);
    const hint = normalizeReadText(journal.highlight || entry.content || entry.text || journal.memo || '');
    if (hint) {
        return `\u300c${escapeHtml(hint)}\u300d\u304c\u5370\u8c61\u7684\u306a\u8a18\u9332\u3067\u3059\u3002\u6b21\u56de\u306f\u305d\u306e\u6642\u306e\u6c17\u6301\u3061\u3084\u7406\u7531\u3082\u66f8\u304f\u3068\u6574\u7406\u3057\u3084\u3059\u304f\u306a\u308a\u305d\u3046\u3067\u3059\u3002`;
    }
    return '\u8a18\u9332\u304c\u5c11\u306a\u3044\u3088\u3046\u3067\u3059\u3002\u4eca\u65e5\u306e\u51fa\u6765\u4e8b\u3068\u6c17\u6301\u3061\u3092\u77ed\u304f\u66f8\u304f\u3068\u6d41\u308c\u304c\u3064\u304b\u307f\u3084\u3059\u304f\u306a\u308a\u307e\u3059\u3002';
}

function formatReadValue(value, formatter) {
    const raw = formatter ? formatter(value) : String(value || '').trim();
    if (!raw || raw === '???' || raw === '-') return '\u2014';
    return raw;
}

function formatReadEmotion(journal) {
    const label = formatEmotionPair(journal.emotionPrimary, journal.emotionSecondary, journal.emotionCompound);
    return label && label !== '-' ? label : '\u2014';
}

function renderReadEmpty(message) {
    if (!dom.readCard) return;
    dom.readCard.innerHTML = `<div class="read-card-empty">${escapeHtml(message)}</div>`;
    updateReadNavButtons();
}

function updateReadNavButtons() {
    if (!dom.readPrev || !dom.readNext) return;
    const total = appState.readFilteredEntries.length;
    const index = Number.isFinite(appState.readIndex) ? appState.readIndex : 0;
    const canMoveNewer = index > 0;
    const canMoveOlder = index < total - 1;
    // ">" = newer (toward index 0), "<" = older (toward last index)
    dom.readPrev.disabled = total === 0 || !canMoveOlder;
    dom.readNext.disabled = total === 0 || !canMoveNewer;
    dom.readPrev.classList.toggle('disabled', dom.readPrev.disabled);
    dom.readNext.classList.toggle('disabled', dom.readNext.disabled);
}

function renderReadCard(entry) {
    if (!dom.readCard) return;
    if (!entry) {
        renderReadEmpty('\u4e00\u81f4\u3059\u308b\u30b8\u30e3\u30fc\u30ca\u30eb\u304c\u3042\u308a\u307e\u305b\u3093');
        return;
    }
    const journal = getJournalFromEntry(entry);
    const summary = buildReadSummary(entry);
    const scheduleCount = (journal.schedule || []).length || '\u2014';
    const sleep = formatReadValue(journal.sleepHours, (v) => formatWithUnit(v, '時間'));
    const workout = formatReadValue(journal.workout, formatDurationLabel);
    const focus = formatReadValue(journal.focus, formatDurationLabel);
    const satisfaction = formatReadValue(journal.satisfaction, formatScale);
    const emotion = formatReadEmotion(journal);

    dom.readCard.innerHTML = `
        <div class="read-card-date">${escapeHtml(formatReadDateLabel(entry))}</div>
        <div class="read-card-divider"></div>
        <div class="read-card-summary">${summary}</div>
        <div class="read-card-divider"></div>
        <div class="read-metrics">
            <div class="read-metric"><span class="read-metric-label">\u4e88\u5b9a\u306e\u6570</span><span class="read-metric-value">${escapeHtml(String(scheduleCount))}</span></div>
            <div class="read-metric"><span class="read-metric-label">\u7761\u7720\u6642\u9593</span><span class="read-metric-value">${escapeHtml(sleep)}</span></div>
            <div class="read-metric"><span class="read-metric-label">\u904b\u52d5\u6642\u9593</span><span class="read-metric-value">${escapeHtml(workout)}</span></div>
            <div class="read-metric"><span class="read-metric-label">\u96c6\u4e2d\u6642\u9593</span><span class="read-metric-value">${escapeHtml(focus)}</span></div>
            <div class="read-metric"><span class="read-metric-label">\u6e80\u8db3\u5ea6</span><span class="read-metric-value">${escapeHtml(satisfaction)}</span></div>
            <div class="read-metric"><span class="read-metric-label">\u611f\u60c5</span><span class="read-metric-value">${escapeHtml(emotion)}</span></div>
        </div>
    `;
    dom.readCard.onclick = () => openReadDetailModal(entry);
    updateReadNavButtons();
}

function matchReadCondition(entry, condition) {
    const journal = getJournalFromEntry(entry);
    if (!condition) return true;
    if (condition.type === 'keyword') {
        const text = buildReadSearchText(entry);
        const keyword = normalizeReadText(condition.value).toLowerCase();
        return keyword ? text.includes(keyword) : true;
    }
    if (condition.type === 'date') {
        const date = applyJournalCutoff(getEntryDate(entry));
        const from = condition.from ? toDateValue(condition.from) : null;
        const to = condition.to ? toDateValue(condition.to) : null;
        if (from && date < from) return false;
        if (to) {
            const end = new Date(to);
            end.setHours(23, 59, 59, 999);
            if (date > end) return false;
        }
        return true;
    }
    if (condition.type === 'satisfaction') {
        const value = Number(journal.satisfaction || 0);
        if (!Number.isFinite(value) || value <= 0) return false;
        if (condition.min != null && value < condition.min) return false;
        if (condition.max != null && value > condition.max) return false;
        return true;
    }
    if (condition.type === 'emotion') {
        const label = condition.label || condition.value || '';
        if (!label) return true;
        const primary = EMOTION_LABELS[journal.emotionPrimary] || journal.emotionPrimary || '';
        const secondary = EMOTION_LABELS[journal.emotionSecondary] || journal.emotionSecondary || '';
        const compound = journal.emotionCompound || '';
        return [primary, secondary, compound].filter(Boolean).some((value) => value === label);
    }
    return true;
}

function applyReadFilters(entries) {
    const query = normalizeReadText(appState.readQuery).toLowerCase();
    let list = entries;
    if (query) {
        list = list.filter((entry) => buildReadSearchText(entry).includes(query));
    }
    if (appState.readCustomConditions.length) {
        list = list.filter((entry) => appState.readCustomConditions.every((condition) => matchReadCondition(entry, condition)));
    }
    return list;
}

function renderReadCustomConditions() {
    if (!dom.readCustomConditions) return;
    if (!appState.readCustomConditions.length) {
        dom.readCustomConditions.innerHTML = '<div class="read-conditions-empty">\u6761\u4ef6\u304c\u3042\u308a\u307e\u305b\u3093</div>';
        return;
    }
    dom.readCustomConditions.innerHTML = appState.readCustomConditions.map((condition) => {
        return `
            <button class="read-condition-chip" data-id="${condition.id}" type="button">
                <span>${escapeHtml(condition.label)}</span>
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
    }).join('');
}

function addReadCondition(condition) {
    appState.readCustomConditions.push({
        ...condition,
        id: condition.id || `cond-${Date.now()}-${Math.random().toString(16).slice(2)}`
    });
    renderReadCustomConditions();
}

function clearReadConditions() {
    appState.readCustomConditions = [];
    renderReadCustomConditions();
}

function renderReadCustomInput() {
    if (!dom.readCustomInput || !dom.readCustomTitle) return;
    const tab = appState.readCustomTab;
    dom.readCustomTitle.textContent = tab === 'keyword' ? '\u30ad\u30fc\u30ef\u30fc\u30c9' : tab === 'date'
        ? '\u65e5\u4ed8'
        : tab === 'satisfaction'
            ? '\u6e80\u8db3\u5ea6'
            : '\u611f\u60c5';
    if (tab === 'keyword') {
        dom.readCustomInput.innerHTML = `
            <div class="read-custom-row">
                <input id="read-custom-keyword" class="read-custom-field" type="text" placeholder="\u30ad\u30fc\u30ef\u30fc\u30c9\u3092\u8ffd\u52a0">
                <button id="btn-read-add-keyword" class="btn-secondary" type="button">\u8ffd\u52a0</button>
            </div>
        `;
        const input = dom.readCustomInput.querySelector('#read-custom-keyword');
        const btn = dom.readCustomInput.querySelector('#btn-read-add-keyword');
        const add = () => {
            const value = normalizeReadText(input.value);
            if (!value) return;
            addReadCondition({ type: 'keyword', value, label: `\u30ad\u30fc\u30ef\u30fc\u30c9:${value}` });
            input.value = '';
        };
        btn.addEventListener('click', add);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                add();
            }
        });
    } else if (tab === 'date') {
        dom.readCustomInput.innerHTML = `
            <div class="read-custom-row">
                <input id="read-custom-date-from" class="read-custom-field" type="date">
                <span class="read-custom-range">\u301c</span>
                <input id="read-custom-date-to" class="read-custom-field" type="date">
                <button id="btn-read-add-date" class="btn-secondary" type="button">\u8ffd\u52a0</button>
            </div>
        `;
        const from = dom.readCustomInput.querySelector('#read-custom-date-from');
        const to = dom.readCustomInput.querySelector('#read-custom-date-to');
        const btn = dom.readCustomInput.querySelector('#btn-read-add-date');
        btn.addEventListener('click', () => {
            if (!from.value && !to.value) return;
            const label = `\u65e5\u4ed8:${from.value || '----/--/--'}-${to.value || '----/--/--'}`;
            addReadCondition({ type: 'date', from: from.value || '', to: to.value || '', label });
            from.value = '';
            to.value = '';
        });
    } else if (tab === 'satisfaction') {
        dom.readCustomInput.innerHTML = `
            <div class="read-custom-row">
                <input id="read-custom-sat-min" class="read-custom-field read-custom-number" type="number" min="1" max="10" placeholder="\u6700\u4f4e">
                <span class="read-custom-range">\u301c</span>
                <input id="read-custom-sat-max" class="read-custom-field read-custom-number" type="number" min="1" max="10" placeholder="\u6700\u9ad8">
                <button id="btn-read-add-sat" class="btn-secondary" type="button">\u8ffd\u52a0</button>
            </div>
        `;
        const minEl = dom.readCustomInput.querySelector('#read-custom-sat-min');
        const maxEl = dom.readCustomInput.querySelector('#read-custom-sat-max');
        const btn = dom.readCustomInput.querySelector('#btn-read-add-sat');
        btn.addEventListener('click', () => {
            const min = Number(minEl.value);
            const max = Number(maxEl.value);
            if (!min && !max) return;
            const label = `\u6e80\u8db3\u5ea6:${min || 1}-${max || 10}`;
            addReadCondition({
                type: 'satisfaction',
                min: Number.isFinite(min) && min > 0 ? min : null,
                max: Number.isFinite(max) && max > 0 ? max : null,
                label
            });
            minEl.value = '';
            maxEl.value = '';
        });
    } else {
        const options = EMOTION_ORDER.map((key) => `<option value="${key}">${EMOTION_LABELS[key]}</option>`).join('');
        dom.readCustomInput.innerHTML = `
            <div class="read-custom-row">
                <select id="read-custom-emotion" class="read-custom-field">
                    <option value="">\u611f\u60c5\u3092\u9078\u629e</option>
                    ${options}
                </select>
                <button id="btn-read-add-emotion" class="btn-secondary" type="button">\u8ffd\u52a0</button>
            </div>
        `;
        const select = dom.readCustomInput.querySelector('#read-custom-emotion');
        const btn = dom.readCustomInput.querySelector('#btn-read-add-emotion');
        btn.addEventListener('click', () => {
            const key = select.value;
            if (!key) return;
            const label = EMOTION_LABELS[key] || key;
            addReadCondition({ type: 'emotion', value: key, label: `\u611f\u60c5:${label}` });
            select.value = '';
        });
    }
}

function setReadCustomTab(tab) {
    appState.readCustomTab = tab;
    document.querySelectorAll('.read-custom-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tab);
    });
    renderReadCustomInput();
}

function openReadCustomModal() {
    if (!dom.modalReadCustom) return;
    dom.modalReadCustom.classList.add('active');
    dom.modalReadCustom.classList.remove('hidden');
    setReadCustomTab(appState.readCustomTab || 'keyword');
    renderReadCustomConditions();
}

function closeReadCustomModal() {
    if (!dom.modalReadCustom) return;
    dom.modalReadCustom.classList.remove('active');
    dom.modalReadCustom.classList.add('hidden');
}

function applyReadCustomSearch() {
    appState.readIndex = 0;
    renderEntryList();
    closeReadCustomModal();
}

function openReadDetailModal(entry) {
    if (!dom.modalReadDetail) return;
    const journal = getJournalFromEntry(entry);
    const summary = buildReadSummary(entry);
    const scheduleItems = journal.schedule || [];
    const memo = journal.memo || '\u2014';
    const locationSummary = buildLocationSummaryText(journal.locations || []);
    const urlsMarkup = renderReadLinkList(journal.browsing || '');
    const diaryText = normalizeReadText(entry.content || entry.text || '');
    const highlight = normalizeReadText(journal.highlight || '');

    const leftSections = [];
    leftSections.push(`
        <div class="read-detail-section">
            <div class="read-detail-heading">AI\u5206\u6790</div>
            <div class="read-detail-text">${summary}</div>
        </div>
    `);
    if (scheduleItems.length) {
        leftSections.push(`
            <div class="read-detail-section">
                <div class="read-detail-heading">\u4e88\u5b9a</div>
                <div class="read-detail-schedule">${renderScheduleDisplay(scheduleItems)}</div>
            </div>
        `);
    }
    leftSections.push(`
        <div class="read-detail-section">
            <div class="read-detail-heading">\u30e1\u30e2</div>
            <div class="read-detail-text">${escapeHtml(memo)}</div>
        </div>
    `);
    leftSections.push(`
        <div class="read-detail-split">
            <div class="read-detail-split-col">
                <div class="read-detail-heading">\u884c\u3063\u305f\u5834\u6240</div>
                <div class="read-detail-text">${escapeHtml(locationSummary || '\u2014')}</div>
            </div>
            <div class="read-detail-split-col">
                <div class="read-detail-heading">URL</div>
                ${urlsMarkup}
            </div>
        </div>
    `);

    const imageUrl = String(entry.image || '').trim();
    const photoHtml = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="\u5199\u771f">`
        : '<div class="read-photo-empty">\u5199\u771f\u306a\u3057</div>';

    const rightHtml = `
        <div class="read-detail-top">
            <div class="read-detail-photo ${imageUrl ? '' : 'is-empty'}">${photoHtml}</div>
            <div class="read-detail-metrics">
                ${buildReadMetricRow('\u7761\u7720\u6642\u9593', formatReadValue(journal.sleepHours, (v) => formatWithUnit(v, '時間')))}
                ${buildReadMetricRow('\u904b\u52d5\u6642\u9593', formatReadValue(journal.workout, formatDurationLabel))}
                ${buildReadMetricRow('\u4f53\u91cd', formatReadValue(journal.weight, (v) => formatWithUnit(v, 'kg')))}
                ${buildReadMetricRow('\u96c6\u4e2d\u6642\u9593', formatReadValue(journal.focus, formatDurationLabel))}
                ${buildReadMetricRow('\u6e80\u8db3\u5ea6', formatReadValue(journal.satisfaction, formatScale))}
                ${buildReadMetricRow('\u611f\u60c5', formatReadEmotion(journal))}
            </div>
        </div>
        <div class="read-detail-meals">
            <div><span>\u671d</span>${escapeHtml(journal.meals.breakfast || '\u2014')}</div>
            <div><span>\u663c</span>${escapeHtml(journal.meals.lunch || '\u2014')}</div>
            <div><span>\u591c</span>${escapeHtml(journal.meals.dinner || '\u2014')}</div>
        </div>
        <div class="read-detail-kpt">
            <div><span>Keep</span>${escapeHtml(journal.done || '\u2014')}</div>
            <div><span>Problem</span>${escapeHtml(journal.notDone || '\u2014')}</div>
            <div><span>Try</span>${escapeHtml(journal.nextPlan || '\u2014')}</div>
        </div>
        ${highlight ? `<div class="read-detail-highlight">${escapeHtml(highlight)}</div>` : ''}
        <div class="read-detail-diary">${diaryText ? escapeHtml(diaryText).replace(/\\n/g, '<br>') : '\u2014'}</div>
    `;

    if (dom.readDetailLeft) dom.readDetailLeft.innerHTML = leftSections.join('<div class="read-detail-divider"></div>');
    if (dom.readDetailRight) dom.readDetailRight.innerHTML = rightHtml;

    if (imageUrl && dom.readDetailRight) {
        const photo = dom.readDetailRight.querySelector('.read-detail-photo');
        if (photo) {
            photo.addEventListener('click', () => openReadPhotoModal(imageUrl));
        }
    }

    dom.modalReadDetail.classList.add('active');
    dom.modalReadDetail.classList.remove('hidden');
}

function closeReadDetailModal() {
    if (!dom.modalReadDetail) return;
    dom.modalReadDetail.classList.remove('active');
    dom.modalReadDetail.classList.add('hidden');
}

function openReadPhotoModal(src) {
    if (!dom.modalReadPhoto || !dom.readPhotoImage) return;
    dom.readPhotoImage.src = src;
    dom.modalReadPhoto.classList.add('active');
    dom.modalReadPhoto.classList.remove('hidden');
}

function closeReadPhotoModal() {
    if (!dom.modalReadPhoto || !dom.readPhotoImage) return;
    dom.readPhotoImage.src = '';
    dom.modalReadPhoto.classList.remove('active');
    dom.modalReadPhoto.classList.add('hidden');
}

function openBrowsingModal() {
    if (!dom.modalBrowsing || !dom.inputBrowsingModal) return;
    dom.inputBrowsingModal.value = dom.inputBrowsing ? dom.inputBrowsing.value : '';
    dom.modalBrowsing.classList.add('active');
    dom.modalBrowsing.classList.remove('hidden');
    dom.inputBrowsingModal.focus();
}

function closeBrowsingModal() {
    if (!dom.modalBrowsing) return;
    dom.modalBrowsing.classList.remove('active');
    dom.modalBrowsing.classList.add('hidden');
}

function commitBrowsingModal() {
    if (dom.inputBrowsing && dom.inputBrowsingModal) {
        dom.inputBrowsing.value = dom.inputBrowsingModal.value.trim();
    }
    if (dom.displayBrowsing) {
        const placeholder = '\u2014\u2014\u2014';
        const value = dom.inputBrowsing ? dom.inputBrowsing.value.trim() : '';
        dom.displayBrowsing.textContent = value || placeholder;
    }
    closeBrowsingModal();
}

function renderReadLinkList(value) {
    const text = String(value || '').trim();
    if (!text || text === '\u672a\u8a18\u5165') {
        return '<div class="read-detail-text">\u2014</div>';
    }
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return '<div class="read-detail-text">\u2014</div>';
    const links = lines.map((line) => {
        const href = /^https?:\/\//i.test(line) ? line : `https://${line}`;
        const safeHref = encodeURI(href);
        return `<a class="read-detail-link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(line)}</a>`;
    });
    return `<div class="read-detail-link-list">${links.join('')}</div>`;
}

function buildReadMetricRow(label, value) {
    return `<div><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>`;
}

function renderEntryList() {
    if (!dom.readCard) return;
    const entries = getReadEntries();
    const filtered = applyReadFilters(entries);
    appState.readFilteredEntries = filtered;
    if (!filtered.length) {
        renderReadEmpty('\u4e00\u81f4\u3059\u308b\u30b8\u30e3\u30fc\u30ca\u30eb\u304c\u3042\u308a\u307e\u305b\u3093');
        return;
    }
    if (!Number.isFinite(appState.readIndex) || appState.readIndex < 0) appState.readIndex = 0;
    if (appState.readIndex >= filtered.length) appState.readIndex = 0;
    renderReadCard(filtered[appState.readIndex]);
}

function changeCalendarMonth(delta) {
    const current = appState.calendarDate || new Date();
    appState.calendarDate = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    renderCalendar();
}

function openCalendarPicker() {
    if (!dom.calendarPickerModal) return;
    syncCalendarSelectors();
    dom.calendarPickerModal.classList.add('active');
    dom.calendarPickerModal.classList.remove('hidden');
}

function closeCalendarPicker() {
    if (!dom.calendarPickerModal) return;
    dom.calendarPickerModal.classList.remove('active');
    dom.calendarPickerModal.classList.add('hidden');
    syncCalendarFromSelectors();
}

function setupCalendarSwipe() {
    if (!dom.calendarContainer) return;
    let startX = 0;
    let startY = 0;
    let active = false;
    const threshold = 40;

    const startDrag = (x, y) => {
        startX = x;
        startY = y;
        active = true;
    };
    const endDrag = (x, y) => {
        if (!active) return;
        const dx = x - startX;
        const dy = y - startY;
        if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
            changeCalendarMonth(dx < 0 ? 1 : -1);
        }
        active = false;
    };

    dom.calendarContainer.addEventListener('touchstart', (event) => {
        if (!event.touches || event.touches.length !== 1) return;
        startDrag(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true });

    dom.calendarContainer.addEventListener('touchend', (event) => {
        if (!event.changedTouches || event.changedTouches.length === 0) return;
        endDrag(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
    }, { passive: true });

    dom.calendarContainer.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        startDrag(event.clientX, event.clientY);
    });

    dom.calendarContainer.addEventListener('pointerup', (event) => {
        endDrag(event.clientX, event.clientY);
    });

    dom.calendarContainer.addEventListener('pointercancel', () => {
        active = false;
    });

    dom.calendarContainer.addEventListener('wheel', (event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 30) {
            event.preventDefault();
            changeCalendarMonth(event.deltaX > 0 ? 1 : -1);
        }
    }, { passive: false });
}

function renderCalendar() {
    if (!dom.calendarMonthYear || !dom.calendarDaysGrid) return;
    syncCalendarSelectors();
    dom.calendarMonthYear.textContent = appState.calendarDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    dom.calendarDaysGrid.innerHTML = '';
    const y = appState.calendarDate.getFullYear(), m = appState.calendarDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const totalCells = firstDay + daysInMonth;
    const weeks = Math.ceil(totalCells / 7);
    const selectedKey = appState.calendarSelectedDate ? getDateKey(appState.calendarSelectedDate) : null;
    if (dom.calendarDaysGrid) {
        dom.calendarDaysGrid.style.gridTemplateRows = `repeat(${weeks}, minmax(72px, 1fr))`;
    }

    for (let i = 0; i < firstDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day is-empty';
        blank.setAttribute('aria-hidden', 'true');
        dom.calendarDaysGrid.appendChild(blank);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(y, m, d);
        const dateStr = dateObj.toDateString();
        const dateKey = getDateKey(dateObj);
        const entriesOnDay = appState.entries.filter(e => isFinalEntry(e) && getJournalDateKeyForEntry(getEntryDate(e)) === dateKey);
        const avg = null;

        const el = document.createElement('div');
        el.className = `calendar-day ${dateStr === new Date().toDateString() ? 'today' : ''} ${entriesOnDay.length ? 'has-entry' : ''} ${selectedKey === dateKey ? 'selected' : ''}`;
        // Keep calendar day appearance consistent regardless of photo.

        el.innerHTML = `<span class="day-number">${d}</span>`;
        el.onclick = () => {
            appState.calendarSelectedDate = new Date(y, m, d);
            updateCalendarSidePanel(appState.calendarSelectedDate);
            renderCalendar();
        };
        dom.calendarDaysGrid.appendChild(el);
    }
    const trailing = weeks * 7 - totalCells;
    for (let i = 0; i < trailing; i += 1) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day is-empty';
        blank.setAttribute('aria-hidden', 'true');
        dom.calendarDaysGrid.appendChild(blank);
    }
    renderMonthlyGoal();
    updateCalendarSidePanel(appState.calendarSelectedDate || appState.calendarDate);
}

function syncCalendarSelectors() {
    if (!dom.selectCalendarYear || !dom.selectCalendarMonth) return;
    const currentYear = appState.calendarDate.getFullYear();
    const currentMonth = appState.calendarDate.getMonth() + 1;

    const hasYearOption = Array.from(dom.selectCalendarYear.options).some(opt => Number(opt.value) === currentYear);
    if (!hasYearOption) {
        dom.selectCalendarYear.innerHTML = '';
        const start = currentYear - 50;
        const end = currentYear + 50;
        for (let y = start; y <= end; y++) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = `${y}\u5e74`;
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
    if (!dom.monthlyGoalText) return;
    const date = appState.calendarDate || new Date();
    const key = getMonthlyGoalKey(date);
    const goals = (appState.userProfile && appState.userProfile.monthlyGoals) ? appState.userProfile.monthlyGoals : {};
    const text = goals[key] || '';
    if (!appState.user) {
        dom.monthlyGoalText.value = '';
        dom.monthlyGoalText.placeholder = 'ログインすると編集できます';
        dom.monthlyGoalText.readOnly = true;
        if (dom.btnEditMonthlyGoal) dom.btnEditMonthlyGoal.disabled = true;
    } else {
        dom.monthlyGoalText.value = text;
        dom.monthlyGoalText.placeholder = '今月の目標を入力';
        dom.monthlyGoalText.readOnly = !appState.monthlyGoalEditing;
        if (dom.btnEditMonthlyGoal) {
            dom.btnEditMonthlyGoal.disabled = false;
            dom.btnEditMonthlyGoal.textContent = appState.monthlyGoalEditing ? '保存' : '編集';
        }
    }
    updateMonthlyGoalProgress(date);
}

function updateMonthlyGoalProgress(targetDate) {
    if (!dom.monthlyGoalJourney || !dom.monthlyGoalDot) return;
    const date = targetDate || appState.calendarDate || new Date();
    const today = new Date();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    let progress = 0;
    const isSameMonth = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    if (isSameMonth) {
        progress = (today.getDate() - 1) / Math.max(1, daysInMonth - 1);
    } else if (date < new Date(today.getFullYear(), today.getMonth(), 1)) {
        progress = 1;
    } else {
        progress = 0;
    }
    const flagOffset = 36;
    const width = dom.monthlyGoalJourney.clientWidth || 0;
    const lineWidth = Math.max(0, width - flagOffset);
    const leftPx = Math.round(lineWidth * Math.min(Math.max(progress, 0), 1));
    dom.monthlyGoalDot.style.left = `${leftPx}px`;
}

async function editMonthlyGoal() {
    if (!appState.user) {
        showToast('ログインしてください', 'error');
        return;
    }
    if (!dom.monthlyGoalText) return;
    if (!appState.monthlyGoalEditing) {
        appState.monthlyGoalEditing = true;
        renderMonthlyGoal();
        dom.monthlyGoalText.focus();
        return;
    }
    const date = appState.calendarDate || new Date();
    const key = getMonthlyGoalKey(date);
    const goals = { ...(appState.userProfile?.monthlyGoals || {}) };
    const value = dom.monthlyGoalText.value.trim();
    if (value) {
        goals[key] = value;
    } else {
        delete goals[key];
    }
    await saveUserProfile({ monthlyGoals: goals });
    appState.monthlyGoalEditing = false;
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

function formatDateTime(isoStr) {
    const d = toDateValue(isoStr) || new Date();
    const datePart = d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
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

function truncateText(value, limit = 60) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, Math.max(limit - 1, 1))}…`;
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
        const headers = { 'Content-Type': 'application/json' };
        if (options.useAuth) {
            const currentUser = window.auth?.currentUser || appState.user;
            if (!currentUser) throw new Error('auth_required');
            const token = await currentUser.getIdToken();
            headers.Authorization = `Bearer ${token}`;
        }
        res = await fetch(`${base}${path}`, {
            method: 'POST',
            headers,
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

function renderThemePicker() {
    if (!dom.themePicker) return;
    dom.themePicker.innerHTML = THEME_PRESETS.map((theme) => `
        <button type="button" class="theme-option" data-theme="${theme.id}">
            <div class="theme-swatch">
                ${theme.colors.map((color) => `<span style="background:${color};"></span>`).join('')}
            </div>
            <div class="theme-name">${theme.label}</div>
        </button>
    `).join('');
    updateThemePickerActive();
}

function updateThemePickerActive() {
    if (!dom.themePicker) return;
    const activeTheme = appState.theme || 'cafe';
    dom.themePicker.querySelectorAll('.theme-option').forEach((button) => {
        button.classList.toggle('active', button.dataset.theme === activeTheme);
    });
}

function setTheme(themeId) {
    const nextTheme = normalizeThemeId(themeId);
    appState.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
    updateThemePickerActive();
}

// --- Theme ---
window.applyTheme = function (theme) {
    const normalized = normalizeThemeId(theme);
    document.documentElement.setAttribute('data-theme', normalized);
    if (document.body) document.body.setAttribute('data-theme', normalized);
    if (dom.btnThemeToggle) dom.btnThemeToggle.innerHTML = '<i class="fa-solid fa-palette"></i>';
    updateThemePickerActive();
}
const applyTheme = window.applyTheme; // local alias logic

function applyWallpaper(url) {
    const value = url ? `url("${url}")` : 'none';
    document.documentElement.style.setProperty('--app-wallpaper', value);
}

async function handleWallpaperUpload(file) {
    if (!appState.user) {
        showToast('ログインしてからアップロードしてください', 'error');
        return;
    }
    if (!file) return;
    if (file.type !== 'image/webp') {
        showToast('WebP形式の画像のみ対応しています', 'error');
        return;
    }
    if (file.size > 1024 * 1024) {
        showToast('1MB以下の画像を選択してください', 'error');
        return;
    }
    const storage = window.storage;
    if (!storage) {
        showToast('Storageが利用できません', 'error');
        return;
    }
    try {
        const ref = storage.ref().child(`wallpapers/${appState.user.uid}.webp`);
        await ref.put(file, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
        const url = await ref.getDownloadURL();
        await saveUserProfile({ wallpaperUrl: url });
        applyWallpaper(url);
        renderSettingsPage();
        showToast('壁紙を更新しました');
    } catch (err) {
        console.warn('wallpaper upload failed', err);
        showToast('壁紙のアップロードに失敗しました', 'error');
    }
}

async function handleWallpaperRemove() {
    if (!appState.user) return;
    const storage = window.storage;
    try {
        if (storage) {
            const ref = storage.ref().child(`wallpapers/${appState.user.uid}.webp`);
            await ref.delete();
        }
    } catch (err) {
        console.warn('wallpaper delete failed', err);
    }
    await saveUserProfile({ wallpaperUrl: '' });
    applyWallpaper('');
    renderSettingsPage();
    showToast('壁紙を削除しました');
}

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
        alert('\u30a2\u30d7\u30ea\u306e\u8d77\u52d5\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ' + e.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
} else {
    safeInit();
}
