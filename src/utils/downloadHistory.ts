export interface HistoryRecord {
  id: string
  title: string
  url: string
  date: string
  pages: number
  type: "PDF" | "Text"
}

const HISTORY_KEY = "fliphtml5_download_history"
const MAX_RECORDS = 10

export async function addDownloadHistory(
  record: Omit<HistoryRecord, "id" | "date">
): Promise<void> {
  const result = await chrome.storage.local.get(HISTORY_KEY)
  const history: HistoryRecord[] = result[HISTORY_KEY] ?? []

  const newRecord: HistoryRecord = {
    ...record,
    id: Date.now().toString(),
    date: new Date().toLocaleString(),
  }

  const updated = [newRecord, ...history].slice(0, MAX_RECORDS)
  await chrome.storage.local.set({ [HISTORY_KEY]: updated })
}

export async function getDownloadHistory(): Promise<HistoryRecord[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY)
  return result[HISTORY_KEY] ?? []
}

export async function clearDownloadHistory(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY)
}
