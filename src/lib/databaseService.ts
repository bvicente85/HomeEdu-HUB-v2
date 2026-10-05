import {
  Family,
  FamilyMember,
  Profile,
  Student,
  StudentSubject,
  UserRole,
} from '../types/database';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  isSupabaseReachable,
  markSupabaseConnectivityFailed,
  isProductionEnvironment,
} from './supabase';

const LOCAL_STORAGE_DB_KEY = 'homeedu_mock_db_dev_v2';

interface LocalDatabaseState {
  profiles: Profile[];
  families: Family[];
  familyMembers: FamilyMember[];
  students: Student[];
  subjects: StudentSubject[];
}

async function withSupabaseFallback<T>(
  queryFn: () => Promise<T>,
  fallbackFn: () => Promise<T> | T
): Promise<T> {
  if (!isSupabaseReachable()) {
    return fallbackFn();
  }
  try {
    return await queryFn();
  } catch (err: unknown) {
    const isNetworkError =
      err instanceof TypeError ||
      (err instanceof Error &&
        (err.message.includes('fetch') ||
          err.message.includes('Network') ||
          err.message.includes('Failed to fetch') ||
          err.name === 'TypeError'));

    if (isNetworkError && !isProductionEnvironment()) {
      console.warn('Supabase remote network failure (Failed to fetch). Activating local development store.');
      markSupabaseConnectivityFailed(true);
      return fallbackFn();
    }
    throw err;
  }
}

function getInitialLocalData(): LocalDatabaseState {
  const defaultParentId = '00000000-0000-0000-0000-000000000001';
  const defaultStudentId = '00000000-0000-0000-0000-000000000002';
  const defaultFamilyId = '11111111-1111-1111-1111-111111111111';
  const studentRecordId = '22222222-2222-2222-2222-222222222222';

  return {
    profiles: [
      {
        id: defaultParentId,
        role: 'parent',
        full_name: 'Sarah Harrison',
        email: 'parent@homeeduhub.internal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: defaultStudentId,
        role: 'student',
        full_name: 'Oliver Harrison',
        email: 'oliver@homeeduhub.internal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    families: [
      {
        id: defaultFamilyId,
        name: 'The Harrison Family',
        created_by: defaultParentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    familyMembers: [
      {
        id: '33333333-3333-3333-3333-333333333331',
        family_id: defaultFamilyId,
        profile_id: defaultParentId,
        role: 'parent',
        created_at: new Date().toISOString(),
      },
      {
        id: '33333333-3333-3333-3333-333333333332',
        family_id: defaultFamilyId,
        profile_id: defaultStudentId,
        role: 'student',
        created_at: new Date().toISOString(),
      },
    ],
    students: [
      {
        id: studentRecordId,
        family_id: defaultFamilyId,
        profile_id: defaultStudentId,
        first_name: 'Oliver',
        date_of_birth: '2010-04-18',
        education_type: 'Home education',
        year_group: 'Year 10',
        gcse_status: 'Currently studying GCSEs',
        notes: 'Transitioned to elective home education for Key Stage 4 independent study pace.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    subjects: [
      {
        id: '44444444-4444-4444-4444-444444444441',
        student_id: studentRecordId,
        subject_name: 'Mathematics',
        qualification: 'GCSE',
        exam_board: 'Edexcel / Pearson',
        specification_id: '00000007-0000-0000-0000-000000000001',
        specification_code: '1MA1',
        tier: 'Higher',
        target_exam_year: 2027,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '44444444-4444-4444-4444-444444444442',
        student_id: studentRecordId,
        subject_name: 'English Language',
        qualification: 'GCSE',
        exam_board: 'AQA',
        specification_id: null,
        specification_code: '8700',
        tier: 'Not applicable',
        target_exam_year: 2027,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '44444444-4444-4444-4444-444444444443',
        student_id: studentRecordId,
        subject_name: 'Combined Science: Trilogy',
        qualification: 'GCSE',
        exam_board: 'AQA',
        specification_id: null,
        specification_code: '8464',
        tier: 'Higher',
        target_exam_year: 2027,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        student_id: studentRecordId,
        subject_name: 'History',
        qualification: 'GCSE',
        exam_board: 'Edexcel / Pearson',
        specification_id: null,
        specification_code: '1HI0',
        tier: 'Not applicable',
        target_exam_year: 2027,
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };
}

function loadDevLocalDb(): LocalDatabaseState {
  if (isProductionEnvironment()) {
    throw new Error('Local database persistence is prohibited in production mode. Supabase is mandatory.');
  }

  if (typeof window === 'undefined') return getInitialLocalData();
  const raw = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
  if (!raw) {
    const initial = getInitialLocalData();
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const initial = getInitialLocalData();
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(initial));
    return initial;
  }
}

function saveDevLocalDb(db: LocalDatabaseState): void {
  if (isProductionEnvironment()) {
    throw new Error('Local database persistence is prohibited in production mode.');
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(db));
  }
}

// -----------------------------------------------------------------------------
// Database Operations Service
// Strictly enforces production Supabase connectivity with RLS.
// -----------------------------------------------------------------------------

export const databaseService = {
  // Profiles
  async getProfile(userId: string): Promise<Profile | null> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          if (isProductionEnvironment()) throw error;
          console.warn('Supabase getProfile warning:', error.message);
        } else if (data) {
          return data as Profile;
        }

        if (isProductionEnvironment()) {
          throw new Error('Failed to load profile: Supabase connection required in production.');
        }

        const localDb = loadDevLocalDb();
        return localDb.profiles.find((p) => p.id === userId) || null;
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Failed to load profile: Supabase connection required in production.');
        }
        const localDb = loadDevLocalDb();
        return localDb.profiles.find((p) => p.id === userId) || null;
      }
    );
  },

  async createProfile(profile: { id: string; role: UserRole; full_name: string; email?: string }): Promise<Profile> {
    const now = new Date().toISOString();
    const newRecord: Profile = {
      id: profile.id,
      role: profile.role, // Established on registration, cannot be mutated
      full_name: profile.full_name,
      email: profile.email,
      created_at: now,
      updated_at: now,
    };

    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;

        // Retrieve current session from client
        const { data: sessionData } = await supabase.auth.getSession();
        let activeUserId = sessionData?.session?.user?.id;

        if (!activeUserId) {
          // Fallback: verify with auth server
          const { data: authData } = await supabase.auth.getUser();
          activeUserId = authData?.user?.id;
        }

        if (!activeUserId) {
          throw new Error('Authentication required: Cannot create profile without an active authenticated session.');
        }
        if (activeUserId !== profile.id) {
          throw new Error('Unauthorized: Profile ID must match the currently authenticated user ID.');
        }

        const { data, error } = await supabase
          .from('profiles')
          .upsert(newRecord, { onConflict: 'id' })
          .select()
          .single();

        if (error) {
          // Fallback: check if handle_new_user trigger already created the profile
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id)
            .maybeSingle();

          if (existingProfile) {
            return existingProfile as Profile;
          }
          throw new Error(`Failed to create profile: ${error.message}`);
        }
        return data as Profile;
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Profile creation requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        localDb.profiles.push(newRecord);
        saveDevLocalDb(localDb);
        return newRecord;
      }
    );
  },

  // Families
  async getFamilyForUser(userId: string): Promise<{ family: Family; role: UserRole } | null> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data: memberData, error: memberError } = await supabase
          .from('family_members')
          .select('family_id, role, families (*)')
          .eq('profile_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (memberError && isProductionEnvironment()) {
          throw memberError;
        }

        if (!memberError && memberData && memberData.families) {
          return {
            family: memberData.families as unknown as Family,
            role: memberData.role as UserRole,
          };
        }

        // Check if user created a family that is waiting for membership
        const { data: createdFams } = await supabase
          .from('families')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (createdFams && createdFams.length > 0) {
          return {
            family: createdFams[0] as Family,
            role: 'parent',
          };
        }

        return null;
      },
      () => {
        if (isProductionEnvironment()) return null;
        const localDb = loadDevLocalDb();
        const member = localDb.familyMembers.find((m) => m.profile_id === userId);
        if (!member) {
          return null;
        }
        const family = localDb.families.find((f) => f.id === member.family_id);
        if (!family) return null;
        return { family, role: member.role };
      }
    );
  },

  async ensureParentFamily(
    userId: string,
    defaultName: string
  ): Promise<{ family: Family; member: FamilyMember }> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;

        // 1. Verify active session user matches userId
        const { data: authData } = await supabase.auth.getUser();
        const currentAuthId = authData?.user?.id;
        if (!currentAuthId || currentAuthId !== userId) {
          throw new Error('Authentication required: user ID must match active Supabase session.');
        }

        let selectedFamily: Family | null = null;
        let familyReused = false;

        // 2. Query public.families for an existing family where created_by = auth.uid()
        const { data: existingFamilies, error: famQueryErr } = await supabase
          .from('families')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false });

        if (famQueryErr) {
          throw new Error(`Failed to query existing families: ${famQueryErr.message}`);
        }

        if (existingFamilies && existingFamilies.length > 0) {
          selectedFamily = existingFamilies[0] as Family;
          familyReused = true;

          if (existingFamilies.length > 1 && import.meta.env.DEV) {
            console.warn(
              `[Onboarding Diagnostics] Found ${existingFamilies.length} duplicate families created by user ${userId}. Reusing family ID: ${selectedFamily.id}.`
            );
          }
        } else {
          const newFamilyId = crypto.randomUUID();
          const now = new Date().toISOString();
          const newFamilyRecord: Family = {
            id: newFamilyId,
            name: defaultName,
            created_by: userId,
            created_at: now,
            updated_at: now,
          };

          const { error: insertFamErr } = await supabase
            .from('families')
            .insert(newFamilyRecord);

          if (insertFamErr) {
            throw new Error(`Failed during family creation: ${insertFamErr.message}`);
          }

          selectedFamily = newFamilyRecord;
          familyReused = false;
        }

        let selectedMember: FamilyMember | null = null;
        let membershipReused = false;

        const { data: existingMembership, error: memQueryErr } = await supabase
          .from('family_members')
          .select('*')
          .eq('family_id', selectedFamily.id)
          .eq('profile_id', userId)
          .maybeSingle();

        if (memQueryErr) {
          throw new Error(`Failed to check family membership: ${memQueryErr.message}`);
        }

        if (existingMembership) {
          selectedMember = existingMembership as FamilyMember;
          membershipReused = true;
        } else {
          const newMemberId = crypto.randomUUID();
          const newMemberRecord: FamilyMember = {
            id: newMemberId,
            family_id: selectedFamily.id,
            profile_id: userId,
            role: 'parent',
            created_at: new Date().toISOString(),
          };

          const { error: insertMemErr } = await supabase
            .from('family_members')
            .insert(newMemberRecord);

          if (insertMemErr) {
            throw new Error(`Failed during family membership creation: ${insertMemErr.message}`);
          }

          selectedMember = newMemberRecord;
          membershipReused = false;
        }

        return { family: selectedFamily, member: selectedMember };
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Family provisioning requires live Supabase connection in production.');
        }

        const localDb = loadDevLocalDb();
        let member = localDb.familyMembers.find((m) => m.profile_id === userId);
        let family = member ? localDb.families.find((f) => f.id === member.family_id) : null;

        if (!family) {
          const familyId = crypto.randomUUID();
          const memberId = crypto.randomUUID();
          const now = new Date().toISOString();
          const newFam: Family = { id: familyId, name: defaultName, created_by: userId, created_at: now, updated_at: now };
          const newMem: FamilyMember = { id: memberId, family_id: familyId, profile_id: userId, role: 'parent', created_at: now };
          localDb.families.push(newFam);
          localDb.familyMembers.push(newMem);
          saveDevLocalDb(localDb);
          return { family: newFam, member: newMem };
        }

        return { family, member: member! };
      }
    );
  },

  async createFamily(name: string, userId: string): Promise<{ family: Family; member: FamilyMember }> {
    return this.ensureParentFamily(userId, name);
  },

  // Students
  async getStudentsForFamily(familyId: string): Promise<Student[]> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('family_id', familyId)
          .order('created_at', { ascending: true });

        if (error && isProductionEnvironment()) throw error;
        if (!error && data) return data as Student[];
        return [];
      },
      () => {
        if (isProductionEnvironment()) return [];
        const localDb = loadDevLocalDb();
        return localDb.students.filter((s) => s.family_id === familyId);
      }
    );
  },

  async getStudentById(studentId: string): Promise<Student | null> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .maybeSingle();

        if (error && isProductionEnvironment()) throw error;
        if (!error && data) return data as Student;
        return null;
      },
      () => {
        if (isProductionEnvironment()) return null;
        const localDb = loadDevLocalDb();
        return localDb.students.find((s) => s.id === studentId) || null;
      }
    );
  },

  async createStudent(
    studentData: Omit<Student, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Student> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: Student = {
      ...studentData,
      id,
      created_at: now,
      updated_at: now,
    };

    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase.from('students').insert(record).select().single();
        if (error) {
          throw new Error(`Failed during student creation: ${error.message}`);
        }
        return data as Student;
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Student creation requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        localDb.students.push(record);
        saveDevLocalDb(localDb);
        return record;
      }
    );
  },

  async updateStudent(studentId: string, updates: Partial<Student>): Promise<Student> {
    const now = new Date().toISOString();

    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('students')
          .update({ ...updates, updated_at: now })
          .eq('id', studentId)
          .select()
          .single();

        if (error) throw new Error(`Failed to update student: ${error.message}`);
        return data as Student;
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Student update requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        const index = localDb.students.findIndex((s) => s.id === studentId);
        if (index === -1) {
          throw new Error(`Student with ID ${studentId} not found`);
        }
        localDb.students[index] = {
          ...localDb.students[index],
          ...updates,
          updated_at: now,
        };
        saveDevLocalDb(localDb);
        return localDb.students[index];
      }
    );
  },

  async deleteStudent(studentId: string): Promise<void> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { error } = await supabase.from('students').delete().eq('id', studentId);
        if (error) throw new Error(`Failed to delete student: ${error.message}`);
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Student deletion requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        localDb.students = localDb.students.filter((s) => s.id !== studentId);
        localDb.subjects = localDb.subjects.filter((sub) => sub.student_id !== studentId);
        saveDevLocalDb(localDb);
      }
    );
  },

  // Subjects
  async getSubjectsForStudent(studentId: string): Promise<StudentSubject[]> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('student_subjects')
          .select('*')
          .eq('student_id', studentId)
          .order('subject_name', { ascending: true });

        if (error && isProductionEnvironment()) throw error;
        if (!error && data) return data as StudentSubject[];
        return [];
      },
      () => {
        if (isProductionEnvironment()) return [];
        const localDb = loadDevLocalDb();
        return localDb.subjects.filter((sub) => sub.student_id === studentId);
      }
    );
  },

  async createSubject(
    subjectData: Omit<StudentSubject, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StudentSubject> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: StudentSubject = {
      ...subjectData,
      id,
      created_at: now,
      updated_at: now,
    };

    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase.from('student_subjects').insert(record).select().single();
        if (error) throw new Error(`Failed to create subject: ${error.message}`);
        return data as StudentSubject;
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Subject creation requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        localDb.subjects.push(record);
        saveDevLocalDb(localDb);
        return record;
      }
    );
  },

  async updateSubject(subjectId: string, updates: Partial<StudentSubject>): Promise<StudentSubject> {
    const now = new Date().toISOString();

    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('student_subjects')
          .update({ ...updates, updated_at: now })
          .eq('id', subjectId)
          .select()
          .single();

        if (error) throw new Error(`Failed to update subject: ${error.message}`);
        return data as StudentSubject;
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Subject update requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        const index = localDb.subjects.findIndex((s) => s.id === subjectId);
        if (index === -1) {
          throw new Error(`Subject with ID ${subjectId} not found`);
        }
        localDb.subjects[index] = {
          ...localDb.subjects[index],
          ...updates,
          updated_at: now,
        };
        saveDevLocalDb(localDb);
        return localDb.subjects[index];
      }
    );
  },

  async deleteSubject(subjectId: string): Promise<void> {
    return withSupabaseFallback(
      async () => {
        const supabase = getSupabaseClient()!;
        const { error } = await supabase.from('student_subjects').delete().eq('id', subjectId);
        if (error) throw new Error(`Failed to delete subject: ${error.message}`);
      },
      () => {
        if (isProductionEnvironment()) {
          throw new Error('Subject deletion requires live Supabase connection in production.');
        }
        const localDb = loadDevLocalDb();
        localDb.subjects = localDb.subjects.filter((s) => s.id !== subjectId);
        saveDevLocalDb(localDb);
      }
    );
  },
};
