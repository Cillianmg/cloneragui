-- Clean up orphaned embedding provider records with empty API keys
DELETE FROM embedding_providers 
WHERE api_key = '' OR api_key IS NULL;