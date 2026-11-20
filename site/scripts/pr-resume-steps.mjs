export const failure = (subject, error, extra = {}) => ({ kind: 'failed', subject, message: error.message, ...extra });

export async function attempted(what, action, remedy = '') {
  try {
    await action();
    return null;
  } catch (error) {
    return `${what}: ${error.message}${remedy}`;
  }
}

export async function settled(subject, action, extra) {
  try {
    return await action();
  } catch (error) {
    return failure(subject, error, extra);
  }
}

export async function asItems(subject, action) {
  try {
    return await action();
  } catch (error) {
    return [failure(subject, error)];
  }
}
