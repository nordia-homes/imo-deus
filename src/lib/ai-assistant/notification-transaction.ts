import type { Transaction } from 'firebase-admin/firestore';

// The emulator can report an invalidated read as INVALID_ARGUMENT rather than
// ABORTED. Normalize only that exact get failure, letting the SDK restart the
// whole transaction with its existing bounded retries. Never wrap a commit.
export function notificationTransactionReads(transaction: Transaction): Transaction {
  return new Proxy(transaction, {
    get(target, key) {
      if (key === 'get') return async (...args: unknown[]) => {
        try { return await Reflect.apply(target.get, target, args); }
        catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 3 && /^(?:3 INVALID_ARGUMENT: )?Transaction is invalid or closed\.$/.test(error.message)) {
            throw Object.assign(new Error(error.message, { cause: error }), { code: 10 });
          }
          throw error;
        }
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
