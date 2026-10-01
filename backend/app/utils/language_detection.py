import os 


EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".c": "c",
    ".java": "java",
}


def detect_language(filename: str) -> str | None:
    """
    Returns "python", "c", or "java" based on the file's extension, or None if the
    extension isn't one we recognize. Case-insensitive (e.g. "Main.JAVA" still detects as "java").
    """
    _, extension = os.path.splitext(filename)  
    return EXTENSION_TO_LANGUAGE.get(extension.lower())
  