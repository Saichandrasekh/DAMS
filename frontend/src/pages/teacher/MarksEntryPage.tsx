import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { teacherApi } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

export function MarksEntryPage() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [examId, setExamId] = useState<number | undefined>();
  const [rows, setRows] = useState<Record<number, { marks: string; remarks: string }>>({});

  const { data: assignData } = useQuery({
    queryKey: ['teacher', 'assignments'],
    queryFn: () => teacherApi.assignments(),
  });
  const assignments = assignData?.assignments ?? [];
  const { data: exams } = useQuery({
    queryKey: ['teacher', 'marks-exams'],
    queryFn: () => teacherApi.marksExams(),
  });

  const subjects = useMemo(() => {
    if (!classId) return [];
    return assignments.filter((a) => a.class_id === classId);
  }, [assignments, classId]);

  const uniqueClasses = useMemo(() => {
    const seen = new Set<number>();
    return assignments.filter((a) => {
      if (seen.has(a.class_id)) return false;
      seen.add(a.class_id);
      return true;
    });
  }, [assignments]);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['teacher', 'marks-students', classId, subjectId, examId],
    queryFn: () => teacherApi.marksStudents({ class_id: classId!, subject_id: subjectId!, exam_id: examId! }),
    enabled: !!classId && !!subjectId && !!examId,
  });

  useEffect(() => {
    if (studentsData) {
      const next: Record<number, { marks: string; remarks: string }> = {};
      studentsData.forEach((s) => {
        next[s.id] = { marks: s.marks, remarks: s.remarks };
      });
      setRows(next);
    }
  }, [studentsData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      teacherApi.saveMarks({
        exam_id: examId!,
        subject_id: subjectId!,
        records: Object.entries(rows).map(([id, r]) => ({
          student_id: Number(id),
          marks: r.marks,
          remarks: r.remarks,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher'] });
      Swal.fire({ icon: 'success', title: 'Marks saved', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const students = studentsData ?? [];

  return (
    <div>
      <PageHeader icon="fa-pen-to-square" title="Marks Entry" subtitle="Enter exam marks for your students" />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Exam</label>
            <select className="form-control" value={examId ?? ''} onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">— select exam —</option>
              {exams?.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name} ({ex.exam_date})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Class</label>
            <select
              className="form-control"
              value={classId ?? ''}
              onChange={(e) => { setClassId(e.target.value ? Number(e.target.value) : undefined); setSubjectId(undefined); }}
            >
              <option value="">— select class —</option>
              {uniqueClasses.map((a) => (
                <option key={a.class_id} value={a.class_id}>{a.class_name} - {a.section}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Subject</label>
            <select
              className="form-control"
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={!classId}
            >
              <option value="">— select subject —</option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!classId || !subjectId || !examId ? (
        <div className="card" style={{ background: 'var(--warning-light)', borderLeft: '4px solid var(--warning)' }}>
          <p style={{ margin: 0, color: 'var(--warning-dark)' }}>
            <i className="fas fa-triangle-exclamation" style={{ marginRight: 8 }} />
            Select <strong>{[!examId && 'exam', !classId && 'class', !subjectId && 'subject'].filter(Boolean).join(', ')}</strong> above to load students.
          </p>
        </div>
      ) : studentsLoading ? (
        <LoadingState />
      ) : students.length === 0 ? (
        <EmptyState icon="fa-users" title="No students" />
      ) : (
        <>
          <div className="card" style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : <><i className="fas fa-save" /> Save Marks</>}
            </button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Name</th>
                    <th>Marks</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const cur = rows[s.id] ?? { marks: '', remarks: '' };
                    return (
                      <tr key={s.id}>
                        <td>{s.roll_no ?? '—'}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            style={{ maxWidth: 100 }}
                            value={cur.marks}
                            onChange={(e) => setRows((p) => ({ ...p, [s.id]: { ...cur, marks: e.target.value } }))}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="—"
                            value={cur.remarks}
                            onChange={(e) => setRows((p) => ({ ...p, [s.id]: { ...cur, remarks: e.target.value } }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
