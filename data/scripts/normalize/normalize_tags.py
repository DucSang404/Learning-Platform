import csv
import os
import uuid
import datetime

def normalize_tags_and_add_ids(input_courses_file, output_courses_file, output_tags_file, output_course_tags_file):
    """
    1. Adds UUID 'id' to each course.
    2. Extracts 'tags' (split by comma) into a separate 'tags.csv'.
    3. Creates 'course_tag.csv' linking courses and tags.
    4. Removes 'tags' column from courses data.
    5. Adds default timestamps.
    """
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')
    
    tags_map = {} # tag_name -> tag_id
    course_tags_relations = [] # list of dicts {id, course_id, tag_id}
    
    updated_courses = []
    course_fieldnames = []

    try:
        with open(input_courses_file, 'r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            if not reader.fieldnames:
                print("Error: Empty file or no header found.")
                return
            
            # Determine new header for courses
            # We add 'id', 'created_at', 'deleted', 'updated_at'
            # We remove 'tags'
            original_fields = reader.fieldnames
            course_fieldnames = ['id', 'created_at', 'deleted', 'updated_at'] + [f for f in original_fields if f != 'tags']
            
            for row in reader:
                # Generate Course ID
                course_id = str(uuid.uuid4())
                
                # Process Tags
                tags_str = row.get('tags', '')
                if tags_str:
                    # Clean and split
                    # Some tags might be quoted or contain extra spaces?
                    # basic split by comma
                    tag_list = [t.strip() for t in tags_str.split(',') if t.strip()]
                    
                    for tag_name in tag_list:
                        if tag_name not in tags_map:
                            tags_map[tag_name] = str(uuid.uuid4())
                        
                        tag_id = tags_map[tag_name]
                        
                        # Create Relation
                        course_tags_relations.append({
                            'id': str(uuid.uuid4()),
                            'course_id': course_id,
                            'tag_id': tag_id
                        })
                
                # Prepare updated course row
                new_row = {
                    'id': course_id,
                    'created_at': timestamp,
                    'deleted': 0,
                    'updated_at': timestamp
                }
                for k, v in row.items():
                    if k != 'tags':
                        new_row[k] = v
                
                updated_courses.append(new_row)

        # Write Tags CSV
        # Schema: id, created_at, deleted, updated_at, image_url, name
        tags_header = ['id', 'created_at', 'deleted', 'updated_at', 'image_url', 'name']
        with open(output_tags_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=tags_header)
            writer.writeheader()
            for name, t_id in tags_map.items():
                writer.writerow({
                    'id': t_id,
                    'created_at': timestamp,
                    'deleted': 0,
                    'updated_at': timestamp,
                    'image_url': '', # check if we have image? No.
                    'name': name
                })
        print(f"Extracted {len(tags_map)} tags to: {output_tags_file}")

        # Write Course_Tag CSV
        # Schema: id, course_id, tag_id
        course_tag_header = ['id', 'course_id', 'tag_id']
        with open(output_course_tags_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=course_tag_header)
            writer.writeheader()
            writer.writerows(course_tags_relations)
        print(f"Created {len(course_tags_relations)} course-tag relations to: {output_course_tags_file}")

        # Write Updated Courses CSV
        with open(output_courses_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=course_fieldnames)
            writer.writeheader()
            writer.writerows(updated_courses)
        print(f"Updated {len(updated_courses)} courses (added IDs, removed tags) to: {output_courses_file}")


    except FileNotFoundError:
        print(f"Error: Input file not found at {input_courses_file}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_root = os.path.abspath(os.path.join(script_dir, '..', '..'))
    
    # Input is the output from previous step (normalized courses with category_id)
    input_courses_path = os.path.join(data_root, 'data', 'normalized', 'courses.csv')
    
    # Outputs
    # We overwrite courses.csv or create a new one?
    # Let's overwrite to keep it simple as "the current state of courses".
    # Or maybe create 'courses_with_ids.csv'?
    # I'll overwrite 'courses.csv' because that's the "normalized courses" table.
    output_courses_path = os.path.join(data_root, 'data', 'normalized', 'courses.csv')
    
    output_tags_path = os.path.join(data_root, 'data', 'normalized', 'tags.csv')
    output_course_tags_path = os.path.join(data_root, 'data', 'normalized', 'course_tag.csv')
    
    print(f"Processing file: {input_courses_path}")
    
    normalize_tags_and_add_ids(input_courses_path, output_courses_path, output_tags_path, output_course_tags_path)
