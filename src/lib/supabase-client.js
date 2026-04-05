const noopBuilder = {
  select: () => noopBuilder,
  eq: () => noopBuilder,
  gt: () => noopBuilder,
  order: async () => ({ data: [], error: null }),
  update: () => ({ eq: async () => ({ data: null, error: null }) }),
};

export const supabase = {
  from: () => noopBuilder,
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
  removeChannel: () => {},
};

export default supabase;
