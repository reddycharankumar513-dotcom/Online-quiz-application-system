import { useEffect, useState } from "react";

import '../style.css';
import axios from "axios";

function Quiz() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);

  // Load quiz
  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await axios.get("http://localhost:3000/api/questions");
        setQuestions(res.data);
      } catch (err) {
        console.error(err);
        alert("Error loading quiz");
      }
    }
    fetchQuiz();
  }, []);

  // Handle answer select
  const handleSelect = (qIndex, optionIndex) => {
    setAnswers({
      ...answers,
      [qIndex]: optionIndex + 1,
    });
  };

  // Submit quiz
  const submitQuiz = async () => {
    let scoreCount = 0;

    questions.forEach((q, i) => {
      if (answers[i] == q.answer) {
        scoreCount++;
      }
    });

    setScore(scoreCount);

    try {
      await axios.post("http://localhost:3000/api/scores", {
        score: scoreCount,
        total: questions.length,
      });
    } catch (err) {
      console.error("Error saving score");
    }
  };

  return (
    <div className="stage quiz-stage">
      <div className="card">

        {/* HEADER */}
        <div className="card-header">
          <div className="header-title">Quiz</div>
        </div>

        {/* BODY */}
        <div className="card-body">

          {questions.length === 0 ? (
            <p>Loading questions...</p>
          ) : (
            <>
              <div className="quiz-scroll">
                {questions.map((q, i) => (
                  <div key={i} className="question-card">

                    {/* Question */}
                    <div className="question-text">
                      {i + 1}. {q.question}
                    </div>

                    {/* Options */}
                    {q.options.map((opt, idx) => (
                      <label key={idx} className="option-label">
                        <input
                          type="radio"
                          name={`q${i}`}
                          value={idx + 1}
                          onChange={() => handleSelect(i, idx)}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <button className="btn btn-primary" onClick={submitQuiz}>
                Submit Quiz
              </button>
            </>
          )}

          {/* Score Display */}
          {score !== null && (
            <div className="score-display">
              <div className="score-big">
                {score}<span>/{questions.length}</span>
              </div>
              <div className="score-label">Final Score</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default Quiz;
