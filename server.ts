import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { Test, TestSubmission, QuestionEvaluation, TheoryFeedback, Question } from './src/types';

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-email, x-admin-username, x-admin-email'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK with safety check
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-memory database with persistent demo seed tests
const testsMap = new Map<string, Test>();
const submissionsMap = new Map<string, TestSubmission[]>();

function slugifyTitle(title: string): string {
  if (!title) return 'test';
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'test'
  );
}

function findTestByIdOrSlug(idOrSlug: string): Test | undefined {
  if (!idOrSlug) return undefined;
  const decoded = decodeURIComponent(idOrSlug).trim().toLowerCase();

  // 1. Direct ID match
  const direct = testsMap.get(decoded) || testsMap.get(idOrSlug.trim());
  if (direct) return direct;

  // 2. Direct Slug match or ID match in values
  const bySlug = Array.from(testsMap.values()).find(
    t => (t.slug && t.slug.toLowerCase() === decoded) || 
         (t.id && t.id.toLowerCase() === decoded)
  );
  if (bySlug) return bySlug;

  // 3. Normalized slug comparison with title
  const targetSlug = slugifyTitle(decoded);
  return Array.from(testsMap.values()).find(
    t => (t.slug && t.slug.toLowerCase() === targetSlug) ||
         slugifyTitle(t.title) === targetSlug
  );
}

// File-based persistence directory
const DATA_DIR = path.join(process.cwd(), 'data');
const TESTS_FILE = path.join(DATA_DIR, 'tests.json');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACTIVITIES_FILE = path.join(DATA_DIR, 'activities.json');

const SUPER_ADMIN_USERNAME = 'byabdullahkhan';
const SUPER_ADMIN_PASSWORD = 'gemini';
const SUPER_ADMIN_EMAIL = 'byabdullahkhan@gmail.com';

export interface UserRecord {
  uid: string;
  username: string; // unique lowercase key
  password: string; // user password
  displayName: string;
  email?: string;
  photoURL?: string;
  role: 'admin' | 'instructor';
  createdAt: string;
  lastLoginAt: string;
}

export interface SiteActivity {
  id: string;
  type: 'user_login' | 'user_register' | 'test_created' | 'test_updated' | 'test_deleted' | 'submission_received' | 'email_sent';
  title: string;
  description: string;
  timestamp: string;
  userEmail?: string;
  userName?: string;
  username?: string;
  userPhoto?: string;
  testId?: string;
  testTitle?: string;
  score?: number;
  maxScore?: number;
  grade?: string;
  metadata?: Record<string, any>;
}

function cleanUsername(input: string): string {
  if (!input) return 'user_' + Math.random().toString(36).substring(2, 7);
  let cleaned = input.toLowerCase().trim()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
  if (cleaned.length < 3) {
    cleaned = (cleaned + '_' + Math.random().toString(36).substring(2, 6)).slice(0, 20);
  }
  return cleaned.slice(0, 24);
}

// Map keyed by unique lowercase username
const usersMap = new Map<string, UserRecord>();
const activitiesList: SiteActivity[] = [];

function logActivity(activity: Omit<SiteActivity, 'id' | 'timestamp'>): SiteActivity {
  const item: SiteActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...activity,
  };
  activitiesList.unshift(item);
  if (activitiesList.length > 200) {
    activitiesList.length = 200;
  }
  try {
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activitiesList, null, 2));
  } catch (e) {
    console.warn('Failed to persist activities:', e);
  }
  return item;
}

function initPersistence() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(TESTS_FILE)) {
      const testsArr: Test[] = JSON.parse(fs.readFileSync(TESTS_FILE, 'utf-8'));
      testsArr.forEach(t => {
        if (!t.slug) {
          t.slug = slugifyTitle(t.title);
        }
        testsMap.set(t.id, t);
      });
    }
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const subsObj: Record<string, TestSubmission[]> = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
      Object.entries(subsObj).forEach(([id, subs]) => submissionsMap.set(id, subs));
    }
    if (fs.existsSync(USERS_FILE)) {
      const usersArr: any[] = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      usersArr.forEach(u => {
        const rawUname = u.username || (u.email ? u.email.split('@')[0] : '');
        if (rawUname) {
          const uname = cleanUsername(rawUname).toLowerCase();
          // Purge legacy mock email accounts (usr_ or mock_)
          if (u.authProvider === 'email' || (u.uid && (u.uid.startsWith('mock_')))) {
            return;
          }
          usersMap.set(uname, {
            uid: u.uid || `usr_${uname}`,
            username: uname,
            password: u.password || (uname === 'byabdullahkhan' ? 'gemini' : '1234'),
            displayName: u.displayName || uname,
            email: u.email || (uname === 'byabdullahkhan' ? 'byabdullahkhan@gmail.com' : `${uname}@testcraft.ai`),
            role: (uname === 'byabdullahkhan' || u.role === 'admin') ? 'admin' : 'instructor',
            photoURL: u.photoURL,
            createdAt: u.createdAt || new Date().toISOString(),
            lastLoginAt: u.lastLoginAt || new Date().toISOString(),
          });
        }
      });
    }

    if (fs.existsSync(ACTIVITIES_FILE)) {
      const actsArr: SiteActivity[] = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf-8'));
      if (Array.isArray(actsArr)) {
        activitiesList.push(...actsArr);
      }
    }

    persistData();
  } catch (err) {
    console.error('Error initializing file persistence:', err);
  }
}

function persistData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TESTS_FILE, JSON.stringify(Array.from(testsMap.values()), null, 2));
    const subsObj: Record<string, TestSubmission[]> = {};
    submissionsMap.forEach((subs, id) => {
      subsObj[id] = subs;
    });
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(subsObj, null, 2));
    fs.writeFileSync(USERS_FILE, JSON.stringify(Array.from(usersMap.values()), null, 2));
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activitiesList, null, 2));
  } catch (err) {
    console.error('Error persisting data:', err);
  }
}

// Initialize persistence on startup
initPersistence();

// Helper to evaluate theory question using Gemini AI
async function evaluateTheoryWithAI(
  questionText: string,
  modelAnswer: string,
  studentAnswer: string,
  maxMarks: number
): Promise<{ marks: number; feedback: TheoryFeedback }> {
  const trimmedAnswer = (studentAnswer || '').trim();

  if (!trimmedAnswer) {
    return {
      marks: 0,
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

  // If Gemini API Key is available, perform deep conceptual evaluation
  if (geminiApiKey) {
    try {
      const prompt = `You are an expert, fair, and encouraging academic evaluator.
Task: Grade a student's theory response by comparing it conceptually to the teacher's model answer.

Question: "${questionText}"
Total Marks Available: ${maxMarks}
Teacher's Model Answer (Reference concept): "${modelAnswer}"

Student's Written Response: "${trimmedAnswer}"

Important Instructions:
1. Focus on Conceptual Understanding: Do NOT penalize the student just because they used different phrasing, casual wording, or simpler sentence structures compared to the teacher's model.
2. If the student clearly grasps and communicates the underlying principles, mechanisms, and key facts, award full or near-full marks.
3. If they partially explained the idea with minor omissions, award proportional partial marks.
4. If there are severe misconceptions or irrelevant content, deduct accordingly.
5. Provide a constructive feedback summary.

Respond strictly in valid JSON format matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              marksAwarded: {
                type: Type.NUMBER,
                description: `Marks awarded to student, between 0 and ${maxMarks}. Can have 1 decimal place.`,
              },
              conceptMatchPercentage: {
                type: Type.NUMBER,
                description: 'Percentage match of conceptual coverage (0 to 100).',
              },
              accuracyScore: {
                type: Type.NUMBER,
                description: 'Score out of 10 for conceptual correctness and clarity.',
              },
              conceptualVerdict: {
                type: Type.STRING,
                description: 'Brief verdict on conceptual understanding (e.g. Excellent grasp, Solid understanding, Partial grasp, Incomplete).',
              },
              strengths: {
                type: Type.STRING,
                description: 'Key concepts or correct facts the student articulated well.',
              },
              missingPoints: {
                type: Type.STRING,
                description: 'Any critical concept or detail from the model answer that was missing or unclear.',
              },
              rubricNotes: {
                type: Type.STRING,
                description: 'Friendly constructive explanation of how the score was calculated.',
              },
            },
            required: [
              'marksAwarded',
              'conceptMatchPercentage',
              'accuracyScore',
              'conceptualVerdict',
              'strengths',
              'missingPoints',
              'rubricNotes',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const awarded = Math.min(
        maxMarks,
        Math.max(0, Number(parsed.marksAwarded ?? (maxMarks * 0.7)))
      );

      return {
        marks: Math.round(awarded * 10) / 10,
        feedback: {
          conceptMatchPercentage: Math.min(100, Math.max(0, Math.round(Number(parsed.conceptMatchPercentage || 70)))),
          accuracyScore: Math.min(10, Math.max(0, Math.round(Number(parsed.accuracyScore || 7) * 10) / 10)),
          conceptualVerdict: parsed.conceptualVerdict || 'Conceptually evaluated',
          strengths: parsed.strengths || 'Articulated core concept directly.',
          missingPoints: parsed.missingPoints || 'Could expand further on technical nuances.',
          rubricNotes: parsed.rubricNotes || 'Graded on conceptual alignment with teacher model answer.',
        },
      };
    } catch (err) {
      console.error('Gemini grading error, applying fallback conceptual analyzer:', err);
    }
  }

  // Fallback conceptual analyzer if API key is not active or during offline test
  const modelTokens = new Set(
    modelAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  );
  const studentTokens = new Set(
    trimmedAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  );

  let matchCount = 0;
  for (const token of studentTokens) {
    if (modelTokens.has(token)) {
      matchCount++;
    }
  }

  const coverageRatio = modelTokens.size > 0 ? Math.min(1, matchCount / Math.max(3, modelTokens.size * 0.45)) : 0.6;
  const lengthRatio = Math.min(1, trimmedAnswer.split(/\s+/).length / 15);
  const combinedScore = Math.min(1, coverageRatio * 0.7 + lengthRatio * 0.3);
  const awarded = Math.round(maxMarks * combinedScore * 10) / 10;
  const matchPct = Math.round(combinedScore * 100);

  return {
    marks: awarded,
    feedback: {
      conceptMatchPercentage: matchPct,
      accuracyScore: Math.round(combinedScore * 10 * 10) / 10,
      conceptualVerdict: matchPct >= 80 ? 'Thorough conceptual understanding' : matchPct >= 50 ? 'Demonstrates basic conceptual grasp' : 'Key concepts omitted',
      strengths: 'Conveyed meaningful context related to the topic.',
      missingPoints: matchPct < 80 ? 'Compare with the teacher model answer for additional specific details.' : 'Comprehensive response provided.',
      rubricNotes: 'Evaluated using conceptual keywords and depth of explanation.',
    },
  };
}

// ------------------------------------
// API ROUTES: CUSTOM USERNAME/PASSWORD AUTH
// ------------------------------------

// 1. Register with Username & Password
app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const rawUsername = username.trim().replace(/^@/, '');
  const cleanUname = cleanUsername(rawUsername);

  if (cleanUname.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }

  const normKey = cleanUname.toLowerCase();

  // Check if username already taken
  if (usersMap.has(normKey)) {
    return res.status(400).json({ 
      error: `Username '@${cleanUname}' is already taken. Please choose another username.` 
    });
  }

  const now = new Date().toISOString();
  const isAdmin = normKey === SUPER_ADMIN_USERNAME.toLowerCase();

  const newUser: UserRecord = {
    uid: `usr_${normKey}`,
    username: normKey,
    password: password.trim(),
    displayName: (displayName && displayName.trim()) ? displayName.trim() : cleanUname,
    email: `${normKey}@testcraft.ai`,
    role: isAdmin ? 'admin' : 'instructor',
    createdAt: now,
    lastLoginAt: now,
  };

  usersMap.set(normKey, newUser);
  persistData();

  logActivity({
    type: 'user_register',
    title: `New Account Registered: @${normKey}`,
    description: `User @${normKey} created a new instructor account with private workspace.`,
    username: normKey,
    userName: newUser.displayName,
    userEmail: newUser.email,
  });

  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, user: safeUser });
});

// 2. Sign In with Username & Password
app.post('/api/auth/signin', (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const rawUsername = username.trim().replace(/^@/, '');
  const cleanUname = cleanUsername(rawUsername);
  const normKey = cleanUname.toLowerCase();

  const user = usersMap.get(normKey);
  if (!user) {
    return res.status(404).json({ 
      error: `Account with username '@${cleanUname}' does not exist. Click 'Get Started' to create it.` 
    });
  }

  if (user.password !== password.trim()) {
    return res.status(401).json({ error: 'Incorrect password for this username. Please try again.' });
  }

  user.lastLoginAt = new Date().toISOString();
  persistData();

  logActivity({
    type: 'user_login',
    title: `User Logged In: @${normKey}`,
    description: `${user.displayName} (@${normKey}) logged into workspace.`,
    username: normKey,
    userName: user.displayName,
    userEmail: user.email,
  });

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// 3. Check Username Availability
app.get('/api/auth/check-username', (req, res) => {
  const raw = ((req.query.username as string) || '').trim().replace(/^@/, '');
  if (!raw) return res.json({ available: false, message: 'Please enter a username.' });
  const clean = cleanUsername(raw);
  const normKey = clean.toLowerCase();
  const exists = usersMap.has(normKey);
  if (exists) {
    return res.json({ available: false, message: `Username '@${clean}' is already taken.` });
  }
  return res.json({ available: true, message: `Username '@${clean}' is available!` });
});

// 4. Update Profile
app.put('/api/auth/profile', (req, res) => {
  const { username, displayName } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }
  const normKey = cleanUsername(username).toLowerCase();
  const user = usersMap.get(normKey);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (displayName) user.displayName = displayName.trim();
  user.lastLoginAt = new Date().toISOString();
  persistData();

  logActivity({
    type: 'user_login',
    title: `Profile Updated: @${normKey}`,
    description: `${user.displayName} updated their account profile details.`,
    username: normKey,
    userName: user.displayName,
  });

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Compatibility route for legacy sync
app.post('/api/users/sync', (req, res) => {
  const { username, displayName } = req.body;
  const rawUname = username || 'user';
  const normKey = cleanUsername(rawUname).toLowerCase();
  let user = usersMap.get(normKey);
  if (!user) {
    const now = new Date().toISOString();
    user = {
      uid: `usr_${normKey}`,
      username: normKey,
      password: normKey === 'byabdullahkhan' ? 'gemini' : '1234',
      displayName: displayName || normKey,
      role: normKey === 'byabdullahkhan' ? 'admin' : 'instructor',
      createdAt: now,
      lastLoginAt: now,
    };
    usersMap.set(normKey, user);
    persistData();
  }
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Admin Panel: Get all accounts (Admin byabdullahkhan only)
app.get('/api/admin/users', (req, res) => {
  const adminUsername = (
    (req.query.adminUsername as string) || 
    (req.query.adminEmail as string) || 
    (req.headers['x-admin-username'] as string) || 
    ''
  ).trim().toLowerCase().replace(/^@/, '');

  if (adminUsername !== SUPER_ADMIN_USERNAME.toLowerCase() && adminUsername !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized: Admin access strictly reserved for byabdullahkhan' });
  }

  const usersList = Array.from(usersMap.values()).map(u => {
    const userTests = Array.from(testsMap.values()).filter(t => 
      (t.creatorUsername && t.creatorUsername.toLowerCase().trim().replace(/^@/, '') === u.username.toLowerCase()) ||
      (t.creatorUid && t.creatorUid === u.uid)
    );
    let totalSubs = 0;
    userTests.forEach(t => {
      const subs = submissionsMap.get(t.id) || [];
      totalSubs += subs.length;
    });

    const { password: _, ...safeUser } = u;
    return {
      ...safeUser,
      testsCount: userTests.length,
      submissionsCount: totalSubs,
    };
  });

  usersList.sort((a, b) => new Date(b.lastLoginAt || b.createdAt).getTime() - new Date(a.lastLoginAt || a.createdAt).getTime());
  res.json({ users: usersList });
});

// Admin: Purge legacy mock email accounts
app.delete('/api/admin/users/legacy-email', (req, res) => {
  const adminUsername = ((req.query.adminUsername as string) || (req.query.adminEmail as string) || '').trim().toLowerCase().replace(/^@/, '');
  if (adminUsername !== SUPER_ADMIN_USERNAME.toLowerCase() && adminUsername !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized: Admin access strictly reserved for byabdullahkhan' });
  }

  let purgedCount = 0;
  for (const [key, user] of Array.from(usersMap.entries())) {
    if (key === SUPER_ADMIN_USERNAME.toLowerCase()) continue;
    if (user.username.startsWith('usr_email') || user.username.startsWith('mock_')) {
      usersMap.delete(key);
      purgedCount++;
    }
  }

  persistData();
  res.json({ success: true, purgedCount });
});

// Admin: Create / Register user account directly
app.post('/api/admin/users/create', (req, res) => {
  const adminUsername = ((req.body.adminUsername as string) || (req.body.adminEmail as string) || '').trim().toLowerCase().replace(/^@/, '');
  if (adminUsername !== SUPER_ADMIN_USERNAME.toLowerCase() && adminUsername !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized: Admin access strictly reserved for byabdullahkhan' });
  }

  const { username, password, displayName, role } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const cleanUname = cleanUsername(username.trim().replace(/^@/, ''));
  const normKey = cleanUname.toLowerCase();

  if (usersMap.has(normKey)) {
    return res.status(400).json({ error: `Username '@${cleanUname}' is already taken.` });
  }

  const now = new Date().toISOString();
  const newUser: UserRecord = {
    uid: `usr_${normKey}`,
    username: normKey,
    password: (password && password.trim()) ? password.trim() : '1234',
    displayName: (displayName && displayName.trim()) ? displayName.trim() : cleanUname,
    email: `${normKey}@testcraft.ai`,
    role: role || (normKey === SUPER_ADMIN_USERNAME.toLowerCase() ? 'admin' : 'instructor'),
    createdAt: now,
    lastLoginAt: now,
  };

  usersMap.set(normKey, newUser);
  persistData();

  logActivity({
    type: 'user_register',
    title: `Instructor Account Added: @${normKey}`,
    description: `Super admin created new account for @${normKey} (${newUser.displayName}).`,
    username: normKey,
    userName: newUser.displayName,
  });

  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ success: true, user: safeUser });
});

// Admin: Delete a specific user account
app.delete('/api/admin/users/:targetUsername', (req, res) => {
  const adminUsername = ((req.query.adminUsername as string) || (req.query.adminEmail as string) || '').trim().toLowerCase().replace(/^@/, '');
  if (adminUsername !== SUPER_ADMIN_USERNAME.toLowerCase() && adminUsername !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized: Admin access strictly reserved for byabdullahkhan' });
  }

  const target = decodeURIComponent(req.params.targetUsername).trim().toLowerCase().replace(/^@/, '');
  if (target === SUPER_ADMIN_USERNAME.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot delete super admin account.' });
  }

  const deleted = usersMap.delete(target);
  persistData();

  logActivity({
    type: 'user_login',
    title: `Account Removed: @${target}`,
    description: `Super admin removed account for @${target}.`,
    username: SUPER_ADMIN_USERNAME,
  });

  res.json({ success: deleted });
});

// Admin: Get Quick Activity Feed
app.get('/api/admin/activities', (req, res) => {
  const adminEmail = ((req.query.adminEmail as string) || (req.headers['x-admin-email'] as string) || '').trim().toLowerCase();
  if (adminEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: 'Unauthorized: Admin access strictly reserved' });
  }

  res.json({ activities: activitiesList });
});

// Post a Site Activity log
app.post('/api/activities/log', (req, res) => {
  const { type, title, description, userEmail, userName, username, userPhoto, testId, testTitle, score, maxScore, grade, metadata } = req.body;
  if (!type || !title) {
    return res.status(400).json({ error: 'Missing required activity fields' });
  }

  const activity = logActivity({
    type,
    title,
    description: description || '',
    userEmail,
    userName,
    username: username ? cleanUsername(username) : (userEmail ? cleanUsername(userEmail.split('@')[0] || userName || 'user') : undefined),
    userPhoto,
    testId,
    testTitle,
    score,
    maxScore,
    grade,
    metadata,
  });

  res.status(201).json({ success: true, activity });
});

// 1. Get all tests (Strictly filtered by creatorUsername or creatorUid for account privacy)
app.get('/api/tests', (req, res) => {
  const creatorUsername = (req.query.creatorUsername as string | undefined)?.toLowerCase().trim().replace(/^@/, '');
  const creatorUid = req.query.creatorUid as string | undefined;
  let tests = Array.from(testsMap.values());
  
  if (creatorUsername) {
    tests = tests.filter(t => 
      t.creatorUsername && t.creatorUsername.toLowerCase().trim().replace(/^@/, '') === creatorUsername
    );
  } else if (creatorUid) {
    tests = tests.filter(t => t.creatorUid === creatorUid);
  } else {
    tests = [];
  }

  const testsList = tests.map(test => {
    const submissions = submissionsMap.get(test.id) || [];
    return {
      id: test.id,
      slug: test.slug || slugifyTitle(test.title),
      title: test.title,
      subject: test.subject,
      instructions: test.instructions,
      totalMarks: test.totalMarks,
      timeLimitMinutes: test.timeLimitMinutes,
      questionCount: test.questions.length,
      questions: test.questions,
      createdAt: test.createdAt,
      creatorName: test.creatorName,
      creatorUsername: test.creatorUsername,
      creatorUid: test.creatorUid,
      creatorEmail: test.creatorEmail,
      submissionCount: submissions.length,
    };
  });
  res.json({ tests: testsList });
});

// 2. Get test by ID or slug for student taking the test (Hides correct answers & model answers)
app.get('/api/tests/:id/take', (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);

  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  // Sanitize questions so student cannot cheat by inspecting network payload
  const sanitizedQuestions = test.questions.map(q => {
    const base = {
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      marks: q.marks,
    };

    if (q.type === 'mcq') {
      const correctCount = (q.correctOptionIds || []).length;
      return {
        ...base,
        options: q.options || [],
        correctCount: correctCount > 0 ? correctCount : 1,
        isMultipleCorrect: correctCount > 1,
        partialMarkingRule: q.partialMarkingRule || 'half',
      };
    }

    if (q.type === 'true_false') {
      return {
        ...base,
      };
    }

    // Theory question: do not reveal model answer
    return {
      ...base,
    };
  });

  res.json({
    test: {
      id: test.id,
      slug: test.slug || slugifyTitle(test.title),
      title: test.title,
      subject: test.subject,
      instructions: test.instructions,
      timeLimitMinutes: test.timeLimitMinutes,
      totalMarks: test.totalMarks,
      questionCount: test.questions.length,
      questions: sanitizedQuestions,
    },
  });
});

// 3. Get complete test details (Teacher view)
app.get('/api/tests/:id', (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);

  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  res.json({ test });
});

// 4. Create new test
app.post('/api/tests', (req, res) => {
  const body = req.body;

  if (!body.title || !body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
    return res.status(400).json({ error: 'Test must have a title and at least one question.' });
  }

  const testTitle = (body.title || 'Untitled Test').trim();
  const baseSlug = slugifyTitle(testTitle);
  let finalSlug = baseSlug;
  let counter = 1;
  while (Array.from(testsMap.values()).some(t => (t.slug === finalSlug || t.id === finalSlug))) {
    counter++;
    finalSlug = `${baseSlug}-${counter}`;
  }

  // The test ID is literally the clean title slug - NO random characters or timestamps!
  const testId = finalSlug;
  
  // Calculate total marks dynamically
  let calculatedTotalMarks = 0;
  const processedQuestions: Question[] = body.questions.map((q: any, index: number) => {
    const marks = Number(q.marks) > 0 ? Number(q.marks) : 1;
    calculatedTotalMarks += marks;

    const baseQuestion: Question = {
      id: q.id || `q_${index + 1}_${Date.now()}`,
      type: q.type,
      questionText: q.questionText || `Question ${index + 1}`,
      marks: marks,
    };

    if (q.type === 'mcq') {
      baseQuestion.options = Array.isArray(q.options) ? q.options : [];
      baseQuestion.correctOptionIds = Array.isArray(q.correctOptionIds) ? q.correctOptionIds : [];
      baseQuestion.partialMarkingRule = q.partialMarkingRule === 'zero' ? 'zero' : 'half';
    } else if (q.type === 'true_false') {
      baseQuestion.correctBoolean = Boolean(q.correctBoolean);
    } else if (q.type === 'theory') {
      baseQuestion.modelAnswer = (q.modelAnswer || '').trim();
    }

    return baseQuestion;
  });

  // Resolve creatorUsername
  const rawCreatorUname = body.creatorUsername || body.creatorName || 'instructor';
  const resolvedCreatorUsername = cleanUsername(rawCreatorUname).toLowerCase();
  const creatorUid = body.creatorUid || `usr_${resolvedCreatorUsername}`;

  const newTest: Test = {
    id: testId,
    slug: finalSlug,
    title: testTitle,
    subject: (body.subject || 'General').trim(),
    instructions: (body.instructions || '').trim(),
    timeLimitMinutes: body.timeLimitMinutes ? Number(body.timeLimitMinutes) : null,
    questions: processedQuestions,
    totalMarks: calculatedTotalMarks,
    createdAt: new Date().toISOString(),
    creatorName: (body.creatorName || resolvedCreatorUsername).trim(),
    creatorUsername: resolvedCreatorUsername,
    creatorUid: creatorUid,
    creatorEmail: body.creatorEmail || `${resolvedCreatorUsername}@testcraft.ai`,
  };

  testsMap.set(testId, newTest);
  submissionsMap.set(testId, []);
  persistData();

  logActivity({
    type: 'test_created',
    title: `Test Published: "${newTest.title}"`,
    description: `Created with ${newTest.questions.length} questions (${newTest.totalMarks} marks) in ${newTest.subject}.`,
    userEmail: newTest.creatorEmail,
    userName: newTest.creatorName,
    username: resolvedCreatorUsername,
    testId: newTest.id,
    testTitle: newTest.title,
  });

  res.status(201).json({
    message: 'Test created successfully',
    test: newTest,
  });
});

// Update / Edit test (by creator or super admin)
app.put('/api/tests/:id', (req, res) => {
  const { id } = req.params;
  const existingTest = findTestByIdOrSlug(id);
  if (!existingTest) {
    return res.status(404).json({ error: 'Test not found' });
  }

  const body = req.body;
  const requesterEmail = ((req.body.requesterEmail as string) || (req.query.userEmail as string) || (req.headers['x-user-email'] as string) || '').trim().toLowerCase();
  const isSuperAdminUser = requesterEmail === SUPER_ADMIN_EMAIL.toLowerCase();

  if (!isSuperAdminUser && existingTest.creatorEmail && requesterEmail && existingTest.creatorEmail.toLowerCase() !== requesterEmail) {
    return res.status(403).json({ error: 'Permission denied to edit this test' });
  }

  if (body.title && typeof body.title === 'string') {
    existingTest.title = body.title.trim();
  }
  if (body.subject !== undefined) {
    existingTest.subject = String(body.subject).trim();
  }
  if (body.instructions !== undefined) {
    existingTest.instructions = String(body.instructions).trim();
  }
  if (body.timeLimitMinutes !== undefined) {
    existingTest.timeLimitMinutes = body.timeLimitMinutes ? Number(body.timeLimitMinutes) : null;
  }

  if (Array.isArray(body.questions) && body.questions.length > 0) {
    let calculatedTotal = 0;
    existingTest.questions = body.questions.map((q: any, idx: number) => {
      const marks = Number(q.marks) > 0 ? Number(q.marks) : 1;
      calculatedTotal += marks;
      const base: Question = {
        id: q.id || `q_${idx + 1}_${Date.now()}`,
        type: q.type,
        questionText: q.questionText || `Question ${idx + 1}`,
        marks,
      };
      if (q.type === 'mcq') {
        base.options = Array.isArray(q.options) ? q.options : [];
        base.correctOptionIds = Array.isArray(q.correctOptionIds) ? q.correctOptionIds : [];
        base.partialMarkingRule = q.partialMarkingRule === 'zero' ? 'zero' : 'half';
      } else if (q.type === 'true_false') {
        base.correctBoolean = Boolean(q.correctBoolean);
      } else if (q.type === 'theory') {
        base.modelAnswer = (q.modelAnswer || '').trim();
      }
      return base;
    });
    existingTest.totalMarks = calculatedTotal;
  }

  testsMap.set(existingTest.id, existingTest);
  persistData();

  logActivity({
    type: 'test_updated',
    title: `Test Updated: "${existingTest.title}"`,
    description: `Modifications made to test parameters or questions by ${requesterEmail || 'instructor'}.`,
    userEmail: requesterEmail || existingTest.creatorEmail,
    testId: existingTest.id,
    testTitle: existingTest.title,
  });

  res.json({ message: 'Test updated successfully', test: existingTest });
});

// Delete test and its submissions (by creator)
app.delete('/api/tests/:id', (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  testsMap.delete(test.id);
  submissionsMap.delete(test.id);
  persistData();

  res.json({ message: 'Test and associated submissions deleted successfully', deletedId: test.id });
});

// Import or sync a test from link payload (useful across multiple container instances or dev/pre sync)
app.post('/api/tests/import', (req, res) => {
  const { test } = req.body;
  if (!test || !test.id || !test.questions) {
    return res.status(400).json({ error: 'Invalid test payload' });
  }

  if (!test.slug) {
    test.slug = slugifyTitle(test.title || test.id);
  }

  if (!testsMap.has(test.id)) {
    testsMap.set(test.id, test);
    if (!submissionsMap.has(test.id)) {
      submissionsMap.set(test.id, []);
    }
    persistData();
  }

  res.json({ message: 'Test imported successfully', test: testsMap.get(test.id) });
});

// 5. Check if student already attempted this test (one attempt rule)
app.get('/api/tests/:id/check-student', (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  const name = ((req.query.name as string) || '').trim().toLowerCase();
  const rollNo = ((req.query.rollNo as string) || '').trim().toLowerCase();

  const submissions = submissionsMap.get(test.id) || [];
  const existing = submissions.find(s => {
    const matchName = name && s.studentName.trim().toLowerCase() === name;
    const matchRoll = rollNo && s.studentIdentifier && s.studentIdentifier.trim().toLowerCase() === rollNo;
    return matchName || matchRoll;
  });

  if (existing) {
    return res.json({
      hasAttempted: true,
      submissionId: existing.id,
      submittedAt: existing.submittedAt,
    });
  }

  res.json({ hasAttempted: false });
});

// 6. Submit student test and perform automatic + AI grading
app.post('/api/tests/:id/submit', async (req, res) => {
  const { id } = req.params;
  let test = findTestByIdOrSlug(id);

  if (!test && req.body && req.body.test && Array.isArray(req.body.test.questions)) {
    const importedTest: Test = req.body.test;
    if (!importedTest.slug) {
      importedTest.slug = slugifyTitle(importedTest.title || importedTest.id || id);
    }
    if (!importedTest.id) {
      importedTest.id = importedTest.slug;
    }
    testsMap.set(importedTest.id, importedTest);
    if (!submissionsMap.has(importedTest.id)) {
      submissionsMap.set(importedTest.id, []);
    }
    persistData();
    test = importedTest;
  }

  if (!test) {
    return res.status(404).json({ error: 'Test not found' });
  }

  const { studentName, studentIdentifier, answers, timeSpentSeconds } = req.body;

  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ error: 'Student name is required' });
  }

  const existingSubmissions = submissionsMap.get(test.id) || [];
  const normalizedName = studentName.trim().toLowerCase();
  const normalizedRoll = (studentIdentifier || '').trim().toLowerCase();

  // Enforce one attempt per student (by name or roll number)
  const priorSubmission = existingSubmissions.find(s => {
    const matchName = s.studentName.trim().toLowerCase() === normalizedName;
    const matchRoll = normalizedRoll && s.studentIdentifier && s.studentIdentifier.trim().toLowerCase() === normalizedRoll;
    return matchName || matchRoll;
  });

  if (priorSubmission) {
    return res.status(409).json({
      error: 'You have already submitted this test. Each individual can only perform this test once.',
      priorSubmissionId: priorSubmission.id,
    });
  }

  // Answer map for quick lookup
  const studentAnswersMap = new Map<string, any>();
  if (Array.isArray(answers)) {
    answers.forEach((ans: any) => {
      studentAnswersMap.set(ans.questionId, ans);
    });
  } else if (answers && typeof answers === 'object') {
    Object.entries(answers).forEach(([qId, val]: [string, any]) => {
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        studentAnswersMap.set(qId, { questionId: qId, ...val });
      } else if (Array.isArray(val)) {
        studentAnswersMap.set(qId, { questionId: qId, selectedOptionIds: val });
      } else if (typeof val === 'boolean') {
        studentAnswersMap.set(qId, { questionId: qId, selectedBoolean: val });
      } else if (typeof val === 'string') {
        studentAnswersMap.set(qId, { questionId: qId, theoryAnswer: val });
      }
    });
  }

  const evaluations: QuestionEvaluation[] = [];
  let totalScore = 0;

  for (const question of test.questions) {
    const studentAns = studentAnswersMap.get(question.id);

    if (question.type === 'mcq') {
      const selectedIds: string[] = studentAns?.selectedOptionIds || [];
      const correctIds: string[] = question.correctOptionIds || [];
      const optionsList = question.options || [];
      const optionsMap = new Map(
        optionsList.map((o, idx) => {
          const letter = String.fromCharCode(65 + idx);
          return [o.id, `Option ${letter} — ${o.text}`];
        })
      );

      const studentAnswerText = selectedIds
        .map(oid => optionsMap.get(oid) || oid)
        .join(', ') || 'No option selected';

      const correctAnswerText = correctIds
        .map(oid => optionsMap.get(oid) || oid)
        .join(', ');

      const correctCount = correctIds.length;
      let marksAwarded = 0;
      let status: 'correct' | 'partial' | 'wrong' = 'wrong';

      if (correctCount === 1) {
        // Single correct MCQ
        if (selectedIds.length === 1 && selectedIds[0] === correctIds[0]) {
          marksAwarded = question.marks;
          status = 'correct';
        } else {
          marksAwarded = 0;
          status = 'wrong';
        }
      } else {
        // Multiple correct options (e.g. 2 correct)
        const correctSelected = selectedIds.filter(id => correctIds.includes(id)).length;
        const incorrectSelected = selectedIds.filter(id => !correctIds.includes(id)).length;

        if (correctSelected === correctCount && incorrectSelected === 0) {
          marksAwarded = question.marks;
          status = 'correct';
        } else if (correctSelected > 0 && incorrectSelected <= 1) {
          // Check partial marking setting
          if (question.partialMarkingRule === 'half') {
            marksAwarded = Math.round((question.marks * 0.5) * 10) / 10;
            status = 'partial';
          } else {
            marksAwarded = 0;
            status = 'wrong';
          }
        } else {
          marksAwarded = 0;
          status = 'wrong';
        }
      }

      totalScore += marksAwarded;
      evaluations.push({
        questionId: question.id,
        questionType: 'mcq',
        questionText: question.questionText,
        marksAwarded,
        maxMarks: question.marks,
        status,
        studentAnswerDisplay: studentAnswerText,
        correctAnswerDisplay: correctAnswerText,
      });
    } else if (question.type === 'true_false') {
      const selectedBool = studentAns?.selectedBoolean;
      const correctBool = question.correctBoolean;

      const studentAnswerText = selectedBool === true ? 'True' : selectedBool === false ? 'False' : 'No answer';
      const correctAnswerText = correctBool === true ? 'True' : 'False';

      let marksAwarded = 0;
      let status: 'correct' | 'partial' | 'wrong' = 'wrong';

      if (selectedBool === correctBool) {
        marksAwarded = question.marks;
        status = 'correct';
      }

      totalScore += marksAwarded;
      evaluations.push({
        questionId: question.id,
        questionType: 'true_false',
        questionText: question.questionText,
        marksAwarded,
        maxMarks: question.marks,
        status,
        studentAnswerDisplay: studentAnswerText,
        correctAnswerDisplay: correctAnswerText,
      });
    } else if (question.type === 'theory') {
      const theoryText = studentAns?.theoryAnswer || '';
      const modelAnswer = question.modelAnswer || '';

      const { marks, feedback } = await evaluateTheoryWithAI(
        question.questionText,
        modelAnswer,
        theoryText,
        question.marks
      );

      totalScore += marks;
      const status: 'correct' | 'partial' | 'wrong' =
        marks >= question.marks * 0.85
          ? 'correct'
          : marks >= question.marks * 0.4
          ? 'partial'
          : 'wrong';

      evaluations.push({
        questionId: question.id,
        questionType: 'theory',
        questionText: question.questionText,
        marksAwarded: marks,
        maxMarks: question.marks,
        status,
        studentAnswerDisplay: theoryText || '(Blank response)',
        correctAnswerDisplay: modelAnswer,
        theoryFeedback: feedback,
      });
    }
  }

  // Calculate percentage and grade
  const maxScore = test.totalMarks || 1;
  const percentage = Math.round((totalScore / maxScore) * 100);

  let grade = 'F';
  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  else if (percentage >= 50) grade = 'D';

  const passed = percentage >= 50;
  const submissionId = 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

  const submission: TestSubmission = {
    id: submissionId,
    testId: test.id,
    testTitle: test.title,
    subject: test.subject,
    studentName: studentName.trim(),
    studentIdentifier: (studentIdentifier || '').trim(),
    submittedAt: new Date().toISOString(),
    timeSpentSeconds: Number(timeSpentSeconds) || 0,
    totalScore: Math.round(totalScore * 10) / 10,
    maxScore: test.totalMarks,
    percentage,
    grade,
    passed,
    evaluations,
  };

  existingSubmissions.push(submission);
  submissionsMap.set(test.id, existingSubmissions);
  persistData();

  logActivity({
    type: 'submission_received',
    title: `Submission Graded: ${submission.studentName}`,
    description: `Scored ${submission.totalScore}/${submission.maxScore} (${submission.percentage}% - Grade ${submission.grade}) on "${submission.testTitle}".`,
    userName: submission.studentName,
    testId: test.id,
    testTitle: test.title,
    score: submission.totalScore,
    maxScore: submission.maxScore,
    grade: submission.grade,
    metadata: {
      passed: submission.passed,
      rollNo: submission.studentIdentifier,
    },
  });

  res.status(201).json({
    message: 'Test submitted and graded successfully',
    submission,
  });
});

// 7. Get submissions for a test (Teacher dashboard)
app.get('/api/tests/:id/submissions', (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  const targetSlug = slugifyTitle(decodeURIComponent(id));

  const combinedMap = new Map<string, TestSubmission>();

  if (test) {
    const directSubs = submissionsMap.get(test.id) || [];
    directSubs.forEach(s => combinedMap.set(s.id, s));
  }

  const byRawId = submissionsMap.get(id) || submissionsMap.get(targetSlug) || [];
  byRawId.forEach(s => combinedMap.set(s.id, s));

  for (const [key, subsList] of submissionsMap.entries()) {
    if (slugifyTitle(key) === targetSlug || (test && slugifyTitle(key) === slugifyTitle(test.title))) {
      subsList.forEach(s => combinedMap.set(s.id, s));
    } else {
      subsList.forEach(s => {
        if (
          slugifyTitle(s.testId || '') === targetSlug ||
          slugifyTitle(s.testTitle || '') === targetSlug ||
          (test && slugifyTitle(s.testTitle || '') === slugifyTitle(test.title))
        ) {
          combinedMap.set(s.id, s);
        }
      });
    }
  }

  res.json({ submissions: Array.from(combinedMap.values()) });
});

// Sync a client-graded or cloud-fetched submission to the server
app.post('/api/submissions/sync', (req, res) => {
  const { testId, submission, test } = req.body;
  if (!submission || !submission.id || !submission.studentName) {
    return res.status(400).json({ error: 'Invalid submission payload' });
  }

  if (test && test.id && Array.isArray(test.questions) && !testsMap.has(test.id)) {
    testsMap.set(test.id, test);
  }

  const matchedTest = findTestByIdOrSlug(testId || submission.testId || submission.testTitle || '');
  const targetKey = matchedTest ? matchedTest.id : slugifyTitle(testId || submission.testId || 'test');

  const existing = submissionsMap.get(targetKey) || [];
  const alreadyExists = existing.some(
    s =>
      s.id === submission.id ||
      (s.studentName.trim().toLowerCase() === submission.studentName.trim().toLowerCase() &&
        slugifyTitle(s.testId || '') === slugifyTitle(submission.testId || ''))
  );

  if (!alreadyExists) {
    existing.push(submission);
    submissionsMap.set(targetKey, existing);
    persistData();
  }

  res.json({ success: true, submissionsCount: existing.length });
});

// 8. Get individual submission report by ID
app.get('/api/submissions/:submissionId', (req, res) => {
  const { submissionId } = req.params;

  for (const subs of submissionsMap.values()) {
    const found = subs.find(s => s.id === submissionId);
    if (found) {
      return res.json({ submission: found });
    }
  }

  res.status(404).json({ error: 'Submission not found' });
});

// ------------------------------------
// 9. BACKEND SEO, KEYWORDS, SITEMAP & ROBOTS ENDPOINTS
// ------------------------------------
const SEO_KEYWORDS = [
  'TestCraft AI',
  'testcraftai.online',
  'testcraftai',
  'test craft ai',
  'online test maker',
  'free online test maker',
  'AI test creator',
  'AI exam maker',
  'free online quiz maker',
  'MCQ test generator',
  'multiple choice test maker',
  'AI theory answer evaluator',
  'subjective answer grading AI',
  'online exam platform for teachers',
  'automatic test grading software',
  'create online test with link',
  'student exam portal',
  'shareable test link generator',
  'no login student test link',
  'conceptual answer grading AI',
  'true false test maker',
  'digital classroom assessment tool',
  'instant student report card',
  'online quiz builder free',
  'academic exam creator',
  'live test results dashboard',
  'timed online test creator',
  'single attempt online exam',
  'smart exam evaluator',
  'best online test maker free',
];

app.get('/api/seo/keywords', (_req, res) => {
  res.json({
    siteName: 'TestCraft AI',
    canonicalUrl: 'https://testcraftai.online/',
    title: 'TestCraft AI – Free Online Test Maker, MCQ Builder & AI Exam Grader',
    description:
      'Create customizable online tests with MCQs, True/False, and AI-evaluated theory questions on TestCraft AI (testcraftai.online). Share instant student test links and track live graded reports.',
    keywords: SEO_KEYWORDS,
  });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\n\nSitemap: https://testcraftai.online/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (_req, res) => {
  const nowIso = new Date().toISOString();
  const publicTestUrls = Array.from(testsMap.values())
    .slice(0, 100)
    .map(
      t => `  <url>
    <loc>https://testcraftai.online/?test=${encodeURIComponent(t.slug || t.id)}</loc>
    <lastmod>${t.createdAt || nowIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://testcraftai.online/</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.testcraftai.online/</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${publicTestUrls}
</urlset>`;

  res.type('application/xml').send(xml);
});

// ------------------------------------
// SERVER START & VITE MIDDLEWARE
// ------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TestCraft AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
