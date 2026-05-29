import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { adminApi } from '@/api/admin';
import { Modal } from '@/components/Modal';
import { LoadingState, ErrorState } from '@/components/LoadingState';
import { apiErrorMessage } from '@/lib/api';
import type { ClassRow } from '@/types/admin';

interface Props {
  open: boolean;
  sourceClass: ClassRow | null;
  allClasses: ClassRow[];
  onClose: () => void;
}

export function PromoteClassModal({ open, sourceClass, allClasses, onClose }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'promote' | 'graduate'>('promote');
  const [targetClassId, setTargetClassId] = useState<number | ''>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState('');
  const [keepRollNos, setKeepRollNos] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'class-roster', sourceClass?.id],
    queryFn: () => adminApi.classRoster(sourceClass!.id),
    enabled: open && !!sourceClass,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setMode('promote');
      setTargetClassId('');
      setSelected(new Set());
      setReason('');
      setKeepRollNos(true);
    }
  }, [open, sourceClass]);

  // Pre-select all students by default when roster loads
  useEffect(() => {
    if (data?.students) {
      setSelected(new Set(data.students.map((s) => s.id)));
    }
  }, [data]);

  const otherClasses = useMemo(
    () => allClasses.filter((c) => c.id !== sourceClass?.id),
    [allClasses, sourceClass]
  );

  const targetClass = useMemo(
    () => otherClasses.find((c) => c.id === targetClassId),
    [otherClasses, targetClassId]
  );

  // Fetch destination roster to check for roll-number collisions
  const { data: targetRoster } = useQuery({
    queryKey: ['admin', 'class-roster', targetClassId],
    queryFn: () => adminApi.classRoster(targetClassId as number),
    enabled: mode === 'promote' && typeof targetClassId === 'number',
  });

  const conflicts = useMemo(() => {
    if (mode !== 'promote' || !keepRollNos || !targetRoster || !data) return [];
    const targetRolls = new Set(
      targetRoster.students
        .map((s) => (s.roll_no ?? '').trim())
        .filter((r) => r !== '')
    );
    return data.students
      .filter((s) => selected.has(s.id))
      .filter((s) => {
        const r = (s.roll_no ?? '').trim();
        return r !== '' && targetRolls.has(r);
      })
      .map((s) => ({ name: s.name, roll_no: s.roll_no }));
  }, [mode, keepRollNos, targetRoster, data, selected]);

  const promoteMutation = useMutation({
    mutationFn: () =>
      adminApi.promote({
        from_class_id: sourceClass!.id,
        to_class_id: mode === 'graduate' ? null : (targetClassId as number),
        student_ids: Array.from(selected),
        keep_roll_nos: keepRollNos,
        reason: reason || undefined,
      }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      if (resp.graduated) {
        Swal.fire({
          icon: 'success',
          title: resp.message,
          html: `
            <p>The graduated student(s) are no longer visible in active class lists.</p>
            <p>You can find them under <strong>Batches → Graduated</strong>.</p>
          `,
          showCancelButton: true,
          confirmButtonText: 'View graduated',
          cancelButtonText: 'OK',
        }).then((r) => {
          if (r.isConfirmed) {
            window.location.assign('/admin/batches');
          }
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: resp.message,
          timer: 2200,
          showConfirmButton: false,
        });
      }
      onClose();
    },
    onError: (err) => Swal.fire({ icon: 'error', title: 'Promotion failed', text: apiErrorMessage(err) }),
  });

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!data) return;
    setSelected(new Set(data.students.map((s) => s.id)));
  };
  const selectNone = () => setSelected(new Set());

  const handleSubmit = async () => {
    if (selected.size === 0) {
      Swal.fire({ icon: 'warning', title: 'Pick at least one student' });
      return;
    }
    if (mode === 'promote' && !targetClassId) {
      Swal.fire({ icon: 'warning', title: 'Choose a destination class' });
      return;
    }
    const target = otherClasses.find((c) => c.id === targetClassId);
    const title = mode === 'graduate'
      ? `Graduate ${selected.size} student(s)?`
      : `Promote ${selected.size} student(s) to ${target?.name}-${target?.section}?`;
    const text = mode === 'graduate'
      ? 'They will be removed from their class and archived. Attendance and marks history are kept. Cannot be undone.'
      : 'Their attendance and marks history stays intact. A history record is created. Cannot be undone.';
    const r = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: mode === 'graduate' ? '#ef4444' : '#4f46e5',
      confirmButtonText: mode === 'graduate' ? 'Graduate' : 'Promote',
    });
    if (r.isConfirmed) promoteMutation.mutate();
  };

  if (!sourceClass) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Promote students from ${sourceClass.name} - ${sourceClass.section}`}
      width={720}
    >
      {isLoading ? <LoadingState /> : error || !data ? <ErrorState message={apiErrorMessage(error)} /> : (
        <>
          <div className="form-group">
            <label className="form-label">Action</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'promote' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('promote')}
              >
                <i className="fas fa-arrow-right" /> Move to next class
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'graduate' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setMode('graduate')}
              >
                <i className="fas fa-graduation-cap" /> Graduate (archive)
              </button>
            </div>
          </div>

          {mode === 'promote' && (
            <div className="form-group">
              <label className="form-label">Destination class *</label>
              <select
                className="form-control"
                value={targetClassId === '' ? '' : String(targetClassId)}
                onChange={(e) => setTargetClassId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">— select target class —</option>
                {otherClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.section}
                    {c.academic_year ? ` (${c.academic_year})` : ''}
                    {c.student_count > 0 ? ` — already has ${c.student_count} student(s)` : ' — empty'}
                  </option>
                ))}
              </select>
              {otherClasses.length === 0 && (
                <small style={{ color: 'var(--warning-dark)' }}>
                  No other classes exist. Create the target class first.
                </small>
              )}

              {/* Destination not empty - warn the user */}
              {targetClass && targetClass.student_count > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--warning-light)',
                    borderLeft: '4px solid var(--warning)',
                  }}
                >
                  <strong style={{ color: 'var(--warning-dark)' }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    {targetClass.name}-{targetClass.section} already has {targetClass.student_count} student(s).
                  </strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--warning-dark)', marginTop: 6 }}>
                    Those students will <strong>not</strong> be moved or removed — your selection will be added <em>alongside</em> them.
                    To do a proper year-end promotion, first move the existing {targetClass.name}-{targetClass.section} students
                    out (or graduate them) so the class is empty.
                  </div>
                </div>
              )}

              {/* Roll-number collisions */}
              {conflicts.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--danger-light)',
                    borderLeft: '4px solid var(--danger)',
                  }}
                >
                  <strong style={{ color: 'var(--danger-dark)' }}>
                    <i className="fas fa-circle-exclamation" style={{ marginRight: 6 }} />
                    {conflicts.length} roll-number conflict(s):
                  </strong>
                  <ul style={{ margin: '6px 0 0 20px', fontSize: '0.85rem', color: 'var(--danger-dark)' }}>
                    {conflicts.slice(0, 5).map((c, i) => (
                      <li key={i}>{c.name} (Roll {c.roll_no}) collides with an existing student in the target class</li>
                    ))}
                    {conflicts.length > 5 && <li>…and {conflicts.length - 5} more</li>}
                  </ul>
                  <div style={{ fontSize: '0.85rem', color: 'var(--danger-dark)', marginTop: 6 }}>
                    Uncheck <strong>"Keep current roll numbers"</strong> below to let the school re-assign rolls,
                    or empty the target class first.
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <input
              className="form-control"
              placeholder="e.g. Year-end promotion 2025-26 → 2026-27"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {mode === 'promote' && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={keepRollNos}
                  onChange={(e) => setKeepRollNos(e.target.checked)}
                />
                Keep current roll numbers in the new class
              </label>
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>
                Students ({selected.size} of {data.students.length} selected)
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={selectAll}>All</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={selectNone}>None</button>
              </div>
            </div>
            {data.students.length === 0 ? (
              <p className="text-muted">No students in this class.</p>
            ) : (
              <div
                style={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Roll</th>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => toggle(s.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggle(s.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>{s.roll_no ?? '—'}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>
                          {s.is_active ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <span className="badge badge-danger">Archived</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className={mode === 'graduate' ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={handleSubmit}
              disabled={promoteMutation.isPending || selected.size === 0}
            >
              {promoteMutation.isPending ? (
                <><i className="fas fa-spinner fa-spin" /> Processing…</>
              ) : mode === 'graduate' ? (
                <><i className="fas fa-graduation-cap" /> Graduate {selected.size} student(s)</>
              ) : (
                <><i className="fas fa-arrow-right" /> Promote {selected.size} student(s)</>
              )}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
