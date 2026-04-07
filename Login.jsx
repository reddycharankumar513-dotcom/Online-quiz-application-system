import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../style.css"; // use your same CSS

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const navigate = useNavigate();

  // Toast function
  const toast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // Login logic
  const handleLogin = () => {
    const u = username.trim();
    const p = password.trim();

    if (u === "admin" && p === "admin123") {
      navigate("/admin");
    } else if (u === "user" && p === "user123") {
      navigate("/quiz");
    } else {
      toast("Invalid credentials. Try again.");
    }
  };

  // Enter key support
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Enter") handleLogin();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });

  return (
    <div>
      <span className="corner-mark">◈</span>

      <div className="stage">
        <div className="card">
          <div className="card-header">
            <div className="header-label">Assessment Platform</div>
            <div className="header-title">QuizFlow</div>
            <div className="header-subtitle">
              Enter your credentials to continue
            </div>
            <div className="header-deco">Q</div>
          </div>

          <div className="card-body">
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleLogin}
              style={{ marginTop: "8px" }}
            >
              ↳ Sign In
            </button>

            <div className="cred-box">
              <p>
                <strong>Admin</strong> → admin / admin123<br />
                <strong>User</strong> → user / user123
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && <div className="toast">✕ {toastMsg}</div>}
    </div>
  );
}

export default Login;
