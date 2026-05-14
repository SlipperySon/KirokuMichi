/**
 * Comprehensive OCR Content Extractor
 * Processes all 3,138 pages of OCR data to extract:
 * - Vocabulary items with context
 * - Grammar patterns and explanations
 * - Dialogues and conversations
 * - Exercises and solutions
 * - Lesson organization
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ComprehensiveExtractor {
  constructor() {
    this.ocrBaseDir = '/Users/Skipp/Projects/KirokuMichi/app/tools/textbook-pack/out/ocr';
    this.outputDir = '/Users/Skipp/Projects/KirokuMichi/app/tools/textbook-pack/out/comprehensive';
    this.vocab = new Map();
    this.grammar = new Map();
    this.dialogues = [];
    this.exercises = [];
    this.pageCount = 0;
    this.textbookStats = {};
    this.idCounters = {};
  }

  async run() {
    console.log('🚀 Starting Comprehensive OCR Extraction\n');
    console.log('='.repeat(70));

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Process all textbooks
    const textbooks = fs.readdirSync(this.ocrBaseDir);
    const textbookDirs = textbooks.filter(t => {
      const stat = fs.statSync(path.join(this.ocrBaseDir, t));
      return stat.isDirectory();
    });

    console.log(`\n📚 Found ${textbookDirs.length} textbooks to process\n`);

    for (const textbook of textbookDirs.sort()) {
      await this.processTextbook(textbook);
    }

    // Generate output
    console.log('\n' + '='.repeat(70));
    console.log('\n💾 Generating output files...\n');

    await this.generateOutput();

    console.log('='.repeat(70));
    console.log(`\n✅ EXTRACTION COMPLETE!\n`);
    console.log(`📊 Statistics:`);
    console.log(`   • Pages processed: ${this.pageCount}`);
    console.log(`   • Vocabulary items: ${this.vocab.size}`);
    console.log(`   • Grammar patterns: ${this.grammar.size}`);
    console.log(`   • Dialogues: ${this.dialogues.length}`);
    console.log(`   • Exercises: ${this.exercises.length}`);
    console.log(`\n📁 Output saved to: ${this.outputDir}\n`);
  }

  async processTextbook(textbookName) {
    const textbookPath = path.join(this.ocrBaseDir, textbookName);
    const rawDir = path.join(textbookPath, 'raw');

    if (!fs.existsSync(rawDir)) {
      return;
    }

    const pages = fs.readdirSync(rawDir);
    const pageFiles = pages.filter(p => p.match(/page-\d+\.json$/)).sort();

    console.log(`📖 ${textbookName}`);
    console.log(`   📄 ${pageFiles.length} pages found`);

    this.textbookStats[textbookName] = {
      pages: pageFiles.length,
      vocab: 0,
      grammar: 0,
      dialogues: 0,
      exercises: 0,
    };

    if (!this.idCounters[textbookName]) {
      this.idCounters[textbookName] = { vocab: 0, grammar: 0, dialogue: 0, exercise: 0 };
    }

    let processedCount = 0;
    for (const pageFile of pageFiles) {
      try {
        const pagePath = path.join(rawDir, pageFile);
        const pageContent = fs.readFileSync(pagePath, 'utf8');
        const pageData = JSON.parse(pageContent);

        // Extract content from this page
        this.extractFromPage(pageData, textbookName);

        this.pageCount++;
        processedCount++;

        if (processedCount % 100 === 0) {
          process.stdout.write(`   ✓ ${processedCount}/${pageFiles.length} pages\r`);
        }
      } catch (err) {
        // Skip problematic pages silently
      }
    }
    console.log(`   ✓ ${processedCount}/${pageFiles.length} pages processed        `);
  }

  extractFromPage(page, textbook) {
    if (!page.text || typeof page.text !== 'string') return;

    const text = page.text;
    const lessonMatch = this.extractLessonNumber(text, textbook);
    const lesson = lessonMatch || 'unknown';

    // Extract vocabulary
    this.extractVocabulary(text, textbook, lesson, page.pageNumber);

    // Extract grammar patterns
    this.extractGrammar(text, textbook, lesson, page.pageNumber);

    // Extract dialogues
    this.extractDialogues(text, textbook, lesson, page.pageNumber);

    // Extract exercises
    this.extractExercises(text, textbook, lesson, page.pageNumber);
  }

  extractVocabulary(text, textbook, lesson, page) {
    // Split by common delimiters to find vocab entries
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Pattern 1: Japanese (reading) English
      const pattern1 = /^([ぁ-ゖァ-ヺ一-鯎]*)\s*\(([ぁ-ゖァ-ヺ一-鯎\s]+)\)\s*[:\s]+(.+?)$/;
      const match1 = line.match(pattern1);
      if (match1) {
        const surface = match1[1] || match1[2];
        const english = match1[3];
        if (surface && english && english.length > 1) {
          this.addVocab(textbook, lesson, surface, english, page);
          continue;
        }
      }

      // Pattern 2: Japanese English (space separated)
      const pattern2 = /^([ぁ-ゖァ-ヺ一-鯎]+)\s+([a-z][a-z\s]+)$/i;
      const match2 = line.match(pattern2);
      if (match2) {
        const surface = match2[1];
        const english = match2[2];
        if (english.length > 2 && !english.match(/^[A-Z]{2,}$/)) {
          this.addVocab(textbook, lesson, surface, english, page);
          continue;
        }
      }

      // Pattern 3: Bullet points
      const pattern3 = /^\*?\s*([ぁ-ゖァ-ヺ一-鯎]+)\s+([a-z\s]+[a-z])$/i;
      const match3 = line.match(pattern3);
      if (match3) {
        this.addVocab(textbook, lesson, match3[1], match3[2], page);
      }
    }
  }

  addVocab(textbook, lesson, surface, english, page) {
    const key = `${surface}:${english}`;
    if (this.vocab.has(key)) return;

    const id = `${textbook}_L${lesson}_vocab_${++this.idCounters[textbook].vocab}`;
    this.vocab.set(key, {
      id,
      surface: surface.trim(),
      english: english.trim(),
      lesson,
      source: textbook,
      page,
    });
    this.textbookStats[textbook].vocab++;
  }

  extractGrammar(text, textbook, lesson, page) {
    // Look for grammar sections
    const grammarSections = text.split(/Grammar|文法|N-\d+|Pattern/i);

    for (let i = 1; i < Math.min(grammarSections.length, 10); i++) {
      const section = grammarSections[i];
      if (!section || section.length < 5) continue;

      const lines = section.split('\n').filter(l => l.trim().length > 3);
      if (lines.length < 1) continue;

      const pattern = lines[0].trim().substring(0, 100);
      const meaning = lines.slice(1, 3).join(' ').trim().substring(0, 200);

      if (pattern && pattern.length > 2 && meaning && meaning.length > 3) {
        const key = `${pattern}:${meaning}`;
        if (!this.grammar.has(key)) {
          const id = `${textbook}_L${lesson}_grammar_${++this.idCounters[textbook].grammar}`;
          this.grammar.set(key, {
            id,
            pattern,
            meaning,
            lesson,
            source: textbook,
            page,
          });
          this.textbookStats[textbook].grammar++;
        }
      }
    }
  }

  extractDialogues(text, textbook, lesson, page) {
    // Look for dialogue markers
    const isDialoguePage = /会話|Conversation|Dialogue|Dialog|dialogue/i.test(text);
    if (!isDialoguePage) return;

    // Extract speaker patterns: Name: dialogue text
    const speakerPattern = /^([A-Za-z]+|[ぁ-ゖァ-ヺ一-鯎]+)[\s\.\：:]\s*(.+?)$/gm;

    const lines = [];
    let match;

    while ((match = speakerPattern.exec(text)) !== null) {
      const speaker = match[1];
      const dialogue = match[2];

      if (speaker && dialogue && dialogue.length > 2) {
        lines.push({ speaker: speaker.trim(), text: dialogue.trim() });
      }
    }

    if (lines.length >= 2) {
      const id = `${textbook}_L${lesson}_dialogue_${++this.idCounters[textbook].dialogue}`;
      const participants = [...new Set(lines.map(l => l.speaker))];

      this.dialogues.push({
        id,
        lesson,
        title: `Dialogue ${lesson}`,
        participants,
        lines: lines.map(l => ({
          speaker: l.speaker,
          japanese: l.text,
        })),
        source: textbook,
        page,
      });

      this.textbookStats[textbook].dialogues++;
    }
  }

  extractExercises(text, textbook, lesson, page) {
    // Look for exercise markers
    const isExercisePage = /Exercise|Practice|問題|問い|A\.|B\.|C\./i.test(text);
    if (!isExercisePage) return;

    const questionPattern = /^([A-Z]\.)?\s*(.{10,200}?)(?=\n[A-Z]\.|$)/gm;

    let match;
    while ((match = questionPattern.exec(text)) !== null) {
      const question = match[2];

      if (question && question.length > 8 && !question.includes('\n\n')) {
        const id = `${textbook}_L${lesson}_exercise_${++this.idCounters[textbook].exercise}`;
        this.exercises.push({
          id,
          lesson,
          type: 'practice',
          question: question.trim(),
          source: textbook,
          page,
        });

        this.textbookStats[textbook].exercises++;
      }
    }
  }

  extractLessonNumber(text, textbook) {
    // Try different lesson number patterns
    const patterns = [
      { regex: /第(\d+)課/, prefix: '' },
      { regex: /Lesson\s+(\d+)/i, prefix: '' },
      { regex: /L(\d+)/i, prefix: '' },
      { regex: /Unit\s+(\d+)/i, prefix: '' },
      { regex: /Chapter\s+(\d+)/i, prefix: '' },
    ];

    for (const { regex } of patterns) {
      const match = text.match(regex);
      if (match) {
        const num = parseInt(match[1]);

        // Map to textbook-specific lesson numbers
        if (textbook.includes('genki_1')) {
          return `genki_1_${num}`;
        } else if (textbook.includes('genki_2')) {
          return `genki_2_${num + 12}`;
        } else if (textbook.includes('marugoto')) {
          return `${textbook.replace('_textbook', '')}_${num}`;
        } else {
          return `${textbook}_${num}`;
        }
      }
    }

    return null;
  }

  async generateOutput() {
    // Organize by lesson
    const byLesson = {};

    for (const vocab of this.vocab.values()) {
      if (!byLesson[vocab.lesson]) {
        byLesson[vocab.lesson] = { vocab: [], grammar: [], dialogues: [], exercises: [] };
      }
      byLesson[vocab.lesson].vocab.push(vocab);
    }

    for (const gram of this.grammar.values()) {
      if (!byLesson[gram.lesson]) {
        byLesson[gram.lesson] = { vocab: [], grammar: [], dialogues: [], exercises: [] };
      }
      byLesson[gram.lesson].grammar.push(gram);
    }

    for (const dialogue of this.dialogues) {
      if (!byLesson[dialogue.lesson]) {
        byLesson[dialogue.lesson] = { vocab: [], grammar: [], dialogues: [], exercises: [] };
      }
      byLesson[dialogue.lesson].dialogues.push(dialogue);
    }

    for (const exercise of this.exercises) {
      if (!byLesson[exercise.lesson]) {
        byLesson[exercise.lesson] = { vocab: [], grammar: [], dialogues: [], exercises: [] };
      }
      byLesson[exercise.lesson].exercises.push(exercise);
    }

    // Generate comprehensive output
    const output = {
      generatedAt: new Date().toISOString(),
      sourcePages: this.pageCount,
      statistics: {
        totalVocab: this.vocab.size,
        totalGrammar: this.grammar.size,
        totalDialogues: this.dialogues.length,
        totalExercises: this.exercises.length,
        byTextbook: this.textbookStats,
      },
      vocabulary: Array.from(this.vocab.values()).sort((a, b) => a.id.localeCompare(b.id)),
      grammar: Array.from(this.grammar.values()).sort((a, b) => a.id.localeCompare(b.id)),
      dialogues: this.dialogues,
      exercises: this.exercises,
      byLesson,
    };

    // Write main output
    fs.writeFileSync(
      path.join(this.outputDir, 'comprehensive-curriculum.json'),
      JSON.stringify(output, null, 2)
    );
    console.log('   ✓ comprehensive-curriculum.json');

    // Write textbook-specific extracts
    for (const [textbook, stats] of Object.entries(this.textbookStats)) {
      const textbookVocab = Array.from(this.vocab.values()).filter(v => v.source === textbook);
      const textbookGrammar = Array.from(this.grammar.values()).filter(g => g.source === textbook);
      const textbookDialogues = this.dialogues.filter(d => d.source === textbook);
      const textbookExercises = this.exercises.filter(e => e.source === textbook);

      if (textbookVocab.length > 0 || textbookGrammar.length > 0) {
        const textbookOutput = {
          textbook,
          generatedAt: output.generatedAt,
          statistics: {
            vocab: textbookVocab.length,
            grammar: textbookGrammar.length,
            dialogues: textbookDialogues.length,
            exercises: textbookExercises.length,
          },
          vocabulary: textbookVocab,
          grammar: textbookGrammar,
          dialogues: textbookDialogues,
          exercises: textbookExercises,
        };

        fs.writeFileSync(
          path.join(this.outputDir, `${textbook}-comprehensive.json`),
          JSON.stringify(textbookOutput, null, 2)
        );

        console.log(`   ✓ ${textbook}-comprehensive.json`);
      }
    }

    // Write summary
    const summary = {
      extractedAt: output.generatedAt,
      sourcePages: this.pageCount,
      totalItems: {
        vocabulary: output.statistics.totalVocab,
        grammar: output.statistics.totalGrammar,
        dialogues: output.statistics.totalDialogues,
        exercises: output.statistics.totalExercises,
      },
      byTextbook: Object.fromEntries(
        Object.entries(this.textbookStats).map(([name, stats]) => [
          name,
          {
            pages: stats.pages,
            vocabulary: stats.vocab,
            grammar: stats.grammar,
            dialogues: stats.dialogues,
            exercises: stats.exercises,
          },
        ])
      ),
    };

    fs.writeFileSync(
      path.join(this.outputDir, 'EXTRACTION_SUMMARY.json'),
      JSON.stringify(summary, null, 2)
    );
    console.log(`   ✓ EXTRACTION_SUMMARY.json`);
  }
}

// Run extraction
async function main() {
  try {
    const extractor = new ComprehensiveExtractor();
    await extractor.run();
  } catch (error) {
    console.error('❌ Error during extraction:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
