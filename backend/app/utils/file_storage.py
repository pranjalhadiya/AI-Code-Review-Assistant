import os
import time 

from app.utils.file_validation import get_safe_filename
from app.config import settings


def save_uploaded_file(user_id: int, file_bytes: bytes, original_filename: str) -> str:
    
    safe_filename = get_safe_filename(original_filename)

    user_folder = os.path.join(settings.UPLOAD_DIRECTORY, f"user_{user_id}")
    os.makedirs(user_folder, exist_ok=True)

    full_path = os.path.join(user_folder, safe_filename)

    if os.path.exists(full_path):
       
        name_part, extension = os.path.splitext(safe_filename)
       

        unique_suffix = str(int(time.time()))
        

        safe_filename = f"{name_part}_{unique_suffix}{extension}"
        

        full_path = os.path.join(user_folder, safe_filename)

    with open(full_path, "wb") as f:
        f.write(file_bytes)

    return full_path