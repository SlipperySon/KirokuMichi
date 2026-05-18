import type { GrammarItem } from './curriculumService'

type MaynardRef = NonNullable<GrammarItem['maynardRef']>

const FALLBACKS: Array<{
  match: RegExp
  title: string
  excerpt: string
  examples: MaynardRef['examples']
}> = [
  {
    match: /^です$/,
    title: 'Foundation bridge: polite predicate closure',
    excerpt:
      'です turns a noun or adjective-style statement into a polite complete sentence. Treat it as the polite closing frame for identifying, describing, and classifying, not as a word-for-word replacement for English “is.”',
    examples: [{ japanese: 'これは本です。', english: 'This is a book.' }],
  },
  {
    match: /^だ$/,
    title: 'Foundation bridge: plain predicate closure',
    excerpt:
      'だ does the same basic sentence-closing work as です, but in plain style. It belongs with familiar speech, notes, and quoted/thought language; です is the safer classroom default.',
    examples: [{ japanese: 'これは本だ。', english: 'This is a book. / This is a book, plain style.' }],
  },
  {
    match: /^は$/,
    title: 'Foundation bridge: topic marking',
    excerpt:
      'は marks what the sentence is about. The learner should separate “topic” from “subject”: after は, listen for the comment or judgment the sentence makes about that topic.',
    examples: [{ japanese: '私は学生です。', english: 'As for me, I am a student.' }],
  },
  {
    match: /^が$/,
    title: 'Foundation bridge: subject focus',
    excerpt:
      'が identifies or highlights the subject inside the sentence. It often answers “which one?” or presents new information, while は sets up the topic for comment.',
    examples: [{ japanese: '誰が来ますか。', english: 'Who is coming?' }],
  },
  {
    match: /^も$/,
    title: 'Foundation bridge: additive topic',
    excerpt:
      'も replaces simple topic/subject marking when the sentence adds something to an existing set. Teach it as “also/even” plus the same predicate pattern already learned.',
    examples: [{ japanese: 'メアリーさんも学生です。', english: 'Mary is also a student.' }],
  },
  {
    match: /^の$/,
    title: 'Foundation bridge: noun linking',
    excerpt:
      'の links two nouns by making the first noun describe, possess, classify, or locate the second. Read A の B as “B connected to A,” then choose the natural English relationship from context.',
    examples: [{ japanese: '日本語の本', english: 'a Japanese-language book' }],
  },
  {
    match: /^か$/,
    title: 'Foundation bridge: question ending',
    excerpt:
      'か turns a polite statement into a question without changing Japanese word order. Keep the sentence shape stable and let the final particle carry the question force.',
    examples: [{ japanese: '学生ですか。', english: 'Are you a student?' }],
  },
  {
    match: /^(これ|それ|あれ|ここ|そこ|あそこ|この|その|あの|どこ|どれ)/,
    title: 'Foundation bridge: ko-so-a-do deixis',
    excerpt:
      'こ・そ・あ・ど words organize meaning by speaker/listener distance: こ near the speaker, そ near the listener or prior context, あ away from both, and ど for questions.',
    examples: [{ japanese: 'これは何ですか。', english: 'What is this?' }],
  },
  {
    match: /い-Adjective|い-Adjectives|い-Adjective/,
    title: 'Foundation bridge: i-adjective predicates',
    excerpt:
      'い-adjectives can describe a noun directly or complete a sentence as the predicate. Their tense and negativity usually attach to the adjective itself, not to です.',
    examples: [{ japanese: 'この本はおもしろいです。', english: 'This book is interesting.' }],
  },
  {
    match: /な-Adjective|な-Adjectives|な-Adjective/,
    title: 'Foundation bridge: na-adjective noun modification',
    excerpt:
      'な-adjectives use な before a noun and behave more like noun-style predicates at the end of a sentence. The な is a linking form, not part of the dictionary label.',
    examples: [{ japanese: '静かな町です。', english: 'It is a quiet town.' }],
  },
  {
    match: /ている|ている①/,
    title: 'Foundation bridge: state or ongoing action',
    excerpt:
      'ている links an action to its current relevance: an action in progress, a repeated habit, or a resulting state. The key question is what condition holds now.',
    examples: [{ japanese: '今、勉強しています。', english: 'I am studying now.' }],
  },
  {
    match: /てください/,
    title: 'Foundation bridge: polite request',
    excerpt:
      'てください uses the て-form to ask someone to do an action. It is a request pattern, so the social softness depends on context, relationship, and tone.',
    examples: [{ japanese: '名前を書いてください。', english: 'Please write your name.' }],
  },
  {
    match: /のがすき|好き|きらい|ほしい|たい|たがる|がる/,
    title: 'Support bridge: preference, desire, and observed feelings',
    excerpt:
      'Japanese often treats likes, wants, and feelings as states rather than direct actions. Track who experiences the feeling, then choose が, たい, ほしい, or third-person markers like がる/たがる.',
    examples: [{ japanese: '友だちは日本語を勉強したがっています。', english: 'My friend seems to want to study Japanese.' }],
  },
  {
    match: /てもいい|な$|命令形|たまえ|てはならない|ないで/,
    title: 'Support bridge: permission, prohibition, and commands',
    excerpt:
      'Permission and prohibition patterns encode social force. てもいい allows an action, な and てはならない block it, and command forms vary sharply by relationship and setting.',
    examples: [{ japanese: 'ここで写真を撮ってもいいです。', english: 'It is okay to take photos here.' }],
  },
  {
    match: /で$|へ$|にいく|まで|^から$|に \(Frequency\)|ごろ|間に|途中|中を/,
    title: 'Support bridge: particles for path, range, means, and time',
    excerpt:
      'Particles such as で, へ, に, から, and まで map an event to means, direction, purpose, starting point, endpoint, or time range. The same particle can shift role with the surrounding noun or verb.',
    examples: [{ japanese: '電車で学校へ行きます。', english: 'I go to school by train.' }],
  },
  {
    match: /まえに|あとで|てから|たことがある|ことがある|はじめる|おわる|ていた|ていく|ぶりに|以来|末/,
    title: 'Support bridge: event sequence and experience over time',
    excerpt:
      'These patterns locate an action in a timeline: before/after order, lived experience, beginning or finishing, past continuation, forward change, or a result after a long process.',
    examples: [{ japanese: '宿題をしてから寝ました。', english: 'I went to bed after doing my homework.' }],
  },
  {
    match: /から$|ので|のに|けれども|ながら|ながらも|^と$|ば$|たら|ても|ても.*でも|にせよ|にしろ|とも/,
    title: 'Support bridge: reason, contrast, and condition',
    excerpt:
      'Reason, contrast, and condition markers connect clauses by explaining why something happens, why it is surprising, or what situation must hold. Read the relationship between clauses before translating the marker.',
    examples: [{ japanese: '雨が降ったので、家にいました。', english: 'Because it rained, I stayed home.' }],
  },
  {
    match: /という|って|といってもいい|というのは|ということは|という風に|といった|とか|とか～とか/,
    title: 'Support bridge: quoting, naming, and framing',
    excerpt:
      'という and related patterns let Japanese quote speech, name an idea, define a term, soften a report, or frame an example. Identify whether the clause is a quote, label, explanation, or implication.',
    examples: [{ japanese: 'これは「おにぎり」という食べ物です。', english: 'This is a food called onigiri.' }],
  },
  {
    match: /ように|ような|ようでは|ようじゃ|みたい|らしい|そうに|そうな|そうだ|げ|ふうに|風/,
    title: 'Support bridge: resemblance, appearance, and manner',
    excerpt:
      'よう, みたい, らしい, そう, げ, and ふう describe resemblance, evidence, typicality, or manner. The form before and after the expression tells you which meaning is active.',
    examples: [{ japanese: '先生が言ったように練習しました。', english: 'I practiced the way the teacher said.' }],
  },
  {
    match: /くらい|ほど|あまり|あまりに|そんなに|ずっと|ほとんど|たくさん|Number|なん \+ counter|各|ごとに|につき|おおよそ/,
    title: 'Support bridge: amount, degree, and approximation',
    excerpt:
      'Quantity expressions do more than count. They can mark approximation, minimum expectations, surprising degree, repetition per unit, or an amount so strong that it changes the tone of the sentence.',
    examples: [{ japanese: '一時間くらい勉強しました。', english: 'I studied for about an hour.' }],
  },
  {
    match: /誰|どこ|どの|なにか|なにも|誰か|どこか|誰も|どこも|Question-phrase \+ か|かしら|かな/,
    title: 'Support bridge: question words inside larger meanings',
    excerpt:
      'Question words can ask direct questions, create indefinite meanings with か, become negative universals with も plus a negative, or express wondering at the end of a sentence.',
    examples: [{ japanese: '何か食べたいです。', english: 'I want to eat something.' }],
  },
  {
    match: /ことができる|ひつよう|必要|がひつよう|には|ようがない|かねる|得る/,
    title: 'Support bridge: ability, necessity, and feasibility',
    excerpt:
      'Ability and necessity patterns tell the learner whether an action is possible, required, difficult to do, or blocked by social or practical constraints.',
    examples: [{ japanese: 'ここで予約することができます。', english: 'You can make a reservation here.' }],
  },
  {
    match: /Verb.*て|Adjective \+ て|なくて|てすみません|てよかった|てみる|てしまう|ちゃう|てくれてありがとう|て頂戴/,
    title: 'Support bridge: te-form linking, requests, and after-effects',
    excerpt:
      'The て-form is a connector. It can link sequence, cause, requests, apology, trial action, completion, regret, gratitude, or a continuing result depending on the helper expression that follows.',
    examples: [{ japanese: '窓を開けて、部屋を明るくしました。', english: 'I opened the window and made the room brighter.' }],
  },
  {
    match: /う-Verb|る-Verb|Verbs \(Non-past\)|Dictionary|Negative|Negative-Past|Past|Causative-Passive|Verb\[よう\]/,
    title: 'Foundation bridge: verb form system',
    excerpt:
      'Verb-form lessons teach how Japanese packages time, polarity, politeness, volition, and voice into the ending. Focus on the stem class first, then ask what the ending adds to the event.',
    examples: [{ japanese: '昨日は行きませんでした。', english: 'I did not go yesterday.' }],
  },
  {
    match: /がある|がいる|を$|に$|へいく|じゃなかった|もう|なぜ|どうして|ね$|よ$|や$|ませんか/,
    title: 'Foundation bridge: core particles and sentence endings',
    excerpt:
      'Core particles and endings are small but high-value signals: existence, object marking, movement targets, social confirmation, assertion, invitations, and reason questions. Read them as relationship markers, not standalone words.',
    examples: [{ japanese: '机の上に本があります。', english: 'There is a book on the desk.' }],
  },
  {
    match: /たほうがいい|なくちゃ|なきゃ|すぎる|のがじょうず|のがへた|Adjective \+ の|もらう|あげる/,
    title: 'Foundation bridge: advice, skill, excess, and benefit flow',
    excerpt:
      'These patterns move beginner Japanese into social meaning: advice, obligation, ability at an activity, excess, and who gives or receives a benefit.',
    examples: [{ japanese: '早く寝たほうがいいです。', english: 'You should go to bed early.' }],
  },
  {
    match: /く・に|さ|かた|づらい|やすい|にくい|切る|がち|ぎみ|かけ/,
    title: 'Support bridge: form changes that create new meanings',
    excerpt:
      'Small form changes can turn adjectives into adverbs or nouns, verbs into “way of doing,” and stems into ease, difficulty, completion, tendency, slight condition, or half-finished action.',
    examples: [{ japanese: 'この漢字は覚えにくいです。', english: 'This kanji is hard to memorize.' }],
  },
  {
    match: /について|に比べて|に取って|として|としては|において|における|上$|上に|以上|以上に|から言うと|から見ると/,
    title: 'Support bridge: topic, viewpoint, role, and comparison',
    excerpt:
      'Intermediate grammar often frames the domain of a claim: about a topic, compared with a standard, from someone’s standpoint, in a role, or within a field.',
    examples: [{ japanese: '学生にとって、この制度は便利です。', english: 'For students, this system is convenient.' }],
  },
  {
    match: /によって|による|にしたがって|につれて|に向かって|に向けて|にかけては|にかかわらず|にかかわる|に際して|にあたり|にあたって/,
    title: 'Support bridge: relation, change, target, and circumstance',
    excerpt:
      'These に-based patterns connect an event to cause, agent, standard, gradual change, target, special field, regardless condition, involvement, or the occasion for action.',
    examples: [{ japanese: '時代によって考え方が変わります。', english: 'Ways of thinking change depending on the era.' }],
  },
  {
    match: /ところで|ところが|ところを見ると|ところに|ところへ|最中に|うちに|まま|ままに|きり/,
    title: 'Support bridge: discourse shifts and marked moments',
    excerpt:
      'ところ and related time/state patterns mark a moment, shift the conversation, show an unexpected turn, or keep a state unchanged while another action happens.',
    examples: [{ japanese: '出かけようとしたところに、電話が来ました。', english: 'Just as I was about to leave, a call came.' }],
  },
  {
    match: /やすい|にくい/,
    title: 'Support bridge: ease and difficulty',
    excerpt:
      'やすい and にくい attach to the verb stem to describe how easy or difficult an action is to do. The focus is the action experience, not the object by itself.',
    examples: [{ japanese: 'この辞書は使いやすいです。', english: 'This dictionary is easy to use.' }],
  },
  {
    match: /がほしい|ほしい/,
    title: 'Support bridge: wanting an object',
    excerpt:
      'ほしい describes wanting a thing, so the desired object is commonly marked with が. Keep it separate from たい, which attaches to a verb when you want to do an action.',
    examples: [{ japanese: '新しいかばんがほしいです。', english: 'I want a new bag.' }],
  },
  {
    match: /てあげる|てくれる|てもらう/,
    title: 'Support bridge: giving and receiving actions',
    excerpt:
      'てあげる, てくれる, and てもらう describe helpful actions as social giving and receiving. Track who benefits from the action before choosing the form.',
    examples: [{ japanese: '友だちに本を貸してあげました。', english: 'I lent my friend a book as a favor.' }],
  },
  {
    match: /^そう$|そうだ|そうです/,
    title: 'Support bridge: appearance and hearsay',
    excerpt:
      'そう can describe what something looks like from visible evidence or report what someone heard. The form around そう tells you whether it means “looks” or “I hear.”',
    examples: [{ japanese: 'このケーキはおいしそうです。', english: 'This cake looks delicious.' }],
  },
  {
    match: /みたいに|みたいな|みたい/,
    title: 'Support bridge: resemblance and examples',
    excerpt:
      'みたい frames something as resembling or seeming like something else. Use みたいな before a noun and みたいに before an action or description.',
    examples: [{ japanese: '先生みたいに話したいです。', english: 'I want to speak like the teacher.' }],
  },
  {
    match: /より|のほうが/,
    title: 'Support bridge: comparison anchor',
    excerpt:
      'より marks the comparison baseline, while のほうが marks the side that has more of the quality. Do not translate word-by-word; identify the two sides first.',
    examples: [{ japanese: '電車のほうがバスより速いです。', english: 'The train is faster than the bus.' }],
  },
  {
    match: /ようと思う|おうと思う|つもり/,
    title: 'Support bridge: intention',
    excerpt:
      'ようと思う presents an intention you are forming or holding. It is softer and more personal than a fixed schedule; pair it with context about when or why.',
    examples: [{ japanese: '週末に京都へ行こうと思っています。', english: 'I am thinking of going to Kyoto this weekend.' }],
  },
  {
    match: /^なら$|ならば/,
    title: 'Support bridge: condition from context',
    excerpt:
      'なら responds to a topic, plan, or assumption already in the conversation. It often means “if that is the case,” so it is useful for giving advice.',
    examples: [{ japanese: '京都に行くなら、お寺を見てください。', english: 'If you are going to Kyoto, please see the temples.' }],
  },
  {
    match: /必要がある|なければいけない|なくてはいけない/,
    title: 'Support bridge: necessity and obligation',
    excerpt:
      '必要がある states that something is necessary; なければいけない states that someone must do it. Both express pressure, but one is noun-like and the other is action-based.',
    examples: [{ japanese: '明日までに払わなければいけません。', english: 'I have to pay by tomorrow.' }],
  },
  {
    match: /し～し|し$/,
    title: 'Support bridge: stacking reasons',
    excerpt:
      'し lets you stack reasons or qualities without making every reason equally formal. It often implies “among other reasons,” so it sounds natural in explanation.',
    examples: [{ japanese: '安いし、駅に近いし、このアパートがいいです。', english: 'It is cheap and close to the station, so this apartment is good.' }],
  },
  {
    match: /かどうか/,
    title: 'Support bridge: embedded yes/no question',
    excerpt:
      'かどうか turns a yes/no question into a noun-like question inside a larger sentence. Use it when asking, knowing, deciding, or reporting whether something is true.',
    examples: [{ japanese: '試験があるかどうか聞きました。', english: 'I asked whether there is a test.' }],
  },
  {
    match: /てある/,
    title: 'Support bridge: prepared resulting state',
    excerpt:
      'てある describes a state intentionally left prepared by someone’s action. The important idea is not just “it is done,” but “it has been done for a purpose.”',
    examples: [{ japanese: '切符は買ってあります。', english: 'The tickets have been bought/prepared.' }],
  },
  {
    match: /ようにする/,
    title: 'Support bridge: making a habit or effort',
    excerpt:
      'ようにする describes making an effort to bring about a repeated habit or desired condition. It often sounds like “try to make sure that...”',
    examples: [{ japanese: '毎日漢字を読むようにしています。', english: 'I try to read kanji every day.' }],
  },
  {
    match: /ても$/,
    title: 'Support bridge: even if',
    excerpt:
      'ても marks that the main result holds even if the condition happens. It is useful for exceptions, reassurance, and “no matter whether” statements.',
    examples: [{ japanese: '忙しくても、メールしてください。', english: 'Even if you are busy, please email me.' }],
  },
  {
    match: /自動詞|他動詞/,
    title: 'Support bridge: state versus action control',
    excerpt:
      'Intransitive verbs describe what happened or what state exists; transitive verbs describe someone acting on something. Ask whether the sentence cares about the event/state or the actor’s control.',
    examples: [{ japanese: 'ドアが開きました。私がドアを開けました。', english: 'The door opened. I opened the door.' }],
  },
  {
    match: /お～になる|いらっしゃる|なさる|いたす/,
    title: 'Support bridge: respect and humility',
    excerpt:
      'Respectful language raises the other person’s action; humble language lowers your own side. Choose the form by social direction, not by English politeness alone.',
    examples: [{ japanese: '先生はいらっしゃいますか。', english: 'Is the teacher here?' }],
  },
  {
    match: /あまり～ない|ぜんぜん/,
    title: 'Support bridge: negative degree',
    excerpt:
      'あまり and ぜんぜん pair with negative forms to describe low degree or total absence. The negative ending is part of the pattern, not optional decoration.',
    examples: [{ japanese: 'テレビはあまり見ません。', english: 'I do not watch TV much.' }],
  },
  {
    match: /^もし|もし$/,
    title: 'Support bridge: hypothetical setup',
    excerpt:
      'もし flags that a hypothetical condition is coming. The conditional form does the grammar work; もし helps the listener frame the sentence as “if...” early.',
    examples: [{ japanese: 'もし雨が降ったら、映画を見ましょう。', english: 'If it rains, let’s watch a movie.' }],
  },
  {
    match: /なおす/,
    title: 'Support bridge: redoing to fix',
    excerpt:
      'なおす after a verb means doing the action again in order to fix or improve it. It is not just repetition; it carries the idea of correction.',
    examples: [{ japanese: '作文を書き直しました。', english: 'I rewrote the essay.' }],
  },
  {
    match: /一つだ|と考えられている|とされている/,
    title: 'Support bridge: classifying and reporting common views',
    excerpt:
      'These patterns help describe something as part of a category or report how people generally understand it. They create distance between your personal opinion and a broader view.',
    examples: [{ japanese: 'お花見は春の楽しみの一つです。', english: 'Cherry-blossom viewing is one of the pleasures of spring.' }],
  },
  {
    match: /ばいい|べき|ことだ/,
    title: 'Support bridge: advice strength',
    excerpt:
      'ばいい gives practical advice, べき presents a stronger “should,” and ことだ frames advice as the key thing to do. Choose by how forceful the recommendation should sound.',
    examples: [{ japanese: '困った時は、先生に相談すればいいです。', english: 'When you are in trouble, you should ask the teacher.' }],
  },
  {
    match: /ために|上で/,
    title: 'Support bridge: purpose and conditions',
    excerpt:
      'ために points to the goal or purpose of an action. 上で sets a necessary condition, stage, or viewpoint before the main action can be understood.',
    examples: [{ japanese: '留学するために、資料を集めています。', english: 'I am gathering materials in order to study abroad.' }],
  },
  {
    match: /どんなに.*ても|たとえ.*ても|としても/,
    title: 'Support bridge: concession',
    excerpt:
      'These forms say that the main point still holds even under a difficult or hypothetical condition. They are useful for keeping an argument stable while acknowledging pressure.',
    examples: [{ japanese: 'どんなに忙しくても、睡眠は大切です。', english: 'No matter how busy you are, sleep is important.' }],
  },
  {
    match: /に関する|に関して|に対して/,
    title: 'Support bridge: topic and target',
    excerpt:
      'に関して frames the topic being discussed, while に対して points to the target of an attitude, action, or response. Both help make discussion more precise.',
    examples: [{ japanese: '環境問題に関して意見を話しました。', english: 'We discussed opinions regarding environmental issues.' }],
  },
  {
    match: /おかげで|せいで|ばかりに/,
    title: 'Support bridge: cause with evaluation',
    excerpt:
      'おかげで marks a beneficial cause, while せいで and ばかりに mark a negative cause. The grammar carries the speaker’s evaluation of the result.',
    examples: [{ japanese: '友だちのおかげで、試験に合格できました。', english: 'Thanks to my friend, I was able to pass the exam.' }],
  },
  {
    match: /わけではない|とは限らない/,
    title: 'Support bridge: partial denial',
    excerpt:
      'わけではない and とは限らない help avoid overstatement. They do not fully reject the idea; they reject treating it as always or completely true.',
    examples: [{ japanese: '便利だからといって、いつも必要なわけではありません。', english: 'Just because it is convenient does not mean it is always necessary.' }],
  },
  {
    match: /がたい|ような気がする|まるで.*よう/,
    title: 'Support bridge: difficult judgment and impression',
    excerpt:
      'がたい expresses that something is hard to do psychologically or emotionally. ような気がする softens a judgment as an impression rather than a flat claim.',
    examples: [{ japanese: 'その説明は信じがたいような気がします。', english: 'I feel that explanation is hard to believe.' }],
  },
  {
    match: /ばかりでなく|一方で|一方だ/,
    title: 'Support bridge: adding contrast or trend',
    excerpt:
      'ばかりでなく adds another point, 一方で contrasts two sides, and 一方だ describes a trend continuing in one direction. These are discussion-building connectors.',
    examples: [{ japanese: '便利なばかりでなく、時間も節約できます。', english: 'It is not only convenient; it also saves time.' }],
  },
  {
    match: /て初めて|にしては/,
    title: 'Support bridge: realization and evaluation',
    excerpt:
      'て初めて marks a realization that happened only after an experience. にしては evaluates something against what would normally be expected from that category.',
    examples: [{ japanese: '一人で住んで初めて、家族のありがたさがわかりました。', english: 'Only after living alone did I understand how grateful I am for my family.' }],
  },
  {
    match: /に代わって|につれて|っぱなし|切れない/,
    title: 'Support bridge: change and unresolved state',
    excerpt:
      'に代わって marks replacement, につれて marks gradual change, and っぱなし/切れない describe states or actions left unresolved. These patterns help explain process over time.',
    examples: [{ japanese: '現金に代わって、スマホ決済が増えています。', english: 'In place of cash, smartphone payments are increasing.' }],
  },
  {
    match: /から見ると|逆に|だけに/,
    title: 'Support bridge: viewpoint and consequence',
    excerpt:
      'から見ると sets a viewpoint, 逆に reverses perspective, and だけに links a reason to a natural consequence. Together they help qualify an argument.',
    examples: [{ japanese: '学生から見ると便利ですが、先生から見ると問題もあります。', english: 'From a student viewpoint it is convenient, but from a teacher viewpoint there are problems too.' }],
  },
  {
    match: /ぶりに|思うように|得る/,
    title: 'Support bridge: time gap, expectation, and possibility',
    excerpt:
      'ぶりに marks doing something after a time gap, 思うように compares reality with expectation, and 得る marks possibility in a formal register.',
    examples: [{ japanese: '三年ぶりに運転しましたが、思うようにできませんでした。', english: 'I drove for the first time in three years, but I could not do it as I wanted.' }],
  },
  {
    match: /だけあって|だけのことはある|さすが/,
    title: 'Support bridge: deserved reputation',
    excerpt:
      'だけあって and だけのことはある explain that the result matches reputation, effort, or expectation. さすが adds praise that the expectation was fulfilled.',
    examples: [{ japanese: '有名な店だけあって、とてもおいしかったです。', english: 'As expected of a famous shop, it was very delicious.' }],
  },
  {
    match: /上は|からには|任せる|ざるを得ない|よりほかない/,
    title: 'Support bridge: responsibility and no-choice logic',
    excerpt:
      '上は and からには say that once a condition or responsibility is accepted, a consequence follows. ざるを得ない and よりほかない express that no realistic alternative remains.',
    examples: [{ japanese: '引き受けたからには、最後までやります。', english: 'Now that I accepted it, I will do it until the end.' }],
  },
  {
    match: /ないではいられない|どころではない|てはいられない/,
    title: 'Support bridge: pressure and compulsion',
    excerpt:
      'ないではいられない expresses an irresistible reaction, while どころではない and てはいられない show that circumstances leave no room for a lower-priority action.',
    examples: [{ japanese: 'その話を聞いて、泣かないではいられませんでした。', english: 'Hearing that story, I could not help crying.' }],
  },
  {
    match: /ようがない|からといって|ことは.*が/,
    title: 'Support bridge: limits and qualification',
    excerpt:
      'ようがない says there is no way to do something. からといって rejects a jump in logic, and ことは〜が concedes one point before limiting it.',
    examples: [{ japanese: '失敗したからといって、あきらめる必要はありません。', english: 'Just because you failed does not mean you need to give up.' }],
  },
  {
    match: /を通じて|を通して|を問わず|てはならない/,
    title: 'Support bridge: medium, scope, and prohibition',
    excerpt:
      'を通じて/を通して marks the medium or experience through which something happens. を問わず broadens scope, and てはならない states a strong prohibition.',
    examples: [{ japanese: 'ボランティアを通して、多くの人に会いました。', english: 'Through volunteering, I met many people.' }],
  },
  {
    match: /ございます|でございます/,
    title: 'Support bridge: formal polite predicate (keigo)',
    excerpt:
      'ございます is the humble-polite equivalent of あります/です, used in very formal or service contexts. でございます replaces です for extreme politeness. Treat it as the maximum-politeness variant of polite predicate closure; use it in business, hospitality, and formal writing registers.',
    examples: [
      { japanese: 'こちらが受付でございます。', english: 'This is the reception desk. (formal)' },
      { japanese: 'お電話ありがとうございます。', english: 'Thank you for your call. (business)' },
    ],
  },
  {
    match: /^つつ$|つつも|つつある|つつ\(/,
    title: 'Support bridge: simultaneous ongoing action (つつ)',
    excerpt:
      'つつ attaches to the verb stem to indicate two actions happening at the same time, or an ongoing process. つつも adds a sense of tension ("while/even though"), and つつある describes something in gradual progress ("is in the process of").',
    examples: [
      { japanese: '音楽を聴きつつ、勉強した。', english: 'I studied while listening to music.' },
      { japanese: '気にしつつも、何も言わなかった。', english: 'Although I had it on my mind, I said nothing.' },
      { japanese: '状況は変わりつつある。', english: 'The situation is in the process of changing.' },
    ],
  },
  {
    match: /^ては$|ていては|ては〜ては|てはならない/,
    title: 'Support bridge: conditional te-form and repeated-action patterns',
    excerpt:
      'ては + negative result expresses "if you keep doing X, something bad will result." ていては adds progressive aspect ("if you are always doing X"). ては〜ては stacks two alternating actions to describe something done repeatedly. Context determines whether the tone is a warning, complaint, or factual loop.',
    examples: [
      { japanese: '毎日ゲームばかりしては、成績が下がる。', english: 'If you do nothing but play games every day, your grades will drop.' },
      { japanese: '食べては寝て、食べては寝ての繰り返しだ。', english: 'It is a cycle of eating and sleeping, over and over.' },
    ],
  },
  {
    match: /しかも|さらに$|そのうえ/,
    title: 'Support bridge: additive conjunctions (moreover / furthermore)',
    excerpt:
      'しかも adds a second point that reinforces or intensifies the first, often with the nuance "and what is more." さらに and そのうえ similarly pile on additional information. These are discourse connectors — they show the relationship between two adjacent points, not the grammar of individual clauses.',
    examples: [
      { japanese: 'このパソコンは速い。しかも、値段も安い。', english: 'This computer is fast. Moreover, it is also cheap.' },
    ],
  },
  {
    match: /つまり|要するに|換言すれば/,
    title: 'Support bridge: reformulation and clarification (in other words)',
    excerpt:
      'つまり introduces a restatement or conclusion drawn from what just came before — essentially "in other words" or "that means." 要するに is more emphatic ("the point is"), and 換言すれば is formal ("to put it another way"). All three signal that the speaker is reformulating for clarity.',
    examples: [
      { japanese: '彼は来なかった。つまり、興味がなかったということだ。', english: 'He did not come. In other words, he was not interested.' },
    ],
  },
  {
    match: /ことなく|ずに済む|せずに済む/,
    title: 'Support bridge: doing without / avoiding an action',
    excerpt:
      'ことなく means "without doing X" and implies the action was never triggered. ずに済む / せずに済む means "manage to get by without doing X" — the action that might have been expected was avoided. The key difference is that ことなく describes a path taken, while ずに済む focuses on the relief of avoidance.',
    examples: [
      { japanese: '一度も休むことなく、完走した。', english: 'I ran the whole race without taking a single break.' },
      { japanese: '手術せずに済んだ。', english: 'I managed to avoid surgery.' },
    ],
  },
  {
    match: /^かい$|でしょうかい/,
    title: 'Support bridge: masculine casual question particle (かい)',
    excerpt:
      'かい is a softer, slightly old-fashioned masculine version of the question particle か, commonly heard in casual speech from older male speakers. It signals curiosity or mild surprise rather than a formal inquiry. In writing and modern conversation, か or の are more common.',
    examples: [{ japanese: 'もう行くのかい？', english: 'Are you leaving already?' }],
  },
  {
    match: /おそらく|きっと$|たぶん/,
    title: 'Support bridge: probability adverbs',
    excerpt:
      'おそらく ("probably"), きっと ("surely/certainly"), and たぶん ("probably/perhaps") all express degrees of speaker confidence. おそらく is the most formal and introduces some doubt; きっと expresses strong expectation; たぶん is the most casual and least certain.',
    examples: [
      { japanese: 'おそらく明日は雨だろう。', english: 'It will probably rain tomorrow.' },
      { japanese: 'きっとうまくいくよ。', english: 'I am sure it will work out.' },
    ],
  },
  {
    match: /^ため$|ために|ための|ためだ/,
    title: 'Support bridge: purpose and cause (ために)',
    excerpt:
      'ために has two distinct roles. As a purpose marker (verb dictionary form + ために), it means "in order to do X" — the subject of both clauses should be the same. As a cause marker (plain form + ために), it expresses "because of / due to X." Learners must distinguish these by context: purpose looks forward; cause explains a result already stated.',
    examples: [
      { japanese: '日本語を勉強するために、毎日練習しています。', english: 'I practise every day in order to study Japanese.' },
      { japanese: '病気のために、休みました。', english: 'I took a day off because of illness.' },
    ],
  },
  {
    match: /いくら.*ても|いくら.*でも|^〜でも〜でも$|〜でも.*〜でも/,
    title: 'Support bridge: concession regardless of degree (いくら〜ても)',
    excerpt:
      'いくら〜ても expresses "no matter how much/many X, the result is still Y." The ても ending creates the concessive force, while いくら sets the uncapped degree. The construction signals that the outcome resists variation, regardless of how extreme the X side becomes.',
    examples: [{ japanese: 'いくら練習しても、うまくならない。', english: 'No matter how much I practise, I do not improve.' }],
  },
  {
    match: /てこそ|からこそ/,
    title: 'Support bridge: emphatic "only because / precisely when" (てこそ / からこそ)',
    excerpt:
      'てこそ attaches to the te-form to say "it is only by/when doing X that Y is possible or meaningful." It asserts that X is the indispensable condition for Y. からこそ similarly emphasises that the reason for Y is specifically X — stressing the causal link. Both patterns intensify and highlight the connection.',
    examples: [
      { japanese: '失敗してこそ、成長できる。', english: 'It is only by failing that one can grow.' },
      { japanese: '努力したからこそ、合格できた。', english: 'It is precisely because I worked hard that I passed.' },
    ],
  },
  {
    match: /^とうとう$|ついに$|^ようやく$/,
    title: 'Support bridge: final result adverbs (at last / finally)',
    excerpt:
      'とうとう ("in the end/at last") often implies a long wait or a somewhat expected, sometimes regrettable outcome. ついに emphasises that a significant turning point has been reached. ようやく highlights difficulty overcome — "finally, after much effort." Choose based on tone: regret/inevitability → とうとう; milestone → ついに; relief after struggle → ようやく.',
    examples: [
      { japanese: 'とうとう試験に落ちてしまった。', english: 'In the end, I failed the exam after all.' },
      { japanese: 'ついに夢が実現した。', english: 'At last my dream came true.' },
    ],
  },
  {
    match: /どんどん|ますます|次第に/,
    title: 'Support bridge: progressive change adverbs',
    excerpt:
      'どんどん describes something advancing rapidly or accumulating quickly, often with enthusiasm or unchecked speed. ますます means "more and more" with a sense of steady intensification. 次第に describes gradual change that unfolds step by step. All three pair naturally with change-of-state verbs.',
    examples: [
      { japanese: '日本語がどんどん上手になっている。', english: 'My Japanese is getting better and better (rapidly).' },
      { japanese: '気温がますます下がっている。', english: 'The temperature is falling more and more.' },
    ],
  },
  {
    match: /^など$|などの|などが|とか$|なんか/,
    title: 'Support bridge: listing with open scope (など / とか)',
    excerpt:
      'など signals that the listed items are examples, not an exhaustive set — "things like X, Y, and so on." とか is more casual and often implies uncertainty ("X and that sort of thing"). Both allow the speaker to hint at a broader category without committing to a complete list.',
    examples: [{ japanese: '果物など、健康にいい食べ物を食べています。', english: 'I eat healthy foods such as fruit and so on.' }],
  },
  {
    match: /いわゆる/,
    title: 'Support bridge: labelling with shared understanding (いわゆる)',
    excerpt:
      'いわゆる ("so-called / what is commonly called") introduces a term or label that both speaker and listener are expected to recognise. It can be neutral, slightly sceptical, or distancing — the nuance depends on tone. It is placed directly before the noun it modifies.',
    examples: [{ japanese: 'これがいわゆる「少子化問題」です。', english: 'This is what is commonly called the "declining birthrate problem."' }],
  },
  {
    match: /^せめて$/,
    title: 'Support bridge: minimum expectation (せめて)',
    excerpt:
      'せめて expresses "at least" in the sense of a minimum hope or demand when the ideal is out of reach. It sets a floor — if not everything, then せめて this much. It commonly appears in requests, wishes, and conditions, often with potential or volitional forms.',
    examples: [{ japanese: 'せめて一言言ってほしかった。', english: 'I wish you had at least said something.' }],
  },
  {
    match: /^どうやら|らしい$|ようだ$|ようです/,
    title: 'Support bridge: inference and appearance (どうやら / らしい / よう)',
    excerpt:
      'どうやら signals that the speaker is drawing a conclusion from indirect evidence — "it appears that / it seems like." らしい suggests the conclusion is based on hearsay or general impression. ようだ/ようです draws from direct observation. どうやら often precedes らしい or よう to reinforce the evidential quality.',
    examples: [
      { japanese: 'どうやら電車が遅れているようだ。', english: 'It seems the train is running late.' },
    ],
  },
  {
    match: /いきなり|突然|急に/,
    title: 'Support bridge: abrupt change (いきなり / 突然 / 急に)',
    excerpt:
      'いきなり emphasises that something happened with no warning at all — abruptness is the focus. 突然 ("suddenly") is slightly more neutral and can describe natural events. 急に means "all at once/hurriedly" and is often used for plans that change without advance notice. All three modify verbs of change or action.',
    examples: [
      { japanese: 'いきなり電話がかかってきた。', english: 'A call came out of nowhere.' },
    ],
  },
  {
    match: /にもかかわらず/,
    title: 'Support bridge: concession despite contrary expectation (にもかかわらず)',
    excerpt:
      'にもかかわらず ("despite / in spite of / notwithstanding") follows a noun or plain-form clause to assert that the result contradicts what that situation would normally imply. It is formal and often found in written Japanese. The key meaning is: X was present, but Y happened anyway — defying the expected correlation.',
    examples: [{ japanese: '雨にもかかわらず、試合は行われた。', english: 'Despite the rain, the game was held.' }],
  },
  {
    match: /に加えて|に加え|に加えた/,
    title: 'Support bridge: adding a further point (に加えて)',
    excerpt:
      'に加えて ("in addition to / on top of") introduces a second element that joins the first. Unlike しかも (which intensifies), に加えて is more neutral and additive. It connects two comparable items or conditions without judgement about relative importance.',
    examples: [{ japanese: '英語に加えて、フランス語も勉強しています。', english: 'In addition to English, I am also studying French.' }],
  },
  {
    match: /に応じて|に応じた|に合わせて/,
    title: 'Support bridge: proportional adjustment (に応じて)',
    excerpt:
      'に応じて ("depending on / in accordance with / according to") states that something changes proportionally or is adapted to a given factor. The subject of the main clause adjusts, responds, or is calibrated to match the noun before に応じて. Use it when the outcome scales with or fits the standard set by X.',
    examples: [{ japanese: '能力に応じた仕事を与えられた。', english: 'I was given work suited to my abilities.' }],
  },
  {
    match: /に反して|に反する|に反した/,
    title: 'Support bridge: contrary to expectation or norm (に反して)',
    excerpt:
      'に反して ("contrary to / against / in opposition to") introduces a result that goes against the expectation, rule, or wish associated with the preceding noun. It is frequently used with 予想, 規則, and 意志. The meaning is similar to にもかかわらず but focuses on contradiction of a stated standard rather than the presence of an obstacle.',
    examples: [{ japanese: '予想に反して、試験は簡単だった。', english: 'Contrary to expectations, the exam was easy.' }],
  },
  {
    match: /に先立ち|に先立って|に先立つ/,
    title: 'Support bridge: prior to / before an event (に先立ち)',
    excerpt:
      'に先立ち ("prior to / before / in advance of") indicates that one action is carried out ahead of a significant event. It is more formal than 前に and implies the preparatory action is specifically tied to and enabled by the upcoming event. Used widely in official announcements and ceremonies.',
    examples: [{ japanese: '式典に先立ち、練習が行われた。', english: 'A rehearsal was held prior to the ceremony.' }],
  },
  {
    match: /^とおり$|通り$|とおりに|通りに|～通り/,
    title: 'Support bridge: as stated / as expected (とおり)',
    excerpt:
      'とおり ("as stated / just as / in the way that") connects a reference point — a plan, statement, observation — to the outcome that matches it. Plain-form verb or noun before とおり is the standard; what follows either confirms or performs the same pattern. Use it to signal alignment between what was said or expected and what actually happened.',
    examples: [
      { japanese: '計画通りに進んでいる。', english: 'Things are progressing as planned.' },
      { japanese: '言ったとおりにやってみた。', english: 'I tried it the way you said.' },
    ],
  },
  {
    match: /^でも$|でも(?!い)/,
    title: 'Support bridge: contrast conjunction and approximate suggestion (でも)',
    excerpt:
      'でも has two main uses. As a conjunction ("but / however"), it introduces a statement that contrasts with or limits the previous one — it is softer than しかし. As a follow-noun marker ("or something like / even X"), it suggests a rough, uncommitted option: コーヒーでも飲む？ = "Shall we get coffee or something?" Context distinguishes the two.',
    examples: [
      { japanese: 'やってみた。でも、うまくいかなかった。', english: 'I tried. But it did not go well.' },
      { japanese: '散歩でもしない？', english: 'How about a walk or something?' },
    ],
  },
  {
    match: /つづける|続ける/,
    title: 'Support bridge: continuing an action (続ける)',
    excerpt:
      'て+続ける ("keep doing / continue doing") attaches to the te-form to express that an action continues without stopping. It emphasises duration or persistence. Contrast with ている, which describes a state or a habitual action — 続ける specifically adds that the action keeps going uninterrupted.',
    examples: [{ japanese: '3時間歩き続けた。', english: 'I kept walking for 3 hours.' }],
  },
  {
    match: /からして|から見ると|から見れば/,
    title: 'Support bridge: judgement from evidence (からして)',
    excerpt:
      'からして ("judging from / even / given") draws a conclusion or makes a judgement based on observable evidence. It often implies "if even X is the case, then the conclusion must be true." It is stronger than simply saying "because" — it picks out a single telling detail as a basis for the whole judgement.',
    examples: [{ japanese: '話し方からして、外国人だとわかった。', english: 'Judging from how they spoke, I could tell they were a foreigner.' }],
  },
  {
    match: /たった|たった(の)|わずか/,
    title: 'Support bridge: small quantity emphasis (たった / わずか)',
    excerpt:
      'たった("only/just") emphasises that an amount is surprisingly small. たったの further intensifies the smallness. わずか is a more formal equivalent meaning "a mere / only a little." All three are placed before a quantity word and suggest the speaker finds the amount insufficient or unexpectedly small.',
    examples: [{ japanese: 'たった5分で終わった。', english: 'It finished in just five minutes.' }],
  },
]

export function getMaynardSupport(grammar: GrammarItem): MaynardRef | undefined {
  if (grammar.maynardRef) return grammar.maynardRef
  const fallback = FALLBACKS.find(entry => entry.match.test(grammar.pattern))
  if (!fallback) return undefined
  return {
    topicId: `curated-support:${grammar.pattern}`,
    title: fallback.title,
    excerpt: fallback.excerpt,
    examples: fallback.examples,
  }
}

export function hasMaynardSupport(grammar: GrammarItem) {
  return Boolean(getMaynardSupport(grammar))
}
