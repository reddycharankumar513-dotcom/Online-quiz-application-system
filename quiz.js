/* ── TOAST NOTIFICATION ── */
function toast(msg, icon = '✦') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${icon}</span>${msg}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

const quizDiv = document.getElementById('quiz');
let globalQuestions = [];
let questionTimers = {};      // { index: intervalId }
let questionTimesLeft = {};   // { index: secondsLeft }
let questionLocked = {};      // { index: true/false }
let questionStartTimes = {};  // { index: timestamp }
let questionAnswerTimes = {}; // { index: ms taken to answer }
let quizStartTime = null;

/* ── LOAD QUIZ ── */
async function loadQuiz() {
    quizDiv.innerHTML = 'Loading questions...';

    try {
        const response = await fetch('http://localhost:3000/api/questions');
        const questions = await response.json();
        globalQuestions = questions;
    } catch (err) {
        console.error(err);
        toast('Error connecting to server.', '✕');
    }

    quizDiv.innerHTML = '';

    if (globalQuestions.length === 0) {
        quizDiv.innerHTML = `
        <div class="empty-state">
            <div class="icon">◻</div>
            <p>No questions available yet.<br>Ask your admin to add some!</p>
        </div>`;
        document.getElementById('quizMeta').textContent = 'No questions loaded';
        document.getElementById('progressFill').style.width = '0%';
        return;
    }

    quizStartTime = Date.now();

    document.getElementById('quizMeta').textContent =
        `${globalQuestions.length} question${globalQuestions.length > 1 ? 's' : ''} to answer`;

    globalQuestions.forEach((q, i) => {
        const labels = ['A', 'B', 'C', 'D'];
        questionStartTimes[i] = Date.now();
        questionAnswerTimes[i] = null;

        let optionsHTML = q.options.map((op, idx) => `
            <label class="option-label" id="opt-${i}-${idx}">
                <input type="radio" name="q${i}" value="${idx + 1}" data-qindex="${i}">
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--gold);min-width:16px;">${labels[idx]}</span>
                ${escapeHtml(op)}
            </label>
        `).join('');

        const timerHTML = q.timeLimit
            ? `<div class="q-timer" id="timer-${i}"><span class="timer-icon">⏱</span> <span class="timer-value" id="timerVal-${i}">${q.timeLimit}s</span></div>`
            : '';

        const div = document.createElement('div');
        div.className = 'question-card';
        div.id = `qcard-${i}`;
        div.style.animationDelay = `${i * 0.06}s`;
        div.innerHTML = `
            <div class="question-top-row">
                <div class="question-num">Question ${i + 1} of ${globalQuestions.length}</div>
                ${timerHTML}
            </div>
            <div class="question-text">${escapeHtml(q.question)}</div>
            ${optionsHTML}
        `;
        quizDiv.appendChild(div);

        // Start per-question timer
        if (q.timeLimit) {
            questionTimesLeft[i] = q.timeLimit;
            questionLocked[i] = false;
            questionTimers[i] = setInterval(() => {
                questionTimesLeft[i]--;
                const timerEl = document.getElementById(`timerVal-${i}`);
                if (timerEl) timerEl.textContent = `${questionTimesLeft[i]}s`;

                if (questionTimesLeft[i] <= 5) {
                    const timerContainer = document.getElementById(`timer-${i}`);
                    if (timerContainer) timerContainer.classList.add('timer-critical');
                }

                if (questionTimesLeft[i] <= 0) {
                    clearInterval(questionTimers[i]);
                    lockQuestion(i);
                }
            }, 1000);
        }
    });

    // Live progress tracking + time tracking
    const radios = quizDiv.querySelectorAll('input[type="radio"]');
    radios.forEach(r => {
        r.addEventListener('change', (e) => {
            const qIdx = parseInt(e.target.dataset.qindex);
            if (questionAnswerTimes[qIdx] === null) {
                questionAnswerTimes[qIdx] = Date.now() - questionStartTimes[qIdx];
            }
            updateProgress();
        });
    });
}

/* ── LOCK QUESTION (timer expired) ── */
function lockQuestion(index) {
    questionLocked[index] = true;
    const card = document.getElementById(`qcard-${index}`);
    if (card) {
        card.classList.add('question-locked');
        card.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
    }
    const timerEl = document.getElementById(`timer-${index}`);
    if (timerEl) {
        timerEl.innerHTML = '<span class="timer-icon">⏱</span> <span class="timer-value">Time\'s up!</span>';
    }
    // Mark as timed out if unanswered
    if (questionAnswerTimes[index] === null) {
        questionAnswerTimes[index] = -1; // -1 = timed out
    }
}

/* ── UPDATE PROGRESS ── */
function updateProgress() {
    let answered = 0;
    globalQuestions.forEach((_, i) => {
        if (document.querySelector(`input[name="q${i}"]:checked`)) answered++;
    });
    const pct = globalQuestions.length ? (answered / globalQuestions.length) * 100 : 0;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('quizMeta').textContent =
        `${answered} of ${globalQuestions.length} answered`;
}

/* ── SUBMIT QUIZ ── */
async function submitQuiz() {
    // Stop all timers
    Object.values(questionTimers).forEach(id => clearInterval(id));

    const quizEndTime = Date.now();
    const totalTimeTaken = quizEndTime - quizStartTime;

    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let timedOutCount = 0;

    const perQuestion = [];

    globalQuestions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        const userAnswer = sel ? sel.value : null;
        const isCorrect = userAnswer === q.answer;

        if (isCorrect) {
            score++;
            correctCount++;
        } else if (userAnswer) {
            incorrectCount++;
        } else {
            unansweredCount++;
            if (questionAnswerTimes[i] === -1) timedOutCount++;
        }

        const timeTaken = questionAnswerTimes[i];
        perQuestion.push({
            index: i,
            question: q.question,
            userAnswer,
            correctAnswer: q.answer,
            isCorrect,
            isAnswered: !!userAnswer,
            isTimedOut: questionAnswerTimes[i] === -1,
            timeTaken: timeTaken > 0 ? timeTaken : null,
            timeLimit: q.timeLimit,
            justification: q.justification,
            options: q.options
        });
    });

    const pct = globalQuestions.length ? Math.round((score / globalQuestions.length) * 100) : 0;

    // Save score to backend
    try {
        await fetch('http://localhost:3000/api/scores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: score, total: globalQuestions.length })
        });
    } catch (e) {
        console.error('Error saving score:', e);
    }

    // Build analysis data
    const analysisData = {
        score,
        total: globalQuestions.length,
        pct,
        correctCount,
        incorrectCount,
        unansweredCount,
        timedOutCount,
        totalTimeTaken,
        perQuestion
    };

    // Build views
    buildAnalyzer(analysisData);
    buildJustifications(score);

    // Hide questions, show score
    document.getElementById('quizScrollArea').classList.add('hidden');
    document.getElementById('quizActions').classList.add('hidden');
    document.getElementById('afterSubmitActions').classList.remove('hidden');

    const scoreView = document.getElementById('scoreView');
    scoreView.classList.remove('hidden');

    document.getElementById('scoreBig').innerHTML =
        `${score}<span>/${globalQuestions.length}</span>`;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('quizMeta').textContent =
        pct >= 70 ? `Great job! ${pct}% correct` : `Score: ${pct}% — keep practicing`;

    setTimeout(() => {
        document.getElementById('scoreBarFill').style.width = pct + '%';
    }, 100);

    toast(`Quiz submitted · Score: ${score}/${globalQuestions.length}`, '✦');
}

/* ══════════════════════════════════════════════════
   ── MODULE ANALYZER ──
   ══════════════════════════════════════════════════ */
let accuracyChart = null;
let timeChart = null;

function buildAnalyzer(data) {
    const container = document.getElementById('analyzerContent');
    const { score, total, pct, correctCount, incorrectCount, unansweredCount, timedOutCount, totalTimeTaken, perQuestion } = data;

    // Performance grade
    let grade, gradeColor, gradeLabel;
    if (pct >= 90) { grade = 'A+'; gradeColor = '#27ae60'; gradeLabel = 'Outstanding'; }
    else if (pct >= 80) { grade = 'A'; gradeColor = '#27ae60'; gradeLabel = 'Excellent'; }
    else if (pct >= 70) { grade = 'B'; gradeColor = '#c9a84c'; gradeLabel = 'Good'; }
    else if (pct >= 60) { grade = 'C'; gradeColor = '#e67e22'; gradeLabel = 'Average'; }
    else if (pct >= 50) { grade = 'D'; gradeColor = '#e67e22'; gradeLabel = 'Below Average'; }
    else { grade = 'F'; gradeColor = '#c0392b'; gradeLabel = 'Needs Improvement'; }

    // Average response time
    const answeredTimes = perQuestion.filter(q => q.timeTaken && q.timeTaken > 0).map(q => q.timeTaken);
    const avgResponseTime = answeredTimes.length > 0
        ? Math.round(answeredTimes.reduce((a, b) => a + b, 0) / answeredTimes.length / 1000 * 10) / 10
        : 0;
    const fastestTime = answeredTimes.length > 0 ? Math.round(Math.min(...answeredTimes) / 1000 * 10) / 10 : 0;
    const slowestTime = answeredTimes.length > 0 ? Math.round(Math.max(...answeredTimes) / 1000 * 10) / 10 : 0;
    const totalTimeStr = formatDuration(totalTimeTaken);

    container.innerHTML = `
        <!-- Grade & Score Overview -->
        <div class="analyzer-hero">
            <div class="analyzer-grade" style="border-color: ${gradeColor}">
                <div class="grade-letter" style="color: ${gradeColor}">${grade}</div>
                <div class="grade-label">${gradeLabel}</div>
            </div>
            <div class="analyzer-score-ring">
                <canvas id="accuracyRing" width="140" height="140"></canvas>
                <div class="ring-center">
                    <div class="ring-pct">${pct}%</div>
                    <div class="ring-label">Accuracy</div>
                </div>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="analyzer-stats">
            <div class="stat-card stat-correct">
                <div class="stat-value">${correctCount}</div>
                <div class="stat-label">Correct</div>
            </div>
            <div class="stat-card stat-incorrect">
                <div class="stat-value">${incorrectCount}</div>
                <div class="stat-label">Incorrect</div>
            </div>
            <div class="stat-card stat-unanswered">
                <div class="stat-value">${unansweredCount}</div>
                <div class="stat-label">Skipped</div>
            </div>
            <div class="stat-card stat-time">
                <div class="stat-value">${totalTimeStr}</div>
                <div class="stat-label">Total Time</div>
            </div>
        </div>

        <!-- Time Analysis -->
        <div class="analyzer-section">
            <div class="analyzer-section-title">⏱ Response Time Analysis</div>
            <div class="time-stats-row">
                <div class="time-stat">
                    <span class="time-stat-val">${avgResponseTime}s</span>
                    <span class="time-stat-label">Avg. Response</span>
                </div>
                <div class="time-stat">
                    <span class="time-stat-val">${fastestTime}s</span>
                    <span class="time-stat-label">Fastest</span>
                </div>
                <div class="time-stat">
                    <span class="time-stat-val">${slowestTime}s</span>
                    <span class="time-stat-label">Slowest</span>
                </div>
                ${timedOutCount > 0 ? `
                <div class="time-stat time-stat-warn">
                    <span class="time-stat-val">${timedOutCount}</span>
                    <span class="time-stat-label">Timed Out</span>
                </div>` : ''}
            </div>
            <div class="chart-wrap">
                <canvas id="timeBarChart"></canvas>
            </div>
        </div>

        <!-- Per-Question Breakdown -->
        <div class="analyzer-section">
            <div class="analyzer-section-title">📋 Question Breakdown</div>
            <div class="breakdown-list" id="breakdownList"></div>
        </div>
    `;

    // Build per-question breakdown
    const breakdownList = document.getElementById('breakdownList');
    const labels = ['A', 'B', 'C', 'D'];
    perQuestion.forEach((pq, i) => {
        const statusClass = pq.isCorrect ? 'bd-correct' : (pq.isAnswered ? 'bd-incorrect' : 'bd-skipped');
        const statusIcon = pq.isCorrect ? '✓' : (pq.isAnswered ? '✕' : (pq.isTimedOut ? '⏱' : '—'));
        const statusText = pq.isCorrect ? 'Correct' : (pq.isAnswered ? 'Wrong' : (pq.isTimedOut ? 'Timed Out' : 'Skipped'));
        const correctIdx = parseInt(pq.correctAnswer) - 1;

        const timeStr = pq.timeTaken && pq.timeTaken > 0
            ? `${Math.round(pq.timeTaken / 1000 * 10) / 10}s`
            : (pq.isTimedOut ? 'Expired' : '—');

        const div = document.createElement('div');
        div.className = `breakdown-item ${statusClass}`;
        div.innerHTML = `
            <div class="bd-header">
                <span class="bd-num">Q${i + 1}</span>
                <span class="bd-status">${statusIcon} ${statusText}</span>
                <span class="bd-time">${timeStr}</span>
            </div>
            <div class="bd-question">${escapeHtml(pq.question)}</div>
            <div class="bd-answer-row">
                <span class="bd-correct-ans">✓ ${labels[correctIdx]}. ${escapeHtml(pq.options[correctIdx])}</span>
                ${pq.isAnswered && !pq.isCorrect ? `<span class="bd-user-ans">✕ ${labels[parseInt(pq.userAnswer) - 1]}. ${escapeHtml(pq.options[parseInt(pq.userAnswer) - 1])}</span>` : ''}
            </div>
        `;
        breakdownList.appendChild(div);
    });

    // Draw accuracy doughnut
    setTimeout(() => {
        const ctx1 = document.getElementById('accuracyRing');
        if (ctx1) {
            accuracyChart = new Chart(ctx1.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Correct', 'Incorrect', 'Skipped'],
                    datasets: [{
                        data: [correctCount, incorrectCount, unansweredCount],
                        backgroundColor: ['#27ae60', '#c0392b', '#bdc3c7'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '72%',
                    responsive: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } }
                }
            });
        }

        // Draw time bar chart
        const timeLabels = perQuestion.map((_, i) => `Q${i + 1}`);
        const timeData = perQuestion.map(pq => {
            if (pq.timeTaken && pq.timeTaken > 0) return Math.round(pq.timeTaken / 1000 * 10) / 10;
            return 0;
        });
        const barColors = perQuestion.map(pq =>
            pq.isCorrect ? '#27ae60' : (pq.isAnswered ? '#c0392b' : '#bdc3c7')
        );

        const ctx2 = document.getElementById('timeBarChart');
        if (ctx2) {
            timeChart = new Chart(ctx2.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: timeLabels,
                    datasets: [{
                        label: 'Response Time (s)',
                        data: timeData,
                        backgroundColor: barColors,
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: 'Time per Question (seconds)',
                            font: { family: "'DM Mono', monospace", size: 11, weight: '400' },
                            color: '#7a7065'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: { family: "'DM Mono', monospace", size: 10 },
                                color: '#7a7065'
                            },
                            grid: { color: '#ede9e1' }
                        },
                        x: {
                            ticks: {
                                font: { family: "'DM Mono', monospace", size: 10 },
                                color: '#7a7065'
                            },
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }, 150);
}

function formatDuration(ms) {
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec}s`;
}

/* ── VIEW SWITCHING (post-submit) ── */
let currentView = 'score'; // 'score' | 'analyzer' | 'justifications'

function showView(view) {
    const scoreView = document.getElementById('scoreView');
    const analyzerArea = document.getElementById('analyzerArea');
    const justificationArea = document.getElementById('justificationArea');

    scoreView.classList.add('hidden');
    analyzerArea.classList.add('hidden');
    justificationArea.classList.add('hidden');

    if (currentView === view) {
        // Toggle back to score if clicking same button
        scoreView.classList.remove('hidden');
        currentView = 'score';
        return;
    }

    if (view === 'analyzer') {
        analyzerArea.classList.remove('hidden');
    } else if (view === 'justifications') {
        justificationArea.classList.remove('hidden');
    } else {
        scoreView.classList.remove('hidden');
    }
    currentView = view;
}

/* ── BUILD JUSTIFICATIONS ── */
function buildJustifications(score) {
    const list = document.getElementById('justificationList');
    list.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];

    globalQuestions.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        const userAnswer = sel ? sel.value : null;
        const isCorrect = userAnswer === q.answer;
        const correctIdx = parseInt(q.answer) - 1;

        const div = document.createElement('div');
        div.className = `justification-card ${isCorrect ? 'just-correct' : 'just-incorrect'}`;
        div.innerHTML = `
            <div class="just-header">
                <span class="just-num">Q${i + 1}</span>
                <span class="just-badge-result ${isCorrect ? 'badge-correct' : 'badge-incorrect'}">
                    ${isCorrect ? '✓ Correct' : '✕ Incorrect'}
                </span>
            </div>
            <div class="just-question">${escapeHtml(q.question)}</div>
            <div class="just-answers">
                <div class="just-answer correct-answer">
                    <strong>Correct:</strong> ${labels[correctIdx]}. ${escapeHtml(q.options[correctIdx])}
                </div>
                ${!isCorrect && userAnswer ? `
                    <div class="just-answer user-answer">
                        <strong>Your answer:</strong> ${labels[parseInt(userAnswer) - 1]}. ${escapeHtml(q.options[parseInt(userAnswer) - 1])}
                    </div>
                ` : ''}
                ${!userAnswer ? '<div class="just-answer user-answer"><strong>Not answered</strong></div>' : ''}
            </div>
            ${q.justification ? `<div class="just-explanation"><span class="just-icon">💡</span> ${escapeHtml(q.justification)}</div>` : ''}
        `;
        list.appendChild(div);
    });
}

/* ── LOGOUT ── */
function logout() {
    Object.values(questionTimers).forEach(id => clearInterval(id));
    window.location.href = 'index.html';
}

/* ── UTILITY ── */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Automatically load quiz on page load
loadQuiz();
