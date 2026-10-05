import React from 'react';
import { Student, StudentSubject } from '../types/database';
import { BookOpen, LineChart, Calendar, Clock, ShieldAlert } from 'lucide-react';
import { StudentActionQueueView } from './student/StudentActionQueueView';

interface StudentDashboardTodayProps {
  student: Student | null;
  subjects: StudentSubject[];
  onOpenSubjects: () => void;
}

export const StudentDashboardToday: React.FC<StudentDashboardTodayProps> = ({
  student,
  subjects,
  onOpenSubjects,
}) => {
  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const studentName = student?.first_name || 'Student';
  const stage = student?.year_group || 'Year 10';
  const educationType = student?.education_type || 'Home education';
  const gcseStatus = student?.gcse_status || 'Currently studying GCSEs';

  const activeSubjects = subjects.filter((s) => s.status === 'Active');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Editorial Header Section */}
      <section className="border-b border-stone-200 pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
              <span>{todayFormatted}</span>
              <span aria-hidden="true">·</span>
              <span>Independent Study Environment</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900">
              {getGreeting()}, {studentName}
            </h1>
            {/* Zero-Pill unboxed metadata */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 mt-2 font-medium">
              <span className="text-stone-900">{stage}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span>{educationType}</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-stone-700">{gcseStatus}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSubjects}
              className="text-xs px-3.5 py-2 font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors"
            >
              View All {subjects.length} Subjects
            </button>
          </div>
        </div>
      </section>

      {/* Main Action Queue Section */}
      <section>
        <StudentActionQueueView student={student} subjects={subjects} />
      </section>

      {/* Active Subjects Snapshot & Context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4 border-t border-stone-200">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
              Active Enrolled Subjects
            </h2>
            <span className="text-xs text-stone-500 font-mono tabular-nums">
              {activeSubjects.length} enrolled
            </span>
          </div>

          {activeSubjects.length === 0 ? (
            <div className="py-6 text-center text-xs text-stone-500">
              No active subjects assigned yet. Your parent can add subjects in the Academic Profile.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {activeSubjects.map((sub) => (
                <div key={sub.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-stone-900">{sub.subject_name}</span>
                    <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                      <span>{sub.qualification}</span>
                      <span aria-hidden="true">·</span>
                      <span>{sub.exam_board}</span>
                      {sub.specification_code && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-stone-600">{sub.specification_code}</span>
                        </>
                      )}
                      {sub.tier && sub.tier !== 'Not applicable' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{sub.tier} Tier</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {sub.target_exam_year && (
                      <span className="text-xs font-mono tabular-nums text-stone-500 block">
                        Exam {sub.target_exam_year}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safe Storage & Guidance */}
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-stone-700" />
            <h3 className="text-xs font-semibold text-stone-900">Learning Records Privacy</h3>
          </div>
          <p className="text-xs text-stone-600 leading-relaxed">
            Your assessment check-ins and evidence records are saved securely with database-level isolation.
          </p>
        </div>
      </div>
    </div>
  );
};
