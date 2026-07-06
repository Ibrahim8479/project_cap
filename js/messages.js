// messages.js
const msgInput = document.getElementById('msgInput');
const msgSend = document.getElementById('msgSend');
const msgList = document.getElementById('messageList');

if (msgSend && msgInput && msgList) {
  const sendMsg = () => {
    const text = msgInput.value.trim();
    if (!text) return;
    const message = document.createElement('div');
    message.className = 'msg msg-sent';
    message.innerHTML = `<div class="msg-body">${text}</div><div class="msg-time">Just now</div>`;
    msgList.appendChild(message);
    msgList.scrollTop = msgList.scrollHeight;
    msgInput.value = '';
  };

  msgSend.addEventListener('click', sendMsg);
  msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });
}
