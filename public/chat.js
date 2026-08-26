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
  const heading = document.querySelector(".tagLine");
  const statusMessage = document.querySelector("#chat-status");
  const socket = io("/user-namespace");
  let receiverId = "";

  function setStatus(message) {
    if (statusMessage) {
      statusMessage.textContent = message;
    }
  }

  function appendChat(chat) {
    const row = document.createElement("div");
    const text = document.createElement("p");
    const isCurrentUser = String(chat.sender_id) === currentUserId;

    row.className = isCurrentUser ? "current-user-chat" : "other-user-chat";
    text.textContent = chat.message;
    row.append(text);
    chatContainer.append(row);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function renderConversation(chats) {
    chatContainer.replaceChildren();
    chats.forEach(appendChat);
  }

  document.querySelectorAll(".user-list").forEach((button) => {
    button.addEventListener("click", () => {
      receiverId = button.dataset.id;
      heading.textContent = `Communicating with ${button.dataset.label}`;
      chatSection.hidden = false;
      messageInput.focus();
      setStatus("Loading secure channel…");

      socket.emit("existingChats", { receiver_id: receiverId }, (response) => {
        if (!response?.success) {
          setStatus(response?.message || "Unable to load the conversation.");
          return;
        }

        renderConversation(response.chats);
        setStatus(response.chats.length ? "" : "No previous transmissions.");
      });
    });
  });

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();

    if (!receiverId || !message) {
      setStatus("Select a crew member and enter a message.");
      return;
    }

    messageInput.disabled = true;
    socket.emit("sendChat", { receiver_id: receiverId, message }, (response) => {
      messageInput.disabled = false;
      messageInput.focus();

      if (!response?.success) {
        setStatus(response?.message || "Message delivery failed.");
        return;
      }

      appendChat(response.chat);
      messageInput.value = "";
      setStatus("");
    });
  });

  socket.on("loadNewChat", (chat) => {
    if (String(chat.sender_id) === receiverId) {
      appendChat(chat);
      setStatus("");
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
});
