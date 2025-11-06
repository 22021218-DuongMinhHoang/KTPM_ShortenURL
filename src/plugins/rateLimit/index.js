module.exports = {
  meta: { priority: NUMBER, phase: 'read'|'write'|'both' },
  register: async ({app}) => { /* optional middleware setup */ },
  decorate: (service) => { /* optional: return wrapped service */ }
}