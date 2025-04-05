import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import logger from '../utils/logger';

class SocketService {
  private io: SocketServer;
  private userSockets: Map<string, string[]> = new Map(); // משתמשים וה- socket ids שלהם

  constructor(io: SocketServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.use(async (socket, next) => {
      try {
        // בדיקת אימות באמצעות JWT
        const token = socket.handshake.auth.token as string;
        
        if (!token) {
          return next(new Error('חסר טוקן אימות'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
        const user = await User.findById(decoded.id).select('_id');
        
        if (!user) {
          return next(new Error('משתמש לא נמצא'));
        }
        
        // שמור את מזהה המשתמש בסוקט
        socket.data.userId = user._id.toString();
        next();
      } catch (error: any) {
        logger.error(`Socket authentication error: ${error.message}`);
        next(new Error('אימות נכשל'));
      }
    });

    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;
      logger.info(`User ${userId} connected with socket ${socket.id}`);
      
      // שמור את חיבור הסוקט של המשתמש
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)?.push(socket.id);

      // הרשמה לחדרים
      socket.on('join-list', (listId) => {
        socket.join(`list:${listId}`);
        logger.info(`User ${userId} joined list: ${listId}`);
      });

      // עזיבת חדרים
      socket.on('leave-list', (listId) => {
        socket.leave(`list:${listId}`);
        logger.info(`User ${userId} left list: ${listId}`);
      });

      // ניתוק
      socket.on('disconnect', () => {
        logger.info(`User ${userId} disconnected from socket ${socket.id}`);
        
        // הסר את הסוקט מהמשתמש
        const userSocketIds = this.userSockets.get(userId) || [];
        const updatedSocketIds = userSocketIds.filter(id => id !== socket.id);
        
        if (updatedSocketIds.length === 0) {
          this.userSockets.delete(userId);
        } else {
          this.userSockets.set(userId, updatedSocketIds);
        }
      });
    });
  }

  // שליחת עדכון על שינוי ברשימה
  public emitListUpdate(listId: string, action: string, data: any) {
    this.io.to(`list:${listId}`).emit('list-update', {
      action,
      data,
      timestamp: new Date(),
    });
    logger.info(`Emitted ${action} update for list ${listId}`);
  }

  // שליחת עדכון פריט ברשימה
  public emitItemUpdate(listId: string, action: string, data: any) {
    this.io.to(`list:${listId}`).emit('item-update', {
      action,
      data,
      timestamp: new Date(),
    });
    logger.info(`Emitted ${action} item update for list ${listId}`);
  }

  // שליחת הודעה פרטית למשתמש
  public emitToUser(userId: string, event: string, data: any) {
    const socketIds = this.userSockets.get(userId.toString());
    
    if (socketIds && socketIds.length > 0) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
      logger.info(`Emitted ${event} to user ${userId}`);
      return true;
    }
    
    logger.info(`User ${userId} not connected, could not emit ${event}`);
    return false;
  }

  // שליחת התראה למשתמש
  public emitNotification(userId: string, notification: any) {
    return this.emitToUser(userId, 'notification', notification);
  }
}

let socketService: SocketService;

// יצירת שירות הסוקט עם יצירת השרת
export const initSocketService = (io: SocketServer) => {
  socketService = new SocketService(io);
  return socketService;
};

// קבלת מופע קיים של שירות הסוקט
export const getSocketService = () => {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
};