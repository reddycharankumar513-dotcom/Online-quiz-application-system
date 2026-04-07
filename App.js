import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Quiz from "./pages/Quiz";
// we will add Quiz later

function App() {
  return (
    <Router>
      <Routes>
        {/* Login page */}
        <Route path="/" element={<Login />} />

        {/* Admin page */}
        <Route path="/admin" element={<Admin />} />
        <Route path="/quiz" element={<Quiz />} />
      </Routes>
    </Router>
  );
}

export default App;
