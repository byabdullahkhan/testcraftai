var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
var geminiApiKey = process.env.GEMINI_API_KEY || "";
var ai = new import_genai.GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var testsMap = /* @__PURE__ */ new Map();
var submissionsMap = /* @__PURE__ */ new Map();
function slugifyTitle(title) {
  if (!title) return "test";
  return title.toLowerCase().trim().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "test";
}
function findTestByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return void 0;
  const decoded = decodeURIComponent(idOrSlug).trim().toLowerCase();
  const direct = testsMap.get(decoded) || testsMap.get(idOrSlug.trim());
  if (direct) return direct;
  const bySlug = Array.from(testsMap.values()).find(
    (t) => t.slug && t.slug.toLowerCase() === decoded || t.id && t.id.toLowerCase() === decoded
  );
  if (bySlug) return bySlug;
  const targetSlug = slugifyTitle(decoded);
  return Array.from(testsMap.values()).find(
    (t) => t.slug && t.slug.toLowerCase() === targetSlug || slugifyTitle(t.title) === targetSlug
  );
}
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var TESTS_FILE = import_path.default.join(DATA_DIR, "tests.json");
var SUBMISSIONS_FILE = import_path.default.join(DATA_DIR, "submissions.json");
var USERS_FILE = import_path.default.join(DATA_DIR, "users.json");
var SUPER_ADMIN_EMAIL = "byabdullahkhan@gmail.com";
var usersMap = /* @__PURE__ */ new Map();
function initPersistence() {
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (import_fs.default.existsSync(TESTS_FILE)) {
      const testsArr = JSON.parse(import_fs.default.readFileSync(TESTS_FILE, "utf-8"));
      testsArr.forEach((t) => {
        if (!t.slug) {
          t.slug = slugifyTitle(t.title);
        }
        testsMap.set(t.id, t);
      });
    }
    if (import_fs.default.existsSync(SUBMISSIONS_FILE)) {
      const subsObj = JSON.parse(import_fs.default.readFileSync(SUBMISSIONS_FILE, "utf-8"));
      Object.entries(subsObj).forEach(([id, subs]) => submissionsMap.set(id, subs));
    }
    if (import_fs.default.existsSync(USERS_FILE)) {
      const usersArr = JSON.parse(import_fs.default.readFileSync(USERS_FILE, "utf-8"));
      usersArr.forEach((u) => {
        if (u.email) {
          usersMap.set(u.email.toLowerCase().trim(), u);
        }
      });
    }
  } catch (err) {
    console.error("Error initializing file persistence:", err);
  }
}
function persistData() {
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    import_fs.default.writeFileSync(TESTS_FILE, JSON.stringify(Array.from(testsMap.values()), null, 2));
    const subsObj = {};
    submissionsMap.forEach((subs, id) => {
      subsObj[id] = subs;
    });
    import_fs.default.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(subsObj, null, 2));
    import_fs.default.writeFileSync(USERS_FILE, JSON.stringify(Array.from(usersMap.values()), null, 2));
  } catch (err) {
    console.error("Error persisting data:", err);
  }
}
initPersistence();
async function evaluateTheoryWithAI(questionText, modelAnswer, studentAnswer, maxMarks) {
  const trimmedAnswer = (studentAnswer || "").trim();
  if (!trimmedAnswer) {
    return {
      marks: 0,
      feedback: {
        conceptMatchPercentage: 0,
        accuracyScore: 0,
        conceptualVerdict: "No answer provided",
        strengths: "None",
        missingPoints: "The student did not submit an answer for this question.",
        rubricNotes: "Zero marks awarded due to missing submission."
      }
    };
  }
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
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              marksAwarded: {
                type: import_genai.Type.NUMBER,
                description: `Marks awarded to student, between 0 and ${maxMarks}. Can have 1 decimal place.`
              },
              conceptMatchPercentage: {
                type: import_genai.Type.NUMBER,
                description: "Percentage match of conceptual coverage (0 to 100)."
              },
              accuracyScore: {
                type: import_genai.Type.NUMBER,
                description: "Score out of 10 for conceptual correctness and clarity."
              },
              conceptualVerdict: {
                type: import_genai.Type.STRING,
                description: "Brief verdict on conceptual understanding (e.g. Excellent grasp, Solid understanding, Partial grasp, Incomplete)."
              },
              strengths: {
                type: import_genai.Type.STRING,
                description: "Key concepts or correct facts the student articulated well."
              },
              missingPoints: {
                type: import_genai.Type.STRING,
                description: "Any critical concept or detail from the model answer that was missing or unclear."
              },
              rubricNotes: {
                type: import_genai.Type.STRING,
                description: "Friendly constructive explanation of how the score was calculated."
              }
            },
            required: [
              "marksAwarded",
              "conceptMatchPercentage",
              "accuracyScore",
              "conceptualVerdict",
              "strengths",
              "missingPoints",
              "rubricNotes"
            ]
          }
        }
      });
      const parsed = JSON.parse(response.text || "{}");
      const awarded2 = Math.min(
        maxMarks,
        Math.max(0, Number(parsed.marksAwarded ?? maxMarks * 0.7))
      );
      return {
        marks: Math.round(awarded2 * 10) / 10,
        feedback: {
          conceptMatchPercentage: Math.min(100, Math.max(0, Math.round(Number(parsed.conceptMatchPercentage || 70)))),
          accuracyScore: Math.min(10, Math.max(0, Math.round(Number(parsed.accuracyScore || 7) * 10) / 10)),
          conceptualVerdict: parsed.conceptualVerdict || "Conceptually evaluated",
          strengths: parsed.strengths || "Articulated core concept directly.",
          missingPoints: parsed.missingPoints || "Could expand further on technical nuances.",
          rubricNotes: parsed.rubricNotes || "Graded on conceptual alignment with teacher model answer."
        }
      };
    } catch (err) {
      console.error("Gemini grading error, applying fallback conceptual analyzer:", err);
    }
  }
  const modelTokens = new Set(
    modelAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3)
  );
  const studentTokens = new Set(
    trimmedAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3)
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
      conceptualVerdict: matchPct >= 80 ? "Thorough conceptual understanding" : matchPct >= 50 ? "Demonstrates basic conceptual grasp" : "Key concepts omitted",
      strengths: "Conveyed meaningful context related to the topic.",
      missingPoints: matchPct < 80 ? "Compare with the teacher model answer for additional specific details." : "Comprehensive response provided.",
      rubricNotes: "Evaluated using conceptual keywords and depth of explanation."
    }
  };
}
app.post("/api/users/sync", (req, res) => {
  const { uid, email, displayName, photoURL } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const normalizedEmail = email.toLowerCase().trim();
  const existing = usersMap.get(normalizedEmail);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedUser = {
    uid: uid || existing?.uid || `user-${Date.now()}`,
    email: normalizedEmail,
    displayName: displayName || existing?.displayName || normalizedEmail.split("@")[0],
    photoURL: photoURL || existing?.photoURL,
    createdAt: existing?.createdAt || now,
    lastLoginAt: now
  };
  usersMap.set(normalizedEmail, updatedUser);
  persistData();
  res.json({ success: true, user: updatedUser });
});
app.get("/api/admin/users", (req, res) => {
  const adminEmail = (req.query.adminEmail || req.headers["x-admin-email"] || "").trim().toLowerCase();
  if (adminEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: "Unauthorized: Admin access strictly reserved for byabdullahkhan@gmail.com" });
  }
  Array.from(testsMap.values()).forEach((t) => {
    if (t.creatorEmail) {
      const norm = t.creatorEmail.toLowerCase().trim();
      if (!usersMap.has(norm)) {
        usersMap.set(norm, {
          uid: t.creatorUid || `uid-${norm}`,
          email: norm,
          displayName: t.creatorName || norm.split("@")[0],
          createdAt: t.createdAt,
          lastLoginAt: t.createdAt
        });
      }
    }
  });
  const usersList = Array.from(usersMap.values()).map((u) => {
    const userTests = Array.from(testsMap.values()).filter(
      (t) => t.creatorEmail && t.creatorEmail.toLowerCase().trim() === u.email.toLowerCase().trim() || t.creatorUid && t.creatorUid === u.uid
    );
    let totalSubs = 0;
    userTests.forEach((t) => {
      const subs = submissionsMap.get(t.id) || [];
      totalSubs += subs.length;
    });
    return {
      ...u,
      testsCount: userTests.length,
      submissionsCount: totalSubs
    };
  });
  usersList.sort((a, b) => new Date(b.lastLoginAt || b.createdAt).getTime() - new Date(a.lastLoginAt || a.createdAt).getTime());
  res.json({ users: usersList });
});
app.get("/api/tests", (req, res) => {
  const creatorUid = req.query.creatorUid;
  const creatorEmail = req.query.creatorEmail;
  let tests = Array.from(testsMap.values());
  if (creatorUid) {
    tests = tests.filter((t) => t.creatorUid === creatorUid);
  } else if (creatorEmail) {
    const norm = creatorEmail.toLowerCase().trim();
    tests = tests.filter((t) => t.creatorEmail && t.creatorEmail.toLowerCase().trim() === norm);
  }
  const testsList = tests.map((test) => {
    const submissions = submissionsMap.get(test.id) || [];
    return {
      id: test.id,
      slug: test.slug || slugifyTitle(test.title),
      title: test.title,
      subject: test.subject,
      totalMarks: test.totalMarks,
      timeLimitMinutes: test.timeLimitMinutes,
      questionCount: test.questions.length,
      createdAt: test.createdAt,
      creatorName: test.creatorName,
      creatorUid: test.creatorUid,
      creatorEmail: test.creatorEmail,
      submissionCount: submissions.length
    };
  });
  res.json({ tests: testsList });
});
app.get("/api/tests/:id/take", (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  const sanitizedQuestions = test.questions.map((q) => {
    const base = {
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      marks: q.marks
    };
    if (q.type === "mcq") {
      const correctCount = (q.correctOptionIds || []).length;
      return {
        ...base,
        options: q.options || [],
        correctCount: correctCount > 0 ? correctCount : 1,
        isMultipleCorrect: correctCount > 1,
        partialMarkingRule: q.partialMarkingRule || "half"
      };
    }
    if (q.type === "true_false") {
      return {
        ...base
      };
    }
    return {
      ...base
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
      questions: sanitizedQuestions
    }
  });
});
app.get("/api/tests/:id", (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  res.json({ test });
});
app.post("/api/tests", (req, res) => {
  const body = req.body;
  if (!body.title || !body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
    return res.status(400).json({ error: "Test must have a title and at least one question." });
  }
  const testTitle = (body.title || "Untitled Test").trim();
  const baseSlug = slugifyTitle(testTitle);
  let finalSlug = baseSlug;
  let counter = 1;
  while (Array.from(testsMap.values()).some((t) => t.slug === finalSlug || t.id === finalSlug)) {
    counter++;
    finalSlug = `${baseSlug}-${counter}`;
  }
  const testId = finalSlug;
  let calculatedTotalMarks = 0;
  const processedQuestions = body.questions.map((q, index) => {
    const marks = Number(q.marks) > 0 ? Number(q.marks) : 1;
    calculatedTotalMarks += marks;
    const baseQuestion = {
      id: q.id || `q_${index + 1}_${Date.now()}`,
      type: q.type,
      questionText: q.questionText || `Question ${index + 1}`,
      marks
    };
    if (q.type === "mcq") {
      baseQuestion.options = Array.isArray(q.options) ? q.options : [];
      baseQuestion.correctOptionIds = Array.isArray(q.correctOptionIds) ? q.correctOptionIds : [];
      baseQuestion.partialMarkingRule = q.partialMarkingRule === "zero" ? "zero" : "half";
    } else if (q.type === "true_false") {
      baseQuestion.correctBoolean = Boolean(q.correctBoolean);
    } else if (q.type === "theory") {
      baseQuestion.modelAnswer = (q.modelAnswer || "").trim();
    }
    return baseQuestion;
  });
  const newTest = {
    id: testId,
    slug: finalSlug,
    title: testTitle,
    subject: (body.subject || "General").trim(),
    instructions: (body.instructions || "").trim(),
    timeLimitMinutes: body.timeLimitMinutes ? Number(body.timeLimitMinutes) : null,
    questions: processedQuestions,
    totalMarks: calculatedTotalMarks,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    creatorName: (body.creatorName || "Instructor").trim(),
    creatorUid: body.creatorUid || "",
    creatorEmail: body.creatorEmail || ""
  };
  if (body.creatorEmail) {
    const creatorEmailNorm = body.creatorEmail.toLowerCase().trim();
    const existing = usersMap.get(creatorEmailNorm);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    usersMap.set(creatorEmailNorm, {
      uid: body.creatorUid || existing?.uid || `user-${Date.now()}`,
      email: creatorEmailNorm,
      displayName: (body.creatorName || existing?.displayName || creatorEmailNorm.split("@")[0]).trim(),
      photoURL: existing?.photoURL,
      createdAt: existing?.createdAt || now,
      lastLoginAt: now
    });
  }
  testsMap.set(testId, newTest);
  submissionsMap.set(testId, []);
  persistData();
  res.status(201).json({
    message: "Test created successfully",
    test: newTest
  });
});
app.put("/api/tests/:id", (req, res) => {
  const { id } = req.params;
  const existingTest = findTestByIdOrSlug(id);
  if (!existingTest) {
    return res.status(404).json({ error: "Test not found" });
  }
  const body = req.body;
  const requesterEmail = (req.body.requesterEmail || req.query.userEmail || req.headers["x-user-email"] || "").trim().toLowerCase();
  const isSuperAdminUser = requesterEmail === SUPER_ADMIN_EMAIL.toLowerCase();
  if (!isSuperAdminUser && existingTest.creatorEmail && requesterEmail && existingTest.creatorEmail.toLowerCase() !== requesterEmail) {
    return res.status(403).json({ error: "Permission denied to edit this test" });
  }
  if (body.title && typeof body.title === "string") {
    existingTest.title = body.title.trim();
  }
  if (body.subject !== void 0) {
    existingTest.subject = String(body.subject).trim();
  }
  if (body.instructions !== void 0) {
    existingTest.instructions = String(body.instructions).trim();
  }
  if (body.timeLimitMinutes !== void 0) {
    existingTest.timeLimitMinutes = body.timeLimitMinutes ? Number(body.timeLimitMinutes) : null;
  }
  if (Array.isArray(body.questions) && body.questions.length > 0) {
    let calculatedTotal = 0;
    existingTest.questions = body.questions.map((q, idx) => {
      const marks = Number(q.marks) > 0 ? Number(q.marks) : 1;
      calculatedTotal += marks;
      const base = {
        id: q.id || `q_${idx + 1}_${Date.now()}`,
        type: q.type,
        questionText: q.questionText || `Question ${idx + 1}`,
        marks
      };
      if (q.type === "mcq") {
        base.options = Array.isArray(q.options) ? q.options : [];
        base.correctOptionIds = Array.isArray(q.correctOptionIds) ? q.correctOptionIds : [];
        base.partialMarkingRule = q.partialMarkingRule === "zero" ? "zero" : "half";
      } else if (q.type === "true_false") {
        base.correctBoolean = Boolean(q.correctBoolean);
      } else if (q.type === "theory") {
        base.modelAnswer = (q.modelAnswer || "").trim();
      }
      return base;
    });
    existingTest.totalMarks = calculatedTotal;
  }
  testsMap.set(existingTest.id, existingTest);
  persistData();
  res.json({ message: "Test updated successfully", test: existingTest });
});
app.delete("/api/tests/:id", (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  const requesterEmail = (req.query.userEmail || req.headers["x-user-email"] || "").trim().toLowerCase();
  const isSuperAdminUser = requesterEmail === SUPER_ADMIN_EMAIL.toLowerCase();
  if (!isSuperAdminUser && test.creatorEmail && requesterEmail && test.creatorEmail.toLowerCase() !== requesterEmail) {
    return res.status(403).json({ error: "Permission denied to delete this test" });
  }
  testsMap.delete(test.id);
  submissionsMap.delete(test.id);
  persistData();
  res.json({ message: "Test and associated submissions deleted successfully", deletedId: test.id });
});
app.post("/api/tests/import", (req, res) => {
  const { test } = req.body;
  if (!test || !test.id || !test.questions) {
    return res.status(400).json({ error: "Invalid test payload" });
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
  res.json({ message: "Test imported successfully", test: testsMap.get(test.id) });
});
app.get("/api/tests/:id/check-student", (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  const name = (req.query.name || "").trim().toLowerCase();
  const rollNo = (req.query.rollNo || "").trim().toLowerCase();
  const submissions = submissionsMap.get(test.id) || [];
  const existing = submissions.find((s) => {
    const matchName = name && s.studentName.trim().toLowerCase() === name;
    const matchRoll = rollNo && s.studentIdentifier && s.studentIdentifier.trim().toLowerCase() === rollNo;
    return matchName || matchRoll;
  });
  if (existing) {
    return res.json({
      hasAttempted: true,
      submissionId: existing.id,
      submittedAt: existing.submittedAt
    });
  }
  res.json({ hasAttempted: false });
});
app.post("/api/tests/:id/submit", async (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  const { studentName, studentIdentifier, answers, timeSpentSeconds } = req.body;
  if (!studentName || !studentName.trim()) {
    return res.status(400).json({ error: "Student name is required" });
  }
  const existingSubmissions = submissionsMap.get(test.id) || [];
  const normalizedName = studentName.trim().toLowerCase();
  const normalizedRoll = (studentIdentifier || "").trim().toLowerCase();
  const priorSubmission = existingSubmissions.find((s) => {
    const matchName = s.studentName.trim().toLowerCase() === normalizedName;
    const matchRoll = normalizedRoll && s.studentIdentifier && s.studentIdentifier.trim().toLowerCase() === normalizedRoll;
    return matchName || matchRoll;
  });
  if (priorSubmission) {
    return res.status(409).json({
      error: "You have already submitted this test. Each individual can only perform this test once.",
      priorSubmissionId: priorSubmission.id
    });
  }
  const studentAnswersMap = /* @__PURE__ */ new Map();
  if (Array.isArray(answers)) {
    answers.forEach((ans) => {
      studentAnswersMap.set(ans.questionId, ans);
    });
  } else if (answers && typeof answers === "object") {
    Object.entries(answers).forEach(([qId, val]) => {
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        studentAnswersMap.set(qId, { questionId: qId, ...val });
      } else if (Array.isArray(val)) {
        studentAnswersMap.set(qId, { questionId: qId, selectedOptionIds: val });
      } else if (typeof val === "boolean") {
        studentAnswersMap.set(qId, { questionId: qId, selectedBoolean: val });
      } else if (typeof val === "string") {
        studentAnswersMap.set(qId, { questionId: qId, theoryAnswer: val });
      }
    });
  }
  const evaluations = [];
  let totalScore = 0;
  for (const question of test.questions) {
    const studentAns = studentAnswersMap.get(question.id);
    if (question.type === "mcq") {
      const selectedIds = studentAns?.selectedOptionIds || [];
      const correctIds = question.correctOptionIds || [];
      const optionsMap = new Map((question.options || []).map((o) => [o.id, o.text]));
      const studentAnswerText = selectedIds.map((oid) => optionsMap.get(oid) || oid).join(", ") || "No option selected";
      const correctAnswerText = correctIds.map((oid) => optionsMap.get(oid) || oid).join(", ");
      const correctCount = correctIds.length;
      let marksAwarded = 0;
      let status = "wrong";
      if (correctCount === 1) {
        if (selectedIds.length === 1 && selectedIds[0] === correctIds[0]) {
          marksAwarded = question.marks;
          status = "correct";
        } else {
          marksAwarded = 0;
          status = "wrong";
        }
      } else {
        const correctSelected = selectedIds.filter((id2) => correctIds.includes(id2)).length;
        const incorrectSelected = selectedIds.filter((id2) => !correctIds.includes(id2)).length;
        if (correctSelected === correctCount && incorrectSelected === 0) {
          marksAwarded = question.marks;
          status = "correct";
        } else if (correctSelected > 0 && incorrectSelected <= 1) {
          if (question.partialMarkingRule === "half") {
            marksAwarded = Math.round(question.marks * 0.5 * 10) / 10;
            status = "partial";
          } else {
            marksAwarded = 0;
            status = "wrong";
          }
        } else {
          marksAwarded = 0;
          status = "wrong";
        }
      }
      totalScore += marksAwarded;
      evaluations.push({
        questionId: question.id,
        questionType: "mcq",
        questionText: question.questionText,
        marksAwarded,
        maxMarks: question.marks,
        status,
        studentAnswerDisplay: studentAnswerText,
        correctAnswerDisplay: correctAnswerText
      });
    } else if (question.type === "true_false") {
      const selectedBool = studentAns?.selectedBoolean;
      const correctBool = question.correctBoolean;
      const studentAnswerText = selectedBool === true ? "True" : selectedBool === false ? "False" : "No answer";
      const correctAnswerText = correctBool === true ? "True" : "False";
      let marksAwarded = 0;
      let status = "wrong";
      if (selectedBool === correctBool) {
        marksAwarded = question.marks;
        status = "correct";
      }
      totalScore += marksAwarded;
      evaluations.push({
        questionId: question.id,
        questionType: "true_false",
        questionText: question.questionText,
        marksAwarded,
        maxMarks: question.marks,
        status,
        studentAnswerDisplay: studentAnswerText,
        correctAnswerDisplay: correctAnswerText
      });
    } else if (question.type === "theory") {
      const theoryText = studentAns?.theoryAnswer || "";
      const modelAnswer = question.modelAnswer || "";
      const { marks, feedback } = await evaluateTheoryWithAI(
        question.questionText,
        modelAnswer,
        theoryText,
        question.marks
      );
      totalScore += marks;
      const status = marks >= question.marks * 0.85 ? "correct" : marks >= question.marks * 0.4 ? "partial" : "wrong";
      evaluations.push({
        questionId: question.id,
        questionType: "theory",
        questionText: question.questionText,
        marksAwarded: marks,
        maxMarks: question.marks,
        status,
        studentAnswerDisplay: theoryText || "(Blank response)",
        correctAnswerDisplay: modelAnswer,
        theoryFeedback: feedback
      });
    }
  }
  const maxScore = test.totalMarks || 1;
  const percentage = Math.round(totalScore / maxScore * 100);
  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B";
  else if (percentage >= 60) grade = "C";
  else if (percentage >= 50) grade = "D";
  const passed = percentage >= 50;
  const submissionId = "sub-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6);
  const submission = {
    id: submissionId,
    testId: test.id,
    testTitle: test.title,
    subject: test.subject,
    studentName: studentName.trim(),
    studentIdentifier: (studentIdentifier || "").trim(),
    submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
    timeSpentSeconds: Number(timeSpentSeconds) || 0,
    totalScore: Math.round(totalScore * 10) / 10,
    maxScore: test.totalMarks,
    percentage,
    grade,
    passed,
    evaluations
  };
  existingSubmissions.push(submission);
  submissionsMap.set(test.id, existingSubmissions);
  persistData();
  res.status(201).json({
    message: "Test submitted and graded successfully",
    submission
  });
});
app.get("/api/tests/:id/submissions", (req, res) => {
  const { id } = req.params;
  const test = findTestByIdOrSlug(id);
  if (!test) {
    return res.status(404).json({ error: "Test not found" });
  }
  const submissions = submissionsMap.get(test.id) || [];
  res.json({ submissions });
});
app.get("/api/submissions/:submissionId", (req, res) => {
  const { submissionId } = req.params;
  for (const subs of submissionsMap.values()) {
    const found = subs.find((s) => s.id === submissionId);
    if (found) {
      return res.json({ submission: found });
    }
  }
  res.status(404).json({ error: "Submission not found" });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TestCraft AI Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
