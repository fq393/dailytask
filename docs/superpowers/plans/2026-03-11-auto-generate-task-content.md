# Auto-Generate Task Content Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a task is added, automatically call the AI to generate structured content from the title, displaying a loading state in the textarea until content is ready.

**Architecture:** Add a `SYSTEM_GENERATE` prompt and `generatingContentIds` state in `App.tsx`. In `addTask`, fire a new `llmCall` in parallel with the existing estimate call. Conditionally disable the textarea and change its placeholder while generation is in progress.

**Tech Stack:** React 19, TypeScript, existing `llmCall` utility

---

## Chunk 1: State + Prompt + addTask

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `SYSTEM_GENERATE` prompt constant**

  In `src/App.tsx`, after the `SYSTEM_ESTIMATE` constant (around line 36), add:

  ```typescript
  const SYSTEM_GENERATE = `你是任务规划助手。根据任务标题，生成结构清晰的执行说明。

  要求：
  1. 明确核心目标（一句话）
  2. 列出2-4个具体执行步骤
  3. 总字数不超过120字

  格式：
  - 使用简洁中文
  - 每步骤用「•」开头
  - 直接输出内容，不加前缀说明`
  ```

- [ ] **Step 2: Add `generatingContentIds` state**

  In the `App` component, alongside the existing `estimatingIds` state (around line 161), add:

  ```typescript
  const [generatingContentIds, setGeneratingContentIds] = useState<Set<string>>(new Set())
  ```

- [ ] **Step 3: Trigger content generation in `addTask`**

  In `addTask` (around line 194), after the existing `estimatingIds` block, add a parallel call:

  ```typescript
  setGeneratingContentIds(prev => new Set(prev).add(t.id))
  llmCall(SYSTEM_GENERATE, t.text, 512)
    .then(generated => {
      if (generated) {
        setTasks(prev => prev.map(task =>
          task.id === t.id ? { ...task, content: generated } : task
        ))
        setEditingContent(prev => ({ ...prev, [t.id]: generated }))
      }
    })
    .catch(() => {})
    .finally(() => setGeneratingContentIds(prev => {
      const s = new Set(prev); s.delete(t.id); return s
    }))
  ```

- [ ] **Step 4: Update textarea to reflect loading state**

  In the task detail section (around line 531), update the `<textarea>` element:

  ```tsx
  const isGenerating = generatingContentIds.has(task.id)
  // ...
  <textarea
    className="content-textarea"
    placeholder={isGenerating ? 'AI 生成内容中…' : '添加任务详情、执行步骤、备注…'}
    value={currentContent}
    onChange={e => setEditingContent(prev => ({ ...prev, [task.id]: e.target.value }))}
    onBlur={() => saveContent(task.id)}
    rows={4}
    autoFocus
    disabled={isGenerating}
  />
  ```

  Note: `isGenerating` must be derived before the `return` in the `.map()` callback.

- [ ] **Step 5: Verify manually**

  Run the app:
  ```bash
  cd /Users/vanche/Desktop/dailyTask && npm run dev
  ```

  Test checklist:
  - [ ] Type a task title and press Enter
  - [ ] Task auto-expands; textarea shows "AI 生成内容中…" and is disabled
  - [ ] After a few seconds, textarea becomes enabled with AI-generated content
  - [ ] Time estimate badge also appears (existing behavior unchanged)
  - [ ] If you add a second task immediately, both generate independently
  - [ ] If AI fails (disconnect network), textarea becomes empty and editable

- [ ] **Step 6: Build for release**

  ```bash
  cd /Users/vanche/Desktop/dailyTask
  npm run electron:release
  npm run electron:build:win
  rm -rf /Applications/DailyTask.app && cp -R release/mac-arm64/DailyTask.app /Applications/DailyTask.app
  ```
