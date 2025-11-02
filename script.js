// Global Variables
let currentUser = null;
let students = [];
let applications = [];
let notifications = [];
let currentApplicationId = null;
let adminPosts = [];

// Chat Variables
let chatMessages = [];
let chatIsOpen = false;
let chatIsMinimized = false;
let unreadMessageCount = 0;

// Persist chat to localStorage so admin messages appear for students later
function loadPersistedChatMessages() {
    try {
        const stored = localStorage.getItem('chatMessages');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                chatMessages = parsed;
            }
        }
    } catch (e) {
        // ignore parse errors
    }
}

function persistChatMessages() {
    try {
        localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
    } catch (e) {
        // ignore storage errors
    }
}

// Profile Chat Variables
let profileChatMessages = [];
let profileChatIsExpanded = false;
let profileChatPendingFile = null;

let adminActiveChatStudentId = null;



// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load data from localStorage first, fallback to empty arrays
    const savedStudents = localStorage.getItem('students');
    const savedApplications = localStorage.getItem('applications');
    
    if (savedStudents) {
        students = JSON.parse(savedStudents);
        console.log('Loaded students from localStorage:', students);
    } else {
        students = []; // Start with empty array - no sample data
        localStorage.setItem('students', JSON.stringify(students));
        console.log('Initialized with empty students array');
    }
    
    if (savedApplications) {
        applications = JSON.parse(savedApplications);
        // Cleanup: remove legacy sample applications (with firstName/lastName fields)
        try {
            const cleanedApplications = applications.filter(app => app && (
                (typeof app.studentId !== 'undefined' && (app.documentType || app.documentFiles))
            ));
            if (cleanedApplications.length !== applications.length) {
                applications = cleanedApplications;
                localStorage.setItem('applications', JSON.stringify(applications));
            }
        } catch (e) {
            // ignore cleanup errors
        }
    } else {
        applications = []; // Start with empty array
        localStorage.setItem('applications', JSON.stringify(applications));
    }
    
    loadPersistedChatMessages();
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (document && document.body) {
            document.body.classList.add('logged-in');
            if (currentUser.role === 'admin') {
                document.body.classList.add('admin-logged-in');
                // Check notification badge on load for admin
                checkAndUpdateNotificationBadge();
                // Update notification badge more frequently (every 5 seconds for real-time updates)
                setInterval(checkAndUpdateNotificationBadge, 5000);
                
                // Also update immediately when admin tab becomes visible (for real-time updates)
                document.addEventListener('visibilitychange', function() {
                    if (!document.hidden && currentUser && currentUser.role === 'admin') {
                        checkAndUpdateNotificationBadge();
                    }
                });
                
                // Update badge when window gains focus (user switches back to tab)
                window.addEventListener('focus', function() {
                    if (currentUser && currentUser.role === 'admin') {
                        checkAndUpdateNotificationBadge();
                    }
                });
            } else {
                document.body.classList.remove('admin-logged-in');
            }
            
            // Check notification badges for students
            if (currentUser.role === 'student') {
                checkAndUpdateStudentNotificationBadges();
                // Update student notification badges periodically (every 5 seconds)
                setInterval(checkAndUpdateStudentNotificationBadges, 5000);
                
                // Also update immediately when student tab becomes visible
                document.addEventListener('visibilitychange', function() {
                    if (!document.hidden && currentUser && currentUser.role === 'student') {
                        checkAndUpdateStudentNotificationBadges();
                    }
                });
                
                // Update badges when window gains focus
                window.addEventListener('focus', function() {
                    if (currentUser && currentUser.role === 'student') {
                        checkAndUpdateStudentNotificationBadges();
                    }
                });
            }
        }
        showDashboard();
    } else {
        showHome();
    }
    
    // Generate sample notifications
    generateSampleNotifications();
}

// Navigation Functions
function showHome() {
    hideAllSections();
    document.getElementById('home').classList.add('active');
    updateNavigation();
    // Render home feed posts targeted for Home Page audience
    if (typeof loadHomeFeed === 'function') {
        loadHomeFeed();
    }
}

function showLogin() {
    hideAllSections();
    document.getElementById('login').classList.add('active');
    updateNavigation();
}

function showRegister() {
    hideAllSections();
    document.getElementById('register').classList.add('active');
    updateNavigation();
}

function showDashboard() {
    hideAllSections();
    if (currentUser && currentUser.role === 'admin') {
        document.getElementById('admin-dashboard').classList.add('active');
        loadAdminDashboard();
    } else {
        document.getElementById('student-homepage').classList.add('active');
        loadStudentHomepage();
    }
    updateNavigation();
}

function hideAllSections() {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
}

function updateNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.style.display = 'block';
    });
    
    if (currentUser) {
        if (document && document.body) {
            document.body.classList.add('logged-in');
            if (currentUser.role === 'admin') {
                document.body.classList.add('admin-logged-in');
            } else {
                document.body.classList.remove('admin-logged-in');
            }
        }
        const homeLink = document.querySelector('.nav-link[onclick="showHome()"]');
        const loginLink = document.querySelector('.nav-link[onclick="showLogin()"]');
        const registerLink = document.querySelector('.nav-link[onclick="showRegister()"]');
        if (homeLink) homeLink.style.display = 'none';
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
    } else {
        if (document && document.body) {
            document.body.classList.remove('logged-in');
            document.body.classList.remove('admin-logged-in');
        }
        const homeLink = document.querySelector('.nav-link[onclick="showHome()"]');
        const loginLink = document.querySelector('.nav-link[onclick="showLogin()"]');
        const registerLink = document.querySelector('.nav-link[onclick="showRegister()"]');
        if (homeLink) homeLink.style.display = 'block';
        if (loginLink) loginLink.style.display = 'block';
        if (registerLink) registerLink.style.display = 'block';
    }
}

// Authentication Functions
async function handleRegister(event) {
    event.preventDefault();
    
    const formData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        studentId: document.getElementById('studentId').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        department: document.getElementById('department').value,
        course: document.getElementById('course').value,
        year: document.getElementById('year').value
    };
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    // API call to register student
    const response = await apiCall('register.php', 'POST', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        studentId: formData.studentId,
        email: formData.email,
        password: formData.password,
        department: formData.department,
        course: formData.course,
        year: formData.year
    });
    
    if (response.success) {
        showToast('Registration successful! Please login.', 'success');
        showLogin();
    } else {
        showToast(response.message || 'Registration failed', 'error');
    }
}

// Home Feed: Render admin posts where audience === 'home' in Facebook-like cards
async function loadHomeFeed() {
    const feedEl = document.getElementById('homeFeed');
    if (!feedEl) return;
    
    try {
        // Get posts from database
        const posts = await getPosts('home');
        
        // Filter posts for homepage (audience === 'home' or all students)
        const homePosts = posts.filter(p => {
            if (!p) return false;
            const audRaw = (p.audience == null ? '' : p.audience).toString().toLowerCase();
            // Include posts with audience 'home', 'students' (visible to all), or empty
            return audRaw === 'home' || audRaw === 'students' || audRaw === '';
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const postsToRender = homePosts.slice(0, 6);
        
        if (postsToRender.length === 0) {
            feedEl.innerHTML = `
                <div class="welcome-message">
                    <h3>No public posts yet</h3>
                    <p>Announcements for the Home Page will appear here.</p>
                </div>
            `;
            return;
        }
        feedEl.innerHTML = postsToRender.map(post => {
            const aud = ((post && post.audience) ? post.audience.toString().toLowerCase() : '');
            const badgeText = aud === 'students' ? 'GranTES Students' : 'Home Page';
            const ts = post && post.created_at ? post.created_at : (post.timestamp || new Date().toISOString());
            const author = (post && post.author) ? post.author : 'Administrator';
            const content = (post && post.content) ? post.content : '';
            const hasMulti = Array.isArray(post.images) && post.images.length > 1;
            const hasSingle = Array.isArray(post.images) && post.images.length === 1;
            const isTextOnly = !hasMulti && !hasSingle;
            
            if (isTextOnly) {
                return `
        <div class="post-card product-style text-only">
            <div class="post-content">
                <div class="post-hero-text">${content}</div>
            </div>
        </div>`;
            }
            const imageFirst = (post.layout || 'image-left') === 'image-left';
            const mediaHtml = (Array.isArray(post.images) && post.images.length > 1)
                ? renderCarousel(post.images)
                : (Array.isArray(post.images) && post.images.length === 1 ? `<div class="post-image"><img src="${post.images[0]}" alt="post image"></div>` : '');
            const detailsHtml = `<div class=\"post-details\">\n                        <div class=\"post-text\">${content}</div>\n                        ${post.type === 'media' ? '<div class=\"post-media\"><i class=\"fas fa-image\"></i> Media attached</div>' : ''}\n                        ${post.type === 'feeling' ? '<div class=\"post-feeling\"><i class=\"fas fa-smile\"></i> Feeling/Activity</div>' : ''}\n                    </div>`;
            return `
        <div class=\"post-card product-style\">\n            <div class=\"post-content\">\n                <div class=\"post-body ${imageFirst ? 'image-left' : 'image-right'}\">\n                    ${imageFirst ? `${mediaHtml}${detailsHtml}` : `${detailsHtml}${mediaHtml}`}
                </div>
            </div>
        </div>`;
        }).join('');
        normalizePostVideos();
    } catch (error) {
        console.error('Error loading home feed:', error);
        feedEl.innerHTML = `
            <div class="welcome-message">
                <h3>Error loading posts</h3>
                <p>Please refresh the page.</p>
            </div>
        `;
    }
}

// Ensure Home feed renders on initial page load
document.addEventListener('DOMContentLoaded', function() {
    try { loadHomeFeed(); } catch (_) { /* ignore */ }
});

async function homeLikePost(postId) {
    console.log('🔵 homeLikePost called for post:', postId);
    
    // Convert postId to number for consistent comparison
    const normalizedPostId = typeof postId === 'number' ? postId : parseInt(postId);
    
    // Prevent multiple rapid clicks
    if (window.__likingInProgress && window.__likingInProgress === normalizedPostId) {
        console.log('⚠️ Like already in progress for post:', normalizedPostId);
        return;
    }
    window.__likingInProgress = normalizedPostId;
    
    // Track liked posts in localStorage
    const likedPostsKey = 'likedPosts';
    let likedPosts = JSON.parse(localStorage.getItem(likedPostsKey) || '[]');
    // Normalize IDs in localStorage for comparison
    likedPosts = likedPosts.map(id => typeof id === 'number' ? id : parseInt(id));
    const isLiked = likedPosts.includes(normalizedPostId);
    
    console.log('📊 Current like state:', isLiked ? 'liked' : 'not liked');
    
    try {
        const action = isLiked ? 'unlike' : 'like';
        console.log('📤 Sending', action, 'request for post:', normalizedPostId);
        
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: normalizedPostId,
            action: action
        });
        
        console.log('📥 API Response:', response);
        
        if (response && response.success) {
            // Update liked posts list
            const wasLiked = isLiked;
            if (wasLiked) {
                likedPosts = likedPosts.filter(id => id !== normalizedPostId);
                showToast('Like removed', 'success');
            } else {
                if (!likedPosts.includes(normalizedPostId)) {
                    likedPosts.push(normalizedPostId);
                }
                showToast('Post liked!', 'success');
            }
            localStorage.setItem(likedPostsKey, JSON.stringify(likedPosts));
            
            // Update button state immediately without full reload
            updateLikeButtonState(normalizedPostId, !wasLiked);
            
            // Reload feed to show updated count
            loadHomeFeed();
        } else {
            const errorMsg = response?.message || 'Unknown error';
            console.error('❌ Like failed:', errorMsg);
            showToast('Failed to toggle like: ' + errorMsg, 'error');
        }
    } catch (error) {
        console.error('❌ Error toggling like:', error);
        showToast('Failed to toggle like: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        // Clear the flag after a delay
        setTimeout(() => {
            window.__likingInProgress = null;
        }, 1000);
    }
}

function homeCommentPost(postId) {
    const comment = prompt('Add a comment:');
    if (!comment || !comment.trim()) return;
    
    // For home page, just show a message
    showToast('Please log in to comment', 'info');
}

async function homeSharePost(postId) {
    try {
        // Update shares count in database
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'share'
        });
        
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        } catch (clipboardError) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Post link copied to clipboard!', 'success');
        }
        
        // Refresh feed
        loadHomeFeed();
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const role = document.getElementById('loginRole').value;
    const emailRaw = document.getElementById('loginEmail').value;
    const passwordRaw = document.getElementById('loginPassword').value;
    const email = (emailRaw || '').trim().toLowerCase();
    const password = (passwordRaw || '').trim();
    const awardNumberRaw = document.getElementById('loginAwardNumber').value || '';
    const identifier = awardNumberRaw.trim().toLowerCase() || email;
    
    console.log('Login attempt:', { role, email, password, identifier });
    
    // API call to login
    const response = await apiCall('login.php', 'POST', {
        role: role,
        email: email,
        password: password,
        identifier: identifier
    });
    
    if (response.success) {
        currentUser = response.user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        if (document && document.body) {
            document.body.classList.add('logged-in');
            if (currentUser.role === 'admin') {
                document.body.classList.add('admin-logged-in');
                // Check notification badge on login for admin
                checkAndUpdateNotificationBadge();
                // Update notification badge periodically (every 30 seconds)
                setInterval(checkAndUpdateNotificationBadge, 30000);
            } else {
                document.body.classList.remove('admin-logged-in');
            }
        }

        updateNavigation();
        showToast('Login successful!', 'success');
        showDashboard();
    } else {
        showToast(response.message || 'Login failed', 'error');
    }
}

// Safe localStorage setter - prevents quota errors from breaking flows
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        return false;
    }
}

// Guarantee stored student has a unique numeric id; persists back to localStorage if missing
function ensureStudentHasId(student) {
    if (student && typeof student.id === 'number' && student.id > 0) return student;
    const stored = JSON.parse(localStorage.getItem('students') || '[]');
    const matchIdx = stored.findIndex(s => (
        (s.awardNumber && student.awardNumber && String(s.awardNumber).trim().toLowerCase() === String(student.awardNumber).trim().toLowerCase()) ||
        (s.email && student.email && String(s.email).trim().toLowerCase() === String(student.email).trim().toLowerCase()) ||
        (s.studentId && student.studentId && String(s.studentId).trim().toLowerCase() === String(student.studentId).trim().toLowerCase())
    ));
    const nextId = stored.reduce((m, s) => {
        const idNum = typeof s.id === 'number' ? s.id : 0;
        return idNum > m ? idNum : m;
    }, 0) + 1;
    if (matchIdx !== -1) {
        if (!stored[matchIdx].id) stored[matchIdx].id = nextId;
        localStorage.setItem('students', JSON.stringify(stored));
        student.id = stored[matchIdx].id;
    } else if (!student.id) {
        student.id = nextId;
    }
    return student;
}

function logout() {
    // Show confirmation dialog before logging out
    if (confirm('Are you sure you want to logout?')) {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showToast('Logged out successfully', 'success');
    if (document && document.body) {
        document.body.classList.remove('logged-in');
        document.body.classList.remove('admin-logged-in');
    }
    showHome();
    }
}

// Student Homepage Functions
function loadStudentHomepage() {
    const student = currentUser.studentData;
    
    // Update header - handle both camelCase and snake_case formats
    const firstName = student.firstName || student.first_name || '';
    const lastName = student.lastName || student.last_name || '';
    const fullName = firstName + ' ' + lastName;
    
    document.getElementById('studentName').textContent = fullName.trim() || 'Student';
    
    // Update notification count
    const studentNotifications = notifications.filter(n => n.studentId === student.id);
    document.getElementById('studentNotificationCount').textContent = studentNotifications.length;
    
    // Update message count (guard if element not present in sidebar)
    const studentMessages = JSON.parse(localStorage.getItem('studentMessages') || '[]');
    const unreadMessages = studentMessages.filter(m => m.studentId === student.id && m.sender === 'admin' && !m.read);
    const msgCountElHeader = document.getElementById('studentMessageCount');
    if (msgCountElHeader) { msgCountElHeader.textContent = unreadMessages.length; }
    
    // Load profile information
    loadStudentProfile();
    
    // Load announcements
    loadStudentAnnouncements();
    
    // Load messages
    loadStudentMessages();
    // Make counters open Messages tab
    const msgCountEl = document.getElementById('studentMessageCount');
    if (msgCountEl) { msgCountEl.style.cursor = 'pointer'; msgCountEl.onclick = () => openStudentMessages(); }
    const notifCountEl = document.getElementById('studentNotificationCount');
    if (notifCountEl) { notifCountEl.style.cursor = 'pointer'; notifCountEl.onclick = () => openStudentMessages(); }
    
    // Initialize chat
    initializeChat();
}


function loadStudentProfile() {
    const student = currentUser.studentData;
    
    const sideName = document.getElementById('profileName');
    const studentFirstName = student.firstName || student.first_name || '';
    const studentLastName = student.lastName || student.last_name || '';
    const studentIdValue = student.studentId || student.student_id || '';
    if (sideName) sideName.textContent = `${studentFirstName} ${studentLastName}`;
    const sideId = document.getElementById('profileStudentId');
    if (sideId) sideId.textContent = studentIdValue;
    const sideEmail = document.getElementById('profileEmail');
    if (sideEmail) sideEmail.textContent = student.email;
    const sideCourse = document.getElementById('profileCourse');
    if (sideCourse) sideCourse.textContent = student.course;
    const sideYear = document.getElementById('profileYear');
    if (sideYear) sideYear.textContent = student.year;
    const sideAward = document.getElementById('profileAwardNumber');
    if (sideAward) sideAward.textContent = student.awardNumber || 'Not assigned';
    const statusEl = document.getElementById('profileStatus');
    if (statusEl) {
        const flags = [];
        if (student.isIndigenous) flags.push('INDIGENOUS PEOPLE');
        if (student.isPwd) flags.push("PWD's");
        statusEl.textContent = flags.length ? flags.join(', ') : '—';
    }
    const indigenousEl = document.getElementById('profileIndigenous');
    const pwdEl = document.getElementById('profilePwd');
    if (indigenousEl) indigenousEl.textContent = student.isIndigenous ? 'Yes' : 'No';
    if (pwdEl) pwdEl.textContent = student.isPwd ? 'Yes' : 'No';

    // Also populate main profile panel fields if present
    const nameMain = document.getElementById('profileNameMain');
    if (nameMain) nameMain.textContent = `${studentFirstName} ${studentLastName}`;
    const idMain = document.getElementById('profileStudentIdMain');
    if (idMain) idMain.textContent = studentIdValue;
    const emailMain = document.getElementById('profileEmailMain');
    if (emailMain) emailMain.textContent = student.email;
    const courseMain = document.getElementById('profileCourseMain');
    if (courseMain) courseMain.textContent = student.course;
    const deptMain = document.getElementById('profileDepartmentMain');
    if (deptMain) deptMain.textContent = student.department || '';
    const placeMain = document.getElementById('profilePlaceMain');
    if (placeMain) placeMain.textContent = student.place || '';
    const yearMain = document.getElementById('profileYearMain');
    if (yearMain) yearMain.textContent = student.year;
    const awardMain = document.getElementById('profileAwardNumberMain');
    if (awardMain) awardMain.textContent = student.awardNumber || 'Not assigned';
    const statusMain = document.getElementById('profileStatusMain');
    if (statusMain) {
        const flagsMain = [];
        if (student.isIndigenous) flagsMain.push('INDIGENOUS PEOPLE');
        if (student.isPwd) flagsMain.push("PWD's");
        statusMain.textContent = flagsMain.length ? flagsMain.join(', ') : '—';
    }
    const indigenousMain = document.getElementById('profileIndigenousMain');
    if (indigenousMain) indigenousMain.textContent = student.isIndigenous ? 'Yes' : 'No';
    const pwdMain = document.getElementById('profilePwdMain');
    if (pwdMain) pwdMain.textContent = student.isPwd ? 'Yes' : 'No';
}

// Load posts for student homepage feed
async function loadStudentHomepagePosts() {
    const container = document.getElementById('studentPostsFeed');
    if (!container) return;
    
    try {
        // Load posts from database with 'students' audience
        const posts = await getPosts('students');
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <h3>Welcome to the Student Portal</h3>
                    <p>Stay updated with announcements and communicate with the administration team.</p>
                    <p style="margin-top: 1rem; color: #64748b;">No announcements yet.</p>
                </div>
            `;
            return;
        }

        // Get liked posts from localStorage
        const likedPostsKey = 'likedPosts';
        const likedPosts = JSON.parse(localStorage.getItem(likedPostsKey) || '[]');
        const normalizedLikedPosts = likedPosts.map(id => typeof id === 'number' ? id : parseInt(id));

        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            if (post.images) {
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                } else if (typeof post.images === 'string') {
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                imageArray = imageArray.map(img => {
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                imageArray = imageArray.filter(img => {
                    return img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                });
                
                if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') ||
                        item.includes('video/webm') ||
                        item.includes('video/mp4') ||
                        /\.(webm|mp4)(\?|#|$)/i.test(item)
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;" src="${resolveMediaUrl(item)}" preload="metadata">
                                    <source src="${resolveMediaUrl(item)}" type="video/webm">
                                    <source src="${resolveMediaUrl(item)}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                        const imageUrl = resolveMediaUrl(item);
                        imagesHtml = `<div class="post-image-container"><img src="${imageUrl}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block; cursor: pointer;" onclick="openImageLightbox(['${imageUrl.replace(/'/g, "\\'")}'], 0)"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    imagesHtml = renderCarousel(imageArray);
                }
            }
            
            return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author">
                            <div class="post-avatar"><i class="fas fa-user-shield"></i></div>
                            <div class="post-author-info">
                                <span class="post-author-name">Administrator</span>
                                <span class="post-time">${formatDate(post.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${post.content || ''}</p>
                        ${imagesHtml}
                    </div>
                    <div class="post-engagement">
                        <div class="post-reactions">
                            <span class="reactions-count"><span class="count-num">${post.likes || 0}</span> <span class="count-label">likes</span></span>
                            <span class="comments-count"><span class="count-num">${post.comments_count || 0}</span> <span class="count-label">comments</span></span>
                        </div>
                        <div class="post-actions">
                            ${(() => {
                                const normalizedPostId = typeof post.id === 'number' ? post.id : parseInt(post.id);
                                const isLiked = normalizedLikedPosts.includes(normalizedPostId);
                                const likedClass = isLiked ? ' liked' : '';
                                const likeText = isLiked ? 'Liked' : 'Like';
                                return `<button class="action-btn like-btn${likedClass}" onclick="studentToggleLike(${post.id})">
                                <i class="fas fa-thumbs-up"></i>
                                <span>${likeText}</span>
                            </button>`;
                            })()}
                            <button class="action-btn comment-btn" onclick="studentToggleComments(${post.id})">
                                <i class="fas fa-comment"></i>
                                <span>Comment</span>
                            </button>
                        </div>
                        <div id="student-comments-${post.id}" class="comments-section" style="display: none;">
                            <div id="student-comments-list-${post.id}" data-loaded="false"></div>
                            <div class="comment-input-container">
                                <input type="text" placeholder="Write a comment..." id="studentCommentInput-${post.id}" class="comment-input" onkeypress="if(event.key==='Enter') studentCommentPost(${post.id})">
                                <button onclick="studentCommentPost(${post.id})" class="comment-submit-btn">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        normalizePostVideos();
        normalizePostVideos();
        
    } catch (error) {
        console.error('Error loading student homepage posts:', error);
        container.innerHTML = `
            <div class="welcome-message">
                <h3>Welcome to the Student Portal</h3>
                <p>Error loading posts. Please try refreshing the page.</p>
            </div>
        `;
    }
}

// Load posts for public home page
async function loadHomeFeed() {
    const container = document.getElementById('homeFeed');
    if (!container) return;
    
    try {
        // Load posts from database with 'home' audience
        const posts = await getPosts('home');
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <p>No announcements yet. Check back soon for updates!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            if (post.images) {
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                } else if (typeof post.images === 'string') {
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                imageArray = imageArray.map(img => {
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                imageArray = imageArray.filter(img => {
                    return img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                });
                
                if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4') ||
                        /\.(webm|mp4)(\?|#|$)/i.test(item)
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;" src="${resolveMediaUrl(item)}" preload="metadata">
                                    <source src="${resolveMediaUrl(item)}" type="video/webm">
                                    <source src="${resolveMediaUrl(item)}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                        imagesHtml = `<div class="post-image-container"><img src="${item}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    imagesHtml = renderCarousel(imageArray);
                }
            }
            
            return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author">
                            <div class="post-avatar"><i class="fas fa-user-shield"></i></div>
                            <div class="post-author-info">
                                <span class="post-author-name">Administrator</span>
                                <span class="post-time">${formatDate(post.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${post.content || ''}</p>
                        ${imagesHtml}
                    </div>
                    <div class="post-engagement">
                        <div class="post-reactions">
                            <span class="reactions-count"><span class="count-num">${post.likes || 0}</span> <span class="count-label">likes</span></span>
                            <span class="comments-count"><span class="count-num">${post.comments_count || 0}</span> <span class="count-label">comments</span></span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading home feed:', error);
        container.innerHTML = `
            <div class="welcome-message">
                <p>Error loading posts. Please try refreshing the page.</p>
            </div>
        `;
    }
}

async function loadStudentHomepage() {
    // Load posts for student homepage
    await loadStudentHomepagePosts();
    // Load notifications
    if (typeof loadStudentNotifications === 'function') {
        loadStudentNotifications();
    }
}

async function loadStudentAnnouncements() {
    const container = document.getElementById('studentAnnouncementsFeed');
    if (!container) return;
    
    try {
        // Load posts from database with 'students' audience
        const posts = await getPosts('students');
        
        if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="no-posts">
                <i class="fas fa-newspaper"></i>
                <h4>No announcements yet</h4>
                <p>The administration hasn't posted any announcements yet.</p>
            </div>
        `;
        return;
    }

        // Get liked posts from localStorage
        const likedPostsKey = 'likedPosts';
        const likedPosts = JSON.parse(localStorage.getItem(likedPostsKey) || '[]');
        const normalizedLikedPosts = likedPosts.map(id => typeof id === 'number' ? id : parseInt(id));

        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            if (post.images) {
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                } else if (typeof post.images === 'string') {
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                imageArray = imageArray.map(img => {
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                imageArray = imageArray.filter(img => {
                    return img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                });
                
                if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${item}" type="video/webm">
                                    <source src="${item}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                        const imageUrl = resolveMediaUrl(item);
                        imagesHtml = `<div class="post-image-container"><img src="${imageUrl}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block; cursor: pointer;" onclick="openImageLightbox(['${imageUrl.replace(/'/g, "\\'")}'], 0)"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    imagesHtml = renderCarousel(imageArray);
                }
            }
        
        return `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-author-avatar">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <div class="post-author-info">
                            <h4>Administrator</h4>
                            <p>${formatDate(post.created_at)}</p>
                    </div>
                </div>
                <div class="post-content">
                        ${imagesHtml}
                        <div class="post-text">${post.content || ''}</div>
                </div>
                <div class="post-actions">
                        ${(() => {
                            const normalizedPostId = typeof post.id === 'number' ? post.id : parseInt(post.id);
                            const isLiked = normalizedLikedPosts.includes(normalizedPostId);
                            const likedClass = isLiked ? ' liked' : '';
                            return `<button class="post-action-btn${likedClass}" onclick="studentToggleLike(${post.id})">
                        <i class="fas fa-heart"></i>
                            <span>${post.likes || 0}</span>
                    </button>`;
                        })()}
                        <button class="post-action-btn" onclick="studentToggleComments(${post.id})">
                        <i class="fas fa-comment"></i>
                            <span>${post.comments_count || 0}</span>
                    </button>
                </div>
                    <div class="comments-section" id="student-comments-${post.id}" style="display: none;">
                        <div id="student-comments-list-${post.id}" data-loaded="false"></div>
                    <div class="comment-form">
                            <input type="text" class="comment-input" placeholder="Write a comment..." id="studentCommentInput-${post.id}" onkeypress="if(event.key==='Enter') studentCommentPost(${post.id})">
                            <button class="comment-btn" onclick="studentCommentPost(${post.id})">Comment</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
        
        // Load comments for each post when they're opened
        
    } catch (error) {
        console.error('Error loading student announcements:', error);
        container.innerHTML = `
            <div class="no-posts">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Error loading announcements</h4>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

async function loadStudentMessages() {
    const container = document.getElementById('studentChatMessages');
    if (!container) return;
    
    try {
        // Get student ID and normalize it
        const studentId = currentUser?.studentData?.id || currentUser?.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            container.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-comments"></i>
                    <h4>Error</h4>
                    <p>Student ID not found.</p>
                </div>
            `;
            return;
        }
        
        // Load messages from database
        const messages = await getMessages(
            normalizedStudentId, 
            'student', 
            1, // Admin ID
            'admin'
        );
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-comments"></i>
                    <h4>No messages yet</h4>
                    <p>Start a conversation with the administration team.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(message => {
            const isStudent = message.senderType === 'student';
            const time = new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            return `
                <div class="message-item ${isStudent ? 'sent' : 'received'}">
                    <div class="message-avatar">${isStudent ? 'S' : 'A'}</div>
                    <div class="message-bubble">
                        <div class="message-text">${message.content}</div>
                        <div class="message-time">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = `
            <div class="no-messages">
                <i class="fas fa-comments"></i>
                <h4>Error loading messages</h4>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


function loadStudentNotifications() {
    const container = document.getElementById('notificationsContainer');
    const studentNotifications = notifications.filter(n => n.studentId === currentUser.studentData.id);
    
    if (studentNotifications.length === 0) {
        container.innerHTML = '<p class="no-notifications">No notifications yet.</p>';
        return;
    }
    
    container.innerHTML = studentNotifications.map(notification => `
        <div class="notification-item ${notification.read ? '' : 'unread'}">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <div class="timestamp">${formatDate(notification.date)}</div>
        </div>
    `).join('');
}

function submitApplication(event) {
    event.preventDefault();
    
    const idPicture = document.getElementById('idPictureUpload').files[0];
    const idNumber = document.getElementById('idNumber').value.trim();
    const cor = document.getElementById('corUpload').files[0];
    const notes = document.getElementById('applicationNotes').value;
    
    // Require at least one file
    if (!idPicture && !cor) {
        showToast('Please upload at least one document (ID Picture or COR)', 'error');
        return;
    }

    // Build a single application bundling provided documents
    const attachedDocuments = [];
    let combinedTypeLabels = [];
    let representativeFileName = 'Multiple files';

    if (idPicture) {
        combinedTypeLabels.push('ID Picture');
        attachedDocuments.push({ type: 'ID Picture', fileName: idPicture.name, fileDataUrl: null });
        representativeFileName = idPicture.name;
    }
    if (cor) {
        combinedTypeLabels.push('COR');
        attachedDocuments.push({ type: 'COR', fileName: cor.name, fileDataUrl: null });
        representativeFileName = idPicture ? 'Multiple files' : cor.name;
    }
    if (idNumber) {
        combinedTypeLabels.push('ID Number');
    }

    const newApplication = {
        id: applications.length + 1,
        studentId: currentUser.studentData.id,
        documentType: combinedTypeLabels.join(' + '),
        fileName: representativeFileName,
        notes: notes,
        status: 'submitted',
        submittedDate: new Date().toISOString().split('T')[0],
        reviewedDate: null,
        reviewerNotes: null,
        fileDataUrl: null,
        documentFiles: attachedDocuments
    };
    applications.push(newApplication);

    // Store data URLs for preview and save student's ID picture if provided
    const processFileToDataUrl = (file, indexInDocs) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            if (newApplication.documentFiles && newApplication.documentFiles[indexInDocs]) {
                newApplication.documentFiles[indexInDocs].fileDataUrl = e.target.result;
            }
            if (indexInDocs !== null && newApplication.documentFiles[indexInDocs].type === 'ID Picture') {
                const studentIndex = students.findIndex(s => s.id === currentUser.studentData.id);
                students[studentIndex].idPictureDataUrl = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    };

    // Read files
    if (idPicture) processFileToDataUrl(idPicture, 0);
    if (cor) processFileToDataUrl(cor, idPicture ? 1 : 0);
    
    // Update student status - application submitted
    const studentIndex = students.findIndex(s => s.id === currentUser.studentData.id);
    // Application status is now managed through the new process, not via pending/approved/rejected
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Add notification
    addNotification(currentUser.studentData.id, 'Application Submitted', 
        'Your documents have been submitted and are under review.');
    
    showToast('Application submitted successfully!', 'success');
    
    // Reset form
    document.getElementById('applicationNotes').value = '';
    const idPictureInput = document.getElementById('idPictureUpload');
    const idCardInput = document.getElementById('idNumber');
    const corInput = document.getElementById('corUpload');
    if (idPictureInput) idPictureInput.value = '';
    if (idCardInput) idCardInput.value = '';
    if (corInput) corInput.value = '';
    
    // Reload dashboard
    loadStudentDashboard();
}

// (Removed legacy showStudentTab for #student-dashboard to avoid conflicts)

// Admin Dashboard Functions
async function loadAdminDashboard() {
    console.log('🏠 loadAdminDashboard called');
    
    // Show admin homepage by default
    const adminHomepage = document.getElementById('admin-homepage');
    const tabContent = document.querySelector('.tab-content');
    
    if (adminHomepage) {
    adminHomepage.style.display = 'block';
    }
    if (tabContent) {
    tabContent.style.display = 'none';
    }
    
    // Wait a bit to ensure DOM is ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Load students from database and update stats FIRST
    console.log('📊 Updating admin stats...');
    await updateAdminStats();
    
    // Load admin posts
    if (typeof loadAdminPosts === 'function') {
    loadAdminPosts();
    }
    
    // Load applications
    if (typeof loadApplications === 'function') {
    loadApplications();
    }
    
    // Load students
    if (typeof loadStudents === 'function') {
    loadStudents();
    }
    
    // Initialize chat
    if (typeof initializeChat === 'function') {
    initializeChat();
    }
    
    // Also update stats again after a short delay to ensure everything is loaded
    setTimeout(async () => {
        console.log('🔄 Refreshing stats after delay...');
        await updateAdminStats();
    }, 500);
}

// Update admin dashboard statistics from database
async function updateAdminStats() {
    console.log('🔄 updateAdminStats called');
    
    try {
        // Get students from database
        console.log('📡 Fetching students from database...');
        const studentsFromDB = await getStudentsFromDatabase();
        console.log('✅ Students fetched:', studentsFromDB ? studentsFromDB.length : 0, 'students');
        
        // Find the stat elements
        const totalStudentsEl = document.getElementById('totalStudents');
        const totalIndigenousEl = document.getElementById('totalIndigenous');
        const totalPwdEl = document.getElementById('totalPwd');
        const totalArchivedEl = document.getElementById('totalArchived');
        
        console.log('🔍 Element check:', {
            totalStudents: !!totalStudentsEl,
            totalIndigenous: !!totalIndigenousEl,
            totalPwd: !!totalPwdEl,
            totalArchived: !!totalArchivedEl
        });
        
        if (!totalStudentsEl || !totalIndigenousEl || !totalPwdEl || !totalArchivedEl) {
            console.error('❌ Stat elements not found!');
            return;
        }
        
        if (!studentsFromDB || studentsFromDB.length === 0) {
            // Set all stats to 0 if no students
            console.log('📊 No students found, setting all stats to 0');
            totalStudentsEl.textContent = '0';
            totalIndigenousEl.textContent = '0';
            totalPwdEl.textContent = '0';
            totalArchivedEl.textContent = '0';
            return;
        }
        
        // Calculate statistics
        const totalStudents = studentsFromDB.length;
        
        // Check for indigenous students - handle multiple possible field names and values
        const indigenousStudents = studentsFromDB.filter(s => {
            const isIndigenous = s.isIndigenous === true || 
                               s.isIndigenous === 1 || 
                               s.isIndigenous === '1' ||
                               s.is_indigenous === 1 || 
                               s.is_indigenous === true ||
                               s.is_indigenous === '1';
            return isIndigenous;
        }).length;
        
        // Check for PWD students
        const pwdStudents = studentsFromDB.filter(s => {
            const isPwd = s.isPwd === true || 
                         s.isPwd === 1 || 
                         s.isPwd === '1' ||
                         s.is_pwd === 1 || 
                         s.is_pwd === true ||
                         s.is_pwd === '1';
            return isPwd;
        }).length;
        
        // Check for archived students
        const archivedStudents = studentsFromDB.filter(s => {
            const status = s.status || s.student_status || 'active';
            return status.toLowerCase() === 'archived';
        }).length;
        
        // Update the display
        totalStudentsEl.textContent = totalStudents;
        totalIndigenousEl.textContent = indigenousStudents;
        totalPwdEl.textContent = pwdStudents;
        totalArchivedEl.textContent = archivedStudents;
        
        console.log('✅ Admin stats updated:', {
            totalStudents,
            indigenousStudents,
            pwdStudents,
            archivedStudents
        });
        
    } catch (error) {
        console.error('❌ Error updating admin stats:', error);
        console.error('Error details:', error.stack);
        
        // Set to 0 on error and show error message
        const elements = ['totalStudents', 'totalIndigenous', 'totalPwd', 'totalArchived'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '0';
                el.style.color = '#ef4444'; // Red color to indicate error
            }
        });
        
        // Try to show error toast if available
        if (typeof showToast === 'function') {
            showToast('Failed to load statistics. Please refresh the page.', 'error');
        }
    }
}

function loadApplications() {
    const container = document.getElementById('applicationsContainer');
    const filteredApplications = filterApplicationsByStatus().filter(app => app && app.documentType);
    
    if (filteredApplications.length === 0) {
        container.innerHTML = '<p class="no-data">No applications found.</p>';
        return;
    }
    
    container.innerHTML = filteredApplications.map(app => {
        const student = students.find(s => s.id === app.studentId) || { firstName: '', lastName: '', studentId: '' };
        return `
            <div class="application-item">
                <div class="application-header">
                    <h4>${student.firstName} ${student.lastName}</h4>
                    <span class="status-badge status-${app.status}">${app.status}</span>
                </div>
                <div class="application-info">
                    <div class="info-item">
                        <span class="info-label">Student ID</span>
                        <span class="info-value">${student.studentId}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Document Type</span>
                        <span class="info-value">${app.documentType}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Submitted Date</span>
                        <span class="info-value">${formatDate(app.submittedDate)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Status</span>
                        <span class="info-value">${app.status}</span>
                    </div>
                </div>
                <div class="application-actions">
                    <button class="btn btn-secondary" onclick="viewApplicationDetails(${app.id})">View Details</button>
                </div>
            </div>
        `;
    }).join('');
}

function loadStudents() {
    const container = document.getElementById('studentsContainer');
    const filteredStudents = filterStudentsByStatus();
    
    if (filteredStudents.length === 0) {
        container.innerHTML = '<p class="no-data">No students found.</p>';
        return;
    }
    
    container.innerHTML = filteredStudents.map((student, index) => {
        return `
            <div class="student-item">
                <div class="student-header">
                    <h4><span class="student-index">${index + 1}</span>${student.firstName} ${student.lastName}</h4>
                </div>
                <div class="student-info">
                    <div class="info-item">
                        <span class="info-label">Student ID</span>
                        <span class="info-value">${student.studentId || 'N/A'}</span>
                    </div>
                </div>
                <div class="student-actions">
                    <button class="btn btn-secondary" onclick="openStudentProfileModal(${student.id || student.student_id})">View Profile</button>
                    <button class="btn btn-secondary" onclick="editStudent(${student.id})">Edit</button>
                    <button class="btn btn-secondary" onclick="archiveStudent(${student.id})">Archive</button>
                    <button class="btn btn-danger" onclick="deleteStudent(${student.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Admin Tab Functions
function showAdminTab(tabName) {
    // Update bottom navigation tab buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide admin homepage and show tab content
    const adminHomepage = document.getElementById('admin-homepage');
    const tabContent = document.querySelector('.tab-content');
    
    if (tabName === 'homepage') {
        adminHomepage.style.display = 'block';
        tabContent.style.display = 'none';
    } else {
        adminHomepage.style.display = 'none';
        tabContent.style.display = 'block';
        
        // Update tab panels
        document.querySelectorAll('#admin-dashboard .tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }
    
    // Load tab-specific content
    if (tabName === 'reports') {
        loadReports();
    }
}

// Quick action: show the Students tab and tabs
function openManageStudents() {
    const adminSection = document.getElementById('admin-dashboard');
    const homepageContent = document.getElementById('admin-homepage');
    const tabContent = adminSection ? adminSection.querySelector('.tab-content') : null;
    const navTabs = adminSection ? adminSection.querySelector('.admin-nav-tabs') : null;
    
    if (adminSection && homepageContent && tabContent && navTabs) {
        homepageContent.style.display = 'none';
        tabContent.style.display = 'block';
        navTabs.style.display = 'flex';
        
        // Hide all tab panels
        adminSection.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.style.display = 'none';
        });
        
        // Show students tab
        const studentsTab = document.getElementById('students-tab');
        if (studentsTab) {
            studentsTab.classList.add('active');
            studentsTab.style.display = 'block';
        }
        
        // Update button states
        adminSection.querySelectorAll('.nav-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const studentsBtn = Array.from(adminSection.querySelectorAll('.nav-tab-btn')).find(btn => 
            btn.textContent.trim() === 'Students'
        );
        if (studentsBtn) {
            studentsBtn.classList.add('active');
        }
        
        // Load students
        loadStudents();
    } else {
    showAdminTab('students');
    }
}

// Student Names List Modal Functions
let allStudentsList = [];
let filteredStudentsList = [];

// Messages List Variables
let allMessagesList = [];
let currentMessagesTab = 'unread';
let readMessagesMap = {}; // Map to track which messages have been read

function openStudentNamesList() {
    const modal = document.getElementById('studentNamesListModal');
    if (modal) {
        modal.style.display = 'block';
        // Reset to unread tab by default
        currentMessagesTab = 'unread';
        switchMessagesTab('unread');
        loadStudentNamesList();
        loadMessagesList();
    }
}

// Function to check and update notification badge periodically
async function checkAndUpdateNotificationBadge() {
    // Only update if admin is logged in
    if (!currentUser || currentUser.role !== 'admin') {
        return;
    }
    
    // Load read status
    const storedReadStatus = localStorage.getItem('adminReadMessages');
    let readMap = {};
    if (storedReadStatus) {
        try {
            readMap = JSON.parse(storedReadStatus);
        } catch (e) {
            readMap = {};
        }
    }
    
    let unreadCount = 0;
    
    try {
        // Get students list to fetch messages from
        const studentsList = await getStudentsFromDatabase();
        if (!studentsList || !Array.isArray(studentsList) || studentsList.length === 0) {
            // Fallback to localStorage if database fetch fails
            const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
            if (localStudents.length === 0) {
                // No students, no messages
                updateBadgeDisplay(0);
                return;
            }
        }
        
        const studentsToCheck = studentsList && Array.isArray(studentsList) && studentsList.length > 0 
            ? studentsList 
            : JSON.parse(localStorage.getItem('students') || '[]');
        
        // Fetch messages from database for all students
        if (studentsToCheck.length > 0 && typeof getMessages === 'function') {
            const messagePromises = studentsToCheck.map(async (student) => {
                const normalizedStudentId = typeof student.id === 'number' 
                    ? student.id 
                    : parseInt(student.id) || student.id;
                if (!normalizedStudentId) return [];
                
                try {
                    // Get messages from this student to admin (receiverId = 1, receiverType = 'admin')
                    const msgs = await getMessages(normalizedStudentId, 'student', 1, 'admin');
                    if (Array.isArray(msgs) && msgs.length > 0) {
                        // Filter: Only include messages sent BY student TO admin (exclude admin's own messages)
                        return msgs
                            .filter(m => {
                                const senderType = m.senderType || m.sender || '';
                                const senderId = m.senderId || m.sender_id || 0;
                                const receiverId = m.receiverId || m.receiver_id || 0;
                                
                                // Exclude messages sent by admin (admin ID is 1)
                                if (senderId === 1 || senderId === '1' || senderType === 'admin') {
                                    return false;
                                }
                                
                                // Include only messages where:
                                // 1. Sender is the student (senderId matches student ID)
                                // 2. Receiver is admin (receiverId is 1)
                                // 3. Sender type is student or user
                                const isFromStudent = (senderId === normalizedStudentId || String(senderId) === String(normalizedStudentId));
                                const isToAdmin = (receiverId === 1 || receiverId === '1');
                                const isValidSenderType = (senderType === 'student' || senderType === 'user' || senderType === '');
                                
                                return isFromStudent && isToAdmin && isValidSenderType;
                            })
                            .map(m => ({
                                ...m,
                                studentId: normalizedStudentId
                            }));
                    }
                    return [];
                } catch (e) {
                    console.log(`Error fetching messages for student ${normalizedStudentId}:`, e);
                    return [];
                }
            });
            
            const messageArrays = await Promise.all(messagePromises);
            const allMessages = messageArrays.flat();
            
            // Count unread messages
            allMessages.forEach(msg => {
                const timestamp = msg.createdAt || msg.timestamp || '';
                const content = msg.content || msg.text || '';
                const studentId = msg.studentId || '';
                const key = `${timestamp}_${content}_${studentId}`;
                
                if (!readMap[key]) {
                    unreadCount++;
                }
            });
            
            // Update allMessagesList for use in other functions
            allMessagesList = allMessages.map(m => {
                const student = studentsToCheck.find(s => {
                    const sId = s.id || s.student_id || s.studentId;
                    return String(sId) === String(m.studentId);
                });
                return {
                    ...m,
                    studentName: student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : 'Unknown Student',
                    studentEmail: student ? (student.email || '') : '',
                    studentIdNumber: student ? (student.studentId || student.student_id || '') : ''
                };
            });
        } else {
            // Fallback: check localStorage messages
            loadPersistedChatMessages();
    if (chatMessages && Array.isArray(chatMessages)) {
        chatMessages.forEach(m => {
                    // Only count messages FROM students TO admin (not admin's own messages)
                    const senderType = m.senderType || m.sender || '';
                    const senderId = m.senderId || m.sender_id || 0;
                    const receiverId = m.receiverId || m.receiver_id || 0;
                    const receiverType = m.receiverType || m.receiver || '';
                    
                    // Check if it's a message from student to admin
                    const isStudentMessage = (senderType === 'student' || senderType === 'user' || senderType === '') &&
                                            senderId !== 1 && senderId !== '1' &&
                                            (receiverId === 1 || receiverId === '1' || receiverType === 'admin' || 
                                             m.receiverType === 'admin' || m.adminId === 1);
                    
                    // Exclude messages sent by admin (admin ID is 1)
                    const isAdminMessage = senderId === 1 || senderId === '1' || senderType === 'admin';
                    
                    if (!isStudentMessage || isAdminMessage) return;
            
            const timestamp = m.timestamp || m.createdAt || '';
            const content = m.text || m.content || '';
            const studentId = m.studentId || m.receiverId || m.senderId || '';
            const key = `${timestamp}_${content}_${studentId}`;
            
            if (!readMap[key]) {
                unreadCount++;
            }
        });
    }
        }
    } catch (error) {
        console.error('Error checking notification badge:', error);
        // Fallback to cached count if database fetch fails
    if (allMessagesList && allMessagesList.length > 0) {
        unreadCount = allMessagesList.filter(msg => {
            const timestamp = msg.createdAt || msg.timestamp || '';
            const content = msg.content || msg.text || '';
            const studentId = msg.studentId || '';
            const key = `${timestamp}_${content}_${studentId}`;
            return !readMap[key];
        }).length;
        }
    }
    
    // Update badge display
    updateBadgeDisplay(unreadCount);
}

// Helper function to update badge display
function updateBadgeDisplay(unreadCount) {
    const notificationButtonBadge = document.getElementById('notificationMessageBadge');
    if (notificationButtonBadge) {
        notificationButtonBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        notificationButtonBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        
        if (unreadCount > 0) {
            notificationButtonBadge.classList.add('has-unread');
        } else {
            notificationButtonBadge.classList.remove('has-unread');
        }
    }
}

// Function to check and update student notification badges
async function checkAndUpdateStudentNotificationBadges() {
    // Only update if student is logged in
    if (!currentUser || currentUser.role !== 'student') {
        return;
    }
    
    try {
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            return;
        }
        
        let announcementsCount = 0;
        let messagesCount = 0;
        let notificationsCount = 0;
        
        // Check for new announcements/posts from admin
        try {
            const posts = await getPosts('students'); // Get posts visible to students
            if (posts && Array.isArray(posts)) {
                // Get last viewed posts timestamp from localStorage
                const lastViewedPosts = localStorage.getItem('studentLastViewedPosts') || '0';
                const lastViewedTime = parseInt(lastViewedPosts) || 0;
                
                // Count posts created after last viewed time
                announcementsCount = posts.filter(post => {
                    const postTime = new Date(post.created_at || post.createdAt || post.timestamp || 0).getTime();
                    return postTime > lastViewedTime;
                }).length;
            }
        } catch (error) {
            console.log('Error checking announcements:', error);
        }
        
        // Check for new messages from admin
        try {
            if (typeof getMessages === 'function') {
                // Get messages from admin (senderId = 1, senderType = 'admin') to this student
                const messagesFromAdmin = await getMessages(1, 'admin', normalizedStudentId, 'student');
                
                if (Array.isArray(messagesFromAdmin) && messagesFromAdmin.length > 0) {
                    // Get last viewed messages timestamp from localStorage
                    const lastViewedMessages = localStorage.getItem('studentLastViewedMessages') || '0';
                    const lastViewedTime = parseInt(lastViewedMessages) || 0;
                    
                    // Count messages from admin that are unread (created after last viewed)
                    messagesCount = messagesFromAdmin.filter(msg => {
                        // Only count messages sent by admin (not student's own messages)
                        const senderType = msg.senderType || msg.sender || '';
                        const senderId = msg.senderId || msg.sender_id || 0;
                        
                        // Only count if sent by admin
                        if (senderId !== 1 && senderId !== '1' && senderType !== 'admin') {
                            return false;
                        }
                        
                        const msgTime = new Date(msg.createdAt || msg.timestamp || 0).getTime();
                        return msgTime > lastViewedTime;
                    }).length;
                }
            }
        } catch (error) {
            console.log('Error checking messages:', error);
        }
        
        // Total notifications = announcements + messages
        notificationsCount = announcementsCount + messagesCount;
        
        // Update badges
        updateStudentBadgeDisplay('studentAnnouncementsBadge', announcementsCount);
        updateStudentBadgeDisplay('studentMessagesBadge', messagesCount);
        updateStudentBadgeDisplay('studentNotificationsBadge', notificationsCount);
        
    } catch (error) {
        console.error('Error checking student notification badges:', error);
    }
}

// Helper function to update student badge display
function updateStudentBadgeDisplay(badgeId, count) {
    const badge = document.getElementById(badgeId);
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

function closeStudentNamesListModal() {
    const modal = document.getElementById('studentNamesListModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Store current selected claim date
let currentSelectedClaimDate = null;

// Open Students Claimed Date Modal
async function openStudentsClaimedDate() {
    const modal = document.getElementById('studentsClaimedDateModal');
    if (modal) {
        modal.style.display = 'block';
        currentSelectedClaimDate = null;
        await loadClaimDatesList();
    }
}

// Close Students Claimed Date Modal
function closeStudentsClaimedDateModal() {
    const modal = document.getElementById('studentsClaimedDateModal');
    if (modal) {
        modal.style.display = 'none';
        currentSelectedClaimDate = null;
        // Reset views
        document.getElementById('claimDatesListView').style.display = 'block';
        document.getElementById('studentsListView').style.display = 'none';
    }
}

// Load Claim Dates List
async function loadClaimDatesList() {
    const container = document.getElementById('claimDatesList');
    if (!container) return;
    
    try {
        // Get claim dates from localStorage (or database if available)
        let claimDates = JSON.parse(localStorage.getItem('claimDates') || '[]');
        
        // Sort by date (newest first)
        claimDates.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        if (claimDates.length === 0) {
            container.innerHTML = '<div class="no-data">No claim dates created yet. Click "Create Date" to add one.</div>';
            return;
        }
        
        container.innerHTML = claimDates.map((claimDate, index) => {
            const dateStr = claimDate.date || '';
            const dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }) : 'Invalid Date';
            const description = claimDate.description || '';
            const studentCount = claimDate.claimedStudentIds ? claimDate.claimedStudentIds.length : 0;
            
            return `
                <div class="claim-date-item" onclick="selectClaimDate('${dateStr}')" style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; background: white; transition: all 0.2s;" 
                     onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 2px 4px rgba(59,130,246,0.1)';" 
                     onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 16px; margin-bottom: 0.25rem;">
                                <i class="fas fa-calendar-check" style="color: #3b82f6; margin-right: 0.5rem;"></i>
                                ${dateDisplay}
                            </div>
                            ${description ? `<div style="color: #64748b; font-size: 14px; margin-top: 0.25rem;">${description}</div>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="font-weight: 600; color: #3b82f6; font-size: 18px;">${studentCount}</div>
                            <div style="color: #64748b; font-size: 12px;">student${studentCount !== 1 ? 's' : ''}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading claim dates:', error);
        container.innerHTML = '<div class="no-data">Error loading claim dates. Please try again.</div>';
    }
}

// Select a claim date and show students
async function selectClaimDate(dateStr) {
    currentSelectedClaimDate = dateStr;
    
    // Show students view, hide dates view
    document.getElementById('claimDatesListView').style.display = 'none';
    document.getElementById('studentsListView').style.display = 'block';
    
    // Update title
    const title = document.getElementById('selectedDateTitle');
    if (title) {
        const dateDisplay = new Date(dateStr).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        title.textContent = `Students for ${dateDisplay}`;
    }
    
    // Load students for this date
    await loadClaimedDateStudents(dateStr);
}

// Back to dates list
function backToDatesList() {
    currentSelectedClaimDate = null;
    document.getElementById('claimDatesListView').style.display = 'block';
    document.getElementById('studentsListView').style.display = 'none';
    document.getElementById('claimedDateSearch').value = '';
    document.getElementById('claimedDateFilterCourse').value = '';
    document.getElementById('claimedDateFilterDepartment').value = '';
}

// Open Create Claim Date Modal
function openCreateClaimDateModal() {
    const modal = document.getElementById('createClaimDateModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('claimDateInput').value = '';
        document.getElementById('claimDateDescription').value = '';
    }
}

// Close Create Claim Date Modal
function closeCreateClaimDateModal() {
    const modal = document.getElementById('createClaimDateModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('createClaimDateForm').reset();
    }
}

// Handle Create Claim Date Form Submission
async function handleCreateClaimDate(event) {
    event.preventDefault();
    
    const dateInput = document.getElementById('claimDateInput').value;
    const description = document.getElementById('claimDateDescription').value.trim();
    
    if (!dateInput) {
        showToast('Please select a date', 'error');
        return;
    }
    
    try {
        // Get existing claim dates
        let claimDates = JSON.parse(localStorage.getItem('claimDates') || '[]');
        
        // Check if date already exists
        const existingDate = claimDates.find(cd => cd.date === dateInput);
        if (existingDate) {
            showToast('This claim date already exists', 'error');
            return;
        }
        
        // Add new claim date
        const newClaimDate = {
            id: Date.now(),
            date: dateInput,
            description: description,
            createdAt: new Date().toISOString(),
            claimedStudentIds: [] // Start with empty array - students will claim later
        };
        
        claimDates.push(newClaimDate);
        localStorage.setItem('claimDates', JSON.stringify(claimDates));
        
        showToast('Claim date created successfully!', 'success');
        closeCreateClaimDateModal();
        await loadClaimDatesList();
        
    } catch (error) {
        console.error('Error creating claim date:', error);
        showToast('Failed to create claim date: ' + error.message, 'error');
    }
}

// Load Students Claimed Date List (for selected date)
async function loadClaimedDateStudents(selectedDate = null) {
    const container = document.getElementById('claimedDateListContent');
    const countElement = document.getElementById('claimedDateCount');
    
    if (!container) return;
    
    // Use selected date or current selected date
    const dateToUse = selectedDate || currentSelectedClaimDate;
    
    if (!dateToUse) {
        container.innerHTML = '<div class="no-data">Please select a claim date first.</div>';
        return;
    }
    
    try {
        // Get all registered students from database or localStorage
        let studentsList = [];
        try {
            if (typeof getStudentsFromDatabase === 'function') {
                studentsList = await getStudentsFromDatabase();
            }
        } catch (error) {
            console.log('Error fetching students from database:', error);
        }
        
        if (!studentsList || !Array.isArray(studentsList) || studentsList.length === 0) {
            studentsList = JSON.parse(localStorage.getItem('students') || '[]');
        }
        
        // Filter to only registered students (students that exist in the students array)
        const registeredStudents = studentsList.filter(student => {
            // A student is considered registered if they have an ID and are in the students list
            return student && (student.id || student.student_id);
        });
        
        if (registeredStudents.length === 0) {
            container.innerHTML = '<div class="no-data">No registered students found.</div>';
            if (countElement) countElement.textContent = '0 students';
            return;
        }
        
        // Apply filters
        const filtered = applyClaimedDateFilters(registeredStudents);
        
        // Update count
        if (countElement) {
            countElement.textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;
        }
        
        // Render students
        if (filtered.length === 0) {
            container.innerHTML = '<div class="no-data">No students match your filters.</div>';
            return;
        }
        
        // Get claimed students for this date
        const claimDates = JSON.parse(localStorage.getItem('claimDates') || '[]');
        const currentClaimDate = claimDates.find(cd => cd.date === dateToUse);
        const claimedStudentIds = currentClaimDate && currentClaimDate.claimedStudentIds 
            ? currentClaimDate.claimedStudentIds 
            : [];
        
        container.innerHTML = filtered.map((student, index) => {
            const firstName = student.firstName || student.first_name || '';
            const lastName = student.lastName || student.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Student';
            const studentId = student.studentId || student.student_id || '';
            const studentDbId = student.id || student.student_id || studentId;
            const email = student.email || '';
            const course = student.course || '';
            const department = student.department || '';
            const year = student.year || student.yearLevel || student.year_level || '';
            const awardNumber = student.awardNumber || student.award_number || '';
            
            // Check if student has claimed for this date
            const isClaimed = claimedStudentIds.includes(String(studentDbId)) || 
                            claimedStudentIds.includes(studentDbId) ||
                            claimedStudentIds.includes(String(studentId)) ||
                            claimedStudentIds.includes(studentId);
            
            const claimButton = isClaimed 
                ? `<span style="padding: 8px 20px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; min-width: 100px; display: inline-block; text-align: center; cursor: default;">
                    <i class="fas fa-check-circle"></i> Claimed
                   </span>`
                : `<button onclick="handleStudentClaim(${studentDbId}, '${dateToUse.replace(/'/g, "\\'")}')" data-student-id="${studentDbId}" data-claim-date="${dateToUse.replace(/"/g, '&quot;')}" style="padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; min-width: 100px;">
                    <i class="fas fa-hand-holding"></i> Claim
                   </button>`;
            
            return `
                <div class="student-item claimed-date-item" style="padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.75rem; background: white;">
                    <div class="student-header" style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; color: #1e293b; font-size: 16px;">
                            <span class="student-index" style="margin-right: 0.5rem; color: #3b82f6; font-weight: 600;">${index + 1}.</span>
                            ${fullName}
                        </h4>
                        ${claimButton}
                    </div>
                    <div class="student-info" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.5rem; font-size: 14px;">
                        <div class="info-row" style="display: flex; gap: 0.5rem;">
                            <span class="info-label" style="color: #64748b; font-weight: 500;"><i class="fas fa-id-card"></i> Student ID:</span>
                            <span class="info-value" style="color: #1e293b;">${studentId || 'N/A'}</span>
                        </div>
                        <div class="info-row" style="display: flex; gap: 0.5rem;">
                            <span class="info-label" style="color: #64748b; font-weight: 500;"><i class="fas fa-envelope"></i> Email:</span>
                            <span class="info-value" style="color: #1e293b;">${email || 'N/A'}</span>
                        </div>
                        <div class="info-row" style="display: flex; gap: 0.5rem;">
                            <span class="info-label" style="color: #64748b; font-weight: 500;"><i class="fas fa-building"></i> Department:</span>
                            <span class="info-value" style="color: #1e293b;">${department || 'N/A'}</span>
                        </div>
                        <div class="info-row" style="display: flex; gap: 0.5rem;">
                            <span class="info-label" style="color: #64748b; font-weight: 500;"><i class="fas fa-book"></i> Course:</span>
                            <span class="info-value" style="color: #1e293b;">${course || 'N/A'}</span>
                        </div>
                        <div class="info-row" style="display: flex; gap: 0.5rem;">
                            <span class="info-label" style="color: #64748b; font-weight: 500;"><i class="fas fa-layer-group"></i> Year:</span>
                            <span class="info-value" style="color: #1e293b;">${year || 'N/A'}</span>
                        </div>
                        <div class="info-row" style="display: flex; gap: 0.5rem;">
                            <span class="info-label" style="color: #64748b; font-weight: 500;"><i class="fas fa-award"></i> Award Number:</span>
                            <span class="info-value" style="color: #1e293b;">${awardNumber || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading claimed date students:', error);
        container.innerHTML = '<div class="no-data">Error loading students. Please try again.</div>';
    }
}

// Apply filters for claimed date students
function applyClaimedDateFilters(students) {
    const searchTerm = (document.getElementById('claimedDateSearch')?.value || '').trim().toLowerCase();
    const courseFilter = document.getElementById('claimedDateFilterCourse')?.value || '';
    const departmentFilter = document.getElementById('claimedDateFilterDepartment')?.value || '';
    
    return students.filter(student => {
        const firstName = (student.firstName || student.first_name || '').toLowerCase();
        const lastName = (student.lastName || student.last_name || '').toLowerCase();
        const studentId = (student.studentId || student.student_id || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const course = (student.course || '').toLowerCase();
        const department = (student.department || '').toLowerCase();
        
        const matchesSearch = !searchTerm || 
            firstName.includes(searchTerm) || 
            lastName.includes(searchTerm) || 
            `${firstName} ${lastName}`.trim().includes(searchTerm) ||
            studentId.includes(searchTerm) ||
            email.includes(searchTerm) ||
            course.includes(searchTerm) ||
            department.includes(searchTerm);
        
        const matchesCourse = !courseFilter || course === courseFilter.toLowerCase();
        const matchesDepartment = !departmentFilter || department === departmentFilter.toLowerCase();
        
        return matchesSearch && matchesCourse && matchesDepartment;
    });
}

// Filter claimed date students
function filterClaimedDateStudents() {
    loadClaimedDateStudents();
}

// Load Student's Claimed Dates
async function loadStudentClaimedDates() {
    const container = document.getElementById('studentClaimedDatesContainer');
    if (!container) return;
    
    try {
        // Get current logged-in student
        if (!currentUser || currentUser.role !== 'student') {
            container.innerHTML = '<div class="no-data">Please log in as a student to view claimed dates.</div>';
            return;
        }
        
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id || 
                         currentUser.studentData?.studentId || '';
        const studentDbId = String(studentId);
        
        // Get all claim dates from localStorage
        const claimDates = JSON.parse(localStorage.getItem('claimDates') || '[]');
        
        // Filter claim dates where this student has claimed
        const studentClaimedDates = claimDates.filter(claimDate => {
            const claimedStudentIds = claimDate.claimedStudentIds || [];
            return claimedStudentIds.includes(studentDbId) || 
                   claimedStudentIds.includes(String(studentId)) ||
                   claimedStudentIds.includes(studentId);
        });
        
        if (studentClaimedDates.length === 0) {
            container.innerHTML = `
                <div class="no-data" style="padding: 2rem; text-align: center; color: #64748b;">
                    <i class="fas fa-calendar-times" style="font-size: 48px; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <h4 style="color: #1e293b; margin-bottom: 0.5rem;">No Claimed Dates</h4>
                    <p>You haven't claimed any grant dates yet.</p>
                </div>
            `;
            return;
        }
        
        // Sort by date (newest first)
        studentClaimedDates.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        // Render claimed dates
        container.innerHTML = studentClaimedDates.map((claimDate, index) => {
            const dateStr = claimDate.date || '';
            const dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
            }) : 'Invalid Date';
            const description = claimDate.description || '';
            
            // Get claim timestamp
            const claimedAt = claimDate.claimedAt && claimDate.claimedAt[studentDbId] 
                ? claimDate.claimedAt[studentDbId]
                : null;
            const claimedAtDisplay = claimedAt 
                ? new Date(claimedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Date not available';
            
            return `
                <div class="student-claimed-date-card" style="padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 1rem; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">
                                    ${index + 1}
                                </div>
                                <div>
                                    <h4 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                                        <i class="fas fa-calendar-check" style="color: #3b82f6; margin-right: 0.5rem;"></i>
                                        ${dateDisplay}
                                    </h4>
                                </div>
                            </div>
                            ${description ? `
                                <div style="color: #64748b; font-size: 14px; margin-left: 55px; margin-top: 0.25rem;">
                                    <i class="fas fa-info-circle" style="margin-right: 0.25rem;"></i>
                                    ${description}
                                </div>
                            ` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="padding: 8px 16px; background: #10b981; color: white; border-radius: 6px; font-size: 14px; font-weight: 500;">
                                <i class="fas fa-check-circle"></i> Claimed
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 13px;">
                        <i class="fas fa-clock"></i>
                        <span>Claimed on: ${claimedAtDisplay}</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading student claimed dates:', error);
        container.innerHTML = '<div class="no-data">Error loading claimed dates. Please try again.</div>';
    }
}

// Handle student claim button click
async function handleStudentClaim(studentId, claimDate) {
    try {
        // Get claim dates
        let claimDates = JSON.parse(localStorage.getItem('claimDates') || '[]');
        const claimDateIndex = claimDates.findIndex(cd => cd.date === claimDate);
        
        if (claimDateIndex === -1) {
            showToast('Claim date not found', 'error');
            return;
        }
        
        // Get current claimed students array
        if (!claimDates[claimDateIndex].claimedStudentIds) {
            claimDates[claimDateIndex].claimedStudentIds = [];
        }
        
        // Check if student already claimed
        const studentIdStr = String(studentId);
        if (claimDates[claimDateIndex].claimedStudentIds.includes(studentIdStr) ||
            claimDates[claimDateIndex].claimedStudentIds.includes(studentId)) {
            showToast('Student has already claimed for this date', 'info');
            // Reload to update display
            await loadClaimedDateStudents(claimDate);
            return;
        }
        
        // Add student to claimed list
        claimDates[claimDateIndex].claimedStudentIds.push(studentIdStr);
        claimDates[claimDateIndex].claimedAt = claimDates[claimDateIndex].claimedAt || {};
        claimDates[claimDateIndex].claimedAt[studentIdStr] = new Date().toISOString();
        
        // Save back to localStorage
        localStorage.setItem('claimDates', JSON.stringify(claimDates));
        
        showToast('Student marked as claimed successfully!', 'success');
        
        // Reload students list to update the button
        await loadClaimedDateStudents(claimDate);
        
        // Update claim dates list to refresh student count
        await loadClaimDatesList();
        
    } catch (error) {
        console.error('Error handling student claim:', error);
        showToast('Failed to mark student as claimed: ' + error.message, 'error');
    }
}

function loadStudentNamesList() {
    try {
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        allStudentsList = students;
        filteredStudentsList = [...allStudentsList];
        
        // Sort students by last name, then first name
        filteredStudentsList.sort((a, b) => {
            const aLastName = (a.lastName || '').toLowerCase();
            const bLastName = (b.lastName || '').toLowerCase();
            if (aLastName !== bLastName) {
                return aLastName.localeCompare(bLastName);
            }
            const aFirstName = (a.firstName || '').toLowerCase();
            const bFirstName = (b.firstName || '').toLowerCase();
            return aFirstName.localeCompare(bFirstName);
        });
        
        renderStudentNamesList();
    } catch (error) {
        console.error('Error loading students:', error);
        const content = document.getElementById('studentNamesListContent');
        if (content) {
            content.innerHTML = '<div class="no-students-message"><i class="fas fa-exclamation-circle"></i><p>Error loading students. Please try again.</p></div>';
        }
    }
}

// Helper function to get messages from API (uses existing getMessages from api-config.js)
async function fetchMessagesFromAPI(senderId, senderType, receiverId, receiverType) {
    try {
        // Use the getMessages function from api-config.js
        if (typeof getMessages === 'function') {
            const messages = await getMessages(senderId, senderType, receiverId, receiverType);
            return Array.isArray(messages) ? messages : [];
        }
        return [];
    } catch (error) {
        console.log('getMessages API not available, using localStorage only:', error);
        return [];
    }
}

function renderStudentNamesList() {
    const content = document.getElementById('studentNamesListContent');
    const countElement = document.getElementById('studentNamesCount');
    
    if (!content) return;
    
    if (filteredStudentsList.length === 0) {
        content.innerHTML = '<div class="no-students-message"><i class="fas fa-users"></i><p>No students found.</p></div>';
        if (countElement) countElement.textContent = '0 students';
        return;
    }
    
    if (countElement) {
        countElement.textContent = `${filteredStudentsList.length} ${filteredStudentsList.length === 1 ? 'student' : 'students'}`;
    }
    
    const html = filteredStudentsList.map(student => {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown';
        const email = student.email || 'No email';
        const studentId = student.studentId || 'N/A';
        const awardNumber = student.awardNumber || 'N/A';
        const course = student.course || 'N/A';
        const department = student.department || 'N/A';
        const status = (student.status || 'active').toLowerCase();
        
        return `
            <div class="student-name-item">
                <div class="student-name-main">
                    <div class="student-name-primary">
                        <i class="fas fa-user-graduate"></i>
                        ${escapeHtml(fullName)}
                    </div>
                    <div class="student-name-secondary">
                        <span class="student-name-badge id"><i class="fas fa-id-card"></i> ID: ${escapeHtml(studentId)}</span>
                        <span class="student-name-badge id"><i class="fas fa-hashtag"></i> ${escapeHtml(awardNumber)}</span>
                        <span class="student-name-badge course"><i class="fas fa-graduation-cap"></i> ${escapeHtml(course)}</span>
                        <span class="student-name-badge department"><i class="fas fa-building"></i> ${escapeHtml(department.length > 30 ? department.substring(0, 30) + '...' : department)}</span>
                        <span class="student-name-badge status-${status}"><i class="fas fa-circle"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                </div>
                <div class="student-name-meta">
                    <div class="student-name-email">
                        <i class="fas fa-envelope"></i> ${escapeHtml(email)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    content.innerHTML = html;
}

function filterStudentNames() {
    const searchInput = document.getElementById('studentNamesSearch');
    const courseFilter = document.getElementById('studentNamesFilterCourse');
    const departmentFilter = document.getElementById('studentNamesFilterDepartment');
    const statusFilter = document.getElementById('studentNamesFilterStatus');
    
    if (!searchInput || !courseFilter || !departmentFilter || !statusFilter) return;
    
    const searchTerm = (searchInput.value || '').toLowerCase().trim();
    const courseValue = (courseFilter.value || '').toLowerCase();
    const departmentValue = (departmentFilter.value || '').toLowerCase();
    const statusValue = (statusFilter.value || '').toLowerCase();
    
    filteredStudentsList = allStudentsList.filter(student => {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
        const email = (student.email || '').toLowerCase();
        const studentId = (student.studentId || '').toLowerCase();
        const awardNumber = (student.awardNumber || '').toLowerCase();
        const course = (student.course || '').toLowerCase();
        const department = (student.department || '').toLowerCase();
        const status = (student.status || 'active').toLowerCase();
        
        // Search filter
        const matchesSearch = !searchTerm || 
            fullName.includes(searchTerm) ||
            email.includes(searchTerm) ||
            studentId.includes(searchTerm) ||
            awardNumber.includes(searchTerm) ||
            course.includes(searchTerm) ||
            department.includes(searchTerm);
        
        // Course filter
        const matchesCourse = !courseValue || course === courseValue;
        
        // Department filter
        const matchesDepartment = !departmentValue || department === departmentValue;
        
        // Status filter
        const matchesStatus = !statusValue || status === statusValue;
        
        return matchesSearch && matchesCourse && matchesDepartment && matchesStatus;
    });
    
    // Re-sort filtered list
    filteredStudentsList.sort((a, b) => {
        const aLastName = (a.lastName || '').toLowerCase();
        const bLastName = (b.lastName || '').toLowerCase();
        if (aLastName !== bLastName) {
            return aLastName.localeCompare(bLastName);
        }
        const aFirstName = (a.firstName || '').toLowerCase();
        const bFirstName = (b.firstName || '').toLowerCase();
        return aFirstName.localeCompare(bFirstName);
    });
    
    renderStudentNamesList();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Messages List Functions
async function loadMessagesList() {
    try {
        const content = document.getElementById('messagesListContent');
        if (content) {
            content.innerHTML = '<div class="loading-message">Loading messages...</div>';
        }
        
        // Load read status from localStorage
        const storedReadStatus = localStorage.getItem('adminReadMessages');
        if (storedReadStatus) {
            try {
                readMessagesMap = JSON.parse(storedReadStatus);
            } catch (e) {
                readMessagesMap = {};
            }
        } else {
            readMessagesMap = {};
        }
        
        // Get students list (try database first, fallback to localStorage)
        let studentsList = [];
        try {
            studentsList = await getStudentsFromDatabase();
            if (!studentsList || !Array.isArray(studentsList) || studentsList.length === 0) {
                studentsList = JSON.parse(localStorage.getItem('students') || '[]');
            }
        } catch (error) {
            console.log('Error fetching students, using localStorage:', error);
            studentsList = JSON.parse(localStorage.getItem('students') || '[]');
        }
        
        // Get all messages from database for admin (messages from students to admin)
        let messagesFromStudents = [];
        
        // Try to fetch from API
        if (studentsList.length > 0 && typeof getMessages === 'function') {
            try {
                const messagePromises = studentsList.map(async (student) => {
                    const normalizedStudentId = typeof student.id === 'number' ? student.id : parseInt(student.id) || student.id;
                    if (!normalizedStudentId) return [];
                    
                    try {
                        // Get messages from this student to admin
                        const msgs = await getMessages(normalizedStudentId, 'student', 1, 'admin');
                        if (Array.isArray(msgs) && msgs.length > 0) {
                            // Filter: Only include messages sent BY student TO admin (exclude admin's own messages)
                            return msgs
                                .filter(m => {
                                    const senderType = m.senderType || m.sender || '';
                                    const senderId = m.senderId || m.sender_id || 0;
                                    
                                    // Exclude messages sent by admin (admin ID is 1)
                                    if (senderId === 1 || senderId === '1' || senderType === 'admin') {
                                        return false;
                                    }
                                    
                                    // Include only messages from student to admin
                                    const isFromStudent = (senderId === normalizedStudentId || String(senderId) === String(normalizedStudentId));
                                    const isValidSenderType = (senderType === 'student' || senderType === 'user' || senderType === '');
                                    
                                    return isFromStudent && isValidSenderType;
                                })
                                .map(m => ({
                                ...m,
                                studentId: normalizedStudentId,
                                studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student',
                                studentEmail: student.email || '',
                                studentIdNumber: student.studentId || student.student_id || ''
                            }));
                        }
                        return [];
                    } catch (e) {
                        console.log(`Error fetching messages for student ${normalizedStudentId}:`, e);
                        return [];
                    }
                });
                
                const messageArrays = await Promise.all(messagePromises);
                messagesFromStudents = messageArrays.flat();
            } catch (error) {
                console.log('Error fetching messages from API:', error);
            }
        }
        
        // Also load from localStorage (profile chat messages)
        loadPersistedChatMessages();
        const localMessages = [];
        
        if (chatMessages && Array.isArray(chatMessages)) {
            chatMessages.forEach(m => {
                // Check sender to exclude admin messages
                const senderType = m.senderType || m.sender || '';
                const senderId = m.senderId || m.sender_id || 0;
                const receiverId = m.receiverId || m.receiver_id || 0;
                
                // Exclude messages sent by admin (admin ID is 1)
                if (senderId === 1 || senderId === '1' || senderType === 'admin') {
                    return;
                }
                
                // Only get messages sent by students TO admin
                const isStudentMessage = (senderType === 'student' || senderType === 'user' || senderType === '') &&
                                        senderId !== 1 && senderId !== '1' &&
                                        (receiverId === 1 || receiverId === '1' || m.adminId === 1 || m.receiverType === 'admin');
                if (!isStudentMessage) return;
                
                // Get student info
                const msgStudentId = m.studentId || m.receiverId || m.senderId;
                const student = studentsList.find(s => {
                    const sId = s.id || s.student_id || s.studentId;
                    return String(sId) === String(msgStudentId);
                });
                
                if (student) {
                    const normalizedId = student.id || student.student_id;
                    localMessages.push({
                        content: m.text || m.content || '',
                        text: m.text || m.content || '',
                        timestamp: m.timestamp || new Date().toISOString(),
                        createdAt: m.timestamp || m.createdAt || new Date().toISOString(),
                        studentId: normalizedId,
                        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student',
                        studentEmail: student.email || '',
                        studentIdNumber: student.studentId || student.student_id || '',
                        senderType: 'student',
                        sender: 'user'
                    });
                }
            });
        }
        
        // Merge messages and remove duplicates
        const messageMap = new Map();
        const addMessage = (msg) => {
            const timestamp = msg.createdAt || msg.timestamp || Date.now();
            const content = msg.content || msg.text || '';
            const studentId = msg.studentId || '';
            const key = `${timestamp}_${content}_${studentId}`;
            
            if (!messageMap.has(key)) {
                messageMap.set(key, {
                    ...msg,
                    timestamp: timestamp,
                    createdAt: timestamp,
                    content: content || msg.text || '',
                    text: content || msg.text || ''
                });
            }
        };
        
        messagesFromStudents.forEach(addMessage);
        localMessages.forEach(addMessage);
        
        allMessagesList = Array.from(messageMap.values());
        
        // Sort by timestamp (newest first)
        allMessagesList.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return timeB - timeA;
        });
        
        renderMessagesList();
        updateMessageCounts();
        
        // Also update the notification button badge
        checkAndUpdateNotificationBadge();
    } catch (error) {
        console.error('Error loading messages:', error);
        const content = document.getElementById('messagesListContent');
        if (content) {
            content.innerHTML = '<div class="no-messages-message"><i class="fas fa-exclamation-circle"></i><p>Error loading messages. Please try again.</p></div>';
        }
    }
}

function renderMessagesList() {
    const content = document.getElementById('messagesListContent');
    if (!content) return;
    
    // Group messages by student
    const studentsMap = new Map();
    
    allMessagesList.forEach(msg => {
        // Filter out admin's own messages (exclude messages sent by admin)
        const senderType = msg.senderType || msg.sender || '';
        const senderId = msg.senderId || msg.sender_id || 0;
        
        // Skip messages sent by admin (admin ID is 1)
        if (senderId === 1 || senderId === '1' || senderType === 'admin') {
            return;
        }
        
            const timestamp = msg.createdAt || msg.timestamp || '';
        const contentText = msg.content || msg.text || '';
            const studentId = msg.studentId || '';
        const key = `${timestamp}_${contentText}_${studentId}`;
        const isRead = readMessagesMap[key] === true;
        
        if (!studentsMap.has(studentId)) {
            studentsMap.set(studentId, {
                studentId: studentId,
                studentName: msg.studentName || 'Unknown Student',
                studentEmail: msg.studentEmail || '',
                studentIdNumber: msg.studentIdNumber || '',
                messages: [],
                unreadCount: 0,
                latestTimestamp: timestamp
            });
        }
        
        const studentData = studentsMap.get(studentId);
        studentData.messages.push(msg);
        if (!isRead) {
            studentData.unreadCount++;
        }
        
        // Update latest timestamp if this message is newer
        const msgTime = new Date(timestamp || 0).getTime();
        const latestTime = new Date(studentData.latestTimestamp || 0).getTime();
        if (msgTime > latestTime) {
            studentData.latestTimestamp = timestamp;
        }
    });
    
    // Convert map to array and filter based on current tab
    let studentsArray = Array.from(studentsMap.values());
    
    if (currentMessagesTab === 'unread') {
        // Only show students with unread messages
        studentsArray = studentsArray.filter(student => student.unreadCount > 0);
    } else if (currentMessagesTab === 'read') {
        // Only show students with at least one read message and no unread messages
        studentsArray = studentsArray.filter(student => 
            student.messages.some(msg => {
            const timestamp = msg.createdAt || msg.timestamp || '';
                const contentText = msg.content || msg.text || '';
                const key = `${timestamp}_${contentText}_${student.studentId}`;
            return readMessagesMap[key] === true;
            }) && student.unreadCount === 0
        );
    }
    // For 'all' tab, show all students
    
    // Sort by latest message timestamp (newest first)
    studentsArray.sort((a, b) => {
        const timeA = new Date(a.latestTimestamp || 0).getTime();
        const timeB = new Date(b.latestTimestamp || 0).getTime();
        return timeB - timeA;
    });
    
    if (studentsArray.length === 0) {
        const emptyMessage = currentMessagesTab === 'unread' 
            ? '<div class="no-messages-message"><i class="fas fa-check-circle"></i><p>No unread messages</p></div>'
            : currentMessagesTab === 'read'
            ? '<div class="no-messages-message"><i class="fas fa-envelope-open"></i><p>No read messages</p></div>'
            : '<div class="no-messages-message"><i class="fas fa-inbox"></i><p>No messages yet</p></div>';
        content.innerHTML = emptyMessage;
        return;
    }
    
    const html = studentsArray.map((studentData) => {
        const studentName = escapeHtml(studentData.studentName || 'Unknown Student');
        const studentEmail = escapeHtml(studentData.studentEmail || '');
        const studentIdNum = escapeHtml(studentData.studentIdNumber || '');
        const firstLetter = studentName.charAt(0).toUpperCase();
        const time = new Date(studentData.latestTimestamp || Date.now()).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const hasUnread = studentData.unreadCount > 0;
        
        return `
            <div class="message-item ${hasUnread ? 'unread' : ''}" 
                 data-student-id="${studentData.studentId || ''}" 
                 onclick="openStudentChatFromMessages(${studentData.studentId})" 
                 style="cursor: pointer; padding: 16px; border-bottom: 1px solid #e5e7eb; transition: background-color 0.2s;" 
                 onmouseover="this.style.backgroundColor='#f3f4f6'" 
                 onmouseout="this.style.backgroundColor='transparent'"
                 title="Click to open chat with ${studentName}">
                <div class="message-item-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div class="message-sender-info" style="display: flex; align-items: center; gap: 12px; flex: 1;">
                        <div class="message-sender-avatar" style="width: 48px; height: 48px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; flex-shrink: 0;">${firstLetter}</div>
                        <div class="message-sender-details" style="flex: 1; min-width: 0;">
                            <div class="message-sender-name" style="font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                                ${studentName}
                                ${hasUnread ? `<span class="unread-badge" style="background: #ef4444; color: white; border-radius: 12px; padding: 2px 8px; font-size: 12px; font-weight: 600;">${studentData.unreadCount}</span>` : ''}
                            </div>
                            <div class="message-sender-meta" style="font-size: 13px; color: #6b7280; display: flex; gap: 12px; flex-wrap: wrap;">
                                ${studentIdNum ? `<span><i class="fas fa-id-card"></i> ${studentIdNum}</span>` : ''}
                                ${studentEmail ? `<span><i class="fas fa-envelope"></i> ${studentEmail}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="message-time" style="font-size: 12px; color: #9ca3af; white-space: nowrap; margin-left: 12px;">
                        <i class="fas fa-clock"></i> ${time}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    content.innerHTML = html;
}

// Function to open student chat from messages list
function openStudentChatFromMessages(studentId) {
    // Close the notification modal
    closeStudentNamesListModal();
    
    // Small delay to ensure modal closes smoothly before opening the profile modal
    setTimeout(() => {
        if (typeof openStudentProfileModal === 'function') {
            openStudentProfileModal(studentId);
        }
    }, 100);
}

function handleMessageClick(event) {
    event.stopPropagation();
    const messageItem = event.currentTarget;
    const encodedKey = messageItem.getAttribute('data-message-key');
    const studentId = messageItem.getAttribute('data-student-id');
    
    if (encodedKey && studentId) {
        try {
            // Decode the base64 encoded key
            const key = decodeURIComponent(atob(encodedKey));
            markMessageAsRead(key, studentId);
        } catch (e) {
            console.error('Error decoding message key:', e);
            // Even if key decoding fails, still try to open chat with studentId
            if (studentId && typeof openStudentProfileModal === 'function') {
                closeStudentNamesListModal();
                setTimeout(() => {
                    openStudentProfileModal(studentId);
                }, 100);
            }
        }
    } else if (studentId && typeof openStudentProfileModal === 'function') {
        // If we have studentId but no key, still open the chat
        closeStudentNamesListModal();
        setTimeout(() => {
            openStudentProfileModal(studentId);
        }, 100);
    }
}

function markMessageAsRead(key, studentId) {
    readMessagesMap[key] = true;
    localStorage.setItem('adminReadMessages', JSON.stringify(readMessagesMap));
    renderMessagesList();
    updateMessageCounts();
    
    // Update notification badge after marking message as read
    checkAndUpdateNotificationBadge();
    
    // Open the student's profile modal with chat interface
    if (studentId && typeof openStudentProfileModal === 'function') {
        // Close the notification modal first
        closeStudentNamesListModal();
        
        // Small delay to ensure modal closes smoothly before opening the profile modal
        setTimeout(() => {
            openStudentProfileModal(studentId);
        }, 100);
    }
}

function switchMessagesTab(tab) {
    currentMessagesTab = tab;
    
    // Update active tab button
    const unreadBtn = document.getElementById('unreadTabBtn');
    const readBtn = document.getElementById('readTabBtn');
    const allBtn = document.getElementById('allTabBtn');
    
    if (unreadBtn) unreadBtn.classList.remove('active');
    if (readBtn) readBtn.classList.remove('active');
    if (allBtn) allBtn.classList.remove('active');
    
    if (tab === 'unread' && unreadBtn) {
        unreadBtn.classList.add('active');
    } else if (tab === 'read' && readBtn) {
        readBtn.classList.add('active');
    } else if (tab === 'all' && allBtn) {
        allBtn.classList.add('active');
    }
    
    renderMessagesList();
}

function updateMessageCounts() {
    const unreadCount = allMessagesList.filter(msg => {
        const timestamp = msg.createdAt || msg.timestamp || '';
        const content = msg.content || msg.text || '';
        const studentId = msg.studentId || '';
        const key = `${timestamp}_${content}_${studentId}`;
        return !readMessagesMap[key];
    }).length;
    
    const readCount = allMessagesList.filter(msg => {
        const timestamp = msg.createdAt || msg.timestamp || '';
        const content = msg.content || msg.text || '';
        const studentId = msg.studentId || '';
        const key = `${timestamp}_${content}_${studentId}`;
        return readMessagesMap[key] === true;
    }).length;
    
    const unreadBadge = document.getElementById('unreadCountBadge');
    const readBadge = document.getElementById('readCountBadge');
    const notificationButtonBadge = document.getElementById('notificationMessageBadge');
    
    if (unreadBadge) {
        unreadBadge.textContent = unreadCount;
        unreadBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    
    if (readBadge) {
        readBadge.textContent = readCount;
        readBadge.style.display = readCount > 0 ? 'inline-block' : 'none';
    }
    
    // Update the notification button badge
    if (notificationButtonBadge) {
        notificationButtonBadge.textContent = unreadCount;
        notificationButtonBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        
        // Add pulse animation if there are unread messages
        if (unreadCount > 0) {
            notificationButtonBadge.classList.add('has-unread');
        } else {
            notificationButtonBadge.classList.remove('has-unread');
        }
    }
}

// Show Profile panel when clicking the sidebar profile card header
function showStudentProfile() {
    const homepageContent = document.getElementById('student-homepage-content');
    const tabContent = document.querySelector('#student-homepage .tab-content');
    const navTabs = document.querySelector('#student-homepage .admin-nav-tabs');

    if (homepageContent && tabContent && navTabs) {
        homepageContent.style.display = 'none';
        tabContent.style.display = 'block';
        // Hide tabs when viewing profile via sidebar
        navTabs.style.display = 'none';

        // Hide all panels and show profile panel
        document.querySelectorAll('#student-homepage .tab-panel').forEach(panel => panel.classList.remove('active'));
        const profilePanel = document.getElementById('profile-tab');
        if (profilePanel) profilePanel.classList.add('active');

        // Do not alter tab button active state (tabs remain Announcements/Messages)
        document.querySelectorAll('#student-homepage .nav-tab-btn').forEach(btn => btn.classList.remove('active'));
    }

    // Ensure profile data is populated
    loadStudentProfile();
}

// Open Messages from sidebar Notifications or counters
function openStudentMessages() {
    const homepageContent = document.getElementById('student-homepage-content');
    const tabContent = document.querySelector('#student-homepage .tab-content');
    const navTabs = document.querySelector('#student-homepage .admin-nav-tabs');

    if (homepageContent && tabContent && navTabs) {
        homepageContent.style.display = 'none';
        tabContent.style.display = 'block';
        navTabs.style.display = 'flex';

        // Switch to messages panel and highlight Messages tab button
        document.querySelectorAll('#student-homepage .tab-panel').forEach(panel => panel.classList.remove('active'));
        const msgPanel = document.getElementById('messages-tab');
        if (msgPanel) msgPanel.classList.add('active');
        document.querySelectorAll('#student-homepage .nav-tab-btn').forEach(btn => btn.classList.remove('active'));
        const msgBtn = document.querySelector(`#student-homepage .nav-tab-btn[onclick*="'messages'"]`);
        if (msgBtn) msgBtn.classList.add('active');

        // Ensure messages render
        setTimeout(loadStudentMessages, 0);
    }
}

function loadReports() {
    // Simple chart implementation (in a real app, you'd use a charting library)
    const applicationChart = document.getElementById('applicationChart');
    const trendChart = document.getElementById('trendChart');
    const departmentChart = document.getElementById('departmentChart');
    const departmentSummary = document.getElementById('departmentSummary');
    const placeChart = document.getElementById('placeChart');
    const placeSummary = document.getElementById('placeSummary');
    
    if (applicationChart && trendChart) {
        drawSimpleChart(applicationChart, {
            active: students.filter(s => (s.status || 'active') === 'active').length,
            archived: students.filter(s => s.status === 'archived').length
        });
        
        drawSimpleChart(trendChart, {
            jan: 5,
            feb: 8,
            mar: 12,
            apr: 15
        });
    }

    // Department analysis
    if (departmentChart && departmentSummary) {
        const storedStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const deptCounts = storedStudents.reduce((acc, s) => {
            const dept = (s && s.department) ? s.department : 'Unspecified';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {});
        if (Object.keys(deptCounts).length === 0) {
            departmentSummary.innerHTML = '<p class="no-data">No department data available.</p>';
        } else {
            // Render chart
            drawSimpleChart(departmentChart, deptCounts);
            // Render summary list
            const total = Object.values(deptCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
            departmentSummary.innerHTML = `
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                        const abbr = abbreviateDepartment(name);
                        return `<li title="${name}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${abbr}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                        </li>`;
                    }).join('')}
                </ul>
            `;
        }
    }
}

    // Place (From) analysis (counts and percentage summary)
    const placeChart = document.getElementById('placeChart');
    const placeSummary = document.getElementById('placeSummary');
    if (placeChart && placeSummary) {
        const storedStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const placeCounts = storedStudents.reduce((acc, s) => {
            const place = (s && s.place && s.place.trim()) ? s.place.trim() : 'Unspecified';
            acc[place] = (acc[place] || 0) + 1;
            return acc;
        }, {});
        if (Object.keys(placeCounts).length === 0) {
            placeSummary.innerHTML = '<p class="no-data">No origin data available.</p>';
            const ctx = placeChart.getContext('2d');
            ctx.clearRect(0, 0, placeChart.width, placeChart.height);
        } else {
            drawSimpleChart(placeChart, placeCounts);
            const total = Object.values(placeCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(placeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
            placeSummary.innerHTML = `
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                        return `<li title="${name}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${name}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                        </li>`;
                    }).join('')}
                </ul>
            `;
        }
    }

function drawSimpleChart(canvas, data, opts) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const maxValue = Math.max(...Object.values(data));
    const labels = Object.keys(data);
    const values = Object.values(data);
    const count = labels.length;
    const padding = 10;
    const barWidth = Math.max(20, Math.floor(width / count) - padding);
    const labelColor = '#374151';
    const hideLabels = !!(opts && opts.hideLabels);
    const labelFormatter = (opts && typeof opts.labelFormatter === 'function') ? opts.labelFormatter : (t) => t;
    
    labels.forEach((key, index) => {
        const value = values[index];
        const bottomSpace = hideLabels ? 8 : 18;
        const barHeight = maxValue > 0 ? (value / maxValue) * (height - (32 + bottomSpace)) : 0;
        const x = index * (barWidth + padding) + 5;
        const y = height - barHeight - (16 + bottomSpace);

        // Bar color with spaced hues for readability
        ctx.fillStyle = `hsl(${(index * 53) % 360}, 70%, 55%)`;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Value label above bar
        ctx.fillStyle = labelColor;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(String(value), x + barWidth/2, y - 6);

        // Optional label under bar
        if (!hideLabels) {
            const text = labelFormatter(key);
            ctx.save();
            ctx.fillStyle = labelColor;
            ctx.translate(x + barWidth/2, height - 6);
            ctx.rotate(0);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
    });
}

function abbreviateDepartment(name) {
    if (!name) return '';
    const mapping = {
        'Department of Computer Studies': 'DCS',
        'Department of Business and Management': 'DBM',
        'Department of Industrial Technology': 'DIT',
        'Department of General Teacher Training': 'DGTT',
        'College of Criminal Justice Education': 'CCJE',
        'Unspecified': 'Unspecified'
    };
    if (mapping[name]) return mapping[name];
    // Generic fallback: collapse common prefixes and shorten words
    return name
        .replace(/^Department of\s+/i, '')
        .replace(/and/gi, '&')
        .replace(/Education/gi, 'Edu')
        .replace(/Management/gi, 'Mgmt')
        .replace(/Technology/gi, 'Tech')
        .replace(/General/gi, 'Gen')
        .trim();
}

// Application Management Functions
function reviewApplication(applicationId) {
    const application = applications.find(a => a.id === applicationId);
    const student = students.find(s => s.id === application.studentId);
    
    currentApplicationId = applicationId;
    
    document.getElementById('applicationDetails').innerHTML = `
        <div class="application-details">
            <h4>Application Details</h4>
            <div class="detail-row">
                <strong>Student:</strong> ${student.firstName} ${student.lastName} (${student.studentId})
            </div>
            <div class="detail-row">
                <strong>Document Type:</strong> ${application.documentType}
            </div>
            <div class="detail-row">
                <strong>File:</strong> ${application.fileName}
            </div>
            <div class="detail-row">
                <strong>Notes:</strong> ${application.notes || 'No additional notes'}
            </div>
            <div class="detail-row">
                <strong>Submitted:</strong> ${formatDate(application.submittedDate)}
            </div>
            <div class="detail-row attachments">
                <strong>Attachments:</strong>
                <div class="attachments-grid">
                    ${(application.documentFiles && application.documentFiles.length > 0) ? application.documentFiles.map(doc => `
                        <div class="attachment-card">
                            <div class="attachment-title">${doc.type}</div>
                            ${doc.fileDataUrl ? (
                                (doc.fileName || '').toLowerCase().endsWith('.pdf')
                                    ? `<iframe src="${doc.fileDataUrl}" class="attachment-preview"></iframe>`
                                    : `<img src="${doc.fileDataUrl}" alt="${doc.fileName || 'file'}" class="attachment-preview">`
                            ) : `<div class=\"attachment-fallback\">${doc.fileName || 'No preview available'}</div>`}
                            ${doc.fileName ? `<div class="attachment-filename">${doc.fileName}</div>` : ''}
                        </div>
                    `).join('') : `
                        <div class="attachment-card">
                            <div class="attachment-fallback">No attachments</div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
    
    // reviewModal removed - using viewApplicationDetails instead
    viewApplicationDetails(application.id);
}

// updateApplicationStatus function removed - approval/rejection process has been replaced

function viewApplicationDetails(applicationId) {
    const application = applications.find(a => a.id === applicationId);
    const student = students.find(s => s.id === application.studentId);
    
    alert(`Application Details:\n\nStudent: ${student.firstName} ${student.lastName}\nDocument: ${application.documentType}\nStatus: ${application.status}\nSubmitted: ${formatDate(application.submittedDate)}\nReviewed: ${application.reviewedDate ? formatDate(application.reviewedDate) : 'Not reviewed'}\nNotes: ${application.notes || 'None'}`);
}

async function openStudentProfileModal(studentId) {
    // Be robust: try to locate the student from the in-memory list first,
    // then fall back to the database with multiple id field variants.
    let student = Array.isArray(students) ? students.find(s => s && (s.id === studentId || s.id == studentId)) : null;
    if (!student) {
        try {
            const fromDb = await getStudentsFromDatabase();
            if (Array.isArray(fromDb) && fromDb.length) {
                student = fromDb.find(s => (
                    s && (
                        s.id === studentId || s.id == studentId ||
                        s.student_id == studentId || s.studentId == studentId ||
                        String(s.awardNumber || s.award_number || '') === String(studentId)
                    )
                ));
            }
        } catch (e) {
            console.error('Failed loading students from DB for profile modal:', e);
        }
    }
    if (!student) {
        showToast('Student record not found.', 'error');
        return;
    }
    const modal = document.getElementById('studentProfileModal');
    if (!modal) return;

    const firstName = student.firstName || student.first_name || '';
    const lastName = student.lastName || student.last_name || '';
    document.getElementById('adminStudentName').textContent = `${firstName} ${lastName}`.trim();
    document.getElementById('adminStudentEmail').textContent = student.email || '';
    // Keep the header meta showing the correct Student ID (not award number)
    document.getElementById('adminStudentId').textContent = student.studentId || '';
    const adminDeptEl = document.getElementById('adminStudentDepartment');
    if (adminDeptEl) { adminDeptEl.textContent = student.department || ''; }
    const adminPlaceEl = document.getElementById('adminStudentPlace');
    if (adminPlaceEl) { adminPlaceEl.textContent = student.place || ''; }
    document.getElementById('adminStudentCourse').textContent = student.course || '';
    document.getElementById('adminStudentYear').textContent = student.year || student.yearLevel || student.year_level || '';
    const adminStudentIdValueEl = document.getElementById('adminStudentIdValue');
    if (adminStudentIdValueEl) { adminStudentIdValueEl.textContent = student.studentId; }
    const adminStudentAwardNumberEl = document.getElementById('adminStudentAwardNumber');
    if (adminStudentAwardNumberEl) { adminStudentAwardNumberEl.textContent = student.awardNumber || 'N/A'; }
    document.getElementById('adminStudentStatus').textContent = student.status || 'active';
    // Application status removed from admin view
    const registeredValue = student.registered || student.registrationDate || student.registeredDate || student.created_at || null;
    document.getElementById('adminStudentRegistered').textContent = registeredValue ? formatDate(registeredValue) : 'N/A';

    const img = document.getElementById('adminStudentPhoto');
    if (img) {
        const picture = student.idPictureDataUrl || student.id_picture || student.photo || '';
        if (picture) {
            img.src = picture;
            img.alt = 'Student ID Picture';
        } else {
            img.src = '';
            img.alt = 'No ID Picture available';
        }
    }

    // Show flags in admin view if needed
    const indigenousBadge = document.getElementById('adminStudentIndigenous');
    const pwdBadge = document.getElementById('adminStudentPwd');
    if (indigenousBadge) indigenousBadge.textContent = student.isIndigenous ? 'Yes' : 'No';
    if (pwdBadge) pwdBadge.textContent = student.isPwd ? 'Yes' : 'No';

    // Load admin-student chat thread for this student
    // Ensure we use the correct ID - prefer the database ID, fallback to studentId
    adminActiveChatStudentId = student.id || student.student_id || studentId;
    renderAdminStudentChat();

    modal.style.display = 'block';
    
    // Focus on chat input after modal opens and add Enter key listener
    setTimeout(() => {
        const chatInput = document.getElementById('adminStudentChatInput');
        if (chatInput) {
            chatInput.focus();
            
            // Remove any existing listeners and add new one
            chatInput.removeEventListener('keydown', handleAdminChatEnter);
            chatInput.addEventListener('keydown', handleAdminChatEnter);
        }
    }, 300);
}

// Dedicated function for Enter key handling
function handleAdminChatEnter(event) {
    if (!event) return true;
    
    const isEnterKey = event.key === 'Enter' || event.keyCode === 13 || event.which === 13;
    
    if (isEnterKey && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        adminSendChatMessage(event);
        return false;
    }
    
    return true;
}

function closeStudentProfileModal() {
    const modal = document.getElementById('studentProfileModal');
    if (modal) modal.style.display = 'none';
}

async function renderAdminStudentChat() {
    const container = document.getElementById('adminStudentChatMessages');
    if (!container) return;
    container.innerHTML = '';
    
    if (!adminActiveChatStudentId) {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Start chatting</h5>
                    <p>Your messages will appear here.</p>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        // Normalize the student ID to ensure proper matching
        const normalizedStudentId = typeof adminActiveChatStudentId === 'number' 
            ? adminActiveChatStudentId 
            : parseInt(adminActiveChatStudentId) || adminActiveChatStudentId;
        
        // Load messages from database in BOTH directions:
        // 1. Messages where admin sent to student (admin is sender)
        // 2. Messages where student sent to admin (student is sender)
        const [messagesFromAdmin, messagesFromStudent] = await Promise.all([
            getMessages(1, 'admin', normalizedStudentId, 'student'),
            getMessages(normalizedStudentId, 'student', 1, 'admin')
        ]);
        
        console.log('📨 Messages from admin to student:', messagesFromAdmin);
        console.log('📨 Messages from student to admin:', messagesFromStudent);
        
        // Merge both message arrays and remove duplicates
        const allMessages = [];
        const messageMap = new Map();
        
        // Add messages from admin to student
        if (Array.isArray(messagesFromAdmin)) {
            messagesFromAdmin.forEach(msg => {
                // Create a more unique key including senderId and receiverId to prevent duplicates
                const timestamp = msg.createdAt || msg.timestamp || '';
                const content = (msg.content || msg.text || '').trim();
                const senderId = msg.senderId || 1;
                const receiverId = msg.receiverId || normalizedStudentId;
                const key = `${timestamp}_${content}_${senderId}_${receiverId}_admin`;
                
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        
        // Add messages from student to admin
        if (Array.isArray(messagesFromStudent)) {
            messagesFromStudent.forEach(msg => {
                // Create a more unique key including senderId and receiverId to prevent duplicates
                const timestamp = msg.createdAt || msg.timestamp || '';
                const content = (msg.content || msg.text || '').trim();
                const senderId = msg.senderId || normalizedStudentId;
                const receiverId = msg.receiverId || 1;
                const key = `${timestamp}_${content}_${senderId}_${receiverId}_student`;
                
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        
        // Additional duplicate check: remove duplicates based on exact match of content and timestamp
        const finalMessages = [];
        const seenMessages = new Map();
        
        allMessages.forEach(msg => {
            const content = (msg.content || msg.text || '').trim();
            const timestamp = msg.createdAt || msg.timestamp || '';
            const senderType = msg.senderType || (msg.sender === 'admin' ? 'admin' : 'student');
            
            // Create a unique key for duplicate detection
            const uniqueKey = `${timestamp}_${content}_${senderType}_${msg.senderId || ''}_${msg.receiverId || ''}`;
            
            if (!seenMessages.has(uniqueKey)) {
                seenMessages.set(uniqueKey, true);
                finalMessages.push(msg);
            }
        });
        
        // Sort messages by timestamp
        finalMessages.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return timeA - timeB;
        });
        
        console.log('📨 All merged messages (sorted and deduplicated):', finalMessages);
        
        if (finalMessages.length === 0) {
            container.innerHTML = `
                <div class="chat-welcome">
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h5>Start chatting</h5>
                        <p>Your messages will appear here.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Clear container first to prevent duplicates
        container.innerHTML = '';
        
        finalMessages.forEach(message => {
            const messageDiv = document.createElement('div');
            const isAdmin = message.senderType === 'admin';
            messageDiv.className = `profile-message ${isAdmin ? 'sent' : 'received'}`;
            const time = new Date(message.createdAt || message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const content = (message.content || message.text || '').trim();
            messageDiv.innerHTML = `
                <div class="profile-message-avatar">${isAdmin ? 'A' : 'S'}</div>
                <div class="profile-message-content">
                    <div>${content}</div>
                    <div class="profile-message-time">${time}</div>
                </div>
            `;
            container.appendChild(messageDiv);
        });
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading admin chat:', error);
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Error loading messages</h5>
                    <p>Please refresh the page.</p>
                </div>
            </div>
        `;
    }
}

function addMessageToAdminChat(container, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `profile-message ${message.sender === 'admin' ? 'sent' : 'received'}`;
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    messageDiv.innerHTML = `
        <div class="profile-message-avatar">${message.sender === 'admin' ? 'A' : 'S'}</div>
        <div class="profile-message-content">
            <div>${message.text || ''}</div>
            <div class="profile-message-time">${time}</div>
        </div>
    `;
    container.appendChild(messageDiv);
    // Ensure persistence when rendering (in case messages were programmatically added)
    persistChatMessages();
}

// Prevent double submission
let isSendingMessage = false;
let sendMessageTimeout = null;

async function adminSendChatMessage(event) {
    // Prevent default form submission if called from form
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Prevent double submission, but allow after 3 seconds (safety reset)
    if (isSendingMessage) {
        console.log('⚠️ Message already sending, ignoring duplicate call');
        return;
    }
    
    const input = document.getElementById('adminStudentChatInput');
    if (!input) {
        console.error('❌ Input field not found');
        isSendingMessage = false; // Reset flag
        return;
    }
    
    const text = input.value.trim();
    if (!text) {
        console.log('⚠️ Empty message, not sending');
        isSendingMessage = false; // Reset flag
        return;
    }
    
    if (!adminActiveChatStudentId) {
        console.error('❌ No active student selected');
        showToast('Please select a student first', 'error');
        isSendingMessage = false; // Reset flag
        return;
    }
    
    console.log('📤 Starting to send message...');
    
    // Set flag to prevent double submission (only after all checks pass)
    isSendingMessage = true;
    
    // Safety timeout: auto-reset flag after 5 seconds to prevent getting stuck
    if (sendMessageTimeout) clearTimeout(sendMessageTimeout);
    sendMessageTimeout = setTimeout(() => {
        if (isSendingMessage) {
            console.warn('⚠️ Auto-resetting send flag (safety timeout)');
            isSendingMessage = false;
            const inputToReset = document.getElementById('adminStudentChatInput');
            const btnToReset = document.querySelector('.profile-chat-send-btn');
            if (inputToReset) inputToReset.disabled = false;
            if (btnToReset) {
                btnToReset.disabled = false;
                btnToReset.style.opacity = '1';
                btnToReset.style.cursor = 'pointer';
            }
        }
    }, 5000);
    
    // Disable input and button to prevent double submission
    input.disabled = true;
    const sendButton = document.querySelector('.profile-chat-send-btn');
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.style.opacity = '0.6';
        sendButton.style.cursor = 'not-allowed';
    }
    
    // Store text before clearing input
    const messageText = text;
    
    // Clear input immediately to prevent double send
    input.value = '';
    
    try {
        // Normalize the student ID - ensure we're using the correct ID format
        const normalizedStudentId = typeof adminActiveChatStudentId === 'number' 
            ? adminActiveChatStudentId 
            : parseInt(adminActiveChatStudentId) || adminActiveChatStudentId;
        
        console.log('📤 Admin sending message to student:', normalizedStudentId, 'Message:', messageText);
        
        // Save message to database
        const saveResult = await saveMessage({
            senderId: 1, // Admin ID
            receiverId: normalizedStudentId,
            senderType: 'admin',
            receiverType: 'student',
            content: messageText,
            attachment: null,
            attachmentName: null
        });
        
        // Check if message was saved or if it was a duplicate (which is okay)
        if (!saveResult) {
            throw new Error('No response from server');
        }
        
        if (!saveResult.success && !saveResult.duplicate) {
            throw new Error(saveResult.message || 'Failed to save message to database');
        }
        
        if (saveResult.duplicate) {
            console.log('⚠️ Duplicate message detected, but continuing...');
            // Don't show error for duplicates, just reload the chat
        } else {
            console.log('✅ Message saved successfully:', saveResult);
        }
        
        // Add notification for student (only if not duplicate)
        if (!saveResult.duplicate) {
            addNotification(normalizedStudentId, 'New Message from Admin', messageText);
        }
        
        // Small delay before reloading to ensure database has updated
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Reload chat to show the new message
        await renderAdminStudentChat();
        
        // Update notification badge after sending message
        if (currentUser && currentUser.role === 'admin') {
            checkAndUpdateNotificationBadge();
        }
        
        // Update student's profile chat if they're viewing it - compare with normalized IDs
        if (currentUser && currentUser.role === 'student') {
            const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
            const normalizedCurrentStudentId = typeof studentId === 'number' 
                ? studentId 
                : parseInt(studentId) || studentId;
            
            if (normalizedCurrentStudentId == normalizedStudentId) {
                await loadProfileChatMessages();
            }
        }
    } catch (error) {
        console.error('❌ Error sending message:', error);
        showToast('Failed to send message: ' + (error.message || 'Unknown error'), 'error');
        // Restore input value if error occurred
        if (input && messageText) {
            input.value = messageText;
        }
    } finally {
        // Always re-enable input and button, even on error
        // Use the input variable we already have
        const inputToEnable = document.getElementById('adminStudentChatInput');
        const sendBtn = document.querySelector('.profile-chat-send-btn');
        
        setTimeout(() => {
            if (inputToEnable) {
                inputToEnable.disabled = false;
                try {
                    inputToEnable.focus(); // Re-focus input for better UX
                } catch (e) {
                    // Ignore focus errors
                }
            }
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
                sendBtn.style.cursor = 'pointer';
            }
            
            // Reset flag after sending (with a delay to prevent rapid clicks)
            isSendingMessage = false;
            if (sendMessageTimeout) {
                clearTimeout(sendMessageTimeout);
                sendMessageTimeout = null;
            }
            console.log('✅ Send button and input re-enabled');
        }, 500);
    }
}

function adminHandleChatKeyPress(event) {
    // This function is kept for backward compatibility but primary handling is in HTML
    if (!event) return;
    
    // Handle Enter key (check both key and keyCode for compatibility)
    const isEnterKey = event.key === 'Enter' || event.keyCode === 13 || event.which === 13;
    
    if (isEnterKey) {
        if (!event.shiftKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            adminSendChatMessage(event);
            return false;
        }
    }
}
// Student Management Functions
function sendMessageToStudent(studentId) {
    const message = prompt('Enter your message:');
    if (message) {
        const student = students.find(s => s.id === studentId);
        addNotification(studentId, 'Message from Admin', message);
        showToast('Message sent successfully!', 'success');
    }
}

function archiveStudent(studentId) {
    if (confirm('Are you sure you want to archive this student?')) {
        const studentIndex = students.findIndex(s => s.id === studentId);
        students[studentIndex].status = 'archived';
        loadStudents();
        loadAdminDashboard();
        showToast('Student archived successfully!', 'success');
    }
}

function activateStudent(studentId) {
    const studentIndex = students.findIndex(s => s.id === studentId);
    students[studentIndex].status = 'active';
    loadStudents();
    loadAdminDashboard();
    showToast('Student activated successfully!', 'success');
}

async function deleteStudent(studentId) {
    if (!confirm('Are you sure you want to permanently delete this student? This action cannot be undone.')) {
        return;
    }

    try {
        // Show loading state
        const deleteBtn = event?.target;
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';
        }

        // Normalize student ID
        const normalizedStudentId = typeof studentId === 'number' ? studentId : parseInt(studentId) || studentId;

        console.log('🗑️ Deleting student:', normalizedStudentId);

        // Delete from database using API
        // Call the delete_student.php endpoint directly
        const result = await apiCall('delete_student.php', 'POST', { id: normalizedStudentId });

        if (!result || !result.success) {
            throw new Error(result?.message || 'Failed to delete student from database');
        }

        // Remove from localStorage
    const stored = JSON.parse(localStorage.getItem('students') || '[]');
        const newList = stored.filter(s => {
            const sId = s.id || s.student_id;
            return String(sId) !== String(normalizedStudentId);
        });
    localStorage.setItem('students', JSON.stringify(newList));
    students = newList;

        // Remove related chat messages from localStorage
    try {
        loadPersistedChatMessages();
            const filteredMsgs = chatMessages.filter(m => {
                const msgStudentId = m.studentId || m.receiverId || m.senderId;
                return String(msgStudentId) !== String(normalizedStudentId);
            });
        chatMessages = filteredMsgs;
        persistChatMessages();
        } catch (e) {
            console.log('Error cleaning up chat messages:', e);
        }

        // Refresh students from database and update UI
        try {
            const studentsFromDB = await getStudentsFromDatabase();
            if (studentsFromDB && Array.isArray(studentsFromDB)) {
                students = studentsFromDB;
                localStorage.setItem('students', JSON.stringify(studentsFromDB));
            }
        } catch (dbError) {
            console.warn('Could not refresh students from database:', dbError);
        }

        // Reload students list and dashboard
    loadStudents();
    loadAdminDashboard();

    showToast('Student deleted successfully!', 'success');
    } catch (error) {
        console.error('❌ Error deleting student:', error);
        showToast('Failed to delete student: ' + (error.message || 'Unknown error'), 'error');
        
        // Re-enable button on error
        const deleteBtn = event?.target;
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Delete';
        }
    }
}


// Filter Functions
function filterApplications() {
    loadApplications();
}

function filterApplicationsByStatus() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchStudents').value.toLowerCase();
    
    let filtered = applications;
    
    if (statusFilter) {
        filtered = filtered.filter(app => app.status === statusFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(app => {
            const student = students.find(s => s.id === app.studentId);
            return student.firstName.toLowerCase().includes(searchTerm) || 
                   student.lastName.toLowerCase().includes(searchTerm) ||
                   student.studentId.toLowerCase().includes(searchTerm);
        });
    }
    
    return filtered;
}

function searchApplications() {
    loadApplications();
}

function filterStudents() {
    loadStudents();
}

function filterStudentsByStatus() {
    const statusFilter = document.getElementById('studentStatusFilter').value;
    const searchTerm = (document.getElementById('searchStudentRecords').value || '').trim().toLowerCase();
    
    // Load students from localStorage as single source of truth
    const storedStudents = JSON.parse(localStorage.getItem('students') || '[]');
    students = storedStudents;
    
    let filtered = students;
    
    if (statusFilter) {
        filtered = filtered.filter(student => (student.status || 'active') === statusFilter);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(student => 
            (student.firstName || '').toLowerCase().includes(searchTerm) ||
            (student.lastName || '').toLowerCase().includes(searchTerm) ||
            (student.studentId || '').toLowerCase().includes(searchTerm) ||
            (student.email || '').toLowerCase().includes(searchTerm) ||
            (student.awardNumber || '').toLowerCase().includes(searchTerm) ||
            (student.course || '').toLowerCase().includes(searchTerm) ||
            (student.year || '').toLowerCase().includes(searchTerm)
        );
    }
    
    return filtered;
}

function searchStudents() {
    loadStudents();
}

// Settings Functions
// Removed updateSettings() function - Subsidy Types and System Message sections removed

async function generateReport() {
    try {
        console.log('📄 Generating Excel report...');
        
        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            showToast('Excel library not loaded. Please refresh the page.', 'error');
            return;
        }
        
        // Fetch students from database
        const studentsArr = await getStudentsFromDatabase();
        
        if (!studentsArr || studentsArr.length === 0) {
            showToast('No student data available to generate report.', 'warning');
            return;
        }
        
        // Calculate statistics
        const totalStudents = studentsArr.length;
        const indigenousStudents = studentsArr.filter(s => 
            s.isIndigenous === true || s.isIndigenous === 1 || s.is_indigenous === 1 || s.is_indigenous === true
        ).length;
        const pwdStudents = studentsArr.filter(s => 
            s.isPwd === true || s.isPwd === 1 || s.is_pwd === 1 || s.is_pwd === true
        ).length;
        const archivedStudents = studentsArr.filter(s => {
            const status = s.status || s.student_status || 'active';
            return status.toLowerCase() === 'archived';
        }).length;
        
        // Department breakdown
        const deptCounts = studentsArr.reduce((acc, s) => {
            const d = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
            acc[d] = (acc[d] || 0) + 1;
            return acc;
        }, {});
        
        // Place/Origin breakdown - normalize city names to group same cities
        const normalizeCityName = (place) => {
            if (!place || !place.trim()) return 'Unspecified';
            
            let normalized = place.trim();
            normalized = normalized.toLowerCase();
            normalized = normalized.replace(/\s+(city|town|municipality|municipal|province|prov)$/i, '');
            const parts = normalized.split(',');
            if (parts.length > 1) {
                normalized = parts[0].trim();
            }
            return normalized.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };
        
        const getDisplayName = (place, normalized) => {
            if (!place || !place.trim()) return 'Unspecified';
            const parts = place.trim().split(',');
            return parts[0].trim() || normalized || 'Unspecified';
        };
        
        const placeGroups = {};
        studentsArr.forEach(s => {
            const originalPlace = (s && s.place && s.place.trim()) ? s.place.trim() : '';
            const normalized = normalizeCityName(originalPlace);
            const displayName = getDisplayName(originalPlace, normalized);
            
            if (!placeGroups[normalized]) {
                placeGroups[normalized] = {
                    count: 0,
                    displayName: displayName
                };
            }
            placeGroups[normalized].count++;
        });
        
        const placeCounts = {};
        Object.keys(placeGroups).forEach(normalized => {
            const group = placeGroups[normalized];
            placeCounts[group.displayName] = group.count;
        });
        
        // Course breakdown
        const courseCounts = studentsArr.reduce((acc, s) => {
            const c = (s && s.course && s.course.trim()) ? s.course.trim() : 'Unspecified';
            acc[c] = (acc[c] || 0) + 1;
            return acc;
        }, {});
        
        // Year level breakdown
        const yearCounts = studentsArr.reduce((acc, s) => {
            const y = (s && s.year && s.year.trim()) || (s && s.yearLevel && s.yearLevel.trim()) ? 
                      (s.year || s.yearLevel).trim() : 'Unspecified';
            acc[y] = (acc[y] || 0) + 1;
            return acc;
        }, {});
        
        const reportDate = new Date().toLocaleString();
        const reportDateShort = new Date().toISOString().split('T')[0];
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Summary Statistics
        const summaryData = [
            ['GRANTES SMART SUBSIDY MANAGEMENT SYSTEM'],
            ['STUDENT ANALYTICS REPORT'],
            ['Generated: ' + reportDate],
            [''], // Empty row
            ['SUMMARY STATISTICS'],
            ['', ''],
            ['Total Students', totalStudents],
            ['Indigenous People', indigenousStudents],
            ["PWD's", pwdStudents],
            ['Archived Students', archivedStudents],
            ['Active Students', totalStudents - archivedStudents]
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        ws1['!cols'] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
        
        // Sheet 2: Department Breakdown
        const deptData = [
            ['DEPARTMENT BREAKDOWN'],
            ['', ''],
            ['Department', 'Count', 'Percentage']
        ];
        Object.entries(deptCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([dept, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                deptData.push([dept, count, pct + '%']);
            });
        const ws2 = XLSX.utils.aoa_to_sheet(deptData);
        ws2['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Departments');
        
        // Sheet 3: Origin/Place Breakdown
        const placeData = [
            ['ORIGIN/PLACE BREAKDOWN'],
            ['', ''],
            ['Place/Origin', 'Count', 'Percentage']
        ];
        Object.entries(placeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50) // Top 50
            .forEach(([place, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                placeData.push([place || 'Unspecified', count, pct + '%']);
            });
        const ws3 = XLSX.utils.aoa_to_sheet(placeData);
        ws3['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws3, 'Origins');
        
        // Sheet 4: Course Breakdown
        const courseData = [
            ['COURSE BREAKDOWN'],
            ['', ''],
            ['Course', 'Count', 'Percentage']
        ];
        Object.entries(courseCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([course, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                courseData.push([course || 'Unspecified', count, pct + '%']);
            });
        const ws4 = XLSX.utils.aoa_to_sheet(courseData);
        ws4['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws4, 'Courses');
        
        // Sheet 5: Year Level Breakdown
        const yearData = [
            ['YEAR LEVEL BREAKDOWN'],
            ['', ''],
            ['Year Level', 'Count', 'Percentage']
        ];
        Object.entries(yearCounts)
            .sort((a, b) => {
                const order = {'1st': 1, '2nd': 2, '3rd': 3, '4th': 4};
                return (order[a[0]] || 99) - (order[b[0]] || 99);
            })
            .forEach(([year, count]) => {
                const pct = ((count / totalStudents) * 100).toFixed(1);
                yearData.push([year + ' Year', count, pct + '%']);
            });
        const ws5 = XLSX.utils.aoa_to_sheet(yearData);
        ws5['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws5, 'Year Levels');
        
        // Sheet 6: Student List (Main Data Sheet)
        const studentData = [
            ['STUDENT LIST'],
            ['', ''],
            ['#', 'First Name', 'Last Name', 'Student ID', 'Email', 'Department', 'Course', 'Year Level', 'Place/Origin', 'Indigenous', "PWD's", 'Status', 'Award Number']
        ];
        studentsArr.forEach((s, idx) => {
            studentData.push([
                idx + 1,
                s.firstName || '',
                s.lastName || '',
                s.studentId || 'N/A',
                s.email || 'N/A',
                s.department || 'N/A',
                s.course || 'N/A',
                s.year || s.yearLevel || 'N/A',
                s.place || s.from || s.origin || 'N/A',
                (s.isIndigenous || s.is_indigenous) ? 'Yes' : 'No',
                (s.isPwd || s.is_pwd) ? 'Yes' : 'No',
                s.status || s.student_status || 'active',
                s.awardNumber || s.award_number || 'N/A'
            ]);
        });
        const ws6 = XLSX.utils.aoa_to_sheet(studentData);
        // Set column widths
        ws6['!cols'] = [
            { wch: 5 },   // #
            { wch: 15 },  // First Name
            { wch: 15 },  // Last Name
            { wch: 12 },  // Student ID
            { wch: 25 },  // Email
            { wch: 35 },  // Department
            { wch: 15 },  // Course
            { wch: 12 },  // Year Level
            { wch: 20 },  // Place/Origin
            { wch: 12 },  // Indigenous
            { wch: 10 },  // PWD's
            { wch: 12 },  // Status
            { wch: 15 }   // Award Number
        ];
        // Freeze header row
        ws6['!freeze'] = { x: 0, y: 2 };
        XLSX.utils.book_append_sheet(wb, ws6, 'Student List');
        
        // Generate Excel file and download
        const fileName = `grantes_report_${reportDateShort}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast('Excel report generated and downloaded successfully!', 'success');
        console.log('✅ Excel report generated successfully:', fileName);
        
    } catch (error) {
        console.error('❌ Error generating Excel report:', error);
        showToast('Failed to generate Excel report: ' + error.message, 'error');
    }
}

// Notification Functions
function addNotification(studentId, title, message) {
    const notification = {
        id: notifications.length + 1,
        studentId: studentId,
        title: title,
        message: message,
        date: new Date().toISOString(),
        read: false
    };
    
    notifications.push(notification);
}

function generateSampleNotifications() {
    // Generate some sample notifications
    if (notifications.length === 0) {
        addNotification(1, 'Welcome!', 'Welcome to GranTES Smart Subsidy Management System');
        addNotification(2, 'Application Received', 'Your application has been received and is under review');
    }
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
        setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function closeModal() {
    document.getElementById('reviewModal').style.display = 'none';
    currentApplicationId = null;
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Export data functions (for demo purposes)
function exportStudents() {
    const dataStr = JSON.stringify(students, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students.json';
    link.click();
}

function exportApplications() {
    const dataStr = JSON.stringify(applications, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'applications.json';
    link.click();
}

// Chat Functions
function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    const chatToggle = document.getElementById('chatToggle');
    
    if (chatIsOpen) {
        closeChat();
    } else {
        openChat();
    }
}

function openChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.add('show');
    chatIsOpen = true;
    chatIsMinimized = false;
    
    // Clear unread count
    unreadMessageCount = 0;
    updateChatBadge();
    
    // Load chat messages
    loadChatMessages();
    
    // Focus on input
    setTimeout(() => {
        document.getElementById('chatInput').focus();
    }, 300);
}

function closeChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.remove('show');
    chatIsOpen = false;
    chatIsMinimized = false;
}

function toggleChatMinimize() {
    const chatBox = document.getElementById('chatBox');
    chatIsMinimized = !chatIsMinimized;
    
    if (chatIsMinimized) {
        chatBox.classList.add('minimized');
    } else {
        chatBox.classList.remove('minimized');
    }
}

function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    
    // Clear welcome message if there are chat messages
    if (chatMessages.length > 0) {
        container.innerHTML = '';
        
        chatMessages.forEach(message => {
            addMessageToChat(message);
        });
    }
    
    scrollChatToBottom();
}

function addMessageToChat(message) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === 'user' ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${message.sender === 'user' ? 
                (currentUser && currentUser.role === 'student' ? 'S' : 'A') : 
                (message.sender === 'admin' ? 'A' : 'S')
            }
        </div>
        <div class="message-content">
            <div>${message.text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollChatToBottom();
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    const userMessage = {
        id: Date.now(),
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString(),
        userId: currentUser ? currentUser.id : 'anonymous'
    };
    
    chatMessages.push(userMessage);
    addMessageToChat(userMessage);
    
    // Clear input
    input.value = '';
}

    

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'typing-indicator show';
    typingDiv.innerHTML = `
        <div class="message received">
            <div class="message-avatar">A</div>
            <div class="message-content">
                <div>Admin is typing<span class="typing-dots">.</span><span class="typing-dots">.</span><span class="typing-dots">.</span></div>
            </div>
        </div>
    `;
    
    container.appendChild(typingDiv);
    scrollChatToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollChatToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (unreadMessageCount > 0) {
        badge.textContent = unreadMessageCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function sendMessageToStudent(studentId) {
    adminActiveChatStudentId = studentId;
    openStudentProfileModal(studentId);
}

// Initialize chat when user logs in
function initializeChat() {
    if (currentUser) {
        // Show chat toggle for logged in users
        const chatToggle = document.getElementById('chatToggle');
        if (chatToggle) {
            chatToggle.style.display = 'flex';
        }
        
        // Set appropriate chat header based on user role
        const chatUserName = document.getElementById('chatUserName');
        if (chatUserName) {
            if (currentUser.role === 'admin') {
                chatUserName.textContent = 'Student Support';
            } else {
                chatUserName.textContent = 'Admin Support';
            }
        }
        
        // Initialize profile chat
        initializeProfileChat();
    } else {
        const chatToggle = document.getElementById('chatToggle');
        if (chatToggle) {
            chatToggle.style.display = 'none';
        }
    }
}

// Profile Chat Functions
function initializeProfileChat() {
    // Load any existing profile chat messages
    loadProfileChatMessages();
    const fileInput = document.getElementById('profileChatFile');
    if (fileInput) {
        fileInput.addEventListener('change', handleProfileChatFileSelected);
    }
}

function toggleProfileChat() {
    const chatContainer = document.querySelector('.profile-chat-container');
    profileChatIsExpanded = !profileChatIsExpanded;
    
    if (profileChatIsExpanded) {
        chatContainer.style.position = 'fixed';
        chatContainer.style.top = '50%';
        chatContainer.style.left = '50%';
        chatContainer.style.transform = 'translate(-50%, -50%)';
        chatContainer.style.width = '500px';
        chatContainer.style.height = '600px';
        chatContainer.style.zIndex = '2000';
        chatContainer.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
        
        // Update button icon
        const button = chatContainer.querySelector('.profile-chat-header button i');
        button.className = 'fas fa-compress-arrows-alt';
    } else {
        chatContainer.style.position = '';
        chatContainer.style.top = '';
        chatContainer.style.left = '';
        chatContainer.style.transform = '';
        chatContainer.style.width = '';
        chatContainer.style.height = '400px';
        chatContainer.style.zIndex = '';
        chatContainer.style.boxShadow = '';
        
        // Update button icon
        const button = chatContainer.querySelector('.profile-chat-header button i');
        button.className = 'fas fa-expand-arrows-alt';
    }
}

async function loadProfileChatMessages() {
    const container = document.getElementById('profileChatMessages');
    if (!container) return;
    
    if (!currentUser || currentUser.role !== 'student') {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Not available</h5>
                    <p>Student chat is only available for students.</p>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        // Get student ID - handle both camelCase and snake_case
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            container.innerHTML = `
                <div class="chat-welcome">
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h5>Error</h5>
                        <p>Student ID not found.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Load messages from database in BOTH directions:
        // 1. Messages where student sent to admin (student is sender)
        // 2. Messages where admin sent to student (admin is sender)
        const [messagesFromStudent, messagesFromAdmin] = await Promise.all([
            getMessages(normalizedStudentId, 'student', 1, 'admin'),
            getMessages(1, 'admin', normalizedStudentId, 'student')
        ]);
        
        console.log('📨 Student side - Messages from student:', messagesFromStudent);
        console.log('📨 Student side - Messages from admin:', messagesFromAdmin);
        
        // Also load from localStorage as fallback and merge
    loadPersistedChatMessages();
        const localMessages = chatMessages.filter(m => {
            const msgStudentId = m.studentId || m.receiverId;
            const normalizedMsgStudentId = typeof msgStudentId === 'number' 
                ? msgStudentId 
                : parseInt(msgStudentId) || msgStudentId;
            return normalizedMsgStudentId == normalizedStudentId;
        });
        
        // Merge database messages from both directions with local messages, avoiding duplicates
        const allMessages = [];
        const messageMap = new Map();
        
        // Add messages from student to admin
        if (Array.isArray(messagesFromStudent)) {
            messagesFromStudent.forEach(msg => {
                const key = `${msg.createdAt || msg.timestamp || ''}_${msg.content || msg.text || ''}_student`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        
        // Add messages from admin to student
        if (Array.isArray(messagesFromAdmin)) {
            messagesFromAdmin.forEach(msg => {
                const key = `${msg.createdAt || msg.timestamp || ''}_${msg.content || msg.text || ''}_admin`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push(msg);
                }
            });
        }
        // Merge with local messages (for offline/sync purposes)
        localMessages.forEach(localMsg => {
            // Only add if not already in database messages (by timestamp or content)
            const allDbMessages = [...(messagesFromStudent || []), ...(messagesFromAdmin || [])];
            const exists = allDbMessages.some(dbMsg => 
                (dbMsg.content === localMsg.text || dbMsg.text === localMsg.text) && 
                Math.abs(new Date(dbMsg.createdAt || dbMsg.timestamp).getTime() - new Date(localMsg.timestamp).getTime()) < 10000
            );
            if (!exists && localMsg.sender === 'user') {
                // Only add unsent local messages
                const key = `${localMsg.timestamp}_${localMsg.text || ''}_student`;
                if (!messageMap.has(key)) {
                    messageMap.set(key, true);
                    allMessages.push({
                        content: localMsg.text,
                        createdAt: localMsg.timestamp,
                        senderType: 'student',
                        senderId: normalizedStudentId
                    });
                }
            }
        });
        
        // Sort by timestamp
        allMessages.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp);
            const timeB = new Date(b.createdAt || b.timestamp);
            return timeA - timeB;
        });
        
        // Render messages
        container.innerHTML = '';
        
        if (allMessages.length === 0) {
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Start chatting with Admin</h5>
                    <p>This is a direct message between you and admin.</p>
                </div>
            </div>
        `;
        } else {
            allMessages.forEach(message => {
                const messageDiv = document.createElement('div');
                const isStudent = (message.senderType || message.sender) === 'student' || message.sender === 'user';
                messageDiv.className = `profile-message ${isStudent ? 'sent' : 'received'}`;
                const time = new Date(message.createdAt || message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const content = message.content || message.text || '';
                messageDiv.innerHTML = `
                    <div class="profile-message-avatar">${isStudent ? 'S' : 'A'}</div>
                    <div class="profile-message-content">
                        <div>${content}</div>
                        <div class="profile-message-time">${time}</div>
                    </div>
                `;
                container.appendChild(messageDiv);
            });
    }
    
    scrollProfileChatToBottom();
    } catch (error) {
        console.error('Error loading profile chat messages:', error);
        container.innerHTML = `
            <div class="chat-welcome">
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h5>Error loading messages</h5>
                    <p>Please refresh the page.</p>
                </div>
            </div>
        `;
    }
}

function addMessageToProfileChat(message) {
    const container = document.getElementById('profileChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `profile-message ${message.sender === 'user' ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    let contentHtml = '';
    if (message.type === 'file' && message.fileName) {
        const isImage = message.fileType && message.fileType.startsWith('image/');
        if (isImage && message.previewUrl) {
            contentHtml = `<div class="profile-attachment"><img src="${message.previewUrl}" alt="${message.fileName}"></div>`;
        } else {
            contentHtml = `<div class="profile-attachment"><div class="filename">${message.fileName}</div></div>`;
        }
    }
    const textHtml = message.text ? `<div>${message.text}</div>` : '';

    messageDiv.innerHTML = `
        <div class="profile-message-avatar">
            ${message.sender === 'user' ? 
                (currentUser && currentUser.role === 'student' ? 'S' : 'A') : 
                (message.sender === 'admin' ? 'A' : 'S')
            }
        </div>
        <div class="profile-message-content">
            ${contentHtml}
            ${textHtml}
            <div class="profile-message-time">${time}</div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    scrollProfileChatToBottom();
    persistChatMessages();
}

// Prevent double submission for student profile chat
let isSendingProfileMessage = false;

async function sendProfileChatMessage() {
    // Prevent double submission
    if (isSendingProfileMessage) {
        return;
    }
    
    const input = document.getElementById('profileChatInput');
    const message = input.value.trim();
    
    if (!message && !profileChatPendingFile) return;
    
    if (!currentUser || currentUser.role !== 'student') {
        showToast('Only students can send messages', 'error');
        return;
    }
    
    // Set flag to prevent double submission
    isSendingProfileMessage = true;
    
    // Clear input immediately to prevent double send
    if (input) {
        input.value = '';
    }
    
    try {
        // Get student ID and normalize it
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            showToast('Student ID not found', 'error');
            isSendingProfileMessage = false;
            // Restore input if error occurred
            if (input && message) {
                input.value = message;
            }
            return;
        }
        
        // Save message to database
        if (message) {
            const saveResult = await saveMessage({
                senderId: normalizedStudentId,
                receiverId: 1, // Admin ID
                senderType: 'student',
                receiverType: 'admin',
                content: message,
                attachment: null,
                attachmentName: null
            });
            
            // Note: Badge will update automatically via polling (every 5 seconds) on admin side
            // Also add to local storage for immediate display
    const baseMessage = {
        id: Date.now(),
        sender: 'user',
        timestamp: new Date().toISOString(),
                userId: normalizedStudentId,
                studentId: normalizedStudentId,
                text: message
    };
            chatMessages.push(baseMessage);
            persistChatMessages();
        }

        // Handle file attachment if present
    if (profileChatPendingFile) {
        const file = profileChatPendingFile;
            // For now, files are stored locally - you can extend this to save to database
        const isImage = file.type && file.type.startsWith('image/');
        const messageWithFile = {
                id: Date.now(),
                sender: 'user',
                timestamp: new Date().toISOString(),
                userId: normalizedStudentId,
                studentId: normalizedStudentId,
            type: 'file',
            text: message || '',
            fileName: file.name,
            fileType: file.type,
            previewUrl: isImage ? URL.createObjectURL(file) : null
        };
        chatMessages.push(messageWithFile);
            persistChatMessages();
        profileChatPendingFile = null;
        const fileInput = document.getElementById('profileChatFile');
        if (fileInput) fileInput.value = '';
        }
        
        // Reload chat to show the new message
        await loadProfileChatMessages();
    
        // Update notification badge if admin is viewing
        if (currentUser && currentUser.role === 'admin') {
            checkAndUpdateNotificationBadge();
        }
    } catch (error) {
        console.error('Error sending profile chat message:', error);
        showToast('Failed to send message', 'error');
        // Restore input value if error occurred
        if (input && message) {
            input.value = message;
        }
    } finally {
        // Reset flag after sending (with a small delay to prevent rapid clicks)
        setTimeout(() => {
            isSendingProfileMessage = false;
        }, 500);
    }
}


function handleProfileChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent form submission or default behavior
        sendProfileChatMessage();
    }
}

function triggerProfileChatFile() {
    const input = document.getElementById('profileChatFile');
    if (input) input.click();
}

function handleProfileChatFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    profileChatPendingFile = file;
    // Optionally, we could show a small chip indicating a file is attached
}

function showProfileTypingIndicator() {
    const container = document.getElementById('profileChatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'profileTypingIndicator';
    typingDiv.className = 'profile-typing-indicator';
    typingDiv.innerHTML = `
        <div class="profile-message-avatar">A</div>
        <div class="profile-message-content">
            <div>Admin is typing<span class="profile-typing-dots">.</span><span class="profile-typing-dots">.</span><span class="profile-typing-dots">.</span></div>
        </div>
    `;
    
    container.appendChild(typingDiv);
    scrollProfileChatToBottom();
}

function hideProfileTypingIndicator() {
    const typingIndicator = document.getElementById('profileTypingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollProfileChatToBottom() {
    const container = document.getElementById('profileChatMessages');
    container.scrollTop = container.scrollHeight;
}


// Admin Posting Functions
async function createPost(type) {
    console.log('🔵 createPost called with type:', type);
    
    const postInput = document.getElementById('postInput');
    let content = (postInput && postInput.value ? postInput.value.trim() : '').toString();
    const audienceSelect = document.getElementById('postAudience');
    const courseSelect = document.getElementById('postCourse');
    const audience = audienceSelect ? audienceSelect.value : 'students';
    const course = courseSelect ? courseSelect.value : '';
    const imageDataUrl = window.__pendingPostImageDataUrl || null;
    const imageList = Array.isArray(window.__pendingPostImages) ? window.__pendingPostImages : (imageDataUrl ? [imageDataUrl] : []);
    const layout = 'image-left'; // Default layout
    
    if (window.__postingInProgress) {
        console.log('⚠️ Post already in progress, skipping...');
        return; // prevent double submissions
    }
    window.__postingInProgress = true;
    const finish = () => { window.__postingInProgress = false; };
    
    // Require either text or at least one image (except special 'feeling' and 'live' types)
    if (!content && imageList.length === 0 && type !== 'feeling' && type !== 'live') {
        showToast('Please enter text or add at least one image', 'error');
        finish();
        return;
    }
    
    // Special handling for 'feeling' posts
    if (type === 'feeling') {
        console.log('😊 Processing feeling post...');
        // Allow posting feelings/activities without content requirement
        if (!content) {
            content = '😊 Sharing my feeling/activity';
            console.log('📝 Set default content for feeling post');
        }
        console.log('📄 Content for feeling post:', content);
    }
    
    // Prepare post data for database
    const postData = {
        content: content || '',
        type: type,
        audience: audience,
        course: audience === 'specific' ? course : null,
        layout: layout,
        images: imageList.length > 0 ? imageList : null
    };
    

    try {
        console.log('Post data being sent:', postData);
        console.log('Images in postData:', postData.images);
        
        // Save to database using API
        const response = await savePost(postData);
        
        console.log('API Response:', response);
        console.log('Response debug:', response?.debug);
        
        if (!response || !response.success) {
            showToast('Failed to save post to database', 'error');
            finish();
            return;
        }
        
        // Reset inputs
        if (postInput) postInput.value = '';
        if (audienceSelect) audienceSelect.value = 'students';
        if (courseSelect) courseSelect.style.display = 'none';
        clearPostImage();
        
        // Refresh feeds
        await loadAdminPosts();
        // If on Home, refresh Home feed too
        if (document.getElementById('home') && document.getElementById('home').classList.contains('active')) {
            if (typeof loadHomeFeed === 'function') loadHomeFeed();
        }
        showToast('Post created successfully!', 'success');
        console.log('✅ Post created and page refreshed');
    } catch (error) {
        console.error('❌ Error saving post:', error);
        console.error('Error details:', error.message, error.stack);
        showToast('Failed to save post: ' + error.message, 'error');
    } finally {
        finish();
    }
}

// Ensure Publish button uses unified createPost logic
async function publishPost(event) {
    // Prevent default form submission if called from a form
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // Check if there's a pending live post
    if (window.__pendingLivePost) {
        window.__pendingLivePost = false;
        await createPost('live');
    } else {
        await createPost('text');
    }
}

// Post image helpers
function triggerPostImageUpload() {
    const input = document.getElementById('postImageInput');
    if (input) input.click();
}

// Simple carousel renderer and controller
function renderCarousel(images) {
    const id = `carousel-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const resolvedImages = images.map(img => resolveMediaUrl(img));
    const imagesForLightbox = JSON.stringify(resolvedImages).replace(/"/g, '&quot;');
    const slides = resolvedImages.map((src, idx) => `<div class=\"carousel-slide ${idx===0?'active':''}\"><img src=\"${src}\" alt=\"image ${idx+1}\" onclick=\"openImageLightboxFromCarousel('${imagesForLightbox}', ${idx})\" style=\"cursor: pointer;\"></div>`).join('');
    return `
    <div class=\"carousel\" id=\"${id}\" data-index=\"0\">\n        <button class=\"carousel-arrow left\" onclick=\"carouselPrev('${id}')\" aria-label=\"Previous\">&#10094;</button>\n        <div class=\"carousel-track\">${slides}</div>\n        <button class=\"carousel-arrow right\" onclick=\"carouselNext('${id}')\" aria-label=\"Next\">&#10095;</button>\n    </div>`;
}

// Ensure <video> tags have a direct src for better browser compatibility
function normalizePostVideos() {
    try {
        const videos = document.querySelectorAll('video.post-video');
        videos.forEach(v => {
            if (!v.getAttribute('src')) {
                const firstSource = v.querySelector('source');
                if (firstSource && firstSource.getAttribute('src')) {
                    v.setAttribute('src', firstSource.getAttribute('src'));
                    v.load();
                }
            }
        });
    } catch (_) { /* ignore */ }
}

// Resolve media URLs (support absolute, relative, and data URLs; handle file:// debugging)
function resolveMediaUrl(url) {
    try {
        if (!url) return url;
        if (typeof url !== 'string') return url;
        if (url.startsWith('data:')) return url;
        if (/^https?:\/\//i.test(url)) return url;
        // If URL is already absolute root path
        if (url.startsWith('/')) {
            if (location.protocol === 'file:') {
                return 'http://localhost' + url;
            }
            return location.origin + url;
        }
        // Relative path (e.g., uploads/live/...)
        const inGrantes = /\/grantes\//i.test(location.pathname);
        const base = (location.protocol === 'file:')
            ? 'http://localhost/grantes/'
            : (location.origin + (inGrantes ? '/grantes/' : '/'));
        return base + url.replace(/^\/?/, '');
    } catch (_) {
        return url;
    }
}

function carouselNext(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const slides = el.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    let index = parseInt(el.getAttribute('data-index') || '0', 10);
    slides[index].classList.remove('active');
    index = (index + 1) % slides.length;
    slides[index].classList.add('active');
    el.setAttribute('data-index', String(index));
}

function carouselPrev(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const slides = el.querySelectorAll('.carousel-slide');
    if (slides.length === 0) return;
    let index = parseInt(el.getAttribute('data-index') || '0', 10);
    slides[index].classList.remove('active');
    index = (index - 1 + slides.length) % slides.length;
    slides[index].classList.add('active');
    el.setAttribute('data-index', String(index));
}

function handlePostImagesSelected(event) {
    const files = (event.target.files && Array.from(event.target.files)) || [];
    if (files.length === 0) return;
    const imageFiles = files.filter(f => f.type && f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
        showToast('Please select image files', 'error');
        return;
    }
    const readers = [];
    window.__pendingPostImages = [];
    imageFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            window.__pendingPostImages.push(e.target.result);
            if (idx === 0) {
                window.__pendingPostImageDataUrl = e.target.result;
                const prev = document.getElementById('postImagePreview');
                const img = document.getElementById('postImagePreviewImg');
                const count = document.getElementById('postImageCount');
                if (prev && img) {
                    img.src = e.target.result;
                    prev.style.display = 'flex';
                }
                if (count) {
                    count.textContent = `+${Math.max(0, imageFiles.length - 1)}`;
                    count.style.display = imageFiles.length > 1 ? 'inline-flex' : 'none';
                }
            } else {
                const count = document.getElementById('postImageCount');
                if (count) {
                    count.textContent = `+${Math.max(0, window.__pendingPostImages.length - 1)}`;
                    count.style.display = window.__pendingPostImages.length > 1 ? 'inline-flex' : 'none';
                }
            }
        };
        reader.readAsDataURL(file);
        readers.push(reader);
    });
}

function clearPostImage() {
    window.__pendingPostImageDataUrl = null;
    window.__pendingPostImages = [];
    const input = document.getElementById('postImageInput');
    if (input) input.value = '';
    const prev = document.getElementById('postImagePreview');
    const img = document.getElementById('postImagePreviewImg');
    const count = document.getElementById('postImageCount');
    if (prev && img) {
        img.src = '';
        prev.style.display = 'none';
    }
    if (count) { count.style.display = 'none'; }
}

// Update like button state immediately without reloading
function updateLikeButtonState(postId, isLiked) {
    const normalizedPostId = typeof postId === 'number' ? postId : parseInt(postId);
    
    // Find all like buttons for this post (different pages might have different button structures)
    const postElement = document.querySelector(`[data-post-id="${normalizedPostId}"]`);
    if (!postElement) return;
    
    // Find like buttons - could be action-btn like-btn or post-action-btn
    // Check for buttons that have the like-btn class or buttons that call like functions
    const likeButtons = postElement.querySelectorAll('.like-btn');
    const actionButtons = postElement.querySelectorAll('.post-action-btn');
    
    // Process action-btn like-btn buttons
    likeButtons.forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes('ToggleLike') || onclick.includes(`${normalizedPostId}`)) {
            if (isLiked) {
                btn.classList.add('liked');
                const span = btn.querySelector('span');
                if (span && !span.textContent.match(/^\d+$/)) {
                    // Only update text if it's not just a number (like count)
                    span.textContent = 'Liked';
                }
            } else {
                btn.classList.remove('liked');
                const span = btn.querySelector('span');
                if (span && !span.textContent.match(/^\d+$/)) {
                    // Only update text if it's not just a number (like count)
                    span.textContent = 'Like';
                }
            }
        }
    });
    
    // Process post-action-btn buttons (used in announcements)
    actionButtons.forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes('ToggleLike') || onclick.includes(`${normalizedPostId}`)) {
            // Check if it's a like button (has heart icon)
            const icon = btn.querySelector('i');
            if (icon && icon.classList.contains('fa-heart')) {
                if (isLiked) {
                    btn.classList.add('liked');
                } else {
                    btn.classList.remove('liked');
                }
            }
        }
    });
}

async function toggleLike(postId) {
    console.log('🔵 toggleLike called for post:', postId);
    
    // Convert postId to number for consistent comparison
    const normalizedPostId = typeof postId === 'number' ? postId : parseInt(postId);
    
    // Prevent multiple rapid clicks - use a global flag
    if (window.__likingInProgress && window.__likingInProgress === normalizedPostId) {
        console.log('⚠️ Like already in progress for post:', normalizedPostId);
        return;
    }
    window.__likingInProgress = normalizedPostId;
    
    // Track liked posts in localStorage
    const likedPostsKey = 'likedPosts';
    let likedPosts = JSON.parse(localStorage.getItem(likedPostsKey) || '[]');
    // Normalize IDs in localStorage for comparison
    likedPosts = likedPosts.map(id => typeof id === 'number' ? id : parseInt(id));
    const isLiked = likedPosts.includes(normalizedPostId);
    
    console.log('📊 Current like state:', isLiked ? 'liked' : 'not liked');
    
    try {
        const action = isLiked ? 'unlike' : 'like';
        console.log('📤 Sending', action, 'request for post:', normalizedPostId);
        
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: normalizedPostId,
            action: action
        });
        
        console.log('📥 API Response:', response);
        
        if (response && response.success) {
            // Update liked posts list
            const wasLiked = isLiked;
            if (wasLiked) {
                likedPosts = likedPosts.filter(id => id !== normalizedPostId);
                showToast('Like removed', 'success');
            } else {
                if (!likedPosts.includes(normalizedPostId)) {
                    likedPosts.push(normalizedPostId);
                }
                showToast('Post liked!', 'success');
            }
            localStorage.setItem(likedPostsKey, JSON.stringify(likedPosts));
            
            // Update button state immediately without full reload
            updateLikeButtonState(normalizedPostId, !wasLiked);
            
            // Reload posts to show updated count
            await loadAdminPosts();
        } else {
            const errorMsg = response?.message || 'Unknown error';
            console.error('❌ Like failed:', errorMsg);
            showToast('Failed to toggle like: ' + errorMsg, 'error');
        }
    } catch (error) {
        console.error('❌ Error toggling like:', error);
        showToast('Failed to toggle like: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        // Clear the flag after a delay
        setTimeout(() => {
            window.__likingInProgress = null;
        }, 1000);
    }
}

async function commentPost(postId) {
    const input = document.getElementById(`commentInput-${postId}`);
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    console.log('Attempting to comment on post:', postId, 'Comment:', comment);
    
    try {
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'comment',
            comment: comment,
            author: 'Administrator'
        });
        
        console.log('Comment API Response:', response);
        
        if (response && response.success) {
            input.value = '';
            // Reset loaded flag so comments reload
            const commentsListDiv = document.getElementById(`admin-comments-list-${postId}`);
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'false';
            }
            await loadAdminPosts();
            // Reload comments to show the new one
            await loadAdminComments(postId);
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'true';
            }
            showToast('Comment added!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            console.error('Comment failed:', errorMsg);
            showToast(`Failed to add comment: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment: ' + error.message, 'error');
    }
}

async function sharePost(postId) {
    try {
        // Update shares count in database
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'share'
        });
        
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        } catch (clipboardError) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Post link copied to clipboard!', 'success');
        }
        
        // Refresh to update shares count
        await loadAdminPosts();
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

async function adminDeletePost(postId) {
    if (!confirm('Delete this post permanently?')) return;
    
    try {
        const response = await apiCall('delete_post.php', 'POST', {
            postId: postId
        });
        
        if (response && response.success) {
        await loadAdminPosts();
        try { loadHomeFeed(); } catch (_) { /* ignore */ }
            showToast('Post deleted successfully!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            showToast(`Failed to delete: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Failed to delete post', 'error');
    }
}

// Helper function to display comments
function displayCommentsHTML(postId, comments) {
    if (!comments || comments.length === 0) {
        return '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
    }
    
    // Sort comments by timestamp (newest first, or if no timestamp, by order)
    const sortedComments = [...comments].sort((a, b) => {
        const timeA = a.timestamp || a.created_at || '';
        const timeB = b.timestamp || b.created_at || '';
        return timeB.localeCompare(timeA); // Newest first
    });
    
    return sortedComments.map(comment => {
        const commentText = comment.content || comment.text || '';
        const commentAuthor = comment.author || 'User';
        const commentTime = comment.timestamp || comment.created_at || '';
        const authorInitial = commentAuthor.charAt(0).toUpperCase();
        
        // Escape HTML to prevent XSS
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        return `
        <div class="comment-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; align-items: flex-start;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                    ${escapeHtml(authorInitial)}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                        ${escapeHtml(commentAuthor)}
                </div>
                    <div style="color: #4b5563; margin-bottom: 4px; word-wrap: break-word; white-space: pre-wrap;">
                        ${escapeHtml(commentText)}
                </div>
                <div style="font-size: 12px; color: #9ca3af;">
                        ${commentTime ? formatDate(commentTime) : 'Recently'}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

// Load and display comments for admin
async function loadAdminComments(postId) {
    const commentsListDiv = document.getElementById(`admin-comments-list-${postId}`);
    if (!commentsListDiv) return;
    
    try {
        const posts = await getPosts(); // Get all posts (no audience filter for admin)
        const post = posts.find(p => p.id === postId);
        
        if (post && post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
                commentsListDiv.innerHTML = displayCommentsHTML(postId, post.comments);
        } else {
            commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
        }
    } catch (error) {
        console.error('Error loading admin comments:', error);
        commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">Error loading comments</p>';
    }
}

// Load and display comments for students
async function loadStudentComments(postId) {
    const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
    if (!commentsListDiv) return;
    
    try {
        // Try to get comments from the post data first
        const posts = await getPosts('students');
        const post = posts.find(p => p.id == postId);
        
        if (post && post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
                commentsListDiv.innerHTML = displayCommentsHTML(postId, post.comments);
            } else {
                commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
        }
    } catch (error) {
        console.error('Error loading student comments:', error);
        commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">Error loading comments</p>';
    }
}

function toggleAdminComments(postId) {
    const commentsDiv = document.getElementById(`admin-comments-${postId}`);
    const commentsListDiv = document.getElementById(`admin-comments-list-${postId}`);
    
    if (!commentsDiv) return;
    
    if (commentsDiv.style.display === 'none' || commentsDiv.style.display === '') {
        commentsDiv.style.display = 'block';
        
        // Load comments from database if not already loaded
        if (commentsListDiv && commentsListDiv.dataset.loaded !== 'true') {
            loadAdminComments(postId).then(() => {
                if (commentsListDiv) {
                    commentsListDiv.dataset.loaded = 'true';
                }
            });
        }
    } else {
        commentsDiv.style.display = 'none';
    }
}

// Handle post input keypress
async function handlePostKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        await createPost('text');
    }
}

// Load admin posts from database
async function loadAdminPosts() {
    const container = document.getElementById('postsFeed');
    if (!container) {
        console.log('postsFeed container not found');
        return;
    }
    
    try {
        // Get posts from database
        console.log('Loading admin posts...');
        const posts = await getPosts();
        console.log('Posts loaded:', posts);
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <h3>No posts yet</h3>
                    <p>Start by creating your first announcement!</p>
                </div>
            `;
            return;
        }
        
        // Get liked posts from localStorage
        const likedPostsKey = 'likedPosts';
        const likedPosts = JSON.parse(localStorage.getItem(likedPostsKey) || '[]');
        const normalizedLikedPosts = likedPosts.map(id => typeof id === 'number' ? id : parseInt(id));
        
        // Render posts
        container.innerHTML = posts.map(post => {
            let imagesHtml = '';
            
            console.log('Post images:', post.images);
            
            if (post.images) {
                console.log('Post has images field:', post.images);
                console.log('Type of post.images:', typeof post.images);
                console.log('Is array?:', Array.isArray(post.images));
                
                // Handle both array and object formats
                let imageArray = [];
                
                if (Array.isArray(post.images)) {
                    imageArray = post.images;
                    console.log('Images is already an array');
                } else if (typeof post.images === 'string') {
                    console.log('Images is a string, attempting to parse');
                    try {
                        const parsed = JSON.parse(post.images);
                        imageArray = Array.isArray(parsed) ? parsed : [parsed];
                        console.log('Successfully parsed JSON');
                    } catch (e) {
                        console.log('JSON parse failed, treating as single image');
                        imageArray = [post.images];
                    }
                } else if (post.images) {
                    imageArray = [post.images];
                }
                
                // Handle double-encoded JSON (string that contains JSON array)
                imageArray = imageArray.map(img => {
                    // Check if img is a string that looks like JSON
                    if (typeof img === 'string' && img.trim().startsWith('[') && img.trim().endsWith(']')) {
                        try {
                            const parsed = JSON.parse(img);
                            // If parsing gives us an array, return the first element
                            if (Array.isArray(parsed)) {
                                return parsed[0];
                            }
                            return parsed;
                        } catch (e) {
                            return img;
                        }
                    }
                    return img;
                });
                
                // Filter out any null/undefined/empty values
                imageArray = imageArray.filter(img => {
                    const isValid = img && typeof img === 'string' && img.trim() !== '' && img.length > 10;
                    console.log('Image valid?', isValid, img ? img.substring(0, 50) : 'N/A');
                    return isValid;
                });
                
                console.log('Final images array:', imageArray);
                console.log('Number of images after filter:', imageArray.length);
                
                if (imageArray.length === 1) {
                    const item = imageArray[0];
                    const isVideo = typeof item === 'string' && (
                        item.startsWith('data:video/') || 
                        item.includes('video/webm') ||
                        item.includes('video/mp4')
                    );
                    
                    if (isVideo) {
                        console.log('Rendering single video');
                        imagesHtml = `
                            <div class="post-video-container">
                                <video controls class="post-video" style="width: 100%; max-width: 100%; border-radius: 8px; margin-top: 10px; background: #000;">
                                    <source src="${item}" type="video/webm">
                                    <source src="${item}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        `;
                    } else {
                    console.log('Rendering single image');
                        imagesHtml = `<div class="post-image-container"><img src="${resolveMediaUrl(item)}" alt="Post image" class="post-image" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block; cursor: pointer;" onclick="openImageLightbox(['${resolveMediaUrl(item).replace(/'/g, "\\'")}'], 0)"></div>`;
                    }
                } else if (imageArray.length > 1) {
                    console.log('Rendering carousel with', imageArray.length, 'images');
                    imagesHtml = renderCarousel(imageArray);
                } else {
                    console.log('No valid images to render');
                }
            } else {
                console.log('Post has no images field');
            }
            
            return `
                <div class="post-item" data-post-id="${post.id}">
                    <div class="post-header">
                        <div class="post-author">
                            <div class="post-avatar"><i class="fas fa-user-shield"></i></div>
                            <div class="post-author-info">
                                <span class="post-author-name">Administrator</span>
                                <span class="post-time">${formatDate(post.created_at)}</span>
                            </div>
                        </div>
                        <div class="post-menu">
                            <button class="post-menu-btn" onclick="openPostMenu(${post.id})" title="More options">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${post.content || ''}</p>
                        ${imagesHtml}
                    </div>
                    <div class="post-engagement">
                        <div class="post-reactions">
                            <span class="reactions-count"><span class="count-num">${post.likes || 0}</span> <span class="count-label">likes</span></span>
                            <span class="comments-count"><span class="count-num">${post.comments_count || 0}</span> <span class="count-label">comments</span></span>
                        </div>
                        <div class="post-actions">
                            ${(() => {
                                const normalizedPostId = typeof post.id === 'number' ? post.id : parseInt(post.id);
                                const isLiked = normalizedLikedPosts.includes(normalizedPostId);
                                const likedClass = isLiked ? ' liked' : '';
                                const likeText = isLiked ? 'Liked' : 'Like';
                                return `<button class="action-btn like-btn${likedClass}" onclick="toggleLike(${post.id})">
                                <i class="fas fa-thumbs-up"></i>
                                <span>${likeText}</span>
                            </button>`;
                            })()}
                            <button class="action-btn comment-btn" onclick="toggleAdminComments(${post.id})">
                                <i class="fas fa-comment"></i>
                                <span>Comment</span>
                            </button>
                        </div>
                        <div id="admin-comments-${post.id}" class="comments-section" style="display: none;">
                            <div id="admin-comments-list-${post.id}" data-loaded="false"></div>
                            <div class="comment-input-container">
                                <input type="text" placeholder="Write a comment..." id="commentInput-${post.id}" class="comment-input" onkeypress="if(event.key==='Enter') commentPost(${post.id})">
                                <button onclick="commentPost(${post.id})" class="comment-submit-btn">
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading admin posts:', error);
        container.innerHTML = `
            <div class="welcome-message">
                <h3>Error loading posts</h3>
                <p>Please try refreshing the page.</p>
            </div>
        `;
    }
}

function openPostMenu(postId) {
    // Simple implementation - show delete option
    if (confirm('Delete this post?')) {
        adminDeletePost(postId);
    }
}

// Student Tab Navigation
function showStudentTab(tabName) {
    // Hide homepage content and show tab content
    const homepageContent = document.getElementById('student-homepage-content');
    const tabContent = document.querySelector('#student-homepage .tab-content');
    const navTabs = document.querySelector('#student-homepage .admin-nav-tabs');
    
    if (tabName === 'homepage') {
        homepageContent.style.display = 'block';
        tabContent.style.display = 'none';
        navTabs.style.display = 'none';
        // Load posts for student homepage
        loadStudentHomepagePosts();
        // Mark posts as viewed when viewing homepage
        markStudentPostsAsViewed();
        return;
    }
    
    // Show tab content
    homepageContent.style.display = 'none';
    tabContent.style.display = 'block';
    navTabs.style.display = 'flex';
    
    // Hide all tab panels
    document.querySelectorAll('#student-homepage .tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('#student-homepage .nav-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab panel
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Add active class to clicked tab button (only if called from a click)
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.classList.add('active');
    } else {
        // If called programmatically, set active on the correct nav button
        const btn = document.querySelector(`#student-homepage .nav-tab-btn[onclick*="'${tabName}'"]`);
        if (btn) btn.classList.add('active');
    }
    
    // Load specific content based on tab
    switch(tabName) {
        case 'announcements':
            loadStudentAnnouncements();
            // Mark announcements as viewed
            markStudentPostsAsViewed();
            // Clear announcements badge
            updateStudentBadgeDisplay('studentAnnouncementsBadge', 0);
            break;
        case 'messages':
            // Defer to ensure panel is visible before rendering
            setTimeout(() => {
                loadStudentMessages();
                // Mark messages as viewed
                markStudentMessagesAsViewed();
                // Clear messages badge
                updateStudentBadgeDisplay('studentMessagesBadge', 0);
            }, 0);
            break;
        case 'claimed-dates':
            // Load student's claimed dates
            setTimeout(() => {
                loadStudentClaimedDates();
            }, 0);
            break;
        case 'profile':
            loadStudentProfile();
            break;
    }
}

// Mark student posts/announcements as viewed
async function markStudentPostsAsViewed() {
    try {
        const posts = await getPosts('students');
        if (posts && Array.isArray(posts) && posts.length > 0) {
            // Get the latest post timestamp
            const latestPostTime = Math.max(...posts.map(post => {
                return new Date(post.created_at || post.createdAt || post.timestamp || 0).getTime();
            }));
            
            // Update last viewed timestamp
            localStorage.setItem('studentLastViewedPosts', String(latestPostTime));
            
            // Update badges after marking as viewed
            if (typeof checkAndUpdateStudentNotificationBadges === 'function') {
                checkAndUpdateStudentNotificationBadges();
            }
        }
    } catch (error) {
        console.log('Error marking posts as viewed:', error);
    }
}

// Mark student messages as viewed
async function markStudentMessagesAsViewed() {
    try {
        if (!currentUser || currentUser.role !== 'student') {
            return;
        }
        
        const studentId = currentUser.studentData?.id || currentUser.studentData?.student_id;
        const normalizedStudentId = typeof studentId === 'number' 
            ? studentId 
            : parseInt(studentId) || studentId;
        
        if (!normalizedStudentId) {
            return;
        }
        
        if (typeof getMessages === 'function') {
            const messagesFromAdmin = await getMessages(1, 'admin', normalizedStudentId, 'student');
            
            if (Array.isArray(messagesFromAdmin) && messagesFromAdmin.length > 0) {
                // Get the latest message timestamp from admin
                const adminMessages = messagesFromAdmin.filter(msg => {
                    const senderType = msg.senderType || msg.sender || '';
                    const senderId = msg.senderId || msg.sender_id || 0;
                    return senderId === 1 || senderId === '1' || senderType === 'admin';
                });
                
                if (adminMessages.length > 0) {
                    const latestMessageTime = Math.max(...adminMessages.map(msg => {
                        return new Date(msg.createdAt || msg.timestamp || 0).getTime();
                    }));
                    
                    // Update last viewed timestamp
                    localStorage.setItem('studentLastViewedMessages', String(latestMessageTime));
                    
                    // Update badges after marking as viewed
                    if (typeof checkAndUpdateStudentNotificationBadges === 'function') {
                        checkAndUpdateStudentNotificationBadges();
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error marking messages as viewed:', error);
    }
}

// Student Messaging Functions
async function sendMessage() {
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    
    if (!text) return;

    try {
        const messageData = {
            senderId: currentUser.studentData.id,
            receiverId: 1, // Admin ID
            senderType: 'student',
            receiverType: 'admin',
            content: text,
            attachment: null,
            attachmentName: null
        };
        
        // Save to database
        const response = await saveMessage(messageData);
        
        if (response && response.success) {
            input.value = '';
            await loadStudentMessages();
            
            // Note: Badge will update automatically via polling (every 5 seconds) on admin side
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

// simulateAdminResponse removed in favor of shared chatMessages

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function triggerFileUpload() {
    document.getElementById('chatFileInput').click();
}

// Student Announcement Functions
async function studentToggleLike(postId) {
    console.log('🔵 studentToggleLike called for post:', postId);
    
    // Convert postId to number for consistent comparison
    const normalizedPostId = typeof postId === 'number' ? postId : parseInt(postId);
    
    // Prevent multiple rapid clicks - use a global flag
    if (window.__likingInProgress && window.__likingInProgress === normalizedPostId) {
        console.log('⚠️ Like already in progress for post:', normalizedPostId);
        return;
    }
    window.__likingInProgress = normalizedPostId;
    
    // Track liked posts in localStorage
    const likedPostsKey = 'likedPosts';
    let likedPosts = JSON.parse(localStorage.getItem(likedPostsKey) || '[]');
    // Normalize IDs in localStorage for comparison
    likedPosts = likedPosts.map(id => typeof id === 'number' ? id : parseInt(id));
    const isLiked = likedPosts.includes(normalizedPostId);
    
    console.log('📊 Current like state:', isLiked ? 'liked' : 'not liked');
    
    try {
        const action = isLiked ? 'unlike' : 'like';
        console.log('📤 Sending', action, 'request for post:', normalizedPostId);
        
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: normalizedPostId,
            action: action
        });
        
        console.log('📥 API Response:', response);
        
        if (response && response.success) {
            // Update liked posts list
            const wasLiked = isLiked;
            if (wasLiked) {
                likedPosts = likedPosts.filter(id => id !== normalizedPostId);
                showToast('Like removed', 'success');
            } else {
                if (!likedPosts.includes(normalizedPostId)) {
                    likedPosts.push(normalizedPostId);
                }
                showToast('Post liked!', 'success');
            }
            localStorage.setItem(likedPostsKey, JSON.stringify(likedPosts));
            
            // Update button state immediately without full reload
            updateLikeButtonState(normalizedPostId, !wasLiked);
            
            // Reload posts to show updated count
            await loadStudentAnnouncements();
            // Also reload student homepage posts if on homepage
            try {
                await loadStudentHomepagePosts();
            } catch (e) {
                // Ignore if not on homepage
            }
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            console.error('❌ Like failed:', errorMsg);
            showToast(`Failed to toggle like: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('❌ Error toggling like:', error);
        showToast('Failed to toggle like: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        // Clear the flag after a delay
        setTimeout(() => {
            window.__likingInProgress = null;
        }, 1000);
    }
}

function studentToggleComments(postId) {
    const commentsSection = document.getElementById(`student-comments-${postId}`);
    const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
    
    if (!commentsSection) return;
    
    if (commentsSection.style.display === 'none' || commentsSection.style.display === '') {
        commentsSection.style.display = 'block';
        
        // Load comments from database if not already loaded
        if (commentsListDiv && commentsListDiv.dataset.loaded !== 'true') {
            loadStudentComments(postId).then(() => {
                if (commentsListDiv) {
                    commentsListDiv.dataset.loaded = 'true';
                }
            });
        }
    } else {
        commentsSection.style.display = 'none';
    }
}

async function loadStudentComments(postId) {
    const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
    if (!commentsListDiv) return;
    
    try {
        // Try to get comments from the post data first
        const posts = await getPosts('students');
        const post = posts.find(p => p.id == postId);
        
        if (post && post.comments && Array.isArray(post.comments)) {
            const comments = post.comments;
            if (comments.length === 0) {
                commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
            } else {
                commentsListDiv.innerHTML = comments.map(comment => `
                    <div class="comment-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; align-items: flex-start;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                            ${comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                                ${comment.author || 'User'}
                            </div>
                            <div style="color: #4b5563; margin-bottom: 4px; word-wrap: break-word;">
                                ${comment.content || comment.text || ''}
                            </div>
                            <div style="font-size: 12px; color: #9ca3af;">
                                ${formatDate(comment.created_at || comment.timestamp)}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
            return;
        }
        
        // Fallback: try API endpoint
        const response = await apiCall(`get_post_comments.php?postId=${postId}`);
        if (response && response.success && response.comments) {
            const comments = response.comments;
            if (comments.length === 0) {
                commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
            } else {
                commentsListDiv.innerHTML = comments.map(comment => `
                    <div class="comment-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid #eee; align-items: flex-start;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                            ${comment.author ? comment.author.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; margin-bottom: 4px; color: #374151;">
                                ${comment.author || 'User'}
                            </div>
                            <div style="color: #4b5563; margin-bottom: 4px; word-wrap: break-word;">
                                ${comment.content || comment.text || ''}
                            </div>
                            <div style="font-size: 12px; color: #9ca3af;">
                                ${formatDate(comment.created_at || comment.timestamp)}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } else {
            commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        commentsListDiv.innerHTML = '<p style="text-align: center; color: #9ca3af; font-style: italic; padding: 15px;">No comments yet</p>';
    }
}

async function studentCommentPost(postId) {
    const input = document.getElementById(`studentCommentInput-${postId}`);
    if (!input) return;
    
    const comment = input.value.trim();
    if (!comment) return;
    
    console.log('Attempting to comment on post:', postId, 'Comment:', comment);
    
    try {
        const authorName = currentUser && currentUser.studentData 
            ? `${currentUser.studentData.firstName} ${currentUser.studentData.lastName}` 
            : 'Student';
            
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'comment',
            comment: comment,
            author: authorName
        });
        
        console.log('Comment API Response:', response);
        
        if (response && response.success) {
            input.value = '';
            // Reset loaded flag so comments reload
            const commentsListDiv = document.getElementById(`student-comments-list-${postId}`);
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'false';
            }
            // Reload posts and comments
            await loadStudentAnnouncements();
            await loadStudentComments(postId);
            // Also reload student homepage posts if on homepage  
            try {
                await loadStudentHomepagePosts();
            } catch (e) {
                // Ignore if not on homepage
            }
            if (commentsListDiv) {
                commentsListDiv.dataset.loaded = 'true';
            }
            showToast('Comment added!', 'success');
        } else {
            const errorMsg = response ? response.message : 'Unknown error';
            console.error('Comment failed:', errorMsg);
            showToast(`Failed to add comment: ${errorMsg}`, 'error');
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('Failed to add comment: ' + error.message, 'error');
    }
}

async function studentSharePost(postId) {
    try {
        // Update shares count in database
        const response = await apiCall('update_post_engagement.php', 'POST', {
            postId: postId,
            action: 'share'
        });
        
        // Copy link to clipboard
        const shareUrl = `${window.location.origin}${window.location.pathname}?post=${postId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Post link copied to clipboard!', 'success');
        } catch (clipboardError) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Post link copied to clipboard!', 'success');
        }
        
        // Refresh to update shares count
        await loadStudentAnnouncements();
    } catch (error) {
        console.error('Error sharing post:', error);
        showToast('Failed to share post', 'error');
    }
}

// Legacy functions for backward compatibility
function togglePostLike(postId) {
    studentToggleLike(postId);
}

function toggleComments(postId) {
    studentToggleComments(postId);
}

function addComment(postId) {
    studentCommentPost(postId);
}

function renderComments(comments) {
    if (comments.length === 0) {
        return '<p style="text-align: center; color: #9ca3af; font-style: italic;">No comments yet</p>';
    }

    return comments.map(comment => `
        <div class="comment-item">
            <div class="comment-avatar">${comment.author.charAt(0).toUpperCase()}</div>
            <div class="comment-content">
                <div class="comment-author">${comment.author}</div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-time">${formatDate(comment.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// Application Form Modal Functions
function openApplicationForm() {
    const modal = document.getElementById('applicationFormModal');
    if (modal) {
        modal.style.display = 'block';
        // Clear form
        const form = document.getElementById('applicationForm');
        if (form) {
            form.reset();
        }
        // Clear photo preview
        const photoPreview = document.getElementById('photoPreview');
        const photoPreviewImg = document.getElementById('photoPreviewImg');
        if (photoPreview) {
            photoPreview.style.display = 'none';
        }
        if (photoPreviewImg) {
            photoPreviewImg.src = '';
        }
        // Set max date to today for birthdate
        const birthdateInput = document.getElementById('appBirthdate');
        if (birthdateInput) {
            birthdateInput.max = new Date().toISOString().split('T')[0];
        }
        // Reset municipality dropdown
        const municipalitySelect = document.getElementById('appMunicipality');
        const municipalityOtherInput = document.getElementById('appMunicipalityOther');
        const provinceOtherInput = document.getElementById('appProvinceOther');
        
        if (municipalitySelect) {
            municipalitySelect.innerHTML = '<option value="">Select Municipality</option>';
            municipalitySelect.disabled = true;
        }
        if (municipalityOtherInput) {
            municipalityOtherInput.style.display = 'none';
            municipalityOtherInput.value = '';
            municipalityOtherInput.required = false;
        }
        if (provinceOtherInput) {
            provinceOtherInput.style.display = 'none';
            provinceOtherInput.value = '';
            provinceOtherInput.required = false;
        }
    }
}

// Photo preview function
function previewPhoto(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('photoPreviewImg');
    
    if (file && preview && previewImg) {
        // Validate file type
        if (!file.type.match('image.*')) {
            showToast('Please select a valid image file', 'error');
            event.target.value = '';
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image size should be less than 5MB', 'error');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function closeApplicationForm() {
    const modal = document.getElementById('applicationFormModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Update municipalities based on selected province
function updateMunicipalities() {
    const provinceSelect = document.getElementById('appProvince');
    const municipalitySelect = document.getElementById('appMunicipality');
    const provinceOtherInput = document.getElementById('appProvinceOther');
    const municipalityOtherInput = document.getElementById('appMunicipalityOther');
    
    if (!provinceSelect || !municipalitySelect) return;
    
    const selectedProvince = provinceSelect.value;
    municipalitySelect.innerHTML = '<option value="">Select Municipality</option>';
    
    // Show/hide province other input
    if (provinceOtherInput) {
        if (selectedProvince === 'Other') {
            provinceOtherInput.style.display = 'block';
            provinceOtherInput.required = true;
        } else {
            provinceOtherInput.style.display = 'none';
            provinceOtherInput.required = false;
            provinceOtherInput.value = '';
        }
    }
    
    // Hide municipality other input initially
    if (municipalityOtherInput) {
        municipalityOtherInput.style.display = 'none';
        municipalityOtherInput.required = false;
        municipalityOtherInput.value = '';
    }
    
    const municipalities = {
        'Surigao del Sur': [
            'Tandag City', 'Bislig City', 'Cantilan', 'Carmen', 'Carrascal', 'Cortes', 
            'Hinatuan', 'Lanuza', 'Lianga', 'Lingig', 'Madrid', 'Marihatag', 'San Agustin', 
            'San Miguel', 'Tagbina', 'Tago', 'Bayabas', 'Cagwait', 'Luna', 'San Mateo'
        ],
        'Surigao del Norte': [
            'Surigao City', 'Dapa', 'General Luna', 'Pilar', 'San Isidro', 'Santa Monica', 
            'Sison', 'Socorro', 'Tagana-an', 'Tubod', 'Alegria', 'Bacuag', 'Burgos', 
            'Claver', 'Gigaquit', 'Mainit', 'Malimono', 'San Benito', 'San Francisco', 'Placer'
        ],
        'Agusan del Sur': [
            'Bayugan City', 'Bunawan', 'Esperanza', 'La Paz', 'Loreto', 'Prosperidad', 
            'Rosario', 'San Francisco', 'San Luis', 'Santa Josefa', 'Sibagat', 'Talacogon', 
            'Trento', 'Veruela', 'Las Nieves'
        ],
        'Agusan del Norte': [
            'Butuan City', 'Cabadbaran City', 'Buenavista', 'Carmen', 'Jabonga', 'Kitcharao', 
            'Las Nieves', 'Magallanes', 'Nasipit', 'Remedios T. Romualdez', 'Santiago', 
            'Tubay'
        ],
        'Dinagat Islands': [
            'Basilisa', 'Cagdianao', 'Dinagat', 'Libjo', 'Loreto', 'San Jose', 'Tubajon'
        ]
    };
    
    if (selectedProvince === 'Other') {
        municipalitySelect.innerHTML = '<option value="Other">Other</option>';
        municipalitySelect.disabled = false;
        checkMunicipalityOther();
    } else if (municipalities[selectedProvince]) {
        municipalities[selectedProvince].forEach(municipality => {
            const option = document.createElement('option');
            option.value = municipality;
            option.textContent = municipality;
            municipalitySelect.appendChild(option);
        });
        const otherOption = document.createElement('option');
        otherOption.value = 'Other';
        otherOption.textContent = 'Other';
        municipalitySelect.appendChild(otherOption);
        municipalitySelect.disabled = false;
    } else if (selectedProvince === '') {
        municipalitySelect.disabled = true;
    } else {
        municipalitySelect.innerHTML = '<option value="Other">Other</option>';
        municipalitySelect.disabled = false;
        checkMunicipalityOther();
    }
}

// Check if municipality "Other" is selected and show input field
function checkMunicipalityOther() {
    const municipalitySelect = document.getElementById('appMunicipality');
    const municipalityOtherInput = document.getElementById('appMunicipalityOther');
    
    if (!municipalitySelect || !municipalityOtherInput) return;
    
    if (municipalitySelect.value === 'Other') {
        municipalityOtherInput.style.display = 'block';
        municipalityOtherInput.required = true;
    } else {
        municipalityOtherInput.style.display = 'none';
        municipalityOtherInput.required = false;
        municipalityOtherInput.value = '';
    }
}

// Auto-update income range based on monthly income
function updateIncomeRange(event) {
    const incomeInput = event.target;
    const incomeValue = parseFloat(incomeInput.value) || 0;
    const incomeRangeSelect = document.getElementById('appIncomeRange');
    
    if (!incomeRangeSelect) return;
    
    let selectedRange = '';
    if (incomeValue < 10000) {
        selectedRange = 'Below 10,000';
    } else if (incomeValue <= 20000) {
        selectedRange = '10,000 - 20,000';
    } else if (incomeValue <= 30000) {
        selectedRange = '20,000 - 30,000';
    } else if (incomeValue <= 50000) {
        selectedRange = '30,000 - 50,000';
    } else if (incomeValue <= 75000) {
        selectedRange = '50,000 - 75,000';
    } else if (incomeValue <= 100000) {
        selectedRange = '75,000 - 100,000';
    } else {
        selectedRange = 'Above 100,000';
    }
    
    incomeRangeSelect.value = selectedRange;
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('applicationFormModal');
    if (event.target === modal) {
        closeApplicationForm();
    }
});

async function handleApplicationSubmission(event) {
    event.preventDefault();
    
    try {
        // Get province and municipality values (check if "Other" was selected)
        const provinceSelect = document.getElementById('appProvince').value;
        const municipalitySelect = document.getElementById('appMunicipality').value;
        const provinceValue = provinceSelect === 'Other' 
            ? document.getElementById('appProvinceOther').value.trim()
            : provinceSelect;
        const municipalityValue = municipalitySelect === 'Other'
            ? document.getElementById('appMunicipalityOther').value.trim()
            : municipalitySelect;

        // Get form values
        const studentId = document.getElementById('appStudentId').value.trim();
        const lastName = document.getElementById('appLastName').value.trim();
        const givenName = document.getElementById('appGivenName').value.trim();
        const extName = document.getElementById('appExtName').value.trim();
        const sex = document.getElementById('appSex').value;
        const birthdate = document.getElementById('appBirthdate').value;
        const programName = document.getElementById('appProgramName').value;
        const yearLevel = document.getElementById('appYearLevel').value;
        const fatherName = document.getElementById('appFatherName').value.trim();
        const motherName = document.getElementById('appMotherName').value.trim();
        const familyMonthlyIncome = parseFloat(document.getElementById('appFamilyIncome').value) || 0;
        const incomeRange = document.getElementById('appIncomeRange').value;
        const streetBarangay = document.getElementById('appStreetBarangay').value.trim();
        const zipCode = document.getElementById('appZipCode').value.trim();
        const contactNumber = document.getElementById('appContactNumber').value.trim();
        const email = document.getElementById('appEmail').value.trim();
        const password = document.getElementById('appPassword').value.trim() || null;
        const isPwd = document.getElementById('appPwd').checked;
        const isIndigenous = document.getElementById('appIndigenous').checked;
        const photoFile = document.getElementById('appPhoto').files[0];

        // Validate required fields
        if (!studentId || !lastName || !givenName || 
            !sex || !birthdate || !programName || 
            !yearLevel || !fatherName || !motherName ||
            !familyMonthlyIncome || familyMonthlyIncome < 0 ||
            !provinceValue || !municipalityValue || !streetBarangay || 
            !zipCode || !contactNumber || !email || !photoFile) {
            showToast('Please fill in all required fields including the 2x2 ID photo', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }

        // Validate photo file
        if (photoFile) {
            if (!photoFile.type.match('image.*')) {
                showToast('Please select a valid image file for your photo', 'error');
                return;
            }
            if (photoFile.size > 5 * 1024 * 1024) {
                showToast('Photo size should be less than 5MB', 'error');
                return;
            }
        }

        // Check if student already has a submitted application
        try {
            // Check in database first
            if (typeof apiCall === 'function') {
                try {
                    const existingAppsResponse = await apiCall('get_applications.php');
                    if (existingAppsResponse && existingAppsResponse.success && Array.isArray(existingAppsResponse.applications)) {
                        const emailLower = email.toLowerCase().trim();
                        const studentIdTrim = studentId.trim();
                        
                        const existingApp = existingAppsResponse.applications.find(app => {
                            const appEmail = (app.email || '').toLowerCase().trim();
                            const appStudentId = (app.studentId || app.student_id || '').trim();
                            return (emailLower && appEmail === emailLower) || 
                                   (studentIdTrim && appStudentId === studentIdTrim);
                        });
                        
                        if (existingApp) {
                            showToast('You have already submitted an application. Only one application per student is allowed.', 'error');
                            return;
                        }
                    }
                } catch (dbCheckError) {
                    console.log('Could not check database, checking localStorage:', dbCheckError);
                }
            }
            
            // Check in localStorage as fallback
            const storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
            const localStorageApps = JSON.parse(localStorage.getItem('applications') || '[]');
            const allStoredApps = [...storedApps, ...localStorageApps];
            
            if (allStoredApps.length > 0) {
                const emailLower = email.toLowerCase().trim();
                const studentIdTrim = studentId.trim();
                
                const existingApp = allStoredApps.find(app => {
                    const appEmail = (app.email || '').toLowerCase().trim();
                    const appStudentId = (app.studentId || app.student_id || '').trim();
                    return (emailLower && appEmail === emailLower) || 
                           (studentIdTrim && appStudentId === studentIdTrim);
                });
                
                if (existingApp) {
                    showToast('You have already submitted an application. Only one application per student is allowed.', 'error');
                    return;
                }
            }
        } catch (checkError) {
            console.log('Error checking for existing application:', checkError);
            // Continue with submission if check fails (to avoid blocking legitimate submissions)
        }

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('studentId', studentId);
        formData.append('lastName', lastName);
        formData.append('givenName', givenName);
        formData.append('extName', extName);
        formData.append('sex', sex);
        formData.append('birthdate', birthdate);
        formData.append('programName', programName);
        formData.append('yearLevel', yearLevel);
        formData.append('fatherName', fatherName);
        formData.append('motherName', motherName);
        formData.append('familyMonthlyIncome', familyMonthlyIncome);
        formData.append('incomeRange', incomeRange);
        formData.append('province', provinceValue);
        formData.append('municipality', municipalityValue);
        formData.append('streetBarangay', streetBarangay);
        formData.append('zipCode', zipCode);
        formData.append('contactNumber', contactNumber);
        formData.append('email', email);
        if (password) {
            formData.append('password', password);
        }
        formData.append('isPwd', isPwd ? '1' : '0');
        formData.append('isIndigenous', isIndigenous ? '1' : '0');
        formData.append('submittedAt', new Date().toISOString());
        if (photoFile) {
            formData.append('photo', photoFile);
        }

        // Try to save to database via API if available
        try {
            const apiBaseUrl = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost/grantes/api/';
            const response = await fetch(apiBaseUrl + 'save_application.php', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                if (result && result.success) {
                    showToast('Application submitted successfully! We will review your application soon.', 'success');
                    closeApplicationForm();
                    return;
                } else {
                    throw new Error(result.message || 'Failed to save application');
                }
            } else {
                throw new Error('Server error: ' + response.status);
            }
        } catch (apiError) {
            console.log('API not available, saving to localStorage:', apiError);
            
            // Fallback: Save to localStorage (convert photo to base64)
            const photoDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(photoFile);
            });

            const formDataObj = {
                studentId, lastName, givenName, extName, sex, birthdate,
                programName, yearLevel, fatherName, motherName,
                familyMonthlyIncome, incomeRange, province: provinceValue,
                municipality: municipalityValue, streetBarangay, zipCode,
                contactNumber, email, password, isPwd, isIndigenous,
                submittedAt: new Date().toISOString(),
                photo: photoDataUrl,
                id: Date.now(),
                status: 'pending'
            };

        let applications = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
            applications.push(formDataObj);
        localStorage.setItem('grantesApplications', JSON.stringify(applications));

        showToast('Application submitted successfully! We will review your application soon.', 'success');
        closeApplicationForm();
        }

    } catch (error) {
        console.error('Error submitting application:', error);
        showToast('Failed to submit application. Please try again.', 'error');
    }
}

// Student Registration Modal Functions
function openStudentRegistrationModal() {
    document.getElementById('studentRegistrationModal').style.display = 'block';
    // Clear form
    document.getElementById('studentRegistrationForm').reset();
}

function closeStudentRegistrationModal() {
    document.getElementById('studentRegistrationModal').style.display = 'none';
}

async function handleStudentRegistration(event) {
    console.log('🔥🔥🔥 handleStudentRegistration called from script.js! 🔥🔥🔥');
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    console.log('Getting form values...');
    const firstName = (document.getElementById('adminFirstName').value || '').trim();
    const lastName = (document.getElementById('adminLastName').value || '').trim();
    const studentId = (document.getElementById('adminStudentIdInput').value || '').trim();
    const email = (document.getElementById('adminEmail').value || '').trim();
    const awardNumber = (document.getElementById('adminAwardNumber').value || '').trim();
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const course = (document.getElementById('adminCourse').value || '').trim();
    const place = (document.getElementById('adminPlace') && document.getElementById('adminPlace').value || '').trim();
    const department = (document.getElementById('adminDepartment') && document.getElementById('adminDepartment').value || '').trim();
    const year = (document.getElementById('adminYear').value || '').trim();
    const photoFile = document.getElementById('adminPhoto') ? document.getElementById('adminPhoto').files[0] : null;
    const isIndigenous = document.getElementById('adminIsIndigenous') ? document.getElementById('adminIsIndigenous').checked : false;
    const isPwd = document.getElementById('adminIsPwd') ? document.getElementById('adminIsPwd').checked : false;
    
    console.log('Form values:', { firstName, lastName, studentId, email, awardNumber, department, place, course, year });
    
    // Basic required validation
    if (!firstName || !lastName || !studentId || !email || !awardNumber || !department || !place || !course || !year) {
        console.log('❌ Validation failed: Missing required fields');
        showToast('Please complete all required fields', 'error');
        return;
    }
    // Validate passwords match
    if (password !== confirmPassword) {
        console.log('❌ Validation failed: Passwords do not match');
        showToast('Passwords do not match!', 'error');
        return;
    }
    
    console.log('✅ Validation passed, proceeding with registration...');
    
    // Load latest students data from localStorage
    const savedStudents = localStorage.getItem('students');
    if (savedStudents) {
        students = JSON.parse(savedStudents);
    }

    // Uniqueness validation (field-specific, ignore empty existing fields)
    const norm = (v) => (v || '').trim().toLowerCase();
    const existsStudentId = students.some(s => (s.studentId && norm(s.studentId) === norm(studentId)));
    const existsEmail = students.some(s => (s.email && norm(s.email) === norm(email)));
    const existsAward = students.some(s => (s.awardNumber && norm(s.awardNumber) === norm(awardNumber)));
    if (existsStudentId || existsEmail || existsAward) {
        let msg = 'Duplicate found:';
        const parts = [];
        if (existsStudentId) parts.push('Student ID');
        if (existsEmail) parts.push('Email');
        if (existsAward) parts.push('Award Number');
        showToast(`${msg} ${parts.join(', ')} already exists`, 'error');
        return;
    }
    
    // Helper to finalize save after optional image processing
    const finalizeSave = async (idPictureDataUrl) => {
        try {
            console.log('Starting registration with data:', {
                firstName, lastName, studentId, email, password, 
                department, course, year, awardNumber, place
            });
            
            // Call the API to save to database
            const response = await apiCall('register.php', 'POST', {
                firstName: firstName,
                lastName: lastName,
                studentId: studentId,
                email: email,
                password: password,
                department: department,
                course: course,
                year: year,
                awardNumber: awardNumber,
                place: place,
                isIndigenous: isIndigenous,
                isPwd: isPwd
            });
            
            console.log('API Response:', response);
            
            if (!response || !response.success) {
                console.error('Registration failed:', response);
                showToast(response.message || 'Failed to register student in database', 'error');
                return;
            }
            
            // Also save to localStorage for backward compatibility
            const newStudent = {
                id: response.id || (students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1),
                firstName: firstName,
                lastName: lastName,
                studentId: studentId,
                email: email,
                awardNumber: awardNumber,
                password: password,
                department: department,
                place: place,
                course: course,
                year: year,
                status: 'active',
                applicationStatus: 'none',
                registered: new Date().toISOString(),
                role: 'student',
                idPictureDataUrl: idPictureDataUrl || null,
                isIndigenous: isIndigenous,
                isPwd: isPwd
            };
            
            students.push(newStudent);
            localStorage.setItem('students', JSON.stringify(students));
            
            closeStudentRegistrationModal();
            showToast('Student registered successfully!', 'success');
            // Refresh admin stats
            await updateAdminStats();
            // Reload students list
            await loadStudents();
        } catch (error) {
            console.error('Error registering student:', error);
            showToast('Failed to register student: ' + error.message, 'error');
        }
    };
    
    if (photoFile) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            await finalizeSave(e.target.result);
        };
        reader.readAsDataURL(photoFile);
    } else {
        finalizeSave(null).catch(error => {
            console.error('Error in finalizeSave:', error);
            showToast('Failed to register student', 'error');
        });
    }
}
// Bulk Registration Modal Functions
function openBulkRegistrationModal() {
    document.getElementById('bulkRegistrationModal').style.display = 'block';
    // Reset to step 1
    document.getElementById('bulkStep1').classList.add('active');
    document.getElementById('bulkStep2').classList.remove('active');
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('processFileBtn').disabled = true;
}

function closeBulkRegistrationModal() {
    document.getElementById('bulkRegistrationModal').style.display = 'none';
}

// Admin Tab Navigation
function showAdminTab(tabName) {
    // Scope to admin dashboard only
    const adminSection = document.getElementById('admin-dashboard');
    const homepageContent = document.getElementById('admin-homepage');
    const tabContent = adminSection ? adminSection.querySelector('.tab-content') : null;
    const navTabs = adminSection ? adminSection.querySelector('.admin-nav-tabs') : null;
    
    if (!adminSection || !homepageContent || !tabContent || !navTabs) {
        console.error('Missing required elements for tab switching');
        return;
    }
    
    if (tabName === 'homepage') {
        homepageContent.style.display = 'block';
        tabContent.style.display = 'none';
        navTabs.style.display = 'none';
        // Refresh stats when returning to homepage
        updateAdminStats();
        return;
    }
    
    // Show tab content within admin section
    homepageContent.style.display = 'none';
    tabContent.style.display = 'block';
    tabContent.style.visibility = 'visible';
    navTabs.style.display = 'flex';
    navTabs.style.visibility = 'visible';
    navTabs.style.opacity = '1';
    
    // Make sure all tab buttons are visible
    navTabs.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.style.display = 'inline-block';
        btn.style.visibility = 'visible';
        btn.style.opacity = '1';
    });
    
    // Hide all admin tab panels and deactivate tab buttons
    adminSection.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
        // Special handling for applications tab to ensure it's hidden
        if (panel.id === 'applications-tab') {
            panel.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
            panel.setAttribute('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important;');
        } else {
            panel.style.display = 'none';
            panel.style.visibility = 'hidden';
        }
    });
    adminSection.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activate selected tab panel
    const targetPanel = document.getElementById(`${tabName}-tab`);
    if (targetPanel) {
        targetPanel.classList.add('active');
        
        // Special handling only for applications tab (due to CSS conflicts)
        if (tabName === 'applications') {
            // Use setAttribute to force with !important - multiple ways to ensure visibility
            targetPanel.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;';
            targetPanel.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;');
        } else {
            // Normal behavior for other tabs
            // Also ensure applications tab is hidden when switching to other tabs
            const applicationsPanel = document.getElementById('applications-tab');
            if (applicationsPanel) {
                applicationsPanel.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                applicationsPanel.setAttribute('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important;');
                applicationsPanel.classList.remove('active');
            }
            targetPanel.style.display = 'block';
        }
        targetPanel.style.visibility = 'visible';
        targetPanel.style.opacity = '1';
        console.log('Tab panel activated:', tabName);
        
        // Use MutationObserver to prevent the tab from being hidden (only for applications tab when it's active)
        if (tabName === 'applications' && !targetPanel._visibilityProtection) {
            targetPanel._visibilityProtection = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    // Only prevent hiding if the tab is still active
                    if (targetPanel.classList.contains('active')) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                            const currentStyle = targetPanel.getAttribute('style') || '';
                            if (currentStyle.includes('display: none') || currentStyle.includes('display:none')) {
                                targetPanel.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
                            }
                        }
                    }
                });
            });
            targetPanel._visibilityProtection.observe(targetPanel, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        } else if (tabName !== 'applications') {
            // Stop the observer and ensure applications tab is hidden when switching to other tabs
            const applicationsPanel = document.getElementById('applications-tab');
            if (applicationsPanel) {
                // Disconnect observer if it exists
                if (applicationsPanel._visibilityProtection) {
                    applicationsPanel._visibilityProtection.disconnect();
                    applicationsPanel._visibilityProtection = null;
                }
                // Force hide the applications panel
                applicationsPanel.classList.remove('active');
                applicationsPanel.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
                applicationsPanel.setAttribute('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important;');
            }
        }
    } else {
        console.error(`Tab panel with id "${tabName}-tab" not found!`);
        return;
    }
    
    // Mark clicked button active - find by text content or onclick attribute
    adminSection.querySelectorAll('.nav-tab-btn').forEach(btn => {
        const btnText = btn.textContent.trim().toLowerCase();
        const onclickAttr = btn.getAttribute('onclick') || '';
        if (btnText === tabName.toLowerCase() || onclickAttr.includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });
    
    // Load content
    switch(tabName) {
        case 'applications':
            // Load immediately
            loadApplicationsTab();
            // Continuously check and enforce visibility (stop after 1 second)
            // Only check if applications tab is still active
            let checkCount = 0;
            const maxChecks = 10;
            const visibilityCheck = setInterval(() => {
                checkCount++;
                const panel = document.getElementById('applications-tab');
                const content = document.querySelector('.tab-content');
                
                // Only enforce visibility if the panel still has the active class
                if (panel && panel.classList.contains('active')) {
                    // Check if it's hidden and force it visible
                    const computedStyle = window.getComputedStyle(panel);
                    if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                        panel.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
                        panel.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
                    }
                } else {
                    // Panel is no longer active, stop checking
                    clearInterval(visibilityCheck);
                }
                
                if (content) {
                    const contentStyle = window.getComputedStyle(content);
                    if (contentStyle.display === 'none') {
                        content.style.display = 'block';
                        content.style.visibility = 'visible';
                    }
                }
                
                if (checkCount >= maxChecks) {
                    clearInterval(visibilityCheck);
                }
            }, 100);
            break;
        case 'students':
            loadStudents();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Store applications data for filtering
let allApplicationsData = [];

// Load Applications Tab (simplified - shows only name and monthly income)
async function loadApplicationsTab() {
    // First, ensure the tab panel is visible with multiple methods
    const applicationsTabPanel = document.getElementById('applications-tab');
    if (applicationsTabPanel) {
        applicationsTabPanel.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;';
        applicationsTabPanel.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;');
        applicationsTabPanel.style.display = 'block';
        applicationsTabPanel.style.visibility = 'visible';
    }
    
    const container = document.getElementById('applicationsContainer');
    if (!container) {
        console.error('applicationsContainer not found!');
        // Still show the panel even if container is missing
        if (applicationsTabPanel) {
            applicationsTabPanel.innerHTML = '<div class="applications-list"><h3>Student Applications</h3><p class="no-data">Container not found. Please refresh the page.</p></div>';
        }
        return;
    }
    
    try {
        let storedApps = [];
        
        // Try to load from database first
        if (typeof apiCall === 'function') {
            try {
                const response = await apiCall('get_applications.php');
                if (response && response.success && Array.isArray(response.applications)) {
                    storedApps = response.applications;
                    console.log('Loaded applications from database:', storedApps.length);
                }
            } catch (dbError) {
                console.log('Database load failed, trying localStorage:', dbError);
            }
        }
        
        // If database didn't return data, try localStorage as fallback
        if (!storedApps || storedApps.length === 0) {
            storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
            if (!storedApps || storedApps.length === 0) {
                storedApps = JSON.parse(localStorage.getItem('applications') || '[]');
            }
        }
        
        // Store all applications for filtering
        allApplicationsData = storedApps;
        
        // Ensure students list is loaded before rendering (for status checks)
        if (!students || students.length === 0) {
            try {
                const studentsResponse = await getStudentsFromDatabase();
                if (studentsResponse && Array.isArray(studentsResponse)) {
                    students = studentsResponse;
                    localStorage.setItem('students', JSON.stringify(students));
                }
            } catch (error) {
                console.log('Could not load students for status check:', error);
            }
        }
        
        if (!storedApps || storedApps.length === 0) {
            container.innerHTML = '<p class="no-data" style="padding: 2rem; text-align: center; color: #64748b;">No applications found.</p>';
            // Ensure panel is still visible
            if (applicationsTabPanel) {
                applicationsTabPanel.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
            }
            return;
        }
        
        // Render applications (will use search filter if active)
        await renderApplicationsTable(storedApps);
        
        // Ensure panel stays visible after content loads - use multiple methods
        if (applicationsTabPanel) {
            applicationsTabPanel.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;';
            applicationsTabPanel.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important;');
            applicationsTabPanel.style.display = 'block';
            applicationsTabPanel.style.visibility = 'visible';
        }
        
        // Also ensure the parent tab-content is visible
        const tabContent = document.querySelector('.tab-content');
        if (tabContent) {
            tabContent.style.cssText = 'display: block !important; visibility: visible !important;';
            tabContent.style.display = 'block';
            tabContent.style.visibility = 'visible';
        }
        
        // Final check - force visibility one more time after a tiny delay
        setTimeout(() => {
            if (applicationsTabPanel) {
                const computed = window.getComputedStyle(applicationsTabPanel);
                if (computed.display === 'none') {
                    applicationsTabPanel.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
                }
            }
        }, 10);
    } catch (error) {
        console.error('Error loading applications:', error);
        container.innerHTML = '<p class="no-data">Error loading applications. Please refresh the page.</p>';
        // Ensure panel is still visible even on error
        if (applicationsTabPanel) {
            applicationsTabPanel.style.display = 'block';
        }
    }
}

// Render applications table with optional filtering
async function renderApplicationsTable(appsToRender) {
    const container = document.getElementById('applicationsContainer');
    if (!container) return;
    
    if (!appsToRender || appsToRender.length === 0) {
        container.innerHTML = '<p class="no-data" style="padding: 2rem; text-align: center; color: #64748b;">No applications found.</p>';
        return;
    }
    
    // Sort by submission date (newest first)
    const sortedApps = [...appsToRender].sort((a, b) => {
        const dateA = new Date(a.submittedAt || a.id || 0);
        const dateB = new Date(b.submittedAt || b.id || 0);
        return dateB - dateA;
    });
    
    // Ensure students list is loaded for checking registration status
    if (!students || students.length === 0) {
        try {
            const studentsResponse = await getStudentsFromDatabase();
            if (studentsResponse && Array.isArray(studentsResponse)) {
                students = studentsResponse;
            }
        } catch (error) {
            console.log('Could not load students for status check:', error);
        }
    }
    
    // Create table structure with better visibility
    const applicationsHTML = `
        <div style="overflow-x: auto;">
            <table class="applications-table" style="width: 100%; border-collapse: collapse; margin-top: 1rem; background: white; min-width: 500px;">
                <thead>
                    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #1e293b; font-size: 14px;">Student Name</th>
                        <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #1e293b; font-size: 14px;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedApps.map(app => {
                        const fullName = `${app.givenName || ''} ${app.lastName || ''} ${app.extName || ''}`.trim() || 'No Name';
                        const appId = app.id || app.application_id || Date.now();
                        
                        // Check if student is already registered (by email or student ID)
                        const appEmail = (app.email || '').toLowerCase().trim();
                        const appStudentId = (app.studentId || app.student_id || '').trim();
                        
                        const isRegistered = students.some(s => {
                            const studentEmail = (s.email || '').toLowerCase().trim();
                            const studentId = (s.studentId || s.student_id || '').trim();
                            return (appEmail && studentEmail === appEmail) || 
                                   (appStudentId && studentId === appStudentId);
                        });
                        
                        const approvalButton = isRegistered 
                            ? `<span style="padding: 8px 20px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; min-width: 100px; display: inline-block; text-align: center; cursor: default;">
                                    Approved
                               </span>`
                            : `<button onclick="openApplicationApprovalForm(${appId})" style="padding: 8px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; min-width: 100px;">
                                    Approval
                               </button>`;
                        
                        return `
                            <tr style="border-bottom: 1px solid #e2e8f0; background: white;">
                                <td style="padding: 12px 16px; color: #334155; font-size: 14px;">${fullName}</td>
                                <td style="padding: 12px 16px; text-align: center;">
                                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                                        ${approvalButton}
                                        <button onclick="deleteApplication(${appId}, '${fullName.replace(/'/g, "\\'")}')" style="padding: 8px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; min-width: 80px;">
                                            Delete
                                    </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div style="padding: 1rem; text-align: center; color: #64748b; font-size: 14px;">
                Showing ${sortedApps.length} of ${allApplicationsData.length} application(s)
            </div>
        </div>
    `;
    
    container.innerHTML = applicationsHTML;
    container.style.display = 'block';
    container.style.visibility = 'visible';
}

// Search applications table
async function searchApplicationsTable() {
    const searchInput = document.getElementById('searchApplications');
    const searchTerm = (searchInput ? searchInput.value.trim().toLowerCase() : '');
    
    if (!searchTerm) {
        // If search is empty, show all applications
        await renderApplicationsTable(allApplicationsData);
        return;
    }
    
    // Filter applications based on search term
    const filteredApps = allApplicationsData.filter(app => {
        const fullName = `${app.givenName || ''} ${app.lastName || ''} ${app.extName || ''}`.trim().toLowerCase();
        const studentId = (app.studentId || '').toLowerCase();
        const email = (app.email || '').toLowerCase();
        
        // Search in name, student ID, or email
        return fullName.includes(searchTerm) || 
               studentId.includes(searchTerm) || 
               email.includes(searchTerm);
    });
    
    await renderApplicationsTable(filteredApps);
}

// Clear applications search
async function clearApplicationsSearch() {
    const searchInput = document.getElementById('searchApplications');
    if (searchInput) {
        searchInput.value = '';
    }
    await renderApplicationsTable(allApplicationsData);
}

// Generate Applications Excel Report
function generateApplicationsExcel() {
    try {
        if (!allApplicationsData || allApplicationsData.length === 0) {
            showToast('No applications data to export', 'error');
            return;
        }
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare data for Excel
        const excelData = allApplicationsData.map((app, index) => {
            const fullName = `${app.givenName || ''} ${app.lastName || ''} ${app.extName || ''}`.trim() || 'N/A';
            const submittedDate = app.submittedAt || app.created_at || app.submitted_at || 'N/A';
            const formattedDate = submittedDate !== 'N/A' 
                ? new Date(submittedDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'N/A';
            
            return {
                'No.': index + 1,
                'Student ID': app.studentId || app.student_id || 'N/A',
                'Full Name': fullName,
                'Email': app.email || 'N/A',
                'Contact Number': app.contactNumber || app.contact_number || 'N/A',
                'Program': app.programName || app.program_name || 'N/A',
                'Year Level': app.yearLevel || app.year_level || 'N/A',
                'Province': app.province || 'N/A',
                'Municipality': app.municipality || 'N/A',
                'Street & Barangay': app.streetBarangay || app.street_barangay || 'N/A',
                'Zip Code': app.zipCode || app.zip_code || 'N/A',
                'Family Monthly Income': app.familyMonthlyIncome || app.family_monthly_income || 'N/A',
                'Income Range': app.incomeRange || app.income_range || 'N/A',
                'Father\'s Name': app.fatherName || app.father_name || 'N/A',
                'Mother\'s Name': app.motherName || app.mother_name || 'N/A',
                'Sex': app.sex || 'N/A',
                'Birthdate': app.birthdate || 'N/A',
                'Indigenous People': (app.isIndigenous || app.is_indigenous) ? 'Yes' : 'No',
                'PWD': (app.isPwd || app.is_pwd) ? 'Yes' : 'No',
                'Status': app.status || 'pending',
                'Submitted Date': formattedDate
            };
        });
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 5 },   // No.
            { wch: 12 },  // Student ID
            { wch: 25 },  // Full Name
            { wch: 25 },  // Email
            { wch: 15 },  // Contact Number
            { wch: 40 },  // Program
            { wch: 10 },  // Year Level
            { wch: 20 },  // Province
            { wch: 20 },  // Municipality
            { wch: 25 },  // Street & Barangay
            { wch: 8 },   // Zip Code
            { wch: 18 },  // Family Monthly Income
            { wch: 18 },  // Income Range
            { wch: 20 },  // Father's Name
            { wch: 20 },  // Mother's Name
            { wch: 8 },   // Sex
            { wch: 12 },  // Birthdate
            { wch: 15 },  // Indigenous People
            { wch: 8 },   // PWD
            { wch: 12 },  // Status
            { wch: 20 }   // Submitted Date
        ];
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Applications');
        
        // Generate filename with current date
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const fileName = `applications_report_${dateStr}.xlsx`;
        
        // Write file
        XLSX.writeFile(wb, fileName);
        
        showToast('Applications Excel report generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating applications Excel:', error);
        showToast('Failed to generate Excel report: ' + error.message, 'error');
    }
}

// Store current application ID for approval
let currentApplicationIdForApproval = null;

// Open application approval form
async function openApplicationApprovalForm(appId) {
    currentApplicationIdForApproval = appId;
    
    // Find the application data
    const application = allApplicationsData.find(app => 
        app.id == appId || app.application_id == appId
    );
    
    if (!application) {
        showToast('Application not found', 'error');
        return;
    }
    
    // Award number field is empty - admin will enter it manually
    document.getElementById('approvalAwardNumber').value = '';
    
    // Display password from application (or show message if not provided)
    const password = application.password || null;
    document.getElementById('approvalPassword').value = password || 'Not provided (will be auto-generated)';
    
    document.getElementById('approvalEmail').value = application.email || 'N/A';
    document.getElementById('approvalPhoneNumber').value = application.contactNumber || application.contact_number || 'N/A';
    
    // Show the modal
    document.getElementById('applicationApprovalModal').style.display = 'block';
    
    // Focus on award number field after modal appears
    setTimeout(() => {
        document.getElementById('approvalAwardNumber').focus();
    }, 100);
}

// Close application approval form
function closeApplicationApprovalForm() {
    document.getElementById('applicationApprovalModal').style.display = 'none';
    currentApplicationIdForApproval = null;
}

// Delete application
async function deleteApplication(appId, studentName) {
    if (!confirm(`Are you sure you want to delete the application for ${studentName}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        // Try to delete from database first if API is available
        if (typeof apiCall === 'function') {
            try {
                // Check if there's a delete API endpoint
                const response = await apiCall('delete_application.php', 'POST', { id: appId });
                if (response && response.success) {
                    showToast('Application deleted successfully', 'success');
                } else {
                    throw new Error(response?.message || 'Failed to delete from database');
                }
            } catch (dbError) {
                console.log('Database delete not available, deleting from localStorage:', dbError);
                // Continue with localStorage deletion
            }
        }
        
        // Remove from allApplicationsData array
        const appIndex = allApplicationsData.findIndex(app => 
            app.id == appId || app.application_id == appId
        );
        
        if (appIndex !== -1) {
            allApplicationsData.splice(appIndex, 1);
            
            // Update localStorage
            localStorage.setItem('grantesApplications', JSON.stringify(allApplicationsData));
            localStorage.setItem('applications', JSON.stringify(allApplicationsData));
            
            // Re-render the table
            renderApplicationsTable(allApplicationsData);
            
            showToast('Application deleted successfully', 'success');
        } else {
            showToast('Application not found', 'error');
        }
    } catch (error) {
        console.error('Error deleting application:', error);
        showToast('Failed to delete application: ' + error.message, 'error');
    }
}

// Register student account from application
async function registerStudentAccount() {
    if (!currentApplicationIdForApproval) {
        showToast('No application selected', 'error');
        return;
    }
    
    // Get award number from form
    const awardNumber = document.getElementById('approvalAwardNumber').value.trim();
    if (!awardNumber) {
        showToast('Please enter an award number first', 'error');
        document.getElementById('approvalAwardNumber').focus();
        return;
    }
    
    // Find the application data
    const application = allApplicationsData.find(app => 
        app.id == currentApplicationIdForApproval || app.application_id == currentApplicationIdForApproval
    );
    
    if (!application) {
        showToast('Application not found', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to register this student account? This will create a student record.')) {
        return;
    }
    
    try {
        // Use password from application if provided, otherwise generate temporary password
        const password = application.password || generateTemporaryPassword();
        
        // Prepare student registration data from application
        const studentData = {
            firstName: application.givenName || application.given_name || '',
            lastName: application.lastName || application.last_name || '',
            studentId: application.studentId || application.student_id || '',
            email: application.email || '',
            password: password, // Use provided password or generated temporary password
            department: application.programName || application.program_name || 'Not specified',
            course: application.programName || application.program_name || '',
            year: application.yearLevel || application.year_level || '',
            awardNumber: awardNumber,
            place: `${application.streetBarangay || ''}, ${application.municipality || ''}, ${application.province || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || 'Not specified',
            isIndigenous: application.isIndigenous || application.is_indigenous || false,
            isPwd: application.isPwd || application.is_pwd || false
        };
        
        // Validate required fields
        if (!studentData.firstName || !studentData.lastName || !studentData.studentId || !studentData.email) {
            showToast('Application is missing required information', 'error');
            return;
        }
        
        // Register student via API
        if (typeof apiCall === 'function') {
            try {
                const response = await apiCall('register.php', 'POST', studentData);
                if (response && response.success) {
                    // Refresh students list to update registration status
                    try {
                        const studentsResponse = await getStudentsFromDatabase();
                        if (studentsResponse && Array.isArray(studentsResponse)) {
                            students = studentsResponse;
                            localStorage.setItem('students', JSON.stringify(students));
                        }
                    } catch (error) {
                        console.log('Could not refresh students list:', error);
                    }
                    
                    const passwordMsg = application.password 
                        ? 'Password: ' + application.password 
                        : 'Temporary password: ' + studentData.password;
                    showToast('Student account registered successfully! ' + passwordMsg, 'success');
                    
                    // Optionally approve the application after registration
                    if (confirm('Student account registered. Would you like to approve this application as well?')) {
                        await approveApplication();
                    }
                    
                    // Reload applications table to show updated status
                    await loadApplicationsTab();
                    closeApplicationApprovalForm();
                    return;
                } else {
                    showToast(response?.message || 'Failed to register student account', 'error');
                }
            } catch (dbError) {
                console.log('Database registration failed:', dbError);
                showToast('Failed to register student account: ' + (dbError.message || 'Unknown error'), 'error');
            }
        } else {
            showToast('Registration API not available', 'error');
        }
    } catch (error) {
        console.error('Error registering student account:', error);
        showToast('Error registering student account: ' + error.message, 'error');
    }
}

// Generate temporary password
function generateTemporaryPassword() {
    // Generate a random 8-character password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Register student account and send credentials via email and SMS
async function registerAndSendCredentials() {
    if (!currentApplicationIdForApproval) {
        showToast('No application selected', 'error');
        return;
    }
    
    // Get award number from form
    const awardNumber = document.getElementById('approvalAwardNumber').value.trim();
    if (!awardNumber) {
        showToast('Please enter an award number', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to register this student account and send credentials? This will create a student record and notify the student via email and SMS.')) {
        return;
    }
    
    try {
        // Find the application data
        const application = allApplicationsData.find(app => 
            app.id == currentApplicationIdForApproval || app.application_id == currentApplicationIdForApproval
        );
        
        if (!application) {
            showToast('Application not found', 'error');
            return;
        }
        
        // Use password from application if provided, otherwise generate temporary password
        const password = application.password || generateTemporaryPassword();
        
        // Prepare student registration data
        const studentData = {
            firstName: application.givenName || application.given_name || '',
            lastName: application.lastName || application.last_name || '',
            studentId: application.studentId || application.student_id || '',
            email: application.email || '',
            password: password,
            department: application.programName || application.program_name || 'Not specified',
            course: application.programName || application.program_name || '',
            year: application.yearLevel || application.year_level || '',
            awardNumber: awardNumber,
            place: `${application.streetBarangay || ''}, ${application.municipality || ''}, ${application.province || ''}`.replace(/^,\s*|,\s*$/g, '').trim() || 'Not specified',
            isIndigenous: application.isIndigenous || application.is_indigenous || false,
            isPwd: application.isPwd || application.is_pwd || false
        };
        
        // Validate required fields
        if (!studentData.firstName || !studentData.lastName || !studentData.studentId || !studentData.email) {
            showToast('Application is missing required information', 'error');
            return;
        }
        
        // Step 1: Register student account
        let registrationSuccess = false;
        if (typeof apiCall === 'function') {
            try {
                const registerResponse = await apiCall('register.php', 'POST', studentData);
                if (registerResponse && registerResponse.success) {
                    registrationSuccess = true;
                } else {
                    showToast(registerResponse?.message || 'Failed to register student account', 'error');
                    return;
                }
            } catch (regError) {
                console.log('Registration failed:', regError);
                showToast('Failed to register student account: ' + (regError.message || 'Unknown error'), 'error');
                return;
            }
        } else {
            showToast('Registration API not available', 'error');
            return;
        }
        
        // Step 2: Send credentials via email and SMS
        if (typeof apiCall === 'function') {
            try {
                const sendResponse = await apiCall('send_credentials.php', 'POST', {
                    email: application.email,
                    phoneNumber: application.contactNumber || application.contact_number || '',
                    studentName: `${studentData.firstName} ${studentData.lastName}`.trim(),
                    awardNumber: awardNumber,
                    password: password,
                    studentId: studentData.studentId
                });
                
                if (sendResponse && sendResponse.success) {
                    let sendMsg = 'Credentials sent successfully.';
                    if (sendResponse.emailSent && sendResponse.smsSent) {
                        sendMsg = 'Email and SMS sent successfully.';
                    } else if (sendResponse.emailSent) {
                        sendMsg = 'Email sent successfully. SMS failed.';
                    } else if (sendResponse.smsSent) {
                        sendMsg = 'SMS sent successfully. Email failed.';
                    }
                    
                    // Step 3: Approve the application
                    await approveApplication();
                    
                    // Refresh students list to update registration status
                    try {
                        const studentsResponse = await getStudentsFromDatabase();
                        if (studentsResponse && Array.isArray(studentsResponse)) {
                            students = studentsResponse;
                            localStorage.setItem('students', JSON.stringify(students));
                        }
                    } catch (error) {
                        console.log('Could not refresh students list:', error);
                    }
                    
                    showToast('Student account registered and credentials sent! ' + sendMsg, 'success');
                    closeApplicationApprovalForm();
                    await loadApplicationsTab();
                    return;
                } else {
                    // Registration succeeded but sending failed - still approve
                    await approveApplication();
                    
                    // Refresh students list to update registration status
                    try {
                        const studentsResponse = await getStudentsFromDatabase();
                        if (studentsResponse && Array.isArray(studentsResponse)) {
                            students = studentsResponse;
                            localStorage.setItem('students', JSON.stringify(students));
                        }
                    } catch (error) {
                        console.log('Could not refresh students list:', error);
                    }
                    
                    showToast('Student account registered but failed to send credentials. ' + (sendResponse?.message || ''), 'warning');
                    closeApplicationApprovalForm();
                    await loadApplicationsTab();
                    return;
                }
            } catch (sendError) {
                console.log('Send credentials failed:', sendError);
                // Registration succeeded but sending failed - still approve
                await approveApplication();
                showToast('Student account registered but failed to send credentials. Please contact the student manually.', 'warning');
                closeApplicationApprovalForm();
                await loadApplicationsTab();
                return;
            }
        } else {
            // No API available - just register and approve
            await approveApplication();
            showToast('Student account registered. API not available for sending credentials.', 'warning');
            closeApplicationApprovalForm();
            await loadApplicationsTab();
            return;
        }
    } catch (error) {
        console.error('Error in registerAndSendCredentials:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

// Approve application
async function approveApplication() {
    if (!currentApplicationIdForApproval) {
        showToast('No application selected', 'error');
        return;
    }
    
    // Get award number from form
    const awardNumber = document.getElementById('approvalAwardNumber').value.trim();
    if (!awardNumber) {
        showToast('Please enter an award number', 'error');
        return;
    }
    
    try {
        // Find the application data
        const application = allApplicationsData.find(app => 
            app.id == currentApplicationIdForApproval || app.application_id == currentApplicationIdForApproval
        );
        
        if (!application) {
            showToast('Application not found', 'error');
            return;
        }
        
        // Try to update in database first
        if (typeof apiCall === 'function') {
            try {
                const response = await apiCall('update_application_status.php', 'POST', {
                    id: currentApplicationIdForApproval,
                    status: 'approved',
                    awardNumber: awardNumber
                });
                if (response && response.success) {
                    // Reload applications
                    await loadApplicationsTab();
                    return;
                }
            } catch (dbError) {
                console.log('Database update failed, updating localStorage:', dbError);
            }
        }
        
        // Fallback to localStorage
        let storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
        if (storedApps.length === 0) {
            storedApps = JSON.parse(localStorage.getItem('applications') || '[]');
        }
        
        const appIndex = storedApps.findIndex(a => a.id == currentApplicationIdForApproval || a.application_id == currentApplicationIdForApproval);
        if (appIndex === -1) {
            showToast('Application not found', 'error');
            return;
        }
        
        storedApps[appIndex].status = 'approved';
        storedApps[appIndex].awardNumber = awardNumber;
        localStorage.setItem('grantesApplications', JSON.stringify(storedApps));
        allApplicationsData = storedApps;
        
        // Reload the table
        renderApplicationsTable(allApplicationsData);
    } catch (error) {
        console.error('Error approving application:', error);
        showToast('Error approving application', 'error');
    }
}

// Load Applications Tab (detailed view - for other uses)
function loadApplications() {
    const container = document.getElementById('applicationsContainer');
    if (!container) return;
    
    try {
        // Load applications from localStorage
        const storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
        
        if (!storedApps || storedApps.length === 0) {
            container.innerHTML = '<p class="no-data">No applications found.</p>';
            return;
        }
        
        // Apply filters
        const statusFilter = document.getElementById('applicationStatusFilter')?.value || '';
        const searchTerm = (document.getElementById('searchApplications')?.value || '').trim().toLowerCase();
        
        let filteredApps = storedApps;
        
        if (statusFilter) {
            filteredApps = filteredApps.filter(app => (app.status || 'pending') === statusFilter);
        }
        
        if (searchTerm) {
            filteredApps = filteredApps.filter(app => {
                const fullName = `${app.givenName || ''} ${app.lastName || ''}`.toLowerCase();
                const studentId = (app.studentId || '').toLowerCase();
                const email = (app.email || '').toLowerCase();
                const program = (app.programName || '').toLowerCase();
                
                return fullName.includes(searchTerm) ||
                       studentId.includes(searchTerm) ||
                       email.includes(searchTerm) ||
                       program.includes(searchTerm);
            });
        }
        
        if (filteredApps.length === 0) {
            container.innerHTML = '<p class="no-data">No applications match your search criteria.</p>';
            return;
        }
        
        // Sort by submission date (newest first)
        filteredApps.sort((a, b) => {
            const dateA = new Date(a.submittedAt || a.id || 0);
            const dateB = new Date(b.submittedAt || b.id || 0);
            return dateB - dateA;
        });
        
        const applicationsHTML = filteredApps.map(app => {
            const status = app.status || 'pending';
            const fullName = `${app.givenName || ''} ${app.lastName || ''} ${app.extName || ''}`.trim();
            const submittedDate = app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A';
            
            return `
                <div class="application-item" data-app-id="${app.id}">
                    <div class="application-header">
                        <h4>${fullName || 'No Name'}</h4>
                        <span class="status-badge status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                    <div class="application-info">
                        <div class="info-item">
                            <span class="info-label">Student ID:</span>
                            <span class="info-value">${app.studentId || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Email:</span>
                            <span class="info-value">${app.email || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Program:</span>
                            <span class="info-value">${app.programName || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Year Level:</span>
                            <span class="info-value">${app.yearLevel || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Family Income:</span>
                            <span class="info-value">₱${(app.familyMonthlyIncome || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Submitted:</span>
                            <span class="info-value">${submittedDate}</span>
                        </div>
                    </div>
                    <div class="application-actions">
                        <button class="btn btn-secondary" onclick="viewApplicationDetails(${app.id})">View Details</button>
                        ${status === 'pending' ? `
                            <button class="btn btn-success" onclick="approveApplication(${app.id})">Approve</button>
                            <button class="btn btn-danger" onclick="rejectApplication(${app.id})">Reject</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = applicationsHTML;
    } catch (error) {
        console.error('Error loading applications:', error);
        container.innerHTML = '<p class="no-data">Error loading applications. Please refresh the page.</p>';
    }
}

// Filter Applications
function filterApplications() {
    loadApplications();
}

// Search Applications
function searchApplications() {
    loadApplications();
}

// View Application Details
function viewApplicationDetails(appId) {
    try {
        const storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
        const app = storedApps.find(a => a.id == appId);
        
        if (!app) {
            showToast('Application not found', 'error');
            return;
        }
        
        const fullName = `${app.givenName || ''} ${app.lastName || ''} ${app.extName || ''}`.trim();
        const details = `
            <strong>Full Name:</strong> ${fullName}<br>
            <strong>Student ID:</strong> ${app.studentId || 'N/A'}<br>
            <strong>Sex:</strong> ${app.sex || 'N/A'}<br>
            <strong>Birthdate:</strong> ${app.birthdate ? new Date(app.birthdate).toLocaleDateString() : 'N/A'}<br>
            <strong>Program:</strong> ${app.programName || 'N/A'}<br>
            <strong>Year Level:</strong> ${app.yearLevel || 'N/A'}<br>
            <strong>Father's Name:</strong> ${app.fatherName || 'N/A'}<br>
            <strong>Mother's Name:</strong> ${app.motherName || 'N/A'}<br>
            <strong>Family Monthly Income:</strong> ₱${(app.familyMonthlyIncome || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}<br>
            <strong>Income Range:</strong> ${app.incomeRange || 'N/A'}<br>
            <strong>Address:</strong> ${app.streetBarangay || 'N/A'}, ${app.municipality || 'N/A'}, ${app.province || 'N/A'}, ${app.zipCode || 'N/A'}<br>
            <strong>Contact Number:</strong> ${app.contactNumber || 'N/A'}<br>
            <strong>Email:</strong> ${app.email || 'N/A'}<br>
            <strong>PWD:</strong> ${app.isPwd ? 'Yes' : 'No'}<br>
            <strong>Indigenous People:</strong> ${app.isIndigenous ? 'Yes' : 'No'}<br>
            <strong>Status:</strong> ${(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}<br>
            <strong>Submitted:</strong> ${app.submittedAt ? new Date(app.submittedAt).toLocaleString() : 'N/A'}
        `;
        
        alert(details);
    } catch (error) {
        console.error('Error viewing application details:', error);
        showToast('Error loading application details', 'error');
    }
}

// Approve Application
function approveApplication(appId) {
    if (!confirm('Are you sure you want to approve this application?')) return;
    
    try {
        const storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
        const appIndex = storedApps.findIndex(a => a.id == appId);
        
        if (appIndex === -1) {
            showToast('Application not found', 'error');
            return;
        }
        
        storedApps[appIndex].status = 'approved';
        localStorage.setItem('grantesApplications', JSON.stringify(storedApps));
        showToast('Application approved successfully', 'success');
        loadApplications();
    } catch (error) {
        console.error('Error approving application:', error);
        showToast('Error approving application', 'error');
    }
}

// Reject Application
function rejectApplication(appId) {
    if (!confirm('Are you sure you want to reject this application?')) return;
    
    try {
        const storedApps = JSON.parse(localStorage.getItem('grantesApplications') || '[]');
        const appIndex = storedApps.findIndex(a => a.id == appId);
        
        if (appIndex === -1) {
            showToast('Application not found', 'error');
            return;
        }
        
        storedApps[appIndex].status = 'rejected';
        localStorage.setItem('grantesApplications', JSON.stringify(storedApps));
        showToast('Application rejected', 'success');
        loadApplications();
    } catch (error) {
        console.error('Error rejecting application:', error);
        showToast('Error rejecting application', 'error');
    }
}

// Load Students Tab
async function loadStudents() {
    const container = document.getElementById('studentsContainer');
    if (!container) {
        console.log('studentsContainer not found!');
        return;
    }
    
    try {
        // Load students from database
        const students = await getStudentsFromDatabase();
        if (!students || students.length === 0) {
            container.innerHTML = '<p class="no-data">No students found.</p>';
            await updateAdminStats(); // Refresh stats from database
            return;
        }
        
        // Filter by status
        const statusFilter = document.getElementById('studentStatusFilter').value;
        const searchTerm = (document.getElementById('searchStudentRecords').value || '').trim().toLowerCase();
        
        let filteredStudents = students;
        if (statusFilter) {
            filteredStudents = filteredStudents.filter(s => (s.status || 'active') === statusFilter);
        }
        if (searchTerm) {
            filteredStudents = filteredStudents.filter(s => 
                (s.firstName || '').toLowerCase().includes(searchTerm) ||
                (s.lastName || '').toLowerCase().includes(searchTerm) ||
                (s.studentId || '').toLowerCase().includes(searchTerm) ||
                (s.email || '').toLowerCase().includes(searchTerm) ||
                (s.awardNumber || '').toLowerCase().includes(searchTerm)
            );
        }

        if (filteredStudents.length === 0) {
            container.innerHTML = '<p class="no-data">No students found.</p>';
            return;
        }
        
        container.innerHTML = filteredStudents.map((student, index) => {
            const safeStatus = (student.status || 'active').toLowerCase();
            const isArchived = safeStatus === 'archived';
            return `
                <div class="student-item">
                    <div class="student-header">
                        <h4><span class="student-index">${index + 1}</span>${student.firstName || ''} ${student.lastName || ''}</h4>
                    </div>
                    <div class="student-info">
                        <div class="info-item">
                            <span class="info-label">Student ID</span>
                            <span class="info-value">${student.studentId || 'N/A'}</span>
                        </div>
                        ${isArchived ? '<div class="info-item"><span class="info-label">Status</span><span class="info-value" style="color: #f59e0b;">Archived</span></div>' : ''}
                    </div>
                    <div class="student-actions">
                        <button class="btn btn-secondary" onclick="openStudentProfileModal(${student.id || student.student_id})">View Profile</button>
                        <button class="btn btn-secondary" onclick="editStudent(${student.id})">Edit</button>
                        ${isArchived 
                            ? `<button class="btn btn-success" onclick="restoreStudent(${student.id})">Restore</button>`
                            : `<button class="btn btn-secondary" onclick="archiveStudent(${student.id})">Archive</button>`
                        }
                        <button class="btn btn-danger" onclick="deleteStudent(${student.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        await updateAdminStats(); // Refresh stats from database
    } catch (error) {
        console.error('Error loading students:', error);
        container.innerHTML = '<p class="no-data">Error loading students.</p>';
    }
}

// Load Reports Tab
async function loadReports() {
    console.log('📊 Loading reports...');
    
    const departmentChart = document.getElementById('departmentChart');
    const departmentSummary = document.getElementById('departmentSummary');
    const placeChart = document.getElementById('placeChart');
    const placeSummary = document.getElementById('placeSummary');

    try {
        // Fetch students from database (includes both active and archived)
        const studentsArr = await getStudentsFromDatabase();
        console.log('✅ Students loaded for reports:', studentsArr.length);

        if (!studentsArr || studentsArr.length === 0) {
            // Show no data message for both charts
            if (departmentSummary) {
                departmentSummary.innerHTML = '<p class="no-data">No students data available.</p>';
            }
            if (placeSummary) {
                placeSummary.innerHTML = '<p class="no-data">No students data available.</p>';
            }
            if (departmentChart) {
                const ctx = departmentChart.getContext('2d');
                ctx.clearRect(0, 0, departmentChart.width, departmentChart.height);
            }
            if (placeChart) {
                const ctx = placeChart.getContext('2d');
                ctx.clearRect(0, 0, placeChart.width, placeChart.height);
            }
            return;
        }

        // Calculate status breakdowns
        const activeStudents = studentsArr.filter(s => {
            const status = (s.status || s.student_status || 'active').toLowerCase();
            return status === 'active';
        });
        const archivedStudents = studentsArr.filter(s => {
            const status = (s.status || s.student_status || 'active').toLowerCase();
            return status === 'archived';
        });

        console.log(`📊 Report statistics: ${studentsArr.length} total (${activeStudents.length} active, ${archivedStudents.length} archived)`);

        // Department analysis (includes all students - active and archived)
    if (departmentChart && departmentSummary) {
            // Helper function to normalize department names (extract only department, ignore course details)
            const normalizeDepartmentName = (dept) => {
                if (!dept || !dept.trim()) return 'Unspecified';
                
                let normalized = dept.trim();
                
                // First, check for standard department names and return them as-is
                const standardDepartments = [
                    'Department of Computer Studies',
                    'Department of Business and Management',
                    'Department of Business & Management',
                    'Department of Industrial Technology',
                    'Department of General Teacher Training',
                    'College of Criminal Justice Education'
                ];
                
                // Check if it matches a standard department name (case-insensitive)
                for (const stdDept of standardDepartments) {
                    if (normalized.toLowerCase() === stdDept.toLowerCase() || 
                        normalized.toLowerCase().startsWith(stdDept.toLowerCase())) {
                        return stdDept; // Return the exact standard name
                    }
                }
                
                // If not a standard name, try to extract department name
                // Remove course-specific information that might be appended
                // Remove patterns like "- BSIT", "- BSCS", "- BSBA", etc.
                normalized = normalized.replace(/\s*-\s*(BSIT|BSCS|BSCpE|BSBA|BSN|BSEd|BS.*?|Bachelor.*?)\s*$/i, '');
                
                // Remove patterns like "(BSIT)", "(BSCS)", etc.
                normalized = normalized.replace(/\s*\([^)]*\)\s*$/i, '');
                
                // Remove any trailing course abbreviations
                normalized = normalized.replace(/\s+(BSIT|BSCS|BSCpE|BSBA|BSN|BSEd)\s*$/i, '');
                
                // Extract just the department part if it contains separators
                // Common patterns: "Department of X - Course" or "Department of X (Course)"
                if (normalized.includes(' - ')) {
                    normalized = normalized.split(' - ')[0].trim();
                }
                
                // Map common variations to standard names
                if (normalized.toLowerCase().includes('computer studies') || 
                    normalized.toLowerCase().includes('computer science') ||
                    normalized.toLowerCase().includes('information technology') ||
                    normalized.toLowerCase().includes('computer engineering')) {
                    return 'Department of Computer Studies';
                }
                if (normalized.toLowerCase().includes('business') && 
                    (normalized.toLowerCase().includes('management') || 
                     normalized.toLowerCase().includes('hospitality') ||
                     normalized.toLowerCase().includes('tourism'))) {
                    return 'Department of Business and Management';
                }
                if (normalized.toLowerCase().includes('industrial technology')) {
                    return 'Department of Industrial Technology';
                }
                if (normalized.toLowerCase().includes('teacher training') || 
                    normalized.toLowerCase().includes('education')) {
                    return 'Department of General Teacher Training';
                }
                if (normalized.toLowerCase().includes('criminal justice') || 
                    normalized.toLowerCase().includes('criminology')) {
                    return 'College of Criminal Justice Education';
                }
                
                return normalized || 'Unspecified';
            };
            
        const deptCounts = studentsArr.reduce((acc, s) => {
                const originalDept = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
                const normalizedDept = normalizeDepartmentName(originalDept);
                // Ensure we're grouping by department only, not course
                if (originalDept !== normalizedDept) {
                    console.log(`📊 Normalized department: "${originalDept}" -> "${normalizedDept}"`);
                }
            acc[normalizedDept] = (acc[normalizedDept] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Department counts (after normalization):', deptCounts);
            
            // Department breakdown by status
            const deptActiveCounts = activeStudents.reduce((acc, s) => {
                const originalDept = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
                const normalizedDept = normalizeDepartmentName(originalDept);
                acc[normalizedDept] = (acc[normalizedDept] || 0) + 1;
                return acc;
            }, {});
            
            const deptArchivedCounts = archivedStudents.reduce((acc, s) => {
                const originalDept = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
                const normalizedDept = normalizeDepartmentName(originalDept);
                acc[normalizedDept] = (acc[normalizedDept] || 0) + 1;
                return acc;
            }, {});
            
        if (Object.keys(deptCounts).length === 0) {
            departmentSummary.innerHTML = '<p class="no-data">No department data available.</p>';
            const ctx = departmentChart.getContext('2d');
            ctx.clearRect(0, 0, departmentChart.width, departmentChart.height);
        } else {
            drawSimpleChart(departmentChart, deptCounts, { hideLabels: false, labelFormatter: abbreviateDepartment });
            const total = Object.values(deptCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
            departmentSummary.innerHTML = `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 0.85em;">
                        <strong>Total: ${total}</strong> (${activeStudents.length} Active, ${archivedStudents.length} Archived)
                    </div>
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const activeCount = deptActiveCounts[name] || 0;
                            const archivedCount = deptArchivedCounts[name] || 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                        const abbr = abbreviateDepartment(name);
                            return `<li title="${name} - Active: ${activeCount}, Archived: ${archivedCount}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${abbr}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                                ${archivedCount > 0 ? `<span style="font-size: 0.8em; color: #f59e0b; margin-left: 8px;">[${archivedCount} archived]</span>` : ''}
                        </li>`;
                    }).join('')}
                </ul>
            `;
        }
    }

        // From (place) analysis - Group by Province and Municipality (not street/barangay)
    if (placeChart && placeSummary) {
            // Helper function to extract Province and Municipality
            const getProvinceMunicipality = (student) => {
                // Check if student has province and municipality fields (from applications)
                const province = (student.province && student.province.trim()) ? student.province.trim() : '';
                const municipality = (student.municipality && student.municipality.trim()) ? student.municipality.trim() : '';
                
                // If we have both, return formatted string
                if (province && municipality) {
                    return `${municipality}, ${province}`;
                }
                
                // If we only have municipality, return it
                if (municipality) {
                    return municipality;
                }
                
                // If we only have province, return it
                if (province) {
                    return province;
                }
                
                // Fallback: try to parse from place field
                const place = (student.place && student.place.trim()) ? student.place.trim() : 
                             (student.from && student.from.trim()) ? student.from.trim() :
                             (student.origin && student.origin.trim()) ? student.origin.trim() : '';
                
                if (!place) return 'Unspecified';
                
                // Try to extract province and municipality from place field
                // Common formats: "Street, Barangay, Municipality, Province" or "Municipality, Province"
                const parts = place.split(',').map(p => p.trim()).filter(p => p);
                
                if (parts.length >= 2) {
                    // Likely format: something, municipality, province
                    // Or: municipality, province
                    const lastPart = parts[parts.length - 1].toLowerCase();
                    const secondLast = parts[parts.length - 2];
                    
                    // Check if last part looks like a province (common provinces in the Philippines)
                    if (lastPart.includes('province') || lastPart.includes('prov') || 
                        lastPart.includes('del sur') || lastPart.includes('del norte') ||
                        lastPart.includes('surigao') || lastPart.includes('agusan') ||
                        lastPart.includes('dinagat') || lastPart.includes('islands')) {
                        return `${secondLast}, ${parts[parts.length - 1]}`;
                    }
                    
                    // If not clear province format, use last two parts
                    return `${secondLast}, ${parts[parts.length - 1]}`;
                } else if (parts.length === 1) {
                    return parts[0];
                }
                
                return 'Unspecified';
            };
            
            // Group by province and municipality
            const placeGroups = {};
            studentsArr.forEach(s => {
                const locationKey = getProvinceMunicipality(s);
                
                if (!placeGroups[locationKey]) {
                    placeGroups[locationKey] = {
                        count: 0,
                        displayName: locationKey
                    };
                }
                placeGroups[locationKey].count++;
            });
            
            // Convert to counts object
            const placeCounts = {};
            Object.keys(placeGroups).forEach(key => {
                const group = placeGroups[key];
                placeCounts[group.displayName] = group.count;
            });
            
            // Place breakdown by status
            const placeActiveGroups = {};
            activeStudents.forEach(s => {
                const locationKey = getProvinceMunicipality(s);
                
                if (!placeActiveGroups[locationKey]) {
                    placeActiveGroups[locationKey] = {
                        count: 0,
                        displayName: locationKey
                    };
                }
                placeActiveGroups[locationKey].count++;
            });
            
            const placeActiveCounts = {};
            Object.keys(placeActiveGroups).forEach(key => {
                const group = placeActiveGroups[key];
                placeActiveCounts[group.displayName] = group.count;
            });
            
            const placeArchivedGroups = {};
            archivedStudents.forEach(s => {
                const locationKey = getProvinceMunicipality(s);
                
                if (!placeArchivedGroups[locationKey]) {
                    placeArchivedGroups[locationKey] = {
                        count: 0,
                        displayName: locationKey
                    };
                }
                placeArchivedGroups[locationKey].count++;
            });
            
            const placeArchivedCounts = {};
            Object.keys(placeArchivedGroups).forEach(key => {
                const group = placeArchivedGroups[key];
                placeArchivedCounts[group.displayName] = group.count;
            });
            
        if (Object.keys(placeCounts).length === 0) {
            placeSummary.innerHTML = '<p class="no-data">No origin data available.</p>';
            const ctx = placeChart.getContext('2d');
            ctx.clearRect(0, 0, placeChart.width, placeChart.height);
        } else {
            // Hide labels under bars; values only on top
            drawSimpleChart(placeChart, placeCounts, { hideLabels: true });
            const total = Object.values(placeCounts).reduce((a, b) => a + b, 0);
            const sorted = Object.entries(placeCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);
            placeSummary.innerHTML = `
                    <div style="margin-bottom: 10px; padding: 8px; background: #f3f4f6; border-radius: 6px; font-size: 0.85em;">
                        <strong>Total: ${total}</strong> (${activeStudents.length} Active, ${archivedStudents.length} Archived)
                    </div>
                <ul class="dept-summary-list">
                    ${sorted.map(([name, count], idx) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                            const activeCount = placeActiveCounts[name] || 0;
                            const archivedCount = placeArchivedCounts[name] || 0;
                        const color = `hsl(${(idx * 53) % 360}, 70%, 55%)`;
                            return `<li title="${name} - Active: ${activeCount}, Archived: ${archivedCount}">
                            <span class="dept-color-dot" style="background:${color}"></span>
                            <span class="dept-name">${(name || 'Unspecified').toLowerCase()}</span>
                            <span class="dept-count">${count} (${pct}%)</span>
                                ${archivedCount > 0 ? `<span style="font-size: 0.8em; color: #f59e0b; margin-left: 8px;">[${archivedCount} archived]</span>` : ''}
                        </li>`;
                    }).join('')}
                </ul>
            `;
            }
        }
        
        console.log('✅ Reports loaded successfully');
    } catch (error) {
        console.error('❌ Error loading reports:', error);
        if (departmentSummary) {
            departmentSummary.innerHTML = '<p class="no-data">Error loading department data.</p>';
        }
        if (placeSummary) {
            placeSummary.innerHTML = '<p class="no-data">Error loading origin data.</p>';
        }
        if (typeof showToast === 'function') {
            showToast('Failed to load reports. Please try again.', 'error');
        }
    }
}

// Load Settings Tab
function loadSettings() {
    // This would load system settings
    showToast('Settings loaded successfully!', 'success');
}

// Export Reports: Generate Excel with Department and Origin breakdowns
async function generateReport() {
    try {
        const XLSXLib = (typeof XLSX !== 'undefined') ? XLSX : (window && window.XLSX);
        if (!XLSXLib) {
            showToast('Export library not loaded', 'error');
            return;
        }

        const studentsArr = await getStudentsFromDatabase();
        if (!studentsArr || studentsArr.length === 0) {
            showToast('No data to export', 'info');
            return;
        }

        const statusOf = (s) => (s.status || s.student_status || 'active').toLowerCase();
        const isActive = (s) => statusOf(s) === 'active';
        const isArchived = (s) => statusOf(s) === 'archived';

        // Department breakdown - normalize to extract only department names, not courses
        const normalizeDepartmentName = (dept) => {
            if (!dept || !dept.trim()) return 'Unspecified';
            
            let normalized = dept.trim();
            
            // First, check for standard department names and return them as-is
            const standardDepartments = [
                'Department of Computer Studies',
                'Department of Business and Management',
                'Department of Business & Management',
                'Department of Industrial Technology',
                'Department of General Teacher Training',
                'College of Criminal Justice Education'
            ];
            
            // Check if it matches a standard department name (case-insensitive)
            for (const stdDept of standardDepartments) {
                if (normalized.toLowerCase() === stdDept.toLowerCase() || 
                    normalized.toLowerCase().startsWith(stdDept.toLowerCase())) {
                    return stdDept; // Return the exact standard name
                }
            }
            
            // If not a standard name, try to extract department name
            // Remove course-specific information that might be appended
            normalized = normalized.replace(/\s*-\s*(BSIT|BSCS|BSCpE|BSBA|BSN|BSEd|BS.*?|Bachelor.*?)\s*$/i, '');
            normalized = normalized.replace(/\s*\([^)]*\)\s*$/i, '');
            normalized = normalized.replace(/\s+(BSIT|BSCS|BSCpE|BSBA|BSN|BSEd)\s*$/i, '');
            
            if (normalized.includes(' - ')) {
                normalized = normalized.split(' - ')[0].trim();
            }
            
            // Map common variations to standard names
            if (normalized.toLowerCase().includes('computer studies') || 
                normalized.toLowerCase().includes('computer science') ||
                normalized.toLowerCase().includes('information technology') ||
                normalized.toLowerCase().includes('computer engineering')) {
                return 'Department of Computer Studies';
            }
            if (normalized.toLowerCase().includes('business') && 
                (normalized.toLowerCase().includes('management') || 
                 normalized.toLowerCase().includes('hospitality') ||
                 normalized.toLowerCase().includes('tourism'))) {
                return 'Department of Business and Management';
            }
            if (normalized.toLowerCase().includes('industrial technology')) {
                return 'Department of Industrial Technology';
            }
            if (normalized.toLowerCase().includes('teacher training') || 
                normalized.toLowerCase().includes('education')) {
                return 'Department of General Teacher Training';
            }
            if (normalized.toLowerCase().includes('criminal justice') || 
                normalized.toLowerCase().includes('criminology')) {
                return 'College of Criminal Justice Education';
            }
            
            return normalized || 'Unspecified';
        };
        
        const deptCounts = {};
        const deptActive = {};
        const deptArchived = {};
        studentsArr.forEach(s => {
            const originalDept = (s && s.department && s.department.trim()) ? s.department.trim() : 'Unspecified';
            const normalizedDept = normalizeDepartmentName(originalDept);
            deptCounts[normalizedDept] = (deptCounts[normalizedDept] || 0) + 1;
            if (isActive(s)) deptActive[normalizedDept] = (deptActive[normalizedDept] || 0) + 1;
            if (isArchived(s)) deptArchived[normalizedDept] = (deptArchived[normalizedDept] || 0) + 1;
        });

        // Place breakdown - Group by Province and Municipality (same logic as loadReports)
        const getProvinceMunicipality = (student) => {
            // Check if student has province and municipality fields
            const province = (student.province && student.province.trim()) ? student.province.trim() : '';
            const municipality = (student.municipality && student.municipality.trim()) ? student.municipality.trim() : '';
            
            if (province && municipality) {
                return `${municipality}, ${province}`;
            }
            if (municipality) return municipality;
            if (province) return province;
            
            // Fallback: parse from place field
            const place = (student.place && student.place.trim()) ? student.place.trim() : 
                         (student.from && student.from.trim()) ? student.from.trim() :
                         (student.origin && student.origin.trim()) ? student.origin.trim() : '';
            
            if (!place) return 'Unspecified';
            
            const parts = place.split(',').map(p => p.trim()).filter(p => p);
            
            if (parts.length >= 2) {
                const lastPart = parts[parts.length - 1].toLowerCase();
                const secondLast = parts[parts.length - 2];
                
                if (lastPart.includes('province') || lastPart.includes('prov') || 
                    lastPart.includes('del sur') || lastPart.includes('del norte') ||
                    lastPart.includes('surigao') || lastPart.includes('agusan') ||
                    lastPart.includes('dinagat') || lastPart.includes('islands')) {
                    return `${secondLast}, ${parts[parts.length - 1]}`;
                }
                
                return `${secondLast}, ${parts[parts.length - 1]}`;
            } else if (parts.length === 1) {
                return parts[0];
            }
            
            return 'Unspecified';
        };

        const placeCounts = {};
        const placeActive = {};
        const placeArchived = {};
        studentsArr.forEach(s => {
            const locationKey = getProvinceMunicipality(s);
            placeCounts[locationKey] = (placeCounts[locationKey] || 0) + 1;
            if (isActive(s)) placeActive[locationKey] = (placeActive[locationKey] || 0) + 1;
            if (isArchived(s)) placeArchived[locationKey] = (placeArchived[locationKey] || 0) + 1;
        });

        // Build sheets
        const deptRows = [[
            'Department', 'Total', 'Active', 'Archived'
        ]].concat(
            Object.keys(deptCounts)
                .sort((a,b) => deptCounts[b] - deptCounts[a])
                .map(name => [
                    name,
                    deptCounts[name] || 0,
                    deptActive[name] || 0,
                    deptArchived[name] || 0
                ])
        );

        const placeRows = [[
            'Origin (City)', 'Total', 'Active', 'Archived'
        ]].concat(
            Object.keys(placeCounts)
                .sort((a,b) => placeCounts[b] - placeCounts[a])
                .map(name => [
                    name,
                    placeCounts[name] || 0,
                    placeActive[name] || 0,
                    placeArchived[name] || 0
                ])
        );

        const wb = XLSXLib.utils.book_new();
        const deptSheet = XLSXLib.utils.aoa_to_sheet(deptRows);
        const placeSheet = XLSXLib.utils.aoa_to_sheet(placeRows);
        XLSXLib.utils.book_append_sheet(wb, deptSheet, 'Departments');
        XLSXLib.utils.book_append_sheet(wb, placeSheet, 'Origins');

        const now = new Date();
        const stamp = now.toISOString().slice(0,19).replace(/[:T]/g, '-');
        const filename = `GranTES-Reports-${stamp}.xlsx`;
        XLSXLib.writeFile(wb, filename);
        showToast('Report exported successfully!', 'success');
    } catch (error) {
        console.error('Error generating report:', error);
        showToast('Failed to generate report', 'error');
    }
}

// Student Management Functions
function viewStudentProfile(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    // Populate modal with student data
    document.getElementById('adminStudentName').textContent = `${student.firstName} ${student.lastName}`;
    document.getElementById('adminStudentEmail').textContent = student.email;
    document.getElementById('adminStudentId').textContent = student.studentId;
    document.getElementById('adminStudentCourse').textContent = student.course;
    document.getElementById('adminStudentYear').textContent = student.year;
    document.getElementById('adminStudentStatus').textContent = student.status;
    document.getElementById('adminStudentAppStatus').textContent = student.applicationStatus || 'N/A';
    document.getElementById('adminStudentRegistered').textContent = formatDate(student.registered);
    
    // Set student ID picture if available
    const img = document.getElementById('adminStudentPhoto');
    if (img) {
        if (student.idPictureDataUrl) {
            img.src = student.idPictureDataUrl;
            img.alt = 'Student ID Picture';
        } else {
            img.src = '';
            img.alt = 'No ID Picture available';
        }
    }
    
    // Show modal
    document.getElementById('studentProfileModal').style.display = 'block';
}

function closeStudentProfileModal() {
    document.getElementById('studentProfileModal').style.display = 'none';
}

async function editStudent(studentId) {
    try {
        console.log('📝 Loading student data for editing:', studentId);
        
        // Fetch student data from database
        const students = await getStudentsFromDatabase();
        const student = students.find(s => s.id === studentId || s.id == studentId);
        
    if (!student) {
        showToast('Student not found', 'error');
        return;
    }
    
        console.log('✅ Student found:', student);
        
        // Populate the edit form with student data
        document.getElementById('editStudentId').value = student.id;
        document.getElementById('editFirstName').value = student.firstName || student.first_name || '';
        document.getElementById('editLastName').value = student.lastName || student.last_name || '';
        document.getElementById('editEmail').value = student.email || '';
        document.getElementById('editCourse').value = student.course || '';
        document.getElementById('editYear').value = student.year || student.yearLevel || student.year_level || '';
        document.getElementById('editDepartment').value = student.department || '';
        document.getElementById('editPlace').value = student.place || student.from || student.origin || '';
        document.getElementById('editIsIndigenous').checked = student.isIndigenous === true || student.isIndigenous === 1 || student.is_indigenous === 1 || student.is_indigenous === true;
        document.getElementById('editIsPwd').checked = student.isPwd === true || student.isPwd === 1 || student.is_pwd === 1 || student.is_pwd === true;
        
        // Show the modal
        document.getElementById('editStudentModal').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading student for editing:', error);
        showToast('Failed to load student data: ' + error.message, 'error');
    }
}

function closeEditStudentModal() {
    document.getElementById('editStudentModal').style.display = 'none';
    // Reset form
    document.getElementById('editStudentForm').reset();
}

async function handleEditStudent(event) {
    event.preventDefault();
    
    try {
        const studentId = document.getElementById('editStudentId').value;
        const firstName = document.getElementById('editFirstName').value.trim();
        const lastName = document.getElementById('editLastName').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const course = document.getElementById('editCourse').value.trim();
        const year = document.getElementById('editYear').value;
        const department = document.getElementById('editDepartment').value;
        const place = document.getElementById('editPlace').value.trim();
        const isIndigenous = document.getElementById('editIsIndigenous').checked ? 1 : 0;
        const isPwd = document.getElementById('editIsPwd').checked ? 1 : 0;
        
        // Validation
        if (!firstName || !lastName || !email || !course || !year || !department || !place) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        
        console.log('📤 Updating student:', {
            id: studentId,
            firstName,
            lastName,
            email,
            course,
            year,
            department,
            place,
            isIndigenous,
            isPwd
        });
        
        // Update student in database
        const response = await updateStudent({
            id: parseInt(studentId),
            firstName: firstName,
            lastName: lastName,
            email: email,
            course: course,
            year: year,
            department: department,
            place: place,
            isIndigenous: isIndigenous,
            isPwd: isPwd
        });
        
        if (response && response.success) {
            showToast('Student updated successfully!', 'success');
            closeEditStudentModal();
            await loadStudents(); // Refresh student list
            await updateAdminStats(); // Refresh admin stats
        } else {
            showToast(response?.message || 'Failed to update student', 'error');
        }
    } catch (error) {
        console.error('❌ Error updating student:', error);
        showToast('Failed to update student: ' + error.message, 'error');
    }
}

async function archiveStudent(studentId) {
    if (!confirm('Are you sure you want to archive this student?')) {
        return;
    }
    
    try {
        console.log('📦 Archiving student:', studentId);
        
        // Call archive API
        const response = await apiCall('archive_student.php', 'POST', {
            id: studentId,
            status: 'archived'
        });
        
        if (response && response.success) {
            showToast('Student archived successfully!', 'success');
            await loadStudents(); // Refresh student list
            await updateAdminStats(); // Refresh admin stats
            
            // Check if reports tab is active and refresh it
            const reportsTab = document.getElementById('reports-tab');
            if (reportsTab && reportsTab.classList.contains('active')) {
                console.log('📊 Refreshing reports after archiving...');
                await loadReports();
            }
        } else {
            showToast(response?.message || 'Failed to archive student', 'error');
        }
    } catch (error) {
        console.error('❌ Error archiving student:', error);
        showToast('Failed to archive student: ' + error.message, 'error');
    }
}

async function restoreStudent(studentId) {
    if (!confirm('Are you sure you want to restore this student?')) {
        return;
    }
    
    try {
        console.log('📦 Restoring student:', studentId);
        
        // Call archive API with 'active' status
        const response = await apiCall('archive_student.php', 'POST', {
            id: studentId,
            status: 'active'
        });
        
        if (response && response.success) {
            showToast('Student restored successfully!', 'success');
            await loadStudents(); // Refresh student list
            await updateAdminStats(); // Refresh admin stats
            
            // Check if reports tab is active and refresh it
            const reportsTab = document.getElementById('reports-tab');
            if (reportsTab && reportsTab.classList.contains('active')) {
                console.log('📊 Refreshing reports after restoring...');
                await loadReports();
            }
        } else {
            showToast(response?.message || 'Failed to restore student', 'error');
        }
    } catch (error) {
        console.error('❌ Error restoring student:', error);
        showToast('Failed to restore student: ' + error.message, 'error');
    }
}

// Application Management Functions
function reviewApplication(applicationId) {
    const application = applications.find(app => app.id === applicationId);
    if (!application) return;
    
    currentApplicationId = applicationId;
    
    // Populate modal with application details
    const detailsContainer = document.getElementById('applicationDetails');
    detailsContainer.innerHTML = `
        <div class="application-details">
            <h4>Application Details</h4>
            <div class="detail-row">
                <strong>Name:</strong>
                <span>${application.firstName} ${application.lastName}</span>
            </div>
            <div class="detail-row">
                <strong>Student ID:</strong>
                <span>${application.studentId}</span>
            </div>
            <div class="detail-row">
                <strong>Email:</strong>
                <span>${application.email}</span>
            </div>
            <div class="detail-row">
                <strong>Course:</strong>
                <span>${application.course}</span>
            </div>
            <div class="detail-row">
                <strong>Year Level:</strong>
                <span>${application.year}</span>
            </div>
            <div class="detail-row">
                <strong>Applied Date:</strong>
                <span>${formatDate(application.appliedDate)}</span>
            </div>
            <div class="detail-row">
                <strong>Status:</strong>
                <span class="status-badge status-${application.status}">${application.status.toUpperCase()}</span>
            </div>
        </div>
    `;
    
    // Show modal
    // reviewModal removed - using viewApplicationDetails instead
    viewApplicationDetails(application.id);
}

// updateApplicationStatus function removed - approval/rejection process has been replaced

// Filter and Search Functions
function filterApplications() {
    loadApplications();
}

function searchApplications() {
    loadApplications();
}

function filterStudents() {
    loadStudents();
}

function searchStudents() {
    loadStudents();
}

// Admin Password Change Function
async function changeAdminPassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showToast('Please fill in all password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters long', 'error');
        return;
    }
    
    try {
        // Get admin email from current session
        const adminData = JSON.parse(localStorage.getItem('adminCredentials') || '{"email": "admin@grantes.com"}');
        
        console.log('Attempting to change admin password...');
        
        // Call API to update password in database
        const response = await apiCall('update_admin_password.php', 'POST', {
            email: adminData.email,
            currentPassword: currentPassword,
            newPassword: newPassword
        });
        
        console.log('Password change response:', response);
        
        if (response && response.success) {
            // Update localStorage
            adminData.password = newPassword;
            localStorage.setItem('adminCredentials', JSON.stringify(adminData));
            
            // Clear form
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmNewPassword').value = '';
            
            showToast('Password changed successfully!', 'success');
        } else {
            showToast(response?.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('Failed to change password: ' + error.message, 'error');
    }
}

// Student Password Change Functions
let selectedStudentForPasswordChange = null;

async function searchStudentsForPasswordChange() {
    const searchTerm = document.getElementById('studentSearch').value.trim();
    const resultsContainer = document.getElementById('studentSearchResults');
    
    if (searchTerm.length < 2) {
        resultsContainer.style.display = 'none';
        return;
    }
    
    try {
        console.log('🔍 Searching students for password change:', searchTerm);
        
        // Search students from database
        const response = await apiCall(`search_students.php?query=${encodeURIComponent(searchTerm)}`, 'GET');
        
        if (response && response.success && response.students) {
            const matchingStudents = response.students.slice(0, 10); // Limit to 10 results
    
    if (matchingStudents.length === 0) {
        resultsContainer.innerHTML = '<div class="student-search-item"><p>No students found</p></div>';
    } else {
        resultsContainer.innerHTML = matchingStudents.map(student => `
            <div class="student-search-item" onclick="selectStudentForPasswordChange(${student.id})">
                        <h5>${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}</h5>
                        <p>ID: ${student.studentId || student.student_id || 'N/A'} | Award: ${student.awardNumber || student.award_number || 'N/A'} | Email: ${student.email || 'N/A'}</p>
            </div>
        `).join('');
            }
        } else {
            resultsContainer.innerHTML = '<div class="student-search-item"><p>No students found</p></div>';
    }
    
    resultsContainer.classList.add('show');
    resultsContainer.style.display = 'block';
    } catch (error) {
        console.error('❌ Error searching students:', error);
        resultsContainer.innerHTML = '<div class="student-search-item"><p>Error searching students</p></div>';
        resultsContainer.style.display = 'block';
    }
}

async function selectStudentForPasswordChange(studentId) {
    try {
        console.log('📝 Selecting student for password change:', studentId);
        
        // Fetch student from database
        const students = await getStudentsFromDatabase();
        const student = students.find(s => s.id === studentId || s.id == studentId);
    
    if (!student) {
        showToast('Student not found', 'error');
        return;
    }
        
        console.log('✅ Student found:', student);
    
    selectedStudentForPasswordChange = student;
    
    // Hide search results
    document.getElementById('studentSearchResults').style.display = 'none';
    
    // Show selected student info
    document.getElementById('selectedStudentInfo').innerHTML = `
            <h5>${student.firstName || student.first_name || ''} ${student.lastName || student.last_name || ''}</h5>
        <p><strong>Student ID:</strong> ${student.studentId || student.student_id || 'N/A'}</p>
        <p><strong>Award Number:</strong> ${student.awardNumber || student.award_number || 'N/A'}</p>
        <p><strong>Email:</strong> ${student.email || 'N/A'}</p>
        <p><strong>Department:</strong> ${student.department || 'N/A'}</p>
    `;
    
    // Show password form
    document.getElementById('studentPasswordForm').style.display = 'block';
    
    // Clear search input
    document.getElementById('studentSearch').value = '';
    } catch (error) {
        console.error('❌ Error loading student:', error);
        showToast('Failed to load student data: ' + error.message, 'error');
    }
}

async function changeStudentPassword() {
    if (!selectedStudentForPasswordChange) {
        showToast('Please select a student first', 'error');
        return;
    }
    
    const newPassword = document.getElementById('newStudentPassword').value;
    const confirmPassword = document.getElementById('confirmStudentPassword').value;
    
    // Validation
    if (!newPassword || !confirmPassword) {
        showToast('Please fill in both password fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }
    
    try {
        // Call API to update password in database - use email or studentId
        const requestData = {
            newPassword: newPassword
        };
        
        // Log the full student object for debugging
        console.log('🔍 Selected student object:', selectedStudentForPasswordChange);
        
        // Add identifier (prefer email, then studentId, then id)
        // Handle both camelCase and snake_case field names
        const email = selectedStudentForPasswordChange.email;
        const studentId = selectedStudentForPasswordChange.studentId || selectedStudentForPasswordChange.student_id;
        const id = selectedStudentForPasswordChange.id;
        
        console.log('🔍 Extracted identifiers:', { email, studentId, id });
        
        if (email) {
            requestData.email = email;
            console.log('✅ Using email identifier:', email);
        } else if (studentId) {
            requestData.student_id = studentId;
            console.log('✅ Using student_id identifier:', studentId);
        } else if (id) {
            requestData.studentId = id;
            console.log('✅ Using id identifier:', id);
        }
        
        console.log('📝 Calling password change API with data:', requestData);
        const response = await apiCall('update_student_password.php', 'POST', requestData);
        console.log('📥 API Response received:', response);
        
        if (response && response.success) {
            console.log('✅ Password change successful');
            
            // Get student name before clearing
            const studentName = selectedStudentForPasswordChange?.firstName || selectedStudentForPasswordChange?.first_name || 'Student';
            const studentLastName = selectedStudentForPasswordChange?.lastName || selectedStudentForPasswordChange?.last_name || '';
            
            // Clear form
            clearStudentPasswordForm();
            
            showToast(`Password changed successfully for ${studentName} ${studentLastName}`, 'success');
        } else {
            console.error('❌ Password change failed. Response:', response);
            showToast(response?.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing student password:', error);
        showToast('Failed to change password: ' + error.message, 'error');
    }
}

function clearStudentPasswordForm() {
    selectedStudentForPasswordChange = null;
    document.getElementById('studentSearch').value = '';
    document.getElementById('studentSearchResults').style.display = 'none';
    document.getElementById('selectedStudentInfo').innerHTML = '';
    document.getElementById('studentPasswordForm').style.display = 'none';
    document.getElementById('newStudentPassword').value = '';
    document.getElementById('confirmStudentPassword').value = '';
}

// Student Change Own Password Functions
// Student password change functionality removed - students cannot change their passwords

// Emoji Picker Functions
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '🤯', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
    people: ['👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👨‍🦰', '👨‍🦱', '👨‍🦳', '👨‍🦲', '👩', '👩‍🦰', '🧑‍🦰', '👩‍🦱', '🧑‍🦱', '👩‍🦳', '🧑‍🦳', '👩‍🦲', '🧑‍🦲', '👱‍♀️', '👱‍♂️', '🧓', '👴', '👵', '🙍', '🙍‍♂️', '🙍‍♀️', '🙎', '🙎‍♂️', '🙎‍♀️', '🙅', '🙅‍♂️', '🙅‍♀️', '🙆', '🙆‍♂️', '🙆‍♀️', '💁', '💁‍♂️', '💁‍♀️', '🙋', '🙋‍♂️', '🙋‍♀️', '🧏', '🧏‍♂️', '🧏‍♀️', '🤦', '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️', '🙇', '🙇‍♂️', '🙇‍♀️', '🤦', '🤦‍♂️', '🤦‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🦅', '🦉', '🦊', '🦝', '🐻', '🐻‍❄️', '🐨', '🐼', '🦥', '🦦', '🦨', '🦘', '🦡', '🐾'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛫', '🛬', '🛩️', '💺', '🚀', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚟', '🚠', '🚡', '⛱️', '🎢', '🎡', '🎠', '🎪', '🗼', '🗽', '⛲', '⛺', '🌁', '🌃', '🏙️', '🌄', '🌅', '🌆', '🌇', '🌉', '🎆', '🎇', '✨', '🌟', '💫', '⭐', '🌠', '🏔️', '⛰️', '🌋', '🗻', '🏕️', '🏖️', '🏜️', '🏝️', '🏞️', '🏟️', '🏛️', '🏗️', '🧱', '🏘️', '🏚️', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '🗺️', '🗿', '🗾', '🗼'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏇', '🤹', '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
    objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🧯', '🪔', '🧨', '🗿', '🔮', '🔭', '🔬', '🕳️', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🪧', '📪', '📫', '📬', '📭', '📮', '🗳️', '✏️', '✒️', '🖊️', '🖋️', '🖌️', '🖍️', '📝', '💼', '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗑️', '🔒', '🔓', '🔏', '🔐', '🔑', '🗝️'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', '🔄', '🔤', '🆕', '🆓', '🆒', '🆗', '🆙', '🆖', '🔟', '🔢', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔺', '🔻', '💠', '🔲', '🔳', '⚪', '⚫', '🔴', '🔵', '🟠', '🟡', '🟢', '🟣', '🟤', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜', '🟰', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲']
};

let currentEmojiCategory = 'smileys';

function showEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
        modal.style.display = 'block';
        currentEmojiCategory = 'smileys';
        document.getElementById('emojiSearchInput').value = '';
        renderEmojis();
    }
}

function closeEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('emojiSearchInput').value = '';
    }
}

function switchEmojiCategory(category) {
    currentEmojiCategory = category;
    
    // Update category buttons
    document.querySelectorAll('.emoji-category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === category) {
            btn.classList.add('active');
        }
    });
    
    // Clear search and render
    document.getElementById('emojiSearchInput').value = '';
    renderEmojis();
}

function renderEmojis() {
    const container = document.getElementById('emojiGrid');
    const emojis = emojiCategories[currentEmojiCategory] || [];
    
    container.innerHTML = emojis.map(emoji => `
        <span class="emoji-item" onclick="selectEmoji('${emoji}')" title="${emoji}">${emoji}</span>
    `).join('');
}

function filterEmojis() {
    const searchTerm = document.getElementById('emojiSearchInput').value.toLowerCase();
    const emojiItems = document.querySelectorAll('.emoji-item');
    
    if (!searchTerm) {
        // Show all emojis in current category
        renderEmojis();
        return;
    }
    
    // Search across all categories
    let found = false;
    emojiItems.forEach(item => {
        const emoji = item.textContent;
        const unicode = emoji.codePointAt(0);
        // Simple search - you could enhance this with emoji names
        if (emoji.includes(searchTerm) || item.getAttribute('title')?.toLowerCase().includes(searchTerm)) {
            item.style.display = 'inline-flex';
            found = true;
        } else {
            item.style.display = 'none';
        }
    });
    
    // If no results in current category, search all
    if (!found) {
        let allMatches = [];
        Object.values(emojiCategories).flat().forEach(emoji => {
            if (emoji.includes(searchTerm)) {
                allMatches.push(emoji);
            }
        });
        
        const container = document.getElementById('emojiGrid');
        container.innerHTML = allMatches.map(emoji => `
            <span class="emoji-item" onclick="selectEmoji('${emoji}')" title="${emoji}">${emoji}</span>
        `).join('');
    }
}

function selectEmoji(emoji) {
    const postInput = document.getElementById('postInput');
    if (postInput) {
        const cursorPosition = postInput.selectionStart || postInput.value.length;
        const textBefore = postInput.value.substring(0, cursorPosition);
        const textAfter = postInput.value.substring(cursorPosition);
        postInput.value = textBefore + emoji + textAfter;
        
        // Move cursor after inserted emoji
        const newPosition = cursorPosition + emoji.length;
        postInput.setSelectionRange(newPosition, newPosition);
        postInput.focus();
    }
    
    // Close modal
    closeEmojiPicker();
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const emojiModal = document.getElementById('emojiPickerModal');
    if (event.target === emojiModal) {
        closeEmojiPicker();
    }
    
    const studentNamesModal = document.getElementById('studentNamesListModal');
    if (event.target === studentNamesModal) {
        closeStudentNamesListModal();
    }
    
});

// Image Lightbox Functions
let currentLightboxImages = [];
let currentLightboxIndex = 0;

function openImageLightbox(images, index = 0) {
    currentLightboxImages = images;
    currentLightboxIndex = index;
    
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCounter = document.getElementById('lightboxCounter');
    
    if (!lightbox || !lightboxImage) return;
    
    lightboxImage.src = resolveMediaUrl(images[index]);
    lightboxCounter.textContent = `${index + 1} / ${images.length}`;
    
    // Show/hide navigation arrows based on number of images
    const prevBtn = document.querySelector('.image-lightbox-prev');
    const nextBtn = document.querySelector('.image-lightbox-next');
    if (prevBtn) prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
    
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Add keyboard navigation
    document.addEventListener('keydown', handleLightboxKeyboard);
}

function openImageLightboxFromCarousel(imagesString, index) {
    try {
        const images = JSON.parse(imagesString.replace(/&quot;/g, '"'));
        openImageLightbox(images, index);
    } catch (e) {
        console.error('Error parsing images for lightbox:', e);
        // Fallback to single image
        openImageLightbox([imagesString], 0);
    }
}

function closeImageLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    // Remove keyboard listener
    document.removeEventListener('keydown', handleLightboxKeyboard);
}

function lightboxNextImage() {
    if (currentLightboxImages.length > 1) {
        currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
        updateLightboxImage();
    }
}

function lightboxPrevImage() {
    if (currentLightboxImages.length > 1) {
        currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
        updateLightboxImage();
    }
}

function updateLightboxImage() {
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCounter = document.getElementById('lightboxCounter');
    
    if (lightboxImage && currentLightboxImages[currentLightboxIndex]) {
        lightboxImage.src = resolveMediaUrl(currentLightboxImages[currentLightboxIndex]);
        lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
    }
}

function handleLightboxKeyboard(event) {
    if (event.key === 'Escape') {
        closeImageLightbox();
    } else if (event.key === 'ArrowLeft') {
        lightboxPrevImage();
    } else if (event.key === 'ArrowRight') {
        lightboxNextImage();
    }
}

