import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ identifier, password });
      const params = new URLSearchParams(location.search);
      navigate(params.get("next") || "/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.card}>
        <h1 className={styles.logo}>Gram</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="text"
            placeholder="휴대폰 번호, 사용자 이름 또는 이메일"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className={styles.toggleVisibility} onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? "숨기기" : "보기"}
            </button>
          </div>
          {error && <p className={styles.banner}>{error}</p>}
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className={styles.demoHint}>데모 계정: demo / demo1234</p>
      </div>
      <div className={styles.switchCard}>
        계정이 없으신가요? <Link to="/register">가입하기</Link>
      </div>
    </>
  );
}
