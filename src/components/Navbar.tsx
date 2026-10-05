import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, LogOut, Eye, EyeOff, BookOpen } from 'lucide-react';

interface NavbarProps {
  currentTab: 'today' | 'parent-profile' | 'subjects' | 'learning-state' | 'curriculum' | 'security';
  onSelectTab: (tab: 'today' | 'parent-profile' | 'subjects' | 'learning-state' | 'curriculum' | 'security') => void;
  onOpenConfig: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenConfig }) => {
  const { role, profile, family, signOut, isSupabaseLive, isStudentPreview, setStudentPreview } = useAuth();

  const handleTogglePreview = () => {
    const nextState = !isStudentPreview;
    setStudentPreview(nextState);
    if (nextState) {
      onSelectTab('today');
    } else {
      onSelectTab('parent-profile');
    }
  };

  return (
    <header className="border-b border-stone-200 bg-white/95 sticky top-0 z-40 backdrop-blur-xs">
      {/* If parent is in Preview Mode, display a discrete notice */}
      {role === 'parent' && isStudentPreview && (
        <div className="bg-stone-900 text-stone-200 text-xs px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <strong>Parent Preview Active:</strong> Inspecting student study workspace. Your authenticated role remains <strong>Parent</strong>.
              </span>
            </div>
            <button
              onClick={() => handleTogglePreview()}
              className="px-2 py-0.5 text-2xs font-semibold bg-stone-800 hover:bg-stone-700 text-white rounded transition-colors"
            >
              Exit Preview
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab(role === 'student' ? 'today' : 'parent-profile')}
              className="text-lg font-semibold tracking-tight text-stone-900 hover:text-stone-700 transition-colors text-left"
            >
              HomeEdu Hub
            </button>
            <span className="text-xs text-stone-400 select-none">/</span>
            <span className="text-xs text-stone-600 font-medium truncate max-w-[140px] sm:max-w-xs">
              {family?.name || 'Family Workspace'}
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            {/* Student can only access Today's Study */}
            <button
              onClick={() => onSelectTab('today')}
              className={`hover:text-stone-900 transition-colors whitespace-nowrap pb-1 border-b-2 ${
                currentTab === 'today' ? 'border-stone-900 text-stone-900 font-semibold' : 'border-transparent'
              }`}
            >
              Today's Study
            </button>

            {/* Parent-only tabs (hidden from students) */}
            {role === 'parent' && (
              <>
                <button
                  onClick={() => onSelectTab('parent-profile')}
                  className={`hover:text-stone-900 transition-colors whitespace-nowrap pb-1 border-b-2 ${
                    currentTab === 'parent-profile'
                      ? 'border-stone-900 text-stone-900 font-semibold'
                      : 'border-transparent'
                  }`}
                >
                  Academic Profile
                </button>
                <button
                  onClick={() => onSelectTab('subjects')}
                  className={`hover:text-stone-900 transition-colors whitespace-nowrap pb-1 border-b-2 ${
                    currentTab === 'subjects' ? 'border-stone-900 text-stone-900 font-semibold' : 'border-transparent'
                  }`}
                >
                  Subjects & GCSEs
                </button>
                <button
                  onClick={() => onSelectTab('learning-state')}
                  className={`hover:text-stone-900 transition-colors whitespace-nowrap pb-1 border-b-2 ${
                    currentTab === 'learning-state'
                      ? 'border-stone-900 text-stone-900 font-semibold'
                      : 'border-transparent'
                  }`}
                >
                  Learning State & Baseline
                </button>
              </>
            )}

            <button
              onClick={() => onSelectTab('curriculum')}
              className={`hover:text-stone-900 transition-colors whitespace-nowrap pb-1 border-b-2 flex items-center gap-1.5 ${
                currentTab === 'curriculum' ? 'border-stone-900 text-stone-900 font-semibold' : 'border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-stone-500" />
              <span>Curriculum Knowledge</span>
            </button>

            <button
              onClick={() => onSelectTab('security')}
              className={`hover:text-stone-900 transition-colors whitespace-nowrap pb-1 border-b-2 flex items-center gap-1.5 ${
                currentTab === 'security' ? 'border-stone-900 text-stone-900 font-semibold' : 'border-transparent'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-stone-500" />
              <span>Database & Security</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions (Preview Switcher & User Account) */}
          <div className="flex items-center gap-3">
            {/* Supabase Status */}
            <button
              onClick={onOpenConfig}
              title={isSupabaseLive ? 'Connected to live Supabase project' : 'Running in development sandbox mode'}
              className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1.5 transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${isSupabaseLive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{isSupabaseLive ? 'Supabase Live' : 'Dev Sandbox'}</span>
            </button>

            {/* Parent Preview Control (Visible ONLY to authenticated parents) */}
            {role === 'parent' && (
              <button
                onClick={handleTogglePreview}
                className={`text-xs px-2.5 py-1.5 font-medium border rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  isStudentPreview
                    ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
                    : 'text-stone-700 bg-white border-stone-300 hover:bg-stone-50'
                }`}
                title="Preview the student interface without altering your parent authentication identity"
              >
                {isStudentPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-stone-500" />}
                <span>{isStudentPreview ? 'Exit Student View' : 'Preview Student View'}</span>
              </button>
            )}

            {/* User Profile & Role Info (Immutable) */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium text-stone-900 leading-tight truncate max-w-[120px]">
                  {profile?.full_name || 'User'}
                </div>
                <div className="text-2xs text-stone-400 capitalize">{role} Account</div>
              </div>

              <button
                onClick={() => signOut()}
                title="Sign out of HomeEdu Hub"
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile secondary navigation */}
        <div className="md:hidden flex items-center gap-4 py-2 border-t border-stone-100 overflow-x-auto text-xs font-medium text-stone-600">
          <button
            onClick={() => onSelectTab('today')}
            className={`whitespace-nowrap ${currentTab === 'today' ? 'text-stone-900 font-semibold' : ''}`}
          >
            Today's Study
          </button>
          {role === 'parent' && (
            <>
              <button
                onClick={() => onSelectTab('parent-profile')}
                className={`whitespace-nowrap ${currentTab === 'parent-profile' ? 'text-stone-900 font-semibold' : ''}`}
              >
                Academic Profile
              </button>
              <button
                onClick={() => onSelectTab('subjects')}
                className={`whitespace-nowrap ${currentTab === 'subjects' ? 'text-stone-900 font-semibold' : ''}`}
              >
                Subjects & GCSEs
              </button>
              <button
                onClick={() => onSelectTab('learning-state')}
                className={`whitespace-nowrap ${currentTab === 'learning-state' ? 'text-stone-900 font-semibold' : ''}`}
              >
                Learning State
              </button>
            </>
          )}
          <button
            onClick={() => onSelectTab('security')}
            className={`whitespace-nowrap ${currentTab === 'security' ? 'text-stone-900 font-semibold' : ''}`}
          >
            Database & Security
          </button>
        </div>
      </div>
    </header>
  );
};
