import express from 'express';
import admin from 'firebase-admin';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const ANALYSIS_VERSION = 'soos-v1';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS || 6000);
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS || 5000);
const FIRESTORE_WRITE_TIMEOUT_MS = Number(process.env.FIRESTORE_WRITE_TIMEOUT_MS || 1500);
const SIMILAR_QUERY_TIMEOUT_MS = Number(process.env.SIMILAR_QUERY_TIMEOUT_MS || 1500);
const SCREENING_VERSION = 'screening-v1';
const PERSONA_REPORT_PROMPT_VER = 'persona-ai-v2-mbti';
const PERSONA_DIAGNOSIS_VERSION_ID = 'v1.0';
const SCREENING_CATEGORY = 'screening';
const SCREENING_INSTRUMENT_ADHD = 'adhd_adult_v1';
const SCREENING_INSTRUMENT_PERSONA = 'persona_5layer_v1';
const ADHD_CORE_MIN_RATE = 0.7;
const ADHD_MAX_SCORE_PER_ITEM = 4;
const PERSONA_LAYER_ORDER = ['soc', 'cog', 'act', 'emo', 'mot'];
const PERSONA_LAYER_DOC_IDS = {
  soc: 'SOC',
  cog: 'COG',
  act: 'ACT',
  emo: 'EMO',
  mot: 'MOT'
};
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
  const list = [];
  PERSONA_LAYER_ORDER.forEach((layerKey, layerIndex) => {
    const layerDef = PERSONA_LAYER_DEFINITIONS[layerKey];
    if (!layerDef || !Array.isArray(layerDef.axes)) return;
    const fixedBank = PERSONA_FIXED_LAYER_BANKS[layerKey];
    if (Array.isArray(fixedBank) && fixedBank.length) {
      fixedBank.forEach((seed, index) => {
        const axis = layerDef.axes.find((item) => item.code === seed.axisCode);
        if (!axis) return;
        list.push({
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
        list.push({
          id: `p5_${layerKey}_${axisDef.key}_${String(questionIndex + 1).padStart(2, '0')}`,
          layer: layerKey,
          axisKey: axisDef.key,
          reverseScored: template.reverse === true,
          order: (layerIndex + 1) * 1000 + (axisIndex + 1) * 10 + (questionIndex + 1),
          body: template.build(axisDef)
        });
      });
    });
  });
  return list;
}

const PERSONA_BASELINE_QUESTIONS = buildPersonaBaselineQuestions();
const PERSONA_BASELINE_BY_ID = PERSONA_BASELINE_QUESTIONS.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

function initAdmin() {
  if (admin.apps.length) return;
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    return;
  }
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

initAdmin();
const db = admin.firestore();

function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function hashEmbedding(text, size = 64) {
  const vec = new Array(size).fill(0);
  const normalized = String(text || '').toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    vec[i % size] += (code % 31) / 31;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + (v * v), 0)) || 1;
  return vec.map((v) => v / norm);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function average(values) {
  if (!Array.isArray(values) || !values.length) return null;
  const sum = values.reduce((acc, item) => acc + item, 0);
  return sum / values.length;
}

function stddev(values) {
  if (!Array.isArray(values) || values.length <= 1) return 0;
  const avg = average(values) || 0;
  const variance = values.reduce((acc, item) => acc + ((item - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function parseHours(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes(':')) {
    const [hourRaw, minuteRaw] = raw.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour + (minute / 60);
  }
  if (raw.includes('時間') || raw.includes('分')) {
    const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*時間/);
    const minuteMatch = raw.match(/(\d+(?:\.\d+)?)\s*分/);
    const hour = hourMatch ? Number(hourMatch[1]) : 0;
    const minute = minuteMatch ? Number(minuteMatch[1]) : 0;
    const total = hour + (minute / 60);
    return Number.isFinite(total) ? total : null;
  }
  const direct = Number(raw);
  return Number.isFinite(direct) ? direct : null;
}

function normalizeQuestionOptions(options) {
  if (!options) return [];
  const list = Array.isArray(options) ? options : String(options).split('\n');
  return list
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeOptionScores(optionScores, optionCount) {
  const source = Array.isArray(optionScores) ? optionScores.map((item) => Number(item)) : [];
  if (source.length === optionCount && source.every((item) => Number.isFinite(item))) {
    return source;
  }
  if (optionCount === 5) return [0, 1, 2, 3, 4];
  if (optionCount <= 1) return [];
  const max = optionCount - 1;
  return Array.from({ length: optionCount }, (_, index) => Math.round((index / max) * 4));
}

function normalizeScreeningDimension(value) {
  if (value === 'inattention') return 'inattention';
  if (value === 'hyperactivity') return 'hyperactivity';
  return '';
}

function normalizePersonaLayer(value) {
  const raw = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PERSONA_LAYER_LABELS, raw) ? raw : '';
}

function normalizePersonaAxisKey(layer, value) {
  const normalizedLayer = normalizePersonaLayer(layer);
  if (!normalizedLayer) return '';
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const axisList = PERSONA_LAYER_DEFINITIONS[normalizedLayer]?.axes || [];
  const found = axisList.find((axis) => String(axis.key || '').toLowerCase() === raw);
  return found ? String(found.key).toLowerCase() : '';
}

function normalizeQuestionDoc(doc) {
  const data = doc.data() || {};
  const category = data.category === SCREENING_CATEGORY ? SCREENING_CATEGORY : 'normal';
  const type = category === SCREENING_CATEGORY ? 'choice' : (data.type === 'choice' ? 'choice' : 'text');
  let options = normalizeQuestionOptions(data.options || data.choices || []);
  if (category === SCREENING_CATEGORY && options.length !== 5) {
    options = ['まったく当てはまらない', 'あまり当てはまらない', 'どちらでもない', 'やや当てはまる', '非常に当てはまる'];
  }
  return {
    id: doc.id,
    category,
    instrumentId: category === SCREENING_CATEGORY
      ? String(data.instrumentId || SCREENING_INSTRUMENT_ADHD).trim()
      : '',
    dimension: category === SCREENING_CATEGORY
      ? normalizeScreeningDimension(data.dimension)
      : '',
    isCore: category === SCREENING_CATEGORY ? data.isCore !== false : false,
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
    type,
    options,
    optionScores: normalizeOptionScores(data.optionScores, options.length),
    layer: category === SCREENING_CATEGORY
      ? normalizePersonaLayer(data.layer || '')
      : '',
    axisKey: category === SCREENING_CATEGORY
      ? normalizePersonaAxisKey(data.layer || '', data.axisKey || '')
      : '',
    reverseScored: category === SCREENING_CATEGORY ? data.reverseScored === true : false,
    isActive: data.isActive !== false
  };
}

function getChoiceScore(question, answerData) {
  if (!question || question.type !== 'choice') return null;
  const rawScore = toNumber(answerData.choiceScore);
  if (rawScore != null) return clamp(rawScore, 0, ADHD_MAX_SCORE_PER_ITEM);
  const choiceValue = String(answerData.choiceValue || answerData.body || '').trim();
  if (!choiceValue) return null;
  const optionIndex = question.options.findIndex((option) => String(option).trim() === choiceValue);
  if (optionIndex < 0) return null;
  const score = toNumber(question.optionScores[optionIndex]);
  return score == null ? null : clamp(score, 0, ADHD_MAX_SCORE_PER_ITEM);
}

function toUtcToken(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') {
    try {
      return Number(value.toMillis()) || 0;
    } catch (_err) {
      return 0;
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildAxisScoresForLayerResult(axisTable) {
  const scores = {};
  (Array.isArray(axisTable) ? axisTable : []).forEach((row) => {
    if (!row || !row.axisCode) return;
    const score = clamp(Number(row.score) || 0, 0, 100);
    scores[row.axisCode] = {
      axisId: String(row.axisCode),
      axisKey: String(row.axisKey || '').toLowerCase(),
      leftLabel: String(row.leftLabel || ''),
      rightLabel: String(row.rightLabel || ''),
      score0to100: Number(score.toFixed(1)),
      avg1to5: Number((1 + (score / 100) * 4).toFixed(3)),
      strength: getAxisStrengthBucket(score),
      answeredItems: Number(row.answeredItems) || 0
    };
  });
  return scores;
}

function reportsEqual(left, right) {
  if (!left || !right) return false;
  const leftKey = JSON.stringify({
    title: left.title,
    overview: left.overview,
    keyTraits: normalizeReportList(left.keyTraits),
    hiddenSides: normalizeReportList(left.hiddenSides),
    gapInsight: left.gapInsight,
    strengths: normalizeReportList(left.strengths),
    cautions: normalizeReportList(left.cautions),
    actionHints: normalizeReportList(left.actionHints),
    notice: left.notice,
    axisSignature: left.meta?.axisSignature || ''
  });
  const rightKey = JSON.stringify({
    title: right.title,
    overview: right.overview,
    keyTraits: normalizeReportList(right.keyTraits),
    hiddenSides: normalizeReportList(right.hiddenSides),
    gapInsight: right.gapInsight,
    strengths: normalizeReportList(right.strengths),
    cautions: normalizeReportList(right.cautions),
    actionHints: normalizeReportList(right.actionHints),
    notice: right.notice,
    axisSignature: right.meta?.axisSignature || ''
  });
  return leftKey === rightKey;
}

async function syncPersonaLayerReports(userId, persona5Profile) {
  if (!userId || !persona5Profile || typeof persona5Profile !== 'object') return;
  const layers = persona5Profile.layers && typeof persona5Profile.layers === 'object'
    ? persona5Profile.layers
    : {};
  const resultsRef = db.collection('users').doc(userId).collection('layer_results');

  for (const layerKey of PERSONA_LAYER_ORDER) {
    const layerInfo = layers[layerKey];
    if (!layerInfo || layerInfo.status !== 'ready' || !layerInfo.analysis) continue;
    const layerId = PERSONA_LAYER_DOC_IDS[layerKey] || String(layerKey || '').toUpperCase();
    const snapshot = await resultsRef.where('layerId', '==', layerId).get();
    const docs = snapshot.docs || [];
    let targetDoc = null;
    if (docs.length) {
      targetDoc = docs
        .slice()
        .sort((left, right) => {
          const leftData = left.data() || {};
          const rightData = right.data() || {};
          const leftTime = toMillis(leftData.completedAt) || toMillis(leftData.updatedAt);
          const rightTime = toMillis(rightData.completedAt) || toMillis(rightData.updatedAt);
          return rightTime - leftTime;
        })[0];
    }

    const nextReport = withLegacyPersonaFields({
      ...(layerInfo.analysis || {}),
      promptVer: PERSONA_REPORT_PROMPT_VER,
      generatedAt: new Date().toISOString(),
      meta: {
        ...(layerInfo.analysis?.meta || {}),
        axisSignature: buildPersonaAxisSignature(layerInfo.axisTable || [])
      }
    });
    const axisScores = buildAxisScoresForLayerResult(layerInfo.axisTable || []);
    const nowIso = new Date().toISOString();

    if (!targetDoc) {
      const docId = `${layerId}_${Date.now()}`;
      await resultsRef.doc(docId).set({
        layerId,
        versionId: PERSONA_DIAGNOSIS_VERSION_ID,
        axisScores,
        aiReportLatest: nextReport,
        aiReportHistory: [],
        aiReportUpdatedAt: nowIso,
        completedAt: nowIso
      }, { merge: true });
      continue;
    }

    const currentData = targetDoc.data() || {};
    const currentLatest = currentData.aiReportLatest && typeof currentData.aiReportLatest === 'object'
      ? currentData.aiReportLatest
      : null;
    const currentHistory = Array.isArray(currentData.aiReportHistory)
      ? currentData.aiReportHistory.filter((item) => item && typeof item === 'object')
      : [];
    const nextHistory = [...currentHistory];
    if (currentLatest && !reportsEqual(currentLatest, nextReport)) {
      nextHistory.unshift(currentLatest);
    }
    await targetDoc.ref.set({
      versionId: PERSONA_DIAGNOSIS_VERSION_ID,
      axisScores,
      aiReportLatest: nextReport,
      aiReportHistory: nextHistory.slice(0, 20),
      aiReportUpdatedAt: nowIso
    }, { merge: true });
  }
}

async function getRequestUserId(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('missing_auth_token');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new Error('missing_auth_token');
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

async function getRequestAuthInfo(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('missing_auth_token');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) throw new Error('missing_auth_token');
  const decoded = await admin.auth().verifyIdToken(token);
  return { uid: decoded.uid, email: String(decoded.email || '').toLowerCase() };
}

const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || 'qutech314@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').toLowerCase());
}

async function loadScreeningQuestions() {
  let snapshot;
  try {
    snapshot = await db.collection('questions')
      .where('category', '==', SCREENING_CATEGORY)
      .where('instrumentId', '==', SCREENING_INSTRUMENT_ADHD)
      .where('isCore', '==', true)
      .get();
  } catch (_err) {
    snapshot = await db.collection('questions').get();
  }

  const list = snapshot.docs
    .map((doc) => normalizeQuestionDoc(doc))
    .filter((question) => question.isActive !== false)
    .filter((question) => question.category === SCREENING_CATEGORY)
    .filter((question) => question.instrumentId === SCREENING_INSTRUMENT_ADHD)
    .filter((question) => question.isCore);

  list.sort((left, right) => left.order - right.order);
  return list;
}

async function loadAnswersForUser(userId) {
  const docsMap = new Map();
  const snapshots = [];
  try {
    snapshots.push(await db.collection('answers').where('userId', '==', userId).get());
  } catch (_err) {
    // ignore
  }
  try {
    snapshots.push(await db.collection('answers').where('user_id', '==', userId).get());
  } catch (_err) {
    // ignore
  }
  snapshots.forEach((snapshot) => {
    snapshot.forEach((doc) => docsMap.set(doc.id, doc));
  });
  return Array.from(docsMap.values()).map((doc) => ({
    id: doc.id,
    ...(doc.data() || {})
  }));
}

async function loadDiaryEntriesForUser(userId) {
  const snapshots = [];
  try {
    snapshots.push(await db.collection('diary_entries').where('userId', '==', userId).get());
  } catch (_err) {
    // ignore
  }
  try {
    snapshots.push(await db.collection('diary_entries').where('user_id', '==', userId).get());
  } catch (_err) {
    // ignore
  }
  const docsMap = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.forEach((doc) => docsMap.set(doc.id, doc));
  });
  return Array.from(docsMap.values()).map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function loadDiaryAnalysisForUser(userId) {
  const snapshots = [];
  try {
    snapshots.push(await db.collection('diary_analysis').where('user_id', '==', userId).get());
  } catch (_err) {
    // ignore
  }
  try {
    snapshots.push(await db.collection('diary_analysis').where('userId', '==', userId).get());
  } catch (_err) {
    // ignore
  }
  const docsMap = new Map();
  snapshots.forEach((snapshot) => {
    snapshot.forEach((doc) => docsMap.set(doc.id, doc));
  });
  return Array.from(docsMap.values()).map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

function computeAdhdProfile(coreQuestions, answers) {
  const answersByQuestion = new Map();
  answers.forEach((answer) => {
    if (answer.questionId) answersByQuestion.set(String(answer.questionId), answer);
  });

  let total = 0;
  let inattention = 0;
  let hyperactivity = 0;
  let answeredCore = 0;
  const answeredScores = [];

  coreQuestions.forEach((question) => {
    const answer = answersByQuestion.get(question.id);
    if (!answer) return;
    const score = getChoiceScore(question, answer);
    if (score == null) return;
    answeredCore += 1;
    answeredScores.push(score);
    total += score;
    if (question.dimension === 'inattention') inattention += score;
    if (question.dimension === 'hyperactivity') hyperactivity += score;
  });

  const totalCore = coreQuestions.length;
  const completionRate = totalCore > 0 ? (answeredCore / totalCore) : 0;
  const maxPossible = Math.max(1, totalCore * ADHD_MAX_SCORE_PER_ITEM);
  const normalized0to100 = clamp(Math.round((total / maxPossible) * 100), 0, 100);
  const scoreStd = stddev(answeredScores);
  const consistency = 1 - clamp(scoreStd / 2, 0, 1);
  const confidence0to1 = clamp(completionRate * (0.55 + (0.45 * consistency)), 0, 1);
  const status = completionRate >= ADHD_CORE_MIN_RATE && totalCore > 0 ? 'ready' : 'insufficient';
  let riskBand = 'low';
  if (normalized0to100 >= 65) riskBand = 'high';
  else if (normalized0to100 >= 35) riskBand = 'moderate';

  return {
    status,
    progress: { answeredCore, totalCore },
    scores: {
      total,
      inattention,
      hyperactivity,
      normalized0to100
    },
    riskBand,
    confidence0to1: Number(confidence0to1.toFixed(2))
  };
}

function extractJournal(entry) {
  const metaJournal = entry.meta && entry.meta.journal && typeof entry.meta.journal === 'object'
    ? entry.meta.journal
    : {};
  const journal = entry.journal && typeof entry.journal === 'object'
    ? entry.journal
    : {};
  return { ...metaJournal, ...journal };
}

function clampTrait(value) {
  return Math.round(clamp(value, 0, 100));
}

function computePersonalityProfile(entries, analyses, answers, adhdProfile) {
  const diaryEntries = Array.isArray(entries) ? entries : [];
  const analysisList = Array.isArray(analyses) ? analyses : [];
  const diaryCount = diaryEntries.length;
  const scoredAnswers = Array.isArray(answers)
    ? answers.filter((answer) => Number.isFinite(toNumber(answer.choiceScore)))
    : [];
  const answerCount = scoredAnswers.length;

  const satisfactionValues = [];
  const sleepValues = [];
  const focusValues = [];
  const workoutValues = [];
  const socialSignals = [];
  const noveltySignals = [];
  const consistencySignals = [];

  diaryEntries.forEach((entry) => {
    const journal = extractJournal(entry);
    const satisfaction = toNumber(journal.satisfaction);
    const sleep = parseHours(journal.sleep);
    const focus = parseHours(journal.focus);
    const workout = parseHours(journal.workout);
    const text = String(entry.text || '').trim();
    const memo = String(journal.memo || '').trim();
    if (satisfaction != null) satisfactionValues.push(satisfaction);
    if (sleep != null) sleepValues.push(sleep);
    if (focus != null) focusValues.push(focus);
    if (workout != null) workoutValues.push(workout);
    socialSignals.push((text.match(/友達|友人|家族|同僚|恋人|会話|相談|連絡/g) || []).length);
    noveltySignals.push((text.match(/初めて|新しい|挑戦|冒険|変化|学ぶ/g) || []).length);
    consistencySignals.push((memo.match(/ルーティン|習慣|継続|毎日|安定/g) || []).length);
  });

  const negativeEmotionCount = analysisList.reduce((acc, analysis) => {
    const emotions = Array.isArray(analysis.emotions) ? analysis.emotions : [];
    return acc + emotions.filter((emotion) => ['sadness', 'fear', 'anger', 'disgust'].includes(String(emotion.label || '').toLowerCase())).length;
  }, 0);
  const positiveEmotionCount = analysisList.reduce((acc, analysis) => {
    const emotions = Array.isArray(analysis.emotions) ? analysis.emotions : [];
    return acc + emotions.filter((emotion) => ['joy', 'trust', 'anticipation'].includes(String(emotion.label || '').toLowerCase())).length;
  }, 0);
  const avoidPatternCount = analysisList.reduce((acc, analysis) => {
    const patterns = Array.isArray(analysis.patterns) ? analysis.patterns : [];
    return acc + patterns.filter((pattern) => String(pattern.pattern_id || '').toLowerCase() === 'avoidance_procrastination').length;
  }, 0);

  let selfRegulation = 50;
  let stressSensitivity = 50;
  let socialDrive = 50;
  let noveltySeeking = 50;
  let consistency = 50;

  const avgSatisfaction = average(satisfactionValues);
  const avgSleep = average(sleepValues);
  const avgFocus = average(focusValues);
  const avgWorkout = average(workoutValues);
  const avgSocial = average(socialSignals) || 0;
  const avgNovelty = average(noveltySignals) || 0;
  const avgConsistency = average(consistencySignals) || 0;
  const scoreAverage = average(scoredAnswers.map((answer) => toNumber(answer.choiceScore)).filter((value) => value != null));

  if (avgSatisfaction != null) selfRegulation += (avgSatisfaction - 5) * 6;
  if (avgSleep != null) {
    consistency += 14 - Math.min(14, Math.abs(7 - avgSleep) * 5);
    stressSensitivity += Math.max(0, (6 - avgSleep) * 4);
  }
  if (avgFocus != null) selfRegulation += (avgFocus - 2) * 6;
  if (avgWorkout != null) selfRegulation += Math.min(18, avgWorkout * 5);
  if (scoreAverage != null) {
    selfRegulation -= scoreAverage * 8;
    stressSensitivity += scoreAverage * 7;
    noveltySeeking += scoreAverage * 4;
  }
  if (adhdProfile?.status === 'ready') {
    const normalized = toNumber(adhdProfile?.scores?.normalized0to100) || 0;
    stressSensitivity += normalized * 0.08;
    selfRegulation -= normalized * 0.07;
  }
  stressSensitivity += (negativeEmotionCount - positiveEmotionCount) * 2.5;
  selfRegulation -= avoidPatternCount * 3;
  socialDrive += avgSocial * 6;
  noveltySeeking += avgNovelty * 8;
  consistency += avgConsistency * 8;
  consistency -= stddev(satisfactionValues) * 6;

  const status = diaryCount >= 3 || answerCount >= 6 ? 'ready' : 'insufficient';
  return {
    status,
    traits: {
      selfRegulation: clampTrait(selfRegulation),
      stressSensitivity: clampTrait(stressSensitivity),
      socialDrive: clampTrait(socialDrive),
      noveltySeeking: clampTrait(noveltySeeking),
      consistency: clampTrait(consistency)
    },
    evidenceCounts: {
      diaryCount,
      answerCount
    }
  };
}

function normalizeReportList(value) {
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
}

function getAxisStrengthBucket(score) {
  const value = clamp(Number(score) || 0, 0, 100);
  if (value <= 24) return 'strong_left';
  if (value <= 39) return 'mild_left';
  if (value <= 59) return 'neutral';
  if (value <= 74) return 'mild_right';
  return 'strong_right';
}

function extractJsonObject(rawText) {
  const raw = String(rawText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch (_err2) {
      return null;
    }
  }
}

function buildPersonaAxisSignature(axisTable) {
  return (Array.isArray(axisTable) ? axisTable : [])
    .map((row) => `${row.axisCode}:${Math.round(clamp(Number(row.score) || 0, 0, 100))}`)
    .join('|');
}

function buildPersonaAnalysisPayload(layerLabel, axisTable, options = {}) {
  const rows = (Array.isArray(axisTable) ? axisTable : [])
    .map((row) => {
      const score = clamp(Number(row.score) || 0, 0, 100);
      const reverseScore = clamp(100 - score, 0, 100);
      const dominantSide = score >= reverseScore ? 'right' : 'left';
      const dominantLabel = dominantSide === 'right'
        ? String(row.rightLabel || '')
        : String(row.leftLabel || '');
      const dominantPercent = Math.round(Math.max(score, reverseScore));
      return {
        axisId: String(row.axisCode || ''),
        leftLabel: String(row.leftLabel || ''),
        rightLabel: String(row.rightLabel || ''),
        score: Number(score.toFixed(1)),
        reverseScore: Number(reverseScore.toFixed(1)),
        dominantSide,
        dominantLabel,
        dominantPercent,
        strength: getAxisStrengthBucket(score)
      };
    })
    .filter((row) => row.axisId);

  const byDescending = [...rows].sort((a, b) => b.score - a.score);
  const byAscending = [...rows].sort((a, b) => a.score - b.score);
  const topAxes = byDescending.slice(0, 3);
  const bottomAxes = byAscending.slice(0, 2);

  const gaps = [];
  byDescending.forEach((highAxis, index) => {
    const lowAxis = byAscending[index];
    if (!lowAxis || highAxis.axisId === lowAxis.axisId) return;
    const diff = Math.round(Math.abs(highAxis.score - lowAxis.score));
    if (diff >= 40) {
      gaps.push({
        highAxisId: highAxis.axisId,
        lowAxisId: lowAxis.axisId,
        diff
      });
    }
  });

  const quality = {
    durationMs: toNumber(options.durationMs),
    straightLineRisk: toNumber(options.straightLineRisk),
    missingCount: Math.max(0, Number(options.missingCount) || 0)
  };

  const extremeFlags = rows
    .filter((row) => row.score >= 75 || row.score <= 25)
    .map((row) => ({
      axisId: row.axisId,
      level: row.score >= 75 ? 'strong_right' : 'strong_left'
    }));

  return {
    layerLabel,
    axisScores: rows.reduce((acc, row) => {
      acc[row.axisId] = row.score;
      return acc;
    }, {}),
    topAxes,
    bottomAxes,
    gaps,
    extremeFlags,
    quality,
    axisSignature: buildPersonaAxisSignature(rows),
    axisTable: rows
  };
}

function withLegacyPersonaFields(report) {
  const normalized = report && typeof report === 'object' ? { ...report } : {};
  const strengthsList = normalizeReportList(normalized.strengths);
  const cautionsList = normalizeReportList(normalized.cautions);
  const hintList = normalizeReportList(normalized.actionHints);
  return {
    ...normalized,
    summary: String(normalized.overview || normalized.summary || ''),
    upperAxes: normalizeReportList(normalized.keyTraits).join('\n'),
    lowerAxes: normalizeReportList(normalized.hiddenSides).join('\n'),
    gapRead: String(normalized.gapInsight || normalized.gapRead || ''),
    strengths: strengthsList,
    pitfalls: cautionsList,
    improvements: hintList,
    disclaimer: String(normalized.notice || normalized.disclaimer || '')
  };
}

function buildPersonaLayerAnalysis(layerLabel, payload) {
  const topAxis = payload.topAxes[0] || payload.axisTable[0] || null;
  const secondAxis = payload.topAxes[1] || null;
  const bottomAxis = payload.bottomAxes[0] || null;
  const gapItem = payload.gaps[0] || null;
  const title = topAxis
    ? `${layerLabel}：${topAxis.dominantLabel}を軸に進むスタイル`
    : `${layerLabel}：現在の傾向レポート`;
  const overview = [
    topAxis
      ? `あなたは${topAxis.dominantLabel}を使って状況を整えやすい傾向があります。`
      : 'このレイヤーでは、極端な偏りは少なくバランス型に近い傾向です。',
    secondAxis
      ? `特に${topAxis.axisId}（${Math.round(topAxis.score)}）と${secondAxis.axisId}（${Math.round(secondAxis.score)}）が行動の土台になりやすいです。`
      : '場面に応じて柔軟に切り替える傾向があります。',
    '数字は連続スコアです。高低そのものに優劣はありません。'
  ].join('');

  const keyTraits = payload.topAxes.slice(0, 3).map((axis) =>
    `${axis.axisId}（${Math.round(axis.score)}）が高めで、${axis.dominantLabel}を選びやすいです。例えば、迷った場面でこの軸の判断を先に使う傾向があります。`
  );
  const hiddenSides = payload.bottomAxes.slice(0, 2).map((axis) =>
    `${axis.axisId}（${Math.round(axis.score)}）は控えめです。急にこの方向を求められると、負荷を感じやすいです。`
  );
  const gapInsight = gapItem
    ? `${gapItem.highAxisId}と${gapItem.lowAxisId}の差が${gapItem.diff}ptあります。得意・不得意の切り替えがはっきり出るため、場面ごとの戦略を分けると安定します。`
    : '軸間の差は比較的穏やかです。環境に合わせてバランスよく適応しやすい状態です。';
  const strengths = [
    topAxis ? `${topAxis.dominantLabel}を使った判断が速いです。` : '状況に応じた適応がしやすいです。',
    secondAxis ? `${secondAxis.dominantLabel}との組み合わせで再現性を作りやすいです。` : '複数の選択肢を並行して扱いやすいです。',
    '自分の傾向を言語化すると、行動設計が安定しやすいです。'
  ];
  const cautions = [
    bottomAxis ? `${bottomAxis.axisId}側の行動を短時間で求められると、疲労が出やすいです。` : '極端な役割要求が続くと消耗しやすいです。',
    '調子が落ちた日は、普段の得意軸が機能しにくくなることがあります。',
    '判断を急ぐほど、いつもの偏りが強く出る場合があります。'
  ];
  const actionHints = [
    '1日の最初に「今日はどの軸を使う日か」を1つ決めてから動いてみてください。',
    '負荷が高い場面では、苦手側の軸を補うチェック項目を2つだけ用意してください。',
    '終わりに「うまくいった判断」を1行メモして、翌日の再現に使ってください。'
  ];
  const qualityNotices = [];
  if (payload.quality.missingCount > 0) {
    qualityNotices.push('未回答が残っているため、回答後に再確認してください。');
  }
  if (payload.quality.straightLineRisk != null && payload.quality.straightLineRisk >= 0.8) {
    qualityNotices.push('同じ回答が続いているため、時間を置いて再回答すると精度が上がります。');
  }
  const notice = `この分析は自己理解のための傾向表示であり、医学的な診断ではありません。${qualityNotices.join('')}`;

  return withLegacyPersonaFields({
    promptVer: PERSONA_REPORT_PROMPT_VER,
    generatedAt: new Date().toISOString(),
    title,
    overview,
    keyTraits: keyTraits.length ? keyTraits : ['大きな偏りは少なく、状況に応じて使い分ける傾向です。'],
    hiddenSides: hiddenSides.length ? hiddenSides : ['低めの軸は場面依存で動きやすく、環境で変化しやすいです。'],
    gapInsight,
    strengths,
    cautions,
    actionHints,
    notice,
    meta: {
      topAxes: payload.topAxes,
      bottomAxes: payload.bottomAxes,
      gaps: payload.gaps,
      quality: payload.quality,
      extremeFlags: payload.extremeFlags,
      axisSignature: payload.axisSignature
    }
  });
}

function sanitizePersonaLayerAnalysis(parsed, fallback, payload) {
  const safe = parsed && typeof parsed === 'object' ? parsed : {};
  const normalized = withLegacyPersonaFields({
    promptVer: PERSONA_REPORT_PROMPT_VER,
    generatedAt: new Date().toISOString(),
    title: String(safe.title || fallback.title || ''),
    overview: String(safe.overview || safe.summary || fallback.overview || ''),
    keyTraits: normalizeReportList(safe.keyTraits || safe.upperAxes).slice(0, 3),
    hiddenSides: normalizeReportList(safe.hiddenSides || safe.lowerAxes).slice(0, 2),
    gapInsight: String(safe.gapInsight || safe.gapRead || fallback.gapInsight || ''),
    strengths: normalizeReportList(safe.strengths).slice(0, 3),
    cautions: normalizeReportList(safe.cautions || safe.pitfalls).slice(0, 3),
    actionHints: normalizeReportList(safe.actionHints || safe.improvements).slice(0, 3),
    notice: String(safe.notice || safe.disclaimer || fallback.notice || ''),
    meta: {
      topAxes: payload.topAxes,
      bottomAxes: payload.bottomAxes,
      gaps: payload.gaps,
      quality: payload.quality,
      extremeFlags: payload.extremeFlags,
      axisSignature: payload.axisSignature
    }
  });

  if (!normalized.keyTraits.length) normalized.keyTraits = [...normalizeReportList(fallback.keyTraits)].slice(0, 3);
  if (!normalized.hiddenSides.length) normalized.hiddenSides = [...normalizeReportList(fallback.hiddenSides)].slice(0, 2);
  if (!normalized.strengths.length) normalized.strengths = [...normalizeReportList(fallback.strengths)].slice(0, 3);
  if (!normalized.cautions.length) normalized.cautions = [...normalizeReportList(fallback.cautions)].slice(0, 3);
  if (!normalized.actionHints.length) normalized.actionHints = [...normalizeReportList(fallback.actionHints)].slice(0, 3);
  if (!normalized.notice) normalized.notice = fallback.notice;
  if (!normalized.overview) normalized.overview = fallback.overview;
  if (!normalized.title) normalized.title = fallback.title;
  if (!normalized.gapInsight) normalized.gapInsight = fallback.gapInsight;

  return normalized;
}

async function generatePersonaLayerAnalysis(layerLabel, axisTable, options = {}) {
  const payload = buildPersonaAnalysisPayload(layerLabel, axisTable, options);
  const fallback = buildPersonaLayerAnalysis(layerLabel, payload);
  if (!GEMINI_API_KEY) return fallback;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `
System:
- あなたは日本語の自己理解レポート編集者です。
- 文体はMBTI診断ページ風。丁寧語（です・ます）で、読みやすい短文中心。
- 過度に詩的にしない。怖がらせない。医学的診断・病名断定は禁止。
- 数値の羅列は禁止。上位3軸・下位2軸・ギャップ1つを中心に説明する。
- 未完了レイヤーの推測は禁止。
- 次の固定見出し順でJSONを返す:
{
  "title": "レイヤー名＋短いキャッチコピー",
  "overview": "2〜4文",
  "keyTraits": ["上位軸の解釈1", "上位軸の解釈2", "上位軸の解釈3"],
  "hiddenSides": ["下位軸の注意1", "下位軸の注意2"],
  "gapInsight": "軸間ギャップの読み",
  "strengths": ["強み1", "強み2", "強み3"],
  "cautions": ["気をつけたい点1", "気をつけたい点2", "気をつけたい点3"],
  "actionHints": ["今日から使えるヒント1", "ヒント2", "ヒント3"],
  "notice": "診断ではない注意書き"
}

User(JSON):
${JSON.stringify(payload, null, 2)}
`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = extractJsonObject(raw);
    return sanitizePersonaLayerAnalysis(parsed, fallback, payload);
  } catch (_err) {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

async function computePersona5Profile(answers, previousLayers = {}) {
  const list = Array.isArray(answers) ? answers : [];
  const layerSamples = {};
  const layerAnswerValues = {};
  const answeredQuestionIds = new Set();
  const answeredByLayer = {};
  const totalByLayer = {};

  PERSONA_LAYER_ORDER.forEach((layerKey) => {
    layerSamples[layerKey] = {};
    layerAnswerValues[layerKey] = [];
    answeredByLayer[layerKey] = 0;
    const axisList = PERSONA_LAYER_DEFINITIONS[layerKey]?.axes || [];
    axisList.forEach((axis) => {
      layerSamples[layerKey][axis.key] = [];
    });
    totalByLayer[layerKey] = PERSONA_BASELINE_QUESTIONS.filter((question) => question.layer === layerKey).length;
  });

  list.forEach((answer) => {
    const seed = PERSONA_BASELINE_BY_ID[String(answer.questionId || '').trim()] || null;
    const instrumentId = String(answer.instrumentId || '').trim();
    const isPersonaAnswer = instrumentId === SCREENING_INSTRUMENT_PERSONA || !!seed;
    if (!isPersonaAnswer) return;
    const layer = normalizePersonaLayer(answer.layer || seed?.layer || '');
    if (!layer) return;
    const axisKey = normalizePersonaAxisKey(layer, answer.axisKey || seed?.axisKey || '');
    if (!axisKey) return;
    let answerValue = toNumber(answer.choiceScore);
    if (answerValue == null) {
      const choiceValue = String(answer.choiceValue || answer.body || '').trim();
      if (!choiceValue) return;
      const fallbackIndex = ['まったく当てはまらない', 'あまり当てはまらない', 'どちらでもない', 'やや当てはまる', '非常に当てはまる']
        .findIndex((option) => option === choiceValue);
      if (fallbackIndex < 0) return;
      answerValue = fallbackIndex + 1;
    } else if (answerValue >= 0 && answerValue <= 4) {
      // Legacy 0..4 score compatibility
      answerValue += 1;
    }
    const bounded = clamp(answerValue, 1, 5);
    layerAnswerValues[layer].push(bounded);
    const reverseScored = answer.reverseScored === true || seed?.reverseScored === true;
    const oriented = reverseScored ? (6 - bounded) : bounded;
    const normalized = clamp(((oriented - 1) / 4) * 100, 0, 100);
    layerSamples[layer][axisKey].push(normalized);
    if (seed && !answeredQuestionIds.has(seed.id)) {
      answeredQuestionIds.add(seed.id);
      answeredByLayer[layer] += 1;
    }
  });

  const layers = {};
  let answeredCore = 0;
  let totalCore = 0;

  for (const layerKey of PERSONA_LAYER_ORDER) {
    const layerDef = PERSONA_LAYER_DEFINITIONS[layerKey];
    const axisList = layerDef?.axes || [];
    const axisTable = axisList.map((axis) => {
      const samples = layerSamples[layerKey]?.[axis.key] || [];
      const rawAverage = samples.length
        ? samples.reduce((sum, value) => sum + value, 0) / samples.length
        : 50;
      const score = Number(clamp(rawAverage, 0, 100).toFixed(1));
      const leftScore = Math.round(100 - score);
      const rightScore = Math.round(score);
      const dominantSide = rightScore >= leftScore ? 'right' : 'left';
      const dominantLabel = dominantSide === 'right' ? axis.right : axis.left;
      const dominantPercent = dominantSide === 'right' ? rightScore : leftScore;
      return {
        axisCode: axis.code,
        axisKey: axis.key,
        label: `${axis.left} ⇄ ${axis.right}`,
        leftLabel: axis.left,
        rightLabel: axis.right,
        score,
        leftScore,
        rightScore,
        dominantSide,
        dominantLabel,
        dominantPercent,
        answeredItems: samples.length
      };
    });

    const answeredLayerCore = Number(answeredByLayer[layerKey] || 0);
    const totalLayerCore = Number(totalByLayer[layerKey] || 0);
    const answeredAxes = axisTable.filter((axis) => axis.answeredItems > 0).length;
    const totalAxes = axisTable.length;
    const completionRate = totalLayerCore > 0 ? answeredLayerCore / totalLayerCore : 0;
    const layerStatus = answeredLayerCore >= totalLayerCore && totalLayerCore > 0 ? 'ready' : 'insufficient';
    const answerValues = layerAnswerValues[layerKey] || [];
    const uniqueAnswerCount = new Set(answerValues.map((value) => Math.round(value))).size;
    const straightLineRisk = answerValues.length
      ? Number(clamp((answerValues.length - uniqueAnswerCount) / answerValues.length, 0, 1).toFixed(2))
      : null;
    const missingCount = Math.max(0, totalLayerCore - answeredLayerCore);
    const axisSignature = buildPersonaAxisSignature(axisTable);
    const previousLayer = previousLayers && typeof previousLayers === 'object'
      ? previousLayers[layerKey]
      : null;
    const previousAnalysis = previousLayer && typeof previousLayer.analysis === 'object'
      ? previousLayer.analysis
      : null;
    const reusePreviousAnalysis = !!(
      previousAnalysis
      && previousAnalysis.promptVer === PERSONA_REPORT_PROMPT_VER
      && previousAnalysis.meta
      && previousAnalysis.meta.axisSignature === axisSignature
    );
    const analysis = layerStatus === 'ready'
      ? (reusePreviousAnalysis
        ? previousAnalysis
        : await generatePersonaLayerAnalysis(PERSONA_LAYER_LABELS[layerKey] || layerKey, axisTable, {
          missingCount,
          straightLineRisk,
          durationMs: null
        }))
      : null;

    layers[layerKey] = {
      layerLabel: PERSONA_LAYER_LABELS[layerKey] || layerKey,
      status: layerStatus,
      progress: {
        answeredCore: answeredLayerCore,
        totalCore: totalLayerCore,
        answeredAxes,
        totalAxes
      },
      confidence0to1: Number(clamp(completionRate, 0, 1).toFixed(2)),
      axisTable,
      promptVer: analysis?.promptVer || PERSONA_REPORT_PROMPT_VER,
      analysis
    };

    answeredCore += answeredLayerCore;
    totalCore += totalLayerCore;
  }

  const readyLayers = PERSONA_LAYER_ORDER.filter((layerKey) => layers[layerKey]?.status === 'ready').length;
  const status = readyLayers === PERSONA_LAYER_ORDER.length ? 'ready' : 'insufficient';
  return {
    status,
    progress: {
      answeredCore,
      totalCore
    },
    layers
  };
}

function buildScreeningNotice() {
  return 'この結果は医療診断ではありません。気になる症状が続く場合は専門機関に相談してください。回答数が不足している場合は判定精度が低下します。5レイヤー分析は自己理解を目的とした傾向表示です。';
}

function withTimeout(promise, ms, label) {
  if (!ms || ms <= 0) return promise;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(label || 'timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function computeEmbedding(text) {
  if (!GEMINI_API_KEY) return hashEmbedding(text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] }
      }),
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Embedding API Error: ${res.status}`);
    }
    const data = await res.json();
    return data.embedding?.values || hashEmbedding(text);
  } catch (err) {
    return hashEmbedding(text);
  } finally {
    clearTimeout(timer);
  }
}

function basicAnalysis(text) {
  const raw = String(text || '').trim();
  const sentences = raw.split(/\n|。|\.|!/).filter(Boolean);
  const facts = sentences.slice(0, 2).map((s) => s.trim()).filter(Boolean);
  const story = sentences.slice(2, 5).map((s) => s.trim()).filter(Boolean);
  const triggers = raw.replace(/[^\w\u3040-\u30ff\u4e00-\u9faf\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1).slice(0, 5);

  return {
    facts,
    story,
    emotions: [{
      label: 'joy',
      intensity_0_100: 45,
      certainty_0_1: 0.3,
      valence: 'positive',
      arousal: 'medium'
    }],
    patterns: [{
      pattern_id: 'jump_to_conclusion',
      label: '結論の飛躍',
      confidence_0_1: 0.25,
      evidence_quotes: sentences.slice(0, 1)
    }],
    triggers,
    observation_comment: '観察: いくつかの出来事が一つの結論にまとめられている可能性があります。'
  };
}

async function analyzeWithGemini(text) {
  if (!GEMINI_API_KEY) return basicAnalysis(text);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `
You are a professional counselor. Extract structured observations only. No diagnosis or definitive labels. Use observational language.
Return JSON only with this schema:
{
  "facts": ["..."],
  "story": ["..."],
  "emotions": [{"label":"joy","intensity_0_100":0,"certainty_0_1":0,"valence":"positive|negative|mixed","arousal":"low|medium|high"}],
  "patterns": [{"pattern_id":"jump_to_conclusion","label":"結論の飛躍","confidence_0_1":0,"evidence_quotes":["..."]}],
  "triggers": ["..."],
  "observation_comment": "..."
}
Constraints:
- No medical diagnosis.
- Avoid definitive language.
- Always include certainty/confidence fields.
- Output facts/story/observation_comment/patterns.label/evidence_quotes/triggers in Japanese.
- emotions.label must be one of: joy, trust, fear, surprise, sadness, disgust, anger, anticipation.
- patterns.pattern_id must be one of: jump_to_conclusion, overgeneralization, black_and_white, emotional_reasoning, self_blame, mind_reading, catastrophizing, magnification_minimization, should_statements, negative_filter, comparison_inferiority, avoidance_procrastination.
- patterns.label must be the exact Japanese label for its pattern_id:
  jump_to_conclusion: 結論の飛躍
  overgeneralization: 過度の一般化
  black_and_white: 白黒思考
  emotional_reasoning: 感情で決めつけ
  self_blame: 自己否定
  mind_reading: 他者の意図の読みすぎ
  catastrophizing: 未来の悲観
  magnification_minimization: 拡大・過小評価
  should_statements: べき思考
  negative_filter: ネガティブ抽出
  comparison_inferiority: 比較・劣等感
  avoidance_procrastination: 回避・先延ばし

Diary:
<DIARY>
${text}
</DIARY>
`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Analysis API Error: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
      story: Array.isArray(parsed.story) ? parsed.story : [],
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      triggers: Array.isArray(parsed.triggers) ? parsed.triggers : [],
      observation_comment: parsed.observation_comment || ''
    };
  } catch (err) {
    return basicAnalysis(text);
  } finally {
    clearTimeout(timer);
  }
}

async function findSimilarEntries(userId, entryId, embedding, limit = 3) {
  const snapshot = await withTimeout(
    db.collection('diary_embeddings').where('user_id', '==', userId).get(),
    SIMILAR_QUERY_TIMEOUT_MS,
    'similar_query_timeout'
  );
  const scored = [];
  snapshot.forEach((doc) => {
    if (doc.id === entryId) return;
    const data = doc.data();
    if (!Array.isArray(data.embedding)) return;
    const score = cosineSimilarity(embedding, data.embedding);
    scored.push({ entry_id: doc.id, score });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

app.get('/api/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { entry_id, user_id, text, created_at } = req.body || {};
    if (!entry_id || !user_id || !text) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const [analysis, embedding] = await Promise.all([
      withTimeout(analyzeWithGemini(text), ANALYSIS_TIMEOUT_MS, 'analysis_timeout')
        .catch(() => basicAnalysis(text)),
      withTimeout(computeEmbedding(text), EMBEDDING_TIMEOUT_MS, 'embedding_timeout')
        .catch(() => hashEmbedding(text))
    ]);

    const analysisDoc = {
      entry_id,
      user_id,
      analysis_version: ANALYSIS_VERSION,
      facts: analysis.facts || [],
      story: analysis.story || [],
      emotions: analysis.emotions || [],
      patterns: analysis.patterns || [],
      triggers: analysis.triggers || [],
      observation_comment: analysis.observation_comment || '',
      created_at: created_at || new Date().toISOString()
    };

    let analysisSaved = false;
    let embeddingSaved = false;
    let analysisError = null;
    let embeddingError = null;

    const [analysisWrite, embeddingWrite] = await Promise.allSettled([
      withTimeout(
        db.collection('diary_analysis').doc(entry_id).set(analysisDoc, { merge: true }),
        FIRESTORE_WRITE_TIMEOUT_MS,
        'analysis_write_timeout'
      ),
      withTimeout(
        db.collection('diary_embeddings').doc(entry_id).set({
          entry_id,
          user_id,
          embedding,
          created_at: new Date().toISOString()
        }, { merge: true }),
        FIRESTORE_WRITE_TIMEOUT_MS,
        'embedding_write_timeout'
      )
    ]);

    analysisSaved = analysisWrite.status === 'fulfilled';
    embeddingSaved = embeddingWrite.status === 'fulfilled';
    if (!analysisSaved) analysisError = analysisWrite.reason?.message || 'analysis_save_failed';
    if (!embeddingSaved) embeddingError = embeddingWrite.reason?.message || 'embedding_save_failed';

    try {
      await withTimeout(
        db.collection('diary_entries').doc(entry_id).set({
          meta: {
            analysis_status: 'complete',
            analysis_version: ANALYSIS_VERSION
          }
        }, { merge: true }),
        1000,
        'meta_write_timeout'
      );
    } catch (err) {
      // Non-fatal metadata update
    }

    let similar = [];
    try {
      similar = await findSimilarEntries(user_id, entry_id, embedding, 3);
    } catch (err) {
      similar = [];
    }

    res.json({
      analysis: analysisDoc,
      embedding,
      similar,
      analysis_saved: analysisSaved,
      embedding_saved: embeddingSaved,
      analysis_error: analysisError,
      embedding_error: embeddingError
    });
  } catch (err) {
    res.status(500).json({ error: 'analysis_failed' });
  }
});

app.post('/api/analyze-lite', (req, res) => {
  try {
    const { entry_id, user_id, text, created_at } = req.body || {};
    if (!entry_id || !user_id || !text) {
      return res.status(400).json({ error: 'missing required fields' });
    }

    const analysis = basicAnalysis(text);
    const embedding = hashEmbedding(text);
    const analysisDoc = {
      entry_id,
      user_id,
      analysis_version: ANALYSIS_VERSION,
      facts: analysis.facts || [],
      story: analysis.story || [],
      emotions: analysis.emotions || [],
      patterns: analysis.patterns || [],
      triggers: analysis.triggers || [],
      observation_comment: analysis.observation_comment || '',
      created_at: created_at || new Date().toISOString()
    };

    res.json({ analysis: analysisDoc, embedding, similar: [], analysis_saved: false, embedding_saved: false });
  } catch (err) {
    res.status(500).json({ error: 'analysis_failed' });
  }
});

app.post('/api/similar', async (req, res) => {
  try {
    const { entry_id, user_id, limit } = req.body || {};
    if (!entry_id || !user_id) {
      return res.status(400).json({ error: 'missing required fields' });
    }
    const embedDoc = await db.collection('diary_embeddings').doc(entry_id).get();
    if (!embedDoc.exists) {
      return res.json({ similar: [] });
    }
    const data = embedDoc.data();
    const embedding = data.embedding || [];
    const similar = await findSimilarEntries(user_id, entry_id, embedding, limit || 3);
    res.json({ similar });
  } catch (err) {
    res.status(500).json({ error: 'similar_failed' });
  }
});

app.post('/api/screening/recompute', async (req, res) => {
  let authUid = '';
  try {
    authUid = await getRequestUserId(req);
  } catch (err) {
    const reason = err && err.message ? String(err.message) : 'unknown';
    console.warn('[screening] auth failed:', reason);
    return res.status(401).json({ error: 'unauthorized', reason });
  }

  const requestedUserId = String(req.body?.user_id || '').trim() || authUid;
  if (requestedUserId !== authUid) {
    return res.status(403).json({ error: 'forbidden' });
  }

  try {
    const [coreQuestions, answers, diaryEntries, diaryAnalyses, existingProfileDoc] = await Promise.all([
      loadScreeningQuestions(),
      loadAnswersForUser(authUid),
      loadDiaryEntriesForUser(authUid),
      loadDiaryAnalysisForUser(authUid),
      db.collection('screening_profiles').doc(authUid).get()
    ]);
    const existingProfile = existingProfileDoc.exists ? (existingProfileDoc.data() || {}) : {};
    const previousPersonaLayers = (existingProfile.persona5 && existingProfile.persona5.layers) || {};

    const adhd = computeAdhdProfile(coreQuestions, answers);
    const personality = computePersonalityProfile(diaryEntries, diaryAnalyses, answers, adhd);
    const persona5 = await computePersona5Profile(answers, previousPersonaLayers);
    const recomputedAt = new Date();
    const profileDoc = {
      userId: authUid,
      updatedAt: recomputedAt.toISOString(),
      version: SCREENING_VERSION,
      adhd,
      personality,
      persona5,
      notice: buildScreeningNotice()
    };
    const historyDoc = {
      ...profileDoc,
      triggerAnswerId: String(req.body?.trigger_answer_id || '').trim(),
      createdAt: recomputedAt.toISOString()
    };
    const historyId = `${authUid}_${toUtcToken(recomputedAt)}`;

    await Promise.all([
      db.collection('screening_profiles').doc(authUid).set(profileDoc, { merge: true }),
      db.collection('screening_history').doc(historyId).set(historyDoc, { merge: true })
    ]);
    try {
      await syncPersonaLayerReports(authUid, persona5);
    } catch (syncErr) {
      console.warn('[screening] layer_results sync failed', syncErr);
    }

    return res.json({
      status: 'ok',
      recomputedAt: recomputedAt.toISOString(),
      profile: profileDoc
    });
  } catch (err) {
    console.error('[screening] recompute failed', err);
    return res.status(500).json({ error: 'screening_recompute_failed' });
  }
});

app.post('/api/summary', async (req, res) => {
  const { period_label, top_emotion, top_pattern, emotion_top5, pattern_top5 } = req.body || {};
  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const prompt = `
Generate a short summary (1-2 lines) and 3 short themes in Japanese from the aggregated counts.
Avoid definitive language. Use observational language.
Return JSON only:
{
  "summary": "...",
  "themes": ["...", "...", "..."]
}

Period: ${period_label}
Top emotion: ${top_emotion}
Top pattern: ${top_pattern}
Top emotions: ${JSON.stringify(emotion_top5 || [])}
Top patterns: ${JSON.stringify(pattern_top5 || [])}
`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!resp.ok) throw new Error('summary_failed');
      const data = await resp.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return res.json({
        summary: parsed.summary || '',
        themes: Array.isArray(parsed.themes) ? parsed.themes : []
      });
    } catch (err) {
      return res.status(500).json({ error: 'summary_failed' });
    }
  }

  const summary = `直近${period_label}では、感情は${top_emotion || '未集計'}、パターンは${top_pattern || '未集計'}が目立つ傾向です。`;
  const themes = [
    top_emotion ? `${top_emotion}の揺れ` : '感情の揺れ',
    top_pattern ? `${top_pattern}への注意` : '思考のパターン',
    '反応のトリガー'
  ];
  res.json({ summary, themes });
});

function buildInsightFallback(payload) {
  const aggregate = payload.aggregate || {};
  const daily = payload.daily || {};
  const topLocation = aggregate.top_locations && aggregate.top_locations[0] ? aggregate.top_locations[0].label : '';
  const topDomain = aggregate.top_domains && aggregate.top_domains[0] ? aggregate.top_domains[0].label : '';
  const topFood = aggregate.top_foods && aggregate.top_foods[0] ? aggregate.top_foods[0].label : '';
  const dailyInsight = daily.text
    ? '今日の記録からは、印象的な出来事や気分の揺れが見られます。'
    : '今日の記録が増えると、具体的な気づきを表示できます。';
  const aggregateInsight = aggregate.avg_mood || aggregate.avg_satisfaction
    ? '最近は気分や満足度の記録が積み重なり、生活のリズムが見え始めています。'
    : '記録が増えると、傾向がよりはっきりします。';
  const signals = [];
  if (topLocation) signals.push(`よく行く場所: ${topLocation}`);
  if (topDomain) signals.push(`よく見るサイト: ${topDomain}`);
  if (topFood) signals.push(`よく出る食べ物: ${topFood}`);
  return { daily_insight: dailyInsight, aggregate_insight: aggregateInsight, signals };
}

app.post('/api/insight', async (req, res) => {
  const payload = req.body || {};
  const aggregate = payload.aggregate || {};
  const daily = payload.daily || {};
  const dailyText = String(daily.text || '').slice(0, 800);

  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const prompt = `
You are a professional counselor. Provide observational insights only.
No diagnosis. Avoid definitive language. Output Japanese.
Return JSON only:
{
  "daily_insight": "...",
  "aggregate_insight": "...",
  "signals": ["...", "...", "..."]
}
Constraints:
- daily_insight: 1-2 lines about today's journal.
- aggregate_insight: 1-2 lines about overall trends.
- signals: 2-4 short bullets about notable patterns (sleep, mood, locations, domains, meals).

Daily journal text:
${dailyText}

Daily meta:
${JSON.stringify({ mood: daily.mood, satisfaction: daily.satisfaction, sleepHours: daily.sleepHours, meals: daily.meals, locationLabel: daily.locationLabel, highlight: daily.highlight })}

Aggregate summary:
${JSON.stringify(aggregate)}
`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!resp.ok) throw new Error('insight_failed');
      const data = await resp.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return res.json({
        daily_insight: parsed.daily_insight || '',
        aggregate_insight: parsed.aggregate_insight || '',
        signals: Array.isArray(parsed.signals) ? parsed.signals : []
      });
    } catch (err) {
      return res.status(500).json({ error: 'insight_failed' });
    }
  }

  return res.json(buildInsightFallback(payload));
});

app.get('/api/admin/answer-counts', async (req, res) => {
  let authInfo;
  try {
    authInfo = await getRequestAuthInfo(req);
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!isAdminEmail(authInfo.email)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const snapshot = await db.collection('answers').get();
    const counts = {};
    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const qid = data.questionId || '';
      if (!qid) return;
      counts[qid] = (counts[qid] || 0) + 1;
    });
    return res.json({ countsByQuestionId: counts });
  } catch (err) {
    console.error('[admin/answer-counts] failed', err);
    return res.status(500).json({ error: 'internal' });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Self-Observation OS API running on :${port}`);
});
