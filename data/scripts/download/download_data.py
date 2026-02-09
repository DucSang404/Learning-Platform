import kagglehub
import shutil
from pathlib import Path

DATASET = "khaledatef1/online-courses"
TARGET_DIR = Path("data/raw/online-courses")

# Download to kagglehub cache
cache_path = Path(kagglehub.dataset_download(DATASET))

# Create target dir
TARGET_DIR.mkdir(parents=True, exist_ok=True)

# Copy data from cache → project
for item in cache_path.iterdir():
    dest = TARGET_DIR / item.name
    if item.is_dir():
        shutil.copytree(item, dest, dirs_exist_ok=True)
    else:
        shutil.copy2(item, dest)

print(f"✅ Dataset copied to {TARGET_DIR.resolve()}")
