import React, { useState, useEffect } from 'react';
import {
  curriculumService,
  REFERENCE_SOURCES,
} from '../lib/curriculumService';
import {
  CurriculumFramework,
  CurriculumSource,
  CurriculumSubject,
  EducationStage,
  Specification,
  SpecificationDetail,
  VerificationStatus,
} from '../types/curriculum';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ArrowRight,
  ExternalLink,
  Shield,
  Clock,
  Award,
  HelpCircle,
  GitBranch,
} from 'lucide-react';

export const CurriculumBrowser: React.FC = () => {
  const [frameworks, setFrameworks] = useState<CurriculumFramework[]>([]);
  const [stages, setStages] = useState<EducationStage[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [selectedSpecId, setSelectedSpecId] = useState<string>('00000007-0000-0000-0000-000000000001');
  const [specDetail, setSpecDetail] = useState<SpecificationDetail | null>(null);
  const [selectedTierFilter, setSelectedTierFilter] = useState<'All' | 'Foundation' | 'Higher'>('All');
  const [activeSubTab, setActiveSubTab] = useState<'topics' | 'aos' | 'structure' | 'sources'>('topics');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      try {
        const [fwData, stData, subData, spData] = await Promise.all([
          curriculumService.getCurriculumFrameworks(),
          curriculumService.getEducationStages(),
          curriculumService.getCurriculumSubjects(),
          curriculumService.getSpecifications(),
        ]);
        setFrameworks(fwData);
        setStages(stData);
        setSubjects(subData);
        setSpecifications(spData);

        if (spData.length > 0) {
          const detail = await curriculumService.getSpecificationDetail(spData[0].id);
          setSpecDetail(detail);
        }
      } catch (err) {
        console.error('Failed to load curriculum knowledge base:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  const handleSelectSpecification = async (specId: string) => {
    setSelectedSpecId(specId);
    setLoading(true);
    try {
      const detail = await curriculumService.getSpecificationDetail(specId);
      setSpecDetail(detail);
    } catch (err) {
      console.error('Failed to load specification detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const getVerificationBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'VERIFIED_OFFICIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            VERIFIED OFFICIAL
          </span>
        );
      case 'SECONDARY_SOURCE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <FileText className="w-3 h-3 text-blue-600" />
            SECONDARY SOURCE
          </span>
        );
      case 'DERIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <GitBranch className="w-3 h-3 text-purple-600" />
            DERIVED DESIGN
          </span>
        );
      case 'UNVERIFIED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            REQUIRES VERIFICATION
          </span>
        );
    }
  };

  // Filter topics and concepts by tier
  const filteredTopics = specDetail?.topics?.map((topic) => {
    const concepts = topic.concepts.filter((concept) => {
      if (selectedTierFilter === 'All') return true;
      if (selectedTierFilter === 'Foundation') {
        return concept.tier_eligibility === 'Foundation' || concept.tier_eligibility === 'Both';
      }
      if (selectedTierFilter === 'Higher') {
        return concept.tier_eligibility === 'Higher' || concept.tier_eligibility === 'Both';
      }
      return true;
    });
    return { ...topic, concepts };
  }).filter((topic) => topic.concepts.length > 0 || selectedTierFilter === 'All');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Title & Scope Banner */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <span>Curriculum Knowledge Base</span>
          <span aria-hidden="true">·</span>
          <span>Phase 2A Architecture</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-700 font-medium">Decoupled Domain Model</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              Curriculum Knowledge Base & Specification Architecture
            </h1>
            <p className="text-xs text-stone-600 mt-1 max-w-3xl leading-relaxed">
              Ground-truth curriculum representation grounded in English statutory frameworks, Ofqual subject conditions,
              and accredited exam-board specifications. Contains strict provenance for every concept, without conflating
              curriculum requirements with individual student learning state.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto bg-stone-100 p-2 rounded-lg border border-stone-200 text-xs">
            <span className="text-stone-500 font-medium">Provenance:</span>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-100 text-emerald-800">Official</span>
              <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-blue-100 text-blue-800">Secondary</span>
              <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-purple-100 text-purple-800">Derived</span>
              <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800">Unverified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Relational Hierarchy Drill-Down Selector */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 space-y-4 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600">
          <Layers className="w-4 h-4 text-stone-500" />
          <span>Educational Hierarchy Navigation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Framework / Authority */}
          <div className="p-3 bg-stone-50 rounded-md border border-stone-200 space-y-1">
            <span className="text-3xs text-stone-400 font-semibold uppercase block">1. Framework & Authority</span>
            <span className="font-semibold text-stone-900 block truncate">
              {specDetail?.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                ? 'National Curriculum for England'
                : 'Regulated Qualifications Framework'}
            </span>
            <span className="text-2xs text-stone-500 block truncate">
              {specDetail?.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                ? 'Department for Education (DfE Authority)'
                : 'Ofqual Regulated Awarding Body'}
            </span>
          </div>

          {/* Stage */}
          <div className="p-3 bg-stone-50 rounded-md border border-stone-200 space-y-1">
            <span className="text-3xs text-stone-400 font-semibold uppercase block">2. Education Stage</span>
            <span className="font-semibold text-stone-900 block">
              {specDetail?.stage?.name || 'Key Stage 4 / GCSE'}
            </span>
            <span className="text-2xs text-stone-500 block">
              {specDetail?.stage?.year_groups?.join(', ') || 'Years 10–11'}
            </span>
          </div>

          {/* Subject & Context */}
          <div className="p-3 bg-stone-50 rounded-md border border-stone-200 space-y-1">
            <span className="text-3xs text-stone-400 font-semibold uppercase block">3. Subject & Qualification</span>
            <span className="font-semibold text-stone-900 block">
              {specDetail?.subject?.name || 'Mathematics'}
            </span>
            <span className="text-2xs text-stone-500 block">
              {specDetail?.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                ? 'Non-Exam (Not a Qualification)'
                : (specDetail?.qualification?.title || 'GCSE (9 to 1)')}
            </span>
          </div>

          {/* Specification / Programme Selector */}
          <div className="p-3 bg-stone-50 rounded-md border border-stone-200 space-y-1">
            <span className="text-3xs text-stone-400 font-semibold uppercase block">4. Programme / Specification</span>
            <select
              value={selectedSpecId}
              onChange={(e) => handleSelectSpecification(e.target.value)}
              className="w-full text-xs font-semibold text-stone-900 bg-white border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {specifications.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.specification_code} — {s.title.split(' in ')[0].split('(')[0].trim()}
                </option>
              ))}
            </select>
            <span className="text-2xs text-stone-500 block truncate">
              {specDetail?.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                ? 'DfE Statutory Curriculum'
                : (specDetail?.exam_board?.name || 'Pearson Edexcel')}
            </span>
          </div>
        </div>
      </div>

      {/* Selected Specification Header Details */}
      {specDetail && (
        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-stone-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-stone-900 text-white">
                  {specDetail.specification_code}
                </span>
                <span className="text-xs font-medium text-stone-700">
                  {specDetail.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                    ? (specDetail.authority?.name || 'Department for Education')
                    : (specDetail.exam_board?.name || 'Pearson Edexcel')}
                </span>
                <span className="text-xs text-stone-400">·</span>
                <span className="text-xs text-stone-600">{specDetail.version}</span>
                <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                  {specDetail.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                    ? 'Statutory Programme of Study'
                    : 'Awarding Body Specification'}
                </span>
                {getVerificationBadge(specDetail.verification_status)}
              </div>
              <h2 className="text-lg font-semibold text-stone-900">
                {specDetail.title}
              </h2>
              {specDetail.notes && (
                <p className="text-xs text-stone-600 max-w-3xl leading-relaxed">
                  {specDetail.notes}
                </p>
              )}
            </div>

            {/* Sizing & Candidate Suitability Badges */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {specDetail.glh && (
                <div className="text-center px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md">
                  <span className="text-3xs text-stone-400 font-semibold uppercase block">GLH</span>
                  <span className="text-xs font-semibold text-stone-900">{specDetail.glh} hrs</span>
                </div>
              )}
              {specDetail.tqt && (
                <div className="text-center px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md">
                  <span className="text-3xs text-stone-400 font-semibold uppercase block">TQT</span>
                  <span className="text-xs font-semibold text-stone-900">{specDetail.tqt} hrs</span>
                </div>
              )}
              <div className="text-center px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md">
                <span className="text-3xs text-emerald-700 font-semibold uppercase block">Private Candidate</span>
                <span className="text-xs font-semibold text-emerald-900">Highly Accessible</span>
              </div>
            </div>
          </div>

          {/* Coverage Status Notice Banner */}
          {specDetail.coverage_status === 'PARTIAL_VERTICAL_SLICE' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block text-amber-950">
                  Architectural Verification Slice (Partial Vertical Slice)
                </span>
                <p className="text-2xs text-amber-800 leading-relaxed">
                  This record contains an initial verified architectural slice (6 concepts and 6 learning objectives) engineered to validate the relational hierarchy, tiering demand restrictions, and prerequisite dependencies. It does <strong>not</strong> represent the complete Pearson Edexcel GCSE (9–1) Mathematics syllabus.
                </p>
              </div>
            </div>
          )}

          {specDetail.coverage_status === 'STRUCTURAL_ONLY' && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-900 flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block text-blue-950">
                  Structural Programme Record (Non-Exam / Statutory Stage)
                </span>
                <p className="text-2xs text-blue-800 leading-relaxed">
                  Represents the statutory Key Stage 3 Programme of Study issued by the Department for Education under Section 84 of the Education Act 2002. Operates under assessment without national numeric levels; it is <strong>not</strong> an accredited public examination qualification.
                </p>
              </div>
            </div>
          )}

          {/* Specification Versioning & Regulatory Conditions Differentiation */}
          <div className="bg-stone-50 border border-stone-200/90 rounded-lg p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-stone-600" />
                <h3 className="font-semibold text-stone-900 uppercase tracking-wider text-2xs">
                  Specification Versioning & Regulatory Conditions Differentiation
                </h3>
              </div>
              <span className="text-3xs text-stone-500 font-mono">
                Verified: {specDetail.current_status_verified_date || '2026-10-04'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Awarding Specification Version */}
              <div className="bg-white p-3 rounded-md border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-semibold uppercase text-stone-500">
                    A. Specification Document Version
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {specDetail.is_current ? 'In Force (Current)' : 'Superseded'}
                  </span>
                </div>
                <p className="font-semibold text-stone-900">
                  {specDetail.version}
                  <span className="font-normal text-stone-500 text-2xs ml-1.5">
                    ({specDetail.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                      ? 'DfE National Curriculum'
                      : (specDetail.exam_board?.name || 'Pearson Edexcel')})
                  </span>
                </p>
                <p className="text-2xs text-stone-600 leading-relaxed">
                  Accreditation / ID: <strong>{specDetail.accreditation_number || 'N/A'}</strong> · Effective From:{' '}
                  <strong>{specDetail.effective_from || '2015-09-01'}</strong>
                </p>
                {specDetail.source && (
                  <p className="text-3xs text-stone-500 pt-1 border-t border-stone-100 truncate">
                    Document Source: {specDetail.source.title} ({specDetail.source.version || 'Official'})
                  </p>
                )}
              </div>

              {/* Statutory / Regulatory Conditions */}
              <div className="bg-white p-3 rounded-md border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-semibold uppercase text-stone-500">
                    B. Regulatory / Statutory Assessment Conditions
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    {specDetail.programme_type === 'NATIONAL_CURRICULUM_PROGRAMME'
                      ? 'DfE Statutory Basis'
                      : 'Ofqual Regulated'}
                  </span>
                </div>
                <p className="font-semibold text-stone-900 truncate">
                  {specDetail.regulatory_conditions_reference ||
                    'Ofqual GCSE (9 to 1) Subject-Level Conditions for Mathematics'}
                </p>
                <p className="text-2xs text-stone-600 leading-relaxed">
                  {specDetail.current_status_provenance ||
                    'Governed under statutory regulatory powers. Enforces mandatory AO distributions, tiering demand constraints, and accredited assessment boundaries.'}
                </p>
                {specDetail.regulatory_conditions_source && (
                  <p className="text-3xs text-blue-700 pt-1 border-t border-stone-100 truncate">
                    Statutory Instrument: {specDetail.regulatory_conditions_source.title} (Publisher: {specDetail.regulatory_conditions_source.publisher})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-2 flex-wrap gap-3">
            <div className="flex items-center gap-4 text-xs font-medium">
              <button
                onClick={() => setActiveSubTab('topics')}
                className={`pb-2 border-b-2 transition-colors ${
                  activeSubTab === 'topics'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Curriculum Hierarchy & Concepts ({specDetail.topics?.length || 0} Domains)
              </button>
              <button
                onClick={() => setActiveSubTab('aos')}
                className={`pb-2 border-b-2 transition-colors ${
                  activeSubTab === 'aos'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Assessment Objectives ({specDetail.assessment_objectives?.length || 0})
              </button>
              <button
                onClick={() => setActiveSubTab('structure')}
                className={`pb-2 border-b-2 transition-colors ${
                  activeSubTab === 'structure'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Assessment Structure & Item Schema
              </button>
              <button
                onClick={() => setActiveSubTab('sources')}
                className={`pb-2 border-b-2 transition-colors ${
                  activeSubTab === 'sources'
                    ? 'border-stone-900 text-stone-900 font-semibold'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                Provenance & Sources Register
              </button>
            </div>

            {/* Tier Filter (when on Topics tab) */}
            {activeSubTab === 'topics' && specDetail.has_tiers && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-stone-500 font-medium">Tier Filter:</span>
                {(['All', 'Foundation', 'Higher'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTierFilter(t)}
                    className={`px-2.5 py-1 rounded text-2xs font-medium border transition-colors ${
                      selectedTierFilter === t
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {t === 'All' ? 'All Tiers' : t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TAB 1: CURRICULUM TOPICS & CONCEPTS */}
          {activeSubTab === 'topics' && (
            <div className="space-y-6">
              <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-md text-xs text-stone-600 flex items-start gap-2">
                <Shield className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Decoupled Knowledge Layer:</strong> The entities below represent the accredited syllabus requirements.
                  They do not track student confidence, test scores, or progress. In GCSE Mathematics, certain topics (e.g. Vectors, Circle Theorems, Conditional Probability)
                  are restricted strictly to the <strong>Higher Tier</strong> (grades 4–9) and must never be served to a Foundation candidate.
                </p>
              </div>

              {filteredTopics && filteredTopics.length > 0 ? (
                <div className="space-y-4">
                  {filteredTopics.map((topic) => (
                    <div key={topic.id} className="border border-stone-200 rounded-lg overflow-hidden">
                      <div className="bg-stone-100/70 px-4 py-2.5 flex items-center justify-between border-b border-stone-200">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-stone-700">{topic.code}</span>
                          <span className="text-xs font-semibold text-stone-900">{topic.title}</span>
                          <span className="text-2xs text-stone-500">({topic.external_reference})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-3xs px-1.5 py-0.5 rounded font-medium bg-white text-stone-700 border border-stone-200">
                            Tier: {topic.tier_eligibility}
                          </span>
                          {getVerificationBadge(topic.verification_status)}
                        </div>
                      </div>

                      {/* Concepts under Topic */}
                      <div className="p-4 space-y-4 bg-white divide-y divide-stone-100">
                        {topic.concepts.map((concept) => (
                          <div key={concept.id} className="pt-3 first:pt-0 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-2xs text-stone-500">{concept.code}</span>
                                  <h4 className="text-xs font-semibold text-stone-900">{concept.title}</h4>
                                  <span
                                    className={`text-3xs px-1.5 py-0.5 rounded font-semibold ${
                                      concept.tier_eligibility === 'Higher'
                                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                        : 'bg-stone-100 text-stone-700'
                                    }`}
                                  >
                                    {concept.tier_eligibility} Tier Only
                                  </span>
                                </div>
                                {concept.description && (
                                  <p className="text-xs text-stone-600 leading-relaxed">
                                    {concept.description}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                {concept.estimated_guided_hours && (
                                  <span className="text-2xs text-stone-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-stone-400" />
                                    {concept.estimated_guided_hours}h
                                  </span>
                                )}
                                {getVerificationBadge(concept.verification_status)}
                              </div>
                            </div>

                            {/* Learning Objectives */}
                            {concept.learning_objectives && concept.learning_objectives.length > 0 && (
                              <div className="pl-3 border-l-2 border-stone-200 space-y-1.5 pt-1">
                                <span className="text-3xs font-semibold uppercase tracking-wider text-stone-500 block">
                                  Learning Objectives (Demonstrated Competencies)
                                </span>
                                {concept.learning_objectives.map((lo) => (
                                  <div key={lo.id} className="text-xs text-stone-700 flex items-start gap-2">
                                    <ArrowRight className="w-3 h-3 text-stone-400 shrink-0 mt-0.5" />
                                    <span className="leading-relaxed">{lo.statement}</span>
                                    {lo.target_grade_min && (
                                      <span className="shrink-0 text-3xs px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-mono">
                                        Grades {lo.target_grade_min}–{lo.target_grade_max}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Prerequisite Relationships */}
                            {concept.prerequisites && concept.prerequisites.length > 0 && (
                              <div className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded text-xs space-y-1">
                                <span className="text-3xs font-semibold uppercase tracking-wider text-amber-900 block flex items-center gap-1">
                                  <GitBranch className="w-3 h-3 text-amber-700" />
                                  Strict Disciplinary Prerequisite
                                </span>
                                {concept.prerequisites.map((pr) => (
                                  <p key={pr.id} className="text-xs text-amber-800 leading-relaxed">
                                    {pr.justification}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-stone-500 border border-dashed border-stone-200 rounded-lg">
                  No topics matching the selected tier filter.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASSESSMENT OBJECTIVES (AOs) */}
          {activeSubTab === 'aos' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-md text-xs text-stone-600">
                <p>
                  <strong>Statutory Ofqual Regulation:</strong> All GCSE Mathematics exam boards (Pearson Edexcel, AQA, OCR, Eduqas)
                  are legally bound by Ofqual Subject Level Conditions to allocate exactly 50% / 40% to AO1, 25% / 30% to AO2, and 25% / 30% to AO3.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {specDetail.assessment_objectives?.map((ao) => (
                  <div key={ao.id} className="p-4 border border-stone-200 rounded-lg bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-900 text-white">
                        {ao.code}
                      </span>
                      {getVerificationBadge(ao.verification_status)}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-stone-900">{ao.title}</h4>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {ao.description}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-3xs text-stone-400 block font-semibold">FOUNDATION</span>
                        <span className="font-mono font-semibold text-stone-900">{ao.weighting_foundation}%</span>
                      </div>
                      <div>
                        <span className="text-3xs text-stone-400 block font-semibold">HIGHER</span>
                        <span className="font-mono font-semibold text-stone-900">{ao.weighting_higher}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ASSESSMENT STRUCTURE & ITEM SCHEMA */}
          {activeSubTab === 'structure' && (
            <div className="space-y-6">
              {/* Paper Breakdown */}
              <div className="border border-stone-200 rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                    Terminal Examination Structure
                  </h3>
                  <span className="text-2xs font-mono font-semibold text-stone-700">
                    Total: {specDetail.assessment_structure?.total_marks || 240} Marks across {specDetail.assessment_structure?.papers_count || 3} Papers
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {specDetail.assessment_structure?.paper_details.map((p) => (
                    <div key={p.paper_number} className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                      <span className="text-3xs text-stone-400 font-semibold uppercase block">Paper {p.paper_number}</span>
                      <span className="font-semibold text-stone-900 block">{p.title}</span>
                      <div className="text-2xs text-stone-600 pt-1 space-y-0.5">
                        <p>Marks: <strong>{p.marks}</strong></p>
                        <p>Duration: <strong>{p.duration_minutes} mins (1h 30m)</strong></p>
                        <p>Calculator: <strong>{p.calculator_allowed ? 'Allowed' : 'Prohibited'}</strong></p>
                        <p>Weighting: <strong>{p.weighting_percentage}%</strong></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Structural Item Models (No Copyrighted Content) */}
              <div className="border border-stone-200 rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                      Assessment Item Structural Schema (Phase 2A)
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Represents item metadata, target grade demand, and AO attribution without reproducing copyrighted past-paper content.
                    </p>
                  </div>
                  <span className="text-2xs px-2 py-0.5 rounded font-mono bg-stone-100 text-stone-700">
                    {specDetail.assessment_items?.length || 0} Structural Archetypes
                  </span>
                </div>

                <div className="space-y-3">
                  {specDetail.assessment_items?.map((item) => (
                    <div key={item.id} className="p-3 border border-stone-200 rounded-md bg-stone-50/50 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-stone-900">{item.item_reference}</span>
                          <span className="text-3xs px-1.5 py-0.5 rounded font-medium bg-stone-200 text-stone-800">
                            {item.tier} Tier
                          </span>
                          <span className="text-3xs px-1.5 py-0.5 rounded font-medium bg-stone-200 text-stone-800">
                            {item.item_type}
                          </span>
                          {item.is_common_targeted_question && (
                            <span className="text-3xs px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Common Overlap Question ({'>='}20% Rule)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-stone-700">{item.total_marks} Marks</span>
                          {getVerificationBadge(item.verification_status)}
                        </div>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-stone-600 leading-relaxed">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SOURCES & PROVENANCE REGISTER */}
          {activeSubTab === 'sources' && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-md text-xs text-stone-600">
                <p>
                  <strong>Traceability Constitution:</strong> Every curriculum assertion in HomeEdu Hub must be traceable
                  to an authoritative statutory instrument, regulatory standard, or accredited awarding specification.
                </p>
              </div>

              <div className="space-y-3">
                {REFERENCE_SOURCES.map((src) => (
                  <div key={src.id} className="p-4 border border-stone-200 rounded-lg bg-white space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-2xs font-bold text-stone-600">{src.source_code}</span>
                          <span className="text-3xs px-1.5 py-0.5 rounded font-medium bg-stone-100 text-stone-700">
                            {src.source_type}
                          </span>
                          {getVerificationBadge(src.verification_status)}
                        </div>
                        <h4 className="text-xs font-semibold text-stone-900 mt-1">{src.title}</h4>
                        <p className="text-xs text-stone-500">
                          Publisher: <strong>{src.publisher}</strong> · Jurisdiction: <strong>{src.jurisdiction}</strong> · Version: <strong>{src.version || 'Current'}</strong>
                        </p>
                      </div>

                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition-colors"
                          title="Open official source URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    {src.notes && (
                      <p className="text-xs text-stone-600 bg-stone-50 p-2 rounded border border-stone-100 leading-relaxed">
                        {src.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
