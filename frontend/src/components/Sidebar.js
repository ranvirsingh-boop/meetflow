import React, { useState, useRef, useEffect } from 'react';
import styles from './Sidebar.module.css';

export default function Sidebar({ open, tab, onTabChange, onClose, messages, participants, currentUserId, onSendMessage }) {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'chat' ? styles.tabActive : ''}`} onClick={() => onTabChange('chat')}>
          Chat
        </button>
        <button className={`${styles.tab} ${tab === 'participants' ? styles.tabActive : ''}`} onClick={() => onTabChange('participants')}>
          People ({participants.length})
        </button>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      {/* Chat */}
      {tab === 'chat' && (
        <>
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                <span>💬</span>
                <p>No messages yet</p>
                <small>Say hello to the team!</small>
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.userId === currentUserId;
              return (
                <div key={msg.id} className={`${styles.msg} ${isMe ? styles.msgMe : ''}`}>
                  {!isMe && (
                    <div className={styles.msgAvatar} style={{ background: avatarColor(msg.userName) }}>
                      {(msg.userName || 'U').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.msgBody}>
                    {!isMe && <div className={styles.msgName}>{msg.userName}</div>}
                    <div className={styles.msgBubble}>{msg.message}</div>
                    <div className={styles.msgTime}>{msg.timestamp}</div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          <div className={styles.inputArea}>
            <div className={styles.inputRow}>
              <textarea
                className={styles.input}
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
              />
              <button className={styles.sendBtn} onClick={handleSend}>➤</button>
            </div>
          </div>
        </>
      )}

      {/* Participants */}
      {tab === 'participants' && (
        <div className={styles.participantsList}>
          {participants.length === 0 && (
            <div className={styles.empty}>
              <span>👥</span>
              <p>No one else here</p>
              <small>Share the room ID to invite</small>
            </div>
          )}
          {participants.map((p) => (
            <div key={p.id || p.userId} className={styles.pItem}>
              <div className={styles.pAvatar} style={{ background: avatarColor(p.name || p.userName) }}>
                {(p.name || p.userName || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className={styles.pInfo}>
                <div className={styles.pName}>
                  {p.name || p.userName}
                  {p.isYou ? ' 👑' : ''}
                </div>
                <div className={styles.pStatus}>
                  {p.muted ? '🔇 Muted' : '🎤 Unmuted'}
                  {p.camOff ? ' · 📵 No video' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function avatarColor(name = '') {
  const colors = [
    'linear-gradient(135deg,#f97316,#ef4444)',
    'linear-gradient(135deg,#0071e3,#7c3aed)',
    'linear-gradient(135deg,#22c55e,#0071e3)',
    'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'linear-gradient(135deg,#fbbf24,#f97316)',
    'linear-gradient(135deg,#06b6d4,#0071e3)',
  ];
  return colors[(name.charCodeAt(0) || 65) % colors.length];
}
