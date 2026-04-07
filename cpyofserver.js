require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend'))); // Serve frontend files

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/quizApp').then(() => {
  console.log('Connected to MongoDB database.');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
});

// Mongoose Schemas & Models
const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  answer: { type: String, required: true },
  timeLimit: { type: Number, default: null },
  justification: { type: String, default: '' }
});

const scoreSchema = new mongoose.Schema({
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Question = mongoose.model('Question', questionSchema);
const Score = mongoose.model('Score', scoreSchema);

// API Routes

// GET all questions
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await Question.find();
    const formattedQuestions = questions.map(q => ({
      id: q._id,
      question: q.question,
      options: q.options,
      answer: q.answer,
      timeLimit: q.timeLimit,
      justification: q.justification
    }));
    res.json(formattedQuestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new question
app.post('/api/questions', async (req, res) => {
  const { question, options, answer, timeLimit, justification } = req.body;

  if (!question || !options || options.length !== 4 || !answer) {
    return res.status(400).json({ error: 'Invalid question format.' });
  }

  try {
    const newQuestion = new Question({
      question,
      options,
      answer,
      timeLimit: timeLimit || null,
      justification: justification || ''
    });
    const savedQuestion = await newQuestion.save();
    res.status(201).json({
      id: savedQuestion._id,
      question: savedQuestion.question,
      options: savedQuestion.options,
      answer: savedQuestion.answer,
      timeLimit: savedQuestion.timeLimit,
      justification: savedQuestion.justification
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const deleted = await Question.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Question not found.' });
    }
    res.json({ message: 'Question deleted.', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate quiz via Gemini AI
app.post('/api/ai/generate-quiz', async (req, res) => {
  const { topic, count, difficulty } = req.body;

  if (!topic || !count) {
    return res.status(400).json({ error: 'Topic and count are required.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured. Set the GEMINI_API_KEY environment variable.' });
  }

  const prompt = `Generate exactly ${count} multiple choice quiz questions about "${topic}" at ${difficulty || 'medium'} difficulty level.

Return ONLY a valid JSON array with no extra text. Each object must have:
- "question": the question text
- "options": array of exactly 4 option strings
- "answer": the 1-based index of the correct option as a string ("1", "2", "3", or "4")
- "timeLimit": suggested seconds to answer (15-60 based on difficulty)
- "justification": a brief explanation of why the answer is correct

Example format:
[{"question":"What is 2+2?","options":["3","4","5","6"],"answer":"2","timeLimit":15,"justification":"2+2 equals 4, which is the second option."}]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(500).json({ error: 'Gemini API error: ' + (data.error?.message || 'Unknown error') });
    }

    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

console.log("🔥 RAW AI RESPONSE:", textContent); // DEBUG

if (!textContent) {
  return res.status(500).json({ error: 'No content returned from AI.' });
}

// 🔥 Robust JSON extraction
let jsonStr = textContent;

// Case 1: inside ```json ```
const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
if (jsonMatch) {
  jsonStr = jsonMatch[1].trim();
} else {
  // Case 2: extract array manually
  const start = textContent.indexOf('[');
  const end = textContent.lastIndexOf(']');
  if (start !== -1 && end !== -1) {
    jsonStr = textContent.slice(start, end + 1);
  }
}

// 🔥 Safe parsing
let questions;
try {
  questions = JSON.parse(jsonStr);
} catch (err) {
  console.error("❌ JSON Parse Failed:");
  console.error(jsonStr);
  return res.status(500).json({ error: 'AI returned invalid JSON format.' });
}

if (!Array.isArray(questions)) {
  return res.status(500).json({ error: 'AI returned invalid format.' });
}

    res.json({ questions });
  } catch (err) {
    console.error('AI generation error:', err);
    res.status(500).json({ error: 'Failed to generate quiz: ' + err.message });
  }
});

// POST generate a self-practice question via Gemini AI
app.post('/api/ai/practice-questions', async (req, res) => {
  const { subject, difficulty, count } = req.body;

  if (!subject) {
    return res.status(400).json({ error: 'Subject is required.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API key not configured. Set the GEMINI_API_KEY environment variable.' });
  }

  const diff = difficulty || 'easy';
  const numQuestions = count || 1;

  const difficultyGuide = {
    easy: 'basic recall and fundamental concepts. Questions should be straightforward with clear answers.',
    medium: 'application and understanding. Questions should require some reasoning or connecting concepts.',
    hard: 'analysis, evaluation, and complex problem-solving. Questions should be challenging and require deep understanding.'
  };

  const prompt = `Generate exactly ${numQuestions} multiple choice self-practice question(s) about "${subject}" at ${diff} difficulty level.

Difficulty guide: ${difficultyGuide[diff] || difficultyGuide.easy}

Return ONLY a valid JSON array with no extra text. Each object must have:
- "question": the question text
- "options": array of exactly 4 option strings
- "answer": the 1-based index of the correct option as a string ("1", "2", "3", or "4")
- "justification": a clear explanation of why the answer is correct (2-3 sentences)

Example format:
[{"question":"What is 2+2?","options":["3","4","5","6"],"answer":"2","justification":"2+2 equals 4, which is the second option. This is basic addition."}]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(500).json({ error: 'Gemini API error: ' + (data.error?.message || 'Unknown error') });
    }

    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      return res.status(500).json({ error: 'No content returned from AI.' });
    }

    let jsonStr = textContent;

const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
if (jsonMatch) {
  jsonStr = jsonMatch[1].trim();
} else {
  const start = textContent.indexOf('[');
  const end = textContent.lastIndexOf(']');
  if (start !== -1 && end !== -1) {
    jsonStr = textContent.slice(start, end + 1);
  }
}

let questions;
try {
  questions = JSON.parse(jsonStr);
} catch (err) {
  console.error("❌ Practice JSON Parse Failed:");
  console.error(jsonStr);
  return res.status(500).json({ error: 'Invalid AI JSON format.' });
}

    if (!Array.isArray(questions)) {
      return res.status(500).json({ error: 'AI returned invalid format.' });
    }

    res.json({ questions });
  } catch (err) {
    console.error('Practice question generation error:', err);
    res.status(500).json({ error: 'Failed to generate practice question: ' + err.message });
  }
});

// POST a score
app.post('/api/scores', async (req, res) => {
  const { score, total } = req.body;
  if (score === undefined || total === undefined) {
    return res.status(400).json({ error: 'Invalid score format.' });
  }

  try {
    const newScore = new Score({ score, total });
    const savedScore = await newScore.save();
    res.status(201).json({ id: savedScore._id, score: savedScore.score, total: savedScore.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all scores
app.get('/api/scores', async (req, res) => {
  try {
    const scores = await Score.find();
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
