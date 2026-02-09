# Dataset Preparation for Learning Platform

This directory contains the dataset preparation pipeline for the Learning Platform system. The goal is to process raw course data into a structured, clean, and normalized format suitable for the application's database, search engine, and recommendation systems.

## Directory Structure

The `data/` directory is organized as follows:

```
data/
├── data/                  # Storage for data at various stages
│   ├── raw/               # Original, immutable data downloaded from sources
│   ├── cleaned/           # Data after initial cleaning (selecting columns, renaming)
│   └── normalized/        # Data after normalization (standardizing formats, types)
├── scripts/               # Python scripts for data processing
│   └── clean/             # Scripts for cleaning raw data
├── notebooks/             # Jupyter notebooks for data exploration and prototyping
├── requirements.txt       # Python dependencies
└── README.md              # This documentation
```

## Environment Setup

To prepare the environment for running the scripts:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Data Processing Pipeline

The data flows through the following stages:

### 1. Download (Raw Data)
Raw data is collected from various sources (e.g., CSV dumps).
*   **Source:** `data/raw/online-courses/Online_Courses.csv`

### 2. Clean
Selects relevant columns, parses ratings, adds default values (prices, thumbnails, video URLs), and renames columns.
*   **Script:** `scripts/clean/clean_online_courses.py`
*   **Output:** `data/cleaned/cleaned_courses.csv`

### 3. Normalize
Splits the cleaned data into relational entities, generates UUIDs, and creates mock data (users, chapters, lessons).

a. **Categories**: Extracts unique categories.
   *   **Script:** `scripts/normalize/normalize_categories.py`
   *   **Output:** `data/normalized/categories.csv` & updates `courses.csv`

b. **Users (Instructors)**: Extracts instructors and generates user profiles (email, password, etc.).
   *   **Script:** `scripts/normalize/normalize_users.py`
   *   **Output:** `data/normalized/users.csv` & updates `courses.csv`

c. **Tags, Outcomes, Chapters & Lessons**: Extracts tags and generates related content (outcomes, requirements, chapters, lessons) based on those tags.
   *   **Script:** `scripts/normalize/normalize_tags.py`
   *   **Outputs:** 
       *   `data/normalized/tags.csv`
       *   `data/normalized/course_tag.csv`
       *   `data/normalized/course_outcomes.csv`
       *   `data/normalized/course_requirements.csv`
       *   `data/normalized/chapters.csv`
       *   `data/normalized/lessons.csv`
       *   Updates `courses.csv` (removes tags column, adds final IDs)

### 4. Import to Database
Imports the normalized CSV files into the MySQL databases (`user_service` and `course_service`).
*   **Script:** `scripts/import-data/import_to_mysql.py`
*   **Requirements:** MySQL running on localhost:3306 (or configured via `.env`).

## Usage

### 1. Setup Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Database
Create a `.env` file in the `data/` directory:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_PORT=3306
```

### 3. Run Full Pipeline
Run the scripts in the following order to clean, normalize, and import data:

```bash
# 1. Clean Data
python scripts/clean/clean_online_courses.py

# 2. Normalize Data (Order matters!)
python scripts/normalize/normalize_categories.py
python scripts/normalize/normalize_users.py
python scripts/normalize/normalize_tags.py

# 3. Import to MySQL
python scripts/import-data/import_to_mysql.py
```

### One-Liner Command
```bash
python scripts/clean/clean_online_courses.py && \
python scripts/normalize/normalize_categories.py && \
python scripts/normalize/normalize_users.py && \
python scripts/normalize/normalize_tags.py && \
python scripts/import-data/import_to_mysql.py
```
