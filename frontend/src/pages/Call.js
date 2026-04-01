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

const BG_COLORS = [
  '#1a1a1a',
  '#2a2a2a',
  '#3a3a3a',
  '#4a4a4a',
  '#5a5a5a',
  '#6a6a6a',
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
  const [localPreviewStream, setLocalPreviewStream] = useState(null);
  const [remoteStreamsByUserId, setRemoteStreamsByUserId] = useState({});
  const [bgColor, setBgColor] = useState('#1a1a1a');

  const socketRef = useRef(null);
  const captionIntervalRef = useRef(null);
  const captionIdxRef = useRef(0);
  const userIdRef = useRef(uuidv4());
  const displayName = userName || 'Guest';

  const localStreamRef = useRef(null); // camera+mic
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // socketId -> RTCPeerConnection
  const pendingOfferTargetsRef = useRef([]); // participants to call once local media is ready
  const participantsRef = useRef([]);

  const showToast = useCallback((msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const rtcConfigRef = useRef({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  const inviteLink = `${window.location.origin}/call/${roomId}`;

  // Timer
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Background color change
  useEffect(() => {
    const interval = setInterval(() => {
      setBgColor((prev) => {
        const currentIndex = BG_COLORS.indexOf(prev);
        const nextIndex = (currentIndex + 1) % BG_COLORS.length;
        return BG_COLORS[nextIndex];
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      showToast('For mic/cam on other laptops, use HTTPS (or localhost)', '🔒');
    }
  }, [showToast]);

  const stopStream = (stream) => {
    if (!stream) return;
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (_) {
        // ignore
      }
    });
  };

  const closeAllPeerConnections = useCallback(() => {
    for (const pc of peerConnectionsRef.current.values()) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (_) {
        // ignore
      }
    }
    peerConnectionsRef.current.clear();
  }, []);

  const ensurePeerConnection = useCallback(
    ({ toSocketId, toUserId }) => {
      const existing = peerConnectionsRef.current.get(toSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(rtcConfigRef.current);
      peerConnectionsRef.current.set(toSocketId, pc);

      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        socketRef.current?.emit('webrtc-ice-candidate', {
          roomId,
          toSocketId,
          fromUserId: userIdRef.current,
          candidate: e.candidate,
        });
      };

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;
        if (!remoteStream) return;
        console.log('Received remote stream from', toUserId);
        setRemoteStreamsByUserId((prev) => ({ ...prev, [toUserId]: remoteStream }));
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'failed' || st === 'closed' || st === 'disconnected') {
          // best-effort cleanup; UI also updates via user-left
        }
      };

      return pc;
    },
    [roomId]
  );

  const callParticipant = useCallback(
    async (p) => {
      if (!p?.socketId || !p?.userId) return;
      const localStream = localStreamRef.current;
      if (!localStream) {
        pendingOfferTargetsRef.current = [...pendingOfferTargetsRef.current, p];
        return;
      }

      const pc = ensurePeerConnection({ toSocketId: p.socketId, toUserId: p.userId });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('webrtc-offer', {
        roomId,
        toSocketId: p.socketId,
        fromUserId: userIdRef.current,
        sdp: pc.localDescription,
      });
    },
    [ensurePeerConnection, roomId]
  );

  // Media: mic + camera
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }

        localStreamRef.current = stream;
        setLocalPreviewStream(stream);

        const hasAudio = stream.getAudioTracks().some((t) => t.enabled);
        const hasVideo = stream.getVideoTracks().some((t) => t.enabled);
        setMicOn(hasAudio);
        setCamOn(hasVideo);

        // Flush any pending calls queued before we had local media
        const pending = pendingOfferTargetsRef.current;
        pendingOfferTargetsRef.current = [];
        pending.forEach((p) => callParticipant(p));
      } catch (e) {
        console.error(e);
        showToast('Allow mic + camera permissions to join', '⚠️');
        setMicOn(false);
        setCamOn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callParticipant, showToast]);

  // Socket
  useEffect(() => {
    const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
    const socket = io(BACKEND, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });
    socketRef.current = socket;
    const myUserId = userIdRef.current;
    const myName = displayName;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('join-room', { roomId, userName: myName, userId: myUserId });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('room-state', ({ participants: existing }) => {
      console.log('Room state:', existing);
      setParticipants(existing.map((p) => ({ ...p, isRemote: true })));
    });
    socket.on('user-joined', ({ participant }) => {
      console.log('User joined:', participant);
      setParticipants((prev) => {
        if (prev.find((p) => p.userId === participant.userId)) return prev;
        return [...prev, { ...participant, isRemote: true }];
      });
      // Existing participants initiate WebRTC toward the new joiner.
      callParticipant(participant);
      showToast(`${participant.userName} joined`, '👤');
    });
    socket.on('user-left', ({ userId, userName: n }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      setRemoteStreamsByUserId((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      const mappedSocketId = participantsRef.current.find((p) => p.userId === userId)?.socketId;
      if (mappedSocketId) {
        const pc = peerConnectionsRef.current.get(mappedSocketId);
        if (pc) {
          try {
            pc.close();
          } catch (_) {
            // ignore
          }
        }
        peerConnectionsRef.current.delete(mappedSocketId);
      }
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

    // WebRTC signaling handlers
    socket.on('webrtc-offer', async ({ fromSocketId, fromUserId, sdp }) => {
      console.log('Received offer from', fromUserId);
      try {
        const pc = ensurePeerConnection({ toSocketId: fromSocketId, toUserId: fromUserId });
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          roomId,
          toSocketId: fromSocketId,
          fromUserId: userIdRef.current,
          sdp: pc.localDescription,
        });
        console.log('Sent answer to', fromUserId);
      } catch (e) {
        console.error('Error handling offer:', e);
      }
    });

    socket.on('webrtc-answer', async ({ fromSocketId, sdp }) => {
      try {
        const pc = peerConnectionsRef.current.get(fromSocketId);
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (e) {
        console.error(e);
      }
    });

    socket.on('webrtc-ice-candidate', async ({ fromSocketId, candidate }) => {
      try {
        const pc = peerConnectionsRef.current.get(fromSocketId);
        if (!pc) return;
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error(e);
      }
    });

    return () => {
      socket.emit('leave-room', { roomId, userId: myUserId, userName: myName });
      socket.disconnect();
    };
  }, [roomId, displayName, showToast, callParticipant, ensurePeerConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAllPeerConnections();
      stopStream(screenStreamRef.current);
      screenStreamRef.current = null;
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
    };
  }, [closeAllPeerConnections]);

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
    const stream = localStreamRef.current;
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = next));
    socketRef.current?.emit('toggle-mic', { roomId, userId: userIdRef.current, muted: !next });
    showToast(next ? 'Mic on' : 'Mic off', next ? '🎤' : '🔇');
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    const stream = localStreamRef.current;
    if (stream) stream.getVideoTracks().forEach((t) => (t.enabled = next));
    socketRef.current?.emit('toggle-cam', { roomId, userId: userIdRef.current, camOff: !next });
    showToast(next ? 'Camera on' : 'Camera off', next ? '📹' : '📷');
  };

  const toggleShare = async () => {
    if (sharing) {
      // Stop share and revert to camera
      setSharing(false);
      stopStream(screenStreamRef.current);
      screenStreamRef.current = null;

      const camTrack = localStreamRef.current?.getVideoTracks?.()[0];
      if (camTrack) {
        for (const pc of peerConnectionsRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            try {
              // eslint-disable-next-line no-await-in-loop
              await sender.replaceTrack(camTrack);
            } catch (_) {
              // ignore
            }
          }
        }
      }
      setLocalPreviewStream(localStreamRef.current);
      showToast('Screen sharing stopped', '✅');
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screen.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = screen;
      setSharing(true);

      // Replace outgoing video track for all peers
      for (const pc of peerConnectionsRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          // eslint-disable-next-line no-await-in-loop
          await sender.replaceTrack(screenTrack);
        }
      }

      // Local preview: keep mic from camera stream + screen video track
      const audioTrack = localStreamRef.current?.getAudioTracks?.()[0] || null;
      const preview = new MediaStream([screenTrack, ...(audioTrack ? [audioTrack] : [])]);
      setLocalPreviewStream(preview);

      screenTrack.onended = () => {
        // user stopped share from browser UI
        toggleShare();
      };

      showToast('Screen sharing started', '🖥️');
    } catch (e) {
      console.error(e);
      showToast('Screen share blocked/cancelled', '⚠️');
    }
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
    closeAllPeerConnections();
    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    navigate('/');
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('Invite link copied', '🔗');
    } catch (_) {
      showToast('Copy failed — copy from address bar', '⚠️');
    }
  };

  const openSidebar = (tab) => {
    setSidebarTab(tab);
    setSidebarOpen(true);
  };

  const allTiles = [
    {
      id: userIdRef.current,
      userId: userIdRef.current,
      name: displayName,
      isYou: true,
      muted: !micOn,
      camOff: !camOn,
      stream: localPreviewStream,
    },
    ...participants.map((p) => ({
      ...p,
      id: p.userId,
      name: p.userName,
      stream: remoteStreamsByUserId[p.userId] || null,
    })),
  ];

  const gridClass =
    allTiles.length === 1 ? styles.grid1
    : allTiles.length === 2 ? styles.grid2
    : allTiles.length <= 4 ? styles.grid4
    : styles.grid6;

  return (
    <div className={styles.callScreen} style={{ backgroundColor: bgColor, transition: 'background-color 1s ease' }}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoMini}>🎥</div>
          <span className={styles.roomLabel}>Room: {roomId}</span>
          <div className={styles.liveBadge}><div className={styles.liveDot} />LIVE</div>
          {recording && <div className={styles.recBadge}>⏺ REC</div>}
        </div>
        <div className={styles.headerRight}>
          <button className={styles.inviteBtn} onClick={copyInviteLink} title={inviteLink}>Invite</button>
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
  const showVideo = Boolean(tile.stream) && !tile.camOff;
  return (
    <div
      className={`${styles.tile} ${speaking ? styles.tileSpeaking : ''} ${tile.isYou ? styles.tileYou : ''} ${
        showVideo ? styles.tileHasVideo : ''
      }`}
    >
      {tile.isYou && <div className={styles.youTag}>You</div>}
      {showVideo ? <VideoEl stream={tile.stream} muted={tile.isYou} /> : null}
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

function VideoEl({ stream, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);
  return <video className={styles.video} ref={ref} autoPlay playsInline muted={muted} />;
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
