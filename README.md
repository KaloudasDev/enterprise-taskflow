# TaskFlow Enterprise

![TaskFlow Enterprise](https://i.imgur.com/cC4Bc9I.png)

## Enterprise Task Management System

A full-stack task management solution built with modern web technologies. Features role-based access control, real-time analytics, and secure file management.

## Tech Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript
- Chart.js for analytics
- Font Awesome icons
- Inter font family

**Backend:**
- Node.js + Express.js
- SQLite3 database
- JWT authentication
- bcryptjs password hashing
- Multer for file uploads

**Security:**
- Helmet.js security headers
- Rate limiting
- CORS protection
- Input validation & sanitization

## Installation

```bash
# Clone repository
git clone <repository-url>
cd taskflow-enterprise

# Install dependencies
npm install

# Start server
npm start

# Access application
# http://localhost:3000
```

**Default Admin Account:**
- Email: `admin@taskflow.com`
- Password: `Admin123!`

## Project Structure

```
taskflow-enterprise/
├── index.html          # Main application
├── styles.css          # Complete styling
├── app.js              # Frontend logic
├── server.js           # Express server
├── package.json        # Dependencies
└── uploads/            # File storage
```

## Core Features

### Authentication System
- JWT-based authentication
- Role-based access (Admin/Manager/Employee)
- Session management with automatic logout
- Secure password hashing (bcrypt, 12 rounds)

### Task Management
```javascript
{
  id: number,
  title: string,
  description: string,
  priority: 'low' | 'medium' | 'high',
  status: 'pending' | 'in-progress' | 'completed',
  due_date: string,
  assignee_id: number,
  estimated_hours: number,
  actual_hours: number
}
```

### User Management
- Multi-role system with granular permissions
- Department and position tracking
- Active/inactive user status
- Profile management with avatars

### File System
- Secure file uploads (50MB max)
- File type validation
- Permission-based access control
- Download tracking

### Analytics
- Real-time dashboard metrics
- Task completion charts
- Team performance tracking
- Custom report periods

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  name VARCHAR(255),
  role VARCHAR(50),
  department VARCHAR(100),
  position VARCHAR(100),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tasks Table
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title VARCHAR(500),
  description TEXT,
  priority VARCHAR(20),
  status VARCHAR(20),
  due_date DATE,
  assignee_id INTEGER,
  created_by INTEGER,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Additional Tables
- `activity_logs` - Audit trail
- `files` - File metadata
- `role_permissions` - Permission configurations
- `user_sessions` - Active sessions

## API Endpoints

### Authentication
```javascript
POST   /api/auth/login     // User login
POST   /api/auth/logout    // User logout
```

### Tasks
```javascript
GET    /api/tasks          // List tasks
POST   /api/tasks          // Create task
PUT    /api/tasks/:id      // Update task
DELETE /api/tasks/:id      // Delete task
```

### Users
```javascript
GET    /api/users          // List users (Admin only)
POST   /api/users          // Create user (Admin only)
PUT    /api/users/:id      // Update user (Admin only)
```

### Files
```javascript
GET    /api/files          // List files
POST   /api/files/upload   // Upload file
GET    /api/files/:id/download  // Download file
DELETE /api/files/:id      // Delete file
```

### Analytics
```javascript
GET    /api/dashboard/stats    // Dashboard metrics
GET    /api/reports           // Analytics data
GET    /api/activities        // Activity logs
```

## Frontend Architecture

### Main Class Structure
```javascript
class TaskFlowEnterprise {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.users = [];
    this.tasks = [];
    this.files = [];
  }

  // Core methods
  initializeApp()
  handleLogin()
  loadTasks()
  loadUsers()
  loadDashboard()
  // ... more methods
}
```

### Key Components
- **Login System** - Secure authentication flow
- **Dashboard** - Real-time metrics and recent activities
- **Task Manager** - CRUD operations with filtering
- **User Management** - Role-based user administration
- **File Storage** - Secure file handling
- **Analytics** - Data visualization with Chart.js

---

## Configuration

### Environment Setup
```javascript
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(helmet());
app.use(cors());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));
```

### File Upload Configuration
```javascript
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + file.originalname;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Validate file types
    cb(null, true);
  }
});
```

## Security Implementation

### Authentication Middleware
```javascript
const authenticateToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

### Password Security
```javascript
const passwordHash = await bcrypt.hash(password, 12);

const validPassword = await bcrypt.compare(password, user.password_hash);
```

## Data Flow

### Task Creation Flow
1. User submits task form → Frontend validation
2. POST /api/tasks → Backend validation
3. Database insertion → Success response
4. Frontend updates UI → Activity log entry

### File Upload Flow
1. User selects file → Frontend validation
2. POST /api/files/upload → Multer processing
3. File metadata storage → Permission check
4. Success response → UI update

## Deployment

### Production Setup
```bash
# Set environment variables
export JWT_SECRET=your-production-secret
export NODE_ENV=production

# Start application
npm start
```

### Database Management
- Automatic SQLite database creation
- Schema versioning included
- Backup procedures recommended for production

## Development

### Adding New Features
1. Extend database schema if needed
2. Create API endpoints
3. Implement frontend components
4. Add permission checks
5. Update activity logging

### Code Standards
- ES6+ JavaScript features
- Modular function organization
- Comprehensive error handling
- Security-first implementation

## Performance Notes

- SQLite optimized with proper indexing
- Frontend uses efficient DOM updates
- File uploads streamed to disk
- JWT tokens for stateless authentication
- Rate limiting prevents abuse

## Troubleshooting

### Common Issues
- **Database locks**: Ensure proper connection handling
- **File upload fails**: Check uploads directory permissions
- **JWT errors**: Verify secret key consistency
- **CORS issues**: Review frontend-backend URL alignment

### Logs & Monitoring
- Activity logs track all user actions
- Error logging to console
- Performance metrics available
