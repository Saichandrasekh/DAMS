import { api } from '@/lib/api';
import type {
  AdminCredential,
  AddSchoolInput,
  AuditLog,
  School,
  SuperadminDashboardData,
  UpdateCredentialInput,
  UpdateSchoolInput,
} from '@/types/superadmin';

export const superadminApi = {
  async dashboard(): Promise<SuperadminDashboardData> {
    const res = await api.get<SuperadminDashboardData>('/superadmin/dashboard');
    return res.data;
  },

  async listSchools(): Promise<School[]> {
    const res = await api.get<{ schools: School[] }>('/superadmin/schools');
    return res.data.schools;
  },

  async getSchool(id: number): Promise<{ school: School; admins: { id: number; name: string; email: string }[] }> {
    const res = await api.get(`/superadmin/schools/${id}`);
    return res.data as { school: School; admins: { id: number; name: string; email: string }[] };
  },

  async createSchool(input: AddSchoolInput): Promise<School> {
    const res = await api.post<{ school: School }>('/superadmin/schools', input);
    return res.data.school;
  },

  async updateSchool(id: number, input: UpdateSchoolInput): Promise<void> {
    await api.put(`/superadmin/schools/${id}`, input);
  },

  async deleteSchool(id: number): Promise<void> {
    await api.delete(`/superadmin/schools/${id}`);
  },

  async listCredentials(): Promise<AdminCredential[]> {
    const res = await api.get<{ credentials: AdminCredential[] }>('/superadmin/credentials');
    return res.data.credentials;
  },

  async updateCredential(userId: number, input: UpdateCredentialInput): Promise<void> {
    await api.put(`/superadmin/credentials/${userId}`, input);
  },

  async listAuditLogs(filters: Record<string, string> = {}): Promise<{ logs: AuditLog[]; schools: { id: number; name: string }[] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    const qs = params.toString();
    const res = await api.get(`/superadmin/audit-logs${qs ? `?${qs}` : ''}`);
    return res.data as { logs: AuditLog[]; schools: { id: number; name: string }[] };
  },
};
