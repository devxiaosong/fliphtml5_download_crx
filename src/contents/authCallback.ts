// Plasmo 要求 content script 必须放在 src/contents/ 下，
// 实际逻辑在 src/core/authCallback.ts，此处直接 re-export。
export { config } from "../core/authCallback"
