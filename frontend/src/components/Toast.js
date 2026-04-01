import React from 'react';
import styles from './Toast.module.css';

export default function Toast({ msg, icon }) {
  return (
    <div className={styles.toast}>
      <span className={styles.icon}>{icon}</span>
      {msg}
    </div>
  );
}
