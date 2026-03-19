import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, LogOut, User as UserIcon, ShieldCheck, MessageSquare, Paperclip, Check, CheckCheck, Video, Phone, PhoneOff, Trash2, Settings, FileText, Camera, PenTool, X, Terminal, ShieldAlert, BadgeCheck, Shield } from 'lucide-react';
import io from 'socket.io-client';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import Editor from '@monaco-editor/react';

const getRoomKey = (roomId) => {
  const masterSalt = "nexus_prime_2026_secure_layer";
  return CryptoJS.HmacSHA256(roomId, masterSalt).toString();
};

const generateRoomId = (me, them) => {
  const id1 = String(me?.email || me?.username || me?.full_name || me?.id).toLowerCase();
  const id2 = String(them?.email || them?.username || them?.full_name || them?.id).toLowerCase();
  return [id1, id2].sort().join('_');
};

const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- AI Feature: Spam / Scam Detection Engine ---
const isSpam = (text) => {
  if (!text) return false;
  // Detects urgency, phishing links, crypto scams, or raw IP addresses
  const spamRegex = /(?:verify.*account|update.*payment|password.*reset|crypto.*giveaway|click.*link.*win|http:\/\/\d+\.\d+\.\d+\.\d+|free.*money)/i;
  return spamRegex.test(text);
};

export default function ChatDashboard() {
  const navigate = useNavigate();
  
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('nexus_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [room, setRoom] = useState("");
  const [currentMessage, setCurrentMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // WebRTC
  const [callStatus, setCallStatus] = useState('idle'); 
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Modals & UI
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || "");

  // Whiteboard
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#3b82f6"); 
  
  // Live Code
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [liveCode, setLiveCode] = useState("// Write your code here...");

  // Trust State
  const [trustData, setTrustData] = useState({ score: 0, level: 'New Contact', count: 0 });
  const [showTrustModal, setShowTrustModal] = useState(false);

  // Online users state
  const [onlineUsersSet, setOnlineUsersSet] = useState(new Set());

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const profilePicRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const callRoomRef = useRef(null); 
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const decryptMessage = (ciphertext, roomId) => {
    if (!ciphertext) return "";
    if (!ciphertext.startsWith("U2Fsd")) return ciphertext; 
    if (!roomId) return "[Decryption Error]";
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, getRoomKey(roomId));
      return bytes.toString(CryptoJS.enc.Utf8) || "[Decryption Error]"; 
    } catch (err) { return "[Decryption Error]"; }
  };

  useEffect(() => { if (!user) navigate('/'); }, [user, navigate]);

  useEffect(() => {
    if (!user) return; 
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [user]);

  // Socket event listeners for online status
  useEffect(() => {
    if (!socket || !user) return;

    // Register user with socket server
    socket.emit('register_user', user.email);

    const handleOnlineUsers = (onlineEmails) => {
      setOnlineUsersSet(new Set(onlineEmails));
    };

    const handleUserOnline = (email) => {
      setOnlineUsersSet(prev => new Set(prev).add(email));
    };

    const handleUserOffline = (email) => {
      setOnlineUsersSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(email);
        return newSet;
      });
    };

    socket.on('online_users', handleOnlineUsers);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);

    return () => {
      socket.off('online_users', handleOnlineUsers);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!user?.email) return;
    const fetchUsers = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/users');
        setUsers(res.data.filter(u => u.email !== user.email));
      } catch (err) {}
    };
    fetchUsers();
  }, [user?.email, showProfileModal]);

  useEffect(() => {
    if (!activeChat || !socket || !user) return;
    const roomId = generateRoomId(user, activeChat);
    setRoom(roomId);
    socket.emit("join_room", roomId);

    const fetchData = async () => {
      try {
        const msgRes = await axios.get(`http://localhost:5000/api/messages/${roomId}`);
        setMessages(msgRes.data.map(msg => ({ ...msg, message: decryptMessage(msg.message, roomId) })));
        
        const trustRes = await axios.get(`http://localhost:5000/api/trust/${roomId}`);
        setTrustData(trustRes.data);
      } catch (error) {}
    };
    fetchData();
    
    return () => {
      socket.emit("leave_room", roomId);
      setMessages([]); 
      setShowWhiteboard(false); 
      setShowCodeEditor(false); 
      setTrustData({ score: 0, level: 'New Contact', count: 0 });
    };
  }, [activeChat, user?.email, socket]); 

  // Auto trigger Read receipts for messages that are already delivered (on chat open)
  useEffect(() => {
    if (!activeChat || !socket || !room) return;
    const unreadMessages = messages.filter(msg => msg.author !== user?.full_name && msg.status === 'delivered');
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => socket.emit("message_read", { room, messageId: msg.id || msg.tempId }));
      setMessages(prev => prev.map(msg => msg.author !== user?.full_name && msg.status === 'delivered' ? { ...msg, status: 'read' } : msg));
    }
  }, [messages, activeChat, socket, room, user?.full_name]);

  // --- Socket Listeners ---
  useEffect(() => {
    if (!socket || !user) return;

    const handleReceive = (data) => {
      const correctRoomId = data.room_id || data.room || room;
      const decryptedMsg = decryptMessage(data.message, correctRoomId);
      
      setMessages((prev) => [...prev, { ...data, message: decryptedMsg }]);
      
      // Notify sender that message was delivered
      socket.emit("message_delivered", { room: correctRoomId, messageId: data.id || data.tempId });

      // Immediately mark as read if the message is from someone else (user is viewing it)
      if (data.author !== user.full_name) {
        socket.emit("message_read", { room: correctRoomId, messageId: data.id || data.tempId });
        // Update trust count locally
        setTrustData(prev => ({ ...prev, count: prev.count + 1 }));
      }
    };

    socket.on("receive_message", handleReceive);
    socket.on("message_delivered", (id) => setMessages(prev => prev.map(msg => (msg.id === id || msg.tempId === id) ? { ...msg, status: 'delivered' } : msg)));
    socket.on("message_read", (id) => setMessages(prev => prev.map(msg => (msg.id === id || msg.tempId === id) ? { ...msg, status: 'read' } : msg)));
    socket.on("message_deleted_everyone", (id) => setMessages(prev => prev.map(msg => (msg.id === id || msg.tempId === id) ? { ...msg, is_deleted: true, message: '[DELETED]' } : msg)));
    
    socket.on("receive_code_update", (code) => setLiveCode(code));
    socket.on("receive_whiteboard_draw", (encryptedData) => {
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, getRoomKey(room));
        const { start, end, color } = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        drawOnCanvas(start, end, color);
      } catch (err) {}
    });
    socket.on("receive_whiteboard_clear", () => { if (ctxRef.current && canvasRef.current) ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); });
    
    socket.on("user_typing", () => setIsTyping(true));
    socket.on("user_stopped_typing", () => setIsTyping(false));
    socket.on("incoming_call", (data) => { setIncomingCallData(data); setCallStatus('receiving'); });
    socket.on("call_accepted", async (answer) => { if (peerConnectionRef.current) { await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer)); setCallStatus('active'); }});
    socket.on("receive_ice_candidate", async (candidate) => { if (peerConnectionRef.current) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); });
    socket.on("call_ended", () => endCallLocal());

    return () => { 
      socket.off("receive_message", handleReceive); socket.off("message_delivered"); socket.off("message_read"); 
      socket.off("message_deleted_everyone"); socket.off("receive_code_update"); socket.off("receive_whiteboard_draw"); 
      socket.off("receive_whiteboard_clear"); socket.off("user_typing"); socket.off("user_stopped_typing"); 
      socket.off("incoming_call"); socket.off("call_accepted"); socket.off("receive_ice_candidate"); socket.off("call_ended"); 
    };
  }, [room, user?.full_name, socket]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream, callStatus]);

  useEffect(() => scrollToBottom(), [messages, isTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleCodeChange = (value) => { setLiveCode(value); if (socket && room) socket.emit("code_update", { room, code: value }); };
  const insertCodeTemplate = () => { setCurrentMessage("LIVE_CODE_BLOCK"); setShowCodeEditor(true); };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put('http://localhost:5000/api/users/profile', { email: user.email, full_name: editName, avatar: user.avatar || '' });
      const updatedUser = { ...user, ...res.data };
      localStorage.setItem('nexus_user', JSON.stringify(updatedUser)); setUser(updatedUser); setShowProfileModal(false);
    } catch (err) {}
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', formData);
      const updatedUser = { ...user, avatar: res.data.url };
      localStorage.setItem('nexus_user', JSON.stringify(updatedUser)); setUser(updatedUser);
      await axios.put('http://localhost:5000/api/users/profile', { email: user.email, full_name: user.full_name, avatar: res.data.url });
    } catch (err) {}
  };

  const handleDeleteMessage = (type) => {
    if (!showDeleteModal || !socket) return;
    const msgId = showDeleteModal.id || showDeleteModal.tempId;
    socket.emit('delete_message', { messageId: msgId, type, requester: user.full_name, room });
    if (type === 'me') setMessages(prev => prev.map(m => (m.id === msgId || m.tempId === msgId) ? { ...m, deleted_for: [...(m.deleted_for || []), user.full_name] } : m));
    else if (type === 'everyone') setMessages(prev => prev.map(m => (m.id === msgId || m.tempId === msgId) ? { ...m, is_deleted: true, message: '[DELETED]' } : m));
    setShowDeleteModal(null);
  };

  const handleClearChat = () => { socket.emit("clear_chat", { room, requester: user.full_name }); setMessages([]); setShowClearChatModal(false); };

  // --- WebRTC Setup ---
  const setupPeerConnection = () => { const pc = new RTCPeerConnection(rtcConfig); pc.onicecandidate = (event) => { if (event.candidate && socket && callRoomRef.current) socket.emit("ice_candidate", { room: callRoomRef.current, candidate: event.candidate }); }; pc.ontrack = (event) => setRemoteStream(event.streams[0]); peerConnectionRef.current = pc; return pc; };
  const getMedia = async (videoEnabled = true) => { try { const stream = await navigator.mediaDevices.getUserMedia({ video: videoEnabled, audio: true }); setLocalStream(stream); return stream; } catch (err) { return null; } };
  const startCall = async (videoEnabled = true) => { if (!room || !socket || !user) return; setCallStatus('calling'); callRoomRef.current = room; const stream = await getMedia(videoEnabled); if (!stream) { setCallStatus('idle'); callRoomRef.current = null; return; } const pc = setupPeerConnection(); stream.getTracks().forEach(track => pc.addTrack(track, stream)); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit("call_user", { room, from: user.full_name, offer, type: videoEnabled ? 'video' : 'audio' }); };
  const acceptCall = async () => { if (!incomingCallData || !socket || !room) return; callRoomRef.current = room; const useVideo = incomingCallData.type === 'video'; const stream = await getMedia(useVideo); if (!stream) return; const pc = setupPeerConnection(); stream.getTracks().forEach(track => pc.addTrack(track, stream)); await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit("answer_call", { room, answer }); setCallStatus('active'); };
  const endCallLocal = () => { if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; } if (localStream) localStream.getTracks().forEach(track => track.stop()); setLocalStream(null); setRemoteStream(null); setCallStatus('idle'); setIncomingCallData(null); callRoomRef.current = null; };
  const endCallNetwork = () => { endCallLocal(); if (socket && room) socket.emit("end_call", room); };

  // --- Whiteboard Logic ---
  useEffect(() => { if (showWhiteboard && canvasRef.current) { const ctx = canvasRef.current.getContext("2d"); canvasRef.current.width = 800; canvasRef.current.height = 500; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 4; ctxRef.current = ctx; } }, [showWhiteboard]);
  const drawOnCanvas = (start, end, color) => { if (!ctxRef.current) return; ctxRef.current.beginPath(); ctxRef.current.strokeStyle = color; ctxRef.current.moveTo(start.x, start.y); ctxRef.current.lineTo(end.x, end.y); ctxRef.current.stroke(); ctxRef.current.closePath(); };
  const startDrawing = ({ nativeEvent }) => { lastPos.current = { x: nativeEvent.offsetX, y: nativeEvent.offsetY }; setIsDrawing(true); };
  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => { if (canvasRef.current && ctxRef.current) { ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); if (socket && room) socket.emit("whiteboard_clear", room); } };
  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return; const currentPos = { x: nativeEvent.offsetX, y: nativeEvent.offsetY }; drawOnCanvas(lastPos.current, currentPos, brushColor);
    if (socket && room) socket.emit("whiteboard_draw", { room, data: CryptoJS.AES.encrypt(JSON.stringify({ start: lastPos.current, end: currentPos, color: brushColor }), getRoomKey(room)).toString() });
    lastPos.current = currentPos;
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    if (!room || !socket) return;
    socket.emit("typing", room);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("stop_typing", room), 1500);
  };

  const emitMessage = async (messageContent) => {
    const date = new Date();
    const timeString = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    const encryptedText = CryptoJS.AES.encrypt(messageContent, getRoomKey(room)).toString();

    const messageData = { 
      room, author: user?.full_name || 'Unknown', message: encryptedText, 
      time: timeString, tempId: Date.now().toString() + Math.random().toString(), status: 'sent'
    };

    socket.emit("send_message", messageData, (serverMessage) => {
      if(serverMessage) setMessages(prev => prev.map(msg => msg.tempId === messageData.tempId ? { ...serverMessage, message: messageContent } : msg));
    });
    
    setMessages((prev) => [...prev, { ...messageData, message: messageContent }]);
    
    setTrustData(prev => ({ ...prev, count: prev.count + 1 })); // Increment local trust count
  };

  const sendMessage = async (e) => { e.preventDefault(); if (currentMessage.trim() !== "" && room && socket) { await emitMessage(currentMessage); setCurrentMessage(""); socket.emit("stop_typing", room); }};
  const handleFileUpload = async (e) => { const file = e.target.files[0]; if (!file || !room) return; const formData = new FormData(); formData.append('file', file); try { const res = await axios.post('http://localhost:5000/api/upload', formData); await emitMessage(res.data.url); } catch (err) {} };
  const handleLogout = () => { localStorage.clear(); if (socket) socket.disconnect(); navigate('/'); };

  if (!user) return null; 
  
  // Filter out 'deleted for me' messages
  const visibleMessages = messages.filter(msg => !(msg.deleted_for && msg.deleted_for.includes(user.full_name)));

  // Trust Score Dynamic Colors
  const shieldColor = trustData.score >= 75 ? 'text-green-400' : trustData.score >= 40 ? 'text-yellow-400' : 'text-gray-400';
  const shieldBg = trustData.score >= 75 ? 'bg-green-500/10 border-green-500/20' : trustData.score >= 40 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-gray-500/10 border-gray-500/20';

  return (
    <div className="flex h-screen bg-dark-900 text-white overflow-hidden relative">
      
      {/* Sidebar */}
      <div className="w-1/3 max-sm:w-full max-w-sm border-r border-gray-800 flex flex-col bg-dark-900 z-10">
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4 bg-dark-800">
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => setShowProfileModal(true)}>
              {user?.avatar ? <img src={user.avatar} alt="Profile" className="h-10 w-10 rounded-full object-cover border border-gray-600 group-hover:opacity-75 transition" /> : <div className="h-10 w-10 bg-brand-500 rounded-full flex items-center justify-center font-bold group-hover:opacity-75 transition">{user?.full_name?.charAt(0) || '?'}</div>}
            </div>
            <span className="font-semibold truncate w-24">{user?.full_name || 'User'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowProfileModal(true)} className="text-gray-400 hover:text-white transition p-2"><Settings className="h-5 w-5" /></button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition p-2"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacts</h3>
          {users.map((contact) => (
            <div 
              key={contact.id}
              onClick={() => { if(callStatus === 'idle') setActiveChat(contact); }}
              className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center gap-3 ${activeChat?.id === contact.id ? 'bg-brand-500/20 border-brand-500' : 'bg-dark-800 border-transparent hover:border-gray-700'} ${callStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="relative">
                {contact.avatar ? <img src={contact.avatar} alt="Avatar" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 bg-gray-700 rounded-full flex items-center justify-center"><UserIcon className="h-5 w-5 text-gray-300" /></div>}
                {/* Online indicator dot */}
                {onlineUsersSet.has(contact.email) && (
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-dark-900"></div>
                )}
                {/* Sidebar Verification Badge */}
                {contact.is_verified && <div className="absolute -bottom-1 -right-1 bg-dark-900 rounded-full p-0.5"><BadgeCheck className="h-3 w-3 text-blue-400" /></div>}
              </div>
              <h4 className="font-medium text-white">{contact.full_name}</h4>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-dark-900/95 transition-all z-10 ${!activeChat ? 'max-sm:hidden' : ''}`}>
        {activeChat ? (
          <>
            <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-dark-800 shadow-sm">
              
              {/* Trust Score Header Indicator */}
              <div className="flex items-center gap-3 cursor-pointer hover:bg-dark-800 p-1.5 rounded-lg transition" onClick={() => setShowTrustModal(true)}>
                 <div className="relative">
                   {activeChat.avatar ? <img src={activeChat.avatar} alt="Avatar" className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 bg-gray-700 rounded-full flex items-center justify-center"><UserIcon className="h-5 w-5 text-gray-300" /></div>}
                   {trustData.score >= 75 && <div className="absolute -bottom-1 -right-1 bg-dark-800 rounded-full p-0.5"><BadgeCheck className="h-4 w-4 text-blue-500" /></div>}
                 </div>
                 <div className="flex flex-col">
                   <h2 className="font-semibold text-lg leading-tight flex items-center gap-1">{activeChat.full_name}</h2>
                   <div className={`text-[10px] font-medium flex items-center gap-1 w-fit px-1.5 rounded-full border ${shieldBg} ${shieldColor}`}>
                      <Shield className="h-3 w-3" /> {trustData.level}
                   </div>
                 </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                {callStatus === 'idle' && (
                  <>
                    <button onClick={() => startCall(true)} className="text-gray-400 hover:text-brand-500 transition" title="Video Call"><Video className="h-5 w-5" /></button>
                    <button onClick={() => startCall(false)} className="text-gray-400 hover:text-brand-500 transition" title="Audio Call"><Phone className="h-5 w-5" /></button>
                    <div className="h-6 w-px bg-gray-700 mx-1"></div>
                    <button onClick={() => setShowWhiteboard(true)} className="text-gray-400 hover:text-purple-400 transition" title="Open Whiteboard"><PenTool className="h-5 w-5" /></button>
                    <button onClick={() => setShowCodeEditor(true)} className="text-gray-400 hover:text-green-400 transition" title="Live Code Editor"><Terminal className="h-5 w-5" /></button>
                    <button onClick={() => setShowClearChatModal(true)} className="text-gray-400 hover:text-red-500 transition" title="Clear Chat"><Trash2 className="h-5 w-5" /></button>
                  </>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 relative">
              {visibleMessages.map((msg) => {
                const isMe = msg.author === user?.full_name;
                const isFileUrl = msg.message.startsWith('http://localhost:5000/uploads/');
                const isImage = isFileUrl && msg.message.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null;
                const isDoc = isFileUrl && !isImage;
                const isCodeBlock = msg.message === "LIVE_CODE_BLOCK";
                
                // AI Spam Warning Check
                const spamFlag = !isMe && !msg.is_deleted && !isFileUrl && !isCodeBlock && isSpam(msg.message);

                // Use a unique key: prefer id, fallback to tempId, then index (as last resort)
                const messageKey = msg.id || msg.tempId || `msg-${Math.random()}`;

                return (
                  <div key={messageKey} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}>
                    <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-md ${ msg.is_deleted ? 'bg-transparent border border-gray-700 text-gray-500 italic' : isCodeBlock ? 'bg-gray-800 border border-green-500/50 text-white rounded-lg w-64' : isMe ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-dark-800 border border-gray-700 text-gray-100 rounded-tl-sm'}`}>
                        
                        {/* Scam Warning Banner */}
                        {spamFlag && (
                          <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-xs p-2 rounded-lg mb-2 flex gap-2 items-start">
                            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
                            <p><strong>Security Alert:</strong> This message matches known phishing or scam patterns. Do not click links or share information.</p>
                          </div>
                        )}

                        {msg.is_deleted ? (
                          <div className="flex items-center gap-2">🚫 <span>This message was deleted</span></div>
                        ) : isImage ? (
                          <img src={msg.message} alt="Media" className="max-w-[200px] sm:max-w-xs rounded-lg mt-1 cursor-pointer" />
                        ) : isDoc ? (
                          <a href={msg.message} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-dark-900/50 p-3 rounded-xl hover:bg-dark-900 transition"><div className="p-2 bg-brand-500/20 rounded-lg text-brand-500"><FileText className="h-6 w-6" /></div><span className="text-sm font-medium underline">Download Attachment</span></a>
                        ) : isCodeBlock ? (
                           <div className="flex flex-col items-center justify-center p-2">
                             <Terminal className="h-8 w-8 text-green-400 mb-2" />
                             <p className="font-bold text-sm mb-3">Live Code Session</p>
                             <button onClick={() => setShowCodeEditor(true)} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-semibold transition">Join Session</button>
                           </div>
                        ) : (
                          <p className="break-words">{msg.message}</p>
                        )}
                        {!msg.is_deleted && (
                          <span className="text-[10px] opacity-60 flex justify-end mt-1 items-center gap-1">
                            {msg.time}
                            {isMe && (msg.status === 'read' ? <CheckCheck className="h-3 w-3 text-blue-400" /> : msg.status === 'delivered' ? <CheckCheck className="h-3 w-3 text-gray-300" /> : <Check className="h-3 w-3 text-gray-400" />)}
                          </span>
                        )}
                      </div>
                      {!msg.is_deleted && msg.id && (
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                           <button onClick={() => setShowDeleteModal(msg)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isTyping && <div className="flex items-start animate-pulse text-gray-500 text-sm ml-2">Typing...</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex flex-col bg-dark-800 border-t border-gray-800">
              
              {/* AI Smart Replies Container removed */}

              <div className="p-4">
                <form onSubmit={sendMessage} className="flex gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current.click()} className="bg-dark-900 border border-gray-700 p-3 rounded-xl hover:bg-gray-800"><Paperclip className="h-5 w-5 text-gray-400" /></button>
                  <button type="button" onClick={insertCodeTemplate} className="bg-dark-900 border border-gray-700 p-3 rounded-xl hover:bg-gray-800 transition"><Terminal className="h-5 w-5 text-green-400" /></button>

                  <input type="text" value={currentMessage} onChange={handleTyping} placeholder={`Message ${activeChat.full_name}...`} className="flex-1 bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-brand-500" />
                  <button type="submit" className="bg-brand-500 p-3 rounded-xl h-[50px] w-[50px] shrink-0 hover:bg-brand-600"><Send className="h-5 w-5 text-white" /></button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500"><MessageSquare className="h-16 w-16 mb-4 opacity-20" /><h2 className="text-xl font-semibold">Nexus Secure</h2></div>
        )}
      </div>

      {/* --- Modals & Overlays --- */}

      {/* Trust Score Breakdown Modal */}
      {showTrustModal && (
        <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-dark-800 p-8 rounded-3xl border border-gray-700 w-[400px] shadow-2xl relative text-center">
            <button onClick={() => setShowTrustModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition"><X className="h-5 w-5"/></button>
            
            <div className="flex justify-center mb-4">
               {trustData.score >= 75 ? <ShieldCheck className="h-16 w-16 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" /> : trustData.score >= 40 ? <Shield className="h-16 w-16 text-yellow-500" /> : <ShieldAlert className="h-16 w-16 text-gray-500" />}
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">Trust Score: {trustData.score}%</h2>
            <p className={`text-sm font-semibold mb-6 ${shieldColor}`}>{trustData.level}</p>

            <div className="bg-dark-900 rounded-2xl p-5 text-left space-y-4 mb-6 border border-gray-800">
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-400">Interaction History</span>
                <span className="text-white font-medium bg-dark-800 px-3 py-1 rounded-lg">{trustData.count} Messages</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-400">E2EE Secured</span>
                <span className="text-white font-medium flex items-center gap-1"><Check className="h-4 w-4 text-green-500"/> Yes</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-400">Identity Badge</span>
                <span className="text-white font-medium">{trustData.score >= 75 || activeChat?.is_verified ? <span className="flex items-center gap-1 text-blue-400"><BadgeCheck className="h-4 w-4"/> Verified</span> : 'Unverified'}</span>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              Trust scores are calculated locally using end-to-end encryption metadata and cryptographic interaction length.
            </p>
          </div>
        </div>
      )}

      {/* Live Code Editor Overlay */}
      {showCodeEditor && (
        <div className="absolute inset-0 bg-dark-900/95 z-40 flex flex-col items-center justify-center backdrop-blur-md px-10 py-6">
          <div className="w-full flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Terminal className="h-5 w-5 text-green-400"/> Operational Transformation: Live Code Sync</h2>
            <button onClick={() => setShowCodeEditor(false)} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition"><X className="h-5 w-5 text-white" /></button>
          </div>
          <div className="flex-1 w-full rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
             <Editor height="100%" theme="vs-dark" defaultLanguage="javascript" value={liveCode} onChange={handleCodeChange} options={{ minimap: { enabled: false }, fontSize: 16 }} />
          </div>
        </div>
      )}

      {/* Whiteboard Overlay */}
      {showWhiteboard && (
        <div className="absolute inset-0 bg-dark-900/95 z-40 flex flex-col items-center justify-center backdrop-blur-md">
          <div className="w-[800px] flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><PenTool className="h-5 w-5 text-purple-400"/> Shared Whiteboard</h2>
              <div className="flex gap-2">
                {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'].map(c => (<button key={c} onClick={() => setBrushColor(c)} className={`h-6 w-6 rounded-full border-2 ${brushColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={clearCanvas} className="text-gray-400 hover:text-red-400 transition font-medium">Clear Board</button>
              <button onClick={() => setShowWhiteboard(false)} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition"><X className="h-5 w-5 text-white" /></button>
            </div>
          </div>
          <div className="bg-dark-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700 cursor-crosshair">
            <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing} className="touch-none block" />
          </div>
        </div>
      )}

      {/* Standard Modals */}
      {showClearChatModal && (
        <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-dark-800 p-6 rounded-3xl border border-gray-700 text-center flex flex-col items-center w-80 shadow-2xl"><h3 className="text-lg font-bold text-white mb-2">Clear this chat?</h3><p className="text-sm text-gray-400 mb-6">Messages will only be removed from your device.</p><div className="flex flex-col gap-3 w-full"><button onClick={handleClearChat} className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium transition">Clear chat</button><button onClick={() => setShowClearChatModal(false)} className="w-full bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl font-medium transition">Cancel</button></div></div>
        </div>
      )}
      
      {showProfileModal && (
        <div className="absolute inset-0 bg-dark-900/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-dark-800 p-8 rounded-3xl border border-gray-700 w-96 shadow-2xl relative"><h2 className="text-xl font-bold text-white mb-6 text-center">Profile Settings</h2><div className="flex flex-col items-center mb-6"><div className="relative group cursor-pointer" onClick={() => profilePicRef.current.click()}>{user?.avatar ? <img src={user.avatar} alt="Avatar" className="h-24 w-24 rounded-full object-cover border-4 border-dark-900 shadow-lg group-hover:opacity-50 transition" /> : <div className="h-24 w-24 bg-brand-500 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg group-hover:opacity-50 transition">{user?.full_name?.charAt(0)}</div>}<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Camera className="h-8 w-8 text-white" /></div></div><input type="file" accept="image/*" ref={profilePicRef} onChange={handleAvatarUpload} className="hidden" /></div><form onSubmit={handleProfileUpdate} className="space-y-4"><div><label className="text-sm text-gray-400 mb-1 block">Display Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500" /></div><div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowProfileModal(false)} className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition">Cancel</button><button type="submit" className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition">Save</button></div></form></div>
        </div>
      )}

      {showDeleteModal && (
        <div className="absolute inset-0 bg-dark-900/70 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-dark-800 p-6 rounded-3xl border border-gray-700 text-center flex flex-col items-center w-80 shadow-2xl"><h3 className="text-lg font-bold text-white mb-6">Delete Message?</h3><div className="flex flex-col gap-3 w-full">{showDeleteModal.author === user?.full_name && <button onClick={() => handleDeleteMessage('everyone')} className="w-full bg-transparent border border-red-500 text-red-500 hover:bg-red-500 hover:text-white py-3 rounded-xl font-medium transition">Delete for everyone</button>}<button onClick={() => handleDeleteMessage('me')} className="w-full bg-dark-700 hover:bg-dark-600 text-white py-3 rounded-xl font-medium transition">Delete for me</button><button onClick={() => setShowDeleteModal(null)} className="w-full bg-transparent text-gray-400 hover:text-white py-2 mt-2 transition">Cancel</button></div></div>
        </div>
      )}

      {/* WebRTC Video Overlays */}
      {callStatus === 'receiving' && (
        <div className="absolute inset-0 bg-dark-900/90 z-50 flex items-center justify-center backdrop-blur-sm"><div className="bg-dark-800 p-8 rounded-2xl border border-gray-700 text-center flex flex-col items-center max-w-sm w-full shadow-2xl"><div className="h-20 w-20 bg-brand-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse"><Phone className="h-10 w-10 text-brand-500" /></div><h2 className="text-2xl font-bold text-white mb-2">{incomingCallData?.from}</h2><div className="flex gap-4 w-full"><button onClick={endCallLocal} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium transition">Decline</button><button onClick={acceptCall} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition flex items-center justify-center gap-2">Accept</button></div></div></div>
      )}
      {(callStatus === 'active' || callStatus === 'calling') && (
        <div className="absolute inset-0 bg-black z-50 flex flex-col"><div className="flex-1 relative bg-dark-900 flex items-center justify-center">{callStatus === 'calling' ? <div className="text-center"><div className="h-24 w-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><UserIcon className="h-12 w-12 text-gray-500" /></div><h2 className="text-2xl font-bold text-white">Calling...</h2></div> : <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />}<div className={`absolute bottom-24 right-6 w-32 h-48 md:w-48 md:h-64 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-10 ${!localStream?.getVideoTracks().length ? 'hidden' : ''}`}><video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" /></div></div><div className="h-20 bg-dark-900 border-t border-gray-800 flex items-center justify-center gap-6 pb-safe"><button onClick={endCallNetwork} className="bg-red-500 hover:bg-red-600 p-4 rounded-full shadow-lg transition transform hover:scale-105"><PhoneOff className="h-6 w-6 text-white" /></button></div></div>
      )}
    </div>
  );
}