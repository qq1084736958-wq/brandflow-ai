import type {
  GenerateRequest,
  StoredDraft,
  StoredResult,
} from "@/types/brandflow";

const REQUEST_KEY = "brandflow:request";
const RESULT_KEY = "brandflow:result";
const DRAFT_KEY = "brandflow:draft";
const ACTIVE_TASK_KEY = "brandflow:active-task-id";

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function read<T>(key: string): T | null {
  const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as T;
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    return value;
  } catch {
    return null;
  }
}

export const taskStorage = {
  saveRequest(value: GenerateRequest) {
    save(REQUEST_KEY, value);
  },
  getRequest() {
    return read<GenerateRequest>(REQUEST_KEY);
  },
  saveResult(value: StoredResult) {
    save(RESULT_KEY, value);
  },
  getResult() {
    return read<StoredResult>(RESULT_KEY);
  },
  saveDraft(value: StoredDraft) {
    save(DRAFT_KEY, value);
  },
  getDraft() {
    return read<StoredDraft>(DRAFT_KEY);
  },
  clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
  },
  saveActiveTask(id: string) {
    localStorage.setItem(ACTIVE_TASK_KEY, id);
  },
  getActiveTask() {
    return localStorage.getItem(ACTIVE_TASK_KEY);
  },
  clearActiveTask(id?: string) {
    if (!id || localStorage.getItem(ACTIVE_TASK_KEY) === id) {
      localStorage.removeItem(ACTIVE_TASK_KEY);
    }
  },
};
