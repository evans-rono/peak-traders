// frontend/js/auth.js
// Authentication state management
const AuthManager = {
  user: null,
  
  async init() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const data = await api.getCurrentUser();
        this.user = data.user;
        this.updateUI();
        return true;
      } catch (error) {
        this.logout();
        return false;
      }
    }
    return false;
  },

  async login(email, password) {
    try {
      const data = await api.login({ email, password });
      api.setToken(data.token);
      this.user = data.user;
      this.updateUI();
      showToast('Success', 'Welcome back, ' + data.user.firstName);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async register(userData) {
    try {
      const data = await api.register(userData);
      api.setToken(data.token);
      this.user = data.user;
      this.updateUI();
      showToast('Success', 'Account created successfully');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  logout() {
    api.setToken(null);
    this.user = null;
    localStorage.removeItem('token');
    window.location.href = '/pages/login.html';
  },

  updateUI() {
    // Update user display elements
    document.querySelectorAll('.user-name').forEach(el => {
      if (this.user) el.textContent = `${this.user.firstName} ${this.user.lastName}`;
    });
    
    document.querySelectorAll('.user-balance').forEach(el => {
      if (this.user) {
        el.textContent = `KES ${this.user.balance.toLocaleString()}`;
      }
    });

    document.querySelectorAll('.user-avatar').forEach(el => {
      if (this.user) {
        el.textContent = `${this.user.firstName[0]}${this.user.lastName[0]}`.toUpperCase();
      }
    });
  },

  requireAuth() {
    if (!this.user) {
      window.location.href = '/pages/login.html';
      return false;
    }
    return true;
  }
};

// Form handlers
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const errorDiv = document.getElementById('loginError');
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';
      errorDiv.classList.remove('show');

      const result = await AuthManager.login(
        document.getElementById('email').value,
        document.getElementById('password').value
      );

      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';

      if (result.success) {
        window.location.href = '/pages/dashboard.html';
      } else {
        errorDiv.textContent = result.error;
        errorDiv.classList.add('show');
      }
    });
  }

  // Register form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const errorDiv = document.getElementById('registerError');

      // Validation
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.classList.add('show');
        return;
      }

      if (password.length < 8) {
        errorDiv.textContent = 'Password must be at least 8 characters';
        errorDiv.classList.add('show');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Creating account...';
      errorDiv.classList.remove('show');

      const userData = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        country: document.getElementById('country').value,
        password: password
      };

      const result = await AuthManager.register(userData);

      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';

      if (result.success) {
        window.location.href = '/pages/dashboard.html';
      } else {
        errorDiv.textContent = result.error;
        errorDiv.classList.add('show');
      }
    });
  }

  // Logout buttons
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => AuthManager.logout());
  });
});