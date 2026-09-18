from werkzeug.utils import secure_filename  

from app.config import settings


def is_allowed_extension(filename: str) -> bool:
    
    allowed = [ext.strip() for ext in settings.ALLOWED_EXTENSIONS.split(",")]
    

    return any(filename.lower().endswith(ext) for ext in allowed)
    


def is_within_size_limit(file_size_bytes: int) -> bool:
    
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    

    return file_size_bytes <= max_bytes


def get_safe_filename(filename: str) -> str:
    
    safe_name = secure_filename(filename)
    

    if not safe_name:
        
        safe_name = "unnamed_file.py"

    return safe_name


def validate_upload(filename: str, file_size_bytes: int) -> tuple[bool, str]:

    if not filename:
        return False, "No filename provided."

    if file_size_bytes == 0:
        return False, "The uploaded file is empty."
    
    if not is_allowed_extension(filename):
        return False, f"File type not allowed. Only {settings.ALLOWED_EXTENSIONS} files are accepted."

    if not is_within_size_limit(file_size_bytes):
        return False, f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB."

    return True, "Valid"
    