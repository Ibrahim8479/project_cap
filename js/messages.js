// messages.js
const msgInput = document.getElementById('msgInput');
const msgSend = document.getElementById('msgSend');
const msgList = document.getElementById('messageList');
let conversationPartnerId = null;
let currentUserId = null;

function renderMessage(message) {
  const isSelf = message.sender_id === currentUserId;
  const container = document.createElement('div');
  container.className = `msg ${isSelf ? 'msg-sent' : 'msg-received'}`;
  container.innerHTML = `
    <div class="msg-body">${message.body}</div>
    <div class="msg-time">${new Date(message.sent_at).toLocaleString()}</div>
  `;
  return container;
}

function setPageUserHeader(user) {
  if (!user) return;
  const userNameEl = document.getElementById('userName');
  const userRoleEl = document.getElementById('userRole');
  if (userNameEl) userNameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (userRoleEl) userRoleEl.textContent = user.role || '';
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('php/me.php');
    if (res.status === 401) {
      window.location.href = 'login.html';
      return null;
    }
    const data = await res.json();
    if (!data || !data.user) return null;
    setPageUserHeader(data.user);
    return data;
  } catch (err) {
    console.error('Failed to fetch current user', err);
    return null;
  }
}

async function loadConversation(partnerId) {
  if (!partnerId) return;
  try {
    const res = await fetch('php/session_api.php?action=get_messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ with: partnerId })
    });
    const data = await res.json();
    if (data.error) {
      msgList.innerHTML = `<div class="text-muted">${data.error}</div>`;
      return;
    }
    msgList.innerHTML = '';
    for (const m of data.messages || []) {
      msgList.appendChild(renderMessage(m));
    }
    msgList.scrollTop = msgList.scrollHeight;
  } catch (err) {
    console.error('Failed to load messages', err);
    msgList.innerHTML = '<div class="text-muted">Could not load messages.</div>';
  }
}

async function initMessagesPage() {
  const current = await fetchCurrentUser();
  if (!current || !current.user) return;
  currentUserId = current.user.id;

  if (current.user.role === 'patient') {
    const partnerId = current.clinician_id;
    if (!partnerId) {
      msgList.innerHTML = '<div class="text-muted">No clinician assigned yet.</div>';
      return;
    }
    conversationPartnerId = partnerId;
    await loadConversation(partnerId);
  } else {
    try {
      const res = await fetch('php/clinician_api.php?action=patients');
      const data = await res.json();
      const firstPatient = data.patients?.[0];
      if (!firstPatient) {
        msgList.innerHTML = '<div class="text-muted">No patients assigned yet.</div>';
        return;
      }
      conversationPartnerId = firstPatient.id;
      await loadConversation(conversationPartnerId);
    } catch (err) {
      console.error('Failed to load clinician patients', err);
      msgList.innerHTML = '<div class="text-muted">Could not load conversation partner.</div>';
    }
  }
}

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !conversationPartnerId) return;
  try {
    const res = await fetch('php/session_api.php?action=send_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: conversationPartnerId, body: text })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Send failed', data);
      return;
    }
    msgList.appendChild(renderMessage({ sender_id: currentUserId, body: text, sent_at: new Date().toISOString() }));
    msgList.scrollTop = msgList.scrollHeight;
    msgInput.value = '';
  } catch (err) {
    console.error('Send message failed', err);
  }
}

if (msgSend && msgInput && msgList) {
  msgSend.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  document.addEventListener('DOMContentLoaded', initMessagesPage);
}
