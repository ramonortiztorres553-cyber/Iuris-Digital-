
const api = {
  register: '/api/register',
  login: '/api/login',
  me: '/api/me',
  chat: '/api/chat',
  checkout: '/api/create-checkout-session',
  adminUsers: '/api/admin/users'
};

let token = localStorage.getItem('iuris_token') || null;
const state = { user: null };

async function request(url, data, method='POST', auth=true) {
  const opts = { method, headers: { 'Content-Type':'application/json' } };
  if (auth && token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (data && method!=='GET') opts.body = JSON.stringify(data);
  const res = await fetch(url, opts);
  return res.json();
}

document.getElementById('startRegister').onclick = () => toggle('#registro');
document.getElementById('btnShowRegister').onclick = () => toggle('#registro');
document.getElementById('btnPlans').onclick = () => toggle('#plans');
document.getElementById('startChat').onclick = () => toggle('#chatbot');

function toggle(sel){ document.querySelectorAll(sel).forEach(s=>s.classList.toggle('hidden') ); }

document.getElementById('btnRegister').onclick = async () => {
  const name=document.getElementById('name').value;
  const email=document.getElementById('email').value;
  const password=document.getElementById('password').value;
  const plan=document.getElementById('planSelect').value;
  const r = await request(api.register, {name,email,password,plan}, 'POST', false);
  if (r.error) { document.getElementById('registerMsg').innerText = r.error; return; }
  token = r.token; localStorage.setItem('iuris_token', token);
  await loadMe();
};

document.getElementById('btnLogin').onclick = async () => {
  const email=document.getElementById('email').value;
  const password=document.getElementById('password').value;
  const r = await request(api.login, {email,password}, 'POST', false);
  if (r.error) { document.getElementById('registerMsg').innerText = r.error; return; }
  token = r.token; localStorage.setItem('iuris_token', token);
  await loadMe();
};

async function loadMe(){
  if (!token) return;
  const r = await request(api.me, null, 'GET');
  if (r.error) { console.log(r); return; }
  state.user = r;
  document.getElementById('registerMsg').innerText = `Conectado como ${r.email} — Plan: ${r.plan}`;
  document.getElementById('startChat').disabled = false;
  document.getElementById('btnSubscribe').disabled = false;
}

document.getElementById('sendBtn').onclick = sendMessage;
document.getElementById('btnSubscribe').onclick = async () => {
  if (!token) { alert('Inicia sesión primero'); return; }
  const r = await request(api.checkout, {}, 'POST', true);
  if (r.url) window.location = r.url;
  else alert('Error al crear sesión de pago');
};

async function sendMessage(){
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg) return;
  appendMsg('Tú', msg, 'user');
  input.value = '';
  const res = await request(api.chat, {message: msg}, 'POST', true);
  if (res.error) {
    appendMsg('IurisBot', 'Error: ' + res.error);
  } else {
    appendMsg('IurisBot', res.reply || 'Sin respuesta');
  }
}

function appendMsg(author, text, cls='bot'){
  const win = document.getElementById('chatWindow');
  const el = document.createElement('div');
  el.className = 'msg ' + (cls||'');
  el.innerHTML = `<div class="${cls}"><strong>${author}:</strong></div><div>${text.replace(/\n/g,'<br>')}</div>`;
  win.appendChild(el);
  win.scrollTop = win.scrollHeight;
}

window.addEventListener('load', loadMe);
