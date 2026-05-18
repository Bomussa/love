export async function handleStatus(req, res) {
  res.status(410).json({
    success: false,
    error: 'PIN handlers have been removed.',
  });
}

export async function handleVerify(req, res) {
  res.status(410).json({
    success: false,
    error: 'PIN handlers have been removed.',
  });
}