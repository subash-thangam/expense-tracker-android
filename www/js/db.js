/**
 * Database Manager for Expense Tracker
 * Handles all IndexedDB operations
 */

class ExpenseDB {
  constructor() {
    this.dbName = 'ExpenseTrackerDB';
    this.version = 2; // Incremented for new categories store
    this.db = null;
  }

  /**
   * Initialize the database
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        this.db = request.result;

        // Seed predefined categories if database is new
        const categories = await this.getCategories();
        if (categories.length === 0) {
          await this.seedDefaultCategories();
        }

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create Parents store (Month/Year groups)
        if (!db.objectStoreNames.contains('parents')) {
          const parentStore = db.createObjectStore('parents', { keyPath: 'id' });
          parentStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create Entries store (Individual expenses)
        if (!db.objectStoreNames.contains('entries')) {
          const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
          entryStore.createIndex('parentId', 'parentId', { unique: false });
          entryStore.createIndex('date', 'date', { unique: false });
          entryStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create Categories store (Global categories)
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('name', 'name', { unique: true });
          categoryStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  // ==================== PARENT OPERATIONS ====================

  /**
   * Create a new parent (month/year group)
   */
  async createParent(name, monthYear = null) {
    const parent = {
      id: monthYear || this.generateMonthYearId(),
      name: name,
      createdAt: Date.now(),
      totalExpenses: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parents'], 'readwrite');
      const store = transaction.objectStore('parents');
      const request = store.add(parent);

      request.onsuccess = () => resolve(parent);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all parents sorted by creation date (newest first)
   */
  async getAllParents() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parents'], 'readonly');
      const store = transaction.objectStore('parents');
      const request = store.getAll();

      request.onsuccess = () => {
        const parents = request.result.sort((a, b) => b.createdAt - a.createdAt);
        resolve(parents);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single parent by ID
   */
  async getParent(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parents'], 'readonly');
      const store = transaction.objectStore('parents');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update parent total expenses
   */
  async updateParentTotal(parentId) {
    const entries = await this.getEntriesByParent(parentId);
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parents'], 'readwrite');
      const store = transaction.objectStore('parents');
      const getRequest = store.get(parentId);

      getRequest.onsuccess = () => {
        const parent = getRequest.result;
        if (parent) {
          parent.totalExpenses = total;
          const updateRequest = store.put(parent);
          updateRequest.onsuccess = () => resolve(parent);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Parent not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a parent and all its entries
   */
  async deleteParent(id) {
    // First delete all entries
    const entries = await this.getEntriesByParent(id);
    for (const entry of entries) {
      await this.deleteEntry(entry.id, false); // Don't update parent total
    }

    // Then delete the parent
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parents'], 'readwrite');
      const store = transaction.objectStore('parents');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== ENTRY OPERATIONS ====================

  /**
   * Create a new expense entry
   */
  async createEntry(parentId, description, amount, category = '', date = null) {
    const entry = {
      id: this.generateUUID(),
      parentId: parentId,
      description: description,
      amount: parseFloat(amount),
      category: category,
      date: date || Date.now(),
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      const request = store.add(entry);

      request.onsuccess = async () => {
        await this.updateParentTotal(parentId);
        resolve(entry);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all entries for a specific parent
   */
  async getEntriesByParent(parentId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      const index = store.index('parentId');
      const request = index.getAll(parentId);

      request.onsuccess = () => {
        const entries = request.result.sort((a, b) => b.date - a.date);
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a single entry by ID
   */
  async getEntry(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['entries'], 'readonly');
      const store = transaction.objectStore('entries');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update an existing entry
   */
  async updateEntry(id, updates) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      const getRequest = store.get(id);

      getRequest.onsuccess = async () => {
        const entry = getRequest.result;
        if (entry) {
          Object.assign(entry, updates);
          if (updates.amount !== undefined) {
            entry.amount = parseFloat(updates.amount);
          }

          const updateRequest = store.put(entry);
          updateRequest.onsuccess = async () => {
            await this.updateParentTotal(entry.parentId);
            resolve(entry);
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Entry not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id, updateTotal = true) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      const getRequest = store.get(id);

      getRequest.onsuccess = async () => {
        const entry = getRequest.result;
        if (entry) {
          const deleteRequest = store.delete(id);
          deleteRequest.onsuccess = async () => {
            if (updateTotal) {
              await this.updateParentTotal(entry.parentId);
            }
            resolve();
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          resolve(); // Entry doesn't exist, consider it deleted
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Duplicate an entry
   */
  async duplicateEntry(id) {
    const original = await this.getEntry(id);
    if (!original) {
      throw new Error('Entry not found');
    }

    const duplicate = {
      ...original,
      id: this.generateUUID(),
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      const request = store.add(duplicate);

      request.onsuccess = async () => {
        await this.updateParentTotal(duplicate.parentId);
        resolve(duplicate);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== CATEGORY OPERATIONS ====================

  /**
   * Seed default categories
   */
  async seedDefaultCategories() {
    const defaultCategories = [
      'Food',
      'Transport',
      'Shopping',
      'Bills & Utilities',
      'Entertainment',
      'Health & Medical',
      'Education',
      'Groceries',
      'Others'
    ];

    for (const name of defaultCategories) {
      try {
        await this.createCategory(name, true);
      } catch (error) {
        console.log(`Category ${name} already exists, skipping...`);
      }
    }
  }

  /**
   * Get all categories sorted alphabetically
   */
  async getCategories() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['categories'], 'readonly');
      const store = transaction.objectStore('categories');
      const request = store.getAll();

      request.onsuccess = () => {
        const categories = request.result.sort((a, b) => a.name.localeCompare(b.name));
        resolve(categories);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Create a new category
   */
  async createCategory(name, isDefault = false) {
    const category = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      isDefault: isDefault,
      createdAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['categories'], 'readwrite');
      const store = transaction.objectStore('categories');
      const request = store.add(category);

      request.onsuccess = () => resolve(category);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a category (only custom categories, not defaults)
   */
  async deleteCategory(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['categories'], 'readwrite');
      const store = transaction.objectStore('categories');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const category = getRequest.result;
        if (category && !category.isDefault) {
          const deleteRequest = store.delete(id);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
        } else {
          reject(new Error('Cannot delete default category'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate a month-year ID (YYYY-MM format)
   */
  generateMonthYearId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Generate a UUID for entries
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Export all data as JSON
   */
  async exportData() {
    const parents = await this.getAllParents();
    const categories = await this.getCategories();
    const allEntries = [];

    for (const parent of parents) {
      const entries = await this.getEntriesByParent(parent.id);
      allEntries.push(...entries);
    }

    return {
      parents: parents,
      entries: allEntries,
      categories: categories,
      exportDate: new Date().toISOString(),
      version: this.version
    };
  }

  /**
   * Import data from JSON
   */
  async importData(data) {
    // Clear existing data (except default categories)
    await this.clearAllData();

    // Import categories (if provided)
    if (data.categories) {
      for (const category of data.categories) {
        try {
          const transaction = this.db.transaction(['categories'], 'readwrite');
          const store = transaction.objectStore('categories');
          await new Promise((resolve, reject) => {
            const request = store.add(category);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve(); // Skip if already exists
          });
        } catch (error) {
          // Skip categories that already exist
        }
      }
    }

    // Import parents
    for (const parent of data.parents) {
      const transaction = this.db.transaction(['parents'], 'readwrite');
      const store = transaction.objectStore('parents');
      await new Promise((resolve, reject) => {
        const request = store.add(parent);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // Import entries
    for (const entry of data.entries) {
      const transaction = this.db.transaction(['entries'], 'readwrite');
      const store = transaction.objectStore('entries');
      await new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['parents', 'entries'], 'readwrite');

      const parentStore = transaction.objectStore('parents');
      const entryStore = transaction.objectStore('entries');

      parentStore.clear();
      entryStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export the database instance
const db = new ExpenseDB();
