import { useCallback, useEffect, useState } from "react";
import { deletePost, getPosts } from "./adminApi";
import { useAdminAuth } from "./AdminAuthContext";
import styles from "./AdminTable.module.css";

const LIMIT = 20;

const COLUMNS = [
  { field: null, label: "미리보기" },
  { field: "id", label: "ID" },
  { field: "author_username", label: "작성자" },
  { field: "post_type", label: "종류" },
  { field: "caption", label: "캡션" },
  { field: "like_count", label: "좋아요" },
  { field: "comment_count", label: "댓글" },
  { field: "created_at", label: "작성일" },
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

const emptyFilters = { q: "", author: "", postType: "" };

export function AdminPostsPage() {
  const { handleUnauthorized } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    (nextOffset, nextFilters, sortField, sortOrder) => {
      setLoading(true);
      setError("");
      getPosts({
        q: nextFilters.q,
        author: nextFilters.author,
        postType: nextFilters.postType,
        sort: sortField,
        order: sortOrder,
        limit: LIMIT,
        offset: nextOffset,
      })
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
    load(0, emptyFilters, "created_at", "desc");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(0, filters, sort, order);
  }

  function handleReset() {
    setFilters(emptyFilters);
    load(0, emptyFilters, sort, order);
  }

  function handleSort(field) {
    if (!field) return;
    const nextOrder = sort === field && order === "asc" ? "desc" : "asc";
    setSort(field);
    setOrder(nextOrder);
    load(0, filters, field, nextOrder);
  }

  async function handleDelete(post) {
    if (!window.confirm(`"${post.author_username}"님의 게시물을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusyId(post.id);
    try {
      await deletePost(post.id);
      setItems((prev) => prev.filter((p) => p.id !== post.id));
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
  const hasFilters = filters.q || filters.author || filters.postType;

  return (
    <div>
      <h1 className={styles.pageTitle}>게시물 관리</h1>

      <form className={styles.searchRow} onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="캡션 검색"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <input
          type="text"
          placeholder="작성자(아이디) 검색"
          value={filters.author}
          onChange={(e) => setFilters((f) => ({ ...f, author: e.target.value }))}
        />
        <select
          value={filters.postType}
          onChange={(e) => setFilters((f) => ({ ...f, postType: e.target.value }))}
        >
          <option value="">전체 종류</option>
          <option value="post">게시물</option>
          <option value="reel">릴스</option>
        </select>
        <button type="submit">검색</button>
        {hasFilters && (
          <button type="button" className={styles.resetBtn} onClick={handleReset}>
            초기화
          </button>
        )}
      </form>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) =>
                col.field ? (
                  <th key={col.label} className={styles.sortableTh} onClick={() => handleSort(col.field)}>
                    {col.label}
                    {sort === col.field && (
                      <span className={styles.sortArrow}>{order === "asc" ? "▲" : "▼"}</span>
                    )}
                  </th>
                ) : (
                  <th key={col.label}>{col.label}</th>
                )
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className={styles.thumb} />
                  ) : (
                    <div className={styles.thumb} />
                  )}
                </td>
                <td>{p.id}</td>
                <td>{p.author_username}</td>
                <td>{p.post_type === "reel" ? "릴스" : "게시물"}</td>
                <td className={styles.captionCell}>{p.caption || "(캡션 없음)"}</td>
                <td>{p.like_count}</td>
                <td>{p.comment_count}</td>
                <td>{formatDate(p.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={busyId === p.id}
                    onClick={() => handleDelete(p)}
                  >
                    {busyId === p.id ? "처리 중..." : "삭제"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.emptyRow}>
                  표시할 게시물이 없습니다.
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
          onClick={() => load(Math.max(0, offset - LIMIT), filters, sort, order)}
        >
          이전
        </button>
        <span>
          {currentPage} / {totalPages} 페이지 (전체 {total}개)
        </span>
        <button
          type="button"
          disabled={offset + LIMIT >= total}
          onClick={() => load(offset + LIMIT, filters, sort, order)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
