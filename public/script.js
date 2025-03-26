document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_BASE_URL = 'http://localhost:3000/api'; // ADJUST TO YOUR SERVER ADDRESS/PORT

    // --- DOM Elements ---
    const imageGrid = document.getElementById('imageGrid');
    const searchInput = document.getElementById('searchInput');
    const tagList = document.getElementById('tagList');
    const addItemBtn = document.getElementById('addItemBtn');
    const modal = document.getElementById('addItemModal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const addItemForm = document.getElementById('addItemForm');
    const itemImageInput = document.getElementById('itemImage');
    const modalPreviewImage = document.getElementById('modalPreviewImage');
    const previewPlaceholder = document.getElementById('previewPlaceholder');
    const itemTitleInput = document.getElementById('itemTitle');
    const itemDescriptionInput = document.getElementById('itemDescription');
    const itemTagsInput = document.getElementById('itemTags');
    const itemTemplate = document.getElementById('itemTemplate');
    const placeholderText = imageGrid.querySelector('.placeholder-text'); // Get the initial placeholder
    const modalTitle = document.getElementById('modalTitle');
    const modalSubmitBtn = document.getElementById('modalSubmitBtn');
    const editItemIdInput = document.getElementById('editItemId'); // Hidden input for edit ID

    // --- State ---
    let items = []; // Array to hold image item objects fetched from server
    let activeTags = new Set(); // Set to hold currently selected filter tags
    let currentImagePreviewUrl = null; // Stores Data URL ONLY if a NEW file is selected in the modal for preview
    let originalImageUrl = null; // Stores the original URL when editing (used if no new image selected)

    // --- Functions ---

    // Load items from SERVER
    const loadItems = async () => {
        console.log("Attempting to load items from server...");
        try {
            const response = await fetch(`${API_BASE_URL}/items`);
            if (!response.ok) {
                // Try to get error message from server response body
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg += ` - ${errorData.message || 'Unknown server error'}`;
                } catch (e) { /* Ignore if response body isn't valid JSON */ }
                throw new Error(errorMsg);
            }
            items = await response.json(); // Assign fetched items directly
            console.log("Items loaded successfully:", items.length);
            updatePlaceholderVisibility(); // Update placeholder based on fetched items
            renderItems(); // Re-render grid with fetched items
            renderTags();  // Re-render tags based on fetched items
        } catch (error) {
            console.error("Error loading items from server:", error);
            alert(`Could not load image collection: ${error.message}. Please ensure the backend server is running and accessible.`);
            items = []; // Reset items on error
            updatePlaceholderVisibility();
            renderItems(); // Render empty state
            renderTags();
        }
    };

    // No need for saveItems() - server handles persistence

    // Update placeholder visibility based on the main items array
    const updatePlaceholderVisibility = () => {
         if (placeholderText) {
            placeholderText.style.display = items.length === 0 ? 'block' : 'none';
            if (items.length === 0) {
                placeholderText.textContent = 'Your collection is empty. Add some items!';
            }
         }
    }

    // Update placeholder visibility and text based on filtered results
    const updateFilteredPlaceholderVisibility = (filteredItemCount) => {
         if (placeholderText) {
             if (items.length === 0) { // Master list is empty
                 placeholderText.textContent = 'Your collection is empty. Add some items!';
                 placeholderText.style.display = 'block';
             } else if (filteredItemCount === 0) { // Filter results are empty
                 placeholderText.textContent = 'No items match your search or filter.';
                 placeholderText.style.display = 'block';
             } else { // Items are being displayed
                 placeholderText.style.display = 'none';
             }
         }
    }

    // Render all unique tags in the sidebar (from the current 'items' array)
    const renderTags = () => {
        const allTags = new Set();
        items.forEach(item => {
           if(item.tags && Array.isArray(item.tags)) { // Defensive check
               item.tags.forEach(tag => allTags.add(tag.trim()));
           }
        });

        tagList.innerHTML = ''; // Clear existing tags
        const sortedTags = Array.from(allTags).sort((a, b) => a.localeCompare(b));

        if (sortedTags.length === 0) {
             const li = document.createElement('li');
             li.textContent = 'No tags yet.';
             li.style.color = 'var(--on-surface-secondary)';
             li.style.fontSize = '0.85rem';
             li.style.width = '100%';
             tagList.appendChild(li);
             return;
        }

        sortedTags.forEach(tag => {
            if (!tag) return;
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = tag;
            span.dataset.tag = tag;
            if (activeTags.has(tag)) {
                span.classList.add('active');
            }
            li.appendChild(span);
            tagList.appendChild(li);
        });
    };

    // Create a DOM element for a single grid item
    const createItemElement = (item) => {
        const templateContent = itemTemplate.content.cloneNode(true);
        const gridItem = templateContent.querySelector('.grid-item');
        const img = templateContent.querySelector('.image-preview img');
        const title = templateContent.querySelector('.item-title');
        const description = templateContent.querySelector('.item-description');
        const tagsContainer = templateContent.querySelector('.item-tags');
        const deleteBtn = templateContent.querySelector('.delete-btn');
        const editBtn = templateContent.querySelector('.edit-btn');

        gridItem.dataset.id = item.id;
        // IMPORTANT: Use the image URL provided by the server.
        // Assumes server provides correct relative or absolute path.
        img.src = item.imageUrl;
        img.alt = item.title;
        title.textContent = item.title;
        description.textContent = item.description || '';

        tagsContainer.innerHTML = '';
        if(item.tags && Array.isArray(item.tags)) { // Defensive check
            item.tags.forEach(tag => {
                if (!tag) return;
                const tagSpan = document.createElement('span');
                tagSpan.textContent = tag.trim();
                tagsContainer.appendChild(tagSpan);
            });
        }

        // Delete listener (now calls async deleteItem)
        deleteBtn.addEventListener('click', async (e) => { // Added async
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
                await deleteItem(item.id); // Call async version
            }
        });

        // Edit listener (opens modal, no change here)
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(item.id);
        });

        return gridItem;
    };

    // Render items in the grid (using the current 'items' array)
    const renderItems = (itemsToRender = items) => {
        // Clear only the items, keep the placeholder
        Array.from(imageGrid.children).forEach(child => {
            if (!child.classList.contains('placeholder-text')) {
                imageGrid.removeChild(child);
            }
        });

        updateFilteredPlaceholderVisibility(itemsToRender.length); // Update placeholder based on filtered count

        if (itemsToRender.length > 0) {
            itemsToRender.forEach((item, index) => {
                const itemElement = createItemElement(item);
                itemElement.style.animationDelay = `${index * 0.05}s`;
                if (placeholderText) {
                    imageGrid.insertBefore(itemElement, placeholderText);
                } else {
                    imageGrid.appendChild(itemElement);
                }
            });
        }
    };


    // Filter items based on search term and active tags (client-side filtering)
    const filterItems = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        const filtered = items.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(searchTerm);
            const descriptionMatch = (item.description || '').toLowerCase().includes(searchTerm); // Handle missing description
            const searchMatch = searchTerm === '' || titleMatch || descriptionMatch;

            const itemTagsLower = (item.tags || []).map(t => t.trim().toLowerCase()); // Handle missing tags
            const tagMatch = activeTags.size === 0 || Array.from(activeTags).every(activeTag =>
                itemTagsLower.includes(activeTag.toLowerCase())
            );

            return searchMatch && tagMatch;
        });

        renderItems(filtered); // Render only the filtered items
    };

    // Delete an item by sending request to SERVER
    const deleteItem = async (id) => {
        console.log(`Attempting to delete item ${id}...`);
        try {
            const response = await fetch(`${API_BASE_URL}/items/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg += ` - ${errorData.message || 'Unknown server error'}`;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            console.log(`Item ${id} deleted successfully on server.`);
            // Reload data from server after successful deletion to refresh the list
            await loadItems();

        } catch (error) {
             console.error("Error deleting item:", error);
             alert(`Failed to delete item: ${error.message}`);
             // Optionally reload items even on failure to sync state
             // await loadItems();
        }
    };

    // Handle image file selection in the modal (for preview) - NO CHANGE NEEDED
    const handleImagePreview = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentImagePreviewUrl = e.target.result; // Store Data URL for preview
                modalPreviewImage.src = currentImagePreviewUrl;
                modalPreviewImage.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            };
             reader.onerror = (e) => {
                 console.error("File reading error:", e);
                 alert("Error reading file for preview.");
            };
            reader.readAsDataURL(file);
        }
        // If no valid file, preview doesn't update, currentImagePreviewUrl remains null/previous
    };

    // Reset modal image preview area AND associated state variables - NO CHANGE NEEDED
    const resetModalPreview = () => {
        currentImagePreviewUrl = null;
        originalImageUrl = null;
        modalPreviewImage.src = '#';
        modalPreviewImage.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        itemImageInput.value = '';
    }

    // Reset the modal to its default "Add New Item" state - NO CHANGE NEEDED
    const resetModalToDefault = () => {
        addItemForm.reset();
        resetModalPreview();
        editItemIdInput.value = '';
        modalTitle.textContent = 'Add New Image Item';
        modalSubmitBtn.textContent = 'Add Item';
        itemImageInput.required = true;
        modal.classList.remove('editing');
    };

    // Show the modal in "Add New Item" mode - NO CHANGE NEEDED
    const showModal = () => {
        resetModalToDefault();
        modal.classList.add('show');
        itemTitleInput.focus();
    };

    // Open the modal pre-filled for editing an existing item - Minor image path change
    const openEditModal = (id) => {
        const itemToEdit = items.find(item => item.id === id);
        if (!itemToEdit) {
            console.error(`Item with ID ${id} not found.`);
            return;
        }

        resetModalToDefault();

        editItemIdInput.value = id;
        modalTitle.textContent = 'Edit Image Item';
        modalSubmitBtn.textContent = 'Save Changes';
        itemImageInput.required = false; // Image optional when editing
        modal.classList.add('editing');

        itemTitleInput.value = itemToEdit.title;
        itemDescriptionInput.value = itemToEdit.description;
        itemTagsInput.value = (itemToEdit.tags || []).join(', '); // Handle missing tags

        // Use the server-provided image URL for the initial preview
        originalImageUrl = itemToEdit.imageUrl; // Store original path
        modalPreviewImage.src = itemToEdit.imageUrl; // Display current image
        modalPreviewImage.style.display = 'block';
        previewPlaceholder.style.display = 'none';
        // currentImagePreviewUrl remains null until a *new* file is selected

        modal.classList.add('show');
        itemTitleInput.focus();
    };


    // Hide the modal - NO CHANGE NEEDED
    const hideModal = () => {
        modal.classList.remove('show');
    };

    // --- Event Listeners ---

    // Add Item Button -> opens modal in add mode - NO CHANGE NEEDED
    addItemBtn.addEventListener('click', showModal);

    // Modal Close Button (the 'x') - NO CHANGE NEEDED
    closeModalBtn.addEventListener('click', hideModal);

    // Click outside the modal content to close - NO CHANGE NEEDED
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal();
        }
    });

    // Press Escape key to close the modal - NO CHANGE NEEDED
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('show')) {
            hideModal();
        }
    });

    // Update preview when a file is selected - NO CHANGE NEEDED
    itemImageInput.addEventListener('change', handleImagePreview);

    // Handle Form Submission (Add or Edit) - MAJOR CHANGES
    addItemForm.addEventListener('submit', async (event) => { // Make async
        event.preventDefault();
        modalSubmitBtn.disabled = true; // Disable button during submission
        modalSubmitBtn.textContent = 'Saving...';

        const editingId = parseInt(editItemIdInput.value);
        const isEditing = !isNaN(editingId);

        // --- Use FormData for potential file upload ---
        const formData = new FormData();
        formData.append('title', itemTitleInput.value.trim());
        formData.append('description', itemDescriptionInput.value.trim());
        // Send tags as comma-separated string, server should parse
        formData.append('tags', itemTagsInput.value.trim());

        const imageFile = itemImageInput.files[0];

        // Append image file ONLY if a file was actually selected by the user
        if (imageFile) {
            formData.append('itemImage', imageFile); // Key MUST match server's multer field name
        } else if (!isEditing) {
            // Image is required only when adding a new item
            alert("Please select an image file to add a new item.");
            modalSubmitBtn.disabled = false;
            modalSubmitBtn.textContent = isEditing ? 'Save Changes' : 'Add Item';
            itemImageInput.focus();
            return; // Stop submission
        }
        // If editing and no new file selected, don't append 'itemImage', server keeps old one

        try {
            let response;
            let url = `${API_BASE_URL}/items`;
            let method = 'POST';

            if (isEditing) {
                url += `/${editingId}`;
                method = 'PUT';
            }

            console.log(`Sending ${method} request to ${url}`);
            // Log FormData contents (for debugging, might not show file details)
            // for (let [key, value] of formData.entries()) {
            //     console.log(`${key}:`, value);
            // }

            response = await fetch(url, {
                method: method,
                body: formData, // Send FormData object
                // NO 'Content-Type' header - browser sets it correctly for FormData
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg += ` - ${errorData.message || 'Unknown server error'}`;
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            console.log(`Item ${isEditing ? 'updated' : 'added'} successfully on server.`);

            // --- Post-Action Tasks ---
            hideModal();
            // RELOAD data from server to ensure UI reflects the latest state
            await loadItems(); // This triggers re-render and tag update

        } catch (error) {
            console.error(`Error ${isEditing ? 'updating' : 'adding'} item:`, error);
            alert(`Failed to ${isEditing ? 'update' : 'add'} item: ${error.message}`);
        } finally {
             // Re-enable button regardless of success/failure
            modalSubmitBtn.disabled = false;
            // Reset button text based on original mode (needed if staying in modal on error)
            resetModalToDefault(); // Reset completely hides modal, maybe just reset button text?
            // Let's just reset button text for now in case modal isn't hidden on error
            modalSubmitBtn.textContent = isEditing ? 'Save Changes' : 'Add Item';
             // Consider if modal should remain open on error for correction - current logic hides it
             // If keeping open on error, call resetModalToDefault() inside hideModal() instead.
        }
    });

    // Search Input - filter items with debounce - NO CHANGE NEEDED
    searchInput.addEventListener('input', () => {
        clearTimeout(searchInput.timer);
        searchInput.timer = setTimeout(filterItems, 300);
    });

    // Tag List Click (using Event Delegation) - NO CHANGE NEEDED
    tagList.addEventListener('click', (event) => {
        if (event.target.tagName === 'SPAN' && event.target.dataset.tag) {
            const tag = event.target.dataset.tag;
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
                event.target.classList.remove('active');
            } else {
                activeTags.add(tag);
                event.target.classList.add('active');
            }
            filterItems(); // Re-filter items based on the updated active tags
        }
    });

    // --- Initial Load ---
    loadItems(); // Load data from server when the page loads
    // renderItems() and renderTags() are now called within loadItems after fetch

});