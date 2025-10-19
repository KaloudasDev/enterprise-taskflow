const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'enterprise-taskflow-pro-5.0-secure-key-2024-' + Math.random().toString(36).substring(2);
const SALT_ROUNDS = 12;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        cb(null, uniqueSuffix + '-' + safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.py'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (dangerousExtensions.includes(fileExtension)) {
            return cb(new Error('File type not allowed'), false);
        }
        
        cb(null, true);
    }
});

let db;

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database('./taskflow.db', (err) => {
            if (err) {
                console.error('Database connection error:', err);
                reject(err);
                return;
            }
            console.log('Database connected');
            createTables().then(resolve).catch(reject);
        });
    });
}

function createTables() {
    return new Promise((resolve, reject) => {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'employee',
                department VARCHAR(100),
                position VARCHAR(100),
                avatar_url TEXT,
                phone VARCHAR(20),
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                created_by INTEGER,
                login_attempts INTEGER DEFAULT 0,
                locked_until DATETIME,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,

            `CREATE TABLE IF NOT EXISTS user_profiles (
                user_id INTEGER PRIMARY KEY,
                bio TEXT,
                skills TEXT,
                timezone VARCHAR(50) DEFAULT 'UTC',
                language VARCHAR(10) DEFAULT 'en',
                notifications_enabled BOOLEAN DEFAULT 1,
                theme VARCHAR(20) DEFAULT 'dark',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(500) NOT NULL,
                description TEXT,
                priority VARCHAR(20) DEFAULT 'medium',
                status VARCHAR(20) DEFAULT 'pending',
                due_date DATE,
                assignee_id INTEGER,
                created_by INTEGER NOT NULL,
                estimated_hours DECIMAL(5,2),
                actual_hours DECIMAL(5,2),
                progress INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (assignee_id) REFERENCES users(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`,

            `CREATE TABLE IF NOT EXISTS task_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                comment TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            `CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                activity_type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            `CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT NOT NULL UNIQUE,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_revoked BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,

            `CREATE TABLE IF NOT EXISTS role_permissions (
                role VARCHAR(50) PRIMARY KEY,
                permissions TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name VARCHAR(500) NOT NULL,
                stored_name VARCHAR(500) NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_type VARCHAR(100) NOT NULL,
                uploaded_by INTEGER NOT NULL,
                uploaded_by_name VARCHAR(255) NOT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_public BOOLEAN DEFAULT 1,
                FOREIGN KEY (uploaded_by) REFERENCES users(id)
            )`
        ];

        function executeTable(index) {
            if (index >= tables.length) {
                createDefaultData().then(resolve).catch(reject);
                return;
            }

            db.run(tables[index], (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    reject(err);
                    return;
                }
                executeTable(index + 1);
            });
        }

        executeTable(0);
    });
}

function createDefaultData() {
    return new Promise((resolve, reject) => {
        db.get("SELECT id FROM users WHERE email = 'admin@taskflow.com'", async (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (!row) {
                try {
                    const passwordHash = await bcrypt.hash('Admin123!', SALT_ROUNDS);
                    
                    db.run(
                        `INSERT INTO users (email, password_hash, name, role, avatar_url, department, position) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            'admin@taskflow.com', 
                            passwordHash, 
                            'System Administrator', 
                            'admin',
                            'https://i.imgur.com/RpGGkQ1.png',
                            'Management',
                            'System Manager'
                        ],
                        function(err) {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const adminUserId = this.lastID;

                            db.run(
                                `INSERT INTO user_profiles (user_id) VALUES (?)`,
                                [adminUserId],
                                (err) => {
                                    if (err) console.error('Profile creation error:', err);
                                    
                                    const defaultPermissions = {
                                        admin: {
                                            create_task: true,
                                            edit_task: true,
                                            delete_task: true,
                                            view_users: true,
                                            add_users: true,
                                            edit_users: true,
                                            remove_users: true,
                                            view_activity_logs: true,
                                            upload_files: true,
                                            download_files: true,
                                            delete_files: true
                                        },
                                        manager: {
                                            create_task: true,
                                            edit_task: true,
                                            delete_task: false,
                                            view_users: true,
                                            add_users: false,
                                            edit_users: false,
                                            remove_users: false,
                                            view_activity_logs: true,
                                            upload_files: true,
                                            download_files: true,
                                            delete_files: true
                                        },
                                        employee: {
                                            create_task: false,
                                            edit_task: true,
                                            delete_task: false,
                                            view_users: false,
                                            add_users: false,
                                            edit_users: false,
                                            remove_users: false,
                                            view_activity_logs: false,
                                            upload_files: true,
                                            download_files: true,
                                            delete_files: false
                                        }
                                    };

                                    Object.entries(defaultPermissions).forEach(([role, permissions]) => {
                                        db.run(
                                            `INSERT OR REPLACE INTO role_permissions (role, permissions) VALUES (?, ?)`,
                                            [role, JSON.stringify(permissions)],
                                            (err) => {
                                                if (err) console.error('Permission creation error:', err);
                                            }
                                        );
                                    });

                                    const sampleTasks = [
                                        {
                                            title: 'Welcome to Enterprise TaskFlow',
                                            description: 'Explore the system features and get familiar with the interface',
                                            priority: 'medium',
                                            status: 'completed',
                                            due_date: new Date().toISOString().split('T')[0],
                                            assignee_id: adminUserId,
                                            created_by: adminUserId,
                                            estimated_hours: 2
                                        },
                                        {
                                            title: 'Set up user permissions',
                                            description: 'Configure role-based permissions for team members',
                                            priority: 'high',
                                            status: 'in-progress',
                                            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                            assignee_id: adminUserId,
                                            created_by: adminUserId,
                                            estimated_hours: 4
                                        },
                                        {
                                            title: 'Review system documentation',
                                            description: 'Read through the system documentation and best practices',
                                            priority: 'low',
                                            status: 'pending',
                                            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                            assignee_id: adminUserId,
                                            created_by: adminUserId,
                                            estimated_hours: 1
                                        }
                                    ];

                                    sampleTasks.forEach(task => {
                                        db.run(
                                            `INSERT INTO tasks (title, description, priority, status, due_date, assignee_id, created_by, estimated_hours)
                                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                                            [task.title, task.description, task.priority, task.status, task.due_date, task.assignee_id, task.created_by, task.estimated_hours]
                                        );
                                    });

                                    console.log('Admin user, default permissions, and sample tasks created');
                                    resolve();
                                }
                            );
                        }
                    );
                } catch (error) {
                    reject(error);
                }
            } else {
                console.log('Admin user exists');
                resolve();
            }
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await dbGet(
            `SELECT id, email, name, role, department, position, avatar_url, is_active 
             FROM users WHERE id = ? AND is_active = 1`,
            [decoded.userId]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const logActivity = async (userId, activityType, description, ipAddress = null, userAgent = null) => {
    try {
        await dbRun(
            `INSERT INTO activity_logs (user_id, activity_type, description, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, activityType, description, ipAddress, userAgent]
        );
    } catch (error) {
        console.error('Activity logging error:', error);
    }
};

app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('User-Agent');

        const user = await dbGet(
            `SELECT id, email, password_hash, name, role, department, position, avatar_url, is_active, login_attempts, locked_until
             FROM users WHERE email = ?`,
            [email]
        );

        if (!user) {
            await logActivity(null, 'login_failed', `Failed login attempt for email: ${email}`, ipAddress, userAgent);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(423).json({ error: 'Account temporarily locked. Please try again later.' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            const newAttempts = user.login_attempts + 1;
            let lockedUntil = null;
            
            if (newAttempts >= 5) {
                lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
            }

            await dbRun(
                'UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?',
                [newAttempts, lockedUntil, user.id]
            );

            await logActivity(user.id, 'login_failed', `Failed login attempt for user: ${user.name}`, ipAddress, userAgent);

            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await dbRun(
            'UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        await logActivity(user.id, 'login', `User ${user.name} logged in`, ipAddress, userAgent);

        const { password_hash, login_attempts, locked_until, ...userWithoutPassword } = user;
        
        res.json({
            success: true,
            token,
            user: userWithoutPassword,
            message: 'Login successful'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'System error' });
    }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        await logActivity(req.user.id, 'logout', `User ${req.user.name} logged out`, req.ip, req.get('User-Agent'));
        
        res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'System error' });
    }
});

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await dbAll(`
            SELECT u.id, u.email, u.name, u.role, u.department, u.position, u.avatar_url, u.phone,
                   u.is_active, u.created_at, u.last_login
            FROM users u
            ORDER BY u.created_at DESC
        `);
        
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
});

app.post('/api/users', authenticateToken, requireAdmin, [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').notEmpty(),
    body('role').isIn(['admin', 'manager', 'employee'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, name, role, department, position, phone, avatar_url } = req.body;

        if (role === 'admin') {
            const existingAdmin = await dbGet('SELECT id FROM users WHERE role = ?', ['admin']);
            if (existingAdmin) {
                return res.status(400).json({ error: 'Only one administrator account is allowed in the system' });
            }
        }

        const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await dbRun(
            `INSERT INTO users (email, password_hash, name, role, department, position, phone, avatar_url, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, passwordHash, name, role, department, position, phone, avatar_url || 'https://i.imgur.com/RpGGkQ1.png', req.user.id]
        );

        await dbRun(`INSERT INTO user_profiles (user_id) VALUES (?)`, [result.id]);

        const newUser = await dbGet(
            `SELECT id, email, name, role, department, position, avatar_url, phone, is_active, created_at
             FROM users WHERE id = ?`,
            [result.id]
        );

        await logActivity(req.user.id, 'user_created', `User ${name} created by ${req.user.name}`);

        res.status(201).json({
            success: true,
            data: newUser,
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/users/:id', authenticateToken, requireAdmin, [
    body('name').notEmpty(),
    body('role').isIn(['admin', 'manager', 'employee'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, role, department, position, phone, avatar_url, is_active } = req.body;
        const userId = req.params.id;

        if (userId == req.user.id && (role !== 'admin' || is_active === false)) {
            return res.status(400).json({ error: 'Cannot modify your own admin role or deactivate your own account' });
        }

        if (role === 'admin') {
            const existingAdmin = await dbGet('SELECT id FROM users WHERE role = ? AND id != ?', ['admin', userId]);
            if (existingAdmin) {
                return res.status(400).json({ error: 'Only one administrator account is allowed in the system' });
            }
        }

        await dbRun(
            `UPDATE users 
             SET name = ?, role = ?, department = ?, position = ?, phone = ?, avatar_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, role, department, position, phone, avatar_url, is_active, userId]
        );

        const updatedUser = await dbGet(
            `SELECT id, email, name, role, department, position, avatar_url, phone, is_active, created_at
             FROM users WHERE id = ?`,
            [userId]
        );

        await logActivity(req.user.id, 'user_updated', `User ${name} updated by ${req.user.name}`);

        res.json({
            success: true,
            data: updatedUser,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('User update error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
                SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN status != 'completed' AND due_date < date('now') THEN 1 ELSE 0 END) as overdue_tasks
            FROM tasks
        `;

        let params = [];

        if (req.user.role === 'employee') {
            query += ' WHERE assignee_id = ? OR created_by = ?';
            params.push(req.user.id, req.user.id);
        }

        const stats = await dbGet(query, params);

        const safeStats = {
            total_tasks: stats.total_tasks || 0,
            pending_tasks: stats.pending_tasks || 0,
            in_progress_tasks: stats.in_progress_tasks || 0,
            completed_tasks: stats.completed_tasks || 0,
            overdue_tasks: stats.overdue_tasks || 0
        };

        let recentTasksQuery = `
            SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
        `;
        let recentTasksParams = [];

        if (req.user.role === 'employee') {
            recentTasksQuery += ' WHERE (t.assignee_id = ? OR t.created_by = ?)';
            recentTasksParams.push(req.user.id, req.user.id);
        }

        recentTasksQuery += ' ORDER BY t.created_at DESC LIMIT 5';
        const recentTasks = await dbAll(recentTasksQuery, recentTasksParams);

        res.json({
            success: true,
            data: {
                stats: safeStats,
                recentTasks: recentTasks || []
            }
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const { status, priority, assignee } = req.query;

        let query = `
            SELECT t.*, 
                   u_assignee.name as assignee_name,
                   u_assignee.avatar_url as assignee_avatar,
                   u_creator.name as creator_name
            FROM tasks t
            LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
            LEFT JOIN users u_creator ON t.created_by = u_creator.id
        `;
        
        let whereClauses = [];
        let params = [];

        if (req.user.role === 'employee') {
            whereClauses.push('(t.assignee_id = ? OR t.created_by = ?)');
            params.push(req.user.id, req.user.id);
        }

        if (status) {
            whereClauses.push('t.status = ?');
            params.push(status);
        }

        if (priority) {
            whereClauses.push('t.priority = ?');
            params.push(priority);
        }

        if (assignee) {
            whereClauses.push('t.assignee_id = ?');
            params.push(assignee);
        }

        if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
        }

        query += ' ORDER BY t.created_at DESC';

        const tasks = await dbAll(query, params);
        
        res.json({
            success: true,
            data: tasks
        });

    } catch (error) {
        console.error('Tasks fetch error:', error);
        res.status(500).json({ error: 'Failed to load tasks' });
    }
});

app.post('/api/tasks', authenticateToken, [
    body('title').notEmpty(),
    body('priority').isIn(['low', 'medium', 'high']),
    body('due_date').isDate()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, priority, status, due_date, assignee_id, estimated_hours, actual_hours } = req.body;

        const result = await dbRun(
            `INSERT INTO tasks (title, description, priority, status, due_date, assignee_id, created_by, estimated_hours, actual_hours)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, priority, status || 'pending', due_date, assignee_id, req.user.id, estimated_hours, actual_hours]
        );

        const newTask = await dbGet(`
            SELECT t.*, u.name as assignee_name, uc.name as creator_name
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            LEFT JOIN users uc ON t.created_by = uc.id
            WHERE t.id = ?
        `, [result.id]);

        await logActivity(req.user.id, 'task_created', `Task "${title}" created by ${req.user.name}`);

        res.status(201).json({
            success: true,
            data: newTask,
            message: 'Task created successfully'
        });

    } catch (error) {
        console.error('Task creation error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const { title, description, priority, status, due_date, assignee_id, estimated_hours, actual_hours } = req.body;
        const taskId = req.params.id;

        const existingTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (req.user.role === 'employee' && existingTask.assignee_id !== req.user.id && existingTask.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await dbRun(
            `UPDATE tasks 
             SET title = ?, description = ?, priority = ?, status = ?, due_date = ?, assignee_id = ?, 
                 estimated_hours = ?, actual_hours = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [title, description, priority, status, due_date, assignee_id, estimated_hours, actual_hours, taskId]
        );

        const updatedTask = await dbGet(`
            SELECT t.*, u.name as assignee_name, uc.name as creator_name
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            LEFT JOIN users uc ON t.created_by = uc.id
            WHERE t.id = ?
        `, [taskId]);

        await logActivity(req.user.id, 'task_updated', `Task "${title}" updated by ${req.user.name}`);

        res.json({
            success: true,
            data: updatedTask,
            message: 'Task updated successfully'
        });

    } catch (error) {
        console.error('Task update error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;

        const existingTask = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (req.user.role === 'employee' && existingTask.created_by !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await dbRun('DELETE FROM tasks WHERE id = ?', [taskId]);

        await logActivity(req.user.id, 'task_deleted', `Task "${existingTask.title}" deleted by ${req.user.name}`);

        res.json({ success: true, message: 'Task deleted successfully' });

    } catch (error) {
        console.error('Task delete error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const profile = await dbGet(`
            SELECT u.id, u.email, u.name, u.role, u.department, u.position, u.avatar_url, u.phone, u.created_at
            FROM users u
            WHERE u.id = ?
        `, [req.user.id]);

        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, department, position, phone } = req.body;

        await dbRun(
            `UPDATE users 
             SET name = ?, department = ?, position = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, department, position, phone, req.user.id]
        );

        const updatedProfile = await dbGet(`
            SELECT u.id, u.email, u.name, u.role, u.department, u.position, u.avatar_url, u.phone, u.created_at
            FROM users u
            WHERE u.id = ?
        `, [req.user.id]);

        await logActivity(req.user.id, 'profile_updated', `Profile updated by ${req.user.name}`);

        res.json({
            success: true,
            data: updatedProfile,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

app.put('/api/user/avatar', authenticateToken, async (req, res) => {
    try {
        const { avatar_url } = req.body;

        if (!avatar_url) {
            return res.status(400).json({ error: 'Avatar URL required' });
        }

        await dbRun(
            'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [avatar_url, req.user.id]
        );

        await logActivity(req.user.id, 'avatar_updated', `Avatar updated by ${req.user.name}`);

        res.json({ success: true, message: 'Avatar updated successfully' });
    } catch (error) {
        console.error('Avatar update error:', error);
        res.status(500).json({ error: 'Failed to update avatar' });
    }
});

app.put('/api/users/:id/password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.params.id;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        await dbRun(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [passwordHash, userId]
        );

        await logActivity(req.user.id, 'password_changed', `Password changed for user ${userId} by ${req.user.name}`);

        res.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { originalname, filename, path, size, mimetype } = req.file;

        const result = await dbRun(
            `INSERT INTO files (original_name, stored_name, file_path, file_size, file_type, uploaded_by, uploaded_by_name)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [originalname, filename, path, size, mimetype, req.user.id, req.user.name]
        );

        const newFile = await dbGet('SELECT * FROM files WHERE id = ?', [result.id]);

        await logActivity(req.user.id, 'file_uploaded', `File "${originalname}" uploaded by ${req.user.name}`);

        res.status(201).json({
            success: true,
            data: newFile,
            message: 'File uploaded successfully'
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

app.get('/api/files', authenticateToken, async (req, res) => {
    try {
        const files = await dbAll(`
            SELECT f.*, u.name as uploaded_by_name
            FROM files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            ORDER BY f.uploaded_at DESC
        `);

        res.json({ success: true, data: files });
    } catch (error) {
        console.error('Files fetch error:', error);
        res.status(500).json({ error: 'Failed to load files' });
    }
});

app.get('/api/files/:id/download', authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;
        const file = await dbGet('SELECT * FROM files WHERE id = ?', [fileId]);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (!fs.existsSync(file.file_path)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        await logActivity(req.user.id, 'file_downloaded', `File "${file.original_name}" downloaded by ${req.user.name}`);

        res.json({
            success: true,
            downloadUrl: `/uploads/${file.stored_name}`,
            message: 'Download URL generated'
        });

    } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

app.delete('/api/files/:id', authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;
        const file = await dbGet('SELECT * FROM files WHERE id = ?', [fileId]);

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (req.user.role !== 'admin' && file.uploaded_by !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (fs.existsSync(file.file_path)) {
            fs.unlinkSync(file.file_path);
        }

        await dbRun('DELETE FROM files WHERE id = ?', [fileId]);

        await logActivity(req.user.id, 'file_deleted', `File "${file.original_name}" deleted by ${req.user.name}`);

        res.json({ success: true, message: 'File deleted successfully' });

    } catch (error) {
        console.error('File delete error:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

app.get('/api/activities', authenticateToken, async (req, res) => {
    try {
        const userPermissions = await dbGet('SELECT permissions FROM role_permissions WHERE role = ?', [req.user.role]);
        
        if (userPermissions) {
            const permissions = JSON.parse(userPermissions.permissions);
            if (!permissions.view_activity_logs && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const activities = await dbAll(`
            SELECT al.*, u.name as user_name, u.role as user_role
            FROM activity_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 200
        `);

        res.json({ success: true, data: activities });
    } catch (error) {
        console.error('Activities fetch error:', error);
        res.status(500).json({ error: 'Failed to load activities' });
    }
});

app.post('/api/activities', authenticateToken, async (req, res) => {
    try {
        const { activity_type, description } = req.body;

        await logActivity(req.user.id, activity_type, description, req.ip, req.get('User-Agent'));

        res.json({ success: true, message: 'Activity logged successfully' });
    } catch (error) {
        console.error('Activity log error:', error);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

app.get('/api/reports', authenticateToken, async (req, res) => {
    try {
        const { period } = req.query;
        
        let dateFilter = '';
        switch (period) {
            case '7d':
                dateFilter = "AND created_at >= datetime('now', '-7 days')";
                break;
            case '30d':
                dateFilter = "AND created_at >= datetime('now', '-30 days')";
                break;
            case '90d':
                dateFilter = "AND created_at >= datetime('now', '-90 days')";
                break;
            case '1y':
                dateFilter = "AND created_at >= datetime('now', '-1 year')";
                break;
            default:
                dateFilter = "AND created_at >= datetime('now', '-30 days')";
        }

        const completionStats = await dbAll(`
            SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM tasks 
            WHERE created_at IS NOT NULL ${dateFilter}
            GROUP BY strftime('%Y-%m-%d', created_at)
            ORDER BY date DESC
            LIMIT 7
        `);

        const distributionStats = await dbGet(`
            SELECT 
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM tasks
            WHERE 1=1 ${dateFilter}
        `);

        const completionRate = completionStats.map(stat => 
            stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0
        ).reverse();

        const taskDistribution = [
            distributionStats.completed || 0,
            distributionStats.in_progress || 0,
            distributionStats.pending || 0
        ];

        const teamPerformance = await dbAll(`
            SELECT 
                u.name as member_name,
                COUNT(t.id) as total_tasks,
                SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
            FROM users u
            LEFT JOIN tasks t ON u.id = t.assignee_id
            WHERE u.is_active = 1 AND u.role IN ('employee', 'manager')
            GROUP BY u.id, u.name
            HAVING total_tasks > 0
        `);

        const teamStats = teamPerformance.map(member => ({
            member_name: member.member_name,
            completion_rate: Math.round((member.completed_tasks / member.total_tasks) * 100)
        }));

        res.json({
            success: true,
            data: {
                completionRate,
                taskDistribution,
                teamPerformance: teamStats
            }
        });

    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).json({ error: 'Failed to load reports' });
    }
});

app.get('/api/permissions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const permissions = await dbAll('SELECT * FROM role_permissions');
        
        const formattedPermissions = {};
        permissions.forEach(row => {
            formattedPermissions[row.role] = JSON.parse(row.permissions);
        });

        res.json({ success: true, data: formattedPermissions });
    } catch (error) {
        console.error('Permissions fetch error:', error);
        res.status(500).json({ error: 'Failed to load permissions' });
    }
});

app.put('/api/permissions', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role, permissions } = req.body;

        if (!role || !permissions) {
            return res.status(400).json({ error: 'Role and permissions are required' });
        }

        await dbRun(
            'INSERT OR REPLACE INTO role_permissions (role, permissions) VALUES (?, ?)',
            [role, JSON.stringify(permissions)]
        );

        await logActivity(req.user.id, 'permissions_updated', `Permissions updated for role ${role}`);

        res.json({ success: true, message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('Permissions update error:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

app.get('/api/health', authenticateToken, async (req, res) => {
    try {
        const dbStatus = await dbGet('SELECT 1 as status');
        const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
        const totalTasks = await dbGet('SELECT COUNT(*) as count FROM tasks');
        const totalFiles = await dbGet('SELECT COUNT(*) as count FROM files');
        
        res.json({
            success: true,
            data: {
                database: dbStatus ? 'connected' : 'disconnected',
                users: totalUsers.count,
                tasks: totalTasks.count,
                files: totalFiles.count,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log('');
        console.log('╔═════════════════════════════════════════════════╗');
        console.log('║           Enterprise TaskFlow Pro               ║');
        console.log('║               Server is running!                ║');
        console.log('╠═════════════════════════════════════════════════╣');
        console.log('║ Access: http://localhost:' + PORT + '                   ║');
        console.log('║                                                 ║');
        console.log('║ Default Admin Account:                          ║');
        console.log('║ • Email: admin@taskflow.com                     ║');
        console.log('║ • Password: Admin123!                           ║');
        console.log('║                                                 ║');
        console.log('╚═════════════════════════════════════════════════╝');
    });
}).catch((error) => {
    console.error('System startup error:', error);
    process.exit(1);
});
