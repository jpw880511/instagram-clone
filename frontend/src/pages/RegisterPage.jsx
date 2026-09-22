import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { isValidUsername, isValidEmail, isValidPassword } from "../utils/validators";
import styles from "./LoginPage.module.css";

export function RegisterPage() {
  const [form, setForm] = useState({ email: "", username: "", full_name: "", password: "", password_confirm: "" });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next = {};
    if (!isValidEmail(form.email)) next.email = "올바른 이메일을 입력하세요.";
    if (!isValidUsername(form.username)) next.username = "소문자, 숫자, . _ 만 사용해 1-30자로 입력하세요.";
    if (!isValidPassword(form.password)) next.password = "비밀번호는 8자 이상이어야 합니다.";
    if (form.password !== form.password_confirm) next.password_confirm = "비밀번호가 일치하지 않습니다.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        email: form.email,
        username: form.username,
        full_name: form.full_name,
        password: form.password,
      });
      navigate("/", { replace: true });
    } catch (err) {
      setBanner(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.card}>
        <h1 className={styles.logo}>Gram</h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: 17, fontWeight: 600, textAlign: "center", margin: "0 0 20px" }}>
          친구들의 사진과 동영상을 보려면 가입하세요.
        </p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <input
            className={styles.input}
            type="email"
            placeholder="이메일"
            value={form.email}
            onChange={(e) => setField("email", e.target.value)}
          />
          {errors.email && <p className={styles.fieldError}>{errors.email}</p>}

          <input
            className={styles.input}
            type="text"
            placeholder="성명"
            value={form.full_name}
            onChange={(e) => setField("full_name", e.target.value)}
          />

          <input
            className={styles.input}
            type="text"
            placeholder="사용자 이름"
            value={form.username}
            onChange={(e) => setField("username", e.target.value.toLowerCase())}
          />
          {errors.username && <p className={styles.fieldError}>{errors.username}</p>}

          <input
            className={styles.input}
            type="password"
            placeholder="비밀번호"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
          />
          {errors.password && <p className={styles.fieldError}>{errors.password}</p>}

          <input
            className={styles.input}
            type="password"
            placeholder="비밀번호 확인"
            value={form.password_confirm}
            onChange={(e) => setField("password_confirm", e.target.value)}
          />
          {errors.password_confirm && <p className={styles.fieldError}>{errors.password_confirm}</p>}

          {banner && <p className={styles.banner}>{banner}</p>}

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "가입 중..." : "가입"}
          </button>
        </form>
      </div>
      <div className={styles.switchCard}>
        계정이 있으신가요? <Link to="/login">로그인</Link>
      </div>
    </>
  );
}
