import React, { useState } from 'react';
import { useMeeting } from '../context/MeetingContext';
import styles from './Modal.module.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export default function ScheduleModal({ onClose, onScheduled }) {
  const { addScheduledMeeting } = useMeeting();
  const [form, setForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    duration: '30 minutes',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Please enter a meeting title'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/meetings/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      addScheduledMeeting(data.meeting);
      onScheduled(data.meeting);
      onClose();
    } catch {
      // backend offline — save locally
      const local = { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() };
      addScheduledMeeting(local);
      onScheduled(local);
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>📅 Schedule Meeting</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label>Meeting Title *</label>
            <input
              className={styles.input}
              placeholder="e.g. Weekly Standup"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label>Date</label>
              <input className={styles.input} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label>Time</label>
              <input className={styles.input} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label>Duration</label>
            <select className={styles.input} value={form.duration} onChange={(e) => set('duration', e.target.value)}>
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>1.5 hours</option>
              <option>2 hours</option>
            </select>
          </div>
          <div className={styles.field}>
            <label>Description (optional)</label>
            <textarea
              className={styles.input}
              rows={3}
              placeholder="What's this meeting about?"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Scheduling...' : 'Schedule Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
