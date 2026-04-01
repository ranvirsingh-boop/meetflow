import React from 'react';
import styles from './ReactionsPanel.module.css';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '🚀', '😮', '💯', '🙌'];

export default function ReactionsPanel({ open, onReact, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        {EMOJIS.map((e) => (
          <button key={e} className={styles.emojiBtn} onClick={() => onReact(e)}>
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
