import React from 'react';
import { Student, StudentSubject } from '../types/database';
import { BookOpen, Sparkles, LineChart, Calendar, Clock, Compass, ShieldAlert } from 'lucide-react';

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

      {/* Main Study Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Primary Column: Today's Learning Workspace (2 cols on large) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Subjects Snapshot */}
          <div className="bg-white border border-stone-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wide text-stone-900 uppercase">
                Active Study Programme
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

          {/* Today's Learning Placeholder */}
          <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-stone-100 rounded-md text-stone-700">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">Today's Learning Workspace</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Phase 1 Technical Foundation: Structured daily timetable and task dispatch.
                </p>
              </div>
            </div>

            <div className="border border-dashed border-stone-200 rounded-md p-6 text-center space-y-2 bg-stone-50/50">
              <Calendar className="w-6 h-6 text-stone-400 mx-auto" />
              <h4 className="text-sm font-medium text-stone-800">Learning Plan Ready for Phase 2</h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                In Phase 2, this workspace will present your daily personalised agenda based on your registered exam
                specifications, balancing foundational topic study, practice problems, and revision intervals.
              </p>
            </div>
          </div>

          {/* AI-Generated Activities Placeholder */}
          <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-stone-100 rounded-md text-stone-700">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">AI Socratic Tutor & Activities</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Extension Point: Socratic inquiry engine and weekly curriculum activities.
                </p>
              </div>
            </div>

            <div className="border border-dashed border-stone-200 rounded-md p-6 text-center space-y-2 bg-stone-50/50">
              <Compass className="w-6 h-6 text-stone-400 mx-auto" />
              <h4 className="text-sm font-medium text-stone-800">Curriculum Grounding Reserved</h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                As specified in the technical roadmap, adaptive AI tutoring and interactive tasks will be integrated
                following the curriculum research phase. All database relations and authentication contexts are already
                configured to support this.
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Column: Progress, Schedule & Family Notes */}
        <div className="space-y-6">
          {/* Progress Placeholder Card */}
          <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-stone-600" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900">
                Progress & Mastery
              </h3>
            </div>
            <div className="border border-dashed border-stone-200 rounded-md p-4 text-center bg-stone-50/50 space-y-2">
              <Clock className="w-5 h-5 text-stone-400 mx-auto" />
              <p className="text-xs text-stone-600 font-medium">Session Logging Architecture</p>
              <p className="text-xs text-stone-500 leading-relaxed">
                Future metric logs will record active study duration, topic comprehension, and spaced repetition intervals
                without artificial game points.
              </p>
            </div>
          </div>

          {/* Academic Notes Card */}
          {student?.notes && (
            <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900">
                Educational Context
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
                {student.notes}
              </p>
            </div>
          )}

          {/* Safe Private Storage Guarantee Card */}
          <div className="bg-stone-100/70 border border-stone-200 rounded-lg p-5 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-stone-700" />
              <h3 className="text-xs font-semibold text-stone-900">Data Protection & Privacy</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              All learning records are protected by database-level Row Level Security policies. Future work portfolio
              uploads will be stored in private, unguessable object storage inaccessible to public queries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
