const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hiremeDesktop", {
  bootstrap: () => ipcRenderer.invoke("hireme:bootstrap"),
  getAuthState: () => ipcRenderer.invoke("hireme:auth:get"),
  loginWithGoogle: () => ipcRenderer.invoke("hireme:auth:login-google"),
  logout: () => ipcRenderer.invoke("hireme:auth:logout"),
  loadWorkspaceData: () => ipcRenderer.invoke("hireme:data:load"),
  loadReviewInbox: () => ipcRenderer.invoke("hireme:review:inbox"),
  decideAgentReview: (input) => ipcRenderer.invoke("hireme:review:decision", input),
  createConversation: (input) => ipcRenderer.invoke("hireme:data:create-conversation", input),
  hireDemoAgent: (input) => ipcRenderer.invoke("hireme:data:hire-demo-agent", input),
  updateConversation: (input) => ipcRenderer.invoke("hireme:data:update-conversation", input),
  deleteConversation: (input) => ipcRenderer.invoke("hireme:data:delete-conversation", input),
  saveMessage: (input) => ipcRenderer.invoke("hireme:data:save-message", input),
  createAgentDraft: (input) => ipcRenderer.invoke("hireme:agent:create-draft", input),
  deleteAgent: (input) => ipcRenderer.invoke("hireme:agent:delete", input),
  prepareAgentManagement: (input) => ipcRenderer.invoke("hireme:agent:prepare-management", input),
  updateAgentDesignSystem: (input) => ipcRenderer.invoke("hireme:agent:update-design-system", input),
  listPrivateHarnessFiles: (input) => ipcRenderer.invoke("hireme:agent:list-private-harness", input),
  readPrivateHarnessFile: (input) => ipcRenderer.invoke("hireme:agent:read-private-harness", input),
  updatePrivateHarnessFile: (input) => ipcRenderer.invoke("hireme:agent:update-private-harness", input),
  closeAgentManagement: (input) => ipcRenderer.invoke("hireme:agent:close-management", input),
  publishAgentDraft: (input) => ipcRenderer.invoke("hireme:agent:publish-draft", input),
  getAiSettings: () => ipcRenderer.invoke("hireme:ai:get"),
  connectCodex: () => ipcRenderer.invoke("hireme:ai:connect-codex"),
  cancelAiConnection: () => ipcRenderer.invoke("hireme:ai:cancel-connect"),
  disconnectCodex: () => ipcRenderer.invoke("hireme:ai:disconnect-codex"),
  saveAiSettings: (selection) => ipcRenderer.invoke("hireme:ai:save", selection),
  chooseWorkspace: () => ipcRenderer.invoke("hireme:workspace:choose"),
  pickFiles: () => ipcRenderer.invoke("hireme:files:pick"),
  previewFile: (path) => ipcRenderer.invoke("hireme:files:preview", path),
  openFile: (path) => ipcRenderer.invoke("hireme:files:open", path),
  sendChat: (request) => ipcRenderer.invoke("hireme:chat:send", request),
  cancelRun: (runId) => ipcRenderer.invoke("hireme:chat:cancel", runId),
  onRunEvent: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("hireme:run:event", wrapped);
    return () => ipcRenderer.removeListener("hireme:run:event", wrapped);
  },
  onAuthStateChanged: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("hireme:auth:changed", wrapped);
    return () => ipcRenderer.removeListener("hireme:auth:changed", wrapped);
  },
  onAiSettingsChanged: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("hireme:ai:changed", wrapped);
    return () => ipcRenderer.removeListener("hireme:ai:changed", wrapped);
  },
});
