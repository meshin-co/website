function gatePort(env) {
  if (env.GATE_SERVER_PORT) return Number(env.GATE_SERVER_PORT);
  return 4330 + (Number(env.LH_SHARD_INDEX ?? 1) - 1);
}

module.exports = { gatePort };
