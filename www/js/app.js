/**
 * Main Application Controller
 * Initializes the app and sets up event listeners
 */

class ExpenseApp {
    constructor() {
        this.isInstalled = false;
        this.deferredPrompt = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Show loading state
            this.showLoading();

            // Initialize database
            await db.init();
            console.log('Database initialized');

            // Initialize UI
            ui.init();
            console.log('UI initialized');

            // Set up event listeners
            this.setupEventListeners();

            // Show groups view by default
            await ui.showGroupsView();

            // Hide loading state
            this.hideLoading();

            // Check for install prompt
            this.setupInstallPrompt();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize app. Please refresh the page.');
        }
    }

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            ui.showGroupsView();
        });

        // FAB button - context aware
        document.getElementById('fab-btn').addEventListener('click', () => {
            if (ui.currentView === 'groups') {
                ui.showParentModal();
            } else {
                ui.showEntryModal();
            }
        });

        // Entry form submission
        document.getElementById('entry-form').addEventListener('submit', (e) => {
            ui.submitEntry(e);
        });

        // Category form submission
        document.getElementById('category-form').addEventListener('submit', (e) => {
            ui.submitCategory(e);
        });

        // Add category button
        document.getElementById('add-category-btn').addEventListener('click', () => {
            ui.showAddCategoryModal();
        });

        // Entry modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal.id === 'entry-modal') ui.closeEntryModal();
                if (modal.id === 'delete-modal') ui.closeDeleteModal();
                if (modal.id === 'parent-modal') ui.closeParentModal();
                if (modal.id === 'delete-parent-modal') ui.closeDeleteParentModal();
                if (modal.id === 'category-modal') ui.closeCategoryModal();
            });
        });

        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    if (modal.id === 'entry-modal') ui.closeEntryModal();
                    if (modal.id === 'delete-modal') ui.closeDeleteModal();
                    if (modal.id === 'parent-modal') ui.closeParentModal();
                    if (modal.id === 'delete-parent-modal') ui.closeDeleteParentModal();
                    if (modal.id === 'category-modal') ui.closeCategoryModal();
                }
            });
        });

        // Delete confirmation
        document.getElementById('confirm-delete-btn').addEventListener('click', () => {
            ui.deleteEntry();
        });

        // Parent form submission
        document.getElementById('parent-form').addEventListener('submit', (e) => {
            ui.submitParent(e);
        });

        // Delete parent confirmation
        document.getElementById('confirm-delete-parent-btn').addEventListener('click', () => {
            ui.deleteCurrentParent();
        });

        // Menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.toggleMenu();
        });

        // Menu items
        document.getElementById('menu-add-group').addEventListener('click', () => {
            this.closeMenu();
            ui.showParentModal();
        });

        document.getElementById('menu-delete-group').addEventListener('click', () => {
            this.closeMenu();
            ui.showDeleteParentModal();
        });

        document.getElementById('menu-export').addEventListener('click', () => {
            this.closeMenu();
            ui.exportData();
        });

        document.getElementById('menu-import').addEventListener('click', () => {
            this.closeMenu();
            ui.importData();
        });

        document.getElementById('menu-install').addEventListener('click', () => {
            this.closeMenu();
            this.installApp();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('menu-dropdown');
            const menuBtn = document.getElementById('menu-btn');
            if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
                this.closeMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC to close modals or go back
            if (e.key === 'Escape') {
                ui.closeEntryModal();
                ui.closeDeleteModal();
                ui.closeParentModal();
                ui.closeDeleteParentModal();
                ui.closeCategoryModal();
                this.closeMenu();

                // Go back to groups view if in entries view
                if (ui.currentView === 'entries') {
                    ui.showGroupsView();
                }
            }

            // Ctrl/Cmd + N to add new entry (if in entries view) or group (if in groups view)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (ui.currentView === 'entries' && ui.currentGroupId) {
                    ui.showEntryModal();
                } else if (ui.currentView === 'groups') {
                    ui.showParentModal();
                }
            }
        });
    }

    /**
     * Toggle menu dropdown
     */
    toggleMenu() {
        const menu = document.getElementById('menu-dropdown');
        menu.classList.toggle('active');

        // Update install button visibility
        const installBtn = document.getElementById('menu-install');
        if (this.deferredPrompt && !this.isInstalled) {
            installBtn.style.display = 'flex';
        } else {
            installBtn.style.display = 'none';
        }
    }

    /**
     * Close menu dropdown
     */
    closeMenu() {
        const menu = document.getElementById('menu-dropdown');
        menu.classList.remove('active');
    }

    /**
     * Set up install prompt for PWA
     */
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('Install prompt available');
        });

        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            ui.showToast('App installed successfully! 🎉', 'success');
        });

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
        }
    }

    /**
     * Trigger PWA install prompt
     */
    async installApp() {
        if (!this.deferredPrompt) {
            ui.showToast('App is already installed or cannot be installed', 'info');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }

        this.deferredPrompt = null;
    }

    /**
     * Show loading screen
     */
    showLoading() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'flex';
        }
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.innerHTML = `
        <div style="text-align: center; color: #f44336;">
          <h2>Error</h2>
          <p>${message}</p>
        </div>
      `;
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new ExpenseApp();
        app.init();
    });
} else {
    const app = new ExpenseApp();
    app.init();
}
