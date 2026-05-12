import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { teacherApi, type AttendanceStudent } from '@/api/teacher';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, EmptyState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';

type Status = '' | 'present' | 'absent' | 'late';
const STATUSES: Exclude<Status, ''>[] = ['present', 'absent', 'late'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function MarkAttendancePage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [classId, setClassId] = useState<number | undefined>(() => {
    const v = searchParams.get('class_id');
    return v ? Number(v) : undefined;
  });
  const [subjectId, setSubjectId] = useState<number | undefined>(() => {
    const v = searchParams.get('subject_id');
    return v ? Number(v) : undefined;
  });
  const [date, setDate] = useState(todayStr);
  const [period, setPeriod] = useState<number | ''>('');
  const [rows, setRows] = useState<Record<number, { status: Status; remarks: string }>>({});

  const { data: assignData } = useQuery({
    queryKey: ['teacher', 'assignments'],
    queryFn: () => teacherApi.assignments(),
  });
  const assignments = assignData?.assignments ?? [];
  const periodsPerDay = assignData?.periods_per_day ?? 8;

  const allFieldsSelected = !!classId && !!subjectId && !!date && typeof period === 'number' && period >= 1;

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['teacher', 'attendance-students', classId, subjectId, date, period],
    queryFn: () =>
      teacherApi.attendanceStudents({
        class_id: classId!,
        subject_id: subjectId!,
        date,
        period: period as number,
      }),
    enabled: allFieldsSelected,
  });

  useEffect(() => {
    if (studentsData) {
      const next: Record<number, { status: Status; remarks: string }> = {};
      studentsData.forEach((s: AttendanceStudent) => {
        next[s.id] = { status: (s.status as Status) || 'present', remarks: s.remarks };
      });
      setRows(next);
    }
  }, [studentsData]);

  const saveMutation = useMutation({
    mutationFn: () =>
      teacherApi.markAttendance({
        class_id: classId!,
        subject_id: subjectId!,
        date,
        period_no: period as number,
        records: Object.entries(rows).map(([id, r]) => ({
          student_id: Number(id),
          status: r.status || 'present',
          remarks: r.remarks,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teacher'] });
      Swal.fire({ icon: 'success', title: 'Attendance saved', timer: 1500, showConfirmButton: false });
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Failed', text: apiErrorMessage(err) }),
  });

  const setAll = (status: Status) => {
    if (!studentsData) return;
    setRows((prev) => {
      const next = { ...prev };
      studentsData.forEach((s) => {
        next[s.id] = { ...next[s.id], status };
      });
      return next;
    });
  };

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

  const periodOptions = useMemo(
    () => Array.from({ length: periodsPerDay }, (_, i) => i + 1),
    [periodsPerDay]
  );

  const students = studentsData ?? [];

  // Identify which fields are missing (for the gate message)
  const missing: string[] = [];
  if (!classId) missing.push('class');
  if (!subjectId) missing.push('subject');
  if (typeof period !== 'number' || period < 1) missing.push('period');
  if (!date) missing.push('date');

  return (
    <div>
      <PageHeader
        icon="fa-user-check"
        title="Mark Attendance"
        subtitle="Select class, subject, date and period — then mark each student"
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Class *</label>
            <select
              className="form-control"
              value={classId ?? ''}
              onChange={(e) => {
                setClassId(e.target.value ? Number(e.target.value) : undefined);
                setSubjectId(undefined);
              }}
            >
              <option value="">— select class —</option>
              {uniqueClasses.map((a) => (
                <option key={a.class_id} value={a.class_id}>{a.class_name} - {a.section}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Subject *</label>
            <select
              className="form-control"
              value={subjectId ?? ''}
              onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={!classId}
            >
              <option value="">{classId ? '— select subject —' : '— pick class first —'}</option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Date *</label>
            <input
              type="date"
              className="form-control"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Period *</label>
            <select
              className="form-control"
              value={period === '' ? '' : String(period)}
              onChange={(e) => setPeriod(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— select period —</option>
              {periodOptions.map((p) => (
                <option key={p} value={p}>Period {p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!allFieldsSelected ? (
        <div className="card" style={{ background: 'var(--warning-light)', borderLeft: '4px solid var(--warning)' }}>
          <p style={{ margin: 0, color: 'var(--warning-dark)' }}>
            <i className="fas fa-triangle-exclamation" style={{ marginRight: 8 }} />
            Select <strong>{missing.join(', ')}</strong> above to load students.
          </p>
        </div>
      ) : studentsLoading ? (
        <LoadingState />
      ) : students.length === 0 ? (
        <EmptyState icon="fa-users" title="No students" description="This class has no students enrolled yet." />
      ) : (
        <>
          <div
            className="card"
            style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          >
            <span className="text-muted text-sm">Quick set all:</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAll(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <><i className="fas fa-spinner fa-spin" /> Saving…</>
              ) : (
                <><i className="fas fa-save" /> Save Attendance ({students.length})</>
              )}
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const cur = rows[s.id] ?? { status: 'present' as Status, remarks: '' };
                    return (
                      <tr key={s.id}>
                        <td>{s.roll_no ?? '—'}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {STATUSES.map((st) => (
                              <button
                                key={st}
                                type="button"
                                className={`btn btn-sm ${cur.status === st ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setRows((p) => ({ ...p, [s.id]: { ...cur, status: st } }))}
                                style={{ textTransform: 'capitalize' }}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="—"
                            value={cur.remarks}
                            onChange={(e) => setRows((p) => ({ ...p, [s.id]: { ...cur, remarks: e.target.value } }))}
                            style={{ minWidth: 180 }}
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
