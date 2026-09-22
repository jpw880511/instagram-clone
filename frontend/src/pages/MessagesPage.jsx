import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConversationList } from "../components/chat/ConversationList";
import { ChatPane } from "../components/chat/ChatPane";
import { Icon } from "../components/common/Icon";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";
import * as messagesApi from "../api/messages";
import * as searchApi from "../api/search";
import { useDebounce } from "../hooks/useDebounce";
import { Avatar } from "../components/media/Avatar";
import styles from "./MessagesPage.module.css";

export function MessagesPage() {
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const navigate = useNavigate();

  const loadConversations = useCallback(() => {
    return messagesApi.getConversations().then((data) => {
      setConversations(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const active = conversations.find((c) => c.id === Number(conversationId));

  async function handleStartChat(userId) {
    const conv = await messagesApi.createConversation(userId);
    setNewChatOpen(false);
    await loadConversations();
    navigate(`/direct/${conv.id}`);
  }

  return (
    <div className={styles.layout}>
      <div className={`${styles.listPane} ${conversationId ? styles.hideOnMobile : ""}`}>
        <header className={styles.listHeader}>
          <h2>메시지</h2>
          <button type="button" onClick={() => setNewChatOpen(true)} aria-label="새 메시지">
            <Icon name="plus" size={22} />
          </button>
        </header>
        {loading ? (
          <Spinner />
        ) : conversations.length === 0 ? (
          <EmptyState title="대화가 없습니다" description="새 메시지를 시작해보세요." />
        ) : (
          <ConversationList conversations={conversations} activeId={Number(conversationId)} />
        )}
      </div>

      <div className={`${styles.chatPane} ${!conversationId ? styles.hideOnMobile : ""}`}>
        {conversationId && (
          <button type="button" className={styles.backBtn} onClick={() => navigate("/direct")}>
            <Icon name="chevronLeft" size={22} /> 메시지
          </button>
        )}
        {active ? (
          <ChatPane conversation={active} onUpdated={loadConversations} />
        ) : (
          <EmptyState title="메시지 보내기" description="친구나 그룹에 메시지를 보내보세요." />
        )}
      </div>

      {newChatOpen && <NewChatDialog onClose={() => setNewChatOpen(false)} onPick={handleStartChat} />}
    </div>
  );
}

function NewChatDialog({ onClose, onPick }) {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    searchApi.search(debounced, "user").then((data) => setResults(data.users));
  }, [debounced]);

  return (
    <div className={styles.dialogOverlay} onMouseDown={onClose}>
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()}>
        <header className={styles.dialogHeader}>
          <span />
          <strong>새 메시지</strong>
          <button type="button" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className={styles.dialogSearch}>
          <input
            type="text"
            placeholder="받는 사람 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.dialogResults}>
          {results.map((u) => (
            <button key={u.id} type="button" className={styles.dialogRow} onClick={() => onPick(u.id)}>
              <Avatar src={u.avatar_url} username={u.username} size="md" linkToProfile={false} />
              <span>
                <strong>{u.username}</strong> <span className={styles.muted}>{u.full_name}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
