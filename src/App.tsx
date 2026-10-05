/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { StudentDashboardToday } from './components/StudentDashboardToday';
import { ParentDashboard } from './components/ParentDashboard';
import { SubjectsView } from './components/SubjectsView';
import { DatabaseSecurityView } from './components/DatabaseSecurityView';
import { StudentModal } from './components/StudentModal';
import { SubjectModal } from './components/SubjectModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { CurriculumBrowser } from './components/CurriculumBrowser';
import { LearningStateView } from './components/LearningStateView';
import { databaseService } from './lib/databaseService';
import { Student, StudentSubject } from './types/database';
import { Loader2 } from 'lucide-react';

function HomeEduApp() {
  const { user, profile, role, family, isLoading: authLoading, setStudentPreview, reloadFamily } = useAuth();

  const [currentTab, setCurrentTab] = useState<'today' | 'parent-profile' | 'subjects' | 'learning-state' | 'curriculum' | 'security'>(
    role === 'student' ? 'today' : 'parent-profile'
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Modals state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<StudentSubject | null>(null);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Load family students and subjects
  const loadFamilyData = useCallback(async () => {
    if (!family) return;
    try {
      setDataLoading(true);
      const famStudents = await databaseService.getStudentsForFamily(family.id);
      setStudents(famStudents);

      const targetStudent =
        famStudents.find((s) => s.id === selectedStudent?.id) || famStudents[0] || null;
      setSelectedStudent(targetStudent);

      if (targetStudent) {
        const studentSubs = await databaseService.getSubjectsForStudent(targetStudent.id);
        setSubjects(studentSubs);
      } else {
        setSubjects([]);
      }
    } catch (err) {
      console.error('Failed to load family students/subjects:', err);
    } finally {
      setDataLoading(false);
    }
  }, [family, selectedStudent?.id]);

  useEffect(() => {
    if (user && family) {
      loadFamilyData();
    }
  }, [user, family, loadFamilyData]);

  // Enforce role-based tab access
  useEffect(() => {
    if (role === 'student' && (currentTab === 'parent-profile' || currentTab === 'subjects')) {
      setCurrentTab('today');
    }
  }, [role, currentTab]);

  // Student CRUD
  const handleSaveStudent = async (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      throw new Error('Authentication required: user session is not available.');
    }

    // Step 1: Idempotently ensure the parent has an active family & membership in Supabase
    const defaultFamName = `${profile?.full_name?.split(' ')[0] || 'Our'}'s Family`;
    const { family: verifiedFamily } = await databaseService.ensureParentFamily(user.id, defaultFamName);

    // Keep Auth state in sync
    await reloadFamily();

    if (import.meta.env.DEV) {
      console.log('[Onboarding Diagnostics] Final family ID passed to createStudent():', verifiedFamily.id);
    }

    const payload = {
      ...data,
      family_id: verifiedFamily.id,
    };

    // Step 2: Only create/update student after family & membership succeeded
    if (editingStudent) {
      const updated = await databaseService.updateStudent(editingStudent.id, payload);
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (selectedStudent?.id === updated.id) {
        setSelectedStudent(updated);
      }
    } else {
      const created = await databaseService.createStudent(payload);
      setStudents((prev) => [...prev, created]);
      setSelectedStudent(created);
    }
    await loadFamilyData();
  };

  // Subject CRUD
  const handleSaveSubject = async (data: Omit<StudentSubject, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingSubject) {
      const updated = await databaseService.updateSubject(editingSubject.id, data);
      setSubjects((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } else {
      const created = await databaseService.createSubject(data);
      setSubjects((prev) => [...prev, created]);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (confirm('Are you sure you wish to remove this subject from the study plan?')) {
      await databaseService.deleteSubject(subjectId);
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
    }
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setIsStudentModalOpen(true);
  };

  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setIsStudentModalOpen(true);
  };

  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (subject: StudentSubject) => {
    setEditingSubject(subject);
    setIsSubjectModalOpen(true);
  };

  const handlePreviewStudent = () => {
    setStudentPreview(true);
    setCurrentTab('today');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-stone-600 mb-2" />
        <span className="text-xs text-stone-500 font-medium">Authenticating HomeEdu Hub session...</span>
      </div>
    );
  }

  // Not authenticated: render clean email/password Auth screen
  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenConfig={() => setIsConfigModalOpen(true)}
      />

      <main className="flex-1">
        {dataLoading && (
          <div className="py-2 text-center text-2xs text-stone-400 bg-stone-100 border-b border-stone-200">
            Refreshing family academic data...
          </div>
        )}

        {currentTab === 'today' && (
          <StudentDashboardToday
            student={selectedStudent}
            subjects={subjects}
            onOpenSubjects={() => {
              if (role === 'parent') {
                setCurrentTab('subjects');
              }
            }}
          />
        )}

        {currentTab === 'parent-profile' && role === 'parent' && (
          <ParentDashboard
            student={selectedStudent}
            allStudents={students}
            subjects={subjects}
            onSelectStudent={(s) => {
              setSelectedStudent(s);
              databaseService.getSubjectsForStudent(s.id).then(setSubjects);
            }}
            onEditStudent={handleOpenEditStudent}
            onAddNewStudent={handleOpenAddStudent}
            onPreviewStudent={handlePreviewStudent}
            onAddSubject={handleOpenAddSubject}
            onEditSubject={handleOpenEditSubject}
            onDeleteSubject={handleDeleteSubject}
          />
        )}

        {currentTab === 'subjects' && role === 'parent' && (
          <SubjectsView
            student={selectedStudent}
            subjects={subjects}
            onAddSubject={handleOpenAddSubject}
            onEditSubject={handleOpenEditSubject}
            onDeleteSubject={handleDeleteSubject}
          />
        )}

        {currentTab === 'learning-state' && (
          <LearningStateView
            student={selectedStudent}
            allStudents={students}
            subjects={subjects}
            userRole={role}
            onSelectStudent={(s) => {
              setSelectedStudent(s);
              databaseService.getSubjectsForStudent(s.id).then(setSubjects);
            }}
          />
        )}

        {currentTab === 'curriculum' && <CurriculumBrowser />}

        {currentTab === 'security' && <DatabaseSecurityView />}
      </main>

      {/* Global Modals */}
      {(family || user) && (
        <StudentModal
          isOpen={isStudentModalOpen}
          student={editingStudent}
          familyId={family?.id || ''}
          onClose={() => setIsStudentModalOpen(false)}
          onSave={handleSaveStudent}
        />
      )}

      {selectedStudent && (
        <SubjectModal
          isOpen={isSubjectModalOpen}
          subject={editingSubject}
          studentId={selectedStudent.id}
          onClose={() => setIsSubjectModalOpen(false)}
          onSave={handleSaveSubject}
        />
      )}

      <SupabaseConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-800">HomeEdu Hub</span>
            <span aria-hidden="true">·</span>
            <span>Phase 1 Architecture</span>
            <span aria-hidden="true">·</span>
            <span>Key Stage 3 & GCSE (England)</span>
          </div>

          <div className="flex items-center gap-4 text-stone-500">
            <span>Section 7 Education Act 1996 Aligned</span>
            <span>Private Storage Guarded</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HomeEduApp />
    </AuthProvider>
  );
}
