import csv
import os
import uuid
import datetime

def normalize_categories(input_file, output_courses_file, output_categories_file):
    """
    Normalizes the category field by extracting distinct categories into a separate file
    and replacing the category name with its ID in the courses file.
    """
    # Define timestamp for created_at and updated_at
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')

    categories_map = {} # category_name -> category_id
    
    # Read input file to get distinct categories
    courses_data = [] # Store rows to process later
    fieldnames = []

    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            fieldnames = reader.fieldnames
            
            if not fieldnames:
                print("Error: Empty file or no header found.")
                return

            for row in reader:
                courses_data.append(row)
                category_name = row.get('category', '').strip()
                if category_name and category_name not in categories_map:
                    # Generate a new UUID
                    categories_map[category_name] = str(uuid.uuid4())

        # Prepare Categories CSV
        # Schema: id, created_at, deleted, updated_at, description, name
        categories_header = ['id', 'created_at', 'deleted', 'updated_at', 'description', 'name']
        
        with open(output_categories_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=categories_header)
            writer.writeheader()
            
            for name, cat_id in categories_map.items():
                writer.writerow({
                    'id': cat_id,
                    'created_at': timestamp,
                    'deleted': 0, # Assuming 0 for false/bit(1)
                    'updated_at': timestamp,
                    'description': name, # Use name as description for now
                    'name': name
                })
        
        print(f"Extracted {len(categories_map)} categories to: {output_categories_file}")

        # Prepare Normalized Courses CSV
        # Replace 'category' column with 'category_id'
        # The schema might need to change: 'category' -> 'category_id' in header?
        # User said "map field value... at table course by id of row category".
        # So we update the column value. Should we rename the column header too?
        # Usually yes, 'category_id' is better. Let's rename it.
        
        new_fieldnames = [f if f != 'category' else 'category_id' for f in fieldnames]

        with open(output_courses_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=new_fieldnames)
            writer.writeheader()
            
            rows_processed = 0
            for row in courses_data:
                category_name = row.get('category', '').strip()
                cat_id = categories_map.get(category_name, '')
                
                # Create a new row with modified keys
                new_row = {}
                for key, val in row.items():
                    if key == 'category':
                        new_row['category_id'] = cat_id
                    else:
                        new_row[key] = val
                
                writer.writerow(new_row)
                rows_processed += 1
                
        print(f"Normalized {rows_processed} courses to: {output_courses_file}")


    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_root = os.path.abspath(os.path.join(script_dir, '..', '..')) # points to 'data' folder
    
    input_csv_path = os.path.join(data_root, 'data', 'cleaned', 'cleaned_courses.csv')
    
    # Output paths
    output_categories_path = os.path.join(data_root, 'data', 'normalized', 'categories.csv')
    output_courses_path = os.path.join(data_root, 'data', 'normalized', 'courses.csv')
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_categories_path), exist_ok=True)
    
    print(f"Input file: {input_csv_path}")
    
    normalize_categories(input_csv_path, output_courses_path, output_categories_path)
