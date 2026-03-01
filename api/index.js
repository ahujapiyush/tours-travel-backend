/**
 * Vercel serverless function entry point — minimal test version.
 */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'ok', url: req.url, ts: Date.now() }));
};
