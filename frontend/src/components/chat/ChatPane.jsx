import { useEffect, useRef, useState } from "react";
import { Avatar } from "../media/Avatar";
import { Icon } from "../common/Icon";
import { timeAgo } from "../../utils/timeAgo";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import * as messagesApi from "../../api/messages";
import styles from "./ChatPane.module.css";

const POLL_MS = 3000;

export function ChatPane({ conversation, onUpdated }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);
  const lastIdRef = useRef(0);
  const { user: me } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    lastIdRef.current = 0;
    setMessages([]);

    async function fetchAll() {
      const data = await messagesApi.getMessages(conversation.id);
      if (cancelled) return;
      setMessages(data.items);
      lastIdRef.current = data.items.at(-1)?.id || 0;
      messagesApi.markConversationRead(conversation.id).then(() => onUpdated?.());
    }
    fetchAll();

    const interval = setInterval(async () => {
      const data = await messagesApi.getMessages(conversation.id, lastIdRef.current);
      if (cancelled || data.items.length === 0) return;
      setMessages((prev) => [...prev, ...data.items]);
      lastIdRef.current = data.items.at(-1).id;
      messagesApi.markConversationRead(conversation.id).then(() => onUpdated?.());
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [conversation.id, onUpdated]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    try {
      const message = await messagesApi.sendMessage(conversation.id, { text: trimmed });
      setMessages((prev) => [...prev, message]);
      lastIdRef.current = message.id;
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const message = await messagesApi.sendMessage(conversation.id, { kind: "image", file });
      setMessages((prev) => [...prev, message]);
      lastIdRef.current = message.id;
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className={styles.pane}>
      <header className={styles.header}>
        <Avatar src={conversation.other_user.avatar_url} username={conversation.other_user.username} size="sm" />
        <strong>{conversation.other_user.username}</strong>
      </header>

      <div className={styles.messages}>
        {messages.map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} className={`${styles.bubbleRow} ${mine ? styles.mine : ""}`}>
              <div className={styles.bubble}>
                {m.kind === "image" ? <img src={m.file_path} alt="" className={styles.image} /> : <span>{m.text}</span>}
              </div>
              <span className={styles.time}>{timeAgo(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {conversation.is_blocked ? (
        <div className={styles.blockedNotice}>차단된 사용자와는 메시지를 주고받을 수 없습니다.</div>
      ) : (
        <form className={styles.composer} onSubmit={handleSend}>
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="이미지 첨부">
            <Icon name="image" size={22} />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImage} />
          <input
            type="text"
            placeholder="메시지 보내기..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" disabled={!text.trim()} aria-label="보내기">
            <Icon name="send" size={22} />
          </button>
        </form>
      )}
    </div>
  );
}
