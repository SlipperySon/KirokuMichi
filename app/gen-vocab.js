import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

async function generateVocab(level, count) {
  const prompt = `Generate ${count} Japanese vocabulary words for JLPT ${level} level.

Return ONLY a valid JSON array with NO markdown, NO code blocks, NO extra text.

Each object must have exactly these fields:
{
  "jlptLevel": "${level}",
  "word": "漢字",
  "reading": "ひらがな",
  "meaning": "English",
  "examplesJson": "[{\\"japanese\\":\\"例文\\",\\"reading\\":\\"えいぶん\\",\\"english\\":\\"example\\"}]",
  "wordType": "noun|verb|adjective|adverb|other",
  "category": "common|business|slang|formal|null",
  "frequencyRank": 1
}

Requirements:
- Generate exactly ${count} words
- Each word: 2-3 example sentences with japanese, reading, english
- Reading: complete hiragana with ゃ/ゅ/ょ as needed
- Meaning: concise English (1-3 words)
- FrequencyRank: assign 1 to ${count} in descending frequency order
- NO duplicates, NO repeats
- Output MUST be parseable by JSON.parse()
- Start with [ and end with ], nothing else`;

  console.log(`Generating ${level} (${count} words)...`);
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const data = JSON.parse(content);
    console.log(`✓ ${level}: ${data.length} words`);
    return data;
  } catch (e) {
    console.error("Parse error:", e.message);
    console.error("Content:", content.substring(0, 300));
    throw e;
  }
}

async function main() {
  try {
    const n4 = await generateVocab("N4", 600);
    fs.writeFileSync(
      "data/generated/vocab-generated-n4.json",
      JSON.stringify(n4, null, 2)
    );
    console.log("✓ Wrote vocab-generated-n4.json");
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

main();
