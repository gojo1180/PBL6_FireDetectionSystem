import httpx
from supabase import create_client, Client, ClientOptions
from .config import settings

url: str = settings.SUPABASE_URL
key: str = settings.SUPABASE_KEY

# Configure client options to use HTTP/1.1 (disable HTTP/2) to prevent
# httpx.RemoteProtocolError: Server disconnected issues under HTTP/2.
options = ClientOptions(
    httpx_client=httpx.Client(http2=False)
)

# Initialize the Supabase client
supabase: Client = create_client(url, key, options=options)
