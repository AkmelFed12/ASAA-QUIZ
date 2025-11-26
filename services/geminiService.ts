
import { GoogleGenAI, Type } from "@google/genai";
import { Question, Difficulty } from "../types";

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export const generateQuestions = async (count: number = 6, difficulty: Difficulty = 'ADAPTIVE'): Promise<Question[]> => {
  if (!apiKey) {
    console.warn("No API Key provided. Returning mock data.");
    return mockQuestions.slice(0, count);
  }

  try {
    let difficultyPrompt = "";
    
    switch(difficulty) {
        case 'EASY':
            difficultyPrompt = "NIVEAU: DÉBUTANT (Facile). Questions accessibles à tous.";
            break;
        case 'MEDIUM':
            difficultyPrompt = "NIVEAU: INTERMÉDIAIRE. Questions demandant un peu de réflexion.";
            break;
        case 'HARD':
            difficultyPrompt = "NIVEAU: AVANCÉ. Questions difficiles sur des détails précis.";
            break;
        case 'EXPERT':
            difficultyPrompt = "NIVEAU: EXPERT / SAVANT. Questions très pointues.";
            break;
        case 'ADAPTIVE':
        default:
            difficultyPrompt = `
                NIVEAU PROGRESSIF (ADAPTIVE):
                - La 1ère et 2ème question doivent être de niveau FACILE.
                - La 3ème et 4ème question doivent être de niveau MOYEN.
                - La 5ème question doit être de niveau DIFFICILE.
                - La 6ème question doit être de niveau EXPERT.
                Simule une augmentation de la difficulté à chaque bonne réponse.
            `;
            break;
    }

    const prompt = `
      Génère ${count} questions à choix multiples (QCM) sur l'Islam (Histoire, Coran, Hadith, Fiqh, Sirah) en français.
      
      ${difficultyPrompt}
      
      Les questions doivent être:
      1. Basées sur des sources authentiques (Coran et Sounnah).
      2. Variées (ne pas répéter les mêmes sujets).
      3. Chaque question doit avoir 4 options dont 1 seule bonne réponse.
      4. Le champ "difficulty" doit refléter le niveau de la question (EASY, MEDIUM, HARD, EXPERT).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              questionText: { type: Type.STRING, description: "La question posée" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "4 choix de réponse"
              },
              correctAnswerIndex: { type: Type.INTEGER, description: "L'index de la bonne réponse (0-3)" },
              explanation: { type: Type.STRING, description: "Une explication détaillée de la réponse" },
              difficulty: { type: Type.STRING, description: "EASY, MEDIUM, HARD, ou EXPERT" }
            },
            required: ["questionText", "options", "correctAnswerIndex", "explanation", "difficulty"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    
    const questions = JSON.parse(text) as Question[];
    
    // Add 'source' tag
    return questions.map(q => ({ ...q, source: 'AI' }));

  } catch (error) {
    console.error("Erreur lors de la génération des questions:", error);
    return mockQuestions.slice(0, count);
  }
};

const mockQuestions: Question[] = [
  {
    questionText: "Quelle sourate est connue comme le 'Cœur du Coran' ?",
    options: ["Al-Fatiha", "Ya-Sin", "Al-Baqara", "Al-Ikhlas"],
    correctAnswerIndex: 1,
    explanation: "Le Prophète (paix sur lui) a dit que tout a un cœur, et le cœur du Coran est la sourate Ya-Sin.",
    difficulty: "EASY",
    source: "MANUAL"
  },
  {
    questionText: "En quelle année l'Hégire a-t-elle eu lieu ?",
    options: ["610", "622", "632", "570"],
    correctAnswerIndex: 1,
    explanation: "L'Hégire a eu lieu en 622 après J.C.",
    difficulty: "MEDIUM",
    source: "MANUAL"
  },
  {
    questionText: "Lequel de ces piliers est le premier pilier de l'Islam ?",
    options: ["Salat", "Zakat", "Shahada", "Hajj"],
    correctAnswerIndex: 2,
    explanation: "La Shahada est le fondement de la foi.",
    difficulty: "EASY",
    source: "MANUAL"
  },
  {
    questionText: "Combien y a-t-il de sourates dans le Saint Coran ?",
    options: ["110", "112", "114", "116"],
    correctAnswerIndex: 2,
    explanation: "Il y a 114 sourates.",
    difficulty: "EASY",
    source: "MANUAL"
  },
  {
    questionText: "Quel compagnon a été le premier Calife ?",
    options: ["Umar", "Ali", "Uthman", "Abu Bakr"],
    correctAnswerIndex: 3,
    explanation: "Abu Bakr (ra) fut le premier Calife.",
    difficulty: "MEDIUM",
    source: "MANUAL"
  },
  {
     questionText: "Quelle prière est après le coucher du soleil ?",
     options: ["Dohr", "Asr", "Maghrib", "Isha"],
     correctAnswerIndex: 2,
     explanation: "Maghrib est juste après le coucher.",
     difficulty: "EASY",
     source: "MANUAL"
  }
];
