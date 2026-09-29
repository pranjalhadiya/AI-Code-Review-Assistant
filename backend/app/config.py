from pydantic_settings import BaseSettings, SettingsConfigDict  

class Settings(BaseSettings):  
    DATABASE_URL: str  
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    ALLOWED_EXTENSIONS: str = ".py"
    MAX_FILE_SIZE_MB: int = 2
    UPLOAD_DIRECTORY: str = "uploads"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    AI_TIMEOUT_SECONDS: int = 60  
    
    model_config = SettingsConfigDict(  
        env_file=".env",             
        env_file_encoding="utf-8",    
        extra="ignore"                
    )


settings = Settings()  