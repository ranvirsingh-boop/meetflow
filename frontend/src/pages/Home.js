import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useMeeting } from '../context/MeetingContext';
import ScheduleModal from '../components/ScheduleModal';
import JoinModal from '../components/JoinModal';
import Toast from '../components/Toast';
import styles from './Home.module.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

const HOME_BG_COLORS = [
  '#ff6b6b', // Red
  '#4ecdc4', // Teal
  '#45b7d1', // Blue
  '#96ceb4', // Green
  '#ffeaa7', // Yellow
  '#dda0dd', // Plum
];

export default function Home() {
  const navigate = useNavigate();
  const { userName, setUserName, scheduledMeetings, removeScheduledMeeting } = useMeeting();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [toast, setToast] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(!userName);
  const [bgColor, setBgColor] = useState(HOME_BG_COLORS[0]);

  const showToast = (msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  };

  // Background color change
  useEffect(() => {
    const interval = setInterval(() => {
      setBgColor((prev) => {
        const currentIndex = HOME_BG_COLORS.indexOf(prev);
        const nextIndex = (currentIndex + 1) % HOME_BG_COLORS.length;
        return HOME_BG_COLORS[nextIndex];
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleNewMeeting = async () => {
    if (!userName) { setShowNamePrompt(true); return; }
    try {
      const res = await fetch(`${BACKEND}/api/meetings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: userName }),
      });
      const data = await res.json();
      navigate(`/call/${data.meeting.id}`);
    } catch {
      const localId = uuidv4().slice(0, 9).replace(/-/g, '').toUpperCase();
      navigate(`/call/${localId}`);
    }
  };

  const handleNameSave = () => {
    if (!nameInput.trim()) return;
    setUserName(nameInput.trim());
    setShowNamePrompt(false);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (showNamePrompt) {
    return (
      <div className={styles.nameScreen} style={{ backgroundColor: bgColor, transition: 'background-color 1s ease' }}>
        <div className={styles.nameBg} />
        <div className={styles.nameCard}>
          <div className={styles.nameLogoRow}>
            <div className={styles.nameLogoIcon}>🎥</div>
            <span className={styles.nameLogoText}>MeetFlow</span>
          </div>
          <h2>What should we call you?</h2>
          <p>Enter your name to get started</p>
          <input
            className={styles.nameInput}
            placeholder="Your name..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
            autoFocus
          />
          <button className={styles.btnPrimary} onClick={handleNameSave}>
            Let's go →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.home} style={{ backgroundColor: bgColor, transition: 'background-color 1s ease' }}>
      <div className={styles.homeBg}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
      </div>

      {/* Topbar */}
      <div className={styles.topbar}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🎥</div>
          <span className={styles.logoText}>MeetFlow</span>
        </div>
        <div
          className={styles.avatar}
          title={`Signed in as ${userName}`}
          onClick={() => setShowNamePrompt(true)}
        >
          {userName.slice(0, 2).toUpperCase()}
        </div>
      </div>

      {/* Main */}
      <div className={styles.main}>
        <div className={styles.greeting}>
          <h1>
            {getGreeting()},<br />
            <span className={styles.gradientText}>let's connect.</span>
          </h1>
          <p>Your meetings, your way ✨</p>
        </div>

        {/* Action cards */}
        <div className={styles.actionGrid}>
          <div className={`${styles.card} ${styles.cardBlue}`} onClick={handleNewMeeting}>
            <div className={`${styles.cardIcon} ${styles.cardIconBlue}`}>📹</div>
            <h3>New Meeting</h3>
            <p>Start an instant meeting</p>
          </div>
          <div className={`${styles.card} ${styles.cardPurple}`} onClick={() => setShowJoin(true)}>
            <div className={`${styles.cardIcon} ${styles.cardIconPurple}`}>🔗</div>
            <h3>Join Meeting</h3>
            <p>Enter a meeting ID</p>
          </div>
          <div className={`${styles.card} ${styles.cardGreen}`} onClick={() => setShowSchedule(true)}>
            <div className={`${styles.cardIcon} ${styles.cardIconGreen}`}>📅</div>
            <h3>Schedule</h3>
            <p>Plan a future meeting</p>
          </div>
          <div className={`${styles.card} ${styles.cardOrange}`} onClick={handleNewMeeting}>
            <div className={`${styles.cardIcon} ${styles.cardIconOrange}`}>🖥️</div>
            <h3>Share Screen</h3>
            <p>Present instantly</p>
          </div>
        </div>

        {/* Bottom panels */}
        <div className={styles.panels}>
          {/* Recent meetings */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Recent Meetings</h2>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.empty}>
                <span>🎥</span>
                <p>No recent meetings yet</p>
                <small>Start or join one above</small>
              </div>
            </div>
          </div>

          {/* Scheduled meetings */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Upcoming</h2>
              <button className={styles.btnSmall} onClick={() => setShowSchedule(true)}>+ Add</button>
            </div>
            <div className={styles.panelBody}>
              {scheduledMeetings.length === 0 ? (
                <div className={styles.empty}>
                  <span>📅</span>
                  <p>Nothing scheduled</p>
                  <small>Hit "+ Add" to create one</small>
                </div>
              ) : (
                scheduledMeetings.map((m) => (
                  <div key={m.id} className={styles.upcomingItem}>
                    <div className={styles.timeBadge}>{m.time} · {m.duration}</div>
                    <div className={styles.upcomingRow}>
                      <div>
                        <h4>{m.title}</h4>
                        {m.description && <p>{m.description}</p>}
                      </div>
                      <div className={styles.upcomingActions}>
                        <button
                          className={styles.joinSmall}
                          onClick={() => navigate(`/call/${m.id.slice(0, 9).toUpperCase()}`)}
                        >
                          Join
                        </button>
                        <button
                          className={styles.deleteSmall}
                          onClick={() => removeScheduledMeeting(m.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onScheduled={(m) => showToast(`"${m.title}" scheduled!`, '📅')}
        />
      )}
      {showJoin && (
        <JoinModal
          onClose={() => setShowJoin(false)}
          onJoin={(id) => navigate(`/call/${id}`)}
        />
      )}
      {toast && <Toast msg={toast.msg} icon={toast.icon} />}
    </div>
  );
}
