const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const pool = require('./config/db');

dotenv.config();
const app = express();
const server = http.createServer(app); 

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions,
});

const onlineUsers = new Map(); 

io.on('connection', (socket) => {
  
  // BULLETPROOF ONLINE STATUS
  socket.on('register_user', (userEmail) => {
    if (!userEmail) return;
    const email = userEmail.toLowerCase();
    socket.data.email = email; 

    // Create a Set for this user if it doesn't exist
    if (!onlineUsers.has(email)) {
      onlineUsers.set(email, new Set());
    }

    const userSockets = onlineUsers.get(email);
    const wasOffline = userSockets.size === 0;

    // Add this specific browser connection ID
    userSockets.add(socket.id);

    // If they were completely offline before this, tell everyone they are online
    if (wasOffline) {
      socket.broadcast.emit('user_online', email);
    }

    // Tell the newly connected user who else is online
    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('disconnect', () => {
    const email = socket.data.email;
    if (!email) return;

    const userSockets = onlineUsers.get(email);
    if (userSockets) {
      // Remove this specific browser connection ID
      userSockets.delete(socket.id); 

      // If they have no more active tabs/connections open, completely log them out
      if (userSockets.size === 0) {
        onlineUsers.delete(email);
        socket.broadcast.emit('user_offline', email);
      }
    }
  });

  socket.on('join_room', (room_id) => socket.join(room_id));
  socket.on('leave_room', (room_id) => socket.leave(room_id));

  socket.on('send_message', async (data, callback) => {
    try {
      const result = await pool.query(
        'INSERT INTO messages (room_id, author, message, time, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [data.room, data.author, data.message, data.time, 'sent']
      );
      const savedMessage = result.rows[0];
      savedMessage.tempId = data.tempId; // Return tempId for frontend tracking
      
      if (callback) callback(savedMessage);
      socket.to(data.room).emit('receive_message', savedMessage);
    } catch (err) {
      console.error(err);
    }
  });

  // FIX: WHATSAPP LOGIC - Pass tempId back to sender to prevent race conditions
  socket.on('message_delivered', async ({ room, messageId, tempId }) => {
    if (!messageId || isNaN(messageId)) return;
    try {
      await pool.query("UPDATE messages SET status = 'delivered' WHERE id = $1 AND status = 'sent'", [messageId]);
      socket.to(room).emit('message_delivered', { id: messageId, tempId });
    } catch (err) {}
  });

  socket.on('message_read', async ({ room, messageId, tempId }) => {
    if (!messageId || isNaN(messageId)) return;
    try {
      await pool.query("UPDATE messages SET status = 'read' WHERE id = $1 AND status IN ('sent', 'delivered')", [messageId]);
      socket.to(room).emit('message_read', { id: messageId, tempId });
    } catch (err) {}
  });

  socket.on('delete_message', async ({ messageId, type, requester, room }) => {
    try {
      if (type === 'everyone') {
        await pool.query("UPDATE messages SET is_deleted = true, message = '[DELETED]' WHERE id = $1 AND author = $2", [messageId, requester]);
        socket.to(room).emit('message_deleted_everyone', messageId);
      } else if (type === 'me') {
        await pool.query("UPDATE messages SET deleted_for = array_append(COALESCE(deleted_for, '{}'), $2) WHERE id = $1", [messageId, requester]);
      }
    } catch (err) {}
  });

  socket.on('clear_chat', async ({ room, requester }) => {
    try {
      await pool.query("UPDATE messages SET deleted_for = array_append(COALESCE(deleted_for, '{}'), $2) WHERE room_id = $1", [room, requester]);
    } catch (err) {}
  });

  socket.on('code_update', ({ room, code }) => {
    socket.to(room).emit('receive_code_update', code);
  });

  socket.on('whiteboard_draw', ({ room, data }) => socket.to(room).emit('receive_whiteboard_draw', data));
  socket.on('whiteboard_clear', (room) => socket.to(room).emit('receive_whiteboard_clear'));

  socket.on('typing', (room) => socket.to(room).emit('user_typing'));
  socket.on('stop_typing', (room) => socket.to(room).emit('user_stopped_typing'));
  socket.on('call_user', (data) => socket.to(data.room).emit('incoming_call', { from: data.from, offer: data.offer, type: data.type }));
  socket.on('answer_call', (data) => socket.to(data.room).emit('call_accepted', data.answer));
  socket.on('ice_candidate', (data) => socket.to(data.room).emit('receive_ice_candidate', data.candidate));
  socket.on('end_call', (room) => socket.to(room).emit('call_ended'));
});

const PORT = process.env.PORT || 5000;

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(uploadDir)); 
app.use('/api/auth', authRoutes);

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
  res.json({ url: `${serverUrl}/uploads/${req.file.filename}` });
});

app.put('/api/users/profile', async (req, res) => {
  const { email, full_name, avatar } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET full_name = $1, avatar = $2 WHERE email = $3 RETURNING id, full_name, email, avatar', 
      [full_name, avatar, email]
    );
    res.json(result.rows[0]);
  } catch (err) { 
    res.status(500).json({ error: 'Failed to update profile' }); 
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, email, avatar, is_verified FROM users ORDER BY full_name ASC');
    res.json(result.rows);
  } catch (err) { 
    res.status(500).json({ error: 'Failed to fetch users' }); 
  }
});

app.get('/api/messages/:room_id', async (req, res) => {
  try {
    const { room_id } = req.params;
    const result = await pool.query("SELECT * FROM messages WHERE room_id = $1 ORDER BY id ASC", [room_id]);
    res.json(result.rows);
  } catch (err) { 
    res.status(500).json({ error: 'Failed to fetch messages' }); 
  }
});

app.get('/api/trust/:room_id', async (req, res) => {
  try {
    const { room_id } = req.params;
    const result = await pool.query('SELECT COUNT(*) FROM messages WHERE room_id = $1', [room_id]);
    const count = parseInt(result.rows[0].count, 10);
    
    let score = 10;
    let level = "New Contact";
    
    if (count > 50) { score = 98; level = "Highly Trusted"; }
    else if (count > 20) { score = 75; level = "Trusted"; }
    else if (count > 5) { score = 40; level = "Established"; }
    
    res.json({ score, level, count });
  } catch (err) { 
    res.status(500).json({ error: 'Failed to fetch trust score' }); 
  }
});

server.listen(PORT, () => console.log(`Nexus Backend running on port ${PORT}`));