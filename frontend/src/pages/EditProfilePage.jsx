import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/media/Avatar";
import { Icon } from "../components/common/Icon";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useObjectUrl } from "../hooks/useMediaPreview";
import { isValidUsername, isValidWebsite } from "../utils/validators";
import * as usersApi from "../api/users";
import * as authApi from "../api/auth";
import styles from "./EditProfilePage.module.css";

export function EditProfilePage() {
  const { user, setUser, logout } = useAuth();
  const [form, setForm] = useState({
    full_name: user.full_name,
    username: user.username,
    bio: user.bio,
    website: user.website,
    is_private: user.is_private,
  });
  const [avatarFile, setAvatarFile] = useState(null); // File | usersApi.REMOVE_AVATAR | null
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const avatarPreview = useObjectUrl(avatarFile instanceof File ? avatarFile : null);
  const avatarRemoved = avatarFile === usersApi.REMOVE_AVATAR;
  const currentAvatarSrc = avatarRemoved ? null : avatarPreview || user.avatar_url;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next = {};
    if (!isValidUsername(form.username)) next.username = "소문자, 숫자, . _ 만 사용해 1-30자로 입력하세요.";
    if (!isValidWebsite(form.website)) next.website = "https:// 로 시작하는 주소만 허용됩니다.";
    if (form.bio.length > 150) next.bio = "소개는 150자 이내로 작성하세요.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const updated = await usersApi.updateMe(form, avatarFile);
      setUser(updated);
      showToast("프로필을 저장했습니다.");
      navigate(`/${updated.username}`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>프로필 편집</h1>
      <div className={styles.avatarRow}>
        <Avatar src={currentAvatarSrc} username={user.username} size="lg" linkToProfile={false} />
        <div>
          <strong>{user.username}</strong>
          <div className={styles.avatarActions}>
            <button type="button" className={styles.changePhoto} onClick={() => fileRef.current?.click()}>
              <Icon name="camera" size={16} />
              사진 바꾸기
            </button>
            {currentAvatarSrc && (
              <button
                type="button"
                className={styles.removePhoto}
                onClick={() => setAvatarFile(usersApi.REMOVE_AVATAR)}
              >
                <Icon name="trash" size={16} />
                사진 삭제
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          이름
          <input type="text" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />
        </label>

        <label>
          사용자 이름
          <input type="text" value={form.username} onChange={(e) => setField("username", e.target.value.toLowerCase())} />
          {errors.username && <span className={styles.error}>{errors.username}</span>}
        </label>

        <label>
          소개
          <textarea rows={3} maxLength={150} value={form.bio} onChange={(e) => setField("bio", e.target.value)} />
          <span className={styles.counter}>{form.bio.length}/150</span>
          {errors.bio && <span className={styles.error}>{errors.bio}</span>}
        </label>

        <label>
          웹사이트
          <input type="text" placeholder="https://" value={form.website} onChange={(e) => setField("website", e.target.value)} />
          {errors.website && <span className={styles.error}>{errors.website}</span>}
        </label>

        <label className={styles.switchRow}>
          <span>비공개 계정</span>
          <input type="checkbox" checked={form.is_private} onChange={(e) => setField("is_private", e.target.checked)} />
        </label>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          <Icon name="save" size={18} />
          {submitting ? "저장 중..." : "저장"}
        </button>
      </form>

      <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
        <Icon name="logout" size={18} />
        로그아웃
      </button>
    </div>
  );
}
