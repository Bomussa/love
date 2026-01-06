export default function handler(req, res) {
  res.status(200).json({ message: "Direct Vercel Hit", time: new Date().toISOString() });
}
