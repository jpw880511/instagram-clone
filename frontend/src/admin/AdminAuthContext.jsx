import { createContext, useCallback, useContext, useState } from "react";
import { adminLogin, adminLogout, getAdminToken } from "./adminApi";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));

  const login = useCallback(async (username, password) => {
    await adminLogin(username, password);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    adminLogout();
    setAuthed(false);
  }, []);

  // adminApi.request()가 401을 만나면 토큰을 지우는데, 이 경우 authed 상태도 같이 꺼줘야
  // 화면이 즉시 로그인 페이지로 전환된다. 각 페이지는 요청 실패 시 이 함수를 부른다.
  const handleUnauthorized = useCallback(() => {
    setAuthed(false);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ authed, login, logout, handleUnauthorized }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
