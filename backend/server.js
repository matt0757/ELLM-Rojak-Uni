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
// Add email check endpoint
app.post('/api/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Checking email:', email);
        
        const user = await User.findOne({ email });
        console.log('User found:', !!user);
        
        res.json({ exists: !!user });
    } catch (error) {
        console.error('Error checking email:', error);
        res.status(500).json({ 
            exists: false, 
            error: 'Server error checking email' 
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

// Add appointment endpoint
app.post('/api/appointments', async (req, res) => {
    try {
        const {
            fullname,
            email,
            phone,
            date,
            time,
            status,
            symptoms,
            urgencyLevel,
            hospital,
            notes
        } = req.body;

        // Find user by email to add appointment to their record
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email'
            });
        }

        // Create new appointment object
        const newAppointment = {
            fullname,
            email,
            phone,
            date,
            time,
            status: status || 'scheduled',
            symptoms,
            urgencyLevel: urgencyLevel || 'routine',
            hospital,
            notes: notes || '',
            clinicianId: null // Will be assigned later
        };

        // Add appointment to user's appointments array
        user.appointments.push(newAppointment);
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            appointment: newAppointment
        });

    } catch (error) {
        console.error('Appointment booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while booking appointment'
        });
    }
});

app.post('/api/appointments/by-date', async (req, res) => {
    try {
        const { clinicianId, date } = req.body;
        if (!clinicianId || !date) {
            return res.status(400).json({ success: false, message: 'clinicianId and date are required' });
        }

        // Create a Date object from the input date string
        const searchDate = new Date(date);

        // Set the time to the beginning of the day (00:00:00)
        searchDate.setUTCHours(0, 0, 0, 0);

        // Create a new Date object for the end of the day (23:59:59.999)
        const endOfDay = new Date(searchDate);
        endOfDay.setUTCHours(23, 59, 59, 999);


        // Find users who have appointments within the specified date range and clinicianId
        const users = await User.find({
            appointments: {
                $elemMatch: {
                    clinicianId: mongoose.Types.ObjectId(clinicianId),
                    date: {
                        $gte: searchDate,
                        $lte: endOfDay
                    }
                }
            }
        });

        // Collect matching appointments from the found users
        const appointments = [];
        users.forEach(user => {
            user.appointments.forEach(apt => {
                // Although $elemMatch should filter, double-check conditions for robustness
                // Ensure apt.date is treated as a Date object for comparison
                 const aptDate = apt.date instanceof Date ? apt.date : new Date(apt.date);

                if (
                    apt.clinicianId &&
                    apt.clinicianId.toString() === clinicianId.toString() &&
                    aptDate >= searchDate &&
                    aptDate <= endOfDay
                ) {
                    appointments.push({
                        ...apt._doc,
                        patient: user.name || user.fullname || user.email,
                        patientId: user._id, // Include patientId for fetching records
                        email: user.email // Include email for fetching records
                    });
                }
            });
        });


        res.json({ success: true, appointments });
    } catch (error) {
        console.error('Error fetching appointments by date:', error);
        res.status(500).json({ success: false, message: 'Server error fetching appointments' });
    }
});

// Analytics endpoint: Get analytics for a clinician
app.post('/api/analytics', async (req, res) => {
    try {
        const { clinicianId, timeframe } = req.body;
        if (!clinicianId) {
            return res.status(400).json({ success: false, message: 'clinicianId is required' });
        }

        // Find all users who have appointments with this clinician
        const users = await User.find({ 'appointments.clinicianId': mongoose.Types.ObjectId(clinicianId) });

        // Gather all appointments for this clinician
        let allAppointments = [];
        users.forEach(user => {
            user.appointments.forEach(apt => {
                if (apt.clinicianId && apt.clinicianId.toString() === clinicianId.toString()) {
                    allAppointments.push(apt);
                }
            });
        });

        // Filter by timeframe if provided
        let filteredAppointments = allAppointments;
        const now = new Date();
        if (timeframe === 'day') {
            const today = now.toISOString().slice(0, 10);
            filteredAppointments = allAppointments.filter(apt => {
                const aptDate = apt.date instanceof Date
                    ? apt.date.toISOString().slice(0, 10)
                    : apt.date.slice(0, 10);
                return aptDate === today;
            });
        } else if (timeframe === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(now.getDate() - 6);
            filteredAppointments = allAppointments.filter(apt => {
                const aptDate = new Date(apt.date);
                return aptDate >= weekAgo && aptDate <= now;
            });
        } else if (timeframe === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(now.getMonth() - 1);
            filteredAppointments = allAppointments.filter(apt => {
                const aptDate = new Date(apt.date);
                return aptDate >= monthAgo && aptDate <= now;
            });
        } // else: default is all time

        // Calculate analytics
        const patientsSet = new Set(filteredAppointments.map(apt => apt.email));
        const patients = patientsSet.size;

        // Calculate average consultation time if available
        // Assume apt.duration or apt.consultationTime in minutes, else use a default
        let totalMinutes = 0;
        let countWithTime = 0;
        filteredAppointments.forEach(apt => {
            if (apt.duration) {
                totalMinutes += Number(apt.duration);
                countWithTime++;
            }
        });
        const avgConsultation = countWithTime > 0
            ? `${Math.round(totalMinutes / countWithTime)} mins`
            : 'N/A';

        // Period label
        let period = '';
        if (timeframe === 'day') period = 'Today';
        else if (timeframe === 'week') period = 'This Week';
        else if (timeframe === 'month') period = 'This Month';
        else period = 'All Time';

        res.json({
            success: true,
            analytics: {
                patients,
                avgConsultation,
                period
            }
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ success: false, message: 'Server error fetching analytics' });
    }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));