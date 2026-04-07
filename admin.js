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

/* ── TAB SWITCHING ── */
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    if (tab === 'questions') {
        document.getElementById('tabBtnQuestions').classList.add('active');
        document.getElementById('tabQuestions').classList.add('active');
    } else if (tab === 'ai') {
        document.getElementById('tabBtnAI').classList.add('active');
        document.getElementById('tabAI').classList.add('active');
    } else if (tab === 'stats') {
        document.getElementById('tabBtnStats').classList.add('active');
        document.getElementById('tabStats').classList.add('active');
        loadGraph();
    }
}

/* ── ADD QUESTION ── */
async function addQuestion() {
    const q = document.getElementById('q').value.trim();
    const o1 = document.getElementById('o1').value.trim();
    const o2 = document.getElementById('o2').value.trim();
    const o3 = document.getElementById('o3').value.trim();
    const o4 = document.getElementById('o4').value.trim();
    const ans = document.getElementById('ans').value.trim();
    const timeLimitVal = document.getElementById('timeLimit').value.trim();
    const justification = document.getElementById('justification').value.trim();

    if (!q || !o1 || !o2 || !o3 || !o4 || !ans) {
        toast('Please fill all required fields.', '⚠');
        return;
    }
    if (!['1', '2', '3', '4'].includes(ans)) {
        toast('Answer must be 1, 2, 3, or 4.', '⚠');
        return;
    }

    const payload = {
        question: q,
        options: [o1, o2, o3, o4],
        answer: ans,
        timeLimit: timeLimitVal ? parseInt(timeLimitVal) : null,
        justification: justification || ''
    };

    try {
        const response = await fetch('http://localhost:3000/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

       const data = await response.json();
console.log("Server response:", data);

if (response.ok) {
    ['q', 'o1', 'o2', 'o3', 'o4', 'ans', 'timeLimit', 'justification']
        .forEach(id => document.getElementById(id).value = '');

    toast('Question added successfully.', '✦');
    loadQuestions();
} else {
    toast(data.error || 'Failed to add question.', '⚠');
}
    } catch (err) {
        console.error(err);
        toast('Error connecting to server.', '✕');
    }
}

/* ── LOAD QUESTION BANK ── */
async function loadQuestions() {
    const bank = document.getElementById('questionBank');
    bank.innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>Loading…</p></div>';

    try {
        const res = await fetch('http://localhost:3000/api/questions');
        const questions = await res.json();

        if (questions.length === 0) {
            bank.innerHTML = `<div class="empty-state"><div class="icon">◻</div><p>No questions yet. Add one above!</p></div>`;
            return;
        }

        bank.innerHTML = '';
        questions.forEach((q, i) => {
            const labels = ['A', 'B', 'C', 'D'];
            const correctIdx = parseInt(q.answer) - 1;
            const timeBadge = q.timeLimit
                ? `<span class="meta-badge timer-badge">⏱ ${q.timeLimit}s</span>`
                : '';
            const justBadge = q.justification
                ? `<span class="meta-badge just-badge" title="${escapeHtml(q.justification)}">💡 Justification</span>`
                : '';

            const div = document.createElement('div');
            div.className = 'qbank-item';
            div.innerHTML = `
                <div class="qbank-header">
                    <span class="qbank-num">#${i + 1}</span>
                    <div class="qbank-meta">${timeBadge}${justBadge}</div>
                    <button class="btn-delete" onclick="deleteQuestion('${q.id}')" title="Delete">✕</button>
                </div>
                <div class="qbank-question">${escapeHtml(q.question)}</div>
                <div class="qbank-options">
                    ${q.options.map((op, idx) => `
                        <span class="qbank-opt ${idx === correctIdx ? 'correct' : ''}">
                            ${labels[idx]}. ${escapeHtml(op)}
                        </span>
                    `).join('')}
                </div>
                ${q.justification ? `<div class="qbank-justification"><strong>Justification:</strong> ${escapeHtml(q.justification)}</div>` : ''}
            `;
            bank.appendChild(div);
        });
    } catch (err) {
        console.error(err);
        bank.innerHTML = '<div class="empty-state"><div class="icon">✕</div><p>Error loading questions.</p></div>';
    }
}

/* ── DELETE QUESTION ── */
async function deleteQuestion(id) {
    if (!confirm('Delete this question?')) return;

    try {
        const res = await fetch(`http://localhost:3000/api/questions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast('Question deleted.', '✦');
            loadQuestions();
        } else {
            toast('Failed to delete.', '⚠');
        }
    } catch (err) {
        console.error(err);
        toast('Error connecting to server.', '✕');
    }
}

/* ── AI QUIZ GENERATION ── */
let generatedQuestions = [];

async function generateAIQuiz() {
    const topic = document.getElementById('aiTopic').value.trim();
    const count = document.getElementById('aiCount').value;
    const difficulty = document.getElementById('aiDifficulty').value;

    if (!topic) {
        toast('Please enter a topic.', '⚠');
        return;
    }

    const btn = document.getElementById('generateBtn');
    const loading = document.getElementById('aiLoading');
    const previewArea = document.getElementById('aiPreviewArea');

    btn.disabled = true;
    btn.textContent = 'Generating…';
    loading.classList.remove('hidden');
    previewArea.classList.add('hidden');

    try {
        const res = await fetch('http://localhost:3000/api/ai/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, count: parseInt(count), difficulty })
        });

        let data;

try {
    data = await res.json();
} catch (e) {
    toast('Invalid response from server.', '✕');
    return;
}
        console.log("🔥 AI Response:", data); // DEBUG

        if (!res.ok) {
            toast(data.error || 'AI generation failed.', '⚠');
            return;
        }

        generatedQuestions = data.questions;
        renderAIPreview();
        previewArea.classList.remove('hidden');
        toast(`${generatedQuestions.length} questions generated!`, '⚡');

    } catch (err) {
        console.error("❌ Fetch Error:", err);
        toast('Error connecting to server.', '✕');
    } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Generate Quiz';
        loading.classList.add('hidden');
    }
}

function renderAIPreview() {
    const preview = document.getElementById('aiPreview');
    preview.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D'];

    generatedQuestions.forEach((q, i) => {
        const correctIdx = parseInt(q.answer) - 1;
        const div = document.createElement('div');
        div.className = 'qbank-item ai-preview-item';
        div.innerHTML = `
            <div class="qbank-header">
                <label class="ai-check-label">
                    <input type="checkbox" class="ai-check" data-index="${i}" checked>
                    <span class="qbank-num">#${i + 1}</span>
                </label>
                <div class="qbank-meta">
                    ${q.timeLimit ? `<span class="meta-badge timer-badge">⏱ ${q.timeLimit}s</span>` : ''}
                    <span class="meta-badge diff-badge">${document.getElementById('aiDifficulty').value}</span>
                </div>
            </div>
            <div class="qbank-question">${escapeHtml(q.question)}</div>
            <div class="qbank-options">
                ${q.options.map((op, idx) => `
                    <span class="qbank-opt ${idx === correctIdx ? 'correct' : ''}">
                        ${labels[idx]}. ${escapeHtml(op)}
                    </span>
                `).join('')}
            </div>
            ${q.justification ? `<div class="qbank-justification"><strong>Justification:</strong> ${escapeHtml(q.justification)}</div>` : ''}
        `;
        preview.appendChild(div);
    });
}

function toggleSelectAll() {
    const all = document.getElementById('aiSelectAll').checked;
    document.querySelectorAll('.ai-check').forEach(c => c.checked = all);
}

async function importSelected() {
    const checks = document.querySelectorAll('.ai-check:checked');
    if (checks.length === 0) {
        toast('No questions selected.', '⚠');
        return;
    }

    let imported = 0;
    for (const check of checks) {
        const idx = parseInt(check.dataset.index);
        const q = generatedQuestions[idx];

        try {
            const res = await fetch('http://localhost:3000/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: q.question,
                    options: q.options,
                    answer: q.answer,
                    timeLimit: q.timeLimit || null,
                    justification: q.justification || ''
                })
            });
            if (res.ok) imported++;
        } catch (err) {
            console.error('Import error:', err);
        }
    }

    toast(`${imported} question${imported !== 1 ? 's' : ''} imported!`, '✦');
    clearPreview();
    loadQuestions();
    switchTab('questions');
}

function clearPreview() {
    document.getElementById('aiPreviewArea').classList.add('hidden');
    document.getElementById('aiPreview').innerHTML = '';
    generatedQuestions = [];
}

/* ── LOAD SCORE GRAPH ── */
let chartInstance = null;

async function loadGraph() {
    try {
        const response = await fetch('http://localhost:3000/api/scores');
        const scores = await response.json();

        if (scores.length === 0) return;

        let totalScore = 0;
        let totalPossible = 0;

        scores.forEach(s => {
            totalScore += s.score;
            totalPossible += s.total;
        });

        const averageScore = totalScore / scores.length;
        const averageTotal = totalPossible / scores.length;
        const averageMissed = averageTotal - averageScore;

        if (chartInstance) chartInstance.destroy();

        const ctx = document.getElementById('scoreChart').getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Average Correct', 'Average Incorrect'],
                datasets: [{
                    data: [averageScore, averageMissed],
                    backgroundColor: ['#c9a84c', '#c0392b']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Overall Students Average Score'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading graph:', error);
    }
}

/* ── LOGOUT ── */
function logout() {
    window.location.href = 'index.html';
}

/* ── UTILITY ── */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ── ENTER KEY SHORTCUT ── */
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'tabQuestions') addQuestion();
        else if (activeTab && activeTab.id === 'tabAI') generateAIQuiz();
    }
});

// Automatically load questions when admin page opens
window.onload = () => {
    loadQuestions();
    loadGraph();
};
