"""Web search — uses ADK built-in GoogleSearchTool (Vertex AI grounding)."""

from google.adk.tools.google_search_tool import GoogleSearchTool

# ADK's built-in search tool — invoked natively by Gemini 2 models via Vertex AI.
# No API key required; uses existing GOOGLE_GENAI_USE_VERTEXAI credentials.
# Import this and pass to LlmAgent tools list as: google_search_tool
google_search_tool = GoogleSearchTool()
