# Auto-Generate Task Content Design

**Date:** 2026-03-11
**Status:** Approved

## Problem

When a user adds a task by title, the `content` field starts empty. The user must manually type content and then click "AI 润色" to get structured steps. This is friction — the AI should proactively generate content immediately after a task is created.

## Solution

When a task is added, trigger an AI content generation call in the background (parallel to the existing time estimation call). The generated content auto-fills the task's `content` field and `editingContent` state. While generating, the expanded textarea shows a disabled loading state.

## New Prompt: `SYSTEM_GENERATE`

```
你是任务规划助手。根据任务标题，生成结构清晰的执行说明。

要求：
1. 明确核心目标（一句话）
2. 列出2-4个具体执行步骤
3. 总字数不超过120字

格式：
- 使用简洁中文
- 每步骤用「•」开头
- 直接输出内容，不加前缀说明
```

## State Change

Add `generatingContentIds: Set<string>` to component state, mirroring the existing `estimatingIds` pattern.

## `addTask` Change

After creating the task, fire two parallel async calls:
1. **Existing:** `llmCall(SYSTEM_ESTIMATE, title, 16)` → sets `estimatedMinutes`
2. **New:** `llmCall(SYSTEM_GENERATE, title, 512)` → sets `task.content` and `editingContent[id]`

Both calls use `.catch(() => {})` to silently fail without breaking the UI.

## UI Behavior

| State | Textarea |
|---|---|
| Generating | `disabled`, placeholder = "AI 生成内容中…" |
| Done | Editable, AI-generated content filled in |
| Error | Empty, editable — user can type manually |

The task auto-expands on add (existing behavior preserved). The textarea is immediately visible with the loading state.

## Files Changed

- `src/App.tsx` only — add `SYSTEM_GENERATE` constant, `generatingContentIds` state, parallel llm call in `addTask`, and conditional `disabled`/`placeholder` on the textarea.

## Out of Scope

- Streaming output
- User ability to cancel generation
- Re-generating content after edit
