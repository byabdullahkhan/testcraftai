import { TheoryFeedback } from '../types';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'have', 'has', 'had',
  'are', 'was', 'were', 'been', 'being', 'will', 'would', 'could', 'should', 'shall',
  'may', 'might', 'must', 'can', 'into', 'onto', 'upon', 'about', 'above', 'below',
  'between', 'among', 'through', 'during', 'before', 'after', 'under', 'over', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
  'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'because', 'while',
  'which', 'who', 'whom', 'whose', 'what', 'these', 'those', 'their', 'them', 'they',
  'his', 'her', 'hers', 'its', 'our', 'ours', 'your', 'yours', 'does', 'did', 'doing',
  'used', 'using', 'use', 'most', 'many', 'much', 'like', 'help', 'helps', 'give', 'gives',
  'acting', 'act', 'acts', 'form', 'supply', 'role', 'explain', 'define', 'describe', 'source',
  'produce', 'produces', 'producing', 'generate', 'generates', 'generating', 'create', 'creates',
  'make', 'makes', 'making', 'made',
]);

const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'neither', 'nor', 'without', 'lack', 'lacks', 'lacking',
  'absent', 'cannot', 'cant', 'dont', 'doesnt', 'didnt', 'isnt', 'arent', 'wasnt',
  'werent', 'wont', 'wouldnt', 'shouldnt', 'couldn', 'impossible', 'false', 'incorrect',
]);

// True synonym equivalence groups (phrasing variations that mean the exact same thing)
const TRUE_SYNONYM_GROUPS: string[][] = [
  ['powerhouse', 'generator', 'power'],
  ['atp', 'adenosine', 'triphosphate'],
  ['energy', 'fuel'],
  ['respiration', 'respiratory', 'breathing'],
  ['photosynthesis', 'photosynthetic'],
  ['sunlight', 'solar', 'light'],
  ['glucose', 'sugar', 'carbohydrate'],
  ['osmosis', 'osmotic'],
  ['semipermeable', 'selectively', 'permeable'],
  ['enzyme', 'catalyst', 'catalyze', 'catalytic'],
  ['speed', 'accelerate', 'faster', 'rate'],
  ['increase', 'increases', 'rise', 'rises', 'higher', 'greater', 'elevate', 'boost', 'grow'],
  ['decrease', 'decreases', 'fall', 'falls', 'drop', 'lower', 'reduce', 'reduces', 'decline', 'less'],
  ['absorb', 'absorbs', 'intake', 'capture', 'captures', 'consume'],
  ['protect', 'protects', 'defend', 'shield', 'prevent', 'prevents', 'guard'],
  ['transport', 'transports', 'carry', 'carries', 'move', 'moves', 'transfer', 'deliver', 'circulate'],
  ['store', 'stores', 'save', 'retain', 'hold', 'reserve', 'accumulate'],
  ['control', 'controls', 'regulate', 'regulates', 'manage', 'govern', 'direct', 'coordinate'],
];

function stemWord(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  w = w
    .replace(/ies$/, 'y')
    .replace(/es$/, 'e')
    .replace(/(ing|ed|tion|sion|ment|ness|ity|ous|ive|al|ly|er|or|s)$/, '');
  return w.length >= 3 ? w : word.toLowerCase().trim();
}

function getSynonymsAndStems(word: string): Set<string> {
  const clean = word.toLowerCase().trim();
  const stem = stemWord(clean);
  const equivalents = new Set<string>([clean, stem]);

  for (const group of TRUE_SYNONYM_GROUPS) {
    if (group.some(g => g === clean || stemWord(g) === stem)) {
      for (const item of group) {
        equivalents.add(item);
        equivalents.add(stemWord(item));
      }
    }
  }
  return equivalents;
}

function tokenizeContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function hasNegationFlip(modelText: string, studentText: string): boolean {
  const modelWords = modelText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  const studentWords = studentText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
  const modelHasNeg = modelWords.some(w => NEGATION_WORDS.has(w));
  const studentHasNeg = studentWords.some(w => NEGATION_WORDS.has(w));
  return modelHasNeg !== studentHasNeg;
}

export function evaluateTheoryConceptuallyFallback(
  questionText: string,
  modelAnswer: string,
  studentAnswer: string,
  maxMarks: number
): {
  marks: number;
  status: 'correct' | 'partial' | 'wrong';
  feedback: TheoryFeedback;
} {
  const trimmedStudent = (studentAnswer || '').trim();
  const trimmedModel = (modelAnswer || '').trim();
  const trimmedQuestion = (questionText || '').trim();

  if (!trimmedStudent) {
    return {
      marks: 0,
      status: 'wrong',
      feedback: {
        conceptMatchPercentage: 0,
        accuracyScore: 0,
        conceptualVerdict: 'No answer provided',
        strengths: 'None',
        missingPoints: 'The student did not submit an answer for this question.',
        rubricNotes: 'Zero marks awarded due to missing submission.',
      },
    };
  }

  // Filter out words that are just copied from the question prompt itself
  const questionStems = new Set(tokenizeContentWords(trimmedQuestion).map(stemWord));
  const rawModelWords = tokenizeContentWords(trimmedModel);
  const rawStudentWords = tokenizeContentWords(trimmedStudent);

  if (rawStudentWords.length === 0) {
    return {
      marks: 0,
      status: 'wrong',
      feedback: {
        conceptMatchPercentage: 0,
        accuracyScore: 0,
        conceptualVerdict: 'Irrelevant or empty response',
        strengths: 'None identified.',
        missingPoints: `Core concepts from model answer: ${trimmedModel.slice(0, 120)}`,
        rubricNotes: 'Response did not contain meaningful conceptual terms.',
      },
    };
  }

  // Focus on distinctive concepts in the model answer (excluding words already given in the question)
  const distinctiveModelWords = rawModelWords.filter(w => !questionStems.has(stemWord(w)));
  const targetModelWords =
    distinctiveModelWords.length >= 2 ? distinctiveModelWords : rawModelWords;

  // Deduplicate model concepts by synonym group so redundant words (e.g., "adenosine triphosphate ATP") count as 1 concept unit
  const conceptUnits: { label: string; equivalents: Set<string> }[] = [];
  for (const word of targetModelWords) {
    const eq = getSynonymsAndStems(word);
    const existingUnit = conceptUnits.find(u => {
      for (const item of eq) {
        if (u.equivalents.has(item)) return true;
      }
      return false;
    });
    if (existingUnit) {
      eq.forEach(item => existingUnit.equivalents.add(item));
    } else {
      conceptUnits.push({ label: word, equivalents: eq });
    }
  }

  const studentWordSet = new Set(rawStudentWords);
  const studentStemSet = new Set(rawStudentWords.map(stemWord));

  const matchedConcepts: string[] = [];
  const missingConcepts: string[] = [];

  for (const unit of conceptUnits) {
    let matched = false;
    for (const eq of unit.equivalents) {
      if (studentWordSet.has(eq) || studentStemSet.has(eq)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      matchedConcepts.push(unit.label);
    } else {
      missingConcepts.push(unit.label);
    }
  }

  if (matchedConcepts.length === 0) {
    return {
      marks: 0,
      status: 'wrong',
      feedback: {
        conceptMatchPercentage: 0,
        accuracyScore: 0,
        conceptualVerdict: 'Incorrect or unrelated explanation',
        strengths: 'No matching concepts from the expected solution were found.',
        missingPoints: `Expected concepts: ${conceptUnits
          .slice(0, 5)
          .map(u => u.label)
          .join(', ')}.`,
        rubricNotes: 'Zero marks awarded because key concepts from the model answer were absent.',
      },
    };
  }

  const totalUnits = Math.max(1, conceptUnits.length);
  const recallRatio = matchedConcepts.length / totalUnits;

  // Natural prose covering >= 80% of distinct concept units earns full credit
  let conceptualScore = Math.min(1, recallRatio / 0.8);

  // Penalize contradiction/negation flip
  const negationMismatch = hasNegationFlip(trimmedModel, trimmedStudent);
  if (negationMismatch) {
    conceptualScore = Math.max(0.1, conceptualScore * 0.45);
  }

  const matchPct = Math.min(100, Math.max(0, Math.round(conceptualScore * 100)));
  let marksAwarded = 0;
  let status: 'correct' | 'partial' | 'wrong' = 'wrong';

  if (matchPct >= 82) {
    marksAwarded = matchPct >= 92 ? maxMarks : Math.round(maxMarks * (matchPct / 100) * 10) / 10;
    status = 'correct';
  } else if (matchedConcepts.length >= 1 && matchPct >= 15) {
    marksAwarded = Math.max(0.5, Math.round(maxMarks * (matchPct / 100) * 10) / 10);
    status = 'partial';
  } else {
    marksAwarded = 0;
    status = 'wrong';
  }

  const topMatched = matchedConcepts.slice(0, 5).join(', ');
  const topMissing = missingConcepts.slice(0, 5).join(', ');

  return {
    marks: marksAwarded,
    status,
    feedback: {
      conceptMatchPercentage: matchPct,
      accuracyScore: Math.round((matchPct / 10) * 10) / 10,
      conceptualVerdict: negationMismatch
        ? 'Partial grasp with conceptual contradiction (negation mismatch)'
        : status === 'correct'
        ? 'Strong conceptual understanding'
        : status === 'partial'
        ? 'Partial conceptual grasp'
        : 'Insufficient conceptual alignment',
      strengths: topMatched
        ? `Correctly addressed key concepts: ${topMatched}.`
        : 'Attempted explanation.',
      missingPoints:
        status === 'correct' && !topMissing
          ? 'All core concepts from the reference answer were covered.'
          : topMissing
          ? `Missing key details on: ${topMissing}.`
          : 'Compare with the teacher model answer for complete detail.',
      rubricNotes: negationMismatch
        ? 'Score adjusted due to an opposite/negated statement compared to the model answer.'
        : 'Graded on semantic concept coverage, synonym equivalence, and factual alignment.',
    },
  };
}
