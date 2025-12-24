# Membership Management System

A comprehensive membership management application for sportsmen's clubs, HOAs, and similar organizations.

## Features

- **Member Management**: Add, edit, and track members with full history
- **Membership Tiers**: Regular, Absentee, Life, and Honorary tiers
- **Billing System**: Prorated dues, assessments, work hour buyouts, and cabaret tax
- **Work Hours Tracking**: Manual entry with optional timeclock integration
- **Life Eligibility**: Automatic eligibility checking with three qualification paths
- **Encumbrance Tracking**: Article XII violations and restrictions
- **Reports & Export**: Excel exports for billing, members, and more
- **Data Import**: Bulk import from Excel/CSV

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings > API** and copy your project URL and anon key

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set Up Database

1. In Supabase, go to **SQL Editor**
2. Paste the contents of `database-schema.sql` and run it

### 4. Create Admin User

1. In Supabase, go to **Authentication > Users**
2. Click **Add user** and create an admin account

### 5. Install & Run

```bash
npm install
npm run dev
```

## Deployment

Build for production:
```bash
npm run build
```

Deploy the `dist` folder to any static hosting (Netlify, Vercel, etc.)

## Configuration

All billing rates and settings are configurable through the Settings page:

- Regular dues amount ($300 default)
- Absentee dues amount ($50 default)
- Work hours required (10 hrs default)
- Buyout rate per hour ($20 default)
- First 5-year assessment ($50/yr default)
- Cabaret tax rate (10% default)

## Life Membership Eligibility Rules

Three paths to Life membership:

1. **Legacy** (joined before July 1, 2011): Age 62+, 10+ consecutive years
2. **Standard** (joined July 1, 2011+): Age 62+, 20+ consecutive years
3. **Longevity**: Any age, 30+ consecutive years

All paths require no active Article XII encumbrances.

## Billing Cycle

- **Fiscal Year**: July 1 – June 30
- **Work Hour Year**: March 1 – February 28
- **Billing**: April 1
- **Payment Deadline**: First Wednesday of June

## Tech Stack

- React 19 + Vite
- Supabase (PostgreSQL + Auth)
- Lucide React Icons
- SheetJS (Excel import/export)
