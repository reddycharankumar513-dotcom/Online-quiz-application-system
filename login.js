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

/* ── LOGIN ── */
function login() {
    const u = document.getElementById('username').value.trim();
    const p = document.getElementById('password').value.trim();

    if (u === 'admin' && p === 'admin123') {
        window.location.href = 'admin.html';
    } else if (u === 'user' && p === 'user123') {
        window.location.href = 'quiz.html';
    } else {
        toast('Invalid credentials. Try again.', '✕');
    }
}

/* ── ENTER KEY SHORTCUT ── */
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
});
