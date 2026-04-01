import React, { useState } from 'react';
import styles from './Modal.module.css';

export default function JoinModal({ onClose, onJoin }) {
  const [meetingId, setMeetingId] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const cleaned = meetingId.trim().replace(/\s+/g, '').toUpperCase();
    if (!cleaned) { setError('Please enter a meeting ID'); return; }
    onJoin(cleaned);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>🔗 Join Meeting</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>Meeting ID</label>
            <input
              className={`${styles.input} ${styles.inputBig}`}
              placeholder="e.g. ABC123DEF"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
              maxLength={20}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <p className={styles.hint}>Ask the meeting host for the Room ID shown at the top of their screen</p>
        </div>
        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleJoin}>Join Now</button>
        </div>
      </div>
    </div>
  );
}
