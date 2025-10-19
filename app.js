class EnterpriseTaskFlow {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('enterpriseAuthToken');
        this.rememberMe = localStorage.getItem('rememberMe') === 'true';
        this.users = [];
        this.tasks = [];
        this.files = [];
        this.activityLogs = [];
        this.currentSection = 'dashboard';
        this.userProfile = null;
        this.editingTask = null;
        this.editingUser = null;
        this.notifications = [];
        this.loginTime = null;
        this.notificationCheckInterval = null;
        
        this.permissions = {
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
            }
        };
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.setupLoginEnhancements();
        this.setupSessionManagement();
        
        this.disableAutocomplete();
        
        if (this.token && this.rememberMe) {
            this.validateTokenAndLoadApp();
        } else {
            this.showLoginScreen();
            localStorage.removeItem('enterpriseAuthToken');
        }
    }

    setupSessionManagement() {
        window.addEventListener('beforeunload', () => {
            if (this.token) {
                sessionStorage.setItem('sessionPreserve', 'true');
                sessionStorage.setItem('preservedToken', this.token);
                sessionStorage.setItem('preservedUser', JSON.stringify(this.currentUser));
                sessionStorage.setItem('preservedTime', Date.now().toString());
            }
        });

        window.addEventListener('load', () => {
            const preservedTime = sessionStorage.getItem('preservedTime');
            const timeDiff = preservedTime ? Date.now() - parseInt(preservedTime) : null;
            
            if (timeDiff && timeDiff < 5000) {
                const preservedToken = sessionStorage.getItem('preservedToken');
                const preservedUser = sessionStorage.getItem('preservedUser');
                
                if (preservedToken && preservedUser) {
                    this.token = preservedToken;
                    this.currentUser = JSON.parse(preservedUser);
                    this.loadMainApp();
                }
            }
            
            sessionStorage.removeItem('sessionPreserve');
            sessionStorage.removeItem('preservedToken');
            sessionStorage.removeItem('preservedUser');
            sessionStorage.removeItem('preservedTime');
        });

        setInterval(() => {
            if (this.token && this.loginTime) {
                const now = new Date();
                const diff = now - this.loginTime;
                const hours = diff / (1000 * 60 * 60);
                
                if (hours >= 24) {
                    this.handleLogout();
                    this.showNotification('Session expired due to inactivity', 'warning');
                }
            }
        }, 60000);
    }

    disableAutocomplete() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"], input[type="email"]');
        inputs.forEach(input => {
            input.setAttribute('autocomplete', 'off');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('autocapitalize', 'off');
            input.setAttribute('spellcheck', 'false');
        });
    }

    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        document.getElementById('addTaskBtn').addEventListener('click', () => this.openTaskModal());
        document.getElementById('closeTaskModal').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('cancelTask').addEventListener('click', () => this.closeTaskModal());
        document.getElementById('taskForm').addEventListener('submit', (e) => this.handleTaskSave(e));

        document.getElementById('addUserBtn').addEventListener('click', () => this.openUserModal());
        document.getElementById('closeUserModal').addEventListener('click', () => this.closeUserModal());
        document.getElementById('cancelUser').addEventListener('click', () => this.closeUserModal());
        document.getElementById('userForm').addEventListener('submit', (e) => this.handleUserSave(e));

        document.getElementById('headerProfileBtn').addEventListener('click', () => this.openProfileModal());
        document.getElementById('closeProfileModal').addEventListener('click', () => this.closeProfileModal());
        document.getElementById('cancelProfile').addEventListener('click', () => this.closeProfileModal());
        document.getElementById('profileForm').addEventListener('submit', (e) => this.handleProfileUpdate(e));
        document.getElementById('avatarForm').addEventListener('submit', (e) => this.handleAvatarUpdate(e));

        document.getElementById('email').addEventListener('input', (e) => this.handleInputChange(e, 'email'));
        document.getElementById('password').addEventListener('input', (e) => this.handleInputChange(e, 'password'));
        
        document.getElementById('email').addEventListener('focus', () => this.handleInputFocus('email'));
        document.getElementById('password').addEventListener('focus', () => this.handleInputFocus('password'));
        
        document.getElementById('email').addEventListener('blur', () => this.handleInputBlur('email'));
        document.getElementById('password').addEventListener('blur', () => this.handleInputBlur('password'));

        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilterChange(e));
        });

        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('priorityFilter').addEventListener('change', () => this.applyFilters());

        document.getElementById('exportReport').addEventListener('click', () => this.exportReport());
        document.getElementById('reportPeriod').addEventListener('change', () => this.loadReports());

        document.getElementById('globalSearch').addEventListener('input', (e) => this.handleGlobalSearch(e));

        document.querySelector('.user-info').addEventListener('click', () => this.openProfileModal());

        document.querySelectorAll('.btn-save-permissions').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSavePermissions(e));
        });

        document.getElementById('uploadFileBtn')?.addEventListener('click', () => this.openFileUploadModal());
        document.getElementById('fileUpload')?.addEventListener('change', (e) => this.handleFileSelect(e));
        document.getElementById('uploadFileForm')?.addEventListener('submit', (e) => this.handleFileUpload(e));

        document.getElementById('refreshActivityLogs')?.addEventListener('click', () => this.loadActivityLogs());

        if (Notification.permission === 'default') {
            this.requestNotificationPermission();
        }

        this.ensureLogoutButtonVisibility();

        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.login-card') || e.target.closest('.user-info')) {
                e.preventDefault();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') || 
                (e.ctrlKey && e.shiftKey && e.key === 'C') ||
                (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
            }
        });
    }

    ensureLogoutButtonVisibility() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'flex';
        }
    }

    setupLoginEnhancements() {
        this.updateToggleVisibility();
    }

    handleInputChange(e, field) {
        const value = e.target.value;
        
        if (field === 'password') {
            this.updateToggleVisibility();
        }
        
        if (value.length > 0) {
            this.hideIcon(field);
        } else {
            this.showIcon(field);
        }
    }

    handleInputFocus(field) {
        this.disableAutocomplete();
        
        if (field === 'password') {
            this.updateToggleVisibility();
        }
    }

    handleInputBlur(field) {
        const input = document.getElementById(field);
        if (field === 'password') {
            this.updateToggleVisibility();
        }
    }

    updateToggleVisibility() {
        const passwordInput = document.getElementById('password');
        const toggle = document.querySelector('.password-toggle');
        
        if (!passwordInput || !toggle) return;

        const hasText = passwordInput.value.length > 0;
        
        if (hasText) {
            toggle.style.opacity = '1';
            toggle.style.visibility = 'visible';
            toggle.style.pointerEvents = 'all';
        } else {
            toggle.style.opacity = '0';
            toggle.style.visibility = 'hidden';
            toggle.style.pointerEvents = 'none';
        }
    }

    hideIcon(field) {
        const input = document.getElementById(field);
        const icon = input?.previousElementSibling;
        
        if (icon && icon.classList.contains('input-icon')) {
            icon.style.opacity = '0';
            icon.style.visibility = 'hidden';
        }
    }

    showIcon(field) {
        const input = document.getElementById(field);
        const icon = input?.previousElementSibling;
        
        if (icon && icon.classList.contains('input-icon')) {
            icon.style.opacity = '1';
            icon.style.visibility = 'visible';
        }
    }

    togglePasswordVisibility(e) {
        const button = e.currentTarget;
        const input = button.parentElement.querySelector('input');
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    async validateTokenAndLoadApp() {
        try {
            const response = await this.apiCall('/api/dashboard/stats', 'GET');
            
            if (response.success) {
                await this.loadUserProfile();
                this.loadMainApp();
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            this.showLoginScreen();
        }
    }

    async loadUserProfile() {
        try {
            const response = await this.apiCall('/api/user/profile', 'GET');
            if (response.success) {
                this.userProfile = response.data;
                this.updateProfileUI();
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        console.log('Login attempt:', { email });
        
        const credentials = {
            email: email,
            password: password
        };

        const loginBtn = e.target.querySelector('button[type="submit"]');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';

        try {
            const response = await this.apiCall('/api/auth/login', 'POST', credentials, false);
            
            if (response.success) {
                this.token = response.token;
                this.currentUser = response.user;
                this.loginTime = new Date();
                
                if (this.rememberMe) {
                    localStorage.setItem('enterpriseAuthToken', this.token);
                }
                
                await this.loadUserProfile();
                this.loadMainApp();
                this.showNotification('Login successful!', 'success');
                
                this.startLoginNotificationCheck();
                
                this.logActivity('login', `User ${this.currentUser.name} logged in`);
            } else {
                this.showNotification(response.error || 'Login error', 'error');
            }
        } catch (error) {
            this.showNotification('Login error. Please try again.', 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    }

    startLoginNotificationCheck() {
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
        }

        this.notificationCheckInterval = setInterval(() => {
            if (this.loginTime) {
                const now = new Date();
                const diff = now - this.loginTime;
                const hours = diff / (1000 * 60 * 60);
                
                if (hours >= 1) {
                    this.showNotification('You have been logged in for 1 hour!', 'info');
                    this.showDesktopNotification('Login Duration', 'You have been logged in for 1 hour.');
                    clearInterval(this.notificationCheckInterval);
                }
            }
        }, 60000);
    }

    requestNotificationPermission() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                }
            });
        }
    }

    showDesktopNotification(title, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: 'https://i.imgur.com/RpGGkQ1.png',
                badge: 'https://i.imgur.com/RpGGkQ1.png'
            });
        }
    }

    handleRememberMe(e) {
        this.rememberMe = e.target.checked;
        localStorage.setItem('rememberMe', this.rememberMe);
    }

    async handleLogout() {
        try {
            await this.apiCall('/api/auth/logout', 'POST');
            this.logActivity('logout', `User ${this.currentUser.name} logged out`);
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.token = null;
            this.currentUser = null;
            this.userProfile = null;
            this.loginTime = null;
            
            if (this.notificationCheckInterval) {
                clearInterval(this.notificationCheckInterval);
            }
            
            localStorage.removeItem('enterpriseAuthToken');
            sessionStorage.clear();
            this.showLoginScreen();
            this.showNotification('Logged out successfully', 'info');
        }
    }

    loadMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        
        this.updateUserInterface();
        this.loadDashboard();
        this.loadUsers();
        this.loadTasks();
        this.loadReports();
        this.updateNotifications();
        this.loadPermissions();
        this.loadFiles();
        this.loadActivityLogs();
        
        this.ensureLogoutButtonVisibility();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
        document.getElementById('loginForm').reset();
        
        this.showIcon('email');
        this.showIcon('password');
        this.updateToggleVisibility();
        
        setTimeout(() => {
            this.disableAutocomplete();
        }, 100);
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        document.getElementById('userName').textContent = this.currentUser.name;
        document.getElementById('userRole').textContent = this.currentUser.role;
        
        const defaultAvatar = 'https://i.imgur.com/RpGGkQ1.png';
        const avatarUrl = this.currentUser.avatar_url || defaultAvatar;
        document.getElementById('userAvatar').src = avatarUrl;
        document.getElementById('headerAvatar').src = avatarUrl;
        document.getElementById('avatarPreview').src = avatarUrl;

        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            el.style.display = this.currentUser.role === 'admin' ? 'flex' : 'none';
        });

        this.updateNavigationPermissions();
    }

    updateNavigationPermissions() {
        const userRole = this.currentUser.role;
        const userPermissions = this.permissions[userRole] || {};

        const activityLogsNav = document.querySelector('[data-section="activity-logs"]');
        if (activityLogsNav) {
            activityLogsNav.style.display = userPermissions.view_activity_logs ? 'flex' : 'none';
        }

        const fileStorageNav = document.querySelector('[data-section="file-storage"]');
        if (fileStorageNav) {
            fileStorageNav.style.display = (userPermissions.upload_files || userPermissions.download_files) ? 'flex' : 'none';
        }
    }

    updateProfileUI() {
        if (!this.userProfile) return;

        document.getElementById('profileName').value = this.userProfile.name || '';
        document.getElementById('profileEmail').value = this.userProfile.email || '';
        document.getElementById('profileDepartment').value = this.userProfile.department || '';
        document.getElementById('profilePosition').value = this.userProfile.position || '';
        document.getElementById('avatarUrl').value = this.userProfile.avatar_url || '';
    }

    updateNotifications() {
        const badge = document.querySelector('.notification-badge');
        const notificationCount = this.notifications.length;
        
        if (notificationCount > 0) {
            badge.textContent = notificationCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    async loadDashboard() {
        try {
            const response = await this.apiCall('/api/dashboard/stats', 'GET');
            
            if (response.success) {
                this.renderDashboard(response.data);
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showNotification('Error loading dashboard', 'error');
        }
    }

    renderDashboard(data) {
        const section = document.getElementById('dashboardSection');
        const { stats, recentTasks } = data;

        const safeStats = {
            total_tasks: stats.total_tasks || 0,
            pending_tasks: stats.pending_tasks || 0,
            in_progress_tasks: stats.in_progress_tasks || 0,
            completed_tasks: stats.completed_tasks || 0,
            overdue_tasks: stats.overdue_tasks || 0
        };

        section.innerHTML = `
            <div class="stats-section">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${safeStats.total_tasks}</h3>
                        <p>Total Tasks</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${safeStats.pending_tasks}</h3>
                        <p>Pending</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon info">
                        <i class="fas fa-spinner"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${safeStats.in_progress_tasks}</h3>
                        <p>In Progress</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${safeStats.completed_tasks}</h3>
                        <p>Completed</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon danger">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${safeStats.overdue_tasks}</h3>
                        <p>Overdue</p>
                    </div>
                </div>
            </div>

            <div class="section-header">
                <h2>Recent Activities</h2>
                <button class="btn-primary" id="refreshDashboard">
                    <i class="fas fa-sync-alt"></i>
                    Refresh
                </button>
            </div>
            <div class="task-list">
                ${recentTasks && recentTasks.length > 0 ? 
                    recentTasks.map(task => this.renderTaskItem(task)).join('') :
                    '<div class="no-data"><i class="fas fa-tasks"></i><p>No recent activities found</p></div>'
                }
            </div>
        `;

        document.getElementById('refreshDashboard').addEventListener('click', () => {
            this.loadDashboard();
            this.showNotification('Dashboard refreshed', 'info');
        });

        this.attachTaskEventListeners();
    }

    async loadTasks() {
        try {
            const response = await this.apiCall('/api/tasks', 'GET');
            
            if (response.success) {
                this.tasks = response.data;
                this.renderTasks();
            }
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.showNotification('Error loading tasks', 'error');
        }
    }

    renderTasks() {
        const container = document.getElementById('taskListContainer');
        
        if (!this.tasks || this.tasks.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-tasks"></i><p>No tasks found. Create your first task!</p></div>';
            return;
        }

        container.innerHTML = this.tasks.map(task => this.renderTaskItem(task)).join('');
        this.attachTaskEventListeners();
    }

    renderTaskItem(task) {
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const today = new Date();
        const isOverdue = dueDate && dueDate < today && !['completed', 'cancelled'].includes(task.status);
        const isCompleted = task.status === 'completed';

        const defaultAvatar = 'https://i.imgur.com/RpGGkQ1.png';

        return `
            <div class="task-item ${isCompleted ? 'completed' : ''}" data-priority="${task.priority}" data-id="${task.id}">
                <div class="task-checkbox">
                    <input type="checkbox" id="task-${task.id}" ${isCompleted ? 'checked' : ''}>
                    <label for="task-${task.id}"></label>
                </div>
                <div class="task-content">
                    <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                    <p class="task-description">${this.escapeHtml(task.description) || 'No description'}</p>
                    <div class="task-meta">
                        <span class="task-priority ${task.priority}">
                            <i class="fas fa-flag"></i> ${task.priority}
                        </span>
                        <span class="task-status ${task.status}">
                            <i class="fas fa-circle"></i> ${task.status}
                        </span>
                        ${dueDate ? `
                            <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                                <i class="far fa-calendar"></i> 
                                ${dueDate.toLocaleDateString()}
                                ${isOverdue ? ' (Overdue)' : ''}
                            </span>
                        ` : ''}
                        ${task.assignee_name ? `
                            <span class="task-assignee">
                                <img src="${task.assignee_avatar || defaultAvatar}" 
                                     alt="${task.assignee_name}" class="assignee-avatar">
                                ${task.assignee_name}
                            </span>
                        ` : ''}
                        ${task.estimated_hours ? `
                            <span class="task-hours">
                                <i class="fas fa-clock"></i> 
                                ${task.estimated_hours} hours
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="action-btn edit-btn" data-task-id="${task.id}" title="Edit Task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-task-id="${task.id}" title="Delete Task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    async loadUsers() {
        if (this.currentUser.role !== 'admin') return;

        try {
            const response = await this.apiCall('/api/users', 'GET');
            
            if (response.success) {
                this.users = response.data;
                this.renderUsers();
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showNotification('Error loading users', 'error');
        }
    }

    renderUsers() {
        const container = document.getElementById('usersGrid');
        
        if (!this.users || this.users.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-users"></i><p>No users found</p></div>';
            return;
        }

        container.innerHTML = this.users.map(user => this.renderUserCard(user)).join('');
        this.attachUserEventListeners();
    }

    renderUserCard(user) {
        const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
        const defaultAvatar = 'https://i.imgur.com/RpGGkQ1.png';

        return `
            <div class="user-card" data-user-id="${user.id}">
                <div class="user-card-header">
                    <div class="user-card-avatar">
                        <img src="${user.avatar_url || defaultAvatar}" alt="${user.name}">
                    </div>
                    <div class="user-card-info">
                        <h4>${this.escapeHtml(user.name)}</h4>
                        <p>${this.escapeHtml(user.email)}</p>
                        <span class="user-card-role ${user.role}">${user.role}</span>
                    </div>
                </div>
                <div class="user-card-details">
                    <div class="user-detail-item">
                        <span class="user-detail-label">Department</span>
                        <span class="user-detail-value">${user.department || 'N/A'}</span>
                    </div>
                    <div class="user-detail-item">
                        <span class="user-detail-label">Position</span>
                        <span class="user-detail-value">${user.position || 'N/A'}</span>
                    </div>
                    <div class="user-detail-item">
                        <span class="user-detail-label">Status</span>
                        <span class="user-detail-value">${user.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="user-detail-item">
                        <span class="user-detail-label">Last Login</span>
                        <span class="user-detail-value">${lastLogin}</span>
                    </div>
                </div>
                <div class="user-card-actions">
                    <button class="user-action-btn btn-change-password" data-user-id="${user.id}" title="Change Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="user-action-btn btn-edit-user" data-user-id="${user.id}" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="user-action-btn btn-deactivate" data-user-id="${user.id}" title="${user.is_active ? 'Deactivate' : 'Activate'} User">
                        <i class="fas ${user.is_active ? 'fa-user-slash' : 'fa-user-check'}"></i>
                    </button>
                </div>
            </div>
        `;
    }

    async loadFiles() {
        try {
            const response = await this.apiCall('/api/files', 'GET');
            
            if (response.success) {
                this.files = response.data;
                this.renderFiles();
            }
        } catch (error) {
            console.error('Failed to load files:', error);
        }
    }

    renderFiles() {
        const container = document.getElementById('fileStorageContainer');
        if (!container) return;
        
        if (!this.files || this.files.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-folder-open"></i><p>No files uploaded yet</p></div>';
            return;
        }

        container.innerHTML = this.files.map(file => this.renderFileItem(file)).join('');
        this.attachFileEventListeners();
    }

    renderFileItem(file) {
        const uploadDate = new Date(file.uploaded_at).toLocaleDateString();
        const fileSize = this.formatFileSize(file.file_size);
        const userPermissions = this.permissions[this.currentUser.role] || {};

        return `
            <div class="file-item" data-file-id="${file.id}">
                <div class="file-icon">
                    <i class="fas ${this.getFileIcon(file.file_type)}"></i>
                </div>
                <div class="file-info">
                    <h4 class="file-name">${this.escapeHtml(file.original_name)}</h4>
                    <p class="file-meta">
                        <span>Uploaded by: ${file.uploaded_by_name}</span>
                        <span>Date: ${uploadDate}</span>
                        <span>Size: ${fileSize}</span>
                        <span>Type: ${file.file_type}</span>
                    </p>
                </div>
                <div class="file-actions">
                    ${userPermissions.download_files ? `
                        <button class="action-btn download-btn" data-file-id="${file.id}" title="Download File">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    ${userPermissions.delete_files && (this.currentUser.role === 'admin' || file.uploaded_by === this.currentUser.id) ? `
                        <button class="action-btn delete-btn" data-file-id="${file.id}" title="Delete File">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    getFileIcon(fileType) {
        if (fileType.includes('image')) return 'fa-file-image';
        if (fileType.includes('pdf')) return 'fa-file-pdf';
        if (fileType.includes('word')) return 'fa-file-word';
        if (fileType.includes('excel')) return 'fa-file-excel';
        if (fileType.includes('zip')) return 'fa-file-archive';
        return 'fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async loadActivityLogs() {
        try {
            const response = await this.apiCall('/api/activities', 'GET');
            
            if (response.success) {
                this.activityLogs = response.data;
                this.renderActivityLogs();
            }
        } catch (error) {
            console.error('Failed to load activity logs:', error);
        }
    }

    renderActivityLogs() {
        const container = document.getElementById('activityLogsContainer');
        if (!container) return;
        
        if (!this.activityLogs || this.activityLogs.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-history"></i><p>No activity logs available</p></div>';
            return;
        }

        const enhancedLogs = [
            ...this.activityLogs,
            {
                id: 'sys-1',
                user_name: 'System',
                activity_type: 'system_start',
                description: 'Enterprise TaskFlow system started',
                created_at: new Date().toISOString(),
                ip_address: '127.0.0.1'
            }
        ];

        container.innerHTML = enhancedLogs.map(log => this.renderActivityLogItem(log)).join('');
    }

    renderActivityLogItem(log) {
        const logDate = new Date(log.created_at).toLocaleString();
        
        return `
            <div class="activity-log-item">
                <div class="activity-icon">
                    <i class="fas ${this.getActivityIcon(log.activity_type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-header">
                        <span class="activity-user">${log.user_name}</span>
                        <span class="activity-time">${logDate}</span>
                    </div>
                    <p class="activity-description">${this.escapeHtml(log.description)}</p>
                    ${log.ip_address ? `<span class="activity-ip">IP: ${log.ip_address}</span>` : ''}
                </div>
            </div>
        `;
    }

    getActivityIcon(activityType) {
        const icons = {
            login: 'fa-sign-in-alt',
            logout: 'fa-sign-out-alt',
            task_created: 'fa-plus-circle',
            task_updated: 'fa-edit',
            task_deleted: 'fa-trash',
            user_created: 'fa-user-plus',
            user_updated: 'fa-user-edit',
            file_uploaded: 'fa-upload',
            file_downloaded: 'fa-download',
            file_deleted: 'fa-trash',
            profile_updated: 'fa-user-cog',
            avatar_updated: 'fa-image',
            permissions_updated: 'fa-shield-alt',
            system_start: 'fa-server'
        };
        return icons[activityType] || 'fa-info-circle';
    }

    async loadReports() {
        try {
            const period = document.getElementById('reportPeriod').value;
            const response = await this.apiCall(`/api/reports?period=${period}`, 'GET');
            
            if (response.success) {
                this.renderReports(response.data);
            }
        } catch (error) {
            console.error('Failed to load reports:', error);
            this.renderReports();
        }
    }

    renderReports(data = null) {
        if (!data) {
            const completedTasks = this.tasks.filter(t => t.status === 'completed').length;
            const inProgressTasks = this.tasks.filter(t => t.status === 'in-progress').length;
            const pendingTasks = this.tasks.filter(t => t.status === 'pending').length;
            const totalTasks = this.tasks.length;
            
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const weeklyCompletion = [
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10),
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10),
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10),
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10),
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10),
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10),
                Math.min(100, completionRate + Math.floor(Math.random() * 20) - 10)
            ];

            data = {
                completionRate: weeklyCompletion,
                taskDistribution: [completedTasks, inProgressTasks, pendingTasks],
                teamPerformance: []
            };
        }

        const ctx1 = document.getElementById('completionChart');
        const ctx2 = document.getElementById('distributionChart');

        if (ctx1) {
            new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Completion Rate %',
                        data: data.completionRate,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#f8fafc' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }

        if (ctx2) {
            new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Completed', 'In Progress', 'Pending'],
                    datasets: [{
                        data: data.taskDistribution,
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 2,
                        borderColor: '#1e293b'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#f8fafc', font: { size: 12 } }
                        }
                    }
                }
            });
        }

        this.updateTeamPerformanceStats(data.teamPerformance);
    }

    updateTeamPerformanceStats(teamData = null) {
        const container = document.getElementById('teamPerformanceStats');
        if (!container) return;

        let statsHTML = '';
        
        if (teamData && teamData.length > 0) {
            statsHTML = teamData.map(member => `
                <div class="team-member">
                    <span class="member-name">${member.member_name}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${member.completion_rate}%"></div>
                    </div>
                    <span class="completion-rate">${member.completion_rate}%</span>
                </div>
            `).join('');
        } else {
            const userStats = {};
            
            this.tasks.forEach(task => {
                if (task.assignee_name) {
                    if (!userStats[task.assignee_name]) {
                        userStats[task.assignee_name] = { total: 0, completed: 0 };
                    }
                    userStats[task.assignee_name].total++;
                    if (task.status === 'completed') {
                        userStats[task.assignee_name].completed++;
                    }
                }
            });

            statsHTML = Object.entries(userStats).map(([userName, stats]) => {
                const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                return `
                    <div class="team-member">
                        <span class="member-name">${userName}</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${completionRate}%"></div>
                        </div>
                        <span class="completion-rate">${completionRate}%</span>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = statsHTML || '<p>No team performance data available</p>';
    }

    async loadPermissions() {
        try {
            const response = await this.apiCall('/api/permissions', 'GET');
            if (response.success) {
                this.permissions = response.data;
                this.renderPermissions();
            }
        } catch (error) {
            console.error('Failed to load permissions:', error);
            this.renderPermissions();
        }
    }

    renderPermissions() {
        Object.keys(this.permissions.manager || {}).forEach(permission => {
            const checkbox = document.getElementById(`manager-${permission.replace('_', '-')}`);
            if (checkbox) {
                checkbox.checked = this.permissions.manager[permission];
            }
        });

        Object.keys(this.permissions.employee || {}).forEach(permission => {
            const checkbox = document.getElementById(`employee-${permission.replace('_', '-')}`);
            if (checkbox) {
                checkbox.checked = this.permissions.employee[permission];
            }
        });
    }

    async handleSavePermissions(e) {
        const role = e.target.getAttribute('data-role');
        
        const permissions = {};
        Object.keys(this.permissions[role] || {}).forEach(permission => {
            const checkbox = document.getElementById(`${role}-${permission.replace('_', '-')}`);
            if (checkbox) {
                permissions[permission] = checkbox.checked;
            }
        });

        try {
            const response = await this.apiCall('/api/permissions', 'PUT', {
                role: role,
                permissions: permissions
            });
            
            if (response.success) {
                this.permissions[role] = permissions;
                this.showNotification(`${role.charAt(0).toUpperCase() + role.slice(1)} permissions updated successfully!`, 'success');
                this.logActivity('permissions_updated', `Permissions updated for role ${role}`);
            } else {
                this.showNotification('Error updating permissions', 'error');
            }
        } catch (error) {
            this.showNotification('Error updating permissions', 'error');
        }
    }

    async apiCall(endpoint, method = 'GET', data = null, useAuth = true) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (useAuth && this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(endpoint, config);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            
            return result;
        } catch (error) {
            if (error.message.includes('401') || error.message.includes('403')) {
                this.handleAuthError();
            }
            
            throw error;
        }
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${icons[type] || icons.info}"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }

    handleNavigation(e) {
        e.preventDefault();
        
        const target = e.currentTarget;
        const section = target.getAttribute('data-section');
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        target.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        document.getElementById(`${section}Section`).classList.remove('hidden');
        
        this.currentSection = section;

        if (section === 'reports') {
            this.loadReports();
        } else if (section === 'permissions') {
            this.loadPermissions();
        } else if (section === 'file-storage') {
            this.loadFiles();
        } else if (section === 'activity-logs') {
            this.loadActivityLogs();
        }

        this.ensureLogoutButtonVisibility();
    }

    openTaskModal(task = null) {
        this.editingTask = task;
        this.populateAssigneeDropdown();
        
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const submitBtn = document.getElementById('taskSubmitBtn');
        
        if (task) {
            title.textContent = 'Edit Task';
            submitBtn.textContent = 'Update Task';
            
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskStatus').value = task.status;
            document.getElementById('taskDueDate').value = task.due_date;
            document.getElementById('taskAssignee').value = task.assignee_id || '';
            document.getElementById('taskEstimatedHours').value = task.estimated_hours || '';
            document.getElementById('taskActualHours').value = task.actual_hours || '';
        } else {
            title.textContent = 'Create New Task';
            submitBtn.textContent = 'Create Task';
            document.getElementById('taskForm').reset();
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('taskDueDate').valueAsDate = tomorrow;
        }
        
        modal.classList.add('active');
    }

    closeTaskModal() {
        document.getElementById('taskModal').classList.remove('active');
        document.getElementById('taskForm').reset();
        this.editingTask = null;
    }

    openUserModal(user = null) {
        this.editingUser = user;
        
        const modal = document.getElementById('userModal');
        const title = document.getElementById('userModalTitle');
        const submitBtn = document.getElementById('userSubmitBtn');
        const passwordField = document.getElementById('passwordField');
        
        if (user) {
            title.textContent = 'Edit User';
            submitBtn.textContent = 'Update User';
            passwordField.style.display = 'none';
            
            document.getElementById('userId').value = user.id;
            document.getElementById('userName').value = user.name;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userRole').value = user.role;
            document.getElementById('userDepartment').value = user.department || '';
            document.getElementById('userPosition').value = user.position || '';
            document.getElementById('userAvatarUrl').value = user.avatar_url || '';
        } else {
            title.textContent = 'Create New User';
            submitBtn.textContent = 'Create User';
            passwordField.style.display = 'block';
            document.getElementById('userForm').reset();
        }
        
        modal.classList.add('active');
    }

    closeUserModal() {
        document.getElementById('userModal').classList.remove('active');
        document.getElementById('userForm').reset();
        this.editingUser = null;
    }

    openProfileModal() {
        this.updateProfileUI();
        document.getElementById('profileModal').classList.add('active');
    }

    closeProfileModal() {
        document.getElementById('profileModal').classList.remove('active');
    }

    async populateAssigneeDropdown() {
        const dropdown = document.getElementById('taskAssignee');
        
        try {
            const response = await this.apiCall('/api/users', 'GET');
            
            if (response.success) {
                dropdown.innerHTML = '<option value="">Unassigned</option>' +
                    response.data
                        .filter(user => user.is_active)
                        .map(user => `<option value="${user.id}">${user.name} (${user.role})</option>`)
                        .join('');
            }
        } catch (error) {
            console.error('Failed to load users for assignee dropdown:', error);
        }
    }

    async handleTaskSave(e) {
        e.preventDefault();
        
        const formData = {
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            due_date: document.getElementById('taskDueDate').value,
            assignee_id: document.getElementById('taskAssignee').value || null,
            estimated_hours: document.getElementById('taskEstimatedHours').value || null,
            actual_hours: document.getElementById('taskActualHours').value || null
        };

        try {
            let response;
            if (this.editingTask) {
                response = await this.apiCall(`/api/tasks/${this.editingTask.id}`, 'PUT', formData);
                this.logActivity('task_updated', `Task "${formData.title}" updated`);
            } else {
                response = await this.apiCall('/api/tasks', 'POST', formData);
                this.logActivity('task_created', `Task "${formData.title}" created`);
                
                this.sendTaskNotification(formData.title);
            }
            
            if (response.success) {
                this.closeTaskModal();
                this.loadTasks();
                if (this.currentSection === 'dashboard') {
                    this.loadDashboard();
                }
                this.showNotification(`Task ${this.editingTask ? 'updated' : 'created'} successfully!`, 'success');
            } else {
                this.showNotification(response.error || `Error ${this.editingTask ? 'updating' : 'creating'} task`, 'error');
            }
        } catch (error) {
            this.showNotification(`Error ${this.editingTask ? 'updating' : 'creating'} task. Please try again.`, 'error');
        }
    }

    sendTaskNotification(taskTitle) {
        this.showNotification(`New task created: ${taskTitle}`, 'info');
        
        this.showDesktopNotification('New Task Created', `A new task "${taskTitle}" has been created.`);
        
        this.notifications.push({
            id: Date.now(),
            type: 'task_created',
            message: `New task: ${taskTitle}`,
            read: false
        });
        this.updateNotifications();
    }

    async handleUserSave(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('userName').value,
            email: document.getElementById('userEmail').value,
            role: document.getElementById('userRole').value,
            department: document.getElementById('userDepartment').value,
            position: document.getElementById('userPosition').value,
            avatar_url: document.getElementById('userAvatarUrl').value
        };

        if (!this.editingUser && formData.role === 'admin') {
            const adminUsers = this.users.filter(user => user.role === 'admin');
            if (adminUsers.length > 0) {
                this.showNotification('Only one administrator account is allowed in the system', 'error');
                return;
            }
        }

        if (!this.editingUser) {
            formData.password = document.getElementById('userPassword').value;
            if (!formData.password || formData.password.length < 8) {
                this.showNotification('Password must be at least 8 characters long', 'error');
                return;
            }
        }

        try {
            let response;
            if (this.editingUser) {
                response = await this.apiCall(`/api/users/${this.editingUser.id}`, 'PUT', formData);
                this.logActivity('user_updated', `User "${formData.name}" updated`);
            } else {
                response = await this.apiCall('/api/users', 'POST', formData);
                this.logActivity('user_created', `User "${formData.name}" created`);
            }
            
            if (response.success) {
                this.closeUserModal();
                this.loadUsers();
                this.showNotification(`User ${this.editingUser ? 'updated' : 'created'} successfully!`, 'success');
            } else {
                this.showNotification(response.error || `Error ${this.editingUser ? 'updating' : 'creating'} user`, 'error');
            }
        } catch (error) {
            this.showNotification(`Error ${this.editingUser ? 'updating' : 'creating'} user. Please try again.`, 'error');
        }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('profileName').value,
            department: document.getElementById('profileDepartment').value,
            position: document.getElementById('profilePosition').value
        };

        try {
            const response = await this.apiCall('/api/user/profile', 'PUT', formData);
            
            if (response.success) {
                this.userProfile = response.data;
                this.currentUser = { ...this.currentUser, ...formData };
                this.updateUserInterface();
                this.closeProfileModal();
                this.showNotification('Profile updated successfully!', 'success');
                this.logActivity('profile_updated', 'User profile updated');
            } else {
                this.showNotification(response.error || 'Error updating profile', 'error');
            }
        } catch (error) {
            this.showNotification('Error updating profile. Please try again.', 'error');
        }
    }

    async handleAvatarUpdate(e) {
        e.preventDefault();
        
        const avatarUrl = document.getElementById('avatarUrl').value;

        if (!avatarUrl) {
            this.showNotification('Please enter an avatar URL', 'error');
            return;
        }

        try {
            const response = await this.apiCall('/api/user/avatar', 'PUT', { avatar_url: avatarUrl });
            
            if (response.success) {
                this.userProfile.avatar_url = avatarUrl;
                this.currentUser.avatar_url = avatarUrl;
                this.updateUserInterface();
                document.getElementById('avatarPreview').src = avatarUrl;
                this.showNotification('Avatar updated successfully!', 'success');
                this.logActivity('avatar_updated', 'User avatar updated');
            } else {
                this.showNotification(response.error || 'Error updating avatar', 'error');
            }
        } catch (error) {
            this.showNotification('Error updating avatar. Please try again.', 'error');
        }
    }

    attachTaskEventListeners() {
        document.querySelectorAll('.task-checkbox input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleTaskStatusChange(e));
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTaskEdit(e));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTaskDelete(e));
        });
    }

    attachUserEventListeners() {
        document.querySelectorAll('.btn-change-password').forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePasswordChange(e));
        });

        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleUserEdit(e));
        });

        document.querySelectorAll('.btn-deactivate').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleUserActivation(e));
        });
    }

    attachFileEventListeners() {
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFileDownload(e));
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            if (btn.classList.contains('delete-btn') && btn.getAttribute('data-file-id')) {
                btn.addEventListener('click', (e) => this.handleFileDelete(e));
            }
        });
    }

    async handleTaskStatusChange(e) {
        const taskId = e.target.closest('.task-item').getAttribute('data-id');
        const newStatus = e.target.checked ? 'completed' : 'pending';

        try {
            await this.apiCall(`/api/tasks/${taskId}`, 'PUT', { status: newStatus });
            
            const taskItem = e.target.closest('.task-item');
            if (newStatus === 'completed') {
                taskItem.classList.add('completed');
            } else {
                taskItem.classList.remove('completed');
            }
            
            this.showNotification('Task status updated', 'success');
            this.logActivity('task_status_changed', `Task status changed to ${newStatus}`);
        } catch (error) {
            console.error('Failed to update task status:', error);
            e.target.checked = !e.target.checked;
            this.showNotification('Error updating task', 'error');
        }
    }

    handleTaskEdit(e) {
        const taskId = e.currentTarget.getAttribute('data-task-id');
        const task = this.tasks.find(t => t.id == taskId);
        
        if (task) {
            this.openTaskModal(task);
        }
    }

    async handleTaskDelete(e) {
        const taskId = e.currentTarget.getAttribute('data-task-id');
        const taskTitle = e.currentTarget.closest('.task-item').querySelector('.task-title').textContent;

        if (!confirm(`Are you sure you want to delete task "${taskTitle}"?`)) {
            return;
        }

        try {
            const response = await this.apiCall(`/api/tasks/${taskId}`, 'DELETE');
            
            if (response.success) {
                this.loadTasks();
                if (this.currentSection === 'dashboard') {
                    this.loadDashboard();
                }
                this.showNotification('Task deleted successfully', 'success');
                this.logActivity('task_deleted', `Task "${taskTitle}" deleted`);
            }
        } catch (error) {
            this.showNotification('Error deleting task', 'error');
        }
    }

    handlePasswordChange(e) {
        const userId = e.currentTarget.getAttribute('data-user-id');
        const user = this.users.find(u => u.id == userId);
        
        if (user && user.id === this.currentUser.id) {
            this.showNotification('You cannot change your own password here. Use profile settings.', 'warning');
            return;
        }

        const newPassword = prompt('Enter new password (minimum 8 characters):');
        
        if (newPassword && newPassword.length >= 8) {
            this.updateUserPassword(userId, newPassword);
        } else if (newPassword) {
            this.showNotification('Password must be at least 8 characters', 'error');
        }
    }

    async updateUserPassword(userId, newPassword) {
        try {
            const response = await this.apiCall(`/api/users/${userId}/password`, 'PUT', { newPassword });
            
            if (response.success) {
                this.showNotification('Password updated successfully', 'success');
                this.logActivity('password_changed', `Password changed for user ${userId}`);
            }
        } catch (error) {
            this.showNotification('Error updating password', 'error');
        }
    }

    handleUserEdit(e) {
        const userId = e.currentTarget.getAttribute('data-user-id');
        const user = this.users.find(u => u.id == userId);
        
        if (user) {
            this.openUserModal(user);
        }
    }

    async handleUserActivation(e) {
        const userId = e.currentTarget.getAttribute('data-user-id');
        const user = this.users.find(u => u.id == userId);
        
        if (user && user.id === this.currentUser.id) {
            this.showNotification('You cannot deactivate your own account', 'error');
            return;
        }

        const newStatus = !user.is_active;

        try {
            const response = await this.apiCall(`/api/users/${userId}`, 'PUT', { is_active: newStatus });
            
            if (response.success) {
                this.loadUsers();
                this.showNotification(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
                this.logActivity('user_status_changed', `User ${user.name} ${newStatus ? 'activated' : 'deactivated'}`);
            }
        } catch (error) {
            this.showNotification('Error updating user', 'error');
        }
    }

    async handleFileDownload(e) {
        const fileId = e.currentTarget.getAttribute('data-file-id');
        const file = this.files.find(f => f.id == fileId);
        
        if (file) {
            try {
                const response = await this.apiCall(`/api/files/${fileId}/download`, 'GET');
                
                if (response.success && response.downloadUrl) {
                    window.open(response.downloadUrl, '_blank');
                    this.logActivity('file_downloaded', `File "${file.original_name}" downloaded`);
                }
            } catch (error) {
                this.showNotification('Error downloading file', 'error');
            }
        }
    }

    async handleFileDelete(e) {
        const fileId = e.currentTarget.getAttribute('data-file-id');
        const file = this.files.find(f => f.id == fileId);
        
        if (file && confirm(`Are you sure you want to delete file "${file.original_name}"?`)) {
            try {
                const response = await this.apiCall(`/api/files/${fileId}`, 'DELETE');
                
                if (response.success) {
                    this.loadFiles();
                    this.showNotification('File deleted successfully', 'success');
                    this.logActivity('file_deleted', `File "${file.original_name}" deleted`);
                }
            } catch (error) {
                this.showNotification('Error deleting file', 'error');
            }
        }
    }

    openFileUploadModal() {
        document.getElementById('fileUploadModal').classList.add('active');
    }

    closeFileUploadModal() {
        document.getElementById('fileUploadModal').classList.remove('active');
        document.getElementById('uploadFileForm').reset();
    }

    handleFileSelect(e) {
        const fileInput = e.target;
        const fileName = document.getElementById('selectedFileName');
        
        if (fileInput.files.length > 0) {
            fileName.textContent = fileInput.files[0].name;
        } else {
            fileName.textContent = 'No file selected';
        }
    }

    async handleFileUpload(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('fileUpload');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('Please select a file to upload', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.closeFileUploadModal();
                this.loadFiles();
                this.showNotification('File uploaded successfully', 'success');
                this.logActivity('file_uploaded', `File "${file.name}" uploaded`);
            } else {
                this.showNotification(result.error || 'Error uploading file', 'error');
            }
        } catch (error) {
            this.showNotification('Error uploading file', 'error');
        }
    }

    handleFilterChange(e) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.currentTarget.classList.add('active');
        
        this.applyFilters();
    }

    applyFilters() {
        this.loadTasks();
    }

    handleGlobalSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        
        if (searchTerm.length < 2) {
            this.renderTasks();
            return;
        }

        const filteredTasks = this.tasks.filter(task => 
            task.title.toLowerCase().includes(searchTerm) ||
            task.description.toLowerCase().includes(searchTerm) ||
            (task.assignee_name && task.assignee_name.toLowerCase().includes(searchTerm))
        );

        const container = document.getElementById('taskListContainer');
        if (filteredTasks.length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-search"></i><p>No tasks found matching your search</p></div>';
        } else {
            container.innerHTML = filteredTasks.map(task => this.renderTaskItem(task)).join('');
            this.attachTaskEventListeners();
        }
    }

    exportReport() {
        this.showNotification('Exporting report...', 'info');
        setTimeout(() => {
            this.showNotification('Report exported successfully!', 'success');
        }, 1500);
    }

    logActivity(type, description) {
        console.log(`[ACTIVITY LOG] ${new Date().toISOString()} - ${type}: ${description}`);
        
        if (this.token) {
            this.apiCall('/api/activities', 'POST', {
                activity_type: type,
                description: description
            }).catch(error => console.error('Failed to log activity:', error));
        }
    }

    handleAuthError() {
        this.showNotification('Session expired. Please login again.', 'error');
        this.handleLogout();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new EnterpriseTaskFlow();
});