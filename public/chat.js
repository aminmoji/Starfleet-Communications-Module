document.addEventListener("DOMContentLoaded", () => {
  const dashboard = document.querySelector("[data-current-user-id]");
  if (!dashboard || typeof io !== "function") {
    return;
  }

  const currentUserId = dashboard.dataset.currentUserId;
  const chatSection = document.querySelector(".chat-section");
  const chatContainer = document.querySelector("#chat-container");
  const chatForm = document.querySelector("#chat-form");
  const messageInput = document.querySelector("#message");
  const attachmentInput = document.querySelector("#attachment");
  const heading = document.querySelector(".tagLine");
  const statusMessage = document.querySelector("#chat-status");
  const socket = io("/user-namespace");
  let receiverId = "";
  let receiverKey;
  let keyVersion;
  let identity;
  let call;
  let localStream;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const toB64 = (bytes) => {
    const view = new Uint8Array(bytes);
    let binary = "";
    for (let offset = 0; offset < view.length; offset += 0x8000) {
      binary += String.fromCharCode(...view.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  };
  const fromB64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

  async function getIdentity() {
    const stored = await new Promise((resolve) => {
      const request = indexedDB.open("starfleet-e2ee", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("keys");
      request.onsuccess = () => { const tx = request.result.transaction("keys", "readonly"); const read = tx.objectStore("keys").get("identity"); read.onsuccess = () => resolve(read.result); };
    });
    if (stored) return stored;
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
    const publicKey = toB64(await crypto.subtle.exportKey("raw", pair.publicKey));
    const value = { pair, publicKey };
    await new Promise((resolve) => { const request = indexedDB.open("starfleet-e2ee", 1); request.onsuccess = () => { const tx = request.result.transaction("keys", "readwrite"); tx.objectStore("keys").put(value, "identity"); tx.oncomplete = resolve; }; });
    return value;
  }

  async function conversationKey(publicKey) {
    const remote = await crypto.subtle.importKey("raw", fromB64(publicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
    return crypto.subtle.deriveKey({ name: "ECDH", public: remote }, identity.pair.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function encrypt(value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await conversationKey(receiverKey);
    return { ciphertext: toB64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, typeof value === "string" ? encoder.encode(value) : value)), iv: toB64(iv) };
  }

  async function decrypt(chat, attachment = false) {
    const record = attachment ? chat.attachment : chat;
    const key = await conversationKey(receiverKey);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(record.iv) }, key, fromB64(record.ciphertext));
  }

  async function establishChannel() {
    return new Promise((resolve) => socket.emit("getEncryptionKey", { receiver_id: receiverId }, async (response) => {
      if (!response?.success) { setStatus(response?.message || "Secure channel unavailable."); return resolve(false); }
      receiverKey = response.publicKey; keyVersion = response.keyVersion; resolve(true);
    }));
  }

  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }

  async function appendChat(chat) {
    const row = document.createElement("div");
    const text = document.createElement("p");
    const isCurrentUser = String(chat.sender_id) === currentUserId;

    row.className = isCurrentUser ? "current-user-chat" : "other-user-chat";
    try {
      text.textContent = decoder.decode(await decrypt(chat));
      if (chat.attachment) {
        const blob = new Blob([await decrypt(chat, true)]);
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "encrypted-attachment"; link.textContent = "Download encrypted attachment"; row.append(link);
      }
    } catch { text.textContent = "Unable to decrypt this transmission on this device."; }
    row.append(text);
    chatContainer.append(row);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  async function renderConversation(chats) {
    chatContainer.replaceChildren();
    for (const chat of chats) await appendChat(chat);
  }

  document.querySelectorAll(".user-list").forEach((button) => {
    button.addEventListener("click", () => {
      receiverId = button.dataset.id;
      heading.textContent = `Communicating with ${button.dataset.label}`;
      chatSection.hidden = false;
      messageInput.focus();
      setStatus("Loading secure channel…");
      establishChannel().then((ready) => ready && socket.emit("existingChats", { receiver_id: receiverId }, async (response) => {
        if (!response?.success) {
          setStatus(response?.message || "Unable to load the conversation.");
          return;
        }

        await renderConversation(response.chats);
        setStatus(response.chats.length ? "" : "No previous transmissions.");
      }));
    });
  });

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    const file = attachmentInput.files[0];

    if (!receiverId || (!message && !file) || !receiverKey) {
      setStatus("Select a crew member and enter a message or attachment.");
      return;
    }

    if (file && file.size > 8 * 1024 * 1024) { setStatus("Attachments are limited to 8 MB."); return; }
    messageInput.disabled = true;
    const payload = await encrypt(message || "Encrypted attachment");
    const attachment = file ? await encrypt(await file.arrayBuffer()) : undefined;
    socket.emit("sendChat", { receiver_id: receiverId, ...payload, keyVersion, attachment }, async (response) => {
      messageInput.disabled = false;
      messageInput.focus();

      if (!response?.success) {
        setStatus(response?.message || "Message delivery failed.");
        return;
      }

      await appendChat(response.chat);
      messageInput.value = "";
      attachmentInput.value = "";
      setStatus("");
    });
  });

  socket.on("loadNewChat", (chat) => {
    if (String(chat.sender_id) === receiverId) {
      appendChat(chat);
      setStatus("");
    }
    if (String(chat.sender_id) !== currentUserId && document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification("Starfleet Communications", { body: "New encrypted transmission" });
    }
  });

  socket.on("getOnlineUser", ({ user_id: userId }) => {
    const status = document.getElementById(`${userId}-status`);
    if (status) {
      status.textContent = "Online";
      status.className = "online-status";
    }
  });

  socket.on("getOfflineUser", ({ user_id: userId }) => {
    const status = document.getElementById(`${userId}-status`);
    if (status) {
      status.textContent = "Offline";
      status.className = "offline-status";
    }
  });

  socket.on("connect_error", () => {
    setStatus("The real-time channel is unavailable. Refresh to reconnect.");
  });

  document.querySelector("#enable-notifications")?.addEventListener("click", () => window.Notification?.requestPermission());

  async function startCall(video) {
    if (!receiverId) return setStatus("Select a crew member before calling.");
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    call = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.getTracks().forEach((track) => call.addTrack(track, localStream));
    call.ontrack = (event) => { document.querySelector("#remote-video").srcObject = event.streams[0]; };
    call.onicecandidate = (event) => event.candidate && socket.emit("call:ice", { receiver_id: receiverId, payload: event.candidate });
    document.querySelector("#local-video").srcObject = localStream; document.querySelector(".call-media").hidden = false; document.querySelector("#end-call").hidden = false;
    const offer = await call.createOffer(); await call.setLocalDescription(offer);
    socket.emit("call:offer", { receiver_id: receiverId, payload: offer });
  }
  document.querySelector("#voice-call")?.addEventListener("click", () => startCall(false));
  document.querySelector("#video-call")?.addEventListener("click", () => startCall(true));
  socket.on("call:offer", async ({ sender_id, payload }) => {
    receiverId = sender_id;
    const wantsVideo = payload?.sdp?.includes("m=video");
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
    call = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    localStream.getTracks().forEach((track) => call.addTrack(track, localStream));
    call.ontrack = (event) => { document.querySelector("#remote-video").srcObject = event.streams[0]; };
    call.onicecandidate = (event) => event.candidate && socket.emit("call:ice", { receiver_id: sender_id, payload: event.candidate });
    document.querySelector("#local-video").srcObject = localStream;
    document.querySelector(".call-media").hidden = false;
    document.querySelector("#end-call").hidden = false;
    await call.setRemoteDescription(payload);
    const answer = await call.createAnswer();
    await call.setLocalDescription(answer);
    socket.emit("call:answer", { receiver_id: sender_id, payload: answer });
  });
  socket.on("call:answer", ({ payload }) => call?.setRemoteDescription(payload));
  socket.on("call:ice", ({ payload }) => call?.addIceCandidate(payload));
  document.querySelector("#end-call")?.addEventListener("click", () => { call?.close(); localStream?.getTracks().forEach((track) => track.stop()); document.querySelector(".call-media").hidden = true; });
  identity = null;
  socket.on("connect", async () => { identity = await getIdentity(); socket.emit("registerEncryptionKey", { publicKey: identity.publicKey }, (response) => { if (!response?.success) setStatus("Unable to initialize end-to-end encryption."); }); });
});
