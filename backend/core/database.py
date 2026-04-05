from supabase import create_client, Client
from .config import settings

url: str = settings.SUPABASE_URL
key: str = settings.SUPABASE_KEY

# Initialize the Supabase client
supabase: Client = create_client(url, key)
