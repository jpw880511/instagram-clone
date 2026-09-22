import { useEffect, useState } from "react";
import { getStats } from "./adminApi";
import { useAdminAuth } from "./AdminAuthContext";
import styles from "./AdminDashboardPage.module.css";

const STAT_CARDS = [
  { key: "total_users", label: "전체 회원" },
  { key: "total_posts", label: "게시물" },
  { key: "total_reels", label: "릴스" },
  { key: "total_comments", label: "댓글" },
  { key: "total_likes", label: "좋아요" },
  { key: "total_follows", label: "팔로우 관계" },
  { key: "active_stories", label: "진행 중인 스토리" },
  { key: "total_conversations", label: "대화방" },
  { key: "total_messages", label: "메시지" },
];

function BarChart({ title, data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className={styles.chartCard}>
      <h3 className={styles.chartTitle}>{title}</h3>
      <div className={styles.bars}>
        {data.map((d) => (
          <div key={d.date} className={styles.barCol}>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ height: `${(d.count / max) * 100}%` }} />
            </div>
            <span className={styles.barValue}>{d.count}</span>
            <span className={styles.barLabel}>{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { handleUnauthorized } = useAdminAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => {
        if (err.status === 401) handleUnauthorized();
        else setError(err.message);
      });
  }, [handleUnauthorized]);

  if (error) return <p className={styles.error}>{error}</p>;
  if (!stats) return <p className={styles.loading}>불러오는 중...</p>;

  return (
    <div>
      <h1 className={styles.pageTitle}>대시보드</h1>
      <div className={styles.grid}>
        {STAT_CARDS.map((c) => (
          <div key={c.key} className={styles.card}>
            <span className={styles.cardValue}>{stats[c.key].toLocaleString()}</span>
            <span className={styles.cardLabel}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.charts}>
        <BarChart title="최근 7일 가입자" data={stats.signups_last_7_days} />
        <BarChart title="최근 7일 게시물" data={stats.posts_last_7_days} />
      </div>
    </div>
  );
}
