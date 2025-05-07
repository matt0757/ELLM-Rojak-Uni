// server.js - Main entry point for the backend server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/healthcare-platform', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
// User registration
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, type } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User with this email already exists' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            type
        });
        
        await newUser.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'User registered successfully' 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password, type } = req.body;
        
        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'User not found. Please register.' 
            });
        }
        
        // Check if user type matches
        if (user.type !== type) {
            return res.status(400).json({ 
                success: false, 
                message: `This email is registered as a ${user.type}, not a ${type}.` 
            });
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ 
                success: false, 
                message: 'Incorrect password' 
            });
        }
        
        // Send user data (except password)
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            type: user.type
        };
        
        res.json({ 
            success: true, 
            message: 'Login successful',
            user: userData
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// Get user profile
app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error while fetching user' 
        });
    }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));