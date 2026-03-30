// Cloudnote - Cloudflare Workers + KV
// 单文件应用：API 路由 + 内联前端

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

async function handleListNotes(env) {
  const notes = [];
  let cursor = undefined;
  do {
    const result = await env.NOTES.list({ prefix: 'note:', cursor });
    for (const key of result.keys) {
      notes.push({
        id: key.name.slice(5),
        title: key.metadata?.title || 'Untitled',
        createdAt: key.metadata?.createdAt,
        updatedAt: key.metadata?.updatedAt,
      });
    }
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return jsonResponse(notes);
}

async function handleGetNote(id, env) {
  const { value, metadata } = await env.NOTES.getWithMetadata('note:' + id);
  if (value === null) return jsonResponse({ error: 'Not found' }, 404);
  return jsonResponse({
    id, title: metadata?.title || 'Untitled', content: value,
    createdAt: metadata?.createdAt, updatedAt: metadata?.updatedAt,
  });
}

async function handleCreateNote(request, env) {
  const { id, title, content } = await request.json();
  const now = new Date().toISOString();
  await env.NOTES.put('note:' + id, content || '', {
    metadata: { title: title || 'Untitled', createdAt: now, updatedAt: now },
  });
  return jsonResponse({ id, title, createdAt: now, updatedAt: now }, 201);
}

async function handleUpdateNote(id, request, env) {
  const { title, content } = await request.json();
  const { metadata: existing } = await env.NOTES.getWithMetadata('note:' + id);
  const now = new Date().toISOString();
  await env.NOTES.put('note:' + id, content || '', {
    metadata: { title: title || 'Untitled', createdAt: existing?.createdAt || now, updatedAt: now },
  });
  return jsonResponse({ id, title, updatedAt: now });
}

async function handleDeleteNote(id, env) {
  await env.NOTES.delete('note:' + id);
  return jsonResponse({ ok: true });
}

function checkAuth(request, env) {
  if (!env.PASSWORD) return true;
  return request.headers.get('Authorization') === 'Bearer ' + env.PASSWORD;
}

async function handleAuth(request, env) {
  if (!env.PASSWORD) return jsonResponse({ ok: true });
  if (request.headers.get('Authorization') === 'Bearer ' + env.PASSWORD) return jsonResponse({ ok: true });
  return jsonResponse({ ok: false }, 401);
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#ffffff">
<title>Cloudnote</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#128221;</text></svg>">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #ffffff; --bg-sidebar: #f7f7f8; --bg-active: #e3e8f0; --bg-hover: #ebedf0;
  --text: #1a1a1a; --text-muted: #6b6b6b; --text-light: #999; --border: #e0e0e0;
  --accent: #2563eb; --accent-hover: #1d4ed8; --danger: #dc2626; --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
[data-theme="dark"] {
  --bg: #1e1e1e; --bg-sidebar: #252525; --bg-active: #3a3a3a; --bg-hover: #2e2e2e;
  --text: #dcdcdc; --text-muted: #999; --text-light: #666; --border: #3a3a3a;
  --accent: #4d8ef7; --accent-hover: #6ba3ff; --danger: #f87171;
}
.theme-btn { background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 14px; cursor: pointer; color: var(--text-muted); min-height: 32px; line-height: 1; }
html, body { height: 100%; font-family: var(--font); color: var(--text); background: var(--bg); overscroll-behavior: none; color-scheme: light dark; }
#app { display: flex; flex-direction: column; height: 100dvh; }
header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0; z-index: 20; }
header h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
.header-right { display: flex; align-items: center; gap: 8px; }
.lang-btn { background: transparent; border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: var(--text-muted); font-family: var(--font); min-height: 32px; }
.lang-btn:hover { background: var(--bg-hover); }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: var(--radius); font-size: 14px; font-family: var(--font); cursor: pointer; transition: background 0.15s; min-height: 44px; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:active { transform: scale(0.97); }
.btn-ghost { background: transparent; color: var(--text); }
.btn-ghost:hover { background: var(--bg-hover); }
.btn-danger { background: transparent; color: var(--danger); }
.btn-danger:hover { background: var(--bg-hover); }
main { display: flex; flex: 1; overflow: hidden; }
.sidebar { width: 280px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--bg-sidebar); display: flex; flex-direction: column; overflow: hidden; }
.sidebar-header { padding: 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.sidebar-header span { font-size: 13px; color: var(--text-muted); font-weight: 500; }
.sidebar-header-actions { display: flex; gap: 4px; }
.manage-btn { background: transparent; border: none; font-size: 12px; color: var(--accent); cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: var(--font); }
.manage-btn:hover { background: var(--bg-hover); }
.batch-bar { display: none; padding: 8px 12px; border-bottom: 1px solid var(--border); gap: 6px; align-items: center; flex-shrink: 0; }
.batch-bar.show { display: flex; }
.batch-bar label { font-size: 12px; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 4px; }
.batch-bar .batch-delete { background: transparent; border: none; font-size: 12px; color: var(--danger); cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: var(--font); margin-left: auto; }
.batch-bar .batch-delete:hover { background: var(--bg-hover); }
.batch-bar .batch-delete:disabled { color: var(--text-light); cursor: default; }
.batch-bar .batch-cancel { background: transparent; border: none; font-size: 12px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; border-radius: 4px; font-family: var(--font); }
.batch-bar .batch-cancel:hover { background: var(--bg-hover); }
.note-item .note-checkbox { display: none; width: 16px; height: 16px; margin-right: 8px; flex-shrink: 0; cursor: pointer; accent-color: var(--accent); }
.selecting .note-item .note-checkbox { display: inline-block; }
.selecting .note-item { flex-direction: row; align-items: center; }
.selecting .note-item-content { flex: 1; min-width: 0; }
.selecting .note-item .delete-btn { display: none; }
.search-box { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.search-input { width: 100%; padding: 8px 12px 8px 32px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; font-family: var(--font); outline: none; background: var(--bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Ccircle cx='6.5' cy='6.5' r='5' stroke='%23999' stroke-width='1.5' fill='none'/%3E%3Cline x1='10' y1='10' x2='14' y2='14' stroke='%23999' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 10px center no-repeat; min-height: 36px; color: var(--text); }
.search-input:focus { border-color: var(--accent); }
.search-input::placeholder { color: var(--text-light); }
.note-list { flex: 1; overflow-y: auto; padding: 8px; }
.note-item { padding: 12px; border-radius: var(--radius); cursor: pointer; transition: background 0.12s; position: relative; min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
.note-item:hover { background: var(--bg-hover); }
.note-item.active { background: var(--bg-active); }
.note-item-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 28px; }
.note-item-time { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.note-item .delete-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--text-light); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.12s, background 0.12s, color 0.12s; }
.note-item:hover .delete-btn { opacity: 1; }
.note-item .delete-btn:hover { background: var(--bg-hover); color: var(--danger); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); text-align: center; padding: 24px; }
.empty-state-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
.empty-state p { font-size: 14px; line-height: 1.5; }
.editor { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
.editor-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-light); font-size: 15px; }
.editor-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.back-btn { display: none; width: 36px; height: 36px; border: none; border-radius: var(--radius); background: transparent; font-size: 20px; cursor: pointer; align-items: center; justify-content: center; flex-shrink: 0; color: var(--accent); }
.title-input { flex: 1; border: none; outline: none; font-size: 18px; font-weight: 600; font-family: var(--font); background: transparent; color: var(--text); min-height: 36px; }
.title-input::placeholder { color: var(--text-light); }
.toolbar { display: flex; align-items: center; gap: 2px; padding: 6px 12px; border-bottom: 1px solid var(--border); background: var(--bg-sidebar); flex-shrink: 0; overflow: visible; position: relative; z-index: 10; }
.toolbar::-webkit-scrollbar { height: 0; }
.toolbar button { width: 32px; height: 32px; border: none; border-radius: 4px; background: transparent; cursor: pointer; font-size: 14px; color: var(--text); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: var(--font); transition: background 0.1s; }
.toolbar button:hover { background: var(--bg-hover); }
.toolbar button.active { background: var(--bg-active); color: var(--accent); }
.toolbar select { height: 32px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); font-size: 12px; font-family: var(--font); padding: 0 6px; cursor: pointer; flex-shrink: 0; color: var(--text); outline: none; max-width: 110px; }
.toolbar-sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; flex-shrink: 0; }
.color-tool { position: relative; flex-shrink: 0; display: flex; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
.color-btn { width: 26px; height: 30px; border: none; border-radius: 0; background: transparent; cursor: pointer; font-size: 15px; font-weight: 700; color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font); padding: 2px 0 0; gap: 0; }
.color-btn:hover { background: var(--bg-hover); }
.color-bar { display: block; width: 16px; height: 4px; border-radius: 1px; margin-top: 1px; }
.color-picker-btn { width: 14px; height: 30px; border: none; border-left: 1px solid var(--border); border-radius: 0; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 8px; padding: 0; }
.color-picker-btn:hover { background: var(--bg-hover); }
.hilite-a { padding: 0 3px; border-radius: 2px; line-height: 1.2; }
.color-hidden-input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.font-combo { position: relative; flex-shrink: 0; }
.font-combo-input { width: 90px; height: 32px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); font-size: 12px; font-family: var(--font); padding: 0 6px; color: var(--text); outline: none; cursor: pointer; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.font-combo-input:focus { border-color: var(--accent); }
.font-dropdown { display: none; position: absolute; top: 100%; left: 0; width: 140px; max-height: 240px; overflow-y: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 50; margin-top: 2px; }
.font-dropdown.show { display: block; }
.font-dropdown div { padding: 5px 8px; font-size: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.font-dropdown div:hover { background: var(--bg-hover); }
.size-combo { position: relative; flex-shrink: 0; }
.size-combo-input { width: 54px; height: 32px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); font-size: 12px; font-family: var(--font); padding: 0 6px; text-align: center; color: var(--text); outline: none; }
.size-combo-input:focus { border-color: var(--accent); }
.size-dropdown { display: none; position: absolute; top: 100%; left: 0; width: 54px; max-height: 200px; overflow-y: auto; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 50; margin-top: 2px; }
.size-dropdown.show { display: block; }
.size-dropdown div { padding: 4px 8px; font-size: 12px; cursor: pointer; text-align: center; }
.size-dropdown div:hover { background: var(--bg-hover); }
.editor-body { flex: 1; display: flex; overflow: hidden; min-height: 0; }
.content-editor { flex: 1; outline: none; padding: 16px; font-size: 16px; font-family: Arial, sans-serif; line-height: 1.7; color: var(--text); background: transparent; overflow-y: auto; word-wrap: break-word; overflow-wrap: break-word; }
.content-editor:empty::before { content: attr(data-placeholder); color: var(--text-light); pointer-events: none; }
.status-bar { display: flex; align-items: center; justify-content: space-between; padding: 6px 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); flex-shrink: 0; min-height: 32px; }
.save-status { display: flex; align-items: center; gap: 6px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.status-dot.saved { background: #22c55e; }
.status-dot.saving { background: #eab308; animation: pulse 1s ease-in-out infinite; }
.status-dot.unsaved { background: #9ca3af; }
.status-dot.error { background: var(--danger); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.login-screen { display: flex; align-items: center; justify-content: center; position: fixed; inset: 0; background: var(--bg); z-index: 200; }
.login-box { width: 100%; max-width: 320px; padding: 24px; text-align: center; }
.login-box h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
.login-box p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
.login-box input { width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 16px; font-family: var(--font); outline: none; margin-bottom: 12px; min-height: 44px; }
.login-box input:focus { border-color: var(--accent); }
.login-box .btn { width: 100%; justify-content: center; }
.login-error { color: var(--danger); font-size: 13px; margin-bottom: 12px; display: none; }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; align-items: center; justify-content: center; padding: 16px; }
.modal-overlay.show { display: flex; }
.modal { background: var(--bg); border-radius: 12px; padding: 24px; max-width: 360px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
.modal h3 { font-size: 16px; margin-bottom: 8px; }
.modal p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.5; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
@media (max-width: 768px) {
  header h1 { font-size: 16px; }
  .sidebar { width: 100%; border-right: none; }
  .editor { display: none; position: fixed; inset: 0; z-index: 30; background: var(--bg); }
  .editor.active { display: flex; }
  .back-btn { display: flex; }
  .note-item .delete-btn { opacity: 0.6; }
  .toolbar { padding: 4px 8px; gap: 1px; }
  .toolbar button { width: 34px; height: 34px; }
}
</style>
</head>
<body>
<div id="loginScreen" class="login-screen" style="display:none">
  <div class="login-box">
    <h2>Cloudnote</h2>
    <p id="loginPrompt"></p>
    <div class="login-error" id="loginError"></div>
    <input type="password" id="loginPassword" autocomplete="current-password">
    <button class="btn btn-primary" id="loginBtn"></button>
    <div style="margin-top:16px"><button class="theme-btn" id="loginThemeBtn" onclick="toggleTheme()"></button> <button class="lang-btn" id="loginLangBtn" onclick="toggleLang()"></button></div>
  </div>
</div>

<div id="app" style="display:none">
  <header>
    <h1>Cloudnote</h1>
    <div class="header-right">
      <button class="theme-btn" id="themeBtn" onclick="toggleTheme()"></button>
      <button class="lang-btn" id="langBtn" onclick="toggleLang()"></button>
      <button class="btn btn-primary" id="newBtn" onclick="createNote()"></button>
    </div>
  </header>
  <main>
    <aside class="sidebar">
      <div class="sidebar-header"><span id="noteCount"></span><button class="manage-btn" id="manageBtn" onclick="enterSelectMode()"></button></div>
      <div class="batch-bar" id="batchBar">
        <label><input type="checkbox" id="selectAllCb" onchange="toggleSelectAll()"> <span id="selectAllLabel"></span></label>
        <button class="batch-delete" id="batchDeleteBtn" onclick="batchDelete()" disabled></button>
        <button class="batch-cancel" id="batchCancelBtn" onclick="exitSelectMode()"></button>
      </div>
      <div class="search-box"><input type="text" class="search-input" id="searchInput" autocomplete="off"></div>
      <div class="note-list" id="noteList"></div>
    </aside>
    <section class="editor" id="editor">
      <div class="editor-placeholder" id="editorPlaceholder"></div>
      <div id="editorContent" style="display:none; flex-direction:column; flex:1; min-height:0;">
        <div class="editor-header">
          <button class="back-btn" onclick="showSidebar()">&#8592;</button>
          <input type="text" class="title-input" id="titleInput" oninput="scheduleSave()" autocomplete="off">
        </div>
        <div class="toolbar" id="toolbar">
          <button data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
          <button data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
          <span class="toolbar-sep"></span>
          <div class="font-combo" id="fontCombo">
            <input type="text" class="font-combo-input" id="fontInput" readonly>
            <div class="font-dropdown" id="fontDropdown"></div>
          </div>
          <div class="size-combo" id="sizeCombo">
            <input type="text" class="size-combo-input" id="sizeInput">
            <div class="size-dropdown" id="sizeDropdown"></div>
          </div>
          <span class="toolbar-sep"></span>
          <div class="color-tool" id="foreColorTool">
            <button class="color-btn" id="foreColorBtn" title="">A<span class="color-bar" id="foreColorBar" style="background:#d00"></span></button>
            <button class="color-picker-btn" id="forePickerBtn">&#9660;</button>
            <input type="color" id="foreColorPicker" value="#dd0000" class="color-hidden-input">
          </div>
          <div class="color-tool" id="hiliteColorTool">
            <button class="color-btn" id="hiliteColorBtn" title=""><span class="hilite-a" id="hiliteA" style="background:#ffff00">A</span><span class="color-bar" id="hiliteColorBar" style="background:#ffff00"></span></button>
            <button class="color-picker-btn" id="hilitePickerBtn">&#9660;</button>
            <input type="color" id="hiliteColorPicker" value="#ffff00" class="color-hidden-input">
          </div>
          <span class="toolbar-sep"></span>
          <button data-cmd="justifyLeft" id="alignLeftBtn"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="1.5"/><rect x="2" y="7" width="8" height="1.5"/><rect x="2" y="11" width="12" height="1.5"/></svg></button>
          <button data-cmd="justifyCenter" id="alignCenterBtn"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="1.5"/><rect x="4" y="7" width="8" height="1.5"/><rect x="2" y="11" width="12" height="1.5"/></svg></button>
          <button data-cmd="justifyRight" id="alignRightBtn"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="1.5"/><rect x="6" y="7" width="8" height="1.5"/><rect x="2" y="11" width="12" height="1.5"/></svg></button>
          <span class="toolbar-sep"></span>
          <button data-cmd="insertOrderedList" id="olBtn" style="font-size:13px">1.</button>
          <button data-cmd="insertUnorderedList" id="ulBtn" style="font-size:18px">&#8226;</button>
          <span class="toolbar-sep"></span>
          <button data-cmd="removeFormat" id="clearFmtBtn" style="font-size:13px;color:var(--text-muted)">&#10005;</button>
        </div>
        <div class="editor-body">
          <div class="content-editor" id="contentEditor" contenteditable="true" data-placeholder="Start writing..."></div>
        </div>
        <div class="status-bar">
          <div class="save-status"><span class="status-dot" id="statusDot"></span><span id="statusText"></span></div>
          <span id="timestamps"></span>
        </div>
      </div>
    </section>
  </main>
</div>

<div class="modal-overlay" id="deleteModal">
  <div class="modal">
    <h3 id="deleteTitle"></h3>
    <p id="deleteModalText"></p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancelDeleteBtn" onclick="closeDeleteModal()"></button>
      <button class="btn btn-danger" id="confirmDeleteBtn"></button>
    </div>
  </div>
</div>

<script>
var currentNoteId = null, saveTimeout = null, isSaving = false, notes = [], retryCount = 0;
var authToken = sessionStorage.getItem('authToken') || '';
var savedRange = null;
var FONT_SIZES = [8,9,10,10.5,11,12,14,16,18,20,22,24,26,28,36,48,72];

// --- i18n ---
var LANG = {
  en: {
    loginPrompt: 'Enter password to continue',
    loginError: 'Incorrect password',
    loginPlaceholder: 'Password',
    loginBtn: 'Login',
    newBtn: '+ New',
    noteCount: function(n) { return n + (n === 1 ? ' note' : ' notes'); },
    searchPlaceholder: 'Search notes...',
    editorPlaceholder: 'Select or create a note',
    titlePlaceholder: 'Note title...',
    writePlaceholder: 'Start writing...',
    fontLabel: 'Font',
    sizeLabel: 'Size',
    foreColor: 'Text Color', hilite: 'Highlight',
    alignLeft: 'Align Left', alignCenter: 'Center', alignRight: 'Align Right',
    ol: 'Numbered List', ul: 'Bullet List', clearFmt: 'Clear Formatting',
    bold: 'Bold (Ctrl+B)', italic: 'Italic (Ctrl+I)', underline: 'Underline (Ctrl+U)', strikethrough: 'Strikethrough',
    saved: function(t) { return 'Saved ' + t; },
    saving: 'Saving...', unsaved: 'Unsaved',
    saveFail: 'Save failed', retrying: ', retrying...',
    createdAt: function(t) { return 'Created: ' + t; },
    deleteTitle: 'Delete note',
    deleteConfirm: function(t) { return 'Delete "' + t + '"? This cannot be undone.'; },
    cancel: 'Cancel', deleteBtn: 'Delete',
    manage: 'Manage', selectAll: 'All', batchDeleteBtn: 'Delete', batchCancel: 'Cancel',
    batchConfirm: function(n) { return 'Delete ' + n + ' selected note' + (n > 1 ? 's' : '') + '? This cannot be undone.'; },
    emptyState: 'No notes yet.<br>Click <b>+ New</b> to create one.',
    noMatch: 'No matching notes',
    justNow: 'just now',
    mAgo: function(m) { return m + 'm ago'; },
    hAgo: function(h) { return h + 'h ago'; },
    dAgo: function(d) { return d + 'd ago'; },
    langLabel: '\\u4E2D\\u6587',
  },
  zh: {
    loginPrompt: '\\u8BF7\\u8F93\\u5165\\u5BC6\\u7801\\u7EE7\\u7EED',
    loginError: '\\u5BC6\\u7801\\u9519\\u8BEF',
    loginPlaceholder: '\\u5BC6\\u7801',
    loginBtn: '\\u767B\\u5F55',
    newBtn: '+ \\u65B0\\u5EFA',
    noteCount: function(n) { return n + ' \\u6761\\u7B14\\u8BB0'; },
    searchPlaceholder: '\\u641C\\u7D22\\u7B14\\u8BB0...',
    editorPlaceholder: '\\u9009\\u62E9\\u6216\\u65B0\\u5EFA\\u7B14\\u8BB0',
    titlePlaceholder: '\\u7B14\\u8BB0\\u6807\\u9898...',
    writePlaceholder: '\\u5F00\\u59CB\\u5199\\u4F5C...',
    fontLabel: '\\u5B57\\u4F53',
    sizeLabel: '\\u5B57\\u53F7',
    foreColor: '\\u5B57\\u4F53\\u989C\\u8272', hilite: '\\u9AD8\\u4EAE',
    alignLeft: '\\u5DE6\\u5BF9\\u9F50', alignCenter: '\\u5C45\\u4E2D', alignRight: '\\u53F3\\u5BF9\\u9F50',
    ol: '\\u6709\\u5E8F\\u5217\\u8868', ul: '\\u65E0\\u5E8F\\u5217\\u8868', clearFmt: '\\u6E05\\u9664\\u683C\\u5F0F',
    bold: '\\u52A0\\u7C97 (Ctrl+B)', italic: '\\u659C\\u4F53 (Ctrl+I)', underline: '\\u4E0B\\u5212\\u7EBF (Ctrl+U)', strikethrough: '\\u5220\\u9664\\u7EBF',
    saved: function(t) { return '\\u5DF2\\u4FDD\\u5B58 ' + t; },
    saving: '\\u4FDD\\u5B58\\u4E2D...', unsaved: '\\u672A\\u4FDD\\u5B58',
    saveFail: '\\u4FDD\\u5B58\\u5931\\u8D25', retrying: '\\uFF0C\\u91CD\\u8BD5\\u4E2D...',
    createdAt: function(t) { return '\\u521B\\u5EFA\\u4E8E\\uFF1A' + t; },
    deleteTitle: '\\u5220\\u9664\\u7B14\\u8BB0',
    deleteConfirm: function(t) { return '\\u786E\\u5B9A\\u5220\\u9664\\u201C' + t + '\\u201D\\uFF1F\\u6B64\\u64CD\\u4F5C\\u4E0D\\u53EF\\u64A4\\u9500\\u3002'; },
    cancel: '\\u53D6\\u6D88', deleteBtn: '\\u5220\\u9664',
    manage: '\\u7BA1\\u7406', selectAll: '\\u5168\\u9009', batchDeleteBtn: '\\u5220\\u9664', batchCancel: '\\u53D6\\u6D88',
    batchConfirm: function(n) { return '\\u786E\\u5B9A\\u5220\\u9664\\u9009\\u4E2D\\u7684 ' + n + ' \\u6761\\u7B14\\u8BB0\\uFF1F\\u6B64\\u64CD\\u4F5C\\u4E0D\\u53EF\\u64A4\\u9500\\u3002'; },
    emptyState: '\\u8FD8\\u6CA1\\u6709\\u7B14\\u8BB0\\u3002<br>\\u70B9\\u51FB <b>+ \\u65B0\\u5EFA</b> \\u521B\\u5EFA\\u7B2C\\u4E00\\u6761\\u3002',
    noMatch: '\\u6CA1\\u6709\\u5339\\u914D\\u7684\\u7B14\\u8BB0',
    justNow: '\\u521A\\u521A',
    mAgo: function(m) { return m + '\\u5206\\u949F\\u524D'; },
    hAgo: function(h) { return h + '\\u5C0F\\u65F6\\u524D'; },
    dAgo: function(d) { return d + '\\u5929\\u524D'; },
    langLabel: 'EN',
  }
};

var stored = localStorage.getItem('lang');
var curLang = stored || (/^zh/i.test(navigator.language) ? 'zh' : 'en');
function t(key) { return LANG[curLang][key]; }

function applyLang() {
  document.getElementById('loginPrompt').textContent = t('loginPrompt');
  document.getElementById('loginError').textContent = t('loginError');
  document.getElementById('loginPassword').placeholder = t('loginPlaceholder');
  document.getElementById('loginBtn').textContent = t('loginBtn');
  document.getElementById('newBtn').textContent = t('newBtn');
  document.getElementById('searchInput').placeholder = t('searchPlaceholder');
  document.getElementById('editorPlaceholder').textContent = t('editorPlaceholder');
  document.getElementById('titleInput').placeholder = t('titlePlaceholder');
  document.getElementById('contentEditor').setAttribute('data-placeholder', t('writePlaceholder'));
  document.getElementById('fontInput').placeholder = t('fontLabel');
  document.getElementById('sizeInput').placeholder = t('sizeLabel');
  document.getElementById('foreColorBtn').title = t('foreColor');
  document.getElementById('hiliteColorBtn').title = t('hilite');
  document.getElementById('alignLeftBtn').title = t('alignLeft');
  document.getElementById('alignCenterBtn').title = t('alignCenter');
  document.getElementById('alignRightBtn').title = t('alignRight');
  document.getElementById('olBtn').title = t('ol');
  document.getElementById('ulBtn').title = t('ul');
  document.getElementById('clearFmtBtn').title = t('clearFmt');
  toolbar.querySelector('[data-cmd="bold"]').title = t('bold');
  toolbar.querySelector('[data-cmd="italic"]').title = t('italic');
  toolbar.querySelector('[data-cmd="underline"]').title = t('underline');
  toolbar.querySelector('[data-cmd="strikeThrough"]').title = t('strikethrough');
  document.getElementById('deleteTitle').textContent = t('deleteTitle');
  document.getElementById('cancelDeleteBtn').textContent = t('cancel');
  document.getElementById('confirmDeleteBtn').textContent = t('deleteBtn');
  document.getElementById('langBtn').textContent = t('langLabel');
  document.getElementById('loginLangBtn').textContent = t('langLabel');
  document.getElementById('manageBtn').textContent = t('manage');
  document.getElementById('selectAllLabel').textContent = t('selectAll');
  document.getElementById('batchDeleteBtn').textContent = t('batchDeleteBtn');
  document.getElementById('batchCancelBtn').textContent = t('batchCancel');
  renderNoteList();
}

function toggleLang() {
  curLang = curLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('lang', curLang);
  applyLang();
}

// --- Theme ---
var curTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function applyTheme() {
  document.documentElement.setAttribute('data-theme', curTheme);
  var icon = curTheme === 'dark' ? '\\u{1F31E}' : '\\u{1F319}';
  document.getElementById('themeBtn').textContent = icon;
  document.getElementById('loginThemeBtn').textContent = icon;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = curTheme === 'dark' ? '#1e1e1e' : '#ffffff';
}

function toggleTheme() {
  curTheme = curTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', curTheme);
  applyTheme();
}

function authHeaders() {
  var h = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = 'Bearer ' + authToken;
  return h;
}

var app = document.getElementById('app');
var loginScreen = document.getElementById('loginScreen');
var loginPassword = document.getElementById('loginPassword');
var loginBtn = document.getElementById('loginBtn');
var loginError = document.getElementById('loginError');
var noteList = document.getElementById('noteList');
var noteCount = document.getElementById('noteCount');
var editor = document.getElementById('editor');
var editorPlaceholder = document.getElementById('editorPlaceholder');
var editorContent = document.getElementById('editorContent');
var titleInput = document.getElementById('titleInput');
var contentEditor = document.getElementById('contentEditor');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var timestamps = document.getElementById('timestamps');
var deleteModal = document.getElementById('deleteModal');
var deleteModalText = document.getElementById('deleteModalText');
var confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
var toolbar = document.getElementById('toolbar');
var FONT_LIST = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Microsoft YaHei, sans-serif', label: '\\u5FAE\\u8F6F\\u96C5\\u9ED1' },
  { value: 'SimSun, serif', label: '\\u5B8B\\u4F53' },
  { value: 'SimHei, sans-serif', label: '\\u9ED1\\u4F53' },
  { value: 'KaiTi, serif', label: '\\u6977\\u4F53' },
  { value: 'FangSong, serif', label: '\\u4EFF\\u5B8B' },
  { value: 'PingFang SC, sans-serif', label: '\\u82F9\\u65B9' },
  { value: 'Noto Sans SC, sans-serif', label: 'Noto Sans SC' }
];

var fontInput = document.getElementById('fontInput');
var fontDropdown = document.getElementById('fontDropdown');
var fontCombo = document.getElementById('fontCombo');
var sizeInput = document.getElementById('sizeInput');
var sizeDropdown = document.getElementById('sizeDropdown');
var foreColorPicker = document.getElementById('foreColorPicker');
var hiliteColorPicker = document.getElementById('hiliteColorPicker');
var searchInput = document.getElementById('searchInput');

sizeDropdown.innerHTML = FONT_SIZES.map(function(s) { return '<div data-size="' + s + '">' + s + '</div>'; }).join('');

function generateId() { return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6); }

function formatRelativeTime(iso) {
  if (!iso) return '';
  var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return t('justNow');
  var m = Math.floor(s / 60); if (m < 60) return t('mAgo')(m);
  var h = Math.floor(m / 60); if (h < 24) return t('hAgo')(h);
  var d = Math.floor(h / 24); if (d < 30) return t('dAgo')(d);
  return new Date(iso).toLocaleDateString();
}

function formatTime(iso) { return iso ? new Date(iso).toLocaleString() : ''; }

async function loadNoteList() {
  try { var res = await fetch('/api/notes', { headers: authHeaders() }); notes = await res.json(); renderNoteList(); }
  catch (e) { console.error('Failed to load notes:', e); }
}

function getFilteredNotes() {
  var q = searchInput.value.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(function(n) { return (n.title || '').toLowerCase().indexOf(q) !== -1; });
}

var isSelectMode = false;
var selectedIds = {};

function enterSelectMode() {
  isSelectMode = true;
  selectedIds = {};
  noteList.classList.add('selecting');
  document.getElementById('batchBar').classList.add('show');
  document.getElementById('manageBtn').style.display = 'none';
  updateBatchState();
  renderNoteList();
}

function exitSelectMode() {
  isSelectMode = false;
  selectedIds = {};
  noteList.classList.remove('selecting');
  document.getElementById('batchBar').classList.remove('show');
  document.getElementById('manageBtn').style.display = '';
  document.getElementById('selectAllCb').checked = false;
  renderNoteList();
}

function toggleSelectAll() {
  var cb = document.getElementById('selectAllCb');
  var filtered = getFilteredNotes();
  if (cb.checked) {
    filtered.forEach(function(n) { selectedIds[n.id] = true; });
  } else {
    selectedIds = {};
  }
  renderNoteList();
  updateBatchState();
}

function toggleNoteSelect(id) {
  if (selectedIds[id]) delete selectedIds[id];
  else selectedIds[id] = true;
  var filtered = getFilteredNotes();
  document.getElementById('selectAllCb').checked = filtered.length > 0 && filtered.every(function(n) { return selectedIds[n.id]; });
  updateBatchState();
}

function updateBatchState() {
  var count = Object.keys(selectedIds).length;
  var btn = document.getElementById('batchDeleteBtn');
  btn.disabled = count === 0;
  btn.textContent = t('batchDeleteBtn') + (count > 0 ? ' (' + count + ')' : '');
}

function batchDelete() {
  var count = Object.keys(selectedIds).length;
  if (count === 0) return;
  deleteModalText.textContent = t('batchConfirm')(count);
  document.getElementById('deleteTitle').textContent = t('deleteTitle');
  pendingDeleteId = '__batch__';
  deleteModal.classList.add('show');
}

function renderNoteList() {
  var filtered = getFilteredNotes();
  noteCount.textContent = t('noteCount')(notes.length);
  if (filtered.length === 0) {
    noteList.innerHTML = '<div class="empty-state">' +
      (notes.length === 0
        ? '<div class="empty-state-icon">&#128221;</div><p>' + t('emptyState') + '</p>'
        : '<p>' + t('noMatch') + '</p>') +
      '</div>';
    return;
  }
  noteList.innerHTML = filtered.map(function(n) {
    var checked = selectedIds[n.id] ? ' checked' : '';
    return '<div class="note-item' + (n.id === currentNoteId ? ' active' : '') + '" data-id="' + esc(n.id) + '">' +
      '<input type="checkbox" class="note-checkbox" data-cb="' + esc(n.id) + '"' + checked + '>' +
      '<div class="note-item-content">' +
        '<div class="note-item-title">' + esc(n.title) + '</div>' +
        '<div class="note-item-time">' + formatRelativeTime(n.updatedAt) + '</div>' +
      '</div>' +
      '<button class="delete-btn" data-delete="' + esc(n.id) + '" data-title="' + esc(n.title) + '">&#215;</button></div>';
  }).join('');
}

searchInput.addEventListener('input', renderNoteList);

noteList.addEventListener('click', function(e) {
  var cb = e.target.closest('.note-checkbox');
  if (cb) { e.stopPropagation(); toggleNoteSelect(cb.dataset.cb); return; }
  if (isSelectMode) {
    var item = e.target.closest('.note-item');
    if (item && item.dataset.id) { toggleNoteSelect(item.dataset.id); var c = item.querySelector('.note-checkbox'); if (c) c.checked = !!selectedIds[item.dataset.id]; }
    return;
  }
  var db = e.target.closest('.delete-btn');
  if (db) { e.stopPropagation(); confirmDelete(db.dataset.delete, db.dataset.title); return; }
  var item2 = e.target.closest('.note-item');
  if (item2 && item2.dataset.id) loadNote(item2.dataset.id);
});

function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

function getEditorContent() {
  var h = contentEditor.innerHTML;
  return (h === '<br>' || h === '<div><br></div>' || h === '<p><br></p>') ? '' : h;
}

async function loadNote(id) {
  try {
    var res = await fetch('/api/notes/' + id, { headers: authHeaders() });
    if (!res.ok) return;
    var note = await res.json();
    currentNoteId = note.id;
    titleInput.value = note.title || '';
    contentEditor.innerHTML = note.content || '';
    showEditorContent(); updateStatus('saved');
    timestamps.textContent = t('createdAt')(formatTime(note.createdAt));
    renderNoteList();
    history.replaceState(null, '', '/#' + id);
    showEditor();
    // Set initial font/size from first content node
    setTimeout(function() {
      var target = contentEditor.firstChild;
      if (!target) { sizeInput.value = '12'; fontInput.value = 'Arial'; return; }
      if (target.nodeType === 3) target = target.parentNode;
      if (!target || target === contentEditor) { sizeInput.value = '12'; fontInput.value = 'Arial'; return; }
      var px = parseFloat(window.getComputedStyle(target).fontSize);
      if (px > 0) {
        var pt = Math.round(px * 0.75 * 10) / 10;
        sizeInput.value = pt % 1 === 0 ? String(Math.round(pt)) : pt.toFixed(1);
      }
    }, 50);
  } catch (e) { console.error('Failed to load note:', e); }
}

function createNote() {
  currentNoteId = null; titleInput.value = ''; contentEditor.innerHTML = '';
  showEditorContent(); updateStatus(''); timestamps.textContent = '';
  sizeInput.value = '12'; fontInput.value = 'Arial';
  titleInput.focus(); history.replaceState(null, '', '/'); showEditor();
}

function showEditorContent() { editorPlaceholder.style.display = 'none'; editorContent.style.display = 'flex'; }
function showEditor() { editor.classList.add('active'); }
function showSidebar() { editor.classList.remove('active'); }

function scheduleSave() { clearTimeout(saveTimeout); updateStatus('unsaved'); saveTimeout = setTimeout(performSave, 1000); }
contentEditor.addEventListener('input', scheduleSave);
contentEditor.addEventListener('focus', updateToolbarState);

async function performSave() {
  if (isSaving) return; isSaving = true; updateStatus('saving');
  var title = titleInput.value.trim() || 'Untitled', content = getEditorContent();
  try {
    if (!currentNoteId) {
      var id = generateId();
      var res = await fetch('/api/notes', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: id, title: title, content: content }) });
      if (!res.ok) throw new Error(); var data = await res.json();
      currentNoteId = data.id; history.replaceState(null, '', '/#' + currentNoteId);
      notes.unshift({ id: data.id, title: title, createdAt: data.createdAt, updatedAt: data.updatedAt }); renderNoteList();
    } else {
      var res2 = await fetch('/api/notes/' + currentNoteId, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ title: title, content: content }) });
      if (!res2.ok) throw new Error(); var data2 = await res2.json();
      var idx = notes.findIndex(function(n) { return n.id === currentNoteId; });
      if (idx !== -1) { notes[idx].title = title; notes[idx].updatedAt = data2.updatedAt; notes.unshift(notes.splice(idx,1)[0]); }
      renderNoteList();
    }
    retryCount = 0; updateStatus('saved');
  } catch (e) {
    retryCount++;
    if (retryCount <= 3) { updateStatus('error'); setTimeout(function() { isSaving = false; performSave(); }, retryCount * 3000); return; }
    updateStatus('error');
  } finally { isSaving = false; }
}

function updateStatus(state) {
  if (state === 'saved') { statusDot.className = 'status-dot saved'; statusText.textContent = t('saved')(new Date().toLocaleTimeString()); }
  else if (state === 'saving') { statusDot.className = 'status-dot saving'; statusText.textContent = t('saving'); }
  else if (state === 'unsaved') { statusDot.className = 'status-dot unsaved'; statusText.textContent = t('unsaved'); }
  else if (state === 'error') { statusDot.className = 'status-dot error'; statusText.textContent = t('saveFail') + (retryCount <= 3 ? t('retrying') : ''); }
  else { statusDot.className = 'status-dot'; statusText.textContent = ''; }
}

// --- Toolbar ---
function saveSelection() { var sel = window.getSelection(); if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange(); }
function restoreSelection() { if (savedRange) { contentEditor.focus(); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); } }

toolbar.addEventListener('mousedown', function(e) { if (e.target.closest('button')) e.preventDefault(); });
toolbar.addEventListener('click', function(e) {
  var btn = e.target.closest('button[data-cmd]'); if (!btn) return;
  document.execCommand(btn.dataset.cmd, false, null); updateToolbarState(); scheduleSave();
});

// Font combo
fontDropdown.innerHTML = FONT_LIST.map(function(f) {
  return '<div data-font="' + f.value + '" style="font-family:' + f.value + '">' + f.label + '</div>';
}).join('');

fontInput.addEventListener('mousedown', function(e) {
  e.preventDefault();
  saveSelection();
  fontDropdown.classList.toggle('show');
});

fontDropdown.addEventListener('mousedown', function(e) {
  var item = e.target.closest('[data-font]');
  if (!item) return;
  e.preventDefault();
  fontDropdown.classList.remove('show');
  restoreSelection();
  document.execCommand('fontName', false, item.dataset.font);
  fontInput.value = item.textContent;
  scheduleSave();
});

document.addEventListener('mousedown', function(e) {
  if (!fontCombo.contains(e.target)) fontDropdown.classList.remove('show');
});

// Size combo
function applyFontSize(pt) {
  var num = parseFloat(pt);
  if (isNaN(num) || num <= 0 || num > 999) return;
  restoreSelection();
  document.execCommand('fontSize', false, '7');
  var els = contentEditor.querySelectorAll('font[size="7"], span[style*="xxx-large"]');
  for (var i = 0; i < els.length; i++) { els[i].removeAttribute('size'); els[i].style.fontSize = num + 'pt'; }
  updateToolbarState(); scheduleSave();
}

sizeInput.addEventListener('focus', function() { saveSelection(); sizeDropdown.classList.add('show'); });
sizeInput.addEventListener('blur', function() { setTimeout(function() { sizeDropdown.classList.remove('show'); }, 150); });
sizeInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); if (sizeInput.value) applyFontSize(sizeInput.value); sizeInput.blur(); } });
sizeDropdown.addEventListener('mousedown', function(e) {
  var item = e.target.closest('[data-size]'); if (!item) return; e.preventDefault();
  applyFontSize(item.dataset.size); sizeDropdown.classList.remove('show');
});

// Color tools: button = apply color, arrow = open picker
var foreColorBtn = document.getElementById('foreColorBtn');
var foreColorBar = document.getElementById('foreColorBar');
var forePickerBtn = document.getElementById('forePickerBtn');
var hiliteColorBtn = document.getElementById('hiliteColorBtn');
var hiliteColorBar = document.getElementById('hiliteColorBar');
var hilitePickerBtn = document.getElementById('hilitePickerBtn');
var hiliteA = document.getElementById('hiliteA');

foreColorBtn.addEventListener('mousedown', function(e) { e.preventDefault(); saveSelection(); });
foreColorBtn.addEventListener('click', function() {
  restoreSelection(); document.execCommand('foreColor', false, foreColorPicker.value); scheduleSave();
});
forePickerBtn.addEventListener('mousedown', function(e) { e.preventDefault(); saveSelection(); });
forePickerBtn.addEventListener('click', function() { foreColorPicker.click(); });
foreColorPicker.addEventListener('input', function() {
  foreColorBar.style.background = foreColorPicker.value;
  restoreSelection(); document.execCommand('foreColor', false, foreColorPicker.value); scheduleSave();
});

hiliteColorBtn.addEventListener('mousedown', function(e) { e.preventDefault(); saveSelection(); });
hiliteColorBtn.addEventListener('click', function() {
  restoreSelection(); document.execCommand('hiliteColor', false, hiliteColorPicker.value); scheduleSave();
});
hilitePickerBtn.addEventListener('mousedown', function(e) { e.preventDefault(); saveSelection(); });
hilitePickerBtn.addEventListener('click', function() { hiliteColorPicker.click(); });
hiliteColorPicker.addEventListener('input', function() {
  hiliteColorBar.style.background = hiliteColorPicker.value;
  hiliteA.style.background = hiliteColorPicker.value;
  restoreSelection(); document.execCommand('hiliteColor', false, hiliteColorPicker.value); scheduleSave();
});

function detectFontAndSize() {
  var sel = window.getSelection();
  if (!sel.rangeCount) return;
  var node = sel.focusNode;
  if (!node || !contentEditor.contains(node)) return;
  // Detect font
  var raw = document.queryCommandValue('fontName');
  var curFont = raw.split(',')[0].trim().toLowerCase();
  if (curFont.charAt(0) === '"' || curFont.charAt(0) === "'") curFont = curFont.slice(1);
  if (curFont.length && (curFont.charAt(curFont.length - 1) === '"' || curFont.charAt(curFont.length - 1) === "'")) curFont = curFont.slice(0, -1);
  var fontLabel = '';
  for (var i = 0; i < FONT_LIST.length; i++) {
    var optFirst = FONT_LIST[i].value.split(',')[0].trim().toLowerCase();
    if (curFont && curFont === optFirst) { fontLabel = FONT_LIST[i].label; break; }
  }
  fontInput.value = fontLabel;
  // Detect size
  var el = node;
  if (el.nodeType === 3) el = el.parentNode;
  var px = parseFloat(window.getComputedStyle(el).fontSize);
  if (px > 0) {
    var pt = Math.round(px * 0.75 * 10) / 10;
    sizeInput.value = pt % 1 === 0 ? String(Math.round(pt)) : pt.toFixed(1);
  }
}
function updateToolbarState() {
  var cmds = ['bold','italic','underline','strikeThrough','justifyLeft','justifyCenter','justifyRight','insertOrderedList','insertUnorderedList'];
  for (var c = 0; c < cmds.length; c++) {
    var btn = toolbar.querySelector('[data-cmd="' + cmds[c] + '"]');
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmds[c]));
  }
  detectFontAndSize();
}
document.addEventListener('selectionchange', function() {
  var sel = window.getSelection(); if (sel.rangeCount && contentEditor.contains(sel.anchorNode)) updateToolbarState();
});

// --- Delete ---
var pendingDeleteId = null;
function confirmDelete(id, title) { pendingDeleteId = id; deleteModalText.textContent = t('deleteConfirm')(title); deleteModal.classList.add('show'); }
function closeDeleteModal() { pendingDeleteId = null; deleteModal.classList.remove('show'); }
confirmDeleteBtn.addEventListener('click', async function() {
  if (!pendingDeleteId) return;
  if (pendingDeleteId === '__batch__') {
    closeDeleteModal();
    var ids = Object.keys(selectedIds);
    try {
      await Promise.all(ids.map(function(id) { return fetch('/api/notes/' + id, { method: 'DELETE', headers: authHeaders() }); }));
      if (selectedIds[currentNoteId]) { currentNoteId = null; editorContent.style.display = 'none'; editorPlaceholder.style.display = 'flex'; showSidebar(); }
      notes = notes.filter(function(n) { return !selectedIds[n.id]; });
      exitSelectMode();
    } catch (e) { console.error('Batch delete failed:', e); }
    return;
  }
  var id = pendingDeleteId; closeDeleteModal();
  try {
    await fetch('/api/notes/' + id, { method: 'DELETE', headers: authHeaders() });
    if (currentNoteId === id) { currentNoteId = null; editorContent.style.display = 'none'; editorPlaceholder.style.display = 'flex'; showSidebar(); }
    notes = notes.filter(function(n) { return n.id !== id; }); renderNoteList();
  } catch (e) { console.error('Delete failed:', e); }
});
deleteModal.addEventListener('click', function(e) { if (e.target === deleteModal) closeDeleteModal(); });

// --- Login ---
async function tryAuth(pw) {
  var h = { 'Content-Type': 'application/json' }; if (pw) h['Authorization'] = 'Bearer ' + pw;
  return (await fetch('/api/auth', { method: 'POST', headers: h })).ok;
}
loginBtn.addEventListener('click', async function() {
  var pw = loginPassword.value; if (!pw) return;
  loginBtn.disabled = true; loginBtn.textContent = '...';
  if (await tryAuth(pw)) { authToken = pw; sessionStorage.setItem('authToken', pw); loginScreen.style.display = 'none'; app.style.display = 'flex'; startApp(); }
  else { loginError.style.display = 'block'; loginBtn.disabled = false; loginBtn.textContent = t('loginBtn'); }
});
loginPassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') loginBtn.click(); });

async function startApp() { await loadNoteList(); var hash = window.location.hash.slice(1); if (hash) await loadNote(hash); }

(async function init() {
  applyLang();
  applyTheme();
  if (await tryAuth(authToken)) { loginScreen.style.display = 'none'; app.style.display = 'flex'; startApp(); }
  else { authToken = ''; sessionStorage.removeItem('authToken'); loginScreen.style.display = 'flex'; app.style.display = 'none'; loginPassword.focus(); }
})();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    }
    if (path === '/' || path === '/index.html') {
      return new Response(HTML_CONTENT, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (path === '/api/auth' && method === 'POST') return handleAuth(request, env);
    if (path.startsWith('/api/') && !checkAuth(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (path === '/api/notes' && method === 'GET') return handleListNotes(env);
    if (path === '/api/notes' && method === 'POST') return handleCreateNote(request, env);
    const noteMatch = path.match(/^\/api\/notes\/([a-z0-9-]+)$/);
    if (noteMatch) {
      const id = noteMatch[1];
      if (method === 'GET') return handleGetNote(id, env);
      if (method === 'PUT') return handleUpdateNote(id, request, env);
      if (method === 'DELETE') return handleDeleteNote(id, env);
    }
    return new Response('Not Found', { status: 404 });
  },
};
