
import { User, QuizResult, GlobalState, Question, Badge, UserBadge } from '../types';
import { Pool } from '@neondatabase/serverless';

const CURRENT_USER_KEY = 'asaa_current_user';
const LS_USERS_KEY = 'asaa_db_users';
const LS_RESULTS_KEY = 'asaa_db_results';
const LS_GLOBAL_KEY = 'asaa_db_global_state';
const LS_QUESTIONS_KEY = 'asaa_db_questions';
const LS_BADGES_KEY = 'asaa_user_badges';

// Try to initialize pool if URL exists in environment
const dbUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

if (dbUrl) {
  pool = new Pool({ connectionString: dbUrl });
} else {
  console.warn("DATABASE_URL is not set. The app will use LocalStorage as a fallback.");
}

// --- Badge Definitions ---
export const BADGE_DEFINITIONS: Badge[] = [
  { id: 'FIRST_STEP', name: 'Premier Pas', description: 'Terminer son premier quiz', icon: '🦶', conditionType: 'COUNT', threshold: 1 },
  { id: 'REGULAR', name: 'Habitué', description: 'Jouer 10 fois', icon: '🎗️', conditionType: 'COUNT', threshold: 10 },
  { id: 'VETERAN', name: 'Vétéran', description: 'Jouer 50 fois', icon: '🛡️', conditionType: 'COUNT', threshold: 50 },
  { id: 'PERFECTIONIST', name: 'Sans Faute', description: 'Obtenir 100% de bonnes réponses', icon: '💎', conditionType: 'PERFECT', threshold: 1 },
  { id: 'SCHOLAR', name: 'Savant', description: 'Cumuler 500 points au total', icon: '📜', conditionType: 'TOTAL_SCORE', threshold: 500 },
  { id: 'MASTER', name: 'Maître', description: 'Cumuler 1000 points au total', icon: '👑', conditionType: 'TOTAL_SCORE', threshold: 1000 },
];

// --- Database Initialization ---
export const initDB = async (): Promise<void> => {
  if (!pool) {
    initLocalStorage();
    return;
  }

  try {
    const client = await pool.connect();
    
    // Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        last_played_date TEXT
      );
    `);

    // Create Results Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS results (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        date TEXT NOT NULL
      );
    `);

    // Create Questions Bank Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation TEXT,
        difficulty TEXT,
        source TEXT
      );
    `);

    // Create User Badges Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        username TEXT NOT NULL,
        badge_id TEXT NOT NULL,
        date_earned TEXT NOT NULL,
        PRIMARY KEY (username, badge_id)
      );
    `);

    // Create Global State Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_state (
        key TEXT PRIMARY KEY,
        value JSONB
      );
    `);

    const stateCheck = await client.query('SELECT value FROM global_state WHERE key = $1', ['config']);
    if (stateCheck.rowCount === 0) {
      await client.query('INSERT INTO global_state (key, value) VALUES ($1, $2)', ['config', JSON.stringify({ isManualOverride: false, isQuizOpen: false })]);
    }

    client.release();
    console.log("Neon Database initialized successfully");
  } catch (err) {
    console.error("Error initializing database (Switching to LocalStorage fallback):", err);
    pool = null; 
    initLocalStorage();
  }
};

const initLocalStorage = () => {
  if (!localStorage.getItem(LS_USERS_KEY)) localStorage.setItem(LS_USERS_KEY, JSON.stringify([]));
  if (!localStorage.getItem(LS_RESULTS_KEY)) localStorage.setItem(LS_RESULTS_KEY, JSON.stringify([]));
  if (!localStorage.getItem(LS_QUESTIONS_KEY)) localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify([]));
  if (!localStorage.getItem(LS_BADGES_KEY)) localStorage.setItem(LS_BADGES_KEY, JSON.stringify([]));
  if (!localStorage.getItem(LS_GLOBAL_KEY)) {
    localStorage.setItem(LS_GLOBAL_KEY, JSON.stringify({ isManualOverride: false, isQuizOpen: false }));
  }
  console.log("LocalStorage initialized (Fallback mode)");
};

// --- User Management ---
export const saveUser = async (user: User): Promise<void> => {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

  if (pool) {
    try {
      const client = await pool.connect();
      await client.query(
        `INSERT INTO users (username, role, last_played_date) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (username) 
         DO UPDATE SET role = $2, last_played_date = $3`,
        [user.username, user.role, user.lastPlayedDate]
      );
      client.release();
      return;
    } catch (err) {
      console.error("DB Error saveUser:", err);
    }
  }

  const users = JSON.parse(localStorage.getItem(LS_USERS_KEY) || '[]');
  const index = users.findIndex((u: User) => u.username === user.username);
  if (index >= 0) users[index] = user;
  else users.push(user);
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
};

export const getUsers = async (): Promise<User[]> => {
  if (pool) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT username, role, last_played_date as "lastPlayedDate" FROM users');
      client.release();
      return result.rows;
    } catch (err) {
      console.error("DB Error getUsers:", err);
    }
  }
  return JSON.parse(localStorage.getItem(LS_USERS_KEY) || '[]');
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const logoutUser = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

// --- Results Management & Badge Logic ---
export const saveResult = async (result: QuizResult): Promise<void> => {
  const currentUser = getCurrentUser();
  const today = new Date().toISOString().split('T')[0];
  
  if (currentUser && currentUser.username === result.username) {
    currentUser.lastPlayedDate = today;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
  }

  // 1. Save Result
  if (pool) {
    try {
      const client = await pool.connect();
      await client.query(
        'INSERT INTO results (username, score, total_questions, date) VALUES ($1, $2, $3, $4)',
        [result.username, result.score, result.totalQuestions, result.date]
      );
      await client.query(
        'UPDATE users SET last_played_date = $1 WHERE username = $2',
        [today, result.username]
      );
      client.release();
    } catch (err) {
      console.error("DB Error saveResult:", err);
    }
  } else {
    const results = JSON.parse(localStorage.getItem(LS_RESULTS_KEY) || '[]');
    results.push(result);
    localStorage.setItem(LS_RESULTS_KEY, JSON.stringify(results));

    const users = JSON.parse(localStorage.getItem(LS_USERS_KEY) || '[]');
    const userIdx = users.findIndex((u: User) => u.username === result.username);
    if (userIdx >= 0) {
      users[userIdx].lastPlayedDate = today;
      localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
    }
  }

  // 2. Check and Award Badges
  await checkBadges(result.username, result);
};

export const getResults = async (): Promise<QuizResult[]> => {
  if (pool) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT username, score, total_questions as "totalQuestions", date FROM results ORDER BY id DESC');
      client.release();
      return result.rows;
    } catch (err) {
      console.error("DB Error getResults:", err);
    }
  }
  const results = JSON.parse(localStorage.getItem(LS_RESULTS_KEY) || '[]');
  return results.sort((a: QuizResult, b: QuizResult) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// --- Badge Internal Logic ---

const checkBadges = async (username: string, currentResult: QuizResult) => {
  // Get all results for this user to calculate stats
  const allResults = await getResults();
  const userResults = allResults.filter(r => r.username === username);
  
  // Calculate Stats
  const gamesPlayed = userResults.length;
  const totalScore = userResults.reduce((acc, curr) => acc + curr.score, 0);
  const isPerfect = currentResult.score === (currentResult.totalQuestions * 5); // Assuming 5pts per question

  // Get existing badges
  const earnedBadges = await getUserBadges(username);
  const earnedIds = new Set(earnedBadges.map(b => b.badgeId));

  const badgesToAward: string[] = [];

  for (const def of BADGE_DEFINITIONS) {
    if (earnedIds.has(def.id)) continue;

    let awarded = false;
    switch(def.conditionType) {
      case 'COUNT':
        if (gamesPlayed >= def.threshold) awarded = true;
        break;
      case 'TOTAL_SCORE':
        if (totalScore >= def.threshold) awarded = true;
        break;
      case 'PERFECT':
        if (isPerfect) awarded = true;
        break;
    }

    if (awarded) {
      badgesToAward.push(def.id);
    }
  }

  for (const badgeId of badgesToAward) {
    await awardBadge(username, badgeId);
  }
};

const awardBadge = async (username: string, badgeId: string) => {
  const dateEarned = new Date().toISOString();
  
  if (pool) {
    try {
      const client = await pool.connect();
      await client.query(
        `INSERT INTO user_badges (username, badge_id, date_earned) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [username, badgeId, dateEarned]
      );
      client.release();
    } catch (err) { console.error("DB Award Badge error", err); }
  } else {
    const badges = JSON.parse(localStorage.getItem(LS_BADGES_KEY) || '[]');
    if (!badges.some((b: UserBadge) => b.username === username && b.badgeId === badgeId)) {
      badges.push({ username, badgeId, dateEarned });
      localStorage.setItem(LS_BADGES_KEY, JSON.stringify(badges));
    }
  }
};

export const getUserBadges = async (username: string): Promise<UserBadge[]> => {
  if (pool) {
    try {
      const client = await pool.connect();
      const res = await client.query('SELECT username, badge_id as "badgeId", date_earned as "dateEarned" FROM user_badges WHERE username = $1', [username]);
      client.release();
      return res.rows;
    } catch (err) { console.error("DB Get Badge error", err); }
  }
  const badges = JSON.parse(localStorage.getItem(LS_BADGES_KEY) || '[]');
  return badges.filter((b: UserBadge) => b.username === username);
};

// --- Question Bank Management ---

export const saveQuestion = async (question: Question): Promise<void> => {
  if (pool) {
    try {
      const client = await pool.connect();
      if (question.id) {
         // Update
         await client.query(
             `UPDATE questions SET question_text=$1, options=$2, correct_index=$3, explanation=$4, difficulty=$5, source=$6 WHERE id=$7`,
             [question.questionText, JSON.stringify(question.options), question.correctAnswerIndex, question.explanation, question.difficulty, question.source || 'MANUAL', question.id]
         );
      } else {
         // Insert
         await client.query(
            `INSERT INTO questions (question_text, options, correct_index, explanation, difficulty, source) VALUES ($1, $2, $3, $4, $5, $6)`,
            [question.questionText, JSON.stringify(question.options), question.correctAnswerIndex, question.explanation, question.difficulty, question.source || 'MANUAL']
         );
      }
      client.release();
      return;
    } catch (err) {
      console.error("DB Error saveQuestion:", err);
    }
  }

  const questions = JSON.parse(localStorage.getItem(LS_QUESTIONS_KEY) || '[]');
  if (question.id) {
      const idx = questions.findIndex((q: any) => q.id === question.id);
      if (idx >= 0) questions[idx] = question;
  } else {
      question.id = Date.now(); // Fake ID for LS
      questions.push(question);
  }
  localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(questions));
};

export const deleteQuestion = async (id: number): Promise<void> => {
    if (pool) {
        try {
            const client = await pool.connect();
            await client.query('DELETE FROM questions WHERE id = $1', [id]);
            client.release();
            return;
        } catch (err) {
            console.error(err);
        }
    }
    const questions = JSON.parse(localStorage.getItem(LS_QUESTIONS_KEY) || '[]');
    const newQuestions = questions.filter((q: any) => q.id !== id);
    localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(newQuestions));
};

export const getQuestionsBank = async (): Promise<Question[]> => {
    if (pool) {
        try {
            const client = await pool.connect();
            const result = await client.query(`
                SELECT id, question_text as "questionText", options, correct_index as "correctAnswerIndex", explanation, difficulty, source 
                FROM questions ORDER BY id DESC
            `);
            client.release();
            return result.rows; 
        } catch (err) {
            console.error("DB Error getQuestionsBank:", err);
        }
    }
    return JSON.parse(localStorage.getItem(LS_QUESTIONS_KEY) || '[]');
};

// --- Global State Management ---
export const getGlobalState = async (): Promise<GlobalState> => {
  if (pool) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT value FROM global_state WHERE key = $1', ['config']);
      client.release();
      if (result.rows.length > 0) return result.rows[0].value;
    } catch (err) {
      console.error("DB Error getGlobalState:", err);
    }
  }
  const data = localStorage.getItem(LS_GLOBAL_KEY);
  return data ? JSON.parse(data) : { isManualOverride: false, isQuizOpen: false };
};

export const saveGlobalState = async (state: GlobalState): Promise<void> => {
  if (pool) {
    try {
      const client = await pool.connect();
      await client.query(
        `INSERT INTO global_state (key, value) VALUES ($1, $2) 
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        ['config', JSON.stringify(state)]
      );
      client.release();
      return;
    } catch (err) {
      console.error("DB Error saveGlobalState:", err);
    }
  }
  localStorage.setItem(LS_GLOBAL_KEY, JSON.stringify(state));
};
