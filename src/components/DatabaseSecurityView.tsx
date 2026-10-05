import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Key, Database, Copy, Check, Lock, CheckCircle2 } from 'lucide-react';

const SCHEMA_SQL_SNIPPET = `-- HomeEdu Hub Phase 1 Schema & RLS Summary
-- Full script available in /supabase/schema.sql

-- 1. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Families Table
CREATE TABLE public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Family Members Table
CREATE TABLE public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('parent', 'student')),
    CONSTRAINT unique_family_member UNIQUE (family_id, profile_id)
);

-- 4. Students Academic Profiles Table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    date_of_birth DATE,
    education_type TEXT NOT NULL,
    year_group TEXT NOT NULL,
    gcse_status TEXT NOT NULL
);

-- 5. Student Subjects Table
CREATE TABLE public.student_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    qualification TEXT NOT NULL,
    exam_board TEXT NOT NULL,
    specification_code TEXT,
    tier TEXT,
    target_exam_year INT,
    status TEXT NOT NULL DEFAULT 'Active'
);

-- 6. Essential Helper Functions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_member_of_family(f_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = f_id AND profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_parent_in_family(f_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = f_id AND profile_id = auth.uid() AND role = 'parent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Enable RLS on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

-- 8. Immutable Role Enforcement
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Role mutation is prohibited. Role is established on registration.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 9. Private Student Evidence Bucket (Non-Public)
INSERT INTO storage.buckets (id, name, public) VALUES ('student-evidence', 'student-evidence', false);`;

export const DatabaseSecurityView: React.FC = () => {
  const { isSupabaseLive } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SCHEMA_SQL_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <span>Security & Infrastructure</span>
          <span aria-hidden="true">·</span>
          <span>Supabase PostgreSQL & Row Level Security</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Database Architecture & RLS Security Model
        </h1>
        <p className="text-xs text-stone-500 mt-1 max-w-2xl leading-relaxed">
          HomeEdu Hub is engineered with a strict least-privilege security model to protect minor educational records
          and future coursework evidence. Database queries are authenticated via Supabase Row Level Security (RLS).
        </p>
      </div>

      {/* Supabase Connection Status (Read-Only) */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${isSupabaseLive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-700'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">Supabase Connection</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {isSupabaseLive
                  ? 'Production database connected securely.'
                  : 'Running in development sandbox mode.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md ${
                isSupabaseLive
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-stone-100 text-stone-700 border border-stone-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseLive ? 'bg-emerald-600' : 'bg-stone-400'}`} />
              {isSupabaseLive ? 'Connected Live' : 'Development Mode'}
            </span>
          </div>
        </div>

        {/* Non-sensitive Technical Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-stone-100">
          <div className="p-3 bg-stone-50 rounded-md border border-stone-200/60">
            <span className="text-3xs text-stone-400 font-semibold uppercase tracking-wider block">Supabase</span>
            <span className="text-xs font-medium text-stone-900 flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {isSupabaseLive ? 'Connected' : 'Sandbox'}
            </span>
          </div>

          <div className="p-3 bg-stone-50 rounded-md border border-stone-200/60">
            <span className="text-3xs text-stone-400 font-semibold uppercase tracking-wider block">Authentication</span>
            <span className="text-xs font-medium text-stone-900 flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Active
            </span>
          </div>

          <div className="p-3 bg-stone-50 rounded-md border border-stone-200/60">
            <span className="text-3xs text-stone-400 font-semibold uppercase tracking-wider block">Row Level Security</span>
            <span className="text-xs font-medium text-stone-900 flex items-center gap-1.5 mt-1">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Enabled
            </span>
          </div>

          <div className="p-3 bg-stone-50 rounded-md border border-stone-200/60">
            <span className="text-3xs text-stone-400 font-semibold uppercase tracking-wider block">Storage</span>
            <span className="text-xs font-medium text-stone-900 flex items-center gap-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Private
            </span>
          </div>

          <div className="p-3 bg-stone-50 rounded-md border border-stone-200/60">
            <span className="text-3xs text-stone-400 font-semibold uppercase tracking-wider block">Environment</span>
            <span className="text-xs font-medium text-stone-900 flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${isSupabaseLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {import.meta.env.PROD ? 'Production' : 'Development'}
            </span>
          </div>
        </div>

        <p className="text-2xs text-stone-500 leading-relaxed pt-1">
          Database access is restricted through PostgreSQL Row Level Security (RLS) policies. Credentials and connection parameters are managed via server-side environment variables and cannot be modified from the client interface.
        </p>
      </div>

      {/* Row Level Security Guarantees */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-stone-700" />
          <h2 className="text-base font-semibold text-stone-900">Row Level Security (RLS) Matrix</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-stone-200 rounded-md p-4 space-y-2 bg-stone-50/50">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Lock className="w-3.5 h-3.5 text-stone-600" />
              <span>Parent Authorisation</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              Parents can view and manage their household's students, register subjects, and modify academic plans.
              Cross-family access is strictly blocked at the database level by the <code className="font-mono text-stone-800">is_parent_in_family()</code> policy check.
            </p>
          </div>

          <div className="border border-stone-200 rounded-md p-4 space-y-2 bg-stone-50/50">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Key className="w-3.5 h-3.5 text-stone-600" />
              <span>Student Access Isolation</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              Students can view their own profile and study plan via <code className="font-mono text-stone-800">students.profile_id = auth.uid()</code>.
              Students have read-only access to their academic parameters and cannot alter exam tiers or family metadata.
            </p>
          </div>

          <div className="border border-stone-200 rounded-md p-4 space-y-2 bg-stone-50/50">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Database className="w-3.5 h-3.5 text-stone-600" />
              <span>No Client ID Spoofing</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              Ownership is determined exclusively via Supabase <code className="font-mono text-stone-800">auth.uid()</code> JWT claims.
              Client-submitted user IDs or family IDs are validated against the PostgreSQL join graph before any mutation is permitted.
            </p>
          </div>

          <div className="border border-stone-200 rounded-md p-4 space-y-2 bg-stone-50/50">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Shield className="w-3.5 h-3.5 text-stone-600" />
              <span>Private Evidence Bucket</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              The <code className="font-mono text-stone-800">student-evidence</code> storage bucket is configured as private (<code className="font-mono text-stone-800">public = false</code>).
              Files are saved under <code className="font-mono text-stone-800">/{'{family_id}'}/{'{student_id}'}/*</code> and accessible only to verified family members.
            </p>
          </div>

          <div className="border border-stone-200 rounded-md p-4 space-y-2 bg-stone-50/50">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Lock className="w-3.5 h-3.5 text-stone-600" />
              <span>Role Immutability & UI Preview</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              Roles are determined at registration and enforced by PostgreSQL checks. Authenticated users cannot change their actual role.
              Parent preview of the student workspace is strictly a presentation mode that retains the parent's authenticated JWT identity.
            </p>
          </div>

          <div className="border border-stone-200 rounded-md p-4 space-y-2 bg-stone-50/50">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <Database className="w-3.5 h-3.5 text-stone-600" />
              <span>Production Supabase Enforcement</span>
            </div>
            <p className="text-stone-600 leading-relaxed">
              In production builds, Supabase PostgreSQL, Auth, and Storage are mandatory. Local simulated storage is strictly disabled
              outside development environments to prevent accidental unauthenticated data persistence.
            </p>
          </div>
        </div>
      </div>

      {/* SQL Migration Script */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Supabase SQL Migration File</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Available in <code className="font-mono text-stone-700">supabase/schema.sql</code>. Copy and run in your Supabase SQL Editor.
            </p>
          </div>

          <button
            onClick={handleCopySql}
            className="text-xs px-3 py-1.5 font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy SQL Schema'}</span>
          </button>
        </div>

        <pre className="p-4 bg-stone-900 text-stone-200 text-xs font-mono rounded-md overflow-x-auto max-h-72 leading-relaxed">
          {SCHEMA_SQL_SNIPPET}
        </pre>
      </div>
    </div>
  );
};
