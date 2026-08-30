document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.querySelector("[data-current-user-id]");
  if (!dashboard || typeof io !== "function") return;

  const currentUserId = dashboard.dataset.currentUserId;
  const chatSection = document.querySelector(".chat-section");
  const chatContainer = document.querySelector("#chat-container");
  const chatForm = document.querySelector("#chat-form");
  const messageInput = document.querySelector("#message");
  const attachmentInput = document.querySelector("#attachment");
  const heading = document.querySelector(".tagLine");
  const statusMessage = document.querySelector("#chat-status");
  const channelState = document.querySelector("#channel-state");
  const callStatus = document.querySelector("#call-status");
  const incomingCall = document.querySelector("#incoming-call");
  const socket = io("/user-namespace");
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let receiverId = "";
  let receiverKey = "";
  let keyVersion = 0;
  let identityPromise;
  let call;
  let localStream;
  let pendingCall;

  const toB64 = (bytes) => {
    const view = new Uint8Array(bytes);
    let binary = "";
    for (let offset = 0; offset < view.length; offset += 0x8000) binary += String.fromCharCode(...view.subarray(offset, offset + 0x8000));
    return btoa(binary);
  };
  const fromB64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const setStatus = (message) => { statusMessage.textContent = message; };
  const setChannelState = (value, state = "") => { channelState.textContent = value; channelState.dataset.state = state; };
  const setCallStatus = (message) => { callStatus.textContent = message; };

  function openStore(mode, operation) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("starfleet-e2ee", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("keys");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("keys", mode);
        const result = operation(transaction.objectStore("keys"));
        transaction.oncomplete = async () => resolve(await result);
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  async function getIdentity() {
    const stored = await openStore("readonly", (store) => {
      const request = store.get("identity");
      return new Promise((resolve) => { request.onsuccess = () => resolve(request.result); });
    });
    if (stored) return stored;
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    const identity = { pair, publicKey: toB64(await crypto.subtle.exportKey("raw", pair.publicKey)) };
    await openStore("readwrite", (store) => store.put(identity, "identity"));
    return identity;
  }

  async function getConversationKey(publicKey) {
    const identity = await identityPromise;
    const remote = await crypto.subtle.importKey("raw", fromB64(publicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
    return crypto.subtle.deriveKey({ name: "ECDH", public: remote }, identity.pair.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encrypt(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getConversationKey(receiverKey);
    const clear = typeof value === "string" ? encoder.encode(value) : value;
    return { ciphertext: toB64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, clear)), iv: toB64(iv) };
  }

  async function decrypt(chat, isAttachment = false) {
    const record = isAttachment ? chat.attachment : chat;
    const key = await getConversationKey(receiverKey);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(record.iv) }, key, fromB64(record.ciphertext));
  }

  async function establishChannel() {
    await identityPromise;
    return new Promise((resolve) => socket.emit("getEncryptionKey", { receiver_id: receiverId }, (response) => {
      if (!response?.success) {
        receiverKey = "";
        setChannelState("WAITING FOR KEY", "waiting");
        setStatus("This crew member must open Starfleet once after this update to initialize their secure console.");
        return resolve(false);
      }
      receiverKey = response.publicKey;
      keyVersion = response.keyVersion;
      setChannelState("END-TO-END ENCRYPTED", "ready");
      return resolve(true);
    }));
  }

  async function appendChat(chat) {
    const row = document.createElement("article");
    const text = document.createElement("p");
    row.className = String(chat.sender_id) === currentUserId ? "current-user-chat" : "other-user-chat";
    try {
      text.textContent = decoder.decode(await decrypt(chat));
      if (chat.attachment) {
        const blob = new Blob([await decrypt(chat, true)]);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "starfleet-encrypted-attachment";
        link.textContent = "Retrieve attached encrypted file";
        row.append(link);
      }
    } catch {
      text.textContent = "This device cannot decrypt this earlier transmission.";
    }
    row.prepend(text);
    chatContainer.append(row);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  async function loadConversation() {
    const ready = await establishChannel();
    if (!ready) return;
    socket.emit("existingChats", { receiver_id: receiverId }, async (response) => {
      if (!response?.success) return setStatus(response?.message || "Conversation history is unavailable.");
      chatContainer.replaceChildren();
      for (const chat of response.chats) await appendChat(chat);
      setStatus(response.chats.length ? "Secure history loaded." : "Channel ready. No prior transmissions.");
    });
  }

  document.querySelectorAll(".user-list").forEach((button) => button.addEventListener("click", async () => {
    receiverId = button.dataset.id;
    receiverKey = "";
    heading.textContent = `Channel: ${button.dataset.label}`;
    chatSection.hidden = false;
    setChannelState("INITIALIZING");
    setStatus("Establishing encrypted channel…");
    await loadConversation();
    messageInput.focus();
  }));

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    const file = attachmentInput.files[0];
    if (!receiverId || !receiverKey || (!message && !file)) return setStatus("A ready encrypted channel and a message or attachment are required.");
    if (file && file.size > 8 * 1024 * 1024) return setStatus("Attachments are limited to 8 MB.");
    const sendButton = document.querySelector("#send-message");
    messageInput.disabled = true;
    sendButton.disabled = true;
    try {
      const payload = await encrypt(message || "Encrypted attachment");
      const attachment = file ? await encrypt(await file.arrayBuffer()) : undefined;
      socket.emit("sendChat", { receiver_id: receiverId, ...payload, keyVersion, attachment }, async (response) => {
        messageInput.disabled = false;
        sendButton.disabled = false;
        if (!response?.success) return setStatus(response?.message || "Transmission failed.");
        await appendChat(response.chat);
        messageInput.value = "";
        attachmentInput.value = "";
        setStatus("Transmission delivered.");
        messageInput.focus();
      });
    } catch (error) {
      messageInput.disabled = false;
      sendButton.disabled = false;
      setStatus("Unable to encrypt this transmission. Refresh the console and try again.");
    }
  });

  socket.on("loadNewChat", async (chat) => {
    if (String(chat.sender_id) === receiverId && receiverKey) {
      await appendChat(chat);
      setStatus("Incoming encrypted transmission.");
    }
    if (String(chat.sender_id) !== currentUserId && document.hidden && window.Notification?.permission === "granted") {
      new Notification("Starfleet Communications", { body: "New encrypted transmission" });
    }
  });

  socket.on("getOnlineUser", ({ user_id: userId }) => { const status = document.getElementById(`${userId}-status`); if (status) { status.textContent = "Online"; status.className = "online-status"; } });
  socket.on("getOfflineUser", ({ user_id: userId }) => { const status = document.getElementById(`${userId}-status`); if (status) { status.textContent = "Offline"; status.className = "offline-status"; } });
  socket.on("connect_error", () => setStatus("Real-time channel unavailable. Refresh to reconnect."));
  document.querySelector("#enable-notifications")?.addEventListener("click", async () => { const result = await window.Notification?.requestPermission(); setStatus(result === "granted" ? "Encrypted transmission alerts enabled." : "Alerts were not enabled."); });

  function createPeerConnection(targetId) {
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peer.ontrack = (event) => { document.querySelector("#remote-video").srcObject = event.streams[0]; };
    peer.onicecandidate = (event) => event.candidate && socket.emit("call:ice", { receiver_id: targetId, payload: event.candidate });
    peer.onconnectionstatechange = () => setCallStatus(`Call status: ${peer.connectionState}`);
    return peer;
  }

  async function startCall(video) {
    if (!receiverId) return setCallStatus("Select a crew member before opening a call.");
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      call = createPeerConnection(receiverId);
      localStream.getTracks().forEach((track) => call.addTrack(track, localStream));
      document.querySelector("#local-video").srcObject = localStream;
      document.querySelector(".call-media").hidden = false;
      document.querySelector("#end-call").hidden = false;
      const offer = await call.createOffer();
      await call.setLocalDescription(offer);
      socket.emit("call:offer", { receiver_id: receiverId, payload: offer });
      setCallStatus("Calling… awaiting response.");
    } catch {
      setCallStatus("Microphone/camera access was blocked or unavailable.");
      endCall();
    }
  }

  function endCall() {
    call?.close();
    localStream?.getTracks().forEach((track) => track.stop());
    call = undefined;
    localStream = undefined;
    pendingCall = undefined;
    incomingCall.hidden = true;
    document.querySelector(".call-media").hidden = true;
    document.querySelector("#end-call").hidden = true;
  }

  document.querySelector("#voice-call")?.addEventListener("click", () => startCall(false));
  document.querySelector("#video-call")?.addEventListener("click", () => startCall(true));
  document.querySelector("#end-call")?.addEventListener("click", () => { if (receiverId) socket.emit("call:end", { receiver_id: receiverId, payload: { ended: true } }); endCall(); setCallStatus("Call ended."); });

  socket.on("call:offer", ({ sender_id, payload }) => {
    pendingCall = { senderId: sender_id, offer: payload, video: payload?.sdp?.includes("m=video") };
    incomingCall.hidden = false;
    setCallStatus("Incoming call awaiting your acceptance.");
  });
  document.querySelector("#decline-call")?.addEventListener("click", () => { if (pendingCall) socket.emit("call:end", { receiver_id: pendingCall.senderId, payload: { declined: true } }); endCall(); setCallStatus("Incoming call declined."); });
  document.querySelector("#accept-call")?.addEventListener("click", async () => {
    if (!pendingCall) return;
    try {
      receiverId = pendingCall.senderId;
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: pendingCall.video });
      call = createPeerConnection(receiverId);
      localStream.getTracks().forEach((track) => call.addTrack(track, localStream));
      document.querySelector("#local-video").srcObject = localStream;
      document.querySelector(".call-media").hidden = false;
      document.querySelector("#end-call").hidden = false;
      await call.setRemoteDescription(pendingCall.offer);
      const answer = await call.createAnswer();
      await call.setLocalDescription(answer);
      socket.emit("call:answer", { receiver_id: receiverId, payload: answer });
      incomingCall.hidden = true;
      setCallStatus("Call connected. Media is peer-to-peer encrypted.");
    } catch { setCallStatus("Unable to accept the call. Check microphone/camera permission."); endCall(); }
  });
  socket.on("call:answer", ({ payload }) => call?.setRemoteDescription(payload).catch(() => setCallStatus("Unable to establish call.")));
  socket.on("call:ice", ({ payload }) => call?.addIceCandidate(payload).catch(() => {}));
  socket.on("call:end", () => { endCall(); setCallStatus("Remote party ended the call."); });

  identityPromise = getIdentity();
  socket.on("connect", async () => {
    try {
      const identity = await identityPromise;
      socket.emit("registerEncryptionKey", { publicKey: identity.publicKey }, (response) => {
        if (!response?.success) setStatus("Unable to initialize local encryption key.");
      });
    } catch { setStatus("This browser cannot initialize secure key storage."); }
  });
});
