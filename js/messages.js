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
  const senderName = message.first_name ? `${message.first_name} ${message.last_name || ''}`.trim() : '';
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  if (!isSelf && senderName) {
    const sender = document.createElement('strong');
    sender.className = 'msg-sender';
    sender.textContent = senderName;
    meta.appendChild(sender);
  }
  const time = document.createElement('span');
  time.className = 'msg-time-small';
  time.textContent = new Date(message.sent_at).toLocaleString();
  meta.appendChild(time);
  const body = document.createElement('div');
  body.className = 'msg-body';
  body.textContent = message.body;
  container.append(meta, body);
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
    if (!res.ok) throw new Error(`Could not load user profile (${res.status}).`);
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
  if (!partnerId || !msgList) return;
  try {
    const res = await fetch('php/session_api.php?action=get_messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ with: partnerId })
    });
    if (!res.ok) throw new Error(`Could not load messages (${res.status}).`);
    const data = await res.json();
    if (data.error) {
      msgList.textContent = data.error;
      return;
    }
    // preserve scroll position if near bottom
    const atBottom = msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight < 40;
    msgList.innerHTML = '';
    for (const m of data.messages || []) {
      msgList.appendChild(renderMessage(m));
    }
    if (atBottom) msgList.scrollTop = msgList.scrollHeight;
  } catch (err) {
    console.error('Failed to load messages', err);
    msgList.textContent = 'Could not load messages. Please try again.';
  }
}

async function initMessagesPage() {
  const current = await fetchCurrentUser();
  if (!current || !current.user) return;
  currentUserId = current.user.id;

  if (current.user.role === 'patient') {
    const partnerId = current.clinician_id;
    if (!partnerId) {
      msgList.textContent = 'No clinician assigned yet.';
      return;
    }
    conversationPartnerId = partnerId;
    await loadConversation(partnerId);
    // start polling for new messages every 3s
    setInterval(() => loadConversation(conversationPartnerId), 3000);
  } else {
    try {
      const res = await fetch('php/clinician_api.php?action=patients');
      if (!res.ok) throw new Error(`Could not load patients (${res.status}).`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const patients = data.patients || [];
      const firstPatient = patients[0];
      if (!firstPatient) {
        msgList.textContent = 'No patients assigned yet.';
        return;
      }
      const picker = document.getElementById('conversationPicker');
      const select = document.getElementById('conversationSelect');
      if (picker && select) {
        select.replaceChildren();
        for (const patient of patients) {
          const option = document.createElement('option');
          option.value = patient.id;
          option.textContent = `${patient.first_name} ${patient.last_name}`.trim();
          select.appendChild(option);
        }
        picker.hidden = false;
        select.addEventListener('change', () => {
          conversationPartnerId = Number(select.value);
          loadConversation(conversationPartnerId);
        });
      }
      conversationPartnerId = firstPatient.id;
      await loadConversation(conversationPartnerId);
      setInterval(() => loadConversation(conversationPartnerId), 3000);
    } catch (err) {
      console.error('Failed to load clinician patients', err);
      msgList.textContent = 'Could not load conversation partner.';
    }
  }
}

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !conversationPartnerId) return;
  msgSend.disabled = true;
  try {
    const res = await fetch('php/session_api.php?action=send_message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: conversationPartnerId, body: text })
    });
    if (!res.ok) throw new Error(`Message could not be sent (${res.status}).`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Message could not be sent.');
    }
    // refresh conversation from server (ensures timestamps and read flags updated)
    await loadConversation(conversationPartnerId);
    msgInput.value = '';
  } catch (err) {
    console.error('Send message failed', err);
    msgList.textContent = err.message || 'Message could not be sent. Please try again.';
  } finally {
    msgSend.disabled = false;
  }
}

if (msgSend && msgInput && msgList) {
  msgSend.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  document.addEventListener('DOMContentLoaded', initMessagesPage);
}
