export interface User {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  timezone: string;
  language: string;
  notifications_enabled: boolean;
  default_currency: string;
  date_format: string;
  auth_provider: string;
  email_verified: boolean;
  date_joined: string;
  is_platform_admin: boolean;
}

export interface ApiError {
  detail?: string;
  [key: string]: string | string[] | undefined;
}

export interface Household {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  my_role: "admin" | "member" | null;
}

export interface HouseholdMembership {
  id: number;
  user: User;
  role: "admin" | "member";
  status: "active" | "left" | "removed";
  can_edit: boolean;
  require_payment_confirmation: boolean;
  joined_at: string;
}

export interface Invite {
  id: number;
  code: string;
  household: number;
  household_name: string;
  created_by_name: string;
  expires_at: string;
  is_expired: boolean;
  is_used: boolean;
  created_at: string;
}

export interface ExpenseSplit {
  id: number;
  user: number;
  user_name: string;
  user_email: string;
  amount: string;
  percentage: string | null;
  proportion: string | null;
  is_paid: boolean;
  paid_at: string | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
}

export interface ExpenseEditHistoryEntry {
  id: number;
  edited_by: number;
  edited_by_name: string;
  edited_at: string;
  changes: Record<string, { old: string; new: string }>;
}

export interface Expense {
  id: number;
  description: string;
  note: string;
  amount: string;
  category: string;
  custom_category: string;
  display_category: string;
  date: string;
  payer: number;
  payer_name: string;
  split_method: "equal" | "custom" | "percentage" | "proportion";
  splits: ExpenseSplit[];
  created_by: number;
  created_by_name: string;
  last_edited_by: number | null;
  last_edited_by_name: string | null;
  last_edited_at: string | null;
  edit_history: ExpenseEditHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface ActivityExpenseItem {
  id: number;
  type: "expense";
  date: string;
  description: string;
  display_category: string;
  total_amount: string;
  is_payer: boolean;
  payer_name: string;
  my_share: string;
  my_share_paid: boolean;
  my_share_confirmed: boolean;
  participants: { user_id: number; name: string; amount: string; is_paid: boolean; is_confirmed: boolean }[];
  split_method: string;
  note: string;
  created_at: string;
}

export interface ActivityChoreItem {
  id: number;
  type: "chore";
  date: string;
  chore_id: number;
  title: string;
  description: string;
  recurrence: string;
  is_done: boolean;
  done_at: string | null;
  note: string;
  is_rotation: boolean;
}

export interface Balance {
  from_user: number;
  from_user_name: string;
  to_user: number;
  to_user_name: string;
  amount: string;
}

export interface ChoreLog {
  id: number;
  user: number;
  user_name: string;
  action: string;
  note: string;
  created_at: string;
}

export interface Chore {
  id: number;
  title: string;
  description: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  recurrence: "none" | "weekly" | "biweekly" | "monthly";
  created_by: number;
  created_by_name: string;
  logs: ChoreLog[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  sender: number;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  user: number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlatformStats {
  total_users: number;
  active_users: number;
  new_users_7d: number;
  new_users_30d: number;
  total_households: number;
  new_households_7d: number;
  new_households_30d: number;
  total_expenses: number;
  total_expense_amount: string;
  total_chores: number;
  overdue_chores: number;
  total_messages: number;
}
