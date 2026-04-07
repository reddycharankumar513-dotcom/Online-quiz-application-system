import { useEffect, useState } from "react";
import '../styles/style.css';
import '../styles/quiz.css';

const BASE_URL = "http://localhost:3000";

export default function AdminPanel() {
  const [tab, setTab] = useState("questions");
  const [questions, setQuestions] = useState([]);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  const [form, setForm] = useState({
    q: "",
    o1: "",
    o2: "",
    o3: "",
    o4: "",
    ans: "",
    timeLimit: "",
    justification: "",
  });

  const [ai, setAi] = useState({
    topic: "",
    count: 5,
    difficulty: "medium",
  });

  useEffect(() => {
    loadQuestions();
  }, []);

  async function loadQuestions() {
    try {
      const res = await fetch(`${BASE_URL}/api/questions`);
      const data = await res.json();
      setQuestions(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function addQuestion() {
    const { q, o1, o2, o3, o4, ans, timeLimit, justification } = form;

    if (!q || !o1 || !o2 || !o3 || !o4 || !ans) {
      alert("Please fill all fields");
      return;
    }

    if (!["1", "2", "3", "4"].includes(ans)) {
      alert("Answer must be 1-4");
      return;
    }

    const payload = {
      question: q,
      options: [o1, o2, o3, o4],
      answer: ans,
      timeLimit: timeLimit ? parseInt(timeLimit) : null,
      justification: justification || "",
    };

    try {
      const res = await fetch(`${BASE_URL}/api/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setForm({ q: "", o1: "", o2: "", o3: "", o4: "", ans: "", timeLimit: "", justification: "" });
        loadQuestions();
      } else {
        alert(data.error || "Failed to add");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteQuestion(id) {
    if (!window.confirm("Delete this question?")) return;

    try {
      const res = await fetch(`${BASE_URL}/api/questions/${id}`, {
        method: "DELETE",
      });

      if (res.ok) loadQuestions();
    } catch (err) {
      console.error(err);
    }
  }

  async function generateAIQuiz() {
    if (!ai.topic) {
      alert("Enter topic");
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/ai/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: ai.topic,
          count: parseInt(ai.count),
          difficulty: ai.difficulty,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setGeneratedQuestions(data.questions);
      } else {
        alert(data.error || "AI failed");
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function importSelected() {
    for (const q of generatedQuestions) {
      await fetch(`${BASE_URL}/api/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(q),
      });
    }

    setGeneratedQuestions([]);
    loadQuestions();
    setTab("questions");
  }

  return (
    <div className="admin-stage">
      <h1 className="header-title">Admin Panel</h1>

      {/* Tabs */}
      <div className="tab-nav">
        <button className={`tab-btn ${tab === "questions" ? "active" : ""}`} onClick={() => setTab("questions")}>Questions</button>
        <button className={`tab-btn ${tab === "ai" ? "active" : ""}`} onClick={() => setTab("ai")}>AI Module</button>
      </div>

      {/* QUESTIONS TAB */}
      {tab === "questions" && (
        <div className="tab-content active">
          <h2 className="section-label">Add Question</h2>
          <div className="input-group">
            <input className="field" placeholder="Question" value={form.q} onChange={e => setForm({ ...form, q: e.target.value })} />
            <input className="field" placeholder="Option 1" value={form.o1} onChange={e => setForm({ ...form, o1: e.target.value })} />
            <input className="field" placeholder="Option 2" value={form.o2} onChange={e => setForm({ ...form, o2: e.target.value })} />
            <input className="field" placeholder="Option 3" value={form.o3} onChange={e => setForm({ ...form, o3: e.target.value })} />
            <input className="field" placeholder="Option 4" value={form.o4} onChange={e => setForm({ ...form, o4: e.target.value })} />
            <input className="field" placeholder="Answer (1-4)" value={form.ans} onChange={e => setForm({ ...form, ans: e.target.value })} />
            <input className="field" placeholder="Time Limit" value={form.timeLimit} onChange={e => setForm({ ...form, timeLimit: e.target.value })} />
            <textarea className="field" placeholder="Justification" value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={addQuestion}>Add Question</button>

          <h2 className="section-label">Question Bank</h2>
          <div className="question-bank-scroll">
            {questions.map((q, i) => (
              <div key={q.id} className="qbank-item">
                <div className="qbank-header">
                  <span className="qbank-num">{i + 1}</span>
                  <div className="qbank-meta">
                    {/* You can add badges here if needed */}
                  </div>
                </div>
                <p className="qbank-question">{q.question}</p>
                <div className="qbank-options">
                  {q.options.map((op, idx) => (
                    <p key={idx} className="qbank-opt">{op}</p>
                  ))}
                </div>
                <button className="btn btn-delete" onClick={() => deleteQuestion(q.id)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI TAB */}
      {tab === "ai" && (
        <div className="tab-content active">
          <h2 className="section-label">AI Generator</h2>
          <div className="input-group">
            <input className="field" placeholder="Topic" value={ai.topic} onChange={e => setAi({ ...ai, topic: e.target.value })} />
            <select className="field" value={ai.count} onChange={e => setAi({ ...ai, count: e.target.value })}>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="10">10</option>
            </select>
            <select className="field" value={ai.difficulty} onChange={e => setAi({ ...ai, difficulty: e.target.value })}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={generateAIQuiz}>Generate</button>

          <h2 className="section-label">Generated Questions</h2>
          {generatedQuestions.map((q, i) => (
            <div key={i} className="qbank-item ai-preview-item">
              <p className="qbank-question">{q.question}</p>
              <div className="qbank-options">
                {q.options.map((op, idx) => (
                  <p key={idx} className="qbank-opt">{op}</p>
                ))}
              </div>
            </div>
          ))}

          {generatedQuestions.length > 0 && (
            <button className="btn btn-gold btn-row" onClick={importSelected}>Import All</button>
          )}
        </div>
      )}
    </div>
  );
}
