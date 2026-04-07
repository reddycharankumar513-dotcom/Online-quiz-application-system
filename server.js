require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;


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

//post generate using the grog
// POST generate quiz via Groq AI
app.post('/api/ai/generate-quiz', async (req, res) => {
  const { topic, count, difficulty } = req.body;

  if (!topic || !count) {
    return res.status(400).json({ error: 'Topic and count are required.' });
  }
  if (!process.env.GROQ_API_KEY) {
  return res.status(500).json({ error: 'Groq API key not configured.' });
}
const prompt = `Generate exactly ${count} multiple choice questions about "${topic}" at ${difficulty || 'medium'} difficulty.

STRICT RULES:
- Return ONLY a valid JSON array
- Do NOT include explanations outside JSON
- Each question must have:
  - question (string)
  - options (array of 4 strings)
  - answer ("1", "2", "3", or "4")

Example:
[{"question":"What is 2+2?","options":["3","4","5","6"],"answer":"2"}]`;

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
const text = response?.data?.choices?.[0]?.message?.content;

if (!text) {
  console.error("❌ Invalid AI response:", response.data);
  return res.status(500).json({ error: 'No valid response from AI.' });
}

    let jsonStr = text;
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      jsonStr = match[1].trim();
    } else {
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        jsonStr = text.slice(start, end + 1);
      }
    }

   let questions;

try {
  questions = JSON.parse(jsonStr);
  if (!Array.isArray(questions)) {
  return res.status(500).json({ error: 'AI returned invalid format.' });
}
} catch (e) {
  console.error("❌ JSON Parse Error:", jsonStr);
  return res.status(500).json({ error: 'Invalid AI response format.' });
}

res.json({ questions });

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'AI generation failed.' });
  }
});
// POST generate a self-practice question via Gemini AI


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
