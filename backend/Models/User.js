// models/User.js - MongoDB schema for user data
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['patient', 'clinician'],
        required: true
    },
    // Additional fields that can be expanded later
    profile: {
        address: String,
        phone: String,
        dateOfBirth: Date,
        gender: String,
        profileImage: String
    },
    // For patients
    medicalHistory: {
        conditions: [String],
        allergies: [String],
        medications: [String],
        surgeries: [{
            procedure: String,
            date: Date,
            notes: String
        }]
    },
    // For clinicians
    professionalInfo: {
        specialty: String,
        licenseNumber: String,
        experience: Number,
        education: [String],
        availability: [{
            day: String,
            startTime: String,
            endTime: String
        }]
    },
    appointments: [{
        fullname: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            required: true
        },
        time: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['scheduled', 'completed', 'cancelled', 'in-progress'],
            default: 'scheduled'
        },
        symptoms: String,
        urgencyLevel: {
            type: String,
            enum: ['routine', 'soon', 'urgent'],
            default: 'routine'
        },
        hospital: {
            type: String,
            required: true
        },
        notes: {
            type: String,
            default: ''
        },
        clinicianId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false  // Changed to false since it's assigned later
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);