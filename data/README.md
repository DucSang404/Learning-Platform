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
Raw data is collected from various sources (e.g., CSV dumps, API responses) and stored in `data/raw/`. This data is treated as immutable.
*   **Current Source:** `data/raw/online-courses/Online_Courses.csv`

### 2. Clean
We select relevant columns, handle missing values for critical fields, and rename columns to match our internal schema.
*   **Script:** `scripts/clean/clean_online_courses.py`
*   **Input:** `data/raw/online-courses/Online_Courses.csv`
*   **Output:** `data/cleaned/cleaned_courses.csv`
*   **Operations:**
    *   Selects: Title, URI, Short Intro, Category, Skills, Instructors, Rating
    *   Renames columns to lowercase/standardized format

### 3. Normalize (In Progress)
The next step involves standardizing the cleaned data to ensure consistency across the platform. This will include:
*   Standardizing skill tags (e.g., "Python 3" -> "Python").
*   Normalizing instructor names.
*   Formatting numeric values (ratings, duration).
*   **Output Location:** `data/normalized/`

## Usage

To run the cleaning process:

1.  Ensure you have the necessary dependencies installed (e.g., pandas is NOT currently required as the script uses standard `csv` library, but check `requirements.txt` for other tools).
2.  Run the cleaning script from the `data` directory:

```bash
python3 scripts/clean/clean_online_courses.py
```

This will read the raw CSV and generate the cleaned version in the `data/cleaned/` directory.
