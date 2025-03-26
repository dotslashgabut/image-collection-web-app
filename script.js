document.addEventListener('DOMContentLoaded', () => {
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
    const placeholderText = imageGrid.querySelector('.placeholder-text');

    // --- State ---
    let items = []; // Array to hold all image item objects
    let activeTags = new Set(); // Set to hold currently selected filter tags
    let currentImagePreviewUrl = null; // To store Data URL for the form

    // --- Functions ---

    // Load items from Local Storage
    const loadItems = () => {
        const storedItems = localStorage.getItem('imageCollectionItems');
        if (storedItems) {
            items = JSON.parse(storedItems);
        } else {
            items = []; // Initialize with empty array if nothing is stored
        }
        if (items.length > 0 && placeholderText) {
            placeholderText.style.display = 'none';
        } else if (placeholderText) {
             placeholderText.style.display = 'block';
        }
    };

    // Save items to Local Storage
    const saveItems = () => {
        try {
            localStorage.setItem('imageCollectionItems', JSON.stringify(items));
            if (items.length > 0 && placeholderText) {
                 placeholderText.style.display = 'none';
            } else if (placeholderText) {
                placeholderText.style.display = 'block';
            }
        } catch (e) {
            console.error("Error saving to localStorage:", e);
            alert("Could not save data. LocalStorage might be full or disabled.");
        }
    };

    // Render all unique tags in the sidebar
    const renderTags = () => {
        const allTags = new Set();
        items.forEach(item => {
            item.tags.forEach(tag => allTags.add(tag.trim()));
        });

        tagList.innerHTML = ''; // Clear existing tags

        // Sort tags alphabetically
        const sortedTags = Array.from(allTags).sort((a, b) => a.localeCompare(b));

        if (sortedTags.length === 0) {
             const li = document.createElement('li');
             li.textContent = 'No tags yet.';
             li.style.color = 'var(--on-surface-secondary)';
             li.style.fontSize = '0.85rem';
             tagList.appendChild(li);
             return;
        }


        sortedTags.forEach(tag => {
            if (!tag) return; // Skip empty tags
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

        gridItem.dataset.id = item.id; // Store ID for deletion
        img.src = item.imageUrl;
        img.alt = item.title;
        title.textContent = item.title;
        description.textContent = item.description || ''; // Handle empty description

        // Add tags
        tagsContainer.innerHTML = ''; // Clear any template tags
        item.tags.forEach(tag => {
            if (!tag) return;
            const tagSpan = document.createElement('span');
            tagSpan.textContent = tag.trim();
            tagsContainer.appendChild(tagSpan);
        });

        // Add delete listener
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering other clicks on the item
            if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
                deleteItem(item.id);
            }
        });

        return gridItem;
    };

    // Render items in the grid (can be filtered)
    const renderItems = (itemsToRender = items) => {
        // Clear grid but preserve placeholder if it exists
        const currentPlaceholder = imageGrid.querySelector('.placeholder-text');
        imageGrid.innerHTML = '';
        if (currentPlaceholder) {
            imageGrid.appendChild(currentPlaceholder); // Put placeholder back initially
        }

        if (itemsToRender.length === 0) {
            if (currentPlaceholder) {
                 currentPlaceholder.style.display = 'block'; // Show placeholder if no items
            }
            // Add placeholder dynamically if it wasn't there initially
            else if (!imageGrid.querySelector('.placeholder-text')) {
                const newPlaceholder = document.createElement('p');
                newPlaceholder.className = 'placeholder-text';
                newPlaceholder.textContent = (items.length === 0)
                    ? 'Your collection is empty. Add some items!'
                    : 'No items match your search or filter.';
                 imageGrid.appendChild(newPlaceholder);
            }
        } else {
             if (currentPlaceholder) {
                currentPlaceholder.style.display = 'none'; // Hide placeholder if there are items
            }
            itemsToRender.forEach((item, index) => {
                const itemElement = createItemElement(item);
                // Apply staggered animation delay dynamically
                itemElement.style.animationDelay = `${index * 0.05}s`;
                imageGrid.appendChild(itemElement);
            });
        }


    };

    // Filter items based on search term and active tags
    const filterItems = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();

        const filtered = items.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(searchTerm);
            const descriptionMatch = item.description.toLowerCase().includes(searchTerm);
            const searchMatch = searchTerm === '' || titleMatch || descriptionMatch;

            // If no tags are active, tagMatch is true. Otherwise, check if *all* active tags are present.
            // Use .some() if you want to match items containing *any* of the active tags.
            const tagMatch = activeTags.size === 0 || Array.from(activeTags).every(activeTag =>
                item.tags.some(itemTag => itemTag.trim().toLowerCase() === activeTag.toLowerCase())
            );

            return searchMatch && tagMatch;
        });

        renderItems(filtered);
    };


    // Add a new item
    const addItem = (itemData) => {
        items.push(itemData);
        saveItems();
        renderItems();
        renderTags(); // Update tags list
    };

    // Delete an item
    const deleteItem = (id) => {
        items = items.filter(item => item.id !== id);
        saveItems();
        filterItems(); // Re-render based on current filters
        renderTags(); // Update tags as one might have been removed
    };

    // Handle image file selection in the modal
    const handleImagePreview = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentImagePreviewUrl = e.target.result; // Store Data URL
                modalPreviewImage.src = currentImagePreviewUrl;
                modalPreviewImage.style.display = 'block';
                previewPlaceholder.style.display = 'none';
            };
            reader.onerror = (e) => {
                 console.error("File reading error:", e);
                 alert("Error reading file.");
                 resetModalPreview();
            };
            reader.readAsDataURL(file); // Read file as Data URL
        } else {
            resetModalPreview();
        }
    };

    // Reset modal image preview
    const resetModalPreview = () => {
        currentImagePreviewUrl = null;
        modalPreviewImage.src = '#';
        modalPreviewImage.style.display = 'none';
        previewPlaceholder.style.display = 'block';
         // Also clear the file input visually for better UX (optional)
        // itemImageInput.value = ''; // This can be tricky across browsers
    }

    // Show the add item modal
    const showModal = () => {
        addItemForm.reset(); // Clear form fields
        resetModalPreview();
        modal.classList.add('show');
        // Autofocus first field
        itemImageInput.focus();
    };

    // Hide the add item modal
    const hideModal = () => {
        modal.classList.remove('show');
    };

    // --- Event Listeners ---

    // Add Item Button
    addItemBtn.addEventListener('click', showModal);

    // Close Modal Button
    closeModalBtn.addEventListener('click', hideModal);

    // Close Modal on outside click
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Check if click is on the background overlay
            hideModal();
        }
    });

    // Close Modal with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('show')) {
            hideModal();
        }
    });


    // Image file input change
    itemImageInput.addEventListener('change', handleImagePreview);

    // Add Item Form Submission
    addItemForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent page reload

        if (!currentImagePreviewUrl) {
            alert("Please select an image file.");
            return;
        }

        const newItem = {
            id: Date.now(), // Simple unique ID
            imageUrl: currentImagePreviewUrl,
            title: itemTitleInput.value.trim(),
            description: itemDescriptionInput.value.trim(),
            tags: itemTagsInput.value.split(',') // Split tags by comma
                       .map(tag => tag.trim()) // Trim whitespace
                       .filter(tag => tag !== '') // Remove empty tags
        };

        addItem(newItem);
        hideModal();
    });

    // Search Input
    searchInput.addEventListener('input', () => {
        // Simple debounce: wait 300ms after typing stops
        clearTimeout(searchInput.timer);
        searchInput.timer = setTimeout(filterItems, 300);
    });

    // Tag List Click (Event Delegation)
    tagList.addEventListener('click', (event) => {
        if (event.target.tagName === 'SPAN') {
            const tag = event.target.dataset.tag;
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
                event.target.classList.remove('active');
            } else {
                activeTags.add(tag);
                event.target.classList.add('active');
            }
            filterItems(); // Re-filter items based on new active tags
        }
    });

    // --- Initial Load ---
    loadItems();
    renderItems();
    renderTags();
});