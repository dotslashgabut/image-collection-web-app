// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises'); // For file system operations
const path = require('path');
const multer = require('multer'); // For handling file uploads

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'public/uploads'); // Store uploads in public

// Ensure uploads directory exists
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

// --- Multer Setup ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR); // Save files to public/uploads/
    },
    filename: function (req, file, cb) {
        // Create a unique filename (e.g., timestamp-originalName)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Middleware ---
app.use(cors()); // Allow requests from your frontend domain
app.use(express.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (HTML, CSS, JS, images)

// --- API Routes ---

// GET all items
app.get('/api/items', async (req, res) => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        res.json(JSON.parse(data).items || []);
    } catch (err) {
        console.error("Error reading data file:", err);
        if (err.code === 'ENOENT') { // File not found
            return res.json([]); // Return empty array if file doesn't exist yet
        }
        res.status(500).json({ message: "Error loading items" });
    }
});

// POST a new item (with image upload)
// 'itemImage' must match the name attribute of your file input in FormData
app.post('/api/items', upload.single('itemImage'), async (req, res) => {
    try {
        const rawData = await fs.readFile(DATA_FILE, 'utf-8').catch(err => {
             if (err.code === 'ENOENT') return '{"items":[]}'; // Default if file missing
             throw err;
        });
        const data = JSON.parse(rawData);
        if (!data.items) data.items = []; // Ensure items array exists

        if (!req.file) {
            return res.status(400).json({ message: "Image file is required" });
        }

        const newItem = {
            id: Date.now(), // Simple unique ID
            title: req.body.title || 'Untitled',
            description: req.body.description || '',
            tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : [],
            // IMPORTANT: Store the relative path to the image
            imageUrl: `/uploads/${req.file.filename}`
        };

        data.items.push(newItem);
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2)); // Pretty print JSON
        res.status(201).json(newItem); // Send back the created item

    } catch (err) {
        console.error("Error adding item:", err);
        res.status(500).json({ message: "Error adding item" });
    }
});

// DELETE an item
app.delete('/api/items/:id', async (req, res) => {
     try {
        const itemId = parseInt(req.params.id);
        const rawData = await fs.readFile(DATA_FILE, 'utf-8');
        const data = JSON.parse(rawData);

        const itemIndex = data.items.findIndex(item => item.id === itemId);

        if (itemIndex === -1) {
             return res.status(404).json({ message: 'Item not found' });
        }

        // --- Optional: Delete the associated image file ---
        const itemToDelete = data.items[itemIndex];
        if (itemToDelete.imageUrl) {
             const imagePath = path.join(__dirname, 'public', itemToDelete.imageUrl);
             fs.unlink(imagePath).catch(err => {
                 console.warn(`Could not delete image file ${imagePath}:`, err.message);
                 // Don't stop the item deletion process if image deletion fails
             });
        }
        // --- End Optional ---


        data.items.splice(itemIndex, 1); // Remove item from array

        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        res.status(200).json({ message: 'Item deleted successfully' });

    } catch (err) {
        console.error("Error deleting item:", err);
        if (err.code === 'ENOENT') {
             return res.status(404).json({ message: 'Item not found (data file missing)' });
        }
        res.status(500).json({ message: "Error deleting item" });
    }
});

// PUT (update) an item (more complex: handle optional image update)
app.put('/api/items/:id', upload.single('itemImage'), async (req, res) => {
     try {
        const itemId = parseInt(req.params.id);
        const rawData = await fs.readFile(DATA_FILE, 'utf-8');
        const data = JSON.parse(rawData);

        const itemIndex = data.items.findIndex(item => item.id === itemId);

        if (itemIndex === -1) {
             // If file was uploaded but item not found, delete the orphaned upload
             if(req.file) fs.unlink(req.file.path).catch(console.error);
             return res.status(404).json({ message: 'Item not found' });
        }

        const existingItem = data.items[itemIndex];
        let oldImagePath = null;
        let newImageUrl = existingItem.imageUrl; // Keep old image by default

        // If a new image was uploaded
        if (req.file) {
            newImageUrl = `/uploads/${req.file.filename}`; // Set new path
            oldImagePath = path.join(__dirname, 'public', existingItem.imageUrl); // Path to the old image
        }

        // Update item data
         const updatedItem = {
             ...existingItem, // Keep existing ID and potentially other fields
             title: req.body.title !== undefined ? req.body.title : existingItem.title,
             description: req.body.description !== undefined ? req.body.description : existingItem.description,
             tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : existingItem.tags,
             imageUrl: newImageUrl
         };

         data.items[itemIndex] = updatedItem; // Replace item in array

        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));

        // If a new image was uploaded, delete the old one *after* saving the JSON
        if (oldImagePath) {
            fs.unlink(oldImagePath).catch(err => {
                console.warn(`Could not delete old image file ${oldImagePath}:`, err.message);
            });
        }

        res.status(200).json(updatedItem); // Send back the updated item

    } catch (err) {
        console.error("Error updating item:", err);
         // If file was potentially uploaded during error, try to clean up
        if(req.file) fs.unlink(req.file.path).catch(console.error);
        if (err.code === 'ENOENT') {
             return res.status(404).json({ message: 'Item not found (data file missing)' });
        }
        res.status(500).json({ message: "Error updating item" });
    }
});


// --- Catch-all for serving index.html (for SPA routing if needed) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, 'public')}`);
    console.log(`Using data file: ${DATA_FILE}`);
    console.log(`Uploading images to: ${UPLOADS_DIR}`);
});