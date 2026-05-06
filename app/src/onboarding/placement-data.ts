export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type CEFRSublevel = 'early' | 'mid' | 'late'

export interface PlacementQuestion {
  id: string
  level: CEFRLevel
  sublevel: CEFRSublevel
  prompt: string
  reading?: string  // furigana shown as hint on A1/A2 levels
  options: string[]
  answer: string
}

// ~7 questions per sublevel, 18 sublevels, ~126 total.
// Conversational and practical focus — differs from strict JLPT.
// Edit this file to update or expand the question bank.
export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [

  // ── A1 Early ─────────────────────────────────────────────────────────────
  {
    id: 'a1e_01', level: 'A1', sublevel: 'early',
    prompt: 'はじめまして、田中＿＿＿ 。',
    reading: 'はじめまして、たなか＿＿＿。',
    options: ['と申します', 'でございます', 'ですね', 'ではない'],
    answer: 'と申します',
  },
  {
    id: 'a1e_02', level: 'A1', sublevel: 'early',
    prompt: 'すみません、お手洗いは＿＿＿ ですか？',
    reading: 'すみません、おてあらいは＿＿＿ ですか？',
    options: ['どこ', 'なに', 'いつ', 'どれ'],
    answer: 'どこ',
  },
  {
    id: 'a1e_03', level: 'A1', sublevel: 'early',
    prompt: 'コーヒーを一杯＿＿＿ 。',
    reading: 'こーひーを いっぱい＿＿＿。',
    options: ['ください', 'あります', 'います', 'どうぞ'],
    answer: 'ください',
  },
  {
    id: 'a1e_04', level: 'A1', sublevel: 'early',
    prompt: '今日は＿＿＿ ですね。(It\'s hot today, isn\'t it?)',
    reading: 'きょうは＿＿＿ ですね。',
    options: ['あつい', 'さむい', 'たかい', 'おおきい'],
    answer: 'あつい',
  },
  {
    id: 'a1e_05', level: 'A1', sublevel: 'early',
    prompt: 'これはいくら＿＿＿ か？',
    reading: 'これは いくら＿＿＿ か？',
    options: ['です', 'でした', 'でしょう', 'ません'],
    answer: 'です',
  },
  {
    id: 'a1e_06', level: 'A1', sublevel: 'early',
    prompt: 'ありがとう＿＿＿ 。(Thank you very much.)',
    reading: 'ありがとう＿＿＿。',
    options: ['ございます', 'あります', 'います', 'なります'],
    answer: 'ございます',
  },
  {
    id: 'a1e_07', level: 'A1', sublevel: 'early',
    prompt: 'この電車は東京＿＿＿ 止まりますか？(Does this train stop at Tokyo?)',
    reading: 'この でんしゃ は とうきょう＿＿＿ とまりますか？',
    options: ['に', 'を', 'が', 'で'],
    answer: 'に',
  },

  // ── A1 Mid ───────────────────────────────────────────────────────────────
  {
    id: 'a1m_01', level: 'A1', sublevel: 'mid',
    prompt: '私は毎朝、ご飯を＿＿＿ 。(I eat rice every morning.)',
    reading: 'わたしは まいあさ、ごはんを＿＿＿。',
    options: ['たべます', 'のみます', 'みます', 'かきます'],
    answer: 'たべます',
  },
  {
    id: 'a1m_02', level: 'A1', sublevel: 'mid',
    prompt: '駅はここから＿＿＿ ですか？(Is the station far from here?)',
    reading: 'えきは ここから＿＿＿ ですか？',
    options: ['とおい', 'ちかい', 'ひろい', 'おおきい'],
    answer: 'とおい',
  },
  {
    id: 'a1m_03', level: 'A1', sublevel: 'mid',
    prompt: '友だちと映画を見＿＿＿ 行きます。(I\'m going to watch a movie with a friend.)',
    reading: 'ともだちと えいがを み＿＿＿ いきます。',
    options: ['に', 'で', 'を', 'が'],
    answer: 'に',
  },
  {
    id: 'a1m_04', level: 'A1', sublevel: 'mid',
    prompt: '弟は学生＿＿＿ 、よく本を読みます。',
    reading: 'おとうとは がくせい＿＿＿、よく ほんを よみます。',
    options: ['なので', 'なのに', 'ながら', 'だけど'],
    answer: 'なので',
  },
  {
    id: 'a1m_05', level: 'A1', sublevel: 'mid',
    prompt: '昨日、友達に電話＿＿＿ 。(I called a friend yesterday.)',
    reading: 'きのう、ともだちに でんわ＿＿＿。',
    options: ['しました', 'します', 'していた', 'している'],
    answer: 'しました',
  },
  {
    id: 'a1m_06', level: 'A1', sublevel: 'mid',
    prompt: 'あの赤い建物＿＿＿ 図書館です。(That red building is the library.)',
    reading: 'あの あかい たてもの＿＿＿ としょかんです。',
    options: ['が', 'を', 'に', 'で'],
    answer: 'が',
  },
  {
    id: 'a1m_07', level: 'A1', sublevel: 'mid',
    prompt: '私の趣味は音楽を＿＿＿ ことです。(My hobby is listening to music.)',
    reading: 'わたしの しゅみは おんがくを＿＿＿ ことです。',
    options: ['きく', 'みる', 'よむ', 'かく'],
    answer: 'きく',
  },

  // ── A1 Late ──────────────────────────────────────────────────────────────
  {
    id: 'a1l_01', level: 'A1', sublevel: 'late',
    prompt: 'スーパーで野菜＿＿＿ 買いました。(I bought vegetables at the supermarket.)',
    reading: 'スーパーで やさい＿＿＿ かいました。',
    options: ['を', 'が', 'に', 'で'],
    answer: 'を',
  },
  {
    id: 'a1l_02', level: 'A1', sublevel: 'late',
    prompt: '明日、暇＿＿＿ 、一緒に行きませんか？(If you\'re free tomorrow, shall we go together?)',
    reading: 'あした、ひま＿＿＿、いっしょに いきませんか？',
    options: ['だったら', 'だから', 'だけど', 'なので'],
    answer: 'だったら',
  },
  {
    id: 'a1l_03', level: 'A1', sublevel: 'late',
    prompt: '日本語は難しい＿＿＿ 、おもしろいです。(Japanese is difficult, but interesting.)',
    reading: 'にほんごは むずかしい＿＿＿、おもしろいです。',
    options: ['けど', 'から', 'ので', 'のに'],
    answer: 'けど',
  },
  {
    id: 'a1l_04', level: 'A1', sublevel: 'late',
    prompt: 'もう少し＿＿＿ 話してください。(Please speak a little more slowly.)',
    reading: 'もうすこし＿＿＿ はなしてください。',
    options: ['ゆっくり', 'はやく', 'おおきく', 'やさしく'],
    answer: 'ゆっくり',
  },
  {
    id: 'a1l_05', level: 'A1', sublevel: 'late',
    prompt: '彼女は料理が＿＿＿ 。(She is good at cooking.)',
    reading: 'かのじょは りょうりが＿＿＿。',
    options: ['じょうずです', 'すきです', 'へたです', 'きらいです'],
    answer: 'じょうずです',
  },
  {
    id: 'a1l_06', level: 'A1', sublevel: 'late',
    prompt: '宿題を終わらせて＿＿＿ 遊んでいいよ。(You can play after you finish your homework.)',
    reading: 'しゅくだいを おわらせて＿＿＿ あそんでいいよ。',
    options: ['から', 'ので', 'なのに', 'けど'],
    answer: 'から',
  },
  {
    id: 'a1l_07', level: 'A1', sublevel: 'late',
    prompt: '電車が来る＿＿＿ 、急ぎましょう。(The train is coming, let\'s hurry.)',
    reading: 'でんしゃが くる＿＿＿、いそぎましょう。',
    options: ['から', 'けど', 'のに', 'だけ'],
    answer: 'から',
  },

  // ── A2 Early ─────────────────────────────────────────────────────────────
  {
    id: 'a2e_01', level: 'A2', sublevel: 'early',
    prompt: '予約を変更し＿＿＿ いただけますか？(Could you change my reservation?)',
    reading: 'よやくを へんこうし＿＿＿ いただけますか？',
    options: ['て', 'に', 'で', 'が'],
    answer: 'て',
  },
  {
    id: 'a2e_02', level: 'A2', sublevel: 'early',
    prompt: '先週の土曜日、友達の家に＿＿＿ 。(I went to a friend\'s house last Saturday.)',
    reading: 'せんしゅうの どようび、ともだちの いえに＿＿＿。',
    options: ['行きました', '来ました', '帰りました', '着きました'],
    answer: '行きました',
  },
  {
    id: 'a2e_03', level: 'A2', sublevel: 'early',
    prompt: 'このシャツ、少し大きすぎる＿＿＿ 、もう少し小さいのありますか？',
    reading: 'このシャツ、すこし おおきすぎる＿＿＿、もうすこし ちいさいの ありますか？',
    options: ['んですが', 'から', 'ので', 'けど'],
    answer: 'んですが',
  },
  {
    id: 'a2e_04', level: 'A2', sublevel: 'early',
    prompt: '彼は今、電話中＿＿＿ 、少し待ってもらえますか？',
    reading: 'かれは いま、でんわちゅう＿＿＿、すこし まってもらえますか？',
    options: ['なので', 'なのに', 'だから', 'なのか'],
    answer: 'なので',
  },
  {
    id: 'a2e_05', level: 'A2', sublevel: 'early',
    prompt: '子どもの頃、よく公園で＿＿＿ 。(I often used to play in the park as a child.)',
    reading: 'こどもの ころ、よく こうえんで＿＿＿。',
    options: ['遊んでいました', '遊びます', '遊びました', '遊んでいます'],
    answer: '遊んでいました',
  },
  {
    id: 'a2e_06', level: 'A2', sublevel: 'early',
    prompt: '会議は三時に始まる＿＿＿ になっています。(The meeting is scheduled to start at 3.)',
    reading: 'かいぎは さんじに はじまる＿＿＿ になっています。',
    options: ['こと', 'もの', 'ため', 'ところ'],
    answer: 'こと',
  },
  {
    id: 'a2e_07', level: 'A2', sublevel: 'early',
    prompt: '荷物が多い＿＿＿ 、手伝いましょうか？(You have a lot of luggage — shall I help?)',
    reading: 'にもつが おおい＿＿＿、てつだいましょうか？',
    options: ['ようですが', 'らしいですが', 'そうですが', 'みたいですが'],
    answer: 'ようですが',
  },

  // ── A2 Mid ───────────────────────────────────────────────────────────────
  {
    id: 'a2m_01', level: 'A2', sublevel: 'mid',
    prompt: '彼女は病気＿＿＿ 、学校を休みました。(She was absent from school because she was sick.)',
    options: ['だったので', 'だったから', 'だったのに', 'だったが'],
    answer: 'だったので',
  },
  {
    id: 'a2m_02', level: 'A2', sublevel: 'mid',
    prompt: 'あの店は安い＿＿＿ 、いつも混んでいる。(That shop is cheap, so it\'s always crowded.)',
    options: ['から', 'のに', 'けれど', 'ながら'],
    answer: 'から',
  },
  {
    id: 'a2m_03', level: 'A2', sublevel: 'mid',
    prompt: '雨が降って＿＿＿ ので、傘を持ってきた。(It was raining, so I brought an umbrella.)',
    options: ['いた', 'ある', 'いる', 'おく'],
    answer: 'いた',
  },
  {
    id: 'a2m_04', level: 'A2', sublevel: 'mid',
    prompt: '東京に住んで＿＿＿ ３年になります。(It has been 3 years since I started living in Tokyo.)',
    options: ['から', 'まで', 'ので', 'だけ'],
    answer: 'から',
  },
  {
    id: 'a2m_05', level: 'A2', sublevel: 'mid',
    prompt: '疲れて＿＿＿ 、早く帰ることにした。(Because I was tired, I decided to go home early.)',
    options: ['いたので', 'いるので', 'いたから', 'あったので'],
    answer: 'いたので',
  },
  {
    id: 'a2m_06', level: 'A2', sublevel: 'mid',
    prompt: '急いで＿＿＿ 、財布を忘れてしまった。(I was in a hurry, so I forgot my wallet.)',
    options: ['いたので', 'いたから', 'いたのに', 'いたが'],
    answer: 'いたので',
  },
  {
    id: 'a2m_07', level: 'A2', sublevel: 'mid',
    prompt: 'このカフェは静か＿＿＿ 、仕事がしやすい。(This café is quiet and easy to work in.)',
    options: ['で', 'に', 'が', 'を'],
    answer: 'で',
  },

  // ── A2 Late ──────────────────────────────────────────────────────────────
  {
    id: 'a2l_01', level: 'A2', sublevel: 'late',
    prompt: '宿題を終えて＿＿＿ 、ゲームをした。(After finishing homework, I played games.)',
    options: ['から', 'ので', 'のに', 'けど'],
    answer: 'から',
  },
  {
    id: 'a2l_02', level: 'A2', sublevel: 'late',
    prompt: '彼は医者に＿＿＿ かもしれない。(He might become a doctor.)',
    options: ['なる', 'なった', 'なり', 'なって'],
    answer: 'なる',
  },
  {
    id: 'a2l_03', level: 'A2', sublevel: 'late',
    prompt: '先生に言われた＿＿＿ 、ちゃんとやっています。(As my teacher told me, I\'m doing it properly.)',
    options: ['とおり', 'ように', 'ために', 'ほど'],
    answer: 'とおり',
  },
  {
    id: 'a2l_04', level: 'A2', sublevel: 'late',
    prompt: '試験が終わった＿＿＿ でホッとした。(I was relieved that the exam was over.)',
    options: ['ことで', 'ところ', 'ばかりに', 'くせに'],
    answer: 'ことで',
  },
  {
    id: 'a2l_05', level: 'A2', sublevel: 'late',
    prompt: '彼女は歌が上手な＿＿＿ 、ピアノも弾ける。(Not only is she good at singing, she can also play piano.)',
    options: ['だけでなく', 'ばかりか', 'どころか', 'のに'],
    answer: 'だけでなく',
  },
  {
    id: 'a2l_06', level: 'A2', sublevel: 'late',
    prompt: '日本に来る前に、日本語を少し勉強して＿＿＿ 。(Before coming to Japan, I had studied a little Japanese.)',
    options: ['おきました', 'いきました', 'きました', 'みました'],
    answer: 'おきました',
  },
  {
    id: 'a2l_07', level: 'A2', sublevel: 'late',
    prompt: '彼に頼め＿＿＿ 、もっと早く終わったのに。(If I had asked him, it would have ended sooner.)',
    options: ['ば', 'ても', 'なら', 'と'],
    answer: 'ば',
  },

  // ── B1 Early ─────────────────────────────────────────────────────────────
  {
    id: 'b1e_01', level: 'B1', sublevel: 'early',
    prompt: 'あの映画は見る＿＿＿ がある。(That movie is worth watching.)',
    options: ['価値', 'こと', 'もの', 'わけ'],
    answer: '価値',
  },
  {
    id: 'b1e_02', level: 'B1', sublevel: 'early',
    prompt: '問題が起き＿＿＿ 、すぐ連絡してください。(If a problem arises, contact me right away.)',
    options: ['たら', 'れば', 'たなら', 'ても'],
    answer: 'たら',
  },
  {
    id: 'b1e_03', level: 'B1', sublevel: 'early',
    prompt: 'この仕事は一人では＿＿＿ 。(This job can\'t be done by one person.)',
    options: ['できかねます', 'できません', 'できにくいです', 'できないです'],
    answer: 'できかねます',
  },
  {
    id: 'b1e_04', level: 'B1', sublevel: 'early',
    prompt: '彼が来る＿＿＿ に、準備を終わらせた。(I finished preparing before he arrived.)',
    options: ['まえ', 'うち', 'こと', 'ため'],
    answer: 'まえ',
  },
  {
    id: 'b1e_05', level: 'B1', sublevel: 'early',
    prompt: '最近、仕事が忙しく＿＿＿ 。(Lately I have become busy with work.)',
    options: ['なってきた', 'なっていた', 'なっていく', 'なってある'],
    answer: 'なってきた',
  },
  {
    id: 'b1e_06', level: 'B1', sublevel: 'early',
    prompt: '彼は怒って＿＿＿ ようだった。(He seemed to be angry.)',
    options: ['いる', 'ある', 'おく', 'みる'],
    answer: 'いる',
  },
  {
    id: 'b1e_07', level: 'B1', sublevel: 'early',
    prompt: '彼女は毎日運動する＿＿＿ 、健康を保っている。(By exercising every day, she maintains her health.)',
    options: ['ことで', 'ために', 'ことから', 'ものの'],
    answer: 'ことで',
  },

  // ── B1 Mid ───────────────────────────────────────────────────────────────
  {
    id: 'b1m_01', level: 'B1', sublevel: 'mid',
    prompt: '彼女が来る＿＿＿ 、パーティーが始まった。(No sooner had she arrived than the party started.)',
    options: ['やいなや', 'につれ', 'とともに', 'からには'],
    answer: 'やいなや',
  },
  {
    id: 'b1m_02', level: 'B1', sublevel: 'mid',
    prompt: '成功する＿＿＿ には努力が必要だ。(Effort is necessary in order to succeed.)',
    options: ['ため', 'こと', 'わけ', 'もの'],
    answer: 'ため',
  },
  {
    id: 'b1m_03', level: 'B1', sublevel: 'mid',
    prompt: '子供が＿＿＿ に、部屋を片付けた。(I tidied the room so that the children would be happy.)',
    options: ['喜ぶよう', '喜ぶため', '喜んでこそ', '喜ぶとき'],
    answer: '喜ぶよう',
  },
  {
    id: 'b1m_04', level: 'B1', sublevel: 'mid',
    prompt: 'このレポートは提出し＿＿＿ ならない。(This report must be submitted.)',
    options: ['なければ', 'ないほど', 'ないでは', 'ないとは'],
    answer: 'なければ',
  },
  {
    id: 'b1m_05', level: 'B1', sublevel: 'mid',
    prompt: '時間が経つ＿＿＿ 、記憶が薄れていった。(As time passed, the memories faded.)',
    options: ['につれて', 'ためで', 'わりに', 'ことで'],
    answer: 'につれて',
  },
  {
    id: 'b1m_06', level: 'B1', sublevel: 'mid',
    prompt: '彼はどんな状況でも＿＿＿ 姿勢を崩さない。(He never loses his composure in any situation.)',
    options: ['落ち着いた', '落ち着く', '落ち着いて', '落ち着かない'],
    answer: '落ち着いた',
  },
  {
    id: 'b1m_07', level: 'B1', sublevel: 'mid',
    prompt: '彼女の話を聞いて、思わず＿＿＿ しまった。(After hearing her story, I ended up crying involuntarily.)',
    options: ['泣いて', '泣かれて', '泣かせて', '泣かれ'],
    answer: '泣いて',
  },

  // ── B1 Late ──────────────────────────────────────────────────────────────
  {
    id: 'b1l_01', level: 'B1', sublevel: 'late',
    prompt: 'この問題は難し＿＿＿ 、一人では解けない。(This problem is so difficult one person can\'t solve it.)',
    options: ['すぎて', 'すぎると', 'すぎても', 'すぎれば'],
    answer: 'すぎて',
  },
  {
    id: 'b1l_02', level: 'B1', sublevel: 'late',
    prompt: '契約書にサインする＿＿＿ 、内容をよく確認してください。(Before signing the contract, please check the contents carefully.)',
    options: ['まえに', 'うちに', 'かわりに', 'ついでに'],
    answer: 'まえに',
  },
  {
    id: 'b1l_03', level: 'B1', sublevel: 'late',
    prompt: '彼女はよく気がつく＿＿＿ 、職場でも頼られている。(She is perceptive and relied upon at work too.)',
    options: ['こともあって', 'ことなので', 'わけがあって', 'ものがあって'],
    answer: 'こともあって',
  },
  {
    id: 'b1l_04', level: 'B1', sublevel: 'late',
    prompt: '今更後悔して＿＿＿ 、もう遅い。(It\'s too late to regret it now.)',
    options: ['も', 'から', 'ので', 'のに'],
    answer: 'も',
  },
  {
    id: 'b1l_05', level: 'B1', sublevel: 'late',
    prompt: '長年の夢が実現し＿＿＿ 、胸がいっぱいになった。(My long-held dream came true and I was overcome with emotion.)',
    options: ['て', 'たら', 'ても', 'ながら'],
    answer: 'て',
  },
  {
    id: 'b1l_06', level: 'B1', sublevel: 'late',
    prompt: 'そんなこと言われ＿＿＿ 、困ります。(If you say something like that, it puts me in a difficult position.)',
    options: ['ても', 'たら', 'ると', 'れば'],
    answer: 'ても',
  },
  {
    id: 'b1l_07', level: 'B1', sublevel: 'late',
    prompt: '彼の提案は一見いい＿＿＿ 、実際には問題がある。(His proposal looks good at first glance, but there are actually problems.)',
    options: ['ようだが', 'みたいだが', 'らしいが', 'そうだが'],
    answer: 'ようだが',
  },

  // ── B2 Early ─────────────────────────────────────────────────────────────
  {
    id: 'b2e_01', level: 'B2', sublevel: 'early',
    prompt: '彼の言葉は理解し＿＿＿ 。(His words were hard to understand.)',
    options: ['かねた', 'きれた', 'かねない', 'えない'],
    answer: 'かねた',
  },
  {
    id: 'b2e_02', level: 'B2', sublevel: 'early',
    prompt: '問題が起きた＿＿＿ には、すぐ報告してください。(In the event a problem arises, please report it immediately.)',
    options: ['際', 'ため', 'もの', 'こと'],
    answer: '際',
  },
  {
    id: 'b2e_03', level: 'B2', sublevel: 'early',
    prompt: '彼は諦める＿＿＿ か、挑戦を続けた。(Far from giving up, he kept on challenging himself.)',
    options: ['どころ', 'ところ', 'もの', 'ばかり'],
    answer: 'どころ',
  },
  {
    id: 'b2e_04', level: 'B2', sublevel: 'early',
    prompt: '品質の高さ＿＿＿ 、デザインも優れているのでこの製品は評判がいい。(This product has a great reputation — needless to say for its quality, but its design is also excellent.)',
    options: ['もさることながら', 'にかけては', 'をよそに', 'をものともせず'],
    answer: 'もさることながら',
  },
  {
    id: 'b2e_05', level: 'B2', sublevel: 'early',
    prompt: '彼女は期待に＿＿＿ 結果を出せなかった。(She was unable to produce results that lived up to expectations.)',
    options: ['沿えず', '応じず', 'かけず', 'もとにせず'],
    answer: '沿えず',
  },
  {
    id: 'b2e_06', level: 'B2', sublevel: 'early',
    prompt: '経済が回復する＿＿＿ 、雇用も改善されるだろう。(As the economy recovers, employment will also improve.)',
    options: ['につれ', 'わりに', 'ほど', 'のみ'],
    answer: 'につれ',
  },
  {
    id: 'b2e_07', level: 'B2', sublevel: 'early',
    prompt: '彼は忙しい＿＿＿ 、友達の相談に乗ってあげた。(Despite being busy, he listened to his friend\'s worries.)',
    options: ['にもかかわらず', 'ために', 'ことで', 'からこそ'],
    answer: 'にもかかわらず',
  },

  // ── B2 Mid ───────────────────────────────────────────────────────────────
  {
    id: 'b2m_01', level: 'B2', sublevel: 'mid',
    prompt: '彼女の才能は、仕事の面においても遺憾なく＿＿＿ 。(Her talent is fully demonstrated even in her work.)',
    options: ['発揮されている', '発揮している', '発揮された', '発揮させた'],
    answer: '発揮されている',
  },
  {
    id: 'b2m_02', level: 'B2', sublevel: 'mid',
    prompt: 'その計画は実行に移され＿＿＿ ものの、途中で頓挫した。(The plan was set in motion, but stalled midway.)',
    options: ['た', 'て', 'る', 'れ'],
    answer: 'た',
  },
  {
    id: 'b2m_03', level: 'B2', sublevel: 'mid',
    prompt: '締め切りが近い＿＿＿ 、作業を急ぐ必要がある。(With the deadline approaching, we need to rush the work.)',
    options: ['だけに', 'ために', 'ことで', 'ならば'],
    answer: 'だけに',
  },
  {
    id: 'b2m_04', level: 'B2', sublevel: 'mid',
    prompt: '状況が改善した＿＿＿ え、まだ油断はできない。(Even though the situation improved, we can\'t let our guard down yet.)',
    options: ['とはい', 'からとい', 'といっても', 'とはいわ'],
    answer: 'とはい',
  },
  {
    id: 'b2m_05', level: 'B2', sublevel: 'mid',
    prompt: '彼の失敗は、準備不足に＿＿＿ ほかならない。(His failure is nothing but a lack of preparation.)',
    options: ['よる', 'よって', 'よれば', 'よると'],
    answer: 'よる',
  },
  {
    id: 'b2m_06', level: 'B2', sublevel: 'mid',
    prompt: 'この政策が＿＿＿ かどうかは、今後の動向次第だ。(Whether this policy succeeds depends on future trends.)',
    options: ['功を奏する', '功を成す', '功を得る', '功を示す'],
    answer: '功を奏する',
  },
  {
    id: 'b2m_07', level: 'B2', sublevel: 'mid',
    prompt: '彼女の発言は波紋を＿＿＿ 。(Her remarks caused a ripple effect.)',
    options: ['呼んだ', '巻いた', '広げた', '生んだ'],
    answer: '呼んだ',
  },

  // ── B2 Late ──────────────────────────────────────────────────────────────
  {
    id: 'b2l_01', level: 'B2', sublevel: 'late',
    prompt: '交渉は難航し＿＿＿ も、最終的には合意に至った。(Negotiations were difficult, but eventually reached an agreement.)',
    options: ['つつ', 'てから', 'てこそ', 'てさえ'],
    answer: 'つつ',
  },
  {
    id: 'b2l_02', level: 'B2', sublevel: 'late',
    prompt: '彼の行動は、常識の範疇を＿＿＿ ものだった。(His behavior was beyond the bounds of common sense.)',
    options: ['逸脱した', '突破した', '超越した', '侵害した'],
    answer: '逸脱した',
  },
  {
    id: 'b2l_03', level: 'B2', sublevel: 'late',
    prompt: '計画を実行に移す前に、リスクを＿＿＿ しておく必要がある。(Before executing the plan, we need to assess the risks.)',
    options: ['精査', '検討', '把握', '評価'],
    answer: '精査',
  },
  {
    id: 'b2l_04', level: 'B2', sublevel: 'late',
    prompt: '彼の主張は一定の説得力を持つ＿＿＿ 、証拠が乏しい。(His argument has some persuasiveness, but lacks evidence.)',
    options: ['ものの', 'ながら', 'くせに', 'ところが'],
    answer: 'ものの',
  },
  {
    id: 'b2l_05', level: 'B2', sublevel: 'late',
    prompt: '長年にわたる研究の＿＿＿ 、新薬が開発された。(As a result of years of research, a new drug was developed.)',
    options: ['末に', '甲斐で', 'おかげで', 'ために'],
    answer: '末に',
  },
  {
    id: 'b2l_06', level: 'B2', sublevel: 'late',
    prompt: 'この問題は単純に見える＿＿＿ 、実は複雑な背景がある。(This problem looks simple, but actually has a complex background.)',
    options: ['ようで', 'みたいで', 'らしく', 'そうで'],
    answer: 'ようで',
  },
  {
    id: 'b2l_07', level: 'B2', sublevel: 'late',
    prompt: '彼女は自分の非を認め＿＿＿ とした。(She tried not to admit her own fault.)',
    options: ['まい', 'ない', 'まいか', 'ないで'],
    answer: 'まい',
  },

  // ── C1 Early ─────────────────────────────────────────────────────────────
  {
    id: 'c1e_01', level: 'C1', sublevel: 'early',
    prompt: '彼の提案は一考に＿＿＿ 。(His proposal is worth considering.)',
    options: ['値する', '値した', '値すべき', '値しない'],
    answer: '値する',
  },
  {
    id: 'c1e_02', level: 'C1', sublevel: 'early',
    prompt: '彼の言葉には重みが＿＿＿ 。(There is gravity in his words.)',
    options: ['ある', 'なる', 'いる', 'する'],
    answer: 'ある',
  },
  {
    id: 'c1e_03', level: 'C1', sublevel: 'early',
    prompt: '彼女は苦境に立たされ＿＿＿ も、決して諦めなかった。(Even when put in a difficult position, she never gave up.)',
    options: ['つつ', 'てこそ', 'とも', 'ても'],
    answer: 'つつ',
  },
  {
    id: 'c1e_04', level: 'C1', sublevel: 'early',
    prompt: '事態はまさに一刻の＿＿＿ を許さない状況だ。(The situation truly allows no delay.)',
    options: ['猶予', '余裕', '余地', '余韻'],
    answer: '猶予',
  },
  {
    id: 'c1e_05', level: 'C1', sublevel: 'early',
    prompt: '彼の発言は文脈から＿＿＿ して解釈されている。(His remarks are being interpreted out of context.)',
    options: ['乖離', '逸脱', '切り離', '独立'],
    answer: '切り離',
  },
  {
    id: 'c1e_06', level: 'C1', sublevel: 'early',
    prompt: 'この小説は読む者の心を＿＿＿ やまない。(This novel captivates the hearts of all who read it.)',
    options: ['捉えて', '離れて', '動かして', '揺さぶって'],
    answer: '捉えて',
  },
  {
    id: 'c1e_07', level: 'C1', sublevel: 'early',
    prompt: '功績を＿＿＿ されるよりも、成長を重視している。(He values growth more than being recognized for achievements.)',
    options: ['称揚', '賞賛', '評価', '顕彰'],
    answer: '称揚',
  },

  // ── C1 Mid ───────────────────────────────────────────────────────────────
  {
    id: 'c1m_01', level: 'C1', sublevel: 'mid',
    prompt: '努力の＿＿＿ あって、ついに合格できた。(Thanks to my efforts, I was finally able to pass.)',
    options: ['甲斐', '末', 'お陰', '結果'],
    answer: '甲斐',
  },
  {
    id: 'c1m_02', level: 'C1', sublevel: 'mid',
    prompt: '彼は自信を持って＿＿＿ を述べた。(He stated his position with confidence.)',
    options: ['持論', '自論', '私論', '偏論'],
    answer: '持論',
  },
  {
    id: 'c1m_03', level: 'C1', sublevel: 'mid',
    prompt: 'その政策は多くの批判を受け、事実上の＿＿＿ を余儀なくされた。(The policy faced much criticism and was effectively forced to be retracted.)',
    options: ['撤回', '撤退', '廃止', '修正'],
    answer: '撤回',
  },
  {
    id: 'c1m_04', level: 'C1', sublevel: 'mid',
    prompt: '彼の主張は理路整然としており、容易に＿＿＿ できない。(His argument is logical and not easily refuted.)',
    options: ['反駁', '反論', '否定', '批判'],
    answer: '反駁',
  },
  {
    id: 'c1m_05', level: 'C1', sublevel: 'mid',
    prompt: '数十年に及ぶ研究の＿＿＿ が実を結んだ。(Decades of accumulated research bore fruit.)',
    options: ['蓄積', '集大成', '結晶', '総括'],
    answer: '蓄積',
  },
  {
    id: 'c1m_06', level: 'C1', sublevel: 'mid',
    prompt: '彼女の演奏は聴衆を＿＿＿ に引き込んだ。(Her performance drew the audience into a trance.)',
    options: ['陶酔', '感動', '興奮', '熱狂'],
    answer: '陶酔',
  },
  {
    id: 'c1m_07', level: 'C1', sublevel: 'mid',
    prompt: '問題の核心を＿＿＿ する議論が求められる。(A discussion that gets to the heart of the issue is needed.)',
    options: ['把握', '無視', '直視', '洞察'],
    answer: '把握',
  },

  // ── C1 Late ──────────────────────────────────────────────────────────────
  {
    id: 'c1l_01', level: 'C1', sublevel: 'late',
    prompt: '彼の行動は＿＿＿ に富んでおり、周囲を驚かせた。(His actions were full of ingenuity and surprised those around him.)',
    options: ['機知', '機転', '才知', '機略'],
    answer: '機知',
  },
  {
    id: 'c1l_02', level: 'C1', sublevel: 'late',
    prompt: 'その発言は社会的な＿＿＿ を巻き起こした。(That statement caused a social controversy.)',
    options: ['物議', '波紋', '反響', '論争'],
    answer: '物議',
  },
  {
    id: 'c1l_03', level: 'C1', sublevel: 'late',
    prompt: '長年の経験が彼を＿＿＿ たらしめた。(Years of experience made him what he is — a master.)',
    options: ['大家', '名人', '達人', '巨匠'],
    answer: '大家',
  },
  {
    id: 'c1l_04', level: 'C1', sublevel: 'late',
    prompt: '彼の説明は＿＿＿ に欠け、聴衆を混乱させた。(His explanation lacked clarity and confused the audience.)',
    options: ['明瞭性', '明確性', '簡潔性', '論理性'],
    answer: '明瞭性',
  },
  {
    id: 'c1l_05', level: 'C1', sublevel: 'late',
    prompt: '事態を＿＿＿ する努力が水泡に帰した。(Efforts to defuse the situation came to nothing.)',
    options: ['収拾', '解決', '収束', '鎮静'],
    answer: '収拾',
  },
  {
    id: 'c1l_06', level: 'C1', sublevel: 'late',
    prompt: '議論は＿＿＿ に及ぶことなく、形式的に終了した。(The discussion ended formally without reaching a substantive level.)',
    options: ['本質', '核心', '実質', '本論'],
    answer: '本質',
  },
  {
    id: 'c1l_07', level: 'C1', sublevel: 'late',
    prompt: '彼女の作品は時代を＿＿＿ する表現で満ちている。(Her work is filled with expressions that transcend the era.)',
    options: ['超越', '凌駕', '突破', '逸脱'],
    answer: '超越',
  },

  // ── C2 Early ─────────────────────────────────────────────────────────────
  {
    id: 'c2e_01', level: 'C2', sublevel: 'early',
    prompt: 'このプロジェクトの成否は彼の判断＿＿＿ 。(Whether this project succeeds or fails hinges on his judgment.)',
    options: ['にかかっている', 'によっている', 'にある', 'にかけている'],
    answer: 'にかかっている',
  },
  {
    id: 'c2e_02', level: 'C2', sublevel: 'early',
    prompt: '彼女の才能は＿＿＿ の域に達している。(Her talent has reached a superlative level.)',
    options: ['卓越', '突出', '卓抜', '群抜'],
    answer: '卓越',
  },
  {
    id: 'c2e_03', level: 'C2', sublevel: 'early',
    prompt: '社会の変化に＿＿＿ しながらも、本質を見失わないことが重要だ。(It is important to adapt to social changes without losing sight of the essence.)',
    options: ['順応', '適応', '対応', '追随'],
    answer: '順応',
  },
  {
    id: 'c2e_04', level: 'C2', sublevel: 'early',
    prompt: 'その芸術作品は＿＿＿ の美を体現している。(That work of art embodies sublime beauty.)',
    options: ['超然', '崇高', '絶対', '純粋'],
    answer: '崇高',
  },
  {
    id: 'c2e_05', level: 'C2', sublevel: 'early',
    prompt: '複雑な問題を＿＿＿ する能力こそ、真のリーダーに求められる。(The ability to distill complex problems is what a true leader needs.)',
    options: ['捨象', '捨捉', '抽象', '簡略'],
    answer: '捨象',
  },
  {
    id: 'c2e_06', level: 'C2', sublevel: 'early',
    prompt: '＿＿＿ に名を残すことは、多くの人の夢だ。(Leaving one\'s name in the annals of history is many people\'s dream.)',
    options: ['史書', '年代記', '史籍', '記録'],
    answer: '史書',
  },
  {
    id: 'c2e_07', level: 'C2', sublevel: 'early',
    prompt: '彼の思想は既成概念を＿＿＿ するものであった。(His thinking served to subvert established concepts.)',
    options: ['覆', '突破', '否定', '転覆'],
    answer: '覆',
  },

  // ── C2 Mid ───────────────────────────────────────────────────────────────
  {
    id: 'c2l_01', level: 'C2', sublevel: 'late',
    prompt: '語りえぬものについては、＿＿＿ ならない。(Whereof one cannot speak, thereof one must be silent.)',
    options: ['沈黙せねば', '語らねば', '沈黙しては', '考えねば'],
    answer: '沈黙せねば',
  },
  {
    id: 'c2l_02', level: 'C2', sublevel: 'late',
    prompt: '彼の論文は学界に＿＿＿ をもたらした。(His paper brought a paradigm shift to academia.)',
    options: ['コペルニクス的転回', '革命', '刷新', '変革'],
    answer: 'コペルニクス的転回',
  },
  {
    id: 'c2l_03', level: 'C2', sublevel: 'late',
    prompt: 'この小説の文体は明治期の文語調を彷彿と＿＿＿ おり、格調高い。(The style of this novel evokes the literary language of the Meiji period and is highly refined.)',
    options: ['させて', 'まねて', 'なって', 'みせて'],
    answer: 'させて',
  },
  {
    id: 'c2l_04', level: 'C2', sublevel: 'late',
    prompt: '人間の本性は＿＿＿ であるという哲学的命題は今も議論される。(The philosophical proposition that human nature is innate is still debated today.)',
    options: ['先天的', '後天的', '本能的', '生来的'],
    answer: '先天的',
  },
  {
    id: 'c2l_05', level: 'C2', sublevel: 'late',
    prompt: '彼女の批評は対象の本質を＿＿＿ し、読者に新たな視座を与えた。(Her critique illuminated the essence of its subject and gave readers a new perspective.)',
    options: ['剔抉', '解明', '分析', '考察'],
    answer: '剔抉',
  },
  {
    id: 'c2l_06', level: 'C2', sublevel: 'late',
    prompt: 'その条約は双方の＿＿＿ のもとに締結された。(The treaty was concluded under mutual agreement from both sides.)',
    options: ['合意', '協定', '同意', '了承'],
    answer: '合意',
  },
  {
    id: 'c2l_07', level: 'C2', sublevel: 'late',
    prompt: '彼の生き方は＿＿＿ そのものだった。(His way of life was the very picture of asceticism.)',
    options: ['禁欲', '清廉', '節制', '克己'],
    answer: '禁欲',
  },
]

export const CEFR_TIERS: Array<{ level: CEFRLevel; sublevel: CEFRSublevel }> = [
  { level: 'A1', sublevel: 'early' },
  { level: 'A1', sublevel: 'mid' },
  { level: 'A1', sublevel: 'late' },
  { level: 'A2', sublevel: 'early' },
  { level: 'A2', sublevel: 'mid' },
  { level: 'A2', sublevel: 'late' },
  { level: 'B1', sublevel: 'early' },
  { level: 'B1', sublevel: 'mid' },
  { level: 'B1', sublevel: 'late' },
  { level: 'B2', sublevel: 'early' },
  { level: 'B2', sublevel: 'mid' },
  { level: 'B2', sublevel: 'late' },
  { level: 'C1', sublevel: 'early' },
  { level: 'C1', sublevel: 'mid' },
  { level: 'C1', sublevel: 'late' },
  { level: 'C2', sublevel: 'early' },
  { level: 'C2', sublevel: 'late' },
]

export function getQuestionsForTier(level: CEFRLevel, sublevel: CEFRSublevel): PlacementQuestion[] {
  return PLACEMENT_QUESTIONS.filter(q => q.level === level && q.sublevel === sublevel)
}

export function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

// Map CEFR tier result to a approximate JLPT level for the SRS engine
export function cefrToJlpt(level: CEFRLevel): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' {
  const map: Record<CEFRLevel, 'N5' | 'N4' | 'N3' | 'N2' | 'N1'> = {
    A1: 'N5', A2: 'N4', B1: 'N3', B2: 'N2', C1: 'N1', C2: 'N1',
  }
  return map[level]
}
