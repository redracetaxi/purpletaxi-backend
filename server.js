
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase environment variables are missing.");
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
     "https://purpletaxi-website.onrender.com",
    ...(process.env.FRONTEND_ORIGIN
        ? process.env.FRONTEND_ORIGIN.split(",").map(s => s.trim())
        : [])
];

app.use(helmet());

app.use(cors({
    origin(origin, callback) {
        // Allow requests without an Origin header for tools like curl.
        // CORS is not authentication; validation and rate limits still apply.
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Origin not allowed by CORS"));
    }
}));
app.options("*", cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Origin not allowed by CORS"));
    }
}));

app.use(express.json({ limit: "10kb" }));

app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false
}));

app.get("/", (req, res) => {
    res.json({ message: "Coimbatore Taxi API is running." });
});

app.post("/api/bookings", async (req, res) => {
    try {
        const {
            name,
            phone,
            pickup,
            drop,
            date,
            time
        } = req.body || {};

        const fields = [name, phone, pickup, drop, date, time];

        if (!fields.every(
            value => typeof value === "string" && value.trim()
        )) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all booking fields."
            });
        }

        const clean = value => value.trim();

        const booking = {
            customer_name: clean(name),
            phone: clean(phone),
            pickup: clean(pickup),
            drop_location: clean(drop),
            travel_date: clean(date),
            travel_time: clean(time)
        };

        if (booking.customer_name.length > 100 ||
            booking.phone.length > 20 ||
            booking.pickup.length > 250 ||
            booking.drop_location.length > 250 ||
            booking.travel_time.length > 30) {
            return res.status(400).json({
                success: false,
                message: "One or more fields are too long."
            });
        }

        if (!/^[0-9+\s()-]{7,20}$/.test(booking.phone)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid phone number."
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.travel_date)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid travel date."
            });
        }

        const selectedDate = new Date(
            `${booking.travel_date}T00:00:00Z`
        );

        if (Number.isNaN(selectedDate.getTime()) ||
            selectedDate.toISOString().slice(0, 10) !== booking.travel_date) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid travel date."
            });
        }
        
const todayInIndia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
}).format(new Date());

if (booking.travel_date < todayInIndia) {
    return res.status(400).json({
        success: false,
        message: "Travel date cannot be in the past."
    });
}


        const { data, error } = await supabase
            .from("bookings")
            .insert([booking])
            .select("id")
            .single();

        if (error) {
            console.error("Database insert failed:", error.message);
            console.error("Database error details:", error);
            return res.status(500).json({
                success: false,
                message: "Could not save the booking. Please try again."
            });
        }

        return res.status(201).json({
            success: true,
            bookingId: data.id,
            message: "Your reservation request has been received."
        });
    } catch (error) {
        console.error("Booking API error:", error.message);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred."
        });
    }
});

app.use((err, req, res, next) => {
    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "This website origin is not allowed."
        });
    }

    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request."
        });
    }

    console.error(err);
    return res.status(500).json({
        success: false,
        message: "Server error."
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Taxi API running on port ${PORT}`);
});
