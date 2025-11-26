
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const db = require('./server/db');

// wrapper to call db functions that return promises
const dbAsync = {
  getUserByEmail: (email) => new Promise((res, rej)=> db.getUserByEmail(email).then(res).catch(rej)),
  getUserById: (id) => new Promise((res, rej)=> db.getUserById(id).then(res).catch(rej)),
  createUser: (name,email,password,plan)=> db.createUser(name,email,password,plan),
  saveChat: (u,m,b)=> db.saveChat(u,m,b),
  getAllUsers: ()=> new Promise((res,rej)=> db.getAllUsers().then(res).catch(rej))
};


const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const PRICE_ID_PREMIUM = process.env.STRIPE_PRICE_ID || 'price_dummy';

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Auth routes ---
app.post('/api/register', async (req, res) => {
  const { name, email, password, plan } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const exists = db.getUserByEmail(email);
  if (exists) return res.status(400).json({ error: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  const userId = db.createUser(name||'', email, hash, plan || 'gratuito');
  const token = jwt.sign({ id: userId, email, plan: plan||'gratuito' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.getUserByEmail(email);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, plan: user.plan }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// --- Stripe checkout for premium ---
app.post('/api/create-checkout-session', authMiddleware, async (req, res) => {
  const domain = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        { price: PRICE_ID_PREMIUM, quantity: 1 }
      ],
      success_url: `${domain}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/?checkout=cancel`
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Stripe error' });
  }
});

// Stripe webhook to update subscription status (basic)
app.post('/webhook', bodyParser.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET || '';
  let event = null;
  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // handle events
  if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated') {
    // In a real app you'd link subscription -> user via metadata
    console.log('Stripe event:', event.type);
  }
  res.json({ received: true });
});

// --- Chat endpoint (placeholder for LLM) ---
app.post('/api/chat', authMiddleware, async (req, res) => {
  const user = db.getUserById(req.user.id);
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  // Gate features based on plan
  if (user.plan === 'gratuito') {
    // Simple canned responses + small simulated NLU
    const reply = `Hola ${user.name || ''}. Versión gratuita:
He recibido tu pregunta: "${message}". Te doy una guía básica: revisa la normativa aplicable y consulta a un profesional si es un caso complejo.`;
    db.saveChat(user.id, message, reply);
    return res.json({ reply });
  } else {
    // Premium: simulated "smarter" reply using simple heuristics.
    // Replace this block with a call to a real LLM (OpenAI, etc.)
    let reply = `Hola ${user.name || ''}. Versión premium:
Gracias por tu consulta. Análisis preliminar:
`;
    if (message.toLowerCase().includes('feminicidio') || message.toLowerCase().includes('violencia')) {
      reply += "- Parece un asunto de violencia familiar. Considera recopilar evidencia y acudir a las autoridades.
";
    }
    reply += "Si quieres, exporto un borrador de documento o te conecto con un abogado.
";
    db.saveChat(user.id, message, reply);
    return res.json({ reply });
  }
});

// --- Protected route example ---
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'No user' });
  res.json({ id: user.id, email: user.email, name: user.name, plan: user.plan });
});

// --- Admin: list users (very basic, should be protected further) ---
app.get('/api/admin/users', (req, res) => {
  const users = db.getAllUsers();
  res.json(users);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
