import axios, { AxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api/",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Intercept 401 and attempt token refresh once
let isRefreshing = false;
let failedQueue: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(null)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    const isAuthRequest = originalRequest?.url?.includes("/auth/");
    const isMeRequest = originalRequest?.url === "me/" || originalRequest?.url === "/api/me/";

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRequest && !isMeRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest!));
      }
      originalRequest!._retry = true;
      isRefreshing = true;
      try {
        await api.post("/auth/token/refresh/");
        processQueue(null);
        return api(originalRequest!);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        window.dispatchEvent(new Event("auth:logout"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { username: string; email: string; password: string; full_name?: string }) =>
    api.post("auth/register/", data),
  login: (data: { username_or_email: string; password: string }) => api.post("auth/login/", data),
  googleLogin: (credential: string) => api.post("auth/google/", { credential }),
  logout: () => api.post("auth/logout/"),
  forgotPassword: (data: { email: string }) => api.post("auth/forgot-password/", data),
  resetPassword: (data: { uid: string; token: string; new_password: string }) =>
    api.post("auth/reset-password/", data),
  me: () => api.get("me/"),
  updateMe: (data: FormData | Record<string, string>) => api.patch("me/", data),
};

// ─── Households API ───────────────────────────────────────────────────────────
export const householdApi = {
  list: () => api.get("households/"),
  create: (data: { name: string }) => api.post("households/", data),
  get: (id: number) => api.get(`households/${id}/`),
  update: (id: number, data: { name: string }) => api.patch(`households/${id}/`, data),
  delete: (id: number) => api.delete(`households/${id}/`),
  getMembers: (id: number) => api.get(`households/${id}/members/`),
  updateMember: (hid: number, mid: number, data: { role?: string; can_edit?: boolean; require_payment_confirmation?: boolean }) =>
    api.patch(`households/${hid}/members/${mid}/`, data),
  removeMember: (hid: number, mid: number) =>
    api.delete(`households/${hid}/members/${mid}/remove/`),
  createInvite: (id: number) => api.post(`households/${id}/invites/`),
  join: (code: string) => api.post("households/join/", { code }),
};

// ─── Expenses API ─────────────────────────────────────────────────────────────
export const expenseApi = {
  list: (hid: number, params?: Record<string, string | number>) =>
    api.get(`households/${hid}/expenses/`, { params }),
  create: (hid: number, data: Record<string, unknown>) =>
    api.post(`households/${hid}/expenses/`, data),
  get: (hid: number, eid: number) => api.get(`households/${hid}/expenses/${eid}/`),
  update: (hid: number, eid: number, data: Record<string, unknown>) =>
    api.patch(`households/${hid}/expenses/${eid}/`, data),
  delete: (hid: number, eid: number) => api.delete(`households/${hid}/expenses/${eid}/`),
  markPaid: (hid: number, eid: number, sid: number) =>
    api.post(`households/${hid}/expenses/${eid}/splits/${sid}/mark-paid/`),
  confirmPayment: (hid: number, eid: number, sid: number) =>
    api.post(`households/${hid}/expenses/${eid}/splits/${sid}/confirm/`),
  settleUp: (hid: number, withUserId: number) => api.post(`/households/${hid}/expenses/settle/`, { with_user: withUserId }),
  getBalances: (hid: number) => api.get(`households/${hid}/expenses/balances/`),
  getActivity: (hid: number) => api.get(`households/${hid}/expenses/activity/`),
};

// ─── Chores API ───────────────────────────────────────────────────────────────
export const choreApi = {
  list: (hid: number, params?: Record<string, string>) =>
    api.get(`households/${hid}/chores/`, { params }),
  create: (hid: number, data: Record<string, unknown>) =>
    api.post(`households/${hid}/chores/`, data),
  get: (hid: number, cid: number) => api.get(`households/${hid}/chores/${cid}/`),
  update: (hid: number, cid: number, data: Record<string, unknown>) =>
    api.patch(`households/${hid}/chores/${cid}/`, data),
  delete: (hid: number, cid: number) => api.delete(`households/${hid}/chores/${cid}/`),
  complete: (hid: number, cid: number, assignmentId?: number, note?: string) =>
    api.post(`households/${hid}/chores/${cid}/complete/`, {
      ...(assignmentId ? { assignment_id: assignmentId } : {}),
      ...(note ? { note } : {}),
    }),
  requestSwap: (hid: number, cid: number, assignmentId: number, reason?: string) =>
    api.post(`households/${hid}/chores/${cid}/swap/`, { assignment_id: assignmentId, reason }),
  reassignAssignment: (hid: number, cid: number, assignmentId: number, assignedTo: number) =>
    api.post(`households/${hid}/chores/${cid}/reassign/`, { assignment_id: assignmentId, assigned_to: assignedTo }),
  editLogNote: (hid: number, cid: number, logId: number, note: string) =>
    api.patch(`households/${hid}/chores/${cid}/logs/${logId}/note/`, { note }),
  getMySchedule: (hid: number) => api.get(`households/${hid}/chores/schedule/`),
};

// ─── Chat API ─────────────────────────────────────────────────────────────────
export const chatApi = {
  list: (hid: number, after?: number) =>
    api.get(`households/${hid}/messages/`, { params: after ? { after } : {} }),
  send: (hid: number, content: string) =>
    api.post(`households/${hid}/messages/`, { content }),
};

// ─── Notifications API ────────────────────────────────────────────────────────
export const notificationApi = {
  list: () => api.get("notifications/"),
  markRead: (id: number) => api.patch(`notifications/${id}/read/`),
  markAllRead: () => api.post("notifications/read-all/"),
};

// ─── Activity API ─────────────────────────────────────────────────────────────
export const activityApi = {
  list: (hid: number) => api.get(`households/${hid}/activity/`),
};

// ─── Platform Admin API ──────────────────────────────────────────────────────
export const adminApi = {
  overview: () => api.get("admin/overview/"),
  listUsers: (params?: Record<string, string>) => api.get("admin/users/", { params }),
  getUser: (uid: number) => api.get(`admin/users/${uid}/`),
  updateUser: (uid: number, data: Record<string, unknown>) =>
    api.patch(`admin/users/${uid}/`, data),
  listHouseholds: (params?: Record<string, string>) =>
    api.get("admin/households/", { params }),
  getHousehold: (hid: number) => api.get(`admin/households/${hid}/`),
  getAudit: () => api.get("admin/audit/"),
};
