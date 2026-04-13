-- Collaborative Editor Database Schema for Supabase
-- Run this SQL in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Document',
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaborators table (for sharing documents)
CREATE TABLE public.collaborators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);

-- Comments table
CREATE TABLE public.comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  position JSONB, -- Store text range for highlighting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document versions table (for version history)
CREATE TABLE public.document_versions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content JSONB NOT NULL, -- Store Yjs document state
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX idx_collaborators_document_id ON public.collaborators(document_id);
CREATE INDEX idx_collaborators_user_id ON public.collaborators(user_id);
CREATE INDEX idx_comments_document_id ON public.comments(document_id);
CREATE INDEX idx_document_versions_document_id ON public.document_versions(document_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Documents policies
CREATE POLICY "Users can view documents they own or collaborate on"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM public.collaborators
      WHERE document_id = documents.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update documents they own or have editor access to"
  ON public.documents FOR UPDATE
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM public.collaborators
      WHERE document_id = documents.id AND user_id = auth.uid() AND role = 'editor'
    )
  );

CREATE POLICY "Users can delete documents they own"
  ON public.documents FOR DELETE
  USING (auth.uid() = owner_id);

-- Collaborators policies
CREATE POLICY "Users can view collaborators for documents they have access to"
  ON public.collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = collaborators.document_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators c2
          WHERE c2.document_id = collaborators.document_id AND c2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Document owners can manage collaborators"
  ON public.collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = collaborators.document_id AND owner_id = auth.uid()
    )
  );

-- Comments policies
CREATE POLICY "Users can view comments for documents they have access to"
  ON public.comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = comments.document_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE document_id = comments.document_id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create comments on documents they have access to"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = comments.document_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE document_id = comments.document_id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Document versions policies
CREATE POLICY "Users can view versions for documents they have access to"
  ON public.document_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_versions.document_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE document_id = document_versions.document_id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create versions for documents they have access to"
  ON public.document_versions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_versions.document_id AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE document_id = document_versions.document_id AND user_id = auth.uid() AND role = 'editor'
        )
      )
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update document updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update document updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_document_updated_at();
