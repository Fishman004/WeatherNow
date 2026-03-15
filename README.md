# WeatherNow

A full-stack weather web application with user authentication, personalized preferences, and live forecast data by zipcode.

🌐 **Live:** [weathernow-m2xt.onrender.com](https://weathernow-m2xt.onrender.com)

## Tech Stack
- Node.js / Express
- PostgreSQL (Supabase)
- EJS templating
- bcrypt
- express-session

## Features
- Live weather forecast by zipcode using the Tomorrow.io API
- User registration and login with bcrypt password hashing
- Personalized preferences — saved location, temperature unit, background image
- Saved locations dropdown for quick access to preset locations
- Admin panel for user management
- Session-based authentication with protected routes

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- A Tomorrow.io API key (free tier available at [tomorrow.io](https://tomorrow.io))
- A PostgreSQL database (project uses Supabase)

### Installation

1. Clone the repo
```bash
   git clone https://github.com/Fishman004/WeatherNow.git
   cd WeatherNow
```

2. Install dependencies
```bash
   npm install
```

3. Set up environment variables — create a `.env` file in the root:
```
   API_KEY=your_tomorrow_io_api_key
   DATABASE_URL=your_postgres_connection_string
```

4. Run the development server
```bash
   node index.mjs
```

5. Open [http://localhost:3001](http://localhost:3001)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API_KEY` | API key from [tomorrow.io](https://tomorrow.io) for weather forecast data |
| `DATABASE_URL` | PostgreSQL connection string (Supabase or other provider) |

## Database Setup

Run the following SQL to create the required tables:
```sql
CREATE TABLE "user" (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  password VARCHAR(255),
  is_admin BOOLEAN DEFAULT false
);

CREATE TABLE userPreferences (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES "user"(user_id),
  user_temp VARCHAR(10) DEFAULT 'imperial',
  zipcode VARCHAR(10),
  image VARCHAR(50) DEFAULT 'default'
);

CREATE TABLE saved_locations (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10),
  location_name VARCHAR(255)
);
```

## Notes
- The free tier of Tomorrow.io is limited to 25 requests per hour
- The app is hosted on Render's free tier which may have a cold start delay of ~30 seconds after inactivity

## Contributors
This was a team project built at CSUMB. Contributors include members of Group 7.
