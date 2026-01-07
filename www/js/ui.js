/**
 * UI Manager for Expense Tracker
 * Handles all rendering and user interactions with two-view navigation
 */

class ExpenseUI {
    constructor() {
        this.currentView = 'groups'; // 'groups' or 'entries'
        this.currentGroupId = null;
        this.editingEntryId = null;
    }

    /**
     * Initialize UI elements
     */
    init() {
        // Views
        this.groupsView = document.getElementById('groups-view');
        this.entriesView = document.getElementById('entries-view');

        // Groups view elements
        this.groupsList = document.getElementById('groups-list');
        this.emptyGroupsState = document.getElementById('empty-groups-state');

        // Entries view elements
        this.parentName = document.getElementById('parent-name');
        this.totalAmount = document.getElementById('total-amount');
        this.entriesList = document.getElementById('entries-list');
        this.emptyEntriesState = document.getElementById('empty-entries-state');

        // Buttons
        this.backBtn = document.getElementById('back-btn');
        this.fabBtn = document.getElementById('fab-btn');

        // Modals
        this.entryModal = document.getElementById('entry-modal');
        this.entryForm = document.getElementById('entry-form');
        this.categoryModal = document.getElementById('category-modal');
        this.categoryForm = document.getElementById('category-form');
        this.deleteModal = document.getElementById('delete-modal');
        this.parentModal = document.getElementById('parent-modal');
        this.deleteParentModal = document.getElementById('delete-parent-modal');
    }

    // ==================== NAVIGATION ====================

    /**
     * Show groups view (home page)
     */
    async showGroupsView() {
        this.currentView = 'groups';
        this.currentGroupId = null;

        // Update visibility
        this.groupsView.style.display = 'block';
        this.entriesView.style.display = 'none';
        this.backBtn.style.display = 'none';

        // Update menu
        document.getElementById('menu-delete-group').style.display = 'none';

        // Render groups
        await this.renderGroupsList();
    }

    /**
     * Show entries view for a specific group
     */
    async showEntriesView(groupId) {
        this.currentView = 'entries';
        this.currentGroupId = groupId;

        // Update visibility
        this.groupsView.style.display = 'none';
        this.entriesView.style.display = 'block';
        this.backBtn.style.display = 'flex';

        // Update menu
        document.getElementById('menu-delete-group').style.display = 'flex';

        // Render entries
        await this.renderEntries();
    }

    // ==================== GROUPS RENDERING ====================

    /**
     * Render all groups as cards
     */
    async renderGroupsList() {
        const groups = await db.getAllParents();

        this.groupsList.innerHTML = '';

        if (groups.length === 0) {
            this.emptyGroupsState.style.display = 'flex';
            this.groupsList.style.display = 'none';
            return;
        }

        this.emptyGroupsState.style.display = 'none';
        this.groupsList.style.display = 'grid';

        for (const group of groups) {
            const entries = await db.getEntriesByParent(group.id);
            const groupCard = this.createGroupCard(group, entries.length);
            this.groupsList.appendChild(groupCard);
        }
    }

    /**
     * Create a group card element
     */
    createGroupCard(group, entryCount) {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.onclick = () => this.showEntriesView(group.id);

        card.innerHTML = `
      <div class="group-card-header">
        <div class="group-card-icon">📅</div>
        <div class="group-card-info">
          <div class="group-card-name">${this.escapeHtml(group.name)}</div>
          <div class="group-card-meta">${entryCount} expense${entryCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="group-card-total">₹${this.formatNumber(group.totalExpenses)}</div>
    `;

        return card;
    }

    // ==================== ENTRIES RENDERING ====================

    /**
     * Render all entries for the current group
     */
    async renderEntries() {
        if (!this.currentGroupId) {
            await this.showGroupsView();
            return;
        }

        const group = await db.getParent(this.currentGroupId);
        const entries = await db.getEntriesByParent(this.currentGroupId);

        // Update header
        this.parentName.textContent = group.name;
        this.totalAmount.textContent = this.formatCurrency(group.totalExpenses);

        // Clear and render entries
        this.entriesList.innerHTML = '';

        if (entries.length === 0) {
            this.emptyEntriesState.style.display = 'flex';
            return;
        }

        this.emptyEntriesState.style.display = 'none';

        entries.forEach(entry => {
            const entryCard = this.createEntryCard(entry);
            this.entriesList.appendChild(entryCard);
        });
    }

    /**
     * Create an entry card element
     */
    createEntryCard(entry) {
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.dataset.id = entry.id;

        const date = new Date(entry.date);
        const formattedDate = date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });

        card.innerHTML = `
      <div class="entry-main" onclick="ui.editEntry('${entry.id}')">
        <div class="entry-info">
          <div class="entry-description">${this.escapeHtml(entry.description)}</div>
          <div class="entry-meta">
            <span class="entry-date">${formattedDate}</span>
            ${entry.category ? `<span class="entry-category">${this.escapeHtml(entry.category)}</span>` : ''}
          </div>
        </div>
        <div class="entry-amount">₹${this.formatNumber(entry.amount)}</div>
      </div>
      <div class="entry-actions">
        <button class="action-btn duplicate-btn" onclick="event.stopPropagation(); ui.duplicateEntry('${entry.id}')" title="Duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="action-btn delete-btn" onclick="event.stopPropagation(); ui.confirmDeleteEntry('${entry.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

        return card;
    }

    // ==================== CATEGORY MANAGEMENT ====================

    /**
     * Render category selector with all available categories
     */
    async renderCategorySelect() {
        const categories = await db.getCategories();
        const select = document.getElementById('entry-category');

        select.innerHTML = '<option value="">Select category...</option>';

        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name;
            option.textContent = category.name;
            select.appendChild(option);
        });
    }

    /**
     * Show modal to add new category
     */
    showAddCategoryModal() {
        this.categoryForm.reset();
        this.categoryModal.classList.add('active');
    }

    /**
     * Close category modal
     */
    closeCategoryModal() {
        this.categoryModal.classList.remove('active');
        this.categoryForm.reset();
    }

    /**
     * Submit new category
     */
    async submitCategory(event) {
        event.preventDefault();

        const name = document.getElementById('category-name-input').value.trim();

        if (!name) {
            this.showToast('Please enter a category name', 'error');
            return;
        }

        try {
            await db.createCategory(name, false);
            this.showToast('Category added successfully', 'success');
            this.closeCategoryModal();
            await this.renderCategorySelect();

            // Select the newly added category
            document.getElementById('entry-category').value = name;
        } catch (error) {
            console.error('Error creating category:', error);
            if (error.name === 'ConstraintError') {
                this.showToast('This category already exists', 'error');
            } else {
                this.showToast('Failed to add category', 'error');
            }
        }
    }

    // ==================== ENTRY OPERATIONS ====================

    /**
     * Show modal to create/edit entry
     */
    async showEntryModal(entryId = null) {
        this.editingEntryId = entryId;
        const modalTitle = document.getElementById('entry-modal-title');
        const submitBtn = document.getElementById('entry-submit-btn');

        // Populate category select
        await this.renderCategorySelect();

        if (entryId) {
            modalTitle.textContent = 'Edit Expense';
            submitBtn.textContent = 'Update';
            await this.loadEntryData(entryId);
        } else {
            modalTitle.textContent = 'Add Expense';
            submitBtn.textContent = 'Add';
            this.entryForm.reset();
            // Set today's date
            document.getElementById('entry-date').valueAsDate = new Date();
        }

        this.entryModal.classList.add('active');
    }

    /**
     * Load entry data into form
     */
    async loadEntryData(entryId) {
        const entry = await db.getEntry(entryId);
        if (entry) {
            document.getElementById('entry-description').value = entry.description;
            document.getElementById('entry-amount').value = entry.amount;
            document.getElementById('entry-category').value = entry.category || '';
            document.getElementById('entry-date').valueAsDate = new Date(entry.date);
        }
    }

    /**
     * Close entry modal
     */
    closeEntryModal() {
        this.entryModal.classList.remove('active');
        this.entryForm.reset();
        this.editingEntryId = null;
    }

    /**
     * Handle entry form submission
     */
    async submitEntry(event) {
        event.preventDefault();

        const description = document.getElementById('entry-description').value.trim();
        const amount = parseFloat(document.getElementById('entry-amount').value);
        const category = document.getElementById('entry-category').value;
        const date = new Date(document.getElementById('entry-date').value).getTime();

        if (!description || !amount || amount <= 0) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            if (this.editingEntryId) {
                await db.updateEntry(this.editingEntryId, { description, amount, category, date });
                this.showToast('Expense updated successfully', 'success');
            } else {
                await db.createEntry(this.currentGroupId, description, amount, category, date);
                this.showToast('Expense added successfully', 'success');
            }

            this.closeEntryModal();
            await this.renderEntries();
        } catch (error) {
            console.error('Error saving entry:', error);
            this.showToast('Failed to save expense', 'error');
        }
    }

    /**
     * Edit an entry
     */
    editEntry(entryId) {
        this.showEntryModal(entryId);
    }

    /**
     * Duplicate an entry
     */
    async duplicateEntry(entryId) {
        try {
            await db.duplicateEntry(entryId);
            this.showToast('Expense duplicated successfully', 'success');
            await this.renderEntries();
        } catch (error) {
            console.error('Error duplicating entry:', error);
            this.showToast('Failed to duplicate expense', 'error');
        }
    }

    /**
     * Show delete confirmation modal
     */
    confirmDeleteEntry(entryId) {
        this.deleteModal.classList.add('active');
        this.deleteModal.dataset.entryId = entryId;
    }

    /**
     * Delete an entry
     */
    async deleteEntry() {
        const entryId = this.deleteModal.dataset.entryId;
        try {
            await db.deleteEntry(entryId);
            this.showToast('Expense deleted successfully', 'success');
            this.closeDeleteModal();
            await this.renderEntries();
        } catch (error) {
            console.error('Error deleting entry:', error);
            this.showToast('Failed to delete expense', 'error');
        }
    }

    /**
     * Close delete modal
     */
    closeDeleteModal() {
        this.deleteModal.classList.remove('active');
    }

    // ==================== PARENT/GROUP OPERATIONS ====================

    /**
     * Show parent creation modal
     */
    showParentModal() {
        const form = document.getElementById('parent-form');
        form.reset();

        // Set default month/year to current
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('parent-month').value = `${year}-${month}`;

        this.parentModal.classList.add('active');
    }

    /**
     * Close parent modal
     */
    closeParentModal() {
        this.parentModal.classList.remove('active');
    }

    /**
     * Submit parent form
     */
    async submitParent(event) {
        event.preventDefault();

        const name = document.getElementById('parent-name-input').value.trim();
        const monthYear = document.getElementById('parent-month').value; // YYYY-MM format

        if (!name || !monthYear) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            await db.createParent(name, monthYear);
            this.showToast('Group created successfully', 'success');
            this.closeParentModal();
            await this.renderGroupsList();
        } catch (error) {
            console.error('Error creating parent:', error);
            if (error.name === 'ConstraintError') {
                this.showToast('A group for this month already exists', 'error');
            } else {
                this.showToast('Failed to create group', 'error');
            }
        }
    }

    /**
     * Show delete parent confirmation
     */
    showDeleteParentModal() {
        if (!this.currentGroupId) return;
        this.deleteParentModal.classList.add('active');
    }

    /**
     * Close delete parent modal
     */
    closeDeleteParentModal() {
        this.deleteParentModal.classList.remove('active');
    }

    /**
     * Delete current parent
     */
    async deleteCurrentParent() {
        try {
            await db.deleteParent(this.currentGroupId);
            this.showToast('Group deleted successfully', 'success');
            this.closeDeleteParentModal();
            await this.showGroupsView();
        } catch (error) {
            console.error('Error deleting parent:', error);
            this.showToast('Failed to delete group', 'error');
        }
    }

    // ==================== DATA OPERATIONS ====================

    /**
     * Export data as JSON file
     */
    async exportData() {
        try {
            const data = await db.exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('Failed to export data', 'error');
        }
    }

    /**
     * Import data from JSON file
     */
    async importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                if (!data.parents || !data.entries) {
                    throw new Error('Invalid data format');
                }

                await db.importData(data);
                this.showToast('Data imported successfully', 'success');

                // Refresh current view
                if (this.currentView === 'groups') {
                    await this.renderGroupsList();
                } else {
                    await this.showGroupsView();
                }
            } catch (error) {
                console.error('Error importing data:', error);
                this.showToast('Failed to import data. Please check the file format.', 'error');
            }
        };

        input.click();
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return '₹' + this.formatNumber(amount);
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export UI instance
const ui = new ExpenseUI();
