import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { useMeeting } from '../context/MeetingContext';
import Sidebar from '../components/Sidebar';
import ReactionsPanel from '../components/ReactionsPanel';
import Toast from '../components/Toast';
import styles from './Call.module.css';

const CAPTIONS = [
  "Let's get started everyone...",
  "Can everyone see my screen?",
  "Yeah that looks good to me",
  "Wait, can you unmute yourself?",
  "Let me share my screen quickly",
  "Does anyone have questions?",
  "Okay so the main point here is...",
  "I think we should wrap up soon",
];

export default function Call() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { userName } = useMeeting();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('chat');
  const [toast, setToast] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [captionText, setCaptionText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [speakingId, setSpeakingId] = useState(null);

  const socketRef = useRef(null);
  const captionIntervalRef = useRef(null);
  const captionIdxRef = useRef(0);
  const userIdRef = useRef(uuidv4());
  const displayName = userName || 'Guest';

  const showToast = useCallback((msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Socket
  useEffect(() => {
    const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
    const socket = io(BACKEND);
    socketRef.current = socket;

    socket.emit('join-room', { roomId, userName: displayName, userId: userIdRef.current });

    socket.on('room-state', ({ participants: existing }) => {
      setParticipants(existing.map((p) => ({ ...p, isRemote: true })));
    });
    socket.on('user-joined', ({ participant }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.userId === participant.userId)) return prev;
        return [...prev, { ...participant, isRemote: true }];
      });
      showToast(`${participant.userName} joined`, '👤');
    });
    socket.on('user-left', ({ userId, userName: n }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      showToast(`${n} left`, '👋');
    });
    socket.on('chat-message', (msg) => setMessages((prev) => [...prev, msg]));
    socket.on('reaction-received', ({ emoji, userName: n, id }) => {
      setFloatingReactions((prev) => [...prev, { emoji, id, name: n }]);
      setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
    });
    socket.on('participant-update', ({ userId, muted, camOff }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === userId
            ? { ...p, ...(muted !== undefined && { muted }), ...(camOff !== undefined && { camOff }) }
            : p
        )
      );
    });

    return () => {
      socket.emit('leave-room', { roomId, userId: userIdRef.current, userName: displayName });
      socket.disconnect();
    };
  }, [roomId, displayName, showToast]);

  // Simulated speaking indicator
  useEffect(() => {
    const allIds = [userIdRef.current, ...participants.map((p) => p.userId)];
    const t = setInterval(() => {
      setSpeakingId(allIds[Math.floor(Math.random() * allIds.length)]);
    }, 2800);
    return () => clearInterval(t);
  }, [participants]);

  // Captions
  useEffect(() => {
    if (captionsOn) {
      const show = () => {
        setCaptionText(CAPTIONS[captionIdxRef.current % CAPTIONS.length]);
        captionIdxRef.current++;
        setTimeout(() => setCaptionText(''), 3400);
      };
      show();
      captionIntervalRef.current = setInterval(show, 4500);
    } else {
      clearInterval(captionIntervalRef.current);
      setCaptionText('');
    }
    return () => clearInterval(captionIntervalRef.current);
  }, [captionsOn]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    socketRef.current?.emit('toggle-mic', { roomId, userId: userIdRef.current, muted: !next });
    showToast(next ? 'Mic on' : 'Mic off', next ? '🎤' : '🔇');
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    socketRef.current?.emit('toggle-cam', { roomId, userId: userIdRef.current, camOff: !next });
    showToast(next ? 'Camera on' : 'Camera off', next ? '📹' : '📷');
  };

  const toggleShare = () => {
    const next = !sharing;
    setSharing(next);
    showToast(next ? 'Screen sharing started' : 'Screen sharing stopped', next ? '🖥️' : '✅');
  };

  const toggleRecord = () => {
    const next = !recording;
    setRecording(next);
    showToast(next ? 'Recording started' : 'Recording saved', next ? '⏺' : '💾');
  };

  const sendReaction = (emoji) => {
    socketRef.current?.emit('send-reaction', { roomId, emoji, userName: displayName });
    setReactionsOpen(false);
  };

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const msg = {
      id: Date.now().toString(),
      message: text,
      userName: displayName,
      userId: userIdRef.current,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    socketRef.current?.emit('chat-message', { roomId, ...msg });
    setMessages((prev) => [...prev, msg]);
  };

  const leaveCall = () => {
    socketRef.current?.emit('leave-room', { roomId, userId: userIdRef.current, userName: displayName });
    socketRef.current?.disconnect();
    navigate('/');
  };

  const openSidebar = (tab) => {
    setSidebarTab(tab);
    setSidebarOpen(true);
  };

  const allTiles = [
    { id: userIdRef.current, name: displayName, isYou: true, muted: !micOn, camOff: !camOn },
    ...participants,
  ];

  const gridClass =
    allTiles.length === 1 ? styles.grid1
    : allTiles.length === 2 ? styles.grid2
    : allTiles.length <= 4 ? styles.grid4
    : styles.grid6;

  return (
    <div className={styles.callScreen}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoMini}>🎥</div>
          <span className={styles.roomLabel}>Room: {roomId}</span>
          <div className={styles.liveBadge}><div className={styles.liveDot} />LIVE</div>
          {recording && <div className={styles.recBadge}>⏺ REC</div>}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.timer}>{fmt(seconds)}</span>
          <button className={styles.leaveBtn} onClick={leaveCall}>Leave</button>
        </div>
      </div>

      {/* Video Grid */}
      <div className={`${styles.grid} ${gridClass}`}>
        {allTiles.map((tile) => (
          <VideoTile key={tile.id} tile={tile} speaking={speakingId === tile.id} />
        ))}
      </div>

      {/* Captions */}
      {captionText && (
        <div className={styles.captionsBox}>
          <span className={styles.captionText}>{captionText}</span>
        </div>
      )}

      {/* Floating reactions */}
      <div className={styles.reactionsFeed}>
        {floatingReactions.map((r) => (
          <div key={r.id} className={styles.feedItem}>
            {r.emoji} <span>{r.name}</span>
          </div>
        ))}
      </div>

      {/* Reactions panel */}
      <ReactionsPanel open={reactionsOpen} onReact={sendReaction} onClose={() => setReactionsOpen(false)} />

      {/* Controls */}
      <div className={styles.controls}>
        <CtrlBtn icon={micOn ? '🎤' : '🔇'} label={micOn ? 'Mute' : 'Unmute'} active={!micOn} onClick={toggleMic} />
        <CtrlBtn icon={camOn ? '📹' : '📷'} label={camOn ? 'Stop Video' : 'Start Video'} active={!camOn} onClick={toggleCam} />
        <CtrlBtn icon="🖥️" label={sharing ? 'Stop Share' : 'Share'} active={sharing} onClick={toggleShare} />
        <CtrlBtn icon="💬" label="Captions" active={captionsOn} onClick={() => { setCaptionsOn(!captionsOn); showToast(!captionsOn ? 'Captions on' : 'Captions off', '💬'); }} />
        <CtrlBtn icon="😊" label="React" active={reactionsOpen} onClick={() => setReactionsOpen(!reactionsOpen)} />
        <CtrlBtn icon="⏺" label="Record" active={recording} onClick={toggleRecord} />
        <button className={styles.endBtn} onClick={leaveCall} title="End call">📵</button>
        <CtrlBtn icon="👥" label="People" active={sidebarOpen && sidebarTab === 'participants'} onClick={() => openSidebar('participants')} />
        <CtrlBtn icon="💭" label="Chat" active={sidebarOpen && sidebarTab === 'chat'} onClick={() => openSidebar('chat')} />
      </div>

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        tab={sidebarTab}
        onTabChange={setSidebarTab}
        onClose={() => setSidebarOpen(false)}
        messages={messages}
        participants={allTiles}
        currentUserId={userIdRef.current}
        onSendMessage={sendMessage}
      />

      {toast && <Toast msg={toast.msg} icon={toast.icon} />}
    </div>
  );
}

/* ── Video Tile ── */
const TILE_COLORS = [
  'linear-gradient(135deg,#f97316,#ef4444)',
  'linear-gradient(135deg,#0071e3,#7c3aed)',
  'linear-gradient(135deg,#22c55e,#0071e3)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#fbbf24,#f97316)',
  'linear-gradient(135deg,#06b6d4,#0071e3)',
];

function VideoTile({ tile, speaking }) {
  const idx = (tile.name || 'A').charCodeAt(0) % TILE_COLORS.length;
  return (
    <div className={`${styles.tile} ${speaking ? styles.tileSpeaking : ''} ${tile.isYou ? styles.tileYou : ''}`}>
      {tile.isYou && <div className={styles.youTag}>You</div>}
      <div className={styles.tileBg}>
        <div className={styles.tileMesh} />
        <div className={styles.tileAvatar} style={{ background: TILE_COLORS[idx] }}>
          {(tile.name || 'U').slice(0, 2).toUpperCase()}
        </div>
      </div>
      <div className={styles.tileFooter}>
        <span className={styles.tileName}>{tile.name}{tile.isYou ? ' 👑' : ''}</span>
        <div className={styles.tileBadges}>
          {tile.muted   && <span className={`${styles.badge} ${styles.badgeMuted}`}>🔇</span>}
          {tile.camOff  && <span className={`${styles.badge} ${styles.badgeMuted}`}>📵</span>}
          {!tile.muted && !tile.camOff && <span className={styles.badge}>🎤</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Control Button ── */
function CtrlBtn({ icon, label, active, onClick }) {
  return (
    <button className={styles.ctrlBtn} onClick={onClick}>
      <div className={`${styles.ctrlIcon} ${active ? styles.ctrlIconActive : ''}`}>{icon}</div>
      <span className={styles.ctrlLabel}>{label}</span>
    </button>
  );
}
