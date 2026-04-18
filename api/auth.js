const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.2143228,
  key: process.env.6291de89719e0ba9f19b,
  secret: process.env.6a462c31f19413184489,
  cluster: process.env.us2,
  useTLS: true
});

export default function handler(req, res) {
  if (req.method === 'POST') {
    const body = req.body;
    
    pusher.authorizeChannel(body.socket_id, 'world-channel', (err, auth) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Auth failed' });
      }
      res.json(auth);
    });
  } else {
    res.status(405).end();
  }
}
