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
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface OCRPage {
  sourceId: string;
  pageNumber: number;
  text: string;
  lineCount: number;
}

interface VocabItem {
  id: string;
  surface: string;
  reading?: string;
  english: string;
  partOfSpeech?: string;
  lesson: string;
  context?: string;
  example?: string;
  source: string;
}

interface GrammarItem {
  id: string;
  pattern: string;
  meaning: string;
  explanation?: string;
  example?: string;
  lesson: string;
  source: string;
}

interface Dialogue {
  id: string;
  lesson: string;
  title: string;
  participants: string[];
  lines: Array<{
    speaker: string;
    japanese: string;
    english?: string;
  }>;
  source: string;
}

interface ExerciseItem {
  id: string;
  lesson: string;
  type: string;
  question: string;
  answer?: string;
  options?: string[];
  source: string;
}

interface ExtractedContent {
  generatedAt: string;
  sourcePages: number;
  statistics: {
    totalVocab: number;
    totalGrammar: number;
    totalDialogues: number;
    totalExercises: number;
    byTextbook: Record<string, any>;
  };
  vocabulary: VocabItem[];
  grammar: GrammarItem[];
  dialogues: Dialogue[];
  exercises: ExerciseItem[];
  byLesson: Record<string, {
    vocab: VocabItem[];
    grammar: GrammarItem[];
    dialogues: Dialogue[];
    exercises: ExerciseItem[];
  }>;
}

class ComprehensiveExtractor {
  private ocrBaseDir = '/Users/Skipp/Projects/KirokuMichi/app/tools/textbook-pack/out/ocr';
  private outputDir = '/Users/Skipp/Projects/KirokuMichi/app/tools/textbook-pack/out/comprehensive';
  private vocab: Map<string, VocabItem> = new Map();
  private grammar: Map<string, GrammarItem> = new Map();
  private dialogues: Dialogue[] = [];
  private exercises: ExerciseItem[] = [];
  private pageCount = 0;
  private textbookStats: Record<string, any> = {};

  async run() {
    console.log('🚀 Starting Comprehensive OCR Extraction\n');
    console.log('=' .repeat(60));

    // Ensure output directory exists
    await mkdir(this.outputDir, { recursive: true });

    // Process all textbooks
    const textbooks = await readdir(this.ocrBaseDir);
    const textbookDirs = textbooks.filter(t =>
      fs.statSync(path.join(this.ocrBaseDir, t)).isDirectory()
    );

    console.log(`\n📚 Found ${textbookDirs.length} textbooks to process\n`);

    for (const textbook of textbookDirs) {
      console.log(`Processing: ${textbook}`);
      await this.processTextbook(textbook);
    }

    // Generate output
    console.log('\n' + '='.repeat(60));
    console.log('\n💾 Generating output files...\n');

    await this.generateOutput();

    console.log('=' .repeat(60));
    console.log(`\n✅ EXTRACTION COMPLETE!\n`);
    console.log(`📊 Statistics:`);
    console.log(`   • Pages processed: ${this.pageCount}`);
    console.log(`   • Vocabulary items: ${this.vocab.size}`);
    console.log(`   • Grammar patterns: ${this.grammar.size}`);
    console.log(`   • Dialogues: ${this.dialogues.length}`);
    console.log(`   • Exercises: ${this.exercises.length}`);
    console.log(`\n📁 Output saved to: ${this.outputDir}\n`);
  }

  private async processTextbook(textbookName: string) {
    const textbookPath = path.join(this.ocrBaseDir, textbookName);
    const rawDir = path.join(textbookPath, 'raw');

    if (!fs.existsSync(rawDir)) {
      console.log(`  ⚠️  No raw directory found`);
      return;
    }

    const pages = await readdir(rawDir);
    const pageFiles = pages.filter(p => p.match(/page-\d+\.json$/)).sort();

    console.log(`  📄 ${pageFiles.length} pages found`);
    this.textbookStats[textbookName] = {
      pages: pageFiles.length,
      vocab: 0,
      grammar: 0,
      dialogues: 0,
      exercises: 0
    };

    let processedCount = 0;
    for (const pageFile of pageFiles) {
      try {
        const pagePath = path.join(rawDir, pageFile);
        const pageData = JSON.parse(await readFile(pagePath, 'utf8')) as OCRPage;

        // Extract content from this page
        this.extractFromPage(pageData, textbookName);

        this.pageCount++;
        processedCount++;

        // Progress indicator
        if (processedCount % 50 === 0) {
          process.stdout.write(`  ✓ ${processedCount}/${pageFiles.length} pages\r`);
        }
      } catch (err) {
        // Skip problematic pages
      }
    }
    console.log(`  ✓ ${processedCount}/${pageFiles.length} pages processed`);
  }

  private extractFromPage(page: OCRPage, textbook: string) {
    if (!page.text) return;

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

  private extractVocabulary(text: string, textbook: string, lesson: string, page: number) {
    // Look for vocabulary markers (varies by textbook)
    const patterns = [
      /([ぁ-ゖァ-ヺ一-鯎ㄅ-ㄩ]+)\s*\(([ぁ-ゖァ-ヺ一-鯎ㄅ-ㄩ\s]+)\)\s*[:\s]+([a-zA-Z\s,;-]+)/g,
      /•\s*([ぁ-ゖァ-ヺ一-鯎ㄅ-ㄩ]+)\s*[:\s]+([a-zA-Z\s,;-]+)/g,
      /^\*?\s*([ぁ-ゖァ-ヺ一-鯎ㄅ-ㄩ]+)\s*([a-zA-Z\s]+)/gm,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const surface = match[1]?.trim();
        const english = match[match.length - 1]?.trim();

        if (surface && english && english.length > 1) {
          const id = `${textbook}_${lesson}_vocab_${this.vocab.size}`;

          if (!this.vocab.has(id)) {
            this.vocab.set(id, {
              id,
              surface,
              english,
              lesson,
              source: textbook,
            });
            this.textbookStats[textbook].vocab++;
          }
        }
      }
    }
  }

  private extractGrammar(text: string, textbook: string, lesson: string, page: number) {
    // Look for grammar box markers: "Grammar", "文法", "N-X", etc.
    const grammarSections = text.split(/Grammar|文法|N-\d+|Grammar\s+Pattern/i);

    for (let i = 1; i < grammarSections.length; i++) {
      const section = grammarSections[i].substring(0, 500); // Limit to 500 chars per pattern

      // Extract pattern (usually first line)
      const lines = section.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 2) continue;

      const pattern = lines[0]?.trim();
      const meaning = lines.slice(1).join(' ').trim();

      if (pattern && pattern.length > 2 && meaning && meaning.length > 3) {
        const id = `${textbook}_${lesson}_grammar_${this.grammar.size}`;

        if (!this.grammar.has(id)) {
          this.grammar.set(id, {
            id,
            pattern,
            meaning,
            explanation: meaning,
            lesson,
            source: textbook,
          });
          this.textbookStats[textbook].grammar++;
        }
      }
    }
  }

  private extractDialogues(text: string, textbook: string, lesson: string, page: number) {
    // Look for dialogue markers: names followed by colons, or 会話/Conversation
    const isDialoguePage = /会話|Conversation|Dialogue|Dialog/i.test(text);

    if (!isDialoguePage) return;

    // Extract speaker patterns
    const speakerPattern = /^([A-Za-z]+|[ぁ-ゖァ-ヺ一-鯎ㄅ-ㄩ]+)\s*[:：]/gm;

    let match;
    const lines: Array<{ speaker: string; text: string }> = [];

    while ((match = speakerPattern.exec(text)) !== null) {
      const speaker = match[1];
      const startIdx = match.index + match[0].length;
      const nextSpeaker = text.indexOf('\n', startIdx);
      const dialogue = text.substring(startIdx, nextSpeaker).trim();

      if (dialogue.length > 3) {
        lines.push({ speaker, text: dialogue });
      }
    }

    if (lines.length >= 2) {
      const dialogue: Dialogue = {
        id: `${textbook}_${lesson}_dialogue_${this.dialogues.length}`,
        lesson,
        title: `Dialogue - ${lesson}`,
        participants: [...new Set(lines.map(l => l.speaker))],
        lines: lines.map(l => ({
          speaker: l.speaker,
          japanese: l.text,
        })),
        source: textbook,
      };

      this.dialogues.push(dialogue);
      this.textbookStats[textbook].dialogues++;
    }
  }

  private extractExercises(text: string, textbook: string, lesson: string, page: number) {
    // Look for exercise markers: "Exercise", "Practice", "問題", etc.
    const isExercisePage = /Exercise|Practice|問題|問い|Mondai|A\.|B\.|C\./i.test(text);

    if (!isExercisePage) return;

    // Extract question patterns
    const questionPattern = /^([A-Z][\.\)]\s+.+?)(?=\n[A-Z][\.\)]|\Z)/gms;

    let match;
    while ((match = questionPattern.exec(text)) !== null) {
      const question = match[1]?.trim();

      if (question && question.length > 5 && !question.includes('\n\n\n')) {
        const exercise: ExerciseItem = {
          id: `${textbook}_${lesson}_exercise_${this.exercises.length}`,
          lesson,
          type: 'question',
          question: question.substring(0, 200), // Limit length
          source: textbook,
        };

        this.exercises.push(exercise);
        this.textbookStats[textbook].exercises++;
      }
    }
  }

  private extractLessonNumber(text: string, textbook: string): string | null {
    // Try different lesson number patterns
    const patterns = [
      /第(\d+)課/,           // 第1課
      /Lesson\s+(\d+)/i,     // Lesson 1
      /L(\d+)/,              // L1
      /Unit\s+(\d+)/i,       // Unit 1
      /Chapter\s+(\d+)/i,    // Chapter 1
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const num = match[1];

        // Map Genki textbook pages to lesson numbers
        if (textbook.includes('genki_1')) {
          return `genki_1_lesson_${num}`;
        } else if (textbook.includes('genki_2')) {
          return `genki_2_lesson_${parseInt(num) + 12}`;
        } else if (textbook.includes('marugoto_a1')) {
          return `marugoto_a1_lesson_${num}`;
        } else if (textbook.includes('marugoto_a2')) {
          return `marugoto_a2_lesson_${num}`;
        } else {
          return `${textbook}_lesson_${num}`;
        }
      }
    }

    return null;
  }

  private async generateOutput() {
    // Organize by lesson
    const byLesson: Record<string, any> = {};

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
    const output: ExtractedContent = {
      generatedAt: new Date().toISOString(),
      sourcePages: this.pageCount,
      statistics: {
        totalVocab: this.vocab.size,
        totalGrammar: this.grammar.size,
        totalDialogues: this.dialogues.length,
        totalExercises: this.exercises.length,
        byTextbook: this.textbookStats,
      },
      vocabulary: Array.from(this.vocab.values()),
      grammar: Array.from(this.grammar.values()),
      dialogues: this.dialogues,
      exercises: this.exercises,
      byLesson,
    };

    // Write outputs
    await writeFile(
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

        await writeFile(
          path.join(this.outputDir, `${textbook}-extract.json`),
          JSON.stringify(textbookOutput, null, 2)
        );

        console.log(`   ✓ ${textbook}-extract.json`);
      }
    }
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

main();
