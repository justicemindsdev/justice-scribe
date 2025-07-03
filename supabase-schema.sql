-- PDF Reader AI - Supabase Database Schema
-- For your Supabase project

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE analysis_type AS ENUM (
    'legal-risks',
    'key-terms', 
    'obligations',
    'red-flags',
    'summary',
    'line-analysis',
    'custom'
);

CREATE TYPE document_status AS ENUM (
    'uploading',
    'processing',
    'ready',
    'error'
);

CREATE TYPE citation_type AS ENUM (
    'page',
    'section',
    'line',
    'paragraph'
);

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT DEFAULT 'application/pdf',
    storage_path TEXT NOT NULL,
    status document_status DEFAULT 'uploading',
    page_count INTEGER,
    text_content TEXT,
    metadata JSONB DEFAULT '{}',
    processing_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document pages table (for page-specific content and thumbnails)
CREATE TABLE public.document_pages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    text_content TEXT,
    thumbnail_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, page_number)
);

-- Analysis sessions table
CREATE TABLE public.analysis_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_name TEXT,
    shared_link_token TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis queries table
CREATE TABLE public.analysis_queries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.analysis_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    query_text TEXT NOT NULL,
    analysis_type analysis_type NOT NULL,
    response_text TEXT,
    processing_time_ms INTEGER,
    model_used TEXT DEFAULT 'gpt-4',
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Citations table
CREATE TABLE public.citations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    query_id UUID REFERENCES public.analysis_queries(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    citation_number INTEGER NOT NULL,
    citation_type citation_type DEFAULT 'page',
    page_numbers INTEGER[] NOT NULL,
    line_numbers INTEGER[],
    section_reference TEXT,
    context_text TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(query_id, citation_number)
);

-- User interactions table (for analytics and UX improvements)
CREATE TABLE public.user_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.analysis_sessions(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL, -- 'citation_click', 'page_navigation', 'template_use', etc.
    interaction_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document sharing table (for collaborative features)
CREATE TABLE public.document_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    shared_with_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    share_token TEXT UNIQUE,
    permissions TEXT[] DEFAULT ARRAY['read'], -- 'read', 'comment', 'analyze'
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analysis templates table (for custom user templates)
CREATE TABLE public.analysis_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    analysis_type analysis_type DEFAULT 'custom',
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookmarks table (for saving important sections)
CREATE TABLE public.bookmarks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    color TEXT DEFAULT '#5D5CDE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

CREATE INDEX idx_document_pages_document_id ON public.document_pages(document_id);
CREATE INDEX idx_document_pages_page_number ON public.document_pages(document_id, page_number);

CREATE INDEX idx_analysis_sessions_document_id ON public.analysis_sessions(document_id);
CREATE INDEX idx_analysis_sessions_user_id ON public.analysis_sessions(user_id);

CREATE INDEX idx_analysis_queries_session_id ON public.analysis_queries(session_id);
CREATE INDEX idx_analysis_queries_document_id ON public.analysis_queries(document_id);
CREATE INDEX idx_analysis_queries_type ON public.analysis_queries(analysis_type);
CREATE INDEX idx_analysis_queries_created_at ON public.analysis_queries(created_at DESC);

CREATE INDEX idx_citations_query_id ON public.citations(query_id);
CREATE INDEX idx_citations_document_id ON public.citations(document_id);
CREATE INDEX idx_citations_page_numbers ON public.citations USING GIN(page_numbers);

CREATE INDEX idx_user_interactions_user_id ON public.user_interactions(user_id);
CREATE INDEX idx_user_interactions_type ON public.user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_created_at ON public.user_interactions(created_at DESC);

CREATE INDEX idx_bookmarks_user_document ON public.bookmarks(user_id, document_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_sessions_updated_at BEFORE UPDATE ON public.analysis_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_templates_updated_at BEFORE UPDATE ON public.analysis_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Documents policies
CREATE POLICY "Users can view own documents" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- Document pages policies
CREATE POLICY "Users can view pages of own documents" ON public.document_pages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.documents 
            WHERE documents.id = document_pages.document_id 
            AND documents.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert pages for own documents" ON public.document_pages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents 
            WHERE documents.id = document_pages.document_id 
            AND documents.user_id = auth.uid()
        )
    );

-- Analysis sessions policies
CREATE POLICY "Users can manage own analysis sessions" ON public.analysis_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Analysis queries policies
CREATE POLICY "Users can manage own analysis queries" ON public.analysis_queries
    FOR ALL USING (auth.uid() = user_id);

-- Citations policies
CREATE POLICY "Users can view citations for own queries" ON public.citations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analysis_queries 
            WHERE analysis_queries.id = citations.query_id 
            AND analysis_queries.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert citations for own queries" ON public.citations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analysis_queries 
            WHERE analysis_queries.id = citations.query_id 
            AND analysis_queries.user_id = auth.uid()
        )
    );

-- User interactions policies
CREATE POLICY "Users can manage own interactions" ON public.user_interactions
    FOR ALL USING (auth.uid() = user_id);

-- Document shares policies
CREATE POLICY "Users can manage shares for own documents" ON public.document_shares
    FOR ALL USING (auth.uid() = owner_id OR auth.uid() = shared_with_id);

-- Analysis templates policies
CREATE POLICY "Users can view own and public templates" ON public.analysis_templates
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage own templates" ON public.analysis_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON public.analysis_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON public.analysis_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Bookmarks policies
CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks
    FOR ALL USING (auth.uid() = user_id);

-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Users can upload own documents" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents" ON storage.objects
    FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own documents" ON storage.objects
    FOR UPDATE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents" ON storage.objects
    FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create functions for common operations

-- Function to get document with citation count
CREATE OR REPLACE FUNCTION get_document_with_stats(doc_id UUID)
RETURNS TABLE (
    id UUID,
    filename TEXT,
    page_count INTEGER,
    total_queries INTEGER,
    total_citations INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.filename,
        d.page_count,
        COALESCE(query_count.total, 0)::INTEGER as total_queries,
        COALESCE(citation_count.total, 0)::INTEGER as total_citations,
        d.created_at
    FROM public.documents d
    LEFT JOIN (
        SELECT document_id, COUNT(*) as total
        FROM public.analysis_queries
        WHERE document_id = doc_id
        GROUP BY document_id
    ) query_count ON d.id = query_count.document_id
    LEFT JOIN (
        SELECT document_id, COUNT(*) as total
        FROM public.citations
        WHERE document_id = doc_id
        GROUP BY document_id
    ) citation_count ON d.id = citation_count.document_id
    WHERE d.id = doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search citations by page
CREATE OR REPLACE FUNCTION search_citations_by_page(doc_id UUID, page_num INTEGER)
RETURNS TABLE (
    citation_id UUID,
    query_text TEXT,
    citation_number INTEGER,
    context_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as citation_id,
        aq.query_text,
        c.citation_number,
        c.context_text,
        c.created_at
    FROM public.citations c
    JOIN public.analysis_queries aq ON c.query_id = aq.id
    WHERE c.document_id = doc_id 
    AND page_num = ANY(c.page_numbers)
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default analysis templates
INSERT INTO public.analysis_templates (id, user_id, name, description, prompt_template, analysis_type, is_public) VALUES
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Legal Risk Analysis', 'Comprehensive legal risk assessment', 'Identify and analyze all potential legal risks, liabilities, and compliance issues in this document. Focus on liability exposure, indemnification clauses, and regulatory compliance requirements.', 'legal-risks', true),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Key Terms Extraction', 'Extract and explain important terms', 'Extract and explain all key terms, definitions, and important concepts from this document. Provide clear explanations and identify any ambiguous or concerning definitions.', 'key-terms', true),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Obligations Analysis', 'Identify all obligations and responsibilities', 'List all obligations, responsibilities, and requirements outlined in this document. Categorize by party and identify performance standards and deadlines.', 'obligations', true),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Red Flags Detection', 'Identify concerning clauses and issues', 'Identify any red flags, concerning clauses, or potential issues that require attention. Focus on one-sided terms, unlimited liability, and unfair provisions.', 'red-flags', true),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Document Summary', 'Comprehensive document overview', 'Provide a comprehensive summary of this document including main points, key takeaways, and overall structure. Highlight the most important sections.', 'summary', true),
(uuid_generate_v4(), '00000000-0000-0000-0000-000000000000', 'Line-by-Line Analysis', 'Detailed section-by-section breakdown', 'Perform a detailed line-by-line analysis of this document, highlighting important sections, potential issues, and key provisions that require attention.', 'line-analysis', true);

-- Create view for user dashboard
CREATE VIEW user_dashboard AS
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT aq.id) as total_queries,
    COUNT(DISTINCT c.id) as total_citations,
    MAX(d.created_at) as last_document_upload,
    MAX(aq.created_at) as last_query
FROM public.users u
LEFT JOIN public.documents d ON u.id = d.user_id
LEFT JOIN public.analysis_queries aq ON u.id = aq.user_id
LEFT JOIN public.citations c ON aq.id = c.query_id
GROUP BY u.id, u.email, u.full_name;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.documents IS 'Stores uploaded PDF documents and their metadata';
COMMENT ON TABLE public.document_pages IS 'Stores individual page content and thumbnails for each document';
COMMENT ON TABLE public.analysis_queries IS 'Stores user queries and AI responses for document analysis';
COMMENT ON TABLE public.citations IS 'Stores citations that link AI responses to specific document pages';
COMMENT ON TABLE public.user_interactions IS 'Tracks user interactions for analytics and UX improvements';
COMMENT ON TABLE public.analysis_templates IS 'Stores reusable analysis templates for different document types';
COMMENT ON TABLE public.bookmarks IS 'Allows users to bookmark important sections of documents';

COMMENT ON COLUMN public.citations.page_numbers IS 'Array of page numbers this citation references';
COMMENT ON COLUMN public.citations.confidence_score IS 'AI confidence score for this citation (0.0 to 1.0)';
COMMENT ON COLUMN public.documents.text_content IS 'Full text content extracted from the PDF';
COMMENT ON COLUMN public.analysis_queries.tokens_used IS 'Number of tokens consumed by the AI model for this query';
