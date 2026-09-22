import { useCallback, useEffect, useState } from "react";
import { deleteUser, getUsers } from "./adminApi";
import { useAdminAuth } from "./AdminAuthContext";
import styles from "./AdminTable.module.css";

const LIMIT = 20;

const COLUMNS = [
  { field: "id", label: "ID" },
  { field: "username", label: "아이디" },
  { field: "email", label: "이메일" },
  { field: "full_name", label: "이름" },
  { field: "created_at", label: "가입일" },
  { field: "post_count", label: "게시물" },
  { field: "follower_count", label: "팔로워" },
  { field: "is_private", label: "비공개" },
];

function formatDate(iso) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminUsersPage() {
  const { handleUnauthorized } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    (nextOffset, q, sortField, sortOrder) => {
      setLoading(true);
      setError("");
      getUsers({ q, sort: sortField, order: sortOrder, limit: LIMIT, offset: nextOffset })
        .then((data) => {
          setItems(data.items);
          setTotal(data.total);
          setOffset(data.offset);
        })
        .catch((err) => {
          if (err.status === 401) handleUnauthorized();
          else setError(err.message);
        })
        .finally(() => setLoading(false));
    },
    [handleUnauthorized]
  );

  useEffect(() => {
    load(0, "", "created_at", "desc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(0, query, sort, order);
  }

  function handleSort(field) {
    const nextOrder = sort === field && order === "asc" ? "desc" : "asc";
    setSort(field);
    setOrder(nextOrder);
    load(0, query, field, nextOrder);
  }

  async function handleWithdraw(user) {
    if (!window.confirm(`정말 "${user.username}" 회원을 탈퇴 처리할까요?\n게시물·댓글·팔로우 등 관련 데이터가 모두 삭제되며 되돌릴 수 없습니다.`)) {
      return;
    }
    setBusyId(user.id);
    try {
      await deleteUser(user.id);
      setItems((prev) => prev.filter((u) => u.id !== user.id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      if (err.status === 401) handleUnauthorized();
      else window.alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      <h1 className={styles.pageTitle}>회원 관리</h1>

      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="아이디·이메일·이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">검색</button>
        {query && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => {
              setQuery("");
              load(0, "", sort, order);
            }}
          >
            초기화
          </button>
        )}
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.field} className={styles.sortableTh} onClick={() => handleSort(col.field)}>
                  {col.label}
                  {sort === col.field && <span className={styles.sortArrow}>{order === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.full_name}</td>
                <td>{formatDate(u.created_at)}</td>
                <td>{u.post_count}</td>
                <td>{u.follower_count}</td>
                <td>{u.is_private ? "예" : "아니오"}</td>
                <td>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={busyId === u.id}
                    onClick={() => handleWithdraw(u)}
                  >
                    {busyId === u.id ? "처리 중..." : "탈퇴"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.emptyRow}>
                  표시할 회원이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => load(Math.max(0, offset - LIMIT), query, sort, order)}
        >
          이전
        </button>
        <span>
          {currentPage} / {totalPages} 페이지 (전체 {total}명)
        </span>
        <button
          type="button"
          disabled={offset + LIMIT >= total}
          onClick={() => load(offset + LIMIT, query, sort, order)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
