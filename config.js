// Configuration for PDF Reader AI
export const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://tvecnfdqakrevzaeifpk.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZWNuZmRxYWtyZXZ6YWVpZnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzODIwNjQsImV4cCI6MjA2Mzk1ODA2NH0.q-8ukkJZ4FGSbZyEYp0letP-S58hC2PA6lUOWUH9H2Y',
    SUPABASE_SERVICE_ROLE: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2ZWNuZmRxYWtyZXZ6YWVpZnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM4MjA2NCwiZXhwIjoyMDYzOTU4MDY0fQ.KqzZr0iiPNYHFzEzT8utRAu3EorO3LFDbh3dd-U_42c',
    
    // OpenRouter API Configuration
    OPENROUTER_API_KEY: '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',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    
    // Storage Configuration
    STORAGE_ENDPOINT: 'https://tvecnfdqakrevzaeifpk.supabase.co/storage/v1/s3',
    STORAGE_REGION: 'eu-west-2',
    S3_KEY: '90baa8b234a4da5976e4316195e60b2f',
    
    // Project Configuration
    PROJECT_NAME: 'Evidentia',
    PROJECT_ID: 'tvecnfdqakrevzaeifpk',
    
    // AI Models Configuration
    MODELS: {
        'claude-3-5-sonnet': { 
            name: 'Claude 3.5 Sonnet', 
            rating: 4.7,
            provider: 'anthropic',
            context_length: 200000
        },
        'gpt-4o': { 
            name: 'GPT-4o', 
            rating: 4.1,
            provider: 'openai',
            context_length: 128000
        },
        'claude-3-opus': { 
            name: 'Claude 3 Opus', 
            rating: 4.5,
            provider: 'anthropic',
            context_length: 200000
        },
        'gpt-4-turbo': { 
            name: 'GPT-4 Turbo', 
            rating: 4.0,
            provider: 'openai',
            context_length: 128000
        },
        'gemini-pro': { 
            name: 'Gemini Pro', 
            rating: 3.9,
            provider: 'google',
            context_length: 32000
        }
    },
    
    // Analysis Templates
    ANALYSIS_TEMPLATES: {
        'legal-risks': 'Identify all legal risks, liabilities, and potential issues in this document with specific line references and page numbers.',
        'key-terms': 'Extract and analyze all key terms, definitions, and important clauses with their implications and legal significance.',
        'obligations': 'List all obligations, duties, requirements, and responsibilities mentioned in this document with specific references.',
        'red-flags': 'Identify any red flags, concerning language, problematic clauses, or potential issues that require immediate attention.',
        'summary': 'Provide a comprehensive summary of the document including main points, key decisions, and critical information.',
        'compliance': 'Analyze compliance requirements, regulatory obligations, and legal standards mentioned in the document.',
        'financial': 'Extract and analyze all financial terms, amounts, payment obligations, and monetary implications.',
        'timeline': 'Identify all dates, deadlines, time periods, and temporal requirements in the document.'
    }
};

// Environment detection
export const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const IS_PRODUCTION = !IS_DEVELOPMENT;

// API endpoints
export const ENDPOINTS = {
    SUPABASE_API: `${CONFIG.SUPABASE_URL}/rest/v1`,
    SUPABASE_AUTH: `${CONFIG.SUPABASE_URL}/auth/v1`,
    SUPABASE_STORAGE: `${CONFIG.SUPABASE_URL}/storage/v1`,
    OPENROUTER_CHAT: `${CONFIG.OPENROUTER_BASE_URL}/chat/completions`
};
