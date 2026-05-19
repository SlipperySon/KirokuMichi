import type { GrammarItem } from './curriculumService'
import { findMaynardDirectRef } from './maynardDirectRefs.generated'

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
    match: /^ため$|ために|ための|ためだ|ため\(に\)/,
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
  {
    match: /^また$|^も又$|^また(?:は)?$/,
    title: 'Support bridge: also / alternatively (また)',
    excerpt:
      'また can mean "also / in addition" (listing further items or facts) or "alternatively / or" (presenting a second option). At the sentence level it often starts a new point that parallels or continues the previous one. Context tells you whether the relationship is additive ("and also") or alternative ("or alternatively").',
    examples: [
      { japanese: '彼は親切だ。また、頭もいい。', english: 'He is kind. Also, he is smart.' },
    ],
  },
  {
    match: /^まず$|まず最初に|第一に/,
    title: 'Support bridge: first of all / to begin with (まず)',
    excerpt:
      'まず ("first of all / to begin with") opens a sequence or sets up the first step before others follow. It frames what comes next as the starting point of a multi-step process or reasoning chain. Often followed by 次に, そして, or 最後に to complete the sequence.',
    examples: [{ japanese: 'まず、材料を準備してください。', english: 'First of all, please prepare the ingredients.' }],
  },
  {
    match: /ものの|ものを/,
    title: 'Support bridge: concessive although (ものの)',
    excerpt:
      'ものの ("although / even though / however") follows a plain-form clause to acknowledge that the first part is true while introducing a contrasting or unfulfilled result. The speaker accepts X but asserts that Y did not follow as one might expect. It is more formal and literary than が or けれど.',
    examples: [{ japanese: '努力はしたものの、結果は出なかった。', english: 'Although I made an effort, no results came.' }],
  },
  {
    match: /なお①|なお②|^なお$|なお、/,
    title: 'Support bridge: furthermore / note that (なお)',
    excerpt:
      'なお in discourse has two uses: (1) "furthermore / still / moreover" — it adds a related point that continues or intensifies what came before; (2) a written-language warning or note signal — "please note that / it should be mentioned that." The second usage is common in formal announcements, contracts, and academic writing.',
    examples: [
      { japanese: 'なお、詳細は別紙をご参照ください。', english: 'Please note that for details, please refer to the attached sheet.' },
    ],
  },
  {
    match: /にみえる|とみえる|に見える|と見える/,
    title: 'Support bridge: appears to be / seems like (にみえる / とみえる)',
    excerpt:
      'にみえる ("looks like / appears to be") describes how something visually or perceptually comes across to the observer. とみえる is similar but often used in more inferential contexts — "it seems that / judging by appearance." Both are milder assertions than断言 (flat statement) and respect epistemic distance.',
    examples: [{ japanese: '彼は疲れているとみえる。', english: 'He appears to be tired.' }],
  },
  {
    match: /ほかに|ほか\(に\)|ほかにも|他にも/,
    title: 'Support bridge: besides / in addition to (ほかに)',
    excerpt:
      'ほかに ("besides / in addition to / apart from") introduces additional items or alternatives beyond what has already been stated. ほかにも adds "also" to signal that the list is open. It can precede nouns or appear alone in a question: 他にありますか = "Is there anything else?"',
    examples: [{ japanese: 'ほかに質問はありますか。', english: 'Are there any other questions?' }],
  },
  {
    match: /につけ|につけて/,
    title: 'Support bridge: whenever / every time (につけ)',
    excerpt:
      'につけ ("whenever / every time / each time") follows a noun or plain-form verb to express that one thing invariably accompanies or triggers another. It often describes an emotional or habitual response. The tone is reflective — each occurrence of X reliably calls up Y.',
    examples: [{ japanese: '彼女を見るにつけ、昔のことを思い出す。', english: 'Whenever I see her, I am reminded of the past.' }],
  },
  {
    match: /はたして|果たして/,
    title: 'Support bridge: indeed, as expected / will it really? (はたして)',
    excerpt:
      'はたして has two opposite-facing uses. In rhetorical questions it means "really? / will it actually?" — expressing doubt about whether something is possible or true. In declarative sentences it means "indeed / as expected / sure enough" — confirming that what was hoped or feared came to pass.',
    examples: [
      { japanese: 'はたして間に合うだろうか。', english: 'Will it really make it in time, I wonder?' },
      { japanese: 'はたして、彼の言った通りになった。', english: 'Sure enough, it turned out just as he said.' },
    ],
  },
  // ── Round 5 additions ─────────────────────────────────────────────────────
  {
    match: /ざる(?:を得ない)?|ざるを|ざるべ/,
    title: 'Support bridge: classical negative (～ざる)',
    excerpt:
      '～ざる is the classical/literary negative attributive form of verbs, equivalent to modern ～ない in prenominal position. It appears in set phrases such as ざるを得ない ("cannot help but / must") and in formal writing. Understanding it unlocks a large family of literary expressions.',
    examples: [
      { japanese: '言わざるを得ない。', english: 'I cannot help but say it.' },
      { japanese: '見ざる、聞かざる、言わざる。', english: 'See no evil, hear no evil, speak no evil.' },
    ],
  },
  {
    match: /のうち(?:で|に|の)?|のうちから/,
    title: 'Support bridge: among / within (～のうち(で))',
    excerpt:
      'のうち(で) ("among / within / out of") selects from a defined set or range. It is used to pick one or more items from a group, or to indicate a time window during which something occurs. The で or に that follows determines whether the phrase is adverbial or adjectival.',
    examples: [
      { japanese: '三つのうち、どれが一番好きですか。', english: 'Among the three, which do you like best?' },
      { japanese: '一週間のうちに終わらせます。', english: 'I will finish it within a week.' },
    ],
  },
  {
    match: /[～〜]ら|彼ら|私ら|僕ら|君ら|あなたら|子どもら|人ら/,
    title: 'Support bridge: pluralising suffix (～ら)',
    excerpt:
      '～ら is an informal pluralising suffix attached to pronouns and certain nouns (彼ら, 彼女ら, 私ら, 君たち). It carries a slightly blunt or masculine register compared to ～たち. In some contexts it conveys slight contempt or distance; in others it is simply colloquial.',
    examples: [
      { japanese: '彼らはもう帰った。', english: 'They have already gone home.' },
      { japanese: '子どもらが遊んでいる。', english: 'The kids are playing.' },
    ],
  },
  {
    match: /[～〜]代|[0-9〇一二三四五六七八九十百千万]+代|年代|世代/,
    title: 'Support bridge: decade / generation / age group (～代)',
    excerpt:
      '～代 attached to a decade number (30代 = "one\'s thirties", 20代 = "twenties") expresses an age band. Combined with 年 it can mean an era or decade in history (1990年代 = "the 1990s"). The suffix also forms words for successive generations (二代目 = "second generation").',
    examples: [
      { japanese: '彼女は30代に見える。', english: 'She looks like she is in her thirties.' },
      { japanese: '1980年代の音楽が好きです。', english: 'I like music from the 1980s.' },
    ],
  },
  {
    match: /以下|いか(?!\w)|以下の通り/,
    title: 'Support bridge: below / under / as follows (以下)',
    excerpt:
      '以下 ("below / under / the following") can mean a numerical value that is less than or equal to a threshold (18歳以下 = "18 and under"), or it introduces a list ("the following"). It is the inclusive lower-bound counterpart of 未満 (exclusive: strictly less than).',
    examples: [
      { japanese: '18歳以下は入場できません。', english: 'Those 18 and under cannot enter.' },
      { japanese: '以下の点に注意してください。', english: 'Please pay attention to the following points.' },
    ],
  },
  {
    match: /以外|いがい(?!\w)|以外の|以外に/,
    title: 'Support bridge: except / besides / other than (以外)',
    excerpt:
      '以外 ("except for / besides / other than") excludes the preceding noun from a statement. It sets a boundary: everything outside that category is included. Common patterns: 以外に ("besides / in addition to" — pointing outward) and 以外は ("except" — pointing inward at the excluded item).',
    examples: [
      { japanese: '日本語以外の言語も勉強しています。', english: 'I am studying languages other than Japanese too.' },
      { japanese: '彼以外は全員合格した。', english: 'Everyone except him passed.' },
    ],
  },
  {
    match: /お～願う|お願い(?:します|いたします)|お[ぁ-ん一-龯]+願[いう]/,
    title: 'Support bridge: formal polite request (お～願う)',
    excerpt:
      'お～願う is a formal and polite request pattern: お + verb stem + 願う/願います/願えますか. The politeness level sits above ～てください, making it suitable for business or service contexts. お願いします is the lexicalised standalone version; お知らせ願います, ご確認願います follow the productive pattern.',
    examples: [
      { japanese: 'ご確認のほど、よろしくお願いいたします。', english: 'I humbly ask for your confirmation.' },
      { japanese: 'こちらにご記入願います。', english: 'Please fill this in here.' },
    ],
  },
  {
    match: /および|及び/,
    title: 'Support bridge: and / as well as (および)',
    excerpt:
      'および (及び) is a formal written conjunction meaning "and / as well as." It connects nouns, noun phrases, or clauses in official documents, laws, and business writing. Unlike と (spoken) or それから (sequential), および is neutral about order and implies parallel or equal status of the connected items.',
    examples: [
      { japanese: '名前および住所を記入してください。', english: 'Please fill in your name and address.' },
      { japanese: '費用および日程については別途連絡します。', english: 'We will contact you separately regarding costs and the schedule.' },
    ],
  },
  {
    match: /か何か|か(?:なに|なん)か|かなにか/,
    title: 'Support bridge: or something / something like that (か何か)',
    excerpt:
      'か何か ("or something / something like that") is placed after a noun to indicate an imprecise alternative or a vague member of a category. It softens the statement, suggesting the speaker does not know or care exactly which item applies. It is more casual than など and more specific-sounding than ～とか.',
    examples: [
      { japanese: 'お茶か何か飲みますか。', english: 'Would you like some tea or something?' },
      { japanese: '薬か何か飲んだほうがいいよ。', english: 'You should take some medicine or something.' },
    ],
  },
  {
    match: /けっこう|結構(?!です|な)/,
    title: 'Support bridge: quite / rather / fairly (けっこう)',
    excerpt:
      'けっこう as an adverb means "quite / rather / fairly / surprisingly" — indicating that the degree exceeds expectations. It is distinct from 結構です ("no thank you" or "that\'s fine"), which is an adjectival use. As a modifier it precedes い-adjectives, な-adjectives, or verbs: けっこう難しい = "quite difficult."',
    examples: [
      { japanese: 'この問題はけっこう難しい。', english: 'This problem is quite difficult.' },
      { japanese: 'けっこう時間がかかった。', english: 'It took quite a bit of time.' },
    ],
  },
  {
    match: /そういう|そのような|そんな/,
    title: 'Support bridge: that kind of / such (そういう)',
    excerpt:
      'そういう ("that kind of / such / that sort of") is a prenominal phrase combining そう (that way) + いう (say/call). It refers back to a situation or category just mentioned. そういう人 = "a person like that"; そういうこと = "that kind of thing / so that\'s how it is." It often signals the speaker is summing up or categorising.',
    examples: [
      { japanese: 'そういう問題が増えている。', english: 'That kind of problem is increasing.' },
      { japanese: 'そういうことか、わかった。', english: 'Ah, that\'s how it is — I understand now.' },
    ],
  },
  {
    match: /たちまち/,
    title: 'Support bridge: immediately / in an instant / at once (たちまち)',
    excerpt:
      'たちまち ("immediately / in an instant / before one knows it") describes an extremely rapid change of state or result. It often has a dramatic flavour — a fire spreading, a crowd gathering, a problem arising — where the swiftness itself is noteworthy. Unlike すぐに (simply "soon/right away"), たちまち implies the speed was striking.',
    examples: [
      { japanese: 'たちまち人々が集まってきた。', english: 'People gathered in an instant.' },
      { japanese: 'ニュースはたちまち広まった。', english: 'The news spread in no time.' },
    ],
  },
  {
    match: /っけ|だっけ|でしたっけ/,
    title: 'Support bridge: recollection / reminder particle (っけ)',
    excerpt:
      'っけ is a sentence-final particle that expresses trying to recall something or seeking confirmation of a vague memory. It conveys "let me see... was it... ?" or "remind me — wasn\'t it...?" It attaches to plain-form verbs and adjectives (行くんだっけ) or to だ (だっけ). Tone is casual and self-directed.',
    examples: [
      { japanese: '彼の名前、なんだっけ？', english: 'What was his name again?' },
      { japanese: '明日は休みだっけ？', english: 'Tomorrow is a holiday, right? (I\'m trying to remember.)' },
    ],
  },
  {
    match: /でできる|からできる|で作られ|から作られ|でできた|からできた/,
    title: 'Support bridge: made of / made from (で / から + できる)',
    excerpt:
      'Two particles mark the material something is made of. で indicates the material is visibly present in the final product (木でできたテーブル = a table made of wood). から indicates transformation — the original material is not obvious in the result (牛乳からバターができる = butter is made from milk). Both use できている or 作られている.',
    examples: [
      { japanese: 'この橋は石でできています。', english: 'This bridge is made of stone.' },
      { japanese: 'ワインはブドウから作られます。', english: 'Wine is made from grapes.' },
    ],
  },
  {
    match: /と.*と.*どちら|どちらが.*より|[AＡ]と.*[BＢ]と|と[～〜]と/,
    title: 'Support bridge: which is more... A or B? (と～と、どちらが)',
    excerpt:
      'The comparison pattern AとBとどちらが～ですか asks "which of A and B is more ～?" The answer uses AのほうがBより～です ("A is more ～ than B"). This is the standard textbook structure for binary comparisons. どちら can be replaced by どっち in casual speech.',
    examples: [
      { japanese: '東京と大阪とどちらが大きいですか。', english: 'Which is bigger, Tokyo or Osaka?' },
      { japanese: '電車とバスとどちらが速いですか。', english: 'Which is faster, the train or the bus?' },
    ],
  },
  {
    match: /といい(?:ですね|ね|のに|が)?|たらいい|ばいい/,
    title: 'Support bridge: it would be good if / I hope (といい)',
    excerpt:
      'といい (often written と良い or といいですね) expresses a hope or mild wish: "it would be nice if ～ / I hope ～." It attaches to the plain non-past form of verbs. The speaker does not control the outcome — this is a wish directed at circumstances or someone else. Warmer variants: といいね (casual) / といいですね (polite).',
    examples: [
      { japanese: '早く良くなるといいですね。', english: 'I hope you get better soon.' },
      { japanese: '明日晴れるといいな。', english: 'I hope it\'s sunny tomorrow.' },
    ],
  },
  {
    match: /どうせ/,
    title: 'Support bridge: anyway / after all / no matter what (どうせ)',
    excerpt:
      'どうせ ("anyway / after all / it\'s no use") expresses resigned acceptance or cynical inevitability. The speaker implies that a negative outcome is certain regardless of effort, or that something does not matter either way. It often precedes ～から, ～だから, or ～ならば to complete the logical consequence.',
    examples: [
      { japanese: 'どうせ無駄だよ。', english: 'It\'s no use anyway.' },
      { japanese: 'どうせ来ないと思っていた。', english: 'I figured he wouldn\'t come after all.' },
    ],
  },
  {
    match: /と聞いた|ときいた|と聞きました/,
    title: 'Support bridge: I heard that / was told that (と聞いた)',
    excerpt:
      'と聞いた / と聞きました ("I heard that / I was told that") reports information obtained from someone else. The と quotes the content; 聞いた is the verb of hearing. It sits between ～そうだ (based on appearance) and ～らしい (based on hearsay) in that it implies a specific act of hearing rather than general rumour.',
    examples: [
      { japanese: '彼は来ないと聞きました。', english: 'I heard that he is not coming.' },
      { japanese: '試験が難しかったと聞いた。', english: 'I heard the exam was difficult.' },
    ],
  },
  {
    match: /なにやら|何やら/,
    title: 'Support bridge: something (vague / mysterious) (なにやら)',
    excerpt:
      'なにやら ("something or other / I don\'t know what / somehow") conveys that the speaker perceives or senses something but cannot or does not specify what. It has a mildly mysterious or uncertain flavour, often used when describing sounds, atmosphere, or feelings that are unclear. More literary than なんか or なんとなく.',
    examples: [
      { japanese: '何やら変な音がする。', english: 'There\'s some kind of strange sound.' },
      { japanese: '何やら楽しそうな話をしている。', english: 'They seem to be talking about something fun (I\'m not sure what).' },
    ],
  },
  {
    match: /に気が付く|にきがつく|気づく|気がつく/,
    title: 'Support bridge: to notice / to become aware of (に気が付く)',
    excerpt:
      '気が付く / 気づく ("to notice / to become aware of / to realise") marks the moment of perception — the transition from not knowing to knowing. The に particle marks what is noticed. Compare with 知る (to come to know — more cognitive) and 分かる (to understand). 気づく is slightly more sudden; 気が付く slightly more gradual.',
    examples: [
      { japanese: '財布がないことに気が付いた。', english: 'I noticed that my wallet was gone.' },
      { japanese: '間違いに気づくのが遅かった。', english: 'I was slow to notice the mistake.' },
    ],
  },
  {
    match: /にて/,
    title: 'Support bridge: formal at / in / by / with (にて)',
    excerpt:
      'にて is the formal or classical equivalent of で, used in official announcements, written notices, and historical texts. It can mark location ("at"), means ("by/with"), or scope ("within"). In modern usage it appears in formal contexts: 当社にて = "at our company", 以上をもちましてにて = closing formulas in speeches.',
    examples: [
      { japanese: '当ホテルにてご用意いたします。', english: 'We will prepare it at this hotel.' },
      { japanese: '締め切りは金曜日にて終了となります。', english: 'The deadline concludes on Friday.' },
    ],
  },
  {
    match: /に応えて|に応える|に応え/,
    title: 'Support bridge: in response to / meeting expectations (に応えて)',
    excerpt:
      'に応えて ("in response to / meeting / living up to") indicates an action taken in fulfillment of someone\'s expectations, request, or need. The に marks the expectation or demand being met. Contrast with に応じて (adjusting to circumstances — more adaptive) — に応えて implies specifically fulfilling what was asked or hoped for.',
    examples: [
      { japanese: 'ご期待に応えて全力を尽くします。', english: 'I will do my best to live up to your expectations.' },
      { japanese: '要望に応えて新機能を追加しました。', english: 'We added a new feature in response to requests.' },
    ],
  },
  {
    match: /に気をつける|に気をつけ/,
    title: 'Support bridge: to be careful about / to pay attention to (に気をつける)',
    excerpt:
      'に気をつける ("to be careful about / to pay attention to / to watch out for") directs intentional awareness toward a potential risk or important detail. に marks what is being attended to. It is commonly used in instructions and warnings: 健康に気をつけてください = "Please take care of your health."',
    examples: [
      { japanese: '体に気をつけてね。', english: 'Take care of yourself.' },
      { japanese: '車に気をつけてください。', english: 'Please watch out for cars.' },
    ],
  },
  {
    match: /に限らず|にかぎらず|に限った/,
    title: 'Support bridge: not limited to / not only (に限らず)',
    excerpt:
      'に限らず ("not limited to / not only / beyond just") signals that the scope is broader than the stated item. It introduces a contrasting expansion: "not just X, but also Y and Z." Derived from 限る ("to limit"), the negative form opens the set rather than closing it. Formal register; often seen in written Japanese.',
    examples: [
      { japanese: '日本に限らず、アジア全体で問題になっている。', english: 'It is a problem not just in Japan but throughout Asia.' },
      { japanese: '子どもに限らず、大人も楽しめる。', english: 'Not just children but adults can enjoy it too.' },
    ],
  },
  {
    match: /^ぬ$|せぬ|できぬ|知らぬ|わからぬ|おわらぬ|あらぬ|[〜～]ぬ/,
    title: 'Support bridge: classical negative (～ぬ)',
    excerpt:
      '～ぬ is the classical negative auxiliary, equivalent to modern ～ない. It appears in set phrases (知らぬ存ぜぬ, 終わらぬ夢), proverbs, literary texts, and formal registers. In contemporary Japanese it survives most actively in fixed expressions and song/poetry. Conjugation: verb stem + ぬ (e.g. 行かぬ = 行かない).',
    examples: [
      { japanese: '知らぬが仏。', english: 'Ignorance is bliss. (lit. Not knowing is Buddha.)' },
      { japanese: '終わらぬ旅。', english: 'A journey without end.' },
    ],
  },
  {
    match: /^まい$|するまい|すまい|くるまい|[〜～]まい|二度とまい/,
    title: 'Support bridge: negative volitional / won\'t / it probably won\'t (まい)',
    excerpt:
      'まい is the classical/formal negative volitional auxiliary: "I will not / I don\'t intend to / it probably won\'t." It attaches to dictionary-form verbs (Group 1 & 2), する → するまい or すまい, くる → くるまい. It is more literary than ～ないだろう or ～ないつもりだ, and sounds resolute or resigned depending on context.',
    examples: [
      { japanese: 'もう二度と遅刻するまい。', english: 'I will never be late again.' },
      { japanese: 'そんなことはあるまい。', english: 'That probably won\'t happen.' },
    ],
  },
  {
    match: /もの・もん|もの(?:ね|な|ですね|だもの|だもん)|だもん|だもの/,
    title: 'Support bridge: explanatory / emotive sentence-final (もの・もん)',
    excerpt:
      'もの (or colloquial もん) as a sentence-final particle provides an explanation or justification with an emotional, slightly defensive nuance — "because / after all / it\'s just that." It is associated with feminine or childlike speech. だもの / だもん softens a complaint or excuse: 仕方ないもの = "There\'s nothing I can do about it, you know."',
    examples: [
      { japanese: '行きたくないもん。', english: 'I don\'t want to go (and that\'s that).' },
      { japanese: '疲れたんだもの、仕方ないじゃない。', english: 'I\'m tired, so there\'s nothing I can do about it.' },
    ],
  },
  {
    match: /ものか|もんか|もんですか/,
    title: 'Support bridge: no way / as if (ものか)',
    excerpt:
      'ものか (or emphatic もんか) is a strongly negative rhetorical expression: "as if I would! / no way!" It follows the plain form of verbs and adjectives and expresses indignant refusal or disbelief. The speaker vigorously rejects the implied proposition. In writing it sometimes appears as もの(か) with a question mark, making the rhetorical force explicit.',
    examples: [
      { japanese: '負けるものか！', english: 'As if I\'d lose! / No way am I losing!' },
      { japanese: 'そんなこと信じるものか。', english: 'As if I\'d believe something like that.' },
    ],
  },
  {
    match: /も構わず|もかまわず|に構わず/,
    title: 'Support bridge: regardless of / without minding (も構わず)',
    excerpt:
      'も構わず ("regardless of / without caring about / paying no heed to") indicates that someone proceeds with an action while ignoring or disregarding something that might normally be a concern. It often highlights a surprising or socially notable disregard. Derived from 構う ("to mind / to care about") + negative form.',
    examples: [
      { japanese: '周りの目も構わず泣き出した。', english: 'She burst into tears regardless of others\' eyes.' },
      { japanese: '雨も構わず走り続けた。', english: 'He kept running without minding the rain.' },
    ],
  },
  {
    match: /やがて/,
    title: 'Support bridge: before long / eventually / in time (やがて)',
    excerpt:
      'やがて ("before long / eventually / soon / in due course") indicates that something will happen after a natural passage of time — not immediately, but inevitably. It has a slightly literary or narrative tone, often used in storytelling or reflective writing. Contrast with そのうち (vague future) and まもなく (imminent).',
    examples: [
      { japanese: 'やがて春が来るだろう。', english: 'Spring will come before long.' },
      { japanese: 'やがて彼女は真実を知った。', english: 'Eventually she learned the truth.' },
    ],
  },
  {
    match: /やら.*やら|やら[^。]*やら/,
    title: 'Support bridge: things like... and... / whether... or... (やら～やら)',
    excerpt:
      'やら～やら ("things like ～ and ～ / I don\'t know whether ～ or ～") has two uses. (1) Listing: non-exhaustively lists two or more items (usually negative or burdensome) — 泣くやら笑うやら = "some crying, some laughing." (2) Uncertainty: expresses not knowing which of two possibilities applies — 夢やら現実やら = "whether a dream or reality."',
    examples: [
      { japanese: '嬉しいやら悲しいやら、複雑な気持ちだ。', english: 'I have mixed feelings — happy and sad all at once.' },
      { japanese: '荷物やら書類やらで部屋がいっぱいだ。', english: 'The room is full of things like luggage and documents.' },
    ],
  },
  {
    match: /をはじめ|をはじめとして|を始め/,
    title: 'Support bridge: starting with / including (をはじめ)',
    excerpt:
      'をはじめ(として) ("starting with / including / ～ and others") introduces a representative example that heads a larger group. It signals that the named item is the most prominent of many similar things. をはじめとする precedes a noun to form an adjectival phrase; をはじめとして stands alone adverbially.',
    examples: [
      { japanese: '東京をはじめ、日本の主要都市で開催されます。', english: 'It will be held in major Japanese cities, starting with Tokyo.' },
      { japanese: '田中さんをはじめとするチームが優勝した。', english: 'The team headed by Tanaka won the championship.' },
    ],
  },
  {
    match: /を込めて|をこめて|込めて/,
    title: 'Support bridge: filled with / putting in (feeling) (を込めて)',
    excerpt:
      'を込めて ("filled with / putting ～ into / with ～") expresses performing an action while channelling a strong feeling or intention into it. The を marks the feeling being poured in (愛情を込めて = "with love / filled with affection"). It is often used with gifts, creative work, or heartfelt actions.',
    examples: [
      { japanese: '心を込めて作りました。', english: 'I made it with all my heart.' },
      { japanese: '感謝の気持ちを込めてプレゼントを贈った。', english: 'I gave a gift filled with gratitude.' },
    ],
  },
  {
    match: /を除いて|を除く|を除き/,
    title: 'Support bridge: excluding / except for (を除いて)',
    excerpt:
      'を除いて / を除き ("excluding / except for / leaving out") marks what is removed from a set or consideration. It is more formal than 以外で and often used in written or official contexts. を除いた + noun forms an adjectival clause: 彼を除いた全員 = "everyone excluding him."',
    examples: [
      { japanese: '週末を除いて毎日開いています。', english: 'We are open every day except weekends.' },
      { japanese: '彼女を除いて全員が賛成した。', english: 'Everyone except her agreed.' },
    ],
  },
  {
    match: /一応(?:\s*①)?/,
    title: 'Support bridge: just in case / for now / tentatively (一応 ①)',
    excerpt:
      '一応 ① ("just in case / for the time being / as a formality") indicates doing something as a precaution or preliminary measure without necessarily expecting it to matter. The action is completed but the speaker implies it may not be sufficient or final. Common in phrases like 一応確認しておく = "check just to be safe."',
    examples: [
      { japanese: '一応、傘を持っていった。', english: 'Just in case, I brought an umbrella.' },
      { japanese: '一応報告しておきます。', english: 'I will report it for now (as a formality).' },
    ],
  },
  {
    match: /一応\s*②|一応.*(?:最低限|基準|合格|及第)/,
    title: 'Support bridge: meets a minimum standard / provisionally acceptable (一応 ②)',
    excerpt:
      '一応 ② signals that something meets a basic threshold or is provisionally acceptable — without enthusiasm. It softens a qualified approval: 一応できる = "can do it (but perhaps not perfectly)." This is distinct from use ① (just in case) — here the speaker rates adequacy rather than taking precaution.',
    examples: [
      { japanese: '一応完成した。', english: 'It\'s done, more or less.' },
      { japanese: '一応使えるが、もっといい方法がある。', english: 'It\'s usable for now, but there\'s a better way.' },
    ],
  },
  {
    match: /一旦/,
    title: 'Support bridge: once / for now / temporarily (一旦)',
    excerpt:
      '一旦 ("once / for the time being / temporarily") has two senses. (1) Temporal boundary: 一旦～たら/すると = "once [something happens], then..." — marks a threshold after which a new state holds. (2) Temporary pause: 一旦止める = "stop for now" — implies the action will resume. In both uses it marks a meaningful transition point.',
    examples: [
      { japanese: '一旦家に帰ってから、また来ます。', english: 'I\'ll go home for now and come back again.' },
      { japanese: '一旦決めたら、変えられない。', english: 'Once you decide, you can\'t change it.' },
    ],
  },
  {
    match: /万が一|まんがいち/,
    title: 'Support bridge: just in case / in the unlikely event (万が一)',
    excerpt:
      '万が一 ("just in case / in the unlikely event that / if by any chance") is a formal and emphatic version of もし. It highlights that the speaker considers the scenario unlikely or undesirable but worth preparing for. Literally "one in ten thousand," it underscores the rarity of the condition. Often paired with ～場合は or ～ても.',
    examples: [
      { japanese: '万が一の場合に備えて保険に入っている。', english: 'I have insurance as a precaution against the unlikely worst case.' },
      { japanese: '万が一道に迷ったら、電話してください。', english: 'If by any chance you get lost, please call.' },
    ],
  },
  {
    match: /^中$|中(?:に|で|の|じゅう|ちゅう)|世界中|一日中|年中|会議中/,
    title: 'Support bridge: during / throughout / all over (中)',
    excerpt:
      '中 (じゅう/ちゅう) adds "throughout / all over / the whole" when suffixed to time or place words. 世界中 = "throughout the world," 一日中 = "all day long," 年中 = "year-round." In the pattern ～の中で it means "among" or "inside." The reading ちゅう is common in compounds (会議中 = "during the meeting").',
    examples: [
      { japanese: '世界中で人気があります。', english: 'It is popular throughout the world.' },
      { japanese: '会議中は電話に出られません。', english: 'I cannot answer the phone during the meeting.' },
    ],
  },
  {
    match: /何しろ|なにしろ|何せ|なにせ/,
    title: 'Support bridge: anyway / after all / in any case (何しろ)',
    excerpt:
      '何しろ (or 何せ) introduces the most salient or decisive reason, often as an explanation or excuse: "because, above all / after all / in any case." It signals that the following clause is the most important factor. Tone ranges from resigned to emphatic. Common in spoken Japanese; slightly more formal than とにかく.',
    examples: [
      { japanese: '何しろ、初めての経験だから仕方ない。', english: 'After all, it\'s my first experience, so it can\'t be helped.' },
      { japanese: '何しろ値段が安いのが一番の魅力だ。', english: 'Above all, the low price is its biggest appeal.' },
    ],
  },
  // ── Round 6 additions ─────────────────────────────────────────────────────
  {
    match: /反面|はんめん/,
    title: 'Support bridge: on the other hand / while (反面)',
    excerpt:
      '反面 ("on the other hand / while / at the same time") introduces a contrasting or negative aspect of something that was just stated positively. It highlights that a single thing has two opposing dimensions — a strength paired with a weakness, a benefit paired with a cost. More formal than が and stronger than けれど.',
    examples: [
      { japanese: '便利な反面、コストがかかる。', english: 'While it is convenient, on the other hand it costs a lot.' },
      { japanese: '彼は優しい反面、優柔不断だ。', english: 'He is kind, but on the other hand he is indecisive.' },
    ],
  },
  {
    match: /向き|むき/,
    title: 'Support bridge: suited for / facing / oriented toward (向き)',
    excerpt:
      '向き ("suited for / oriented toward / facing") indicates suitability for a person or purpose (初心者向き = "suitable for beginners") or physical direction (南向き = "south-facing"). Contrast with 向け: 向き describes inherent fitness, while 向け describes intentional targeting ("aimed at").',
    examples: [
      { japanese: 'この本は初心者向きです。', english: 'This book is suited for beginners.' },
      { japanese: '南向きの部屋が好きです。', english: 'I like south-facing rooms.' },
    ],
  },
  {
    match: /向け|むけ/,
    title: 'Support bridge: aimed at / targeted at (向け)',
    excerpt:
      '向け ("aimed at / for / targeted at") indicates that something was designed or intended for a specific audience or purpose. Unlike 向き (inherent fitness), 向け implies deliberate targeting — the creator chose that audience. 子ども向けの番組 = "a program made for children."',
    examples: [
      { japanese: '子ども向けの映画が公開された。', english: 'A movie aimed at children was released.' },
      { japanese: 'このサービスはビジネス向けです。', english: 'This service is targeted at businesses.' },
    ],
  },
  {
    match: /後\(の\)|後の(?:名詞|Noun)|あとの|のちの/,
    title: 'Support bridge: subsequent noun / post- (後(の) Noun)',
    excerpt:
      '後(の) + Noun creates a noun phrase meaning "subsequent / following / later" — the noun that comes after or results from a prior action. 後の祭り = "too late after the festival" (nothing can be done now). In grammar notes this pattern highlights how 後 nominalises a preceding clause: 食べた後(の)時間 = "the time after eating."',
    examples: [
      { japanese: '会議の後の懇親会に参加した。', english: 'I attended the social gathering after the meeting.' },
      { japanese: '試験の後の解放感は格別だ。', english: 'The sense of liberation after the exam is special.' },
    ],
  },
  {
    match: /手前|てまえ/,
    title: 'Support bridge: in front of / just before / for appearances (手前)',
    excerpt:
      '手前 has three main uses. (1) Physical location: "just before / in front of" (駅の手前 = "just before the station"). (2) Social obligation: "because of how things look / for the sake of appearances" — the speaker feels bound by what others would think (人の手前, 立場の手前). (3) Humble "my side / my end" in business Japanese.',
    examples: [
      { japanese: '交差点の手前で止まってください。', english: 'Please stop just before the intersection.' },
      { japanese: '部下の手前、弱みを見せられない。', english: 'For the sake of appearances in front of my subordinates, I can\'t show weakness.' },
    ],
  },
  {
    match: /抜く|ぬく(?:ほど)?|やり抜|走り抜|頑張り抜/,
    title: 'Support bridge: to do all the way through / to endure to the end (抜く)',
    excerpt:
      '抜く as a suffix verb (Verb stem + 抜く) means "to do something all the way through to the end / to persist to completion." It adds a sense of enduring difficulty or going the full distance. やり抜く = "to carry through / see it to the end"; 走り抜く = "to run all the way through."',
    examples: [
      { japanese: 'どんなに辛くても最後までやり抜いた。', english: 'No matter how hard it was, I carried it through to the end.' },
      { japanese: 'マラソンを走り抜いた。', english: 'I ran the whole marathon through to the end.' },
    ],
  },
  {
    match: /^気$|気がする|気になる|気をつかう|気に入る|気(?:が|に|を)/,
    title: 'Support bridge: feeling / spirit / attention (気)',
    excerpt:
      '気 (き) is one of the most productive nouns in Japanese grammar, forming dozens of set expressions. It broadly means "feeling / spirit / mind / attention." Common patterns: 気がする (I feel like / have a feeling), 気になる (to become curious / bother one), 気に入る (to take a liking to), 気をつける (to be careful). Mastering 気 compounds vastly expands expressive range.',
    examples: [
      { japanese: '何か忘れた気がする。', english: 'I have a feeling I forgot something.' },
      { japanese: '彼のことが気になる。', english: 'He\'s on my mind / I\'m curious about him.' },
    ],
  },
  {
    match: /活かす|活かし|いかす|生かす/,
    title: 'Support bridge: to make use of / to put to good use (活かす)',
    excerpt:
      '活かす (or 生かす) means "to make use of / to put to good use / to leverage." It implies making the most of a resource, talent, or experience — not just using it, but utilising it effectively. Common in business and self-improvement contexts: 経験を活かす = "to leverage one\'s experience."',
    examples: [
      { japanese: '留学の経験を仕事に活かしたい。', english: 'I want to put my study-abroad experience to good use at work.' },
      { japanese: '彼女は才能を活かして成功した。', english: 'She succeeded by making the most of her talent.' },
    ],
  },
  {
    match: /真っ|真\(っ\)|まっすぐ|まっ白|まっ暗|まっ先/,
    title: 'Support bridge: intensifier prefix / utterly / right- (真(っ))',
    excerpt:
      '真(っ) is an intensifying prefix that attaches to adjectives and nouns to mean "utterly / completely / dead / right-." 真っ白 = "pure white," 真っ暗 = "pitch dark," 真っ先 = "first of all / right away," 真っ直ぐ = "straight / directly." The small っ is not always present (真向かい = "directly opposite").',
    examples: [
      { japanese: '部屋が真っ暗だ。', english: 'The room is pitch dark.' },
      { japanese: '真っ先に手を挙げた。', english: 'He was the very first to raise his hand.' },
    ],
  },
  {
    match: /精々|せいぜい/,
    title: 'Support bridge: at most / at best / do one\'s best (精々)',
    excerpt:
      '精々 (せいぜい) has two distinct uses. (1) Ceiling: "at most / at best / no more than" — it sets an upper limit, often implying it is lower than hoped (精々100人くらい = "at most about 100 people"). (2) Exhortation: "do your very best" — 精々頑張ってください = "please do your utmost." Context determines which sense applies.',
    examples: [
      { japanese: '精々一時間で終わるだろう。', english: 'It will finish in an hour at most.' },
      { japanese: '精々努力してください。', english: 'Please do your very best.' },
    ],
  },
  {
    match: /結果・の結果|の結果|した結果|した末/,
    title: 'Support bridge: as a result of / after (結果・の結果)',
    excerpt:
      'Verb + た結果 / Noun + の結果 ("as a result of / after ～") indicates the outcome that followed from an action or process. It presents the consequence as logically or causally following from what preceded. Unlike ので (because) which explains a reason, 結果 highlights the endpoint of a chain of events.',
    examples: [
      { japanese: '話し合った結果、中止することにした。', english: 'As a result of the discussion, we decided to cancel.' },
      { japanese: '努力の結果、合格した。', english: 'As a result of my efforts, I passed.' },
    ],
  },
  {
    match: /聞こえる|きこえる/,
    title: 'Support bridge: to be audible / to sound like (聞こえる)',
    excerpt:
      '聞こえる ("to be audible / to sound like / to be heard") is the spontaneous potential form of 聞く. Unlike 聞く (deliberate listening), 聞こえる describes sound that reaches the ears without intent. It is also used metaphorically: ～に聞こえる = "to come across as / to sound like" (e.g. 失礼に聞こえるかもしれません = "this may sound rude").',
    examples: [
      { japanese: '外から音楽が聞こえる。', english: 'I can hear music from outside.' },
      { japanese: '言い訳に聞こえるかもしれないが…', english: 'It may sound like an excuse, but...' },
    ],
  },
  {
    match: /見える|みえる/,
    title: 'Support bridge: to be visible / to appear / to seem (見える)',
    excerpt:
      '見える ("to be visible / to look like / to seem") is the spontaneous potential form of 見る. Unlike 見る (deliberate looking), 見える describes what comes into view naturally. ～に見える = "to look like / to appear to be" is central: 若く見える = "to look young." See also みえる as a polite form of 来る (to come) in Kansai dialect.',
    examples: [
      { japanese: '山の頂上が見える。', english: 'The mountaintop is visible.' },
      { japanese: '彼は疲れているように見える。', english: 'He looks tired.' },
    ],
  },
  {
    match: /^限り$|限り(?:は|では|において|で)|かぎり(?:は|では)/,
    title: 'Support bridge: as long as / to the extent that / as far as (限り)',
    excerpt:
      '限り has several grammatical uses. (1) Conditional: 〜する限り / 〜である限り = "as long as / so long as" (alive, working, etc.). (2) Scope: 〜の限り = "to the utmost / with all one has" (力の限り = "with all one\'s strength"). (3) Knowledge boundary: 〜の限りでは / 〜が知る限り = "as far as I know."',
    examples: [
      { japanese: '私が知る限り、問題はない。', english: 'As far as I know, there is no problem.' },
      { japanese: '命ある限り、頑張る。', english: 'As long as I am alive, I will keep trying.' },
    ],
  },
]

export function getMaynardSupport(grammar: GrammarItem): MaynardRef | undefined {
  if (grammar.maynardRef) {
    return {
      sourceKind: 'attached',
      ...grammar.maynardRef,
    }
  }
  const direct = findMaynardDirectRef(grammar.pattern)
  if (direct) return direct
  const fallback = FALLBACKS.find(entry => entry.match.test(grammar.pattern))
  if (!fallback) return undefined
  return {
    topicId: `curated-support:${grammar.pattern}`,
    title: fallback.title,
    excerpt: fallback.excerpt,
    examples: fallback.examples,
    sourceKind: 'curated-support',
    confidence: 'curated',
  }
}

export function hasMaynardSupport(grammar: GrammarItem) {
  return Boolean(getMaynardSupport(grammar))
}
