import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../common/Icon";
import { Avatar } from "../media/Avatar";
import { Spinner } from "../common/Spinner";
import { useDebounce } from "../../hooks/useDebounce";
import * as searchApi from "../../api/search";
import styles from "./SearchPanel.module.css";

const RECENT_KEY = "recent_searches";
const MAX_RECENT = 20;

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(list) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

export function SearchPanel({ onClose }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ users: [], hashtags: [] });
  const [recent, setRecent] = useState(loadRecent);
  const debounced = useDebounce(query, 300);
  const navigate = useNavigate();

  useEffect(() => {
    if (!debounced.trim()) {
      setResults({ users: [], hashtags: [] });
      return;
    }
    let active = true;
    setLoading(true);
    searchApi
      .search(debounced, "all")
      .then((data) => {
        if (active) setResults(data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  function addRecent(entry) {
    const next = [entry, ...recent.filter((r) => !(r.type === entry.type && r.value === entry.value))];
    setRecent(next);
    saveRecent(next);
  }

  function goToUser(username) {
    addRecent({ type: "user", value: username });
    onClose();
    navigate(`/${username}`);
  }

  function goToTag(name) {
    addRecent({ type: "hashtag", value: name });
    onClose();
    navigate(`/explore/tags/${name}`);
  }

  const showRecent = !query.trim();

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2>검색</h2>
      </header>
      <div className={styles.searchBox}>
        <Icon name="search" size={16} className={styles.searchIcon} />
        <input
          autoFocus
          type="text"
          placeholder="검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="사용자 또는 해시태그 검색"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className={styles.clearBtn}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      <div className={styles.body}>
        {loading && <Spinner />}

        {!loading && showRecent && (
          <>
            <div className={styles.rowHeader}>
              <span>최근 검색 항목</span>
              {recent.length > 0 && (
                <button
                  type="button"
                  className={styles.clearAll}
                  onClick={() => {
                    setRecent([]);
                    saveRecent([]);
                  }}
                >
                  모두 지우기
                </button>
              )}
            </div>
            {recent.length === 0 && <p className={styles.muted}>최근 검색 내역이 없습니다.</p>}
            {recent.map((r) => (
              <button
                key={`${r.type}-${r.value}`}
                type="button"
                className={styles.resultRow}
                onClick={() => (r.type === "user" ? goToUser(r.value) : goToTag(r.value))}
              >
                {r.type === "user" ? <Avatar username={r.value} size="md" linkToProfile={false} /> : <span className={styles.tagIcon}>#</span>}
                <span>{r.type === "user" ? `@${r.value}` : `#${r.value}`}</span>
              </button>
            ))}
          </>
        )}

        {!loading && !showRecent && (
          <>
            {results.users.map((u) => (
              <button key={u.id} type="button" className={styles.resultRow} onClick={() => goToUser(u.username)}>
                <Avatar src={u.avatar_url} username={u.username} size="md" linkToProfile={false} />
                <span className={styles.resultText}>
                  <strong>{u.username}</strong>
                  <span className={styles.muted}>{u.full_name}</span>
                </span>
              </button>
            ))}
            {results.hashtags.map((h) => (
              <button key={h.name} type="button" className={styles.resultRow} onClick={() => goToTag(h.name)}>
                <span className={styles.tagIcon}>#</span>
                <span className={styles.resultText}>
                  <strong>#{h.name}</strong>
                  <span className={styles.muted}>게시물 {h.post_count}개</span>
                </span>
              </button>
            ))}
            {results.users.length === 0 && results.hashtags.length === 0 && (
              <p className={styles.muted}>검색 결과가 없습니다.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
